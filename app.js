'use strict';

// The version this copy of the app is; version.json on the site is the latest.
// Bump both before pushing: node tools/bump_version.mjs
const APP_VERSION = '2026.11.04.2';
const STORE_KEY = 'spells.v1';
const QUIZ_LENGTH = 10;
const HINTS_PER_QUIZ = 1;
const GRADES = [
  ['1', '1st grade'], ['2', '2nd grade'], ['3', '3rd grade'], ['4', '4th grade'],
  ['5', '5th grade'], ['6', '6th grade'], ['7', '7th grade'], ['8', '8th grade'],
  ['adult', 'Adult'],
];
const DIFF_NOTES = {
  easy: 'Shows how many letters the word has.',
  medium: 'Harder words. No letter boxes.',
  hard: 'The toughest words for this grade.',
};
const AVATARS = [
  // people first: they're the most picked
  '👧', '👦', '🧒', '👩', '👨', '🧑', '👱‍♀️', '👱', '👩‍🦰', '👨‍🦰', '👩‍🦱', '👨‍🦱',
  '👸', '🤴', '🧚', '🧜‍♀️', '🧝‍♀️', '🦸‍♀️', '🧙‍♀️', '🥷', '👩‍🚀', '🧑‍🚀', '👩‍🎤', '🧑‍🎤',
  '👩‍🎨', '👩‍🔬', '👩‍🍳', '👩‍🚒', '🕵️‍♀️', '👷‍♀️', '💃', '🕺', '🤸‍♀️', '🏄‍♀️', '🧗‍♀️', '⛹️‍♀️',
  '🦊', '🐼', '🦖', '🐙', '🦄', '🐸', '🚀', '🐯', '🐵', '🦉', '🐢', '⚡',
  '🐶', '🐱', '🐰', '🐨', '🦁', '🐧', '🐬', '🦈', '🐝', '🦋', '🐲', '🦕',
  '🤖', '👾', '🦸', '🧙', '⚽', '🏀', '🎸', '🎨', '🌈', '🍕', '🌮', '🏎️',
];
// Button icons: simple line drawings in the button's own color (24×24, stroked).
const ICONS = {
  speaker: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  bubble: '<path d="M4 5h16v11H11l-5 4v-4H4z"/><path d="M8 10.5h8"/>',
  pencil: '<path d="M15 4.5l4.5 4.5L9 19.5H4.5V15z"/><path d="M12.5 7l4.5 4.5"/>',
  book: '<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/><path d="M12 6.5v13"/>',
  eraser: '<path d="M4.6 14.6l9-9a2 2 0 0 1 2.8 0l3 3a2 2 0 0 1 0 2.8L12 18.8H8.8z"/><path d="M9.5 9.7l5.2 5.2M12 19h8"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  bulb: '<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M7.5 14h9"/>',
  write: '<path d="M3 15c1.6-6 3.4-6 4.6 0s3.2 6 4.6 0 3.2-6 4.6 0 2.4 4 4.2 1"/>',
};
// The shop: [id, name, stars to unlock, color]. A player's total stars unlock things (stars are
// never spent), so an unlocked theme or pen stays theirs. Theme colors live in style.css.
const THEMES = [
  ['classic', 'Classic', 0, '#6c4cf5'],
  ['ocean', 'Ocean', 10, '#0e8fb8'],
  ['flower', 'Flower', 20, '#c2357a'],
  ['jungle', 'Jungle', 25, '#2f9e44'],
  ['candy', 'Candy', 45, '#e64980'],
  ['sunset', 'Sunset', 70, '#f76707'],
  ['space', 'Space', 100, '#1d1550'],
];
const PENS = [
  ['ink', 'Ink', 0, '#23204a'],
  ['grape', 'Grape', 5, '#7048e8'],
  ['sky', 'Sky blue', 15, '#1c7ed6'],
  ['leaf', 'Leaf green', 30, '#2b8a3e'],
  ['berry', 'Berry pink', 50, '#d6336c'],
  ['tangerine', 'Tangerine', 75, '#f76707'],
  ['rainbow', 'Rainbow', 110, null], // changes color along the stroke
];
// Name styles: [id, name, stars, font family, size, weight]. Only the player's name uses them:
// the letters to spell always stay in plain print. Weight is the one the font comes in (asking
// for another makes the browser fake it, which smears).
const FONTS = [
  ['classic', 'Classic', 0, "'Nunito'", 1, 900],
  ['fancy', 'Fancy', 0, "'Dancing Script'", 1.15, 700],
  ['bubbly', 'Bubbly', 10, "'Pacifico'", 0.95, 400],
  ['comic', 'Comic', 20, "'Bangers'", 1.1, 400],
  ['swirly', 'Swirly', 35, "'Satisfy'", 1.15, 400],
  ['robot', 'Robot', 50, "'Orbitron'", 0.9, 800],
  ['pixel', 'Pixel', 70, "'Press Start 2P'", 0.6, 400],
];
// A player's name in their name style.
function nameHtml(p, text = p.name) {
  const [, , , family, size, weight] = shopItem(FONTS, p.font);
  return `<span class="player-name" style="font-family:${family}, 'Nunito', cursive;font-size:${size}em;font-weight:${weight}">${esc(text)}</span>`;
}
// Voice styles: [id, label, pitch, speed multiplier]. Pitch is ignored by some voices.
const VOICE_STYLES = [
  ['happy', '😄 Happy', 1.35, 1.05],
  ['normal', '🙂 Normal', 1, 1],
  ['squeaky', '🐭 Squeaky', 1.9, 1.1],
  ['deep', '🐻 Deep', 0.6, 0.95],
  ['slow', '🐢 Slow', 1.1, 0.8],
];
const CHEERS = ['Nice!', 'Great job!', 'You got it!', 'Awesome!', 'Nailed it!', 'Super speller!', 'Way to go!'];

// ---------- storage ----------

// Bump to wipe everyone's stars once (themes and pens back to the free ones; history stays, so
// mastered levels still count). 1: 2026-11-04, after the fair-stars rules, for stars farmed before.
const STARS_EPOCH = 1;

function freshDb() {
  return { profiles: [], lists: [], settings: { rate: 0.85, voiceURI: '', pin: '' }, starsEpoch: STARS_EPOCH };
}

// Saved data (from this browser or a backup file) brought up to date.
function fromSaved(saved) {
  const data = { ...freshDb(), ...saved, settings: { ...freshDb().settings, ...saved.settings } };
  if ((saved.starsEpoch || 0) < STARS_EPOCH) {
    data.profiles = data.profiles.map((p) => ({ ...p, stars: 0, theme: 'classic', pen: 'ink', font: 'classic' }));
    data.starsEpoch = STARS_EPOCH;
  }
  return data;
}

function loadDb() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return fromSaved(JSON.parse(raw));
  } catch (e) { /* storage blocked or corrupt: run without saved data */ }
  return freshDb();
}

let db = loadDb();

function saveDb() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch (e) { /* private mode */ }
}

// ---------- helpers ----------

const $ = (sel) => document.querySelector(sel);
const uid = () => Math.random().toString(36).slice(2, 10);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const gradeLabel = (g) => (GRADES.find(([k]) => k === g) || [, g])[1];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function dateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateStr(d);
}

function shortDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// A player's screens wear their theme; home and Parent mode stay Classic.
const PLAYER_SCREENS = ['setup', 'quiz', 'results', 'shop'];

function applyTheme(name) {
  const p = PLAYER_SCREENS.includes(name) ? current() : null;
  const theme = shopItem(THEMES, p?.theme);
  document.documentElement.dataset.theme = theme[0];
  document.querySelector('meta[name="theme-color"]').content = theme[3];
}

