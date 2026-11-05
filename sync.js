'use strict';
// Family sync: players and Parent-mode word lists kept the same on every device, through the
// Cloudflare Worker in worker/. No accounts: a device joins with the family PIN (Parent mode ›
// Settings), which it keeps. Device settings (voice, speed, the Parent-mode PIN) stay per device.
//
// Each player or list is one record. A device notes the time it sees a record change, and the
// newest change wins. A device sends what changed since the service last agreed with it, and
// takes what changed elsewhere since its cursor. Records are updated in place, so a quiz holding
// a player keeps the same object.

const SYNC_API = 'https://spellit-sync.nosv1.workers.dev';
const SYNC_KEY = 'spells.sync'; // apart from the app's data, so a backup file never carries the PIN
const SYNC_EVERY = 60e3; // while the app is open
const SYNC_BATCH = 100;

// pin; cursor: the service's last change seen; known: each record's hash as the service has it;
// seen: as this device last saw it ('gone' once deleted); stamps: when this device saw it change.
const freshSync = () => ({ pin: '', cursor: 0, known: {}, seen: {}, stamps: {}, last: 0, error: '' });
let syncState = loadSyncState();

function loadSyncState() {
  try { return { ...freshSync(), ...JSON.parse(localStorage.getItem(SYNC_KEY) || '{}') }; } catch (e) { return freshSync(); }
}
function saveSyncState() {
  try { localStorage.setItem(SYNC_KEY, JSON.stringify(syncState)); } catch (e) { /* private mode */ }
}

// A short fingerprint of a record's JSON (FNV-1a), to tell whether it changed.
function hashText(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `${(h >>> 0).toString(36)}.${s.length}`;
}
const GONE = 'gone';
const recordHash = (r) => (r.deleted ? GONE : hashText(r.data));

function localRecords() {
  const m = new Map();
  db.profiles.forEach((p) => m.set(`profile:${p.id}`, p));
  db.lists.forEach((l) => m.set(`list:${l.id}`, l));
  return m;
}

// Called by saveDb: note anything that changed on this device, and when. True if any is unsent.
function noteChanges() {
  if (!syncState.pin) return false;
  const now = Date.now();
  const recs = localRecords();
  for (const [key, r] of recs) {
    const h = hashText(JSON.stringify(r));
    if (syncState.seen[key] !== h) { syncState.seen[key] = h; syncState.stamps[key] = now; }
  }
  for (const key of Object.keys(syncState.seen)) {
    if (!recs.has(key) && syncState.seen[key] !== GONE) { syncState.seen[key] = GONE; syncState.stamps[key] = now; }
  }
  saveSyncState();
  return Object.keys(syncState.seen).some((k) => syncState.seen[k] !== syncState.known[k]);
}

async function callSync(body, pin = syncState.pin) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20e3);
  try {
    const r = await fetch(`${SYNC_API}/sync`, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', 'X-Family-Pin': pin },
      body: JSON.stringify(body),
    });
    if (r.status === 401) throw new Error('That family PIN is not right.');
    if (r.status === 429) throw new Error('Too many wrong PINs. Try again in an hour.');
    if (!r.ok) throw new Error('The sync service had a problem. It will try again.');
    return await r.json();
  } catch (e) {
    if (e.name === 'AbortError' || e instanceof TypeError) throw new Error('Offline. It will sync when there is internet.');
    throw e;
  } finally { clearTimeout(timer); }
}

// Put a record from the service into this device's data, in place.
function putLocal(kind, obj) {
  const list = kind === 'profile' ? db.profiles : db.lists;
  const cur = list.find((x) => x.id === obj.id);
  if (!cur) { list.push(obj); return; }
  Object.keys(cur).forEach((k) => delete cur[k]);
  Object.assign(cur, obj);
}
function dropLocal(kind, id) {
  if (kind === 'profile') db.profiles = db.profiles.filter((x) => x.id !== id);
  else db.lists = db.lists.filter((x) => x.id !== id);
}

// When a player changed on two devices before they synced: the newer copy, plus any quizzes
// (and their stars) only the other one has, so neither device's quiz is lost.
function mergeProfiles(win, lose) {
  const have = new Set((win.history || []).map((h) => h.t));
  const extra = (lose.history || []).filter((h) => !have.has(h.t));
  if (!extra.length) return win;
  return {
    ...win,
    history: [...win.history, ...extra].sort((a, b) => a.t - b.t),
    stars: (win.stars || 0) + extra.reduce((n, h) => n + (h.stars || 0), 0),
  };
}

// Take the service's records, unless this device changed one later (then it stays, to send).
function applyRemote(records) {
  let changed = false;
  for (const r of records) {
    const key = `${r.kind}:${r.id}`;
    const h = recordHash(r);
    const agreed = syncState.known[key];
    syncState.known[key] = h;
    if (syncState.seen[key] === h) continue; // already have it (often our own change, echoed)
    const mine = localRecords().get(key);
    const mineChanged = syncState.seen[key] !== undefined && syncState.seen[key] !== agreed;
    const mineIsNewer = syncState.seen[key] !== undefined && (syncState.stamps[key] || 0) > r.updated;
    if (r.kind === 'profile' && mine && !r.deleted && mineChanged) {
      const theirs = JSON.parse(r.data);
      const merged = mineIsNewer ? mergeProfiles(JSON.parse(JSON.stringify(mine)), theirs) : mergeProfiles(theirs, mine);
      putLocal('profile', merged);
      const mh = hashText(JSON.stringify(merged));
      if (mh === h) syncState.seen[key] = h;
      else { syncState.seen[key] = mh; syncState.stamps[key] = Math.max(Date.now(), r.updated + 1); } // to send back, as the newest
      changed = true;
      continue;
    }
    if (mineIsNewer) continue;
    if (r.deleted) dropLocal(r.kind, r.id);
    else putLocal(r.kind, JSON.parse(r.data));
    syncState.seen[key] = h;
    changed = true;
  }
  return changed;
}

