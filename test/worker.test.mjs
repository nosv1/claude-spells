// The sync API, against a local copy (it uses and wipes the local database, never the real one):
//   cd worker && npx wrangler@4 d1 execute spellit --local --file schema.sql   (once)
//   cd worker && npx wrangler@4 dev --port 8792                                 (FAMILY_PIN in worker/.dev.vars)
//   node --test test/worker.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const API = process.env.API || 'http://127.0.0.1:8792';
const PIN = /FAMILY_PIN=(\S+)/.exec(readFileSync(new URL('../worker/.dev.vars', import.meta.url), 'utf8'))[1];
const sql = (q) => execSync(`npx wrangler@4 d1 execute spellit --local --command "${q}"`,
  { cwd: new URL('../worker/', import.meta.url), stdio: 'ignore' });
sql('DELETE FROM records; DELETE FROM fails;');

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