function show(name) {
  document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== `screen-${name}`; });
  applyTheme(name);
  window.scrollTo(0, 0);
  if (name === 'home') renderHome();
  if (name === 'setup') renderSetup();
  if (name === 'parent') renderParent();
  if (name === 'shop') renderShop();
}

// ---------- hold the screen still on touch screens ----------
// iPad Safari ignores user-scalable=no, so pinches are stopped here. On the quiz screen a stray
// finger drag shouldn't slide the page around either, unless the page really is taller than the
// screen (small phone, keyboard up), when it still has to scroll.
const quizShown = () => !$('#screen-quiz').hidden;
document.addEventListener('gesturestart', (e) => e.preventDefault()); // Safari's pinch event
document.addEventListener('touchmove', (e) => {
  const fits = document.documentElement.scrollHeight <= window.innerHeight + 1;
  if (e.touches.length > 1 || (quizShown() && fits)) e.preventDefault();
}, { passive: false });

// ---------- speech ----------

let voices = [];

function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
  if (!$('#screen-parent').hidden) renderVoiceSelect();
  if (!$('#screen-setup').hidden) renderPlayerVoice();
}

// Higher is better: neural/"natural" voices sound far less flat than the old ones.
function voiceRank(v) {
  if (/natural|neural|premium/i.test(v.name)) return 3;
  if (/enhanced|google/i.test(v.name)) return 2;
  return /en[-_]us/i.test(v.lang) ? 1 : 0;
}

function sortedVoices() {
  return [...voices].sort((a, b) => voiceRank(b) - voiceRank(a) || a.name.localeCompare(b.name));
}

function voiceLabel(v) {
  return `${voiceRank(v) === 3 ? '★ ' : ''}${v.name} (${v.lang})`;
}

// The player's own voice wins, then the family default from Settings, then the best one available.
function bestVoice(uri) {
  const chosen = (uri && voices.find((v) => v.voiceURI === uri))
    || voices.find((v) => v.voiceURI === db.settings.voiceURI);
  if (chosen) return chosen;
  const prefs = [/natural/i, /premium|enhanced/i, /samantha/i, /google us english/i, /aria|jenny/i];
  for (const p of prefs) {
    const v = voices.find((x) => p.test(x.name) && /en[-_]us/i.test(x.lang));
    if (v) return v;
  }
  return voices.find((v) => /en[-_]us/i.test(v.lang)) || voices[0] || null;
}

function voiceStyle(id) {
  return VOICE_STYLES.find(([k]) => k === id) || VOICE_STYLES[0];
}

// who: a player (uses their voice and style), or null for the family default.
function say(text, who = current()) {
  if (!('speechSynthesis' in window) || !text) return;
  const busy = speechSynthesis.speaking || speechSynthesis.pending;
  speechSynthesis.cancel();
  speechSynthesis.resume(); // Safari can get stuck paused (e.g. after the tab was in the background)
  const u = new SpeechSynthesisUtterance(text);
  const v = bestVoice(who?.voiceURI);
  if (v) { u.voice = v; u.lang = v.lang; }
  const [, , pitch, speed] = voiceStyle(who ? who.voiceStyle : 'normal');
  u.pitch = pitch;
  u.rate = Math.min(2, db.settings.rate * speed);
  say.last = u; // Chrome can garbage-collect an utterance mid-sentence without a reference
  // Chrome sometimes drops a speak() that comes right after cancel(), so wait a moment.
  if (busy) setTimeout(() => speechSynthesis.speak(u), 80);
  else speechSynthesis.speak(u);
}

let audioCtx = null;

function chime(good) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume();
    // Suspend again afterwards: a running AudioContext can hold the audio session on
    // iPhone and keep speech from playing.
    clearTimeout(chime.timer);
    chime.timer = setTimeout(() => audioCtx.suspend(), 600);
    const notes = good ? [660, 880] : [330, 247];
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const t = audioCtx.currentTime + i * 0.12;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  } catch (e) { /* no audio, no problem */ }
}

// ---------- profiles ----------

let currentId = null;
const current = () => db.profiles.find((p) => p.id === currentId);

function newProfile(name, avatar, grade) {
  return {
    id: uid(), name, avatar, grade,
    difficulty: 'easy', source: 'grade', voiceStyle: 'happy', voiceURI: '', theme: 'classic', pen: 'ink', font: 'classic',
    history: [], words: {}, stars: 0,
    day: { last: '', count: 0 },
  };
}

function dayStreak(p) {
  return p.day.last === dateStr() || p.day.last === yesterdayStr() ? p.day.count : 0;
}

function bumpDayStreak(p) {
  const today = dateStr();
  if (p.day.last === today) return;
  p.day.count = p.day.last === yesterdayStr() ? p.day.count + 1 : 1;
  p.day.last = today;
}

// Words whose most recent attempt was wrong.
function missedWords(p) {
  return Object.values(p.words)
    .filter((x) => x.last === false)
    .sort((a, b) => b.wrong - a.wrong)
    .map(({ w, s, d }) => ({ w, s, d }));
}

function poolFor(p) {
  if (p.source === 'missed') return missedWords(p);
  if (p.source.startsWith('list:')) {
    const list = db.lists.find((l) => `list:${l.id}` === p.source);
    return list ? list.words : [];
  }
  return (WORDS[p.grade]?.[p.difficulty] || []).map(([w, s]) => ({ w, s }));
}

function sourceLabel(src, grade, difficulty) {
  if (src === 'missed') return 'Missed words';
  if (src.startsWith('list:')) {
    const list = db.lists.find((l) => `list:${l.id}` === src);
    return list ? list.name : 'Deleted list';
  }
  return `${gradeLabel(grade)} · ${cap(difficulty)}`;
}

// ---------- levels and fair stars ----------
// A level is a grade + difficulty, in order: 1st Easy (0), 1st Medium (1), ... Adult Hard (26).
// A player has mastered a level after MASTER_TIMES quizzes of it at MASTER_SCORE or better.
// Grade words well below their best mastered level pay fewer stars, so replaying easy words
// can't farm stars for the shop. The grade can't be trusted for this: kids can change it.
// Word lists from Parent mode and missed-word practice always pay full stars.
const DIFFS = ['easy', 'medium', 'hard'];
const MASTER_SCORE = 0.9;
const MASTER_TIMES = 2;

const levelOf = (grade, difficulty) => GRADES.findIndex(([g]) => g === grade) * 3 + DIFFS.indexOf(difficulty);
const levelName = (lv) => `${gradeLabel(GRADES[Math.floor(lv / 3)][0])} ${cap(DIFFS[lv % 3])}`;

// The highest level this player has mastered, or -1 for none yet.
function masteredLevel(p) {
  const wins = {};
  let best = -1;
  for (const h of p.history) {
    if (h.source !== 'grade' || h.correct / h.total < MASTER_SCORE) continue;
    const lv = levelOf(h.grade, h.difficulty);
    wins[lv] = (wins[lv] || 0) + 1;
    if (wins[lv] >= MASTER_TIMES) best = Math.max(best, lv);
  }
  return best;
}

// The most stars a quiz can earn: 3 on a level not mastered yet, 2 on the best one mastered,
// 1 just under it, none a whole grade (3 levels) or more under it.
function starCap(p, source = p.source, grade = p.grade, difficulty = p.difficulty) {
  if (source !== 'grade') return 3;
  const gap = masteredLevel(p) - levelOf(grade, difficulty);
  return gap < 0 ? 3 : gap === 0 ? 2 : gap < 3 ? 1 : 0;
}