let syncing = null;
let syncTimer = null;

function syncSoon(ms = 2000) {
  if (!syncState.pin) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNow, ms);
}

function syncNow() {
  if (!syncState.pin) return Promise.resolve();
  if (syncing) return syncing;
  syncing = (async () => {
    let changed = false;
    try {
      noteChanges();
      for (let round = 0; round < 50; round++) {
        const recs = localRecords();
        const dirty = Object.keys(syncState.seen).filter((k) => syncState.seen[k] !== syncState.known[k]);
        const sending = dirty.slice(0, SYNC_BATCH);
        const changes = sending.map((key) => {
          const [kind, id] = key.split(':');
          const r = recs.get(key);
          const updated = syncState.stamps[key] || Date.now();
          return r ? { kind, id, data: JSON.stringify(r), updated } : { kind, id, data: null, updated, deleted: true };
        });
        // What we send and the service keeps comes back as an echo; one that lost, as the winner.
        const res = await callSync({ since: syncState.cursor, changes });
        if (applyRemote(res.records)) changed = true;
        syncState.cursor = res.cursor;
        if (!res.more && dirty.length <= SYNC_BATCH) break;
      }
      syncState.last = Date.now();
      syncState.error = '';
    } catch (e) {
      syncState.error = e.message;
    }
    saveSyncState();
    if (changed) { saveDb(); afterRemoteChange(); }
    syncing = null;
    if (!$('#screen-parent').hidden && activeTab === 'settings') renderSync();
    // Changed again while that was out: send it soon.
    if (!syncState.error && Object.keys(syncState.seen).some((k) => syncState.seen[k] !== syncState.known[k])) syncSoon();
  })();
  return syncing;
}

// Show the new data, unless a quiz is on (it carries on; the results show the rest).
function afterRemoteChange() {
  if (!$('#screen-quiz').hidden || !$('#screen-results').hidden) return;
  if (currentId && !current()) currentId = null;
  if (!$('#screen-home').hidden) renderHome();
  else if (!$('#screen-setup').hidden) (current() ? renderSetup() : show('home'));
  else if (!$('#screen-shop').hidden) (current() ? renderShop() : show('home'));
  else if (!$('#screen-parent').hidden) renderParent();
}

// Join the family from this device. Everything the family has comes in; a player here with the
// same name as a family player is the same kid, and whichever copy has more quizzes is kept.
async function syncConnect(pin) {
  let res = await callSync({ since: 0, changes: [] }, pin);
  const records = [...res.records];
  while (res.more) {
    res = await callSync({ since: res.cursor, changes: [] }, pin);
    records.push(...res.records);
  }
  syncState = { ...freshSync(), pin, cursor: res.cursor };
  const family = records.filter((r) => r.kind === 'profile' && !r.deleted).map((r) => JSON.parse(r.data));
  const familyIds = new Set(family.map((p) => p.id));
  const sameKid = (a, b) => a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
  const twins = db.profiles.filter((p) => !familyIds.has(p.id)).map((p) => [p, family.find((f) => sameKid(f, p))]).filter(([, f]) => f);
  applyRemote(records);
  for (const [mine, theirs] of twins) {
    const kept = db.profiles.find((x) => x.id === theirs.id);
    if (mine.history.length > kept.history.length) putLocal('profile', { ...mine, id: theirs.id });
    db.profiles = db.profiles.filter((x) => x !== mine);
    if (currentId === mine.id) currentId = theirs.id;
  }
  saveSyncState();
  saveDb(); // notes this device's own players and lists as new, to send
  await syncNow();
  afterRemoteChange();
}

function syncDisconnect() {
  syncState = freshSync();
  saveSyncState();
}

// ---------- Parent mode › Settings ----------

function renderSync() {
  const on = !!syncState.pin;
  $('#syncOff').hidden = on;
  $('#syncOn').hidden = !on;
  if (!on) return;
  const ago = syncState.last ? timeAgo(syncState.last) : 'not yet';
  $('#syncStatus').textContent = syncState.error || `On. Last synced ${ago}.`;
  $('#syncStatus').classList.toggle('warn-text', !!syncState.error);
}

function timeAgo(t) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} hour${h === 1 ? '' : 's'} ago` : `on ${shortDate(t)}`;
}

$('#syncConnectBtn').addEventListener('click', async () => {
  const pin = $('#syncPin').value.trim();
  if (!pin) return;
  $('#syncConnectBtn').disabled = true;
  $('#syncMsg').textContent = 'Connecting…';
  try {
    await syncConnect(pin);
    $('#syncPin').value = '';
    $('#syncMsg').textContent = `Connected. ${db.profiles.length} player${db.profiles.length === 1 ? '' : 's'} on this device now.`;
  } catch (e) {
    $('#syncMsg').textContent = e.message;
  }
  $('#syncConnectBtn').disabled = false;
  renderSync();
});

$('#syncNowBtn').addEventListener('click', async () => {
  $('#syncMsg').textContent = 'Syncing…';
  await syncNow();
  $('#syncMsg').textContent = syncState.error ? '' : 'Synced.';
});

$('#syncOffBtn').addEventListener('click', () => {
  syncDisconnect();
  $('#syncMsg').textContent = 'Sync is off on this device. Its players stay here.';
  renderSync();
});

// ---------- when to sync ----------

document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
window.addEventListener('online', () => syncNow());
setInterval(() => { if (!document.hidden) syncNow(); }, SYNC_EVERY);
syncNow();
