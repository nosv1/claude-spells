// Drawings are kept in IndexedDB (draw.js), which headless Edge won't run under the smoke test's
// --virtual-time-budget. This opens the app in headless Edge in real time instead, through the
// DevTools protocol: keep a drawing, reload, and check it's still there. Windows, from the repo root:
//   node test/drawings-idb.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9338;
const profile = mkdtempSync(join(tmpdir(), 'spellit-idb-'));
const page = pathToFileURL(resolve('index.html')).href;
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', `--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`, page]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++; };

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch (e) { /* not up yet */ }
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const waiting = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise((r) => { waiting.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  const run = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
  const loaded = async () => { for (let i = 0; i < 50; i++) { if (await run("typeof drawingsOf === 'function' && document.readyState === 'complete'")) return; await sleep(100); } };

  await loaded();
  const img = 'data:image/png;base64,iVBORw0KGgo=';
  const keptInDb = await run(`putDrawing({ id: 'idb-1', player: 'kid', image: '${img}', updated: 5, deleted: false, dirty: true })
    .then(() => drawMem.size === 0 && !!drawIdb)`);
  check('a drawing goes into IndexedDB (not left in memory)', keptInDb === true);
  await send('Page.reload');
  await sleep(300);
  await loaded();
  const after = await run(`drawingsOf('kid').then((d) => JSON.stringify(d))`);
  check('still there after a reload', after === JSON.stringify([{ id: 'idb-1', player: 'kid', image: img, updated: 5, deleted: false, dirty: true }]));
  check('another player has none', (await run(`drawingsOf('other').then((d) => d.length)`)) === 0);
  ws.close();
} catch (e) {
  check(`exception: ${e.message}`, false);
} finally {
  edge.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch (e) { /* Edge still letting go of it */ }
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