// What the setup screen and results say about a capped level.
function starCapNote(p, capStars) {
  if (capStars >= 3) return '';
  const next = Math.min(masteredLevel(p) + 1, GRADES.length * 3 - 1);
  const pays = capStars ? `up to ${capStars} star${capStars === 1 ? '' : 's'}` : 'no stars';
  return `You've mastered ${capStars ? 'this level' : 'these words'}, so it earns ${pays} now. Try ${levelName(next)} for 3 stars!`;
}

// Weighted random sample: words missed before come up more, unseen words a bit more.
function pickWords(p, pool) {
  const weight = (it) => {
    const st = p.words[it.w.toLowerCase()];
    return st ? 1 + (st.wrong * 2) / (1 + st.right) : 1.5;
  };
  return pool
    .map((it) => ({ it, k: Math.random() ** (1 / weight(it)) }))
    .sort((a, b) => b.k - a.k)
    .slice(0, QUIZ_LENGTH)
    .map((x) => x.it);
}

function recordWord(p, it, correct) {
  const key = it.w.toLowerCase();
  const st = p.words[key] || (p.words[key] = { w: it.w, s: it.s || '', right: 0, wrong: 0 });
  st.s = it.s || st.s;
  if (it.d) st.d = it.d;
  if (correct) st.right++; else st.wrong++;
  st.last = correct;
}

// ---------- home ----------

function renderHome() {
  const list = $('#profileList');
  if (!db.profiles.length) {
    list.innerHTML = '<p class="note" style="grid-column:1/-1;text-align:center">Add a player to get started.</p>';
    return;
  }
  list.innerHTML = db.profiles.map((p) => `
    <button class="profile-card" data-id="${p.id}">
      <span class="avatar">${p.avatar}</span>
      <span class="name">${nameHtml(p)}</span>
      <span class="meta">${gradeLabel(p.grade)}</span><br>
      <span class="meta">🔥 ${dayStreak(p)} · ⭐ ${p.stars}</span>
    </button>`).join('');
}

$('#profileList').addEventListener('click', (e) => {
  const card = e.target.closest('.profile-card');
  if (!card) return;
  currentId = card.dataset.id;
  show('setup');
});

function gradeOptions(selected) {
  return GRADES.map(([k, label]) => `<option value="${k}"${k === selected ? ' selected' : ''}>${label}</option>`).join('');
}

const avatarOptions = (chosen) => AVATARS.map((a) => `
  <label><input type="radio" name="avatar" value="${a}"${a === chosen ? ' checked' : ''}><span>${a}</span></label>`).join('');

$('#addPlayerBtn').addEventListener('click', () => {
  $('#playerName').value = '';
  $('#playerGrade').innerHTML = gradeOptions('2');
  $('#avatarPicker').innerHTML = avatarOptions(AVATARS[0]);
  $('#playerDialog').returnValue = '';
  $('#playerDialog').showModal();
  $('#playerName').focus();
});

$('#playerDialog').addEventListener('close', () => {
  if ($('#playerDialog').returnValue !== 'ok') return;
  const name = $('#playerName').value.trim();
  if (!name) return;
  const avatar = $('#avatarPicker input:checked')?.value || AVATARS[0];
  db.profiles.push(newProfile(name, avatar, $('#playerGrade').value));
  saveDb();
  renderHome();
});

// Change an existing player's buddy: tap their avatar on the setup screen.
$('#screen-setup').addEventListener('click', (e) => {
  if (!e.target.closest('.avatar-btn')) return;
  $('#avatarPicker2').innerHTML = avatarOptions(current().avatar);
  $('#avatarDialog').returnValue = '';
  $('#avatarDialog').showModal();
  $('#avatarPicker2 input:checked')?.scrollIntoView({ block: 'center' });
});

$('#avatarDialog').addEventListener('close', () => {
  const picked = $('#avatarPicker2 input:checked')?.value;
  if ($('#avatarDialog').returnValue !== 'ok' || !picked) return;
  current().avatar = picked;
  saveDb();
  renderSetup();
});

// ---------- setup ----------

function renderSetup() {
  const p = current();
  if (!p) return show('home');
  const streak = dayStreak(p);
  $('#setupHeader').innerHTML = `
    <button class="avatar avatar-btn" aria-label="Change buddy" title="Change buddy">${p.avatar}</button>
    <div>
      <div class="name">${nameHtml(p)}</div>
      <div class="badges">
        <span class="badge">🔥 ${streak} day${streak === 1 ? '' : 's'}</span>
        <span class="badge">⭐ ${p.stars} stars</span>
      </div>
    </div>
    <button class="btn btn-ghost shop-btn" data-go="shop">Shop</button>`;
  $('#gradeSelect').innerHTML = gradeOptions(p.grade);
  document.querySelectorAll('#diffSeg button').forEach((b) => b.classList.toggle('active', b.dataset.diff === p.difficulty));
  $('#diffNote').textContent = DIFF_NOTES[p.difficulty];
  document.querySelectorAll('#modeSeg button').forEach((b) => b.classList.toggle('active', b.dataset.mode === (p.inputMode || 'type')));
  renderPlayerVoice();

  const missed = missedWords(p).length;
  const opts = [['grade', 'Grade words']];
  db.lists.forEach((l) => opts.push([`list:${l.id}`, `📋 ${l.name} (${l.words.length})`]));
  if (missed) opts.push(['missed', `🔁 My missed words (${missed})`]);
  if (!opts.some(([v]) => v === p.source)) p.source = 'grade';
  $('#sourceSelect').innerHTML = opts.map(([v, label]) =>
    `<option value="${v}"${v === p.source ? ' selected' : ''}>${esc(label)}</option>`).join('');
  $('#gradeSelect').disabled = p.source !== 'grade';
  $('#starNote').textContent = starCapNote(p, starCap(p));
  $('#starNote').hidden = !$('#starNote').textContent;

  const recent = p.history.slice(-5).reverse();
  $('#recentList').innerHTML = recent.length
    ? recent.map((h) => `
        <li><span>${esc(sourceLabel(h.source, h.grade, h.difficulty))}<br><span class="when">${shortDate(h.t)}</span></span>
        <span>${h.correct}/${h.total} ${'⭐'.repeat(h.stars)}</span></li>`).join('')
    : '<li class="note">No quizzes yet. Press Start!</li>';
}

$('#gradeSelect').addEventListener('change', (e) => { current().grade = e.target.value; saveDb(); renderSetup(); });

$('#diffSeg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  current().difficulty = b.dataset.diff;
  saveDb();
  renderSetup();
});

$('#modeSeg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  current().inputMode = b.dataset.mode;
  saveDb();
  renderSetup();
});

function renderPlayerVoice() {
  const p = current();
  if (!p) return;
  const style = voiceStyle(p.voiceStyle)[0];
  $('#styleSeg').innerHTML = VOICE_STYLES.map(([k, label]) =>
    `<button data-style="${k}"${k === style ? ' class="active"' : ''}>${label}</button>`).join('');
  const uri = voices.some((v) => v.voiceURI === p.voiceURI) ? p.voiceURI : '';
  $('#playerVoiceSelect').innerHTML = `<option value="">Family voice</option>` + sortedVoices().map((v) =>
    `<option value="${esc(v.voiceURI)}"${v.voiceURI === uri ? ' selected' : ''}>${esc(voiceLabel(v))}</option>`).join('');
}

const VOICE_SAMPLE = 'Hi! Can you spell happy? I am so happy to see you.';

$('#styleSeg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  current().voiceStyle = b.dataset.style;
  saveDb();
  renderPlayerVoice();
  say(VOICE_SAMPLE);
});

$('#playerVoiceSelect').addEventListener('change', (e) => {
  current().voiceURI = e.target.value;
  saveDb();
  say(VOICE_SAMPLE);
});

