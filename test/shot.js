// Seeds demo data and opens a screen for screenshots: shot.html#quiz, #write, #home, #setup, #results,
// #parent, #players, #lists, #break, #draw, #gallery
(function () {
  localStorage.removeItem(STORE_KEY);
  db = loadDb();
  window.alert = () => {};
  const a = newProfile('Liam', '🦖', '2');
  const b = newProfile('Ava', '🦄', '6');
  const c = newProfile('Chris', '🚀', 'adult');
  b.stars = 14; b.day = { last: dateStr(), count: 4 };
  db.profiles.push(a, b, c);
  currentId = a.id;
  const screen = location.hash.slice(1) || 'home';
  if (screen === 'home') show('home');
  if (screen === 'setup') {
    WORDS['2'].easy.slice(0, 14).forEach(([w], i) => recordWord(a, { w }, i % 5 !== 0));
    show('setup');
  }
  if (screen === 'write') {
    a.inputMode = 'write';
    a.stars = 20;
    startQuiz();
    quiz.items[0] = { w: 'cat', s: 'The cat sat.' };
    loadWord();
    quiz.word.boxes[0].strokes.push([[0.7, 0.3], [0.4, 0.3], [0.3, 0.55], [0.4, 0.75], [0.7, 0.75]]);
    selectBox(0);
  }
  if (screen === 'quiz' || screen === 'results') {
    startQuiz();
    quiz.items[0] = { w: 'because', s: 'I wore a coat because it was cold.' };
    loadWord();
    $('#meaningBtn').click();
    input.value = 'becu';
    input.dispatchEvent(new Event('input'));
    if (screen === 'results') {
      while (!quiz.reviewing && quiz.i < quiz.items.length) { if (!quiz.word.done) { input.value = quiz.word.target; input.dispatchEvent(new Event('input')); } next(); }
      showResults();
    }
  }
  // The drawing break: #break (the button on the quiz), #draw (the pad), #gallery (picking one).
  if (screen === 'break' || screen === 'draw' || screen === 'gallery') {
    openDrawIdb = async () => null; // in memory: headless Edge's IndexedDB doesn't answer here
    const doodle = (ctx, n) => {
      const strokes = [
        { color: '#4dabf7', size: 44, pts: [[0, 860], [1024, 860]] },
        { color: '#2b8a3e', size: 44, pts: [[0, 905], [1024, 905], [1024, 1024], [0, 1024]] },
        { color: '#fcc419', size: 20, pts: [[830, 190], [890, 190], [890, 250], [830, 250], [830, 190]] },
        { color: '#e5484d', size: 20, pts: [[300, 840], [300, 560], [560, 400], [820, 560], [820, 840], [300, 840]] },
        { color: '#8d5524', size: 20, pts: [[500, 840], [500, 690], [620, 690], [620, 840]] },
        { color: '#7048e8', size: 8, pts: [[160, 300], [200, 250], [240, 300], [200, 340], [160, 300]] },
      ];
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 1024, 1024);
      drawing = { strokes: strokes.slice(0, n) };
      const was = drawCtx;
      strokes.slice(0, n).forEach((s) => paintStroke(s));
      return was;
    };
    a.stars = 20;
    startQuiz();
    quiz.items[5] = { w: 'friend', s: 'My friend came over.' };
    for (let i = 0; i < 5; i++) { input.value = quiz.word.target; input.dispatchEvent(new Event('input')); next(); }
    if (screen === 'gallery') {
      [6, 4].forEach((n, i) => {
        doodle(drawCtx, n);
        drawMem.set(`g${i}`, { id: `g${i}`, player: a.id, image: drawCanvas.toDataURL(), updated: i, deleted: false });
      });
      drawing = null;
    }
    if (screen !== 'break') {
      $('#drawBreakBtn').click();
      drawWork.then(() => {
        if (screen === 'draw') {
          doodle(drawCtx, 6);
          drawing = { id: 'x', player: a.id, base: null, strokes: drawing.strokes, changed: false };
          drawEndAt = Date.now() + 134e3;
          tickDrawClock();
        }
      });
    }
  }
  if (screen === 'parent' || screen === 'players' || screen === 'lists') {
    for (let i = 0; i < 8; i++) a.history.push({ t: Date.now() - i * 864e5, source: 'grade', grade: '2', difficulty: 'easy', correct: 5 + (i % 4), total: 10, stars: 1 });
    a.words = { because: { w: 'because', wrong: 3, right: 1 }, friend: { w: 'friend', wrong: 2, right: 2 } };
    const c1 = [[0.7, 0.3], [0.4, 0.3], [0.3, 0.55], [0.4, 0.75], [0.7, 0.75]];
    const a1 = [[0.65, 0.45], [0.4, 0.45], [0.35, 0.65], [0.5, 0.78], [0.65, 0.6], [0.65, 0.45], [0.68, 0.78]];
    const t1 = [[0.5, 0.2], [0.5, 0.78]];
    const t2 = [[0.35, 0.4], [0.65, 0.4]];
    const keep = (w, said, boxes, t) => a.writing = [...(a.writing || []), { t, w, said, hint: false, boxes: boxes.map(packStrokes) }];
    keep('cat', true, [[c1], [a1], [t1, t2]], Date.now() - 3e5);
    keep('cats', true, [[c1], [a1], []], Date.now() - 2e5);
    keep('tat', false, [[t1, t2], [a1], [t1, t2]], Date.now() - 1e5);
    db.lists.push({ id: 'g2e', name: 'Extra 2nd grade Easy words', grade: '2', difficulty: 'easy', words: [{ w: 'zebra', s: 'The zebra ran.' }] });
    db.lists.push({ id: 'w9', name: 'Week 9', words: [{ w: 'friend', s: '' }, { w: 'laugh', s: '' }] });
    if (screen !== 'parent') activeTab = screen;
    show('parent');
  }
})();
