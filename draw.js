'use strict';
// Drawing break (Hailee's idea): a speller who gets most of the first half of a quiz right earns
// 3 minutes of free drawing, then it's back to spelling. A player's drawings are kept, so a
// break can carry on with an old one or start a new one.
//
// Drawings are pictures (PNG data URLs, 1024 px square), too big for localStorage, so this device
// keeps them in IndexedDB. With family sync on they also go to the Worker's /drawings, apart from
// /sync so a sync never carries pictures. Newest wins, per drawing. Drawing earns no stars.

const DRAW_SECONDS = 180;
const DRAW_WARN = 30; // the clock turns red for the last 30 seconds
const DRAW_MIN_WORDS = 4; // shorter quizzes (a tiny word list) have no break
const DRAW_EARN = 0.8; // of the first half right, without "Show me" (hints are fine): 4 of 5
const DRAW_SIZE = 1024; // the picture's pixels, whatever size it shows at
const DRAW_MAX_CHARS = 1000000; // the Worker keeps a picture up to this long
const DRAW_COLORS = [
  ['Black', '#23204a'], ['Red', '#e5484d'], ['Orange', '#f76707'], ['Yellow', '#fcc419'],
  ['Lime', '#94d82d'], ['Green', '#2b8a3e'], ['Sky blue', '#4dabf7'], ['Blue', '#3b5bdb'],
  ['Purple', '#7048e8'], ['Pink', '#f06595'], ['Brown', '#8d5524'], ['Peach', '#ffc9a0'],
];
const DRAW_SIZES = [['Thin', 8], ['Medium', 20], ['Thick', 44]];
const PAPER = '#ffffff';

// ---------- earning it ----------

function drawBreakEarned(q) {
  const n = q.items.length;
  const half = Math.ceil(n / 2);
  if (q.reviewing || q.drawBreak || n < DRAW_MIN_WORDS || q.results.length !== half) return false;
  return q.results.filter((r) => r.correct).length >= Math.ceil(half * DRAW_EARN);
}

// Called as each quiz word finishes: the button shows once it's earned, until the quiz ends.
function checkDrawBreak() {
  if (!drawBreakEarned(quiz)) return;
  quiz.drawBreak = 'earned';
  const b = $('#drawBreakBtn');
  b.hidden = false;
  b.classList.remove('pop');
  void b.offsetWidth;
  b.classList.add('pop');
}

// ---------- kept on this device (IndexedDB) ----------
// { id, player, image, updated, deleted, dirty }. dirty: changed here, not sent yet.
// Without IndexedDB (a private window), they're kept until the page closes. Safari can leave
// opening it hanging: after a second it carries on in memory, and uses it if it opens later.

const drawMem = new Map(); // not in IndexedDB (yet): newer than what is
let drawIdb = null;
let drawIdbWait = null;

function openDrawIdb() {
  if (!drawIdbWait) {
    const opening = new Promise((resolve) => {
      try {
        const r = indexedDB.open('spellit-drawings', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('drawings', { keyPath: 'id' });
        r.onsuccess = () => { drawIdb = r.result; resolve(); };
        r.onerror = r.onblocked = () => resolve();
      } catch (e) { resolve(); }
    });
    drawIdbWait = Promise.race([opening, new Promise((r) => setTimeout(r, 1000))]);
  }
  return drawIdbWait.then(() => drawIdb);
}

// null if it failed or took over 3 seconds: then the break goes on with what's in memory.
async function drawStore(mode, fn) {
  const idb = await openDrawIdb();
  if (!idb) return null;
  return new Promise((resolve) => {
    setTimeout(() => resolve(null), 3000);
    try {
      const t = idb.transaction('drawings', mode);
      const req = fn(t.objectStore('drawings'));
      t.oncomplete = () => resolve(req.result);
      t.onerror = t.onabort = () => resolve(null);
    } catch (e) { resolve(null); }
  });
}

async function drawingsOf(player) {
  const all = new Map(((await drawStore('readonly', (s) => s.getAll())) || []).map((d) => [d.id, d]));
  drawMem.forEach((d, id) => all.set(id, d));
  return [...all.values()].filter((d) => d.player === player);
}
async function getDrawing(id) {
  return drawMem.get(id) || (await drawStore('readonly', (s) => s.get(id))) || null;
}
async function putDrawing(d) {
  drawMem.set(d.id, d);
  const kept = (await drawStore('readwrite', (s) => s.put(d))) != null;
  if (kept && drawMem.get(d.id) === d) drawMem.delete(d.id);
}

// ---------- family sync (the Worker's /drawings) ----------

async function callDrawings(body) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30e3);
  try {
    const r = await fetch(`${SYNC_API}/drawings`, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', 'X-Family-Pin': syncState.pin },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`drawings: ${r.status}`);
    return await r.json();
  } finally { clearTimeout(timer); }
}