$('#hearVoiceBtn').addEventListener('click', () => say(VOICE_SAMPLE));

$('#sourceSelect').addEventListener('change', (e) => {
  current().source = e.target.value;
  saveDb();
  renderSetup();
});

$('#startBtn').addEventListener('click', startQuiz);
$('#againBtn').addEventListener('click', startQuiz);

// ---------- quiz ----------

let quiz = null;
const input = $('#answer');

function startQuiz() {
  const p = current();
  const pool = poolFor(p);
  if (!pool.length) {
    alert('There are no words in that list yet.');
    return show('setup');
  }
  quiz = {
    p,
    items: pickWords(p, pool),
    i: 0,
    results: [],
    missed: [],
    reviewing: false,
    hintsLeft: HINTS_PER_QUIZ,
    streak: 0,
    bestStreak: 0,
    showSlots: p.difficulty === 'easy',
    mode: p.inputMode || 'type',
  };
  show('quiz');
  $('#reviewBanner').hidden = true;
  loadWord();
}

function currentItem() {
  return quiz.reviewing ? quiz.missed[quiz.i] : quiz.items[quiz.i];
}

function loadWord() {
  const it = currentItem();
  quiz.word = { target: it.w.toLowerCase(), hadError: false, hinted: false, done: false, doneAt: 0 };

  const total = quiz.reviewing ? quiz.missed.length : quiz.items.length;
  $('#quizProgressText').textContent = `${quiz.reviewing ? 'Practice' : 'Word'} ${quiz.i + 1} of ${total}`;
  $('#progressBar').style.width = `${(quiz.i / total) * 100}%`;
  renderStreak();

  input.value = '';
  input.readOnly = false;
  $('#blankText').hidden = true;
  $('#meaningText').hidden = true;
  $('#feedback').textContent = '';
  $('#feedback').className = 'feedback';
  $('#nextBtn').hidden = true;
  $('#giveUpBtn').hidden = false;
  $('#hintBtn').hidden = false;
  $('#markRightBtn').hidden = true;
  $('#markWrongBtn').hidden = true;
  $('#saySentenceBtn').disabled = !it.s;
  $('#blankBtn').disabled = !it.s;
  renderHint();

  $('#typeArea').hidden = writing();
  $('#writeArea').hidden = !writing();
  if (writing()) {
    input.blur(); // keep the phone keyboard away
    setupWriteArea();
  } else {
    renderTiles('');
  }

  // Called straight from a click so iPad allows the speech and the keyboard.
  focusInput();
  say(it.w);
}

const writing = () => quiz?.mode === 'write';

function focusInput() {
  if (!writing()) input.focus();
}

function renderStreak() {
  const b = $('#streakBadge');
  b.textContent = quiz.streak >= 2 ? `🔥 ${quiz.streak}` : '';
  b.classList.remove('pop');
  void b.offsetWidth; // restart the animation
  if (quiz.streak >= 2) b.classList.add('pop');
}

function renderHint() {
  $('#hintLabel').textContent = `Hint (${quiz.hintsLeft})`;
  $('#hintBtn').disabled = quiz.hintsLeft <= 0;
}

function renderTiles(typed, mode) {
  const t = quiz.word.target;
  let html = '';
  if (mode === 'reveal') {
    html = [...t].map((ch) => `<div class="tile reveal">${esc(ch)}</div>`).join('');
  } else {
    const n = Math.max(typed.length + (quiz.word.done ? 0 : 1), quiz.showSlots ? t.length : 0);
    for (let i = 0; i < n; i++) {
      if (i < typed.length) {
        html += `<div class="tile ${typed[i] === t[i] ? 'ok' : 'bad'}">${esc(typed[i])}</div>`;
      } else if (i === typed.length && !quiz.word.done) {
        html += '<div class="tile cursor"></div>';
      } else {
        html += '<div class="tile"></div>';
      }
    }
  }
  $('#tiles').innerHTML = html;
}

function typedValue() {
  return input.value.toLowerCase().replace(/\s+/g, '');
}

input.addEventListener('input', () => {
  const w = quiz?.word;
  if (!w || w.done) return;
  const typed = typedValue();
  if (!w.target.startsWith(typed)) w.hadError = true;
  renderTiles(typed);
  if (typed === w.target) finishWord(true);
});

// Keep the caret at the end; the tiles only show appends and backspaces.
['focus', 'click', 'keyup'].forEach((ev) => input.addEventListener(ev, () => {
  const n = input.value.length;
  if (input.selectionStart !== n) input.setSelectionRange(n, n);
}));

input.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !quiz) return;
  e.preventDefault();
  const w = quiz.word;
  if (w.done) {
    if (Date.now() - w.doneAt > 400) next();
    return;
  }
  const typed = typedValue();
  if (!typed) return;
  const msg = w.target.startsWith(typed) ? 'Keep going, there are more letters!' : 'Not quite. Fix the red letters.';
  setFeedback(msg, 'miss');
  const card = $('.quiz-card');
  card.classList.remove('shake');
  void card.offsetWidth;
  card.classList.add('shake');
});

$('#typeArea').addEventListener('click', () => input.focus());

function setFeedback(text, cls) {
  const f = $('#feedback');
  f.textContent = text;
  f.className = `feedback ${cls}`;
}

function finishWord(correct) {
  const w = quiz.word;
  const it = currentItem();
  w.done = true;
  w.doneAt = Date.now();
  input.readOnly = true;
  const perfect = correct && !w.hadError && !w.hinted;

  recordWord(quiz.p, it, correct);
  if (!quiz.reviewing) {
    quiz.results.push({ w: it.w, correct, perfect });
    if (correct) {
      quiz.streak++;
      quiz.bestStreak = Math.max(quiz.bestStreak, quiz.streak);
    } else {
      quiz.streak = 0;
      quiz.missed.push(it);
    }
    renderStreak();
  }
  saveDb();

  if (correct) {
    if (!writing()) renderTiles(typedValue());
    setFeedback(perfect ? `⭐ Perfect! ${pick(CHEERS)}` : pick(CHEERS), 'good');
    chime(true);
    confetti(perfect ? 40 : 24);
  } else {
    if (writing()) {
      revealWriting();
      setFeedback('This one goes on your practice list.', 'miss');
    } else {
      renderTiles('', 'reveal');
      setFeedback('Here\'s how to spell it:', 'miss');
    }
    say(`${it.w}. ${[...it.w.toLowerCase()].join(', ')}. ${it.w}.`);
  }
  $('#giveUpBtn').hidden = true;
  $('#hintBtn').hidden = true;
  $('#markRightBtn').hidden = true;
  $('#markWrongBtn').hidden = true;
  $('.write-tools').hidden = true;
  $('#nextBtn').hidden = false;
}

function next() {
  quiz.i++;
  if (!quiz.reviewing && quiz.i >= quiz.items.length) {
    saveQuizResult();
    if (quiz.missed.length) {
      quiz.reviewing = true;
      quiz.i = 0;
      $('#reviewBanner').hidden = false;
      loadWord();
    } else {
      showResults();
    }
  } else if (quiz.reviewing && quiz.i >= quiz.missed.length) {
    showResults();
  } else {
    loadWord();
  }
}

function hint() {
  const w = quiz.word;
  if (w.done || w.checked || quiz.hintsLeft <= 0) return;
  if (writing()) return hintWriting();
  const typed = typedValue();
  let good = 0;
  while (good < typed.length && typed[good] === w.target[good]) good++;
  input.value = w.target.slice(0, good + 1);
  w.hinted = true;
  quiz.hintsLeft--;
  renderHint();
  input.focus();
  input.dispatchEvent(new Event('input'));
}

