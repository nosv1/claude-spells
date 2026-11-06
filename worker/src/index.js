// SpellIt!'s family sync (a Cloudflare Worker with a D1 database). One family, no accounts: every
// call carries the family PIN, which lives only in the Worker's secrets (FAMILY_PIN).
//
//   POST /sync  { since, changes: [{ kind, id, data, updated, deleted }] }
//            →  { cursor, more, records: [{ kind, id, data, updated, deleted }] }
//
// kind is 'profile' (a player) or 'list' (a Parent-mode word list); data is its JSON, as text.
// A change is kept if it's newer (updated, the device's clock) than what's here: newest wins, per
// player or list. The answer is every record changed since the device's cursor, plus the record
// that won for any change that lost, so the device can take it. "more" means call again.
//
//   POST /drawings { op: 'list', player }                        →  { drawings: [{ id, updated, deleted }] }
//                  { op: 'get', id }                             →  { id, player, image, updated, deleted }
//                  { op: 'put', id, player, image, updated, deleted }  →  { kept, updated }
//
// A player's drawing-break pictures (draw.js), apart from /sync so a sync never carries images.
// image is a PNG or JPEG data URL (null once deleted). Newest wins (updated), per drawing; a put
// that loses says so, with the newer time, and the device fetches that one.
//
//   GET /health  →  { ok, routes, tables }   (no PIN: for checking a deploy, see tools/deploy_worker.mjs)
//
//   POST /speak { text, voice }  →  audio/mpeg
//
// A natural voice saying text (Workers AI, Deepgram Aura-2). Each clip is made once and kept in D1,
// so saying the same thing again is free. voice is one of VOICES. New clips stop for the day at
// DAILY_CHARS, inside Workers AI's free allowance, so this never costs anything: the app then uses
// the device's own voice (503) until 00:00 UTC.
//
// Overnight (a Cron Trigger, every 2 minutes in the last hour before 00:00 UTC), whatever is left
// of the day's allowance makes clips ahead of time: the letters, the family's own word lists, the
// players' grades, then the rest of the built-in bank (read from the site's words.js).
//
// Every call carries header "X-Family-Pin". Wrong PINs are limited per address and in total, so 4
// digits can't be guessed by trying them all.

import { MAX_TEXT, fillOrder, parseBank, tidy } from './fill.js';

const SITE_ORIGINS = ['https://nosv1.github.io', 'null']; // 'null': index.html opened from disk
const LOCAL_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;
const KINDS = ['profile', 'list'];
const ID = /^[\w-]{1,64}$/;
const IMAGE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/;
const MAX_BODY = 4 * 1024 * 1024, MAX_DATA = 1024 * 1024, MAX_CHANGES = 200, PAGE = 200;
const HOUR = 3600e3;
const FAILS_PER_IP = 10, FAILS_TOTAL = 100; // wrong PINs allowed per hour
const VOICES = ['thalia', 'luna', 'helena', 'asteria', 'athena', 'apollo', 'arcas', 'orion', 'zeus'];

const DAILY_CHARS = 3000; // free: 10,000 neurons a day; Aura-2 is 2,727 neurons per 1,000 characters
const FAMILY_VOICE = 'thalia'; // the app's first natural voice
const WORDS_URL = 'https://nosv1.github.io/claude-spells/words.js';
// A run makes this many at most: the Workers Free plan allows 50 calls out (AI, D1, fetch) per run.
const FILL_PER_RUN = 15;
const FILL_RESERVE = 600; // left for anyone practising during the fill, until its last 10 minutes

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const cors = SITE_ORIGINS.includes(origin) || LOCAL_ORIGIN.test(origin) ? {
      'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Content-Type, X-Family-Pin',
      'Access-Control-Allow-Methods': 'POST', 'Access-Control-Max-Age': '86400', Vary: 'Origin',
    } : {};
    const send = (status, body) => new Response(JSON.stringify(body), {
      status, headers: { 'Content-Type': 'application/json', ...cors },
    });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    if (url.pathname === '/health' && req.method === 'GET') return health(env, send);
    const route = ROUTES[url.pathname];
    if (!route || req.method !== 'POST') return send(404, { error: 'not found' });

    // The PIN, behind the wrong-PIN limit.
    const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
    const now = Date.now();
    const { mine, all } = await env.DB.prepare(
      'SELECT SUM(ip = ?) AS mine, COUNT(*) AS all_ FROM fails WHERE t > ?',
    ).bind(ip, now - HOUR).first().then((r) => ({ mine: r?.mine || 0, all: r?.all_ || 0 }));
    if (mine >= FAILS_PER_IP || all >= FAILS_TOTAL) return send(429, { error: 'too many wrong PINs, try later' });
    if (!pinMatches(req.headers.get('X-Family-Pin') || '', env.FAMILY_PIN || '')) {
      await env.DB.batch([
        env.DB.prepare('INSERT INTO fails (ip, t) VALUES (?, ?)').bind(ip, now),
        env.DB.prepare('DELETE FROM fails WHERE t < ?').bind(now - 24 * HOUR),
      ]);
      return send(401, { error: 'wrong PIN' });
    }

    let body;
    try {
      if (+(req.headers.get('Content-Length') || 0) > MAX_BODY) throw new Error('too big');
      body = JSON.parse(await req.text());
    } catch (e) { return send(400, { error: 'bad request' }); }
    return route(body, env, send, cors);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(fill(env));
  },
};