// Send this player's drawings changed here, then take the ones changed elsewhere. True if any
// came in. Offline or failing: it tries again next time (start of a quiz, the break, its end).
// One at a time per player; a call while one is going runs after it, so it sends what changed since.
const drawSyncs = {};
function syncDrawings(player) {
  if (!syncState.pin || !player) return Promise.resolve(false);
  const run = (drawSyncs[player] || Promise.resolve()).then(async () => {
    let changed = false;
    try {
      for (const d of (await drawingsOf(player)).filter((x) => x.dirty)) {
        await callDrawings({ op: 'put', id: d.id, player, image: d.deleted ? null : d.image, updated: d.updated, deleted: !!d.deleted });
        const now = await getDrawing(d.id);
        if (now && now.updated === d.updated) await putDrawing({ ...now, dirty: false }); // not changed again meanwhile
      }
      const { drawings } = await callDrawings({ op: 'list', player });
      for (const t of drawings) {
        const have = await getDrawing(t.id);
        if (have && have.updated >= t.updated) continue;
        if (drawing?.id === t.id) continue; // being drawn on now: this device's copy will be newer
        const d = t.deleted ? { ...t, image: null } : await callDrawings({ op: 'get', id: t.id });
        await putDrawing({ id: d.id, player, image: d.image, updated: d.updated, deleted: !!d.deleted, dirty: false });
        changed = true;
      }
    } catch (e) { /* offline, or the service had a problem */ }
    return changed;
  });
  drawSyncs[player] = run;
  return run;
}

// ---------- the break ----------

const drawCanvas = $('#drawCanvas');
const drawCtx = drawCanvas.getContext('2d');
// The drawing being drawn on: its base picture (what was saved before this break), then this
// break's strokes ({ color, size, pts } or { clear: true }), so Undo can redraw without them.
let drawing = null;
let drawPen = { color: DRAW_COLORS[0][1], size: DRAW_SIZES[1][1], erase: false };
let drawEndAt = 0;
let drawTimer = null;
let drawSaveTimer = null;
// The latest work the break started that finishes later (reading drawings, keeping one, syncing):
// a tap waits on nothing, but the smoke test waits on this.
let drawWork = Promise.resolve();

function openDrawBreak() {
  if (!quiz || quiz.drawBreak !== 'earned') return;
  quiz.drawBreak = 'open';
  stopSpeech();
  input.blur();
  $('#drawBreakBtn').hidden = true;
  drawing = null;
  $('#drawClock').textContent = clockText(DRAW_SECONDS);
  $('#drawClock').classList.remove('warn');
  $('#drawMsg').hidden = true;
  show('draw');
  const player = quiz.p.id;
  drawWork = renderDrawPicker(true)
    .then(() => syncDrawings(player)) // after the one from the quiz's start, if that's still going
    .then(() => { if (!drawing && quiz?.drawBreak === 'open') return renderDrawPicker(); });
}

// The gallery: a new drawing, or one to carry on with. With none yet, straight to a new one.
async function renderDrawPicker(first) {
  const mine = (await drawingsOf(quiz.p.id)).filter((d) => !d.deleted).sort((a, b) => b.updated - a.updated);
  if (drawing || quiz?.drawBreak !== 'open') return;
  if (first && !mine.length) return startDrawing(null);
  $('#drawPad').hidden = true;
  $('#drawPicker').hidden = false;
  $('#drawGallery').innerHTML = `<button type="button" class="draw-tile draw-new" data-new><span>+</span>New drawing</button>`
    + mine.map((d) => `<div class="draw-tile-wrap">
        <button type="button" class="draw-tile" data-open="${esc(d.id)}" aria-label="Keep drawing this one"><img src="${d.image}" alt=""></button>
        <button type="button" class="draw-del" data-del="${esc(d.id)}" aria-label="Delete this drawing">✕</button>
      </div>`).join('');
}

$('#drawGallery').addEventListener('click', (e) => {
  if (drawing) return;
  if (e.target.closest('[data-new]')) return startDrawing(null);
  const open = e.target.closest('[data-open]');
  if (open) drawWork = getDrawing(open.dataset.open).then(startDrawing);
  const del = e.target.closest('[data-del]');
  if (del && confirm('Delete this drawing? It\'s gone for good.')) {
    drawWork = (async () => {
      const d = await getDrawing(del.dataset.del);
      await putDrawing({ ...d, image: null, deleted: true, updated: newerThan(d.updated), dirty: true });
      await renderDrawPicker();
      await syncDrawings(d.player);
    })();
  }
});