// ---------- handwriting ----------
// One box per letter. The current letter is written on a big pad, and the strip of
// small boxes above it shows the word so far (tap one to redo it). Nothing reads the
// handwriting yet: after Check the right letter shows under each box and the
// speller marks it right or wrong.

const pad = $('#pad');

function setupWriteArea() {
  const w = quiz.word;
  w.boxes = [];
  w.active = 0;
  w.checked = false;
  $('#writeBoxes').innerHTML = '';
  $('#writeArea').classList.remove('checked');
  $('.write-tools').hidden = false;
  const start = quiz.showSlots ? w.target.length : 1;
  for (let i = 0; i < start; i++) addBox();
  sizeCanvas(pad);
  selectBox(0);
}

function addBox() {
  const w = quiz.word;
  const wrap = document.createElement('button');
  wrap.type = 'button';
  wrap.className = 'write-box';
  wrap.innerHTML = '<canvas class="ruled"></canvas><span class="answer"></span>';
  $('#writeBoxes').append(wrap);
  const box = { wrap, canvas: wrap.querySelector('canvas'), strokes: [], ghost: '' };
  w.boxes.push(box);
  wrap.addEventListener('click', () => {
    if (!w.checked && !w.done) selectBox(w.boxes.indexOf(box));
  });
  sizeCanvas(box.canvas);
  return box;
}

function sizeCanvas(canvas) {
  const r = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(r.width * dpr));
  canvas.height = Math.max(1, Math.round(r.height * dpr));
}

// Points are stored as 0–1 fractions, so the same strokes draw on the pad and in the strip.
// A hint's guide letter is drawn underneath, sitting on the ruled baseline (78%).
function drawStrokes(canvas, strokes, ghost) {
  const ctx = canvas.getContext('2d');
  const { width: cw, height: ch } = canvas;
  ctx.clearRect(0, 0, cw, ch);
  if (ghost) {
    ctx.font = `800 ${ch * 0.7}px Nunito, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(108, 76, 245, 0.2)';
    ctx.fillText(ghost, cw / 2, ch * 0.78);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = cw * 0.05;
  const [, , , color] = shopItem(PENS, quiz?.p?.pen);
  ctx.strokeStyle = color || '#23204a';
  let hue = 0;
  for (const s of strokes) {
    if (!color) { // rainbow: each little segment a step further round the color wheel
      const pts = s.length === 1 ? [s[0], [s[0][0] + 0.5 / cw, s[0][1]]] : s; // a dot is one tiny segment
      for (let i = 1; i < pts.length; i++, hue = (hue + 9) % 360) {
        ctx.strokeStyle = `hsl(${hue} 85% 52%)`;
        ctx.beginPath();
        ctx.moveTo(pts[i - 1][0] * cw, pts[i - 1][1] * ch);
        ctx.lineTo(pts[i][0] * cw, pts[i][1] * ch);
        ctx.stroke();
      }
      continue;
    }
    ctx.beginPath();
    s.forEach(([x, y], i) => (i ? ctx.lineTo(x * cw, y * ch) : ctx.moveTo(x * cw, y * ch)));
    if (s.length === 1) ctx.lineTo(s[0][0] * cw + 0.5, s[0][1] * ch); // a dot, like on an i
    ctx.stroke();
  }
}

const activeBox = () => quiz.word.boxes[quiz.word.active];

function renderBox(box) {
  drawStrokes(box.canvas, box.strokes, box.ghost);
  if (box === activeBox() && !quiz.word.checked) drawStrokes(pad, box.strokes, box.ghost);
}

function selectBox(i) {
  const w = quiz.word;
  w.active = i;
  w.boxes.forEach((b, idx) => b.wrap.classList.toggle('active', idx === i));
  renderBox(activeBox());
  updateNextLetter();
}

// The Next button turns into Check on the last letter: the last box on easy, or
// the empty box after the last written letter on medium/hard.
function isCheckStep() {
  const w = quiz.word;
  return w.active === w.boxes.length - 1 && (quiz.showSlots || !activeBox().strokes.length);
}

function updateNextLetter() {
  const b = $('#nextLetterBtn');
  const check = isCheckStep();
  b.textContent = check ? 'Check ✓' : 'Next →';
  b.classList.toggle('btn-primary', check);
  b.classList.toggle('btn-ghost', !check);
  b.disabled = check && !quiz.word.boxes.some((x) => x.strokes.length);
}

function nextLetter() {
  const w = quiz.word;
  if (w.checked || w.done) return;
  if (w.active === w.boxes.length - 1) {
    if (quiz.showSlots || !activeBox().strokes.length || w.boxes.length >= w.target.length + 6) return;
    addBox();
  }
  selectBox(w.active + 1);
}

(function attachPad() {
  let stroke = null;
  const pt = (e) => {
    const r = pad.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  pad.addEventListener('pointerdown', (e) => {
    const w = quiz?.word;
    if (!w?.boxes || w.done || w.checked) return;
    e.preventDefault();
    try { pad.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
    stroke = [pt(e)];
    activeBox().strokes.push(stroke);
    renderBox(activeBox());
  });
  pad.addEventListener('pointermove', (e) => {
    if (!stroke) return;
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    (events.length ? events : [e]).forEach((ev) => stroke.push(pt(ev)));
    renderBox(activeBox());
  });
  const end = () => {
    if (!stroke) return;
    stroke = null;
    updateNextLetter();
  };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
})();

function undoStroke() {
  if (quiz.word.checked) return;
  activeBox().strokes.pop();
  renderBox(activeBox());
  updateNextLetter();
}

function clearLetter() {
  if (quiz.word.checked) return;
  activeBox().strokes = [];
  renderBox(activeBox());
  updateNextLetter();
}

// Hint: trace a faint copy of the letter that belongs in the current box.
function hintWriting() {
  const w = quiz.word;
  const box = activeBox();
  if (w.active >= w.target.length) {
    setFeedback('The word is shorter than that. Try Check!', '');
    return;
  }
  if (box.ghost) return;
  box.ghost = w.target[w.active];
  w.hinted = true;
  quiz.hintsLeft--;
  renderHint();
  renderBox(box);
}

// Show the right letter under each box, with dashed boxes for letters that were left out.
function revealWriting() {
  const w = quiz.word;
  w.checked = true;
  $('#writeArea').classList.add('checked');
  while (w.boxes.length > w.target.length && !w.boxes[w.boxes.length - 1].strokes.length) {
    w.boxes.pop().wrap.remove();
  }
  while (w.boxes.length < w.target.length) addBox();
  w.boxes.forEach((b, i) => {
    b.ghost = '';
    b.wrap.classList.remove('active');
    b.wrap.querySelector('.answer').textContent = w.target[i] || '✕';
    b.wrap.classList.toggle('extra', i >= w.target.length);
    b.wrap.classList.toggle('missing', !b.strokes.length);
    sizeCanvas(b.canvas); // the strip gets bigger once checked
    renderBox(b);
  });
}

function checkWriting() {
  const w = quiz.word;
  if (w.done || w.checked) return;
  if (!w.boxes.some((b) => b.strokes.length)) {
    setFeedback('Write the word first, one letter per box.', 'miss');
    return;
  }
  revealWriting();
  setFeedback('Check each letter. Did you get them all?', '');
  $('.write-tools').hidden = true;
  $('#hintBtn').hidden = true;
  $('#giveUpBtn').hidden = true;
  $('#markRightBtn').hidden = false;
  $('#markWrongBtn').hidden = false;
  const it = currentItem();
  say(`${it.w}. ${[...it.w.toLowerCase()].join(', ')}.`);
}

$('#undoBtn').addEventListener('click', undoStroke);
$('#clearBtn').addEventListener('click', clearLetter);
$('#nextLetterBtn').addEventListener('click', () => (isCheckStep() ? checkWriting() : nextLetter()));
$('#markRightBtn').addEventListener('click', () => finishWord(true));
$('#markWrongBtn').addEventListener('click', () => finishWord(false));
window.addEventListener('resize', () => {
  if (!writing() || !quiz.word?.boxes) return;
  sizeCanvas(pad);
  quiz.word.boxes.forEach((b) => { sizeCanvas(b.canvas); renderBox(b); });
});

function blankOut(sentence, word, filler) {
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
  return sentence.replace(re, filler);
}

// Meaning: the list's own, then the built-in one, then a free online dictionary.
const lookedUp = new Map();

async function meaningFor(it) {
  const key = it.w.toLowerCase();
  if (it.d) return it.d;
  if (DEFS[key]) return DEFS[key];
  if (lookedUp.has(key)) return lookedUp.get(key);
  let def = '';
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`);
    if (res.ok) {
      const data = await res.json();
      def = data[0]?.meanings?.[0]?.definitions?.[0]?.definition || '';
    }
  } catch (e) { /* offline */ }
  if (def) lookedUp.set(key, def);
  return def;
}

