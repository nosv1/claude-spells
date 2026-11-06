// Deploy the family sync Worker (worker/) with guard rails, so a deploy can't quietly break sync,
// voices or drawings on the family's iPads. From the repo root, on Windows:
//   node tools/deploy_worker.mjs            check, test, deploy, verify (rolls back if it fails)
//   node tools/deploy_worker.mjs --check    everything up to the deploy, but don't deploy
//
// Before deploying, it stops unless:
//   1. worker/ and its tests have no uncommitted changes, and main is pushed (what goes live is
//      exactly what's on GitHub);
//   2. worker/schema.sql only adds things (CREATE TABLE / CREATE INDEX IF NOT EXISTS): nothing
//      that could drop, change or delete the family's data;
//   3. the Worker tests pass against a local copy (wrangler dev, local database);
//   4. wrangler can build it (deploy --dry-run).
// Then it notes the live version, applies the schema, deploys, and checks the live Worker:
// GET /health (needs no PIN, so it never counts as a wrong PIN) must list every route and table,
// and the site's CORS preflight must still be allowed. If either fails, it rolls back to the
// version that was live before. The schema is additive only, so it never needs undoing.
// D1's Time Travel can still restore the database to any minute in the last 7 days if it must.
import { execSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const LIVE = 'https://spellit-sync.nosv1.workers.dev';
const SITE = 'https://nosv1.github.io';
const LOCAL_PORT = 8792;
const ROUTES = ['/sync', '/speak', '/drawings'];
const TABLES = ['records', 'fails', 'clips', 'spend', 'drawings'];
const checkOnly = process.argv.includes('--check');

const sh = (cmd, opts = {}) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
const wrangler = (args, opts = {}) => sh(`npx wrangler@4 ${args}`, { cwd: 'worker', ...opts });
const step = (s) => console.log(`\n== ${s}`);
const stop = (why) => { console.error(`\nSTOPPED: ${why}\nNothing was deployed.`); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 1. what goes live is what's committed and pushed ----------
step('1. Committed and pushed');
const dirty = sh('git status --porcelain -- worker test/worker.test.mjs test/fill.test.mjs tools/deploy_worker.mjs').trim();
if (dirty) stop(`uncommitted changes:\n${dirty}`);
sh('git fetch -q origin main');
const ahead = sh('git rev-list --count origin/main..HEAD').trim();
if (ahead !== '0') stop(`main is ${ahead} commit(s) ahead of GitHub: push first.`);
const commit = sh('git rev-parse --short HEAD').trim();
console.log(`ok: deploying ${commit}`);

// ---------- 2. the schema only adds ----------
step('2. Schema only adds');
const statements = readFileSync('worker/schema.sql', 'utf8')
  .replace(/--[^\n]*/g, '').split(';').map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
const additive = /^CREATE (TABLE|INDEX|UNIQUE INDEX) IF NOT EXISTS /i;
const bad = statements.filter((s) => !additive.test(s));
if (bad.length) stop(`worker/schema.sql has statements that aren't CREATE ... IF NOT EXISTS:\n  ${bad.join('\n  ')}\nChange live data by hand, carefully, not through a deploy.`);
console.log(`ok: ${statements.length} statements, all CREATE ... IF NOT EXISTS`);

// ---------- 3. the tests pass locally ----------
step('3. Worker tests against a local copy');
wrangler('d1 execute spellit --local --file schema.sql');
const workerdPids = () => sh('tasklist /FI "IMAGENAME eq workerd.exe" /FO CSV /NH')
  .split('\n').map((l) => l.split('","')[1]).filter((p) => /^\d+$/.test(p || ''));
const workerdBefore = new Set(workerdPids()); // someone else's (Ride Finder's dev, say): left alone
const dev = spawn('npx', ['wrangler@4', 'dev', '--port', String(LOCAL_PORT), '--test-scheduled'], { cwd: 'worker', shell: true });
let devLog = '';
dev.stdout.on('data', (d) => { devLog += d; });
dev.stderr.on('data', (d) => { devLog += d; });
// On Windows, killing npx leaves wrangler and workerd running: take down the whole tree, then
// any workerd this run started that slipped out of it.
const stopDev = () => {
  try { sh(`taskkill /PID ${dev.pid} /T /F`); } catch (e) { /* already gone */ }
  for (const pid of workerdPids()) {
    if (!workerdBefore.has(pid)) try { sh(`taskkill /PID ${pid} /F`); } catch (e) { /* gone */ }
  }
};
let tested = false;
try {
  for (let i = 0; i < 60 && !/Ready on/.test(devLog); i++) await sleep(500);
  if (!/Ready on/.test(devLog)) throw new Error(`wrangler dev didn't start:\n${devLog.slice(-800)}`);
  try {
    const out = sh('node --test test/worker.test.mjs test/fill.test.mjs', { env: { ...process.env, API: `http://127.0.0.1:${LOCAL_PORT}` } });
    console.log(out.split('\n').filter((l) => /^ℹ (pass|fail)/.test(l)).join('\n'));
    tested = true;
  } catch (e) {
    console.error(String(e.stdout || '').split('\n').filter((l) => /^(✖|ℹ fail)|Error|expected|actual/.test(l)).slice(0, 30).join('\n'));
  }
} finally { stopDev(); }
if (!tested) stop('the Worker tests failed.');

// ---------- 4. it builds ----------
step('4. Build (dry run)');
try { wrangler('deploy --dry-run'); } catch (e) { stop(`wrangler can't build it:\n${e.stderr || e.message}`); }
console.log('ok');

if (checkOnly) { console.log('\nAll checks passed (--check: not deploying).'); process.exit(0); }

// ---------- deploy ----------
step('5. Note the live version (to roll back to)');
let before = null;
try {
  const list = JSON.parse(wrangler('deployments list --json'));
  const latest = [...list].sort((a, b) => new Date(b.created_on) - new Date(a.created_on))[0];
  before = latest?.versions?.[0]?.version_id || null;
} catch (e) { /* first deploy, or the format changed: roll back to "the previous one" instead */ }
console.log(before ? `live now: ${before}` : 'could not read it: a rollback would go to the previous version');

step('6. Apply the schema to the live database (additive only)');
wrangler('d1 execute spellit --remote --file schema.sql');
console.log('ok');

step('7. Deploy');
console.log(wrangler(`deploy --message "deploy_worker.mjs ${commit}"`).split('\n').filter((l) => /Uploaded|Deployed|Current Version|workers\.dev/.test(l)).join('\n'));

// ---------- verify, or roll back ----------
step('8. Check the live Worker');
async function verify() {
  const problems = [];
  try {
    const h = await (await fetch(`${LIVE}/health`, { cache: 'no-store' })).json();
    for (const r of ROUTES) if (!h.routes?.includes(r)) problems.push(`route ${r} missing`);
    for (const t of TABLES) if (!h.tables?.includes(t)) problems.push(`table ${t} missing`);
  } catch (e) { problems.push(`/health: ${e.message}`); }
  try {
    const r = await fetch(`${LIVE}/sync`, { method: 'OPTIONS', headers: { Origin: SITE, 'Access-Control-Request-Method': 'POST' } });
    if (r.status !== 204 || r.headers.get('Access-Control-Allow-Origin') !== SITE) problems.push(`the site's CORS preflight got ${r.status}`);
  } catch (e) { problems.push(`CORS preflight: ${e.message}`); }
  return problems;
}
let problems = [];
for (let i = 0; i < 6; i++) { // a new version can take a few seconds to reach every edge
  problems = await verify();
  if (!problems.length) break;
  await sleep(5000);
}
if (!problems.length) {
  console.log(`ok: live, with ${ROUTES.join(' ')} and every table.\n\nDeployed ${commit}.`);
  process.exit(0);
}
console.error(`live checks failed:\n  ${problems.join('\n  ')}`);
step('Rolling back');
try {
  console.log(wrangler(`rollback ${before || ''} --message "deploy_worker.mjs: live checks failed for ${commit}" -y`));
  const after = await verify();
  console.error(after.length ? `Still failing after the rollback:\n  ${after.join('\n  ')}\nLook now: npx wrangler@4 tail` : 'Rolled back; the previous version is live and checks out.');
} catch (e) {
  console.error(`The rollback failed too: ${e.stderr || e.message}\nRoll back by hand now: cd worker && npx wrangler@4 rollback`);
}
process.exit(1);
