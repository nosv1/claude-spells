// The sync API, against a local copy (it uses and wipes the local database, never the real one):
//   cd worker && npx wrangler@4 d1 execute spellit --local --file schema.sql   (once)
//   cd worker && npx wrangler@4 dev --port 8792 --test-scheduled                (FAMILY_PIN in worker/.dev.vars)
//   node --test test/worker.test.mjs
// The /speak tests make one tiny real clip (Workers AI runs on the real service even in wrangler dev).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const API = process.env.API || 'http://127.0.0.1:8792';
const PIN = /FAMILY_PIN=(\S+)/.exec(readFileSync(new URL('../worker/.dev.vars', import.meta.url), 'utf8'))[1];
const sql = (q) => execSync(`npx wrangler@4 d1 execute spellit --local --command "${q}"`,
  { cwd: new URL('../worker/', import.meta.url), stdio: 'ignore' });
sql('DELETE FROM records; DELETE FROM fails; DELETE FROM clips; DELETE FROM spend; DELETE FROM drawings;');

const sync = (body, pin = PIN, ip = '1.1.1.1') => fetch(`${API}/sync`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Family-Pin': pin, Origin: 'https://nosv1.github.io', 'CF-Connecting-IP': ip },
  body: JSON.stringify(body),
});
const rec = (id, name, updated, extra = {}) => ({ kind: 'profile', id, data: JSON.stringify({ id, name }), updated, ...extra });

test('wrong PIN is refused', async () => {
  const r = await sync({ since: 0, changes: [] }, '0000');
  assert.equal(r.status, 401);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://nosv1.github.io');
});

test('a change is kept and comes back to other devices', async () => {
  const a = await (await sync({ since: 0, changes: [rec('p1', 'Hailee', 1000)] })).json();
  assert.equal(a.records.length, 1);
  const b = await (await sync({ since: 0, changes: [] })).json();
  assert.equal(JSON.parse(b.records[0].data).name, 'Hailee');
  const c = await (await sync({ since: b.cursor, changes: [] })).json();
  assert.equal(c.records.length, 0, 'nothing new after the cursor');
});

test('newest wins; a losing device gets the winner back', async () => {
  await sync({ since: 0, changes: [rec('p2', 'new', 2000)] });
  const r = await (await sync({ since: 999999, changes: [rec('p2', 'old', 1500)] })).json();
  const got = r.records.find((x) => x.id === 'p2');
  assert.equal(JSON.parse(got.data).name, 'new');
  const newer = await (await sync({ since: 0, changes: [rec('p2', 'newer', 2500)] })).json();
  assert.equal(JSON.parse(newer.records.find((x) => x.id === 'p2').data).name, 'newer');
});

test('deleting', async () => {
  const r = await (await sync({ since: 0, changes: [{ kind: 'profile', id: 'p1', data: null, updated: 3000, deleted: true }] })).json();
  assert.equal(r.records.find((x) => x.id === 'p1').deleted, true);
});

test('bad changes are refused', async () => {
  assert.equal((await sync({ since: 0, changes: [{ kind: 'nope', id: 'x', data: '{}', updated: 1 }] })).status, 400);
  assert.equal((await sync({ since: 0, changes: [{ kind: 'list', id: 'a b', data: '{}', updated: 1 }] })).status, 400);
});

test('too many wrong PINs locks that address out, even with the right one', async () => {
  for (let i = 0; i < 10; i++) await sync({ since: 0, changes: [] }, '9999', '6.6.6.6');
  assert.equal((await sync({ since: 0, changes: [] }, PIN, '6.6.6.6')).status, 429);
  assert.equal((await sync({ since: 0, changes: [] }, PIN, '1.1.1.1')).status, 200, 'other addresses still work');
  sql('DELETE FROM fails;');
});

const drawings = (body, pin = PIN) => fetch(`${API}/drawings`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Family-Pin': pin, Origin: 'https://nosv1.github.io', 'CF-Connecting-IP': '3.3.3.3' },
  body: JSON.stringify(body),
});
const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const JPG = 'data:image/jpeg;base64,/9j/4AAQ';

test('drawings: needs the PIN', async () => {
  assert.equal((await drawings({ op: 'list', player: 'p1' }, '0000')).status, 401);
});

test('drawings: kept per player, fetched one at a time, and not in /sync', async () => {
  const put = await (await drawings({ op: 'put', id: 'd1', player: 'p1', image: PNG, updated: 1000 })).json();
  assert.deepEqual(put, { kept: true, updated: 1000 });
  await drawings({ op: 'put', id: 'd2', player: 'p1', image: JPG, updated: 1100 });
  await drawings({ op: 'put', id: 'd3', player: 'p2', image: PNG, updated: 1200 });
  const list = await (await drawings({ op: 'list', player: 'p1' })).json();
  assert.deepEqual(list.drawings.map((d) => d.id).sort(), ['d1', 'd2']);
  assert.equal(list.drawings[0].image, undefined, 'the list carries no images');
  const got = await (await drawings({ op: 'get', id: 'd2' })).json();
  assert.deepEqual(got, { id: 'd2', player: 'p1', image: JPG, updated: 1100, deleted: false });
  assert.equal((await drawings({ op: 'get', id: 'nope' })).status, 404);
  const s = await (await sync({ since: 0, changes: [] })).json();
  assert.ok(!s.records.some((r) => r.kind === 'drawing'), 'sync never carries drawings');
});