$('#meaningBtn').addEventListener('click', async () => {
  const it = currentItem();
  const box = $('#meaningText');
  box.textContent = 'Looking it up…';
  box.hidden = false;
  focusInput();
  const def = await meaningFor(it);
  if (currentItem() !== it) return; // moved on while it was loading
  if (!def) {
    box.textContent = 'No meaning found for this word.';
    return;
  }
  const shown = blankOut(def, it.w, '_____');
  box.textContent = shown;
  say(`It means: ${blankOut(def, it.w, 'blank')}`);
});

$('#sayWordBtn').addEventListener('click', () => { say(currentItem().w); focusInput(); });
$('#saySentenceBtn').addEventListener('click', () => { say(currentItem().s); focusInput(); });
$('#blankBtn').addEventListener('click', () => {
  const it = currentItem();
  $('#blankText').textContent = blankOut(it.s, it.w, '_____');
  $('#blankText').hidden = false;
  say(blankOut(it.s, it.w, 'blank'));
  focusInput();
});
$('#hintBtn').addEventListener('click', hint);
$('#giveUpBtn').addEventListener('click', () => { if (!quiz.word.done) finishWord(false); });
$('#nextBtn').addEventListener('click', next);
$('#skipReviewBtn').addEventListener('click', showResults);
$('#quitBtn').addEventListener('click', () => {
  window.speechSynthesis?.cancel();
  if (quiz.reviewing || confirm('Quit this quiz? Your progress on it won\'t be scored.')) {
    quiz = null;
    show('setup');
  }
});

// ---------- results ----------

function starsFor(correct, total) {
  const r = correct / total;
  return r >= 0.9 ? 3 : r >= 0.7 ? 2 : r >= 0.5 ? 1 : 0;
}

function saveQuizResult() {
  const p = quiz.p;
  const correct = quiz.results.filter((r) => r.correct).length;
  const total = quiz.results.length;
  const capStars = starCap(p);
  const masteredBefore = masteredLevel(p);
  const stars = Math.min(starsFor(correct, total), capStars);
  const same = p.history.filter((h) => h.source === p.source && (p.source !== 'grade' || (h.grade === p.grade && h.difficulty === p.difficulty)));
  const prevBest = same.length ? Math.max(...same.map((h) => h.correct / h.total)) : null;

  bumpDayStreak(p);
  const before = p.stars;
  p.stars += stars;
  const unlocks = [...THEMES.map((t) => [t, 'theme']), ...FONTS.map((t) => [t, 'name style']), ...PENS.map((t) => [t, 'pen'])]
    .filter(([[, , cost]]) => cost > before && cost <= p.stars)
    .map(([[, name], kind]) => `${name} ${kind}`);
  p.history.push({
    t: Date.now(), source: p.source, grade: p.grade, difficulty: p.difficulty, mode: quiz.mode,
    correct, total, perfect: quiz.results.filter((r) => r.perfect).length,
    hintsUsed: HINTS_PER_QUIZ - quiz.hintsLeft, bestStreak: quiz.bestStreak, stars,
  });
  saveDb();
  const mastered = masteredLevel(p);
  quiz.summary = {
    correct, total, stars, unlocks, newBest: prevBest !== null && correct / total > prevBest,
    capNote: starsFor(correct, total) > stars ? starCapNote(p, capStars) : '',
    mastered: mastered > masteredBefore ? levelName(mastered) : '',
  };
}

