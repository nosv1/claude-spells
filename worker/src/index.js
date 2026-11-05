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
// Header "X-Family-Pin". Wrong PINs are limited per address and in total, so 4 digits can't be
// guessed by trying them all.

const SITE_ORIGINS = ['https://nosv1.github.io', 'null']; // 'null': index.html opened from disk
const LOCAL_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;
const KINDS = ['profile', 'list'];
const ID = /^[\w-]{1,64}$/;
const MAX_BODY = 4 * 1024 * 1024, MAX_DATA = 1024 * 1024, MAX_CHANGES = 200, PAGE = 200;
const HOUR = 3600e3;
const FAILS_PER_IP = 10, FAILS_TOTAL = 100; // wrong PINs allowed per hour

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
    if (url.pathname !== '/sync' || req.method !== 'POST') return send(404, { error: 'not found' });

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
  },
};

// Same length and same characters, compared without stopping early.
function pinMatches(given, pin) {
  if (!pin || given.length !== pin.length) return false;
  let diff = 0;
  for (let i = 0; i < pin.length; i++) diff |= given.charCodeAt(i) ^ pin.charCodeAt(i);
  return diff === 0;
}