// Opens the pad, with the saved picture under it when carrying on. Resolves once that's up.
function startDrawing(saved) {
  drawing = { id: saved?.id || `${quiz.p.id}-${uid()}`, player: quiz.p.id, base: null, strokes: [], changed: false, updated: saved?.updated || 0 };
  $('#drawPicker').hidden = true;
  $('#drawPad').hidden = false;
  renderDrawTools();
  redrawDrawing();
  drawEndAt = Date.now() + DRAW_SECONDS * 1000;
  clearInterval(drawTimer);
  drawTimer = setInterval(tickDrawClock, 250);
  tickDrawClock();
  if (!saved?.image) return Promise.resolve();
  // No drawing until the saved picture is up, so a quick save can't keep a blank page over it.
  const d = drawing;
  d.locked = true;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { if (drawing === d) { d.base = img; d.locked = false; redrawDrawing(); } resolve(); };
    img.onerror = () => { if (drawing === d) d.locked = false; resolve(); };
    img.src = saved.image;
  });
}

const clockText = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function tickDrawClock() {
  const left = Math.max(0, Math.ceil((drawEndAt - Date.now()) / 1000));
  const clock = $('#drawClock');
  clock.textContent = clockText(left);
  if (left <= DRAW_WARN && !clock.classList.contains('warn')) {
    clock.classList.add('warn');
    $('#drawMsg').textContent = `${DRAW_WARN} seconds left!`;
    $('#drawMsg').hidden = false;
  }
  if (left > 0) return;
  // Time's up: keep the drawing, say so for a moment, then back to spelling.
  clearInterval(drawTimer);
  drawTimer = null;
  endStroke();
  if (drawing) drawing.locked = true;
  $('#drawMsg').textContent = 'Time\'s up! Your drawing is saved.';
  $('#drawMsg').hidden = false;
  setTimeout(endDrawBreak, 1500);
}

// Back to the quiz, where it left off. The picture is taken now; keeping it can finish after.
function endDrawBreak() {
  if (!quiz || quiz.drawBreak !== 'open') return;
  clearInterval(drawTimer);
  drawTimer = null;
  endStroke();
  const kept = saveDrawing();
  drawing = null;
  quiz.drawBreak = 'used';
  show('quiz');
  const player = quiz.p.id;
  drawWork = kept.then(() => syncDrawings(player));
  if (!quiz.word.done) {
    focusInput(); // straight from the tap where there is one, so iPad brings the keyboard up
    say(currentItem().w);
  }
}

$('#drawBreakBtn').addEventListener('click', openDrawBreak);
$('#drawDoneBtn').addEventListener('click', endDrawBreak);

// ---------- the pad ----------

function renderDrawTools() {
  $('#drawColors').innerHTML = DRAW_COLORS.map(([name, c]) => {
    const on = !drawPen.erase && drawPen.color === c;
    return `<button type="button" class="pen-dot${on ? ' using' : ''}" data-color="${c}" style="background:${c}"
      aria-label="${name}" title="${name}"${on ? ' aria-pressed="true"' : ''}></button>`;
  }).join('');
  $('#drawSizes').innerHTML = DRAW_SIZES.map(([name, px]) => {
    const on = drawPen.size === px;
    return `<button type="button" class="btn btn-ghost draw-size${on ? ' using' : ''}" data-size="${px}" aria-label="${name}"
      title="${name}"${on ? ' aria-pressed="true"' : ''}><i style="width:${6 + px / 3}px;height:${6 + px / 3}px"></i></button>`;
  }).join('');
  $('#drawEraseBtn').classList.toggle('using', drawPen.erase);
  $('#drawEraseBtn').setAttribute('aria-pressed', drawPen.erase);
}

$('#drawColors').addEventListener('click', (e) => {
  const b = e.target.closest('[data-color]');
  if (!b) return;
  drawPen = { ...drawPen, color: b.dataset.color, erase: false };
  renderDrawTools();
});
$('#drawSizes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-size]');
  if (!b) return;
  drawPen = { ...drawPen, size: +b.dataset.size };
  renderDrawTools();
});
$('#drawEraseBtn').addEventListener('click', () => {
  drawPen = { ...drawPen, erase: !drawPen.erase };
  renderDrawTools();
});
$('#drawUndoBtn').addEventListener('click', () => {
  if (!drawing?.strokes.length || drawing.locked) return;
  drawing.strokes.pop();
  drawing.changed = true;
  redrawDrawing();
  saveSoon();
});
$('#drawClearBtn').addEventListener('click', () => {
  if (!drawing || drawing.locked || drawing.strokes.at(-1)?.clear) return;
  drawing.strokes.push({ clear: true }); // Undo brings it back
  drawing.changed = true;
  redrawDrawing();
  saveSoon();
});