function showResults() {
  const p = quiz.p;
  const { correct, total, stars, newBest, unlocks = [], capNote = '', mastered = '' } = quiz.summary;
  const perfect = quiz.results.filter((r) => r.perfect).length;
  const missed = quiz.results.filter((r) => !r.correct);

  $('#resultStars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < stars ? '' : 'dim'}">⭐</span>`).join('');
  const cheer = stars === 3 ? 'Amazing' : stars === 2 ? 'Great work' : stars === 1 ? 'Good effort' : 'Keep practicing';
  $('#resultTitle').innerHTML = `${cheer}, ${nameHtml(p)}!`;
  const streak = dayStreak(p);
  $('#resultStats').innerHTML = [
    `✅ <b>${correct}</b> of ${total} correct`,
    `⭐ <b>${perfect}</b> perfect (${quiz.mode === 'write' ? 'no hint' : 'no red letters, no hint'})`,
    quiz.bestStreak >= 2 ? `🔥 Best streak: <b>${quiz.bestStreak}</b> in a row` : '',
    `📅 Practiced <b>${streak}</b> day${streak === 1 ? '' : 's'} in a row`,
    newBest ? '🏆 <b>New personal best!</b>' : '',
    mastered ? `🎓 <b>You mastered ${esc(mastered)}!</b>` : '',
    capNote ? `<span class="note">${esc(capNote)}</span>` : '',
  ].filter(Boolean).map((s) => `<li>${s}</li>`).join('');
  $('#resultMissed').innerHTML = missed.length
    ? `<p class="note">Words to practice:</p><div class="chips">${missed.map((r) => `<span class="chip">${esc(r.w)}</span>`).join('')}</div>`
    : '';
  $('#resultUnlocks').hidden = !unlocks.length;
  $('#resultUnlocks').innerHTML = unlocks.length
    ? `<b>New in the shop:</b> ${unlocks.map(esc).join(', ')}
       <button class="btn btn-primary" data-go="shop">Go to the shop</button>`
    : '';

  show('results');
  if (stars === 3) confetti();
  else if (stars > 0) chime(true);
}

// A small burst (24–40 pieces) for each right word, the full shower (90) for a perfect quiz.
function confetti(pieces = 90) {
  const box = $('#confetti');
  const colors = ['#6c4cf5', '#ff9f1c', '#1fb36b', '#e5484d', '#2bb3ff', '#ffd23f'];
  const fall = pieces >= 90 ? 2 : 1.4; // a burst falls faster so it's gone before the next word
  box.innerHTML = Array.from({ length: pieces }, () => `<i style="left:${Math.random() * 100}%;background:${pick(colors)};animation-duration:${fall + Math.random() * fall}s;animation-delay:${Math.random() * 0.4}s"></i>`).join('');
  clearTimeout(confetti.timer); // a fresh burst must not be wiped by the last one's timer
  confetti.timer = setTimeout(() => { box.innerHTML = ''; }, (fall * 2 + 0.6) * 1000);
}

// ---------- shop ----------

// The item with this id, or the free first one (old profiles have no theme or pen yet).
const shopItem = (list, id) => list.find(([k]) => k === id) || list[0];

const LOCK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>';

function penSwatch(id, color) {
  const stroke = color || `url(#rb-${id})`;
  return `<svg class="pen-swatch" viewBox="0 0 100 50" aria-hidden="true">
    ${color ? '' : `<defs><linearGradient id="rb-${id}"><stop offset="0" stop-color="#ff3b3b"/><stop offset=".25" stop-color="#ffb000"/><stop offset=".5" stop-color="#22c55e"/><stop offset=".75" stop-color="#3b82f6"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs>`}
    <path d="M8 34 C 22 6, 34 6, 40 26 S 60 46, 70 22 S 88 10, 92 20" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round"/>
  </svg>`;
}

function shopTile(kind, list, [id, name, cost, color], p) {
  const using = shopItem(list, p[kind])[0] === id;
  const locked = p.stars < cost;
  const preview = kind === 'theme'
    ? `<span class="theme-preview" data-theme="${id}"><i class="pv-card"><i class="pv-line"></i><i class="pv-line short"></i><i class="pv-btn"></i></i></span>`
    : kind === 'font' ? `<span class="font-preview">${nameHtml({ ...p, font: id })}</span>`
    : penSwatch(id, color);
  const status = using ? 'Using'
    : locked ? `${LOCK_SVG}<span>${cost - p.stars} more ★</span>`
    : 'Tap to use';
  const meter = locked ? `<span class="meter"><i style="width:${Math.round((p.stars / cost) * 100)}%"></i></span>` : '';
  return `<button class="shop-item${locked ? ' locked' : ''}${using ? ' using' : ''}" data-kind="${kind}" data-id="${id}"${locked ? ' aria-disabled="true"' : ''}>
    ${preview}<b>${esc(name)}</b><span class="status">${status}</span>${meter}
  </button>`;
}

function renderShop() {
  const p = current();
  if (!p) return show('home');
  $('#shopStars').textContent = p.stars;
  $('#themeGrid').innerHTML = THEMES.map((t) => shopTile('theme', THEMES, t, p)).join('');
  $('#fontGrid').innerHTML = FONTS.map((t) => shopTile('font', FONTS, t, p)).join('');
  $('#penGrid').innerHTML = PENS.map((t) => shopTile('pen', PENS, t, p)).join('');
}

$('#screen-shop').addEventListener('click', (e) => {
  const b = e.target.closest('.shop-item');
  if (!b || b.classList.contains('locked')) return;
  const p = current();
  p[b.dataset.kind] = b.dataset.id;
  saveDb();
  applyTheme('shop');
  renderShop();
  chime(true);
});

// ---------- parent mode ----------

$('#parentBtn').addEventListener('click', () => {
  if (!db.settings.pin) return show('parent');
  $('#pinGate').value = '';
  $('#pinGateMsg').textContent = '';
  $('#pinDialog').showModal();
  $('#pinGate').focus();
});

$('#pinForm').addEventListener('submit', (e) => {
  if ($('#pinGate').value !== db.settings.pin) {
    e.preventDefault();
    $('#pinGateMsg').textContent = 'That PIN is not right.';
    $('#pinGate').value = '';
    return;
  }
  setTimeout(() => show('parent'));
});

let activeTab = 'progress';

$('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  activeTab = b.dataset.tab;
  renderParent();
});

function renderParent() {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === activeTab));
  document.querySelectorAll('.tab-panel').forEach((t) => { t.hidden = t.id !== `tab-${activeTab}`; });
  if (activeTab === 'progress') renderProgress();
  if (activeTab === 'lists') renderLists();
  if (activeTab === 'players') renderPlayers();
  if (activeTab === 'settings') renderSettings();
}

function avgPct(hs) {
  return hs.length ? Math.round((hs.reduce((a, h) => a + h.correct / h.total, 0) / hs.length) * 100) : null;
}

function renderProgress() {
  if (!db.profiles.length) {
    $('#tab-progress').innerHTML = '<div class="card note">No players yet.</div>';
    return;
  }
  $('#tab-progress').innerHTML = db.profiles.map((p) => {
    const h = p.history;
    const recent = avgPct(h.slice(-5));
    const before = avgPct(h.slice(-10, -5));
    const trend = recent !== null && before !== null ? recent - before : null;
    const trendHtml = trend === null ? '<span class="note">—</span>'
      : `<span class="${trend >= 0 ? 'trend-up' : 'trend-down'}">${trend >= 0 ? '▲' : '▼'} ${Math.abs(trend)}%</span>`;
    const worst = Object.values(p.words).filter((x) => x.wrong > 0).sort((a, b) => b.wrong - a.wrong).slice(0, 8);
    const bars = h.slice(-15).map((x) => `<div title="${shortDate(x.t)}: ${x.correct}/${x.total}" style="height:${Math.max(5, (x.correct / x.total) * 100)}%"></div>`).join('');
    return `
      <div class="card">
        <div class="player-header"><span class="avatar">${p.avatar}</span>
          <div><div class="name">${esc(p.name)}</div><span class="note">${gradeLabel(p.grade)} · last played ${h.length ? shortDate(h[h.length - 1].t) : 'never'}</span></div>
        </div>
        <div class="stat-row">
          <div class="stat"><b>${h.length}</b><span>quizzes</span></div>
          <div class="stat"><b>${recent ?? '—'}${recent !== null ? '%' : ''}</b><span>last 5 avg</span></div>
          <div class="stat"><b>${trendHtml}</b><span>vs 5 before</span></div>
          <div class="stat"><b>🔥 ${dayStreak(p)}</b><span>day streak</span></div>
          <div class="stat"><b>⭐ ${p.stars}</b><span>stars</span></div>
          <div class="stat"><b>${masteredLevel(p) < 0 ? '—' : levelName(masteredLevel(p))}</b><span>mastered</span></div>
        </div>
        ${bars ? `<p class="note">Recent scores</p><div class="bars">${bars}</div>` : ''}
        ${worst.length ? `<p class="note">Most missed</p><div class="chips" style="justify-content:flex-start">${worst.map((x) => `<span class="chip">${esc(x.w)} <small>✗${x.wrong} ✓${x.right}</small></span>`).join('')}</div>` : ''}
      </div>`;
  }).join('');
}

// Word lists

let editingListId = null;