test('drawings: newest wins; a losing put hears the newer time', async () => {
  const old = await (await drawings({ op: 'put', id: 'd1', player: 'p1', image: JPG, updated: 900 })).json();
  assert.deepEqual(old, { kept: false, updated: 1000 });
  assert.equal((await (await drawings({ op: 'get', id: 'd1' })).json()).image, PNG);
  await drawings({ op: 'put', id: 'd1', player: 'p1', image: null, updated: 2000, deleted: true });
  const gone = await (await drawings({ op: 'get', id: 'd1' })).json();
  assert.equal(gone.deleted, true);
  assert.equal(gone.image, null);
  const list = await (await drawings({ op: 'list', player: 'p1' })).json();
  assert.equal(list.drawings.find((d) => d.id === 'd1').deleted, true, 'other devices learn it was deleted');
});

test('drawings: bad requests are refused', async () => {
  const bad = [
    { op: 'nope', id: 'd1' },
    { op: 'list', player: 'a b' },
    { op: 'put', id: 'd9', player: 'p1', image: 'data:text/html;base64,PGI+', updated: 1 },
    { op: 'put', id: 'd9', player: 'p1', image: 'https://example.com/x.png', updated: 1 },
    { op: 'put', id: 'd9', player: 'p1', image: PNG, updated: 1.5 },
    { op: 'put', id: 'd9', player: 'p1', image: `data:image/png;base64,${'A'.repeat(1024 * 1024)}`, updated: 1 },
  ];
  for (const b of bad) assert.equal((await drawings(b)).status, 400, JSON.stringify(b).slice(0, 80));
});

const speak = (body, pin = PIN) => fetch(`${API}/speak`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Family-Pin': pin, Origin: 'https://nosv1.github.io', 'CF-Connecting-IP': '2.2.2.2' },
  body: JSON.stringify(body),
});

test('speak: needs the PIN, a known voice and some text', async () => {
  assert.equal((await speak({ text: 'Hi.', voice: 'thalia' }, '0000')).status, 401);
  assert.equal((await speak({ text: 'Hi.', voice: 'nobody' })).status, 400);
  assert.equal((await speak({ text: '  ', voice: 'thalia' })).status, 400);
  assert.equal((await speak({ text: 'x'.repeat(601), voice: 'thalia' })).status, 400);
});

test('speak: makes a clip once, then keeps it', async () => {
  const a = await speak({ text: 'Hi.', voice: 'thalia' });
  assert.equal(a.status, 200);
  assert.equal(a.headers.get('Content-Type'), 'audio/mpeg');
  assert.equal(a.headers.get('Access-Control-Allow-Origin'), 'https://nosv1.github.io');
  const first = Buffer.from(await a.arrayBuffer());
  assert.ok(first.length > 500, 'some audio');
  const b = Buffer.from(await (await speak({ text: ' Hi. ', voice: 'thalia' })).arrayBuffer());
  assert.ok(first.equals(b), 'the same clip back (spaces trimmed)');
});

test("speak: stops making new clips at the day's free allowance, kept ones still play", async () => {
  const day = new Date().toISOString().slice(0, 10);
  sql(`INSERT OR REPLACE INTO spend (day, chars) VALUES ('${day}', 2999)`);
  assert.equal((await speak({ text: 'Never made.', voice: 'thalia' })).status, 503);
  assert.equal((await speak({ text: 'Hi.', voice: 'thalia' })).status, 200);
  sql('DELETE FROM spend;');
});

test('overnight fill: makes the next clips with what the day left, letters first', async () => {
  // 4 characters left: "A." and "B." (2 each). In the fill's last 10 minutes it keeps nothing back,
  // so then it goes on, still inside the day's allowance.
  const day = new Date().toISOString().slice(0, 10);
  const lastTen = new Date().getUTCMinutes() >= 50;
  sql(`DELETE FROM clips; INSERT OR REPLACE INTO spend (day, chars) VALUES ('${day}', ${3000 - 600 - 4})`);
  assert.equal((await fetch(`${API}/cdn-cgi/handler/scheduled?cron=*/2+23+*+*+*`)).status, 200);
  const rows = (q) => JSON.parse(execSync(`npx wrangler@4 d1 execute spellit --local --json --command "${q}"`,
    { cwd: new URL('../worker/', import.meta.url) }).toString())[0].results;
  let made = [];
  for (let i = 0; i < 20 && made.length < 2; i++) { // the run finishes after its answer
    await new Promise((r) => setTimeout(r, 500));
    made = rows("SELECT text FROM clips WHERE voice = 'thalia' ORDER BY made").map((r) => r.text);
  }
  if (!lastTen) assert.deepEqual(made, ['A.', 'B.']);
  else assert.deepEqual(made.slice(0, 2), ['A.', 'B.']);
  const spent = rows(`SELECT chars FROM spend WHERE day = '${day}'`)[0].chars;
  assert.ok(spent <= 3000, `inside the day's allowance (${spent})`);
  sql('DELETE FROM spend;');
});