function paintStroke(s, from = 0) {
  drawCtx.lineCap = 'round';
  drawCtx.lineJoin = 'round';
  drawCtx.lineWidth = s.size;
  drawCtx.strokeStyle = s.color;
  drawCtx.fillStyle = s.color;
  const p = s.pts;
  if (p.length === 1) { // a dot
    drawCtx.beginPath();
    drawCtx.arc(p[0][0], p[0][1], s.size / 2, 0, Math.PI * 2);
    drawCtx.fill();
    return;
  }
  drawCtx.beginPath();
  drawCtx.moveTo(p[Math.max(0, from - 1)][0], p[Math.max(0, from - 1)][1]);
  for (let i = Math.max(1, from); i < p.length; i++) drawCtx.lineTo(p[i][0], p[i][1]);
  drawCtx.stroke();
}

// Paper, then the saved picture (unless this break cleared it), then this break's strokes.
function redrawDrawing() {
  drawCtx.fillStyle = PAPER;
  drawCtx.fillRect(0, 0, DRAW_SIZE, DRAW_SIZE);
  if (!drawing) return;
  const s = drawing.strokes;
  let from = 0;
  for (let i = s.length - 1; i >= 0; i--) if (s[i].clear) { from = i + 1; break; }
  if (from === 0 && drawing.base) drawCtx.drawImage(drawing.base, 0, 0, DRAW_SIZE, DRAW_SIZE);
  for (let i = from; i < s.length; i++) paintStroke(s[i]);
}

let drawStroke = null;
const drawPt = (e) => {
  const r = drawCanvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * DRAW_SIZE, ((e.clientY - r.top) / r.height) * DRAW_SIZE];
};
drawCanvas.addEventListener('pointerdown', (e) => {
  if (!drawing || drawing.locked || drawStroke) return;
  e.preventDefault();
  try { drawCanvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
  const erase = drawPen.erase;
  drawStroke = { color: erase ? PAPER : drawPen.color, size: erase ? drawPen.size * 1.6 : drawPen.size, pts: [drawPt(e)] };
  drawStroke.pointer = e.pointerId; // a second finger or a palm doesn't join or end it
  drawing.strokes.push(drawStroke);
  drawing.changed = true;
  paintStroke(drawStroke);
});
drawCanvas.addEventListener('pointermove', (e) => {
  if (!drawStroke || e.pointerId !== drawStroke.pointer) return;
  const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  const from = drawStroke.pts.length;
  (events.length ? events : [e]).forEach((ev) => drawStroke.pts.push(drawPt(ev)));
  paintStroke(drawStroke, from);
});
function endStroke() {
  if (!drawStroke) return;
  delete drawStroke.pointer;
  drawStroke = null;
  saveSoon();
}
const endPointer = (e) => { if (drawStroke && e.pointerId === drawStroke.pointer) endStroke(); };
drawCanvas.addEventListener('pointerup', endPointer);
drawCanvas.addEventListener('pointercancel', endPointer);

// ---------- keeping it ----------

// The picture as a data URL: PNG, or JPEG if a busy picture comes out too big for the Worker.
function drawImage() {
  let url = drawCanvas.toDataURL('image/png');
  for (const q of [0.9, 0.75, 0.6]) {
    if (url.length <= DRAW_MAX_CHARS) break;
    url = drawCanvas.toDataURL('image/jpeg', q);
  }
  return url;
}

// Kept on this device a moment after each stroke (so a closed app loses nothing), and at the end.
function saveSoon() {
  clearTimeout(drawSaveTimer);
  drawSaveTimer = setTimeout(saveDrawing, 2000);
}

function saveDrawing() {
  clearTimeout(drawSaveTimer);
  const d = drawing;
  if (!d || !d.changed) return Promise.resolve();
  d.changed = false;
  d.updated = newerThan(d.updated);
  return putDrawing({ id: d.id, player: d.player, image: drawImage(), updated: d.updated, deleted: false, dirty: true });
}

// A new version's time: now, but always after the one it replaces (newest wins, even if this
// device's clock is behind the one that saved it last).
const newerThan = (t) => Math.max(Date.now(), (t || 0) + 1);