function parseListText(text) {
  const words = [];
  const warnings = [];
  text.split('\n').forEach((line) => {
    const [w, s, d] = line.split('|').map((x) => x.trim()).concat('', '');
    if (!w) return;
    if (/[^a-zA-Z'-]/.test(w)) warnings.push(`"${w}" has spaces or symbols, which makes it hard to type.`);
    if (s && blankOut(s, w, '') === s) warnings.push(`The sentence for "${w}" doesn't contain the word, so nothing will be blanked out.`);
    else if (s && blankOut(s, w, '').toLowerCase().includes(w.toLowerCase())) warnings.push(`The sentence for "${w}" still shows the word inside another word (like "snow" in "snowman").`);
    if (d && d.toLowerCase().includes(w.toLowerCase())) warnings.push(`The meaning for "${w}" uses the word itself, so it will show as a blank.`);
    words.push(d ? { w, s, d } : { w, s });
  });
  return { words, warnings };
}

function resetListEditor() {
  editingListId = null;
  $('#listName').value = '';
  $('#listWords').value = '';
  $('#listWarn').textContent = '';
  $('#listEditorTitle').textContent = 'New word list';
  $('#cancelListBtn').hidden = true;
}

function renderLists() {
  $('#listsView').innerHTML = db.lists.length
    ? db.lists.map((l) => `
        <div class="card list-row">
          <div><b>${esc(l.name)}</b><br><span class="note">${l.words.length} words: ${esc(l.words.slice(0, 6).map((x) => x.w).join(', '))}${l.words.length > 6 ? '…' : ''}</span></div>
          <div class="action-row">
            <button class="btn btn-ghost" data-edit="${l.id}">Edit</button>
            <button class="btn btn-ghost btn-danger" data-del="${l.id}">Delete</button>
          </div>
        </div>`).join('')
    : '<p class="note">No custom lists yet. Each list you save shows up under "Words" for every player.</p>';
}

$('#saveListBtn').addEventListener('click', () => {
  const name = $('#listName').value.trim();
  const { words, warnings } = parseListText($('#listWords').value);
  if (!name || !words.length) {
    $('#listWarn').textContent = 'Give the list a name and at least one word.';
    return;
  }
  const existing = db.lists.find((l) => l.id === editingListId);
  if (existing) Object.assign(existing, { name, words });
  else db.lists.push({ id: uid(), name, words });
  saveDb();
  resetListEditor();
  $('#listWarn').textContent = warnings.length ? `Saved. Heads up: ${warnings.join(' ')}` : 'Saved!';
  renderLists();
});

$('#cancelListBtn').addEventListener('click', resetListEditor);

$('#listsView').addEventListener('click', (e) => {
  const edit = e.target.closest('[data-edit]');
  const del = e.target.closest('[data-del]');
  if (edit) {
    const l = db.lists.find((x) => x.id === edit.dataset.edit);
    editingListId = l.id;
    $('#listName').value = l.name;
    $('#listWords').value = l.words.map((x) => [x.w, x.s, x.d].filter((v, i, a) => v || a.slice(i + 1).some(Boolean)).join(' | ')).join('\n');
    $('#listEditorTitle').textContent = `Editing "${l.name}"`;
    $('#cancelListBtn').hidden = false;
    $('#listWarn').textContent = '';
    window.scrollTo(0, 0);
  } else if (del) {
    const l = db.lists.find((x) => x.id === del.dataset.del);
    if (!confirm(`Delete the list "${l.name}"?`)) return;
    db.lists = db.lists.filter((x) => x !== l);
    db.profiles.forEach((p) => { if (p.source === `list:${l.id}`) p.source = 'grade'; });
    if (editingListId === l.id) resetListEditor();
    saveDb();
    renderLists();
  }
});

// Players

function renderPlayers() {
  $('#tab-players').innerHTML = (db.profiles.map((p) => `
    <div class="card" data-player="${p.id}">
      <div class="player-header"><span class="avatar">${p.avatar}</span><div class="name">${esc(p.name)}</div></div>
      <label class="field"><span>Name</span><input type="text" data-field="name" value="${esc(p.name)}" maxlength="20"></label>
      <label class="field"><span>Grade</span><select data-field="grade">${gradeOptions(p.grade)}</select></label>
      <div class="action-row">
        <button class="btn btn-ghost" data-act="reset">Reset progress</button>
        <button class="btn btn-ghost btn-danger" data-act="delete">Delete player</button>
      </div>
    </div>`).join('')) || '<div class="card note">No players yet. Add them from the home screen.</div>';
}

$('#tab-players').addEventListener('change', (e) => {
  const card = e.target.closest('[data-player]');
  const p = db.profiles.find((x) => x.id === card?.dataset.player);
  if (!p || !e.target.dataset.field) return;
  const val = e.target.value.trim();
  if (e.target.dataset.field === 'name' && !val) return;
  p[e.target.dataset.field] = val;
  saveDb();
  renderPlayers();
});

$('#tab-players').addEventListener('click', (e) => {
  const act = e.target.dataset.act;
  if (!act) return;
  const p = db.profiles.find((x) => x.id === e.target.closest('[data-player]').dataset.player);
  if (act === 'reset' && confirm(`Reset all progress, stars, and streaks for ${p.name}?`)) {
    Object.assign(p, { history: [], words: {}, stars: 0, day: { last: '', count: 0 } });
  } else if (act === 'delete' && confirm(`Delete ${p.name} and all their progress?`)) {
    db.profiles = db.profiles.filter((x) => x !== p);
  } else {
    return;
  }
  saveDb();
  renderPlayers();
});

// Settings

function renderVoiceSelect() {
  const chosen = bestVoice();
  $('#voiceSelect').innerHTML = voices.length
    ? sortedVoices().map((v) => `<option value="${esc(v.voiceURI)}"${v === chosen ? ' selected' : ''}>${esc(voiceLabel(v))}</option>`).join('')
    : '<option>No English voices found</option>';
}

function renderSettings() {
  renderVoiceSelect();
  $('#rateInput').value = db.settings.rate;
  $('#rateOut').textContent = `${db.settings.rate}×`;
  $('#pinMsg').textContent = db.settings.pin ? 'A PIN is set.' : 'No PIN set. Anyone can open Parent mode.';
}

$('#voiceSelect').addEventListener('change', (e) => { db.settings.voiceURI = e.target.value; saveDb(); });
$('#rateInput').addEventListener('input', (e) => {
  db.settings.rate = Number(e.target.value);
  $('#rateOut').textContent = `${db.settings.rate}×`;
  saveDb();
});
$('#testVoiceBtn').addEventListener('click', () => say('Can you spell beautiful? The sunset was beautiful.', null));

$('#savePinBtn').addEventListener('click', () => {
  const pin = $('#pinInput').value.trim();
  if (pin.length < 3) { $('#pinMsg').textContent = 'Use at least 3 digits.'; return; }
  db.settings.pin = pin;
  $('#pinInput').value = '';
  saveDb();
  renderSettings();
});

$('#clearPinBtn').addEventListener('click', () => {
  db.settings.pin = '';
  saveDb();
  renderSettings();
});

$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `spelling-backup-${dateStr()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$('#importInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.profiles) || !Array.isArray(data.lists)) throw new Error('not a backup');
    if (!confirm('Replace everything on this device with the backup?')) return;
    db = fromSaved(data);
    saveDb();
    $('#backupMsg').textContent = `Restored ${db.profiles.length} players and ${db.lists.length} lists.`;
  } catch (err) {
    $('#backupMsg').textContent = 'That file is not a spelling backup.';
  }
});

// ---------- nav + boot ----------

document.querySelectorAll('i.ic[data-icon]').forEach((el) => {
  el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[el.dataset.icon]}</svg>`;
});

document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) show(go.dataset.go);
  const close = e.target.closest('[data-close]');
  if (close) close.closest('dialog').close();
});

if ('speechSynthesis' in window) {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
} else {
  $('#noSpeech').hidden = false;
}

// ---------- version + updates ----------
// An app added to the iPad's home screen often just resumes where it was, so check the site's
// version.json when it opens and each time it comes back to the front. A newer one shows an
// Update banner on the home screen (never mid-quiz). Progress is saved, so reloading loses nothing.
const newerVersion = (a, b) => {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};
async function checkForUpdate() {
  if (location.protocol === 'file:') return; // opened from disk: there's no site to ask
  try {
    const { version } = await (await fetch('version.json', { cache: 'no-store' })).json();
    if (!version || !newerVersion(version, APP_VERSION)) return;
    $('#updateBtn').textContent = `✨ A new version is out (${version}). Tap to update.`;
    $('#updateBtn').hidden = false;
  } catch (e) { /* offline: nothing to compare with */ }
}
$('#updateBtn').addEventListener('click', () => location.reload());
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
document.querySelectorAll('.app-version').forEach((el) => { el.textContent = `Version ${APP_VERSION}`; });
checkForUpdate();

show('home');