// GET /health, no PIN (so checking it never counts as a wrong PIN): the routes this copy has and
// the database's tables, for tools/deploy_worker.mjs to check a deploy. Nothing about the family.
async function health(env, send) {
  const { results } = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
  return send(200, { ok: true, routes: Object.keys(ROUTES), tables: results.map((r) => r.name).filter((n) => !n.startsWith('_') && !n.startsWith('sqlite')) });
}

async function sync(body, env, send) {
  const since = Number.isSafeInteger(body.since) && body.since >= 0 ? body.since : 0;
  const changes = Array.isArray(body.changes) ? body.changes : [];
  if (changes.length > MAX_CHANGES) return send(400, { error: 'too many changes' });
  for (const c of changes) {
    const ok = c && KINDS.includes(c.kind) && ID.test(c.id) && Number.isSafeInteger(c.updated)
      && (c.deleted ? c.data == null : typeof c.data === 'string' && c.data.length <= MAX_DATA);
    if (!ok) return send(400, { error: 'bad change' });
  }

  // Keep each change that's newer than what's here. One batch, so it's all or nothing.
  const results = changes.length ? await env.DB.batch(changes.map((c) => env.DB.prepare(`
    INSERT INTO records (kind, id, data, updated, deleted, seq)
    VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM records))
    ON CONFLICT (kind, id) DO UPDATE SET
      data = excluded.data, updated = excluded.updated, deleted = excluded.deleted, seq = excluded.seq
    WHERE excluded.updated > records.updated`,
  ).bind(c.kind, c.id, c.deleted ? null : c.data, c.updated, c.deleted ? 1 : 0))) : [];
  const lost = changes.filter((c, i) => !results[i].meta.changes);

  const { results: rows } = await env.DB.prepare(
    'SELECT kind, id, data, updated, deleted, seq FROM records WHERE seq > ? ORDER BY seq LIMIT ?',
  ).bind(since, PAGE + 1).all();
  const more = rows.length > PAGE;
  const page = rows.slice(0, PAGE);
  const cursor = page.length ? page[page.length - 1].seq : since;
  // The winners for changes that lost, if this page doesn't already carry them.
  const winners = [];
  for (const c of lost) {
    if (page.some((r) => r.kind === c.kind && r.id === c.id)) continue;
    const r = await env.DB.prepare('SELECT kind, id, data, updated, deleted FROM records WHERE kind = ? AND id = ?')
      .bind(c.kind, c.id).first();
    if (r) winners.push(r);
  }
  const out = (r) => ({ kind: r.kind, id: r.id, data: r.data, updated: r.updated, deleted: !!r.deleted });
  return send(200, { cursor, more, records: [...page, ...winners].map(out) });
}

async function drawings(body, env, send) {
  const bad = () => send(400, { error: 'bad request' });
  const { op, id, player } = body;
  if (op === 'list') {
    if (!ID.test(player || '')) return bad();
    const { results } = await env.DB.prepare('SELECT id, updated, deleted FROM drawings WHERE player = ?').bind(player).all();
    return send(200, { drawings: results.map((r) => ({ id: r.id, updated: r.updated, deleted: !!r.deleted })) });
  }
  if (!ID.test(id || '')) return bad();
  if (op === 'get') {
    const r = await env.DB.prepare('SELECT id, player, image, updated, deleted FROM drawings WHERE id = ?').bind(id).first();
    if (!r) return send(404, { error: 'not found' });
    return send(200, { ...r, deleted: !!r.deleted });
  }
  if (op !== 'put') return bad();
  const { image, updated, deleted } = body;
  const ok = ID.test(player || '') && Number.isSafeInteger(updated)
    && (deleted ? image == null : typeof image === 'string' && image.length <= MAX_DATA && IMAGE.test(image));
  if (!ok) return bad();
  const res = await env.DB.prepare(`
    INSERT INTO drawings (id, player, image, updated, deleted) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      player = excluded.player, image = excluded.image, updated = excluded.updated, deleted = excluded.deleted
    WHERE excluded.updated > drawings.updated`,
  ).bind(id, player, deleted ? null : image, updated, deleted ? 1 : 0).run();
  if (res.meta.changes) return send(200, { kept: true, updated });
  const r = await env.DB.prepare('SELECT updated FROM drawings WHERE id = ?').bind(id).first();
  return send(200, { kept: false, updated: r.updated });
}

