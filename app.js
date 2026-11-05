'use strict';

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
  '🦊', '🐼', '🦖', '🐙', '🦄', '🐸', '🚀', '🐯', '🐵', '🦉', '🐢', '⚡',
  '🐶', '🐱', '🐰', '🐨', '🦁', '🐧', '🐬', '🦈', '🐝', '🦋', '🐲', '🦕',
  '🤖', '👾', '🦸', '🧙', '⚽', '🏀', '🎸', '🎨', '🌈', '🍕', '🌮', '🏎️',
];
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

function freshDb() {
  return { profiles: [], lists: [], settings: { rate: 0.85, voiceURI: '', pin: '' } };
}

function loadDb() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return { ...freshDb(), ...saved, settings: { ...freshDb().settings, ...saved.settings } };
    }
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

function show(name) {
  document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== `screen-${name}`; });
  window.scrollTo(0, 0);
  if (name === 'home') renderHome();
  if (name === 'setup') renderSetup();
  if (name === 'parent') renderParent();
}

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
    difficulty: 'easy', source: 'grade', voiceStyle: 'happy', voiceURI: '',
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
      <span class="name">${esc(p.name)}</span>
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

$('#addPlayerBtn').addEventListener('click', () => {
  $('#playerName').value = '';
  $('#playerGrade').innerHTML = gradeOptions('2');
  $('#avatarPicker').innerHTML = AVATARS.map((a, i) => `
    <label><input type="radio" name="avatar" value="${a}"${i === 0 ? ' checked' : ''}><span>${a}</span></label>`).join('');
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

// ---------- setup ----------

function renderSetup() {
  const p = current();
  if (!p) return show('home');
  const streak = dayStreak(p);
  $('#setupHeader').innerHTML = `
    <span class="avatar">${p.avatar}</span>
    <div>
      <div class="name">${esc(p.name)}</div>
      <div class="badges">
        <span class="badge">🔥 ${streak} day${streak === 1 ? '' : 's'}</span>
        <span class="badge">⭐ ${p.stars} stars</span>
      </div>
    </div>`;
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

  const recent = p.history.slice(-5).reverse();
  $('#recentList').innerHTML = recent.length
    ? recent.map((h) => `
        <li><span>${esc(sourceLabel(h.source, h.grade, h.difficulty))}<br><span class="when">${shortDate(h.t)}</span></span>
        <span>${h.correct}/${h.total} ${'⭐'.repeat(h.stars)}</span></li>`).join('')
    : '<li class="note">No quizzes yet. Press Start!</li>';
}

$('#gradeSelect').addEventListener('change', (e) => { current().grade = e.target.value; saveDb(); });

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
  $('#hintBtn').textContent = `💡 Hint (${quiz.hintsLeft})`;
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
  ctx.strokeStyle = '#23204a';
  ctx.lineWidth = cw * 0.05;
  for (const s of strokes) {
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
  box.textContent = `📖 ${shown}`;
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
  const stars = starsFor(correct, total);
  const same = p.history.filter((h) => h.source === p.source && (p.source !== 'grade' || (h.grade === p.grade && h.difficulty === p.difficulty)));
  const prevBest = same.length ? Math.max(...same.map((h) => h.correct / h.total)) : null;

  bumpDayStreak(p);
  p.stars += stars;
  p.history.push({
    t: Date.now(), source: p.source, grade: p.grade, difficulty: p.difficulty, mode: quiz.mode,
    correct, total, perfect: quiz.results.filter((r) => r.perfect).length,
    hintsUsed: HINTS_PER_QUIZ - quiz.hintsLeft, bestStreak: quiz.bestStreak, stars,
  });
  saveDb();
  quiz.summary = { correct, total, stars, newBest: prevBest !== null && correct / total > prevBest };
}

function showResults() {
  const p = quiz.p;
  const { correct, total, stars, newBest } = quiz.summary;
  const perfect = quiz.results.filter((r) => r.perfect).length;
  const missed = quiz.results.filter((r) => !r.correct);

  $('#resultStars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < stars ? '' : 'dim'}">⭐</span>`).join('');
  $('#resultTitle').textContent = stars === 3 ? `Amazing, ${p.name}!` : stars === 2 ? `Great work, ${p.name}!` : stars === 1 ? `Good effort, ${p.name}!` : `Keep practicing, ${p.name}!`;
  const streak = dayStreak(p);
  $('#resultStats').innerHTML = [
    `✅ <b>${correct}</b> of ${total} correct`,
    `⭐ <b>${perfect}</b> perfect (${quiz.mode === 'write' ? 'no hint' : 'no red letters, no hint'})`,
    quiz.bestStreak >= 2 ? `🔥 Best streak: <b>${quiz.bestStreak}</b> in a row` : '',
    `📅 Practiced <b>${streak}</b> day${streak === 1 ? '' : 's'} in a row`,
    newBest ? '🏆 <b>New personal best!</b>' : '',
  ].filter(Boolean).map((s) => `<li>${s}</li>`).join('');
  $('#resultMissed').innerHTML = missed.length
    ? `<p class="note">Words to practice:</p><div class="chips">${missed.map((r) => `<span class="chip">${esc(r.w)}</span>`).join('')}</div>`
    : '';

  show('results');
  if (stars === 3) confetti();
  else if (stars > 0) chime(true);
}

function confetti() {
  const box = $('#confetti');
  const colors = ['#6c4cf5', '#ff9f1c', '#1fb36b', '#e5484d', '#2bb3ff', '#ffd23f'];
  box.innerHTML = Array.from({ length: 90 }, () => `<i style="left:${Math.random() * 100}%;background:${pick(colors)};animation-duration:${2 + Math.random() * 2}s;animation-delay:${Math.random() * 0.6}s"></i>`).join('');
  setTimeout(() => { box.innerHTML = ''; }, 4800);
}

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
    db = { ...freshDb(), ...data, settings: { ...freshDb().settings, ...data.settings } };
    saveDb();
    $('#backupMsg').textContent = `Restored ${db.profiles.length} players and ${db.lists.length} lists.`;
  } catch (err) {
    $('#backupMsg').textContent = 'That file is not a spelling backup.';
  }
});

// ---------- nav + boot ----------

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

show('home');