async function speak(body, env, send, cors) {
  const text = typeof body.text === 'string' ? tidy(body.text) : '';
  const voice = body.voice;
  if (!text || text.length > MAX_TEXT || !VOICES.includes(voice)) return send(400, { error: 'bad request' });
  const audio = (bytes) => new Response(bytes, { headers: {
    'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=31536000, immutable', ...cors,
  } });

  const kept = await env.DB.prepare('SELECT audio FROM clips WHERE voice = ? AND text = ?').bind(voice, text).first();
  if (kept) return audio(new Uint8Array(kept.audio)); // D1 hands a BLOB back as an array of bytes

  const day = today();
  if (await spentOn(env, day) + text.length > DAILY_CHARS) return send(503, { error: 'new voice clips are done for today' });
  const bytes = await makeClip(env, voice, text);
  if (!bytes) return send(502, { error: 'the voice service had a problem' });
  await env.DB.batch([keepClip(env, voice, text, bytes), addSpend(env, day, text.length)]);
  return audio(bytes);
}

const ROUTES = { '/sync': sync, '/speak': speak, '/drawings': drawings }; // all POST, all behind the PIN

const today = () => new Date().toISOString().slice(0, 10);
const spentOn = async (env, day) => (await env.DB.prepare('SELECT chars FROM spend WHERE day = ?').bind(day).first())?.chars || 0;
const keepClip = (env, voice, text, bytes) => env.DB.prepare(
  'INSERT OR REPLACE INTO clips (voice, text, audio, made) VALUES (?, ?, ?, ?)').bind(voice, text, bytes, Date.now());
const addSpend = (env, day, chars) => env.DB.prepare(
  'INSERT INTO spend (day, chars) VALUES (?, ?) ON CONFLICT (day) DO UPDATE SET chars = chars + excluded.chars').bind(day, chars);

async function makeClip(env, voice, text) {
  try {
    const out = await env.AI.run('@cf/deepgram/aura-2-en', { text, speaker: voice, encoding: 'mp3' });
    const bytes = new Uint8Array(await new Response(out).arrayBuffer());
    return bytes.length ? bytes : null;
  } catch (e) {
    console.log('voice service:', e.message); // see it with: npx wrangler@4 tail
    return null;
  }
}

// ---------- the overnight fill ----------

async function fill(env, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const reserve = now.getUTCMinutes() >= 50 ? 0 : FILL_RESERVE;
  let left = DAILY_CHARS - reserve - await spentOn(env, day);
  if (left <= 0) return 0;

  const { results: recs } = await env.DB.prepare('SELECT kind, data FROM records WHERE deleted = 0').all();
  const parse = (r) => { try { return JSON.parse(r.data); } catch (e) { return null; } };
  const profiles = recs.filter((r) => r.kind === 'profile').map(parse).filter(Boolean);
  const lists = recs.filter((r) => r.kind === 'list').map(parse).filter(Boolean);
  let bank = [];
  try {
    const r = await fetch(WORDS_URL);
    if (r.ok) bank = parseBank(await r.text());
  } catch (e) { /* the site is down: the family's own lists still get done */ }
  const order = fillOrder(bank, profiles, lists);
  // The voices the players use, most used first. A player on the family voice (or a device voice)
  // counts for FAMILY_VOICE, the app's default; nobody yet means FAMILY_VOICE too.
  const uses = new Map();
  for (const p of profiles) {
    const v = String(p.voiceURI || '').replace(/^natural:/, '');
    const k = VOICES.includes(v) ? v : FAMILY_VOICE;
    uses.set(k, (uses.get(k) || 0) + 1);
  }
  if (!uses.size) uses.set(FAMILY_VOICE, 1);
  const voices = [...uses].sort((a, b) => b[1] - a[1]).map(([v]) => v);

  const made = [];
  for (const voice of voices) {
    const { results } = await env.DB.prepare('SELECT text FROM clips WHERE voice = ?').bind(voice).all();
    const have = new Set(results.map((r) => r.text));
    for (const text of order) {
      if (made.length >= FILL_PER_RUN) break;
      if (have.has(text) || text.length > left) continue;
      const bytes = await makeClip(env, voice, text);
      if (!bytes) break; // the service said no (perhaps the allowance is gone): try again next run
      made.push(keepClip(env, voice, text, bytes));
      left -= text.length;
      await env.DB.batch([made[made.length - 1], addSpend(env, day, text.length)]);
    }
  }
  return made.length;
}

// Same length and same characters, compared without stopping early.
function pinMatches(given, pin) {
  if (!pin || given.length !== pin.length) return false;
  let diff = 0;
  for (let i = 0; i < pin.length; i++) diff |= given.charCodeAt(i) ^ pin.charCodeAt(i);
  return diff === 0;
}

