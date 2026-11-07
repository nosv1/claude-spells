// Scripted run-through, loaded by test/smoke.html in a headless browser.
// Writes PASS/FAIL lines into <pre id="out"> for --dump-dom to read.
(function () {
  const out = [];
  const check = (name, ok) => out.push(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  const type = (text) => {
    input.value = text;
    input.dispatchEvent(new Event('input'));
  };
  const enter = () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

  try {
    localStorage.removeItem(STORE_KEY);
    db = loadDb();
    window.confirm = () => true;
    window.alert = () => {};

    check('version shown on home', $('#screen-home .app-version').textContent === `Version ${APP_VERSION}`);
    check('version compare', newerVersion('2026.11.04.2', '2026.11.04.1') && newerVersion('2026.11.05.1', '2026.11.04.9')
      && !newerVersion('2026.11.04.1', '2026.11.04.1') && !newerVersion('2026.11.04.1', '2026.11.04.10'));
    check('no update banner from disk', $('#updateBtn').hidden);
    const oldSave = { profiles: [{ name: 'A', stars: 40, theme: 'space', pen: 'rainbow', history: [{ correct: 9 }] }], settings: {} };
    const reset = fromSaved(oldSave).profiles[0];
    check('old saves get stars reset once', reset.stars === 0 && reset.theme === 'classic' && reset.pen === 'ink' && reset.font === 'classic' && reset.history.length === 1);
    const kept = fromSaved({ ...oldSave, starsEpoch: STARS_EPOCH, profiles: [{ ...oldSave.profiles[0], stars: 40 }] }).profiles[0];
    check('saves after the reset keep their stars', kept.stars === 40 && kept.theme === 'space');
    check('fresh data needs no reset', freshDb().starsEpoch === STARS_EPOCH);
    check('old saves: family voice back to automatic once', fromSaved({ settings: { voiceURI: 'x' } }).settings.voiceURI === ''
      && fromSaved({ settings: { voiceURI: 'x', naturalVoices: true } }).settings.voiceURI === 'x');

    db.profiles.push(newProfile('Tester', '🦊', '2'));
    currentId = db.profiles[0].id;
    show('setup');
    check('setup renders grade', $('#gradeSelect').value === '2');
    check('voice styles shown, happy by default', $('#styleSeg').children.length === VOICE_STYLES.length
      && $('#styleSeg .active').dataset.style === 'happy');
    $('#styleSeg [data-style="squeaky"]').click();
    check('picking a style saves it', current().voiceStyle === 'squeaky' && $('#styleSeg .active').dataset.style === 'squeaky');
    if ('speechSynthesis' in window) check('style sets the pitch', say.last && Math.abs(say.last.pitch - 1.9) < 0.01);
    say('test', null);
    check('family voice ignores player style', say.last.pitch === 1);
    current().voiceStyle = 'happy';

    startQuiz();
    check('quiz has 10 words', quiz.items.length === 10);
    check('easy shows letter slots', $('#tiles').children.length === quiz.word.target.length);

    // Word 1: wrong letter, then fixed -> correct but not perfect.
    const t1 = quiz.word.target;
    type('z');
    check('wrong letter is red', $('#tiles .tile.bad') !== null);
    type(t1);
    check('fixed word completes', quiz.word.done && quiz.results[0].correct && !quiz.results[0].perfect);
    quiz.word.doneAt = 0;
    enter();
    check('enter advances', quiz.i === 1);

    // Word 2: perfect.
    type(quiz.word.target);
    check('perfect word', quiz.results[1].perfect);
    check('right word bursts confetti', $('#confetti').children.length === 40);
    next();

    // Word 3: hint, then finish.
    $('#hintBtn').click();
    check('hint fills first letter', input.value === quiz.word.target[0] && quiz.hintsLeft === 0);
    check('hint button disabled after 1', $('#hintBtn').disabled);
    type(quiz.word.target);
    check('hinted word not perfect', quiz.results[2].correct && !quiz.results[2].perfect);
    next();

    // Word 4: give up.
    const missedWord = quiz.word.target;
    $('#giveUpBtn').click();
    check('give up reveals word', $('#tiles').textContent === missedWord);
    next();

    check('no fill-the-blank clue', !$('#blankBtn') && !$('#blankText'));

    check('every built-in word has a meaning', Object.values(WORDS).every((g) => Object.values(g).every((l) => l.every(([w]) => DEFS[w.toLowerCase()]))));
    const bankProblems = [];
    for (const [g, levels] of Object.entries(WORDS)) {
      const inGrade = new Set();
      for (const list of Object.values(levels)) {
        for (const [w, s] of list) {
          const lw = w.toLowerCase();
          if (inGrade.has(lw)) bankProblems.push(`${g}: ${w} twice`);
          inGrade.add(lw);
          if (blankOut(s, w, '') === s) bankProblems.push(`${w}: sentence lacks it`);
          if ((DEFS[lw] || '').toLowerCase().includes(lw)) bankProblems.push(`${w}: meaning uses it`);
        }
      }
    }
    check(`built-in words: sentences use them, meanings don't show them${bankProblems.length ? ` (${bankProblems.join('; ')})` : ''}`, !bankProblems.length);
    check('2nd, 6th and Adult have 60 words a level', ['2', '6', 'adult'].every((g) => Object.values(WORDS[g]).every((l) => l.length === 60)));
    check('every grade has at least 40 words a level', Object.values(WORDS).every((g) => Object.values(g).every((l) => l.length >= 40)));

    // Rest correct.
    while (!quiz.reviewing && quiz.i < quiz.items.length) {
      if (!quiz.word.done) type(quiz.word.target);
      next();
    }
    check('review round starts with missed word', quiz.reviewing && quiz.word.target === missedWord);
    check('drawing break earned at halfway (4 of 5), still there in practice', quiz.drawBreak === 'earned' && !$('#drawBreakBtn').hidden);
    const fq = (rights, n = 10) => ({ items: Array(n), results: rights.map((c) => ({ correct: !!c })), reviewing: false });
    check('drawing break rule: 3 of 5, only at halfway, not on tiny lists', drawBreakEarned(fq([1, 1, 0, 1, 1])) && drawBreakEarned(fq([1, 0, 0, 1, 1]))
      && !drawBreakEarned(fq([1, 0, 0, 1, 0])) && !drawBreakEarned(fq([1, 1, 1, 1])) && !drawBreakEarned(fq([1, 1, 1, 1, 1, 1]))
      && !drawBreakEarned(fq([1, 1], 3)) && drawBreakEarned(fq([1, 1], 4)) && !drawBreakEarned({ ...fq([1, 1, 1, 1, 1]), drawBreak: 'used' }));
    check('history saved', db.profiles[0].history.length === 1 && db.profiles[0].history[0].correct === 9);
    type(missedWord);
    next();
    check('results shown', !$('#screen-results').hidden);
    check('2 stars for 9/10? (3 stars)', db.profiles[0].history[0].stars === 3);
    check('day streak 1', dayStreak(db.profiles[0]) === 1);
    check('missed word cleared after review', missedWords(db.profiles[0]).length === 0);

    // Practice keeps going round until every missed word is right.
    startQuiz();
    const [m1, m2] = [quiz.items[0].w, quiz.items[1].w];
    $('#giveUpBtn').click(); next();
    $('#giveUpBtn').click(); next();
    while (!quiz.reviewing) { type(quiz.word.target); next(); }
    check('practice: both missed words', quiz.missed.length === 2 && currentItem().w === m1);
    check('3 of the first 5 earns the drawing break', quiz.drawBreak === 'earned' && !$('#drawBreakBtn').hidden);
    $('#giveUpBtn').click(); next();
    type(quiz.word.target); next();
    check('practice: a word still wrong comes round again', $('#screen-results').hidden && quiz.reviewing
      && quiz.missed.length === 1 && currentItem().w === m1 && $('#reviewText').textContent.includes('1 more'));
    type(quiz.word.target); next();
    check('practice: ends once all are right', !$('#screen-results').hidden && m2);
    startQuiz();
    $('#giveUpBtn').click(); next();
    while (!quiz.reviewing) { type(quiz.word.target); next(); }
    $('#skipReviewBtn').click();
    check('practice: Stop practice ends it', !$('#screen-results').hidden && $('#skipReviewBtn').textContent === 'Stop practice');

    // Shop.
    const sp = db.profiles[0];
    show('shop');
    check('shop lists themes and pens', $('#themeGrid').children.length === THEMES.length && $('#penGrid').children.length === PENS.length);
    $('#themeGrid [data-id="ocean"]').click();
    check('locked theme cannot be picked', sp.theme === 'classic' && $('#themeGrid [data-id="ocean"]').classList.contains('locked'));
    const starsWere = sp.stars;
    sp.stars = 12;
    renderShop();
    $('#themeGrid [data-id="ocean"]').click();
    check('unlocked theme picked and worn', sp.theme === 'ocean' && document.documentElement.dataset.theme === 'ocean');
    check('shop lists name styles, cursive free', $('#fontGrid').children.length === FONTS.length
      && !$('#fontGrid [data-id="fancy"]').classList.contains('locked'));
    $('#fontGrid [data-id="fancy"]').click();
    check('name style picked and shown', sp.font === 'fancy' && $('#fontGrid .using').dataset.id === 'fancy'
      && nameHtml(sp).includes('Dancing Script'));
    $('#penGrid [data-id="grape"]').click();
    check('unlocked pen picked', sp.pen === 'grape' && $('#penGrid .using').dataset.id === 'grape');
    show('home');
    check('home stays classic', document.documentElement.dataset.theme === 'classic');
    show('setup');
    check('setup wears the theme', document.documentElement.dataset.theme === 'ocean');
    Object.assign(sp, { stars: starsWere, theme: 'classic', pen: 'ink', font: 'classic' });

    // Change buddy.
    show('setup');
    $('#setupHeader .avatar-btn').click();
    check('buddy picker opens on the current one', $('#avatarDialog').open && $('#avatarPicker2 input:checked').value === sp.avatar);
    $('#avatarPicker2 input[value="👧"]').checked = true;
    $('#avatarDialog').close('ok');
    $('#avatarDialog').dispatchEvent(new Event('close')); // the real one comes later, as a task
    check('buddy changed', sp.avatar === '👧' && $('#setupHeader .avatar-btn').textContent === '👧');

    // Fair stars: levels well under the best one mastered pay less.
    const fp = newProfile('Farmer', '🧒', '2');
    const win = (grade, difficulty) => ({ t: 1, source: 'grade', grade, difficulty, correct: 10, total: 10, stars: 3 });
    check('nothing mastered: full stars', masteredLevel(fp) === -1 && starCap(fp, 'grade', '1', 'easy') === 3);
    fp.history.push(win('1', 'easy'));
    check('one win is not mastery', masteredLevel(fp) === -1);
    fp.history.push(win('1', 'easy'));
    check('two wins master a level', masteredLevel(fp) === 0 && starCap(fp, 'grade', '1', 'easy') === 2
      && starCap(fp, 'grade', '1', 'medium') === 3);
    fp.history.push(win('2', 'medium'), win('2', 'medium'));
    check('a grade under pays nothing, just under pays 1', starCap(fp, 'grade', '1', 'easy') === 0
      && starCap(fp, 'grade', '1', 'hard') === 1 && starCap(fp, 'grade', '2', 'easy') === 1 && starCap(fp, 'grade', '2', 'hard') === 3);
    check('word lists always pay', starCap(fp, 'list:x', '1', 'easy') === 3);
    Object.assign(fp, { source: 'grade', grade: '1', difficulty: 'easy', schoolGrade: '' });
    check('note points to the next level', starLimit(fp).cap === 0 && starLimit(fp).note.includes('2nd grade Hard'));
    Object.assign(fp, { source: 'grade', grade: '1', difficulty: 'easy' });
    const quizWas = quiz;
    quiz = { p: fp, mode: 'type', hintsLeft: 1, bestStreak: 10, results: Array.from({ length: 10 }, () => ({ correct: true, perfect: true })) };
    saveQuizResult();
    check('farming a mastered level earns nothing', quiz.summary.stars === 0 && fp.stars === 0 && quiz.summary.capNote !== '');
    Object.assign(fp, { grade: '2', difficulty: 'hard' });
    saveQuizResult();
    check('a new level pays 3', quiz.summary.stars === 3 && fp.stars === 3 && !quiz.summary.mastered);
    saveQuizResult();
    check('second win masters it', quiz.summary.mastered === '2nd grade Hard' && masteredLevel(fp) === 5);

    // School grade: grade words under the player's real grade pay less, mastered or not.
    const sg = newProfile('Sixth', '🧒', '6');
    check('new players get a school grade', sg.schoolGrade === '6');
    check('school grade: same or above 3, a grade under 2, two under 1, three or more none',
      ['6', '7', 'adult', '5', '4', '3', '1'].map((g) => schoolCap(sg, 'grade', g)).join('') === '3332100');
    check('school grade: lists pay, not set means no limit', schoolCap(sg, 'list:x', '1') === 3
      && schoolCap({ ...sg, schoolGrade: undefined }, 'grade', '1') === 3);
    Object.assign(sg, { source: 'grade', grade: '1', difficulty: 'easy' });
    quiz = { p: sg, mode: 'type', hintsLeft: 1, bestStreak: 10, results: Array.from({ length: 10 }, () => ({ correct: true, perfect: true })) };
    saveQuizResult();
    check('a 6th grader acing 1st grade gets no stars, and is told why', quiz.summary.stars === 0
      && quiz.summary.capNote.includes('5 grades below') && quiz.summary.capNote.includes('6th grade'));

    // The same quiz again today pays a star less each time; another level pays 3 again.
    Object.assign(sg, { grade: '6', difficulty: 'medium' });
    const got = [];
    for (let i = 0; i < 4; i++) { saveQuizResult(); got.push(quiz.summary.stars); }
    check('same quiz today: 3, 2, 1, then none', got.join('') === '3210' && quiz.summary.capNote.includes('3 times today'));
    sg.difficulty = 'hard';
    saveQuizResult();
    check('different words pay 3 again', quiz.summary.stars === 3);
    sg.history.push(...Array.from({ length: 3 }, () => ({ t: Date.now() - 864e5 * 2, source: 'grade', grade: '6', difficulty: 'easy', correct: 5, total: 10 })));
    sg.difficulty = 'easy';
    check('quizzes on other days do not count', repeatCap(sg) === 3);
    sg.source = 'missed';
    sg.history.push(...Array.from({ length: 4 }, () => ({ t: Date.now(), source: 'missed', correct: 5, total: 10 })));
    check('missed-word practice always pays', repeatCap(sg) === 3 && starLimit(sg).cap === 3);
    quiz = quizWas;

    // Custom list.
    show('parent');
    activeTab = 'lists';
    renderParent();
    $('#listName').value = 'Week 9';
    $('#listWords').value = 'friend | My friend sat with me. | Someone you like.\nlaugh\nbad | no match here\nzorp | | A zorp is a made-up word.';
    $('#saveListBtn').click();
    check('list saved', db.lists.length === 1 && db.lists[0].words.length === 4);
    check('list keeps meaning', db.lists[0].words[0].d === 'Someone you like.' && db.lists[0].words[3].s === '');
    check('list warning shown', $('#listWarn').textContent.includes('"bad"'));
    check('meaning-uses-word warning', $('#listWarn').textContent.includes('zorp'));
    $('#listsView [data-edit]').click();
    check('editor round-trips meaning', $('#listWords').value.split('\n')[3] === 'zorp |  | A zorp is a made-up word.');
    resetListEditor();
    db.profiles[0].source = `list:${db.lists[0].id}`;
    startQuiz();
    check('list quiz uses list words', quiz.items.length === 4);
    const noSentence = quiz.items.find((x) => x.w === 'laugh');
    while (currentItem() !== noSentence) { type(quiz.word.target); next(); }
    check('sentence buttons off without sentence', $('#saySentenceBtn').disabled);

    // Words added straight to a grade level.
    quiz = null;
    show('parent');
    activeTab = 'lists';
    renderParent();
    check('lists can go to any grade level', $('#listPlace').options.length === 1 + GRADES.length * 3);
    $('#listPlace').value = '2|easy';
    $('#listPlace').dispatchEvent(new Event('change'));
    const builtIn = WORDS['2'].easy[0][0];
    $('#listWords').value = `zebra | The zebra ran fast.\n${builtIn}`;
    $('#saveListBtn').click();
    const gl = db.lists.find((l) => l.grade === '2');
    check('grade words saved without a name', gl && gl.difficulty === 'easy' && gl.name === 'Extra 2nd grade Easy words'
      && $('#listWarn').textContent.includes(`Already built in to 2nd grade Easy: ${builtIn}`));
    const g2 = gradeWords('2', 'easy');
    check('grade level has the added word, no duplicate', g2.length === WORDS['2'].easy.length + 1 && g2.some((x) => x.w === 'zebra')
      && g2.find((x) => x.w === builtIn).s === WORDS['2'].easy[0][1]);
    const gp = db.profiles[0];
    Object.assign(gp, { source: 'grade', grade: '2', difficulty: 'easy' });
    currentId = gp.id;
    show('setup');
    check('grade words stay out of the Words menu', ![...$('#sourceSelect').options].some((o) => o.value === `list:${gl.id}`)
      && poolFor(gp).some((x) => x.w === 'zebra') && $('#learned .learned-head b').textContent.endsWith(`of ${WORDS['2'].easy.length + 1}`));
    show('parent');
    $(`#listsView [data-edit="${gl.id}"]`).click();
    check('editing keeps the grade', $('#listPlace').value === '2|easy');
    $('#listPlace').value = '';
    $('#listName').value = 'Zoo words';
    $('#saveListBtn').click();
    check('moved back to its own list', !gl.grade && !gl.difficulty && !gradeWords('2', 'easy').some((x) => x.w === 'zebra'));
    db.lists = db.lists.filter((l) => l !== gl);
    gp.source = `list:${db.lists[0].id}`;

    renderProgress();
    check('progress renders', $('#tab-progress').textContent.includes('Tester'));
    check('saved to storage', JSON.parse(localStorage.getItem(STORE_KEY)).profiles.length === 1);
  } catch (e) {
    out.push(`FAIL exception: ${e.message}\n${e.stack}`);
  }

  // Meaning lookups are async: custom, built-in, then online (fetch stubbed).
  (async () => {
    try {
      window.fetch = async () => ({ ok: true, json: async () => [{ meanings: [{ definitions: [{ definition: 'A bad zorp thing.' }] }] }] });
      check('custom meaning wins', (await meaningFor({ w: 'friend', d: 'Someone you like.' })) === 'Someone you like.');
      check('built-in meaning', (await meaningFor({ w: 'Wednesday' })) === DEFS.wednesday);
      check('online fallback', (await meaningFor({ w: 'blorptastic' })) === 'A bad zorp thing.');

      startQuiz();
      quiz.items[quiz.i] = { w: 'zorp', s: '', d: 'A zorp is a made-up word.' };
      loadWord();
      $('#meaningBtn').click();
      await new Promise((r) => setTimeout(r, 50));
      check('meaning shown with word blanked', $('#meaningText').textContent === 'A _____ is a made-up word.');

      // Handwriting mode: draw on the pad, the strip keeps one box per letter.
      const draw = () => {
        const r = pad.getBoundingClientRect();
        const at = (type, fx, fy) => pad.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, clientX: r.left + r.width * fx, clientY: r.top + r.height * fy }));
        at('pointerdown', 0.3, 0.3); at('pointermove', 0.5, 0.6); at('pointerup', 0.5, 0.6);
      };
      const p = db.profiles[0];
      p.source = 'grade';
      p.inputMode = 'write';
      p.difficulty = 'medium';
      show('setup');
      check('mode toggle shows handwriting', $('#modeSeg .active').dataset.mode === 'write');
      startQuiz();
      quiz.items[0] = { w: 'cat', s: 'The cat sat.' };
      loadWord();
      const W = () => quiz.word;
      check('write area shown, typing hidden', !$('#writeArea').hidden && $('#typeArea').hidden);
      check('keyboard not focused', document.activeElement !== input);
      check('pad is big', pad.getBoundingClientRect().width >= Math.min(300, innerHeight / 2 - 1));
      check('medium starts with 1 box', W().boxes.length === 1);
      check('nothing written: check is off', $('#nextLetterBtn').disabled && $('#nextLetterBtn').textContent === 'Check ✓');
      draw();
      check('after writing, button says next', W().boxes[0].strokes.length === 1 && !$('#nextLetterBtn').disabled && $('#nextLetterBtn').textContent === 'Next →');
      $('#undoBtn').click();
      check('undo removes stroke', W().boxes[0].strokes.length === 0);
      checkWriting();
      check('check needs ink', !W().checked);
      draw();
      $('#nextLetterBtn').click();
      check('next letter adds and selects box 2', W().boxes.length === 2 && W().active === 1 && W().boxes[1].wrap.classList.contains('active'));
      draw();
      $('#clearBtn').click();
      check('clear empties only current letter', W().boxes[1].strokes.length === 0 && W().boxes[0].strokes.length === 1);
      draw();
      W().boxes[0].wrap.click();
      check('tap box to go back', W().active === 0);
      W().boxes[1].wrap.click();
      $('#nextLetterBtn').click();
      $('#hintBtn').click();
      check('hint ghosts letter in current box', W().boxes[2].ghost === 't' && W().hinted);
      check('empty box after last letter: next becomes check', $('#nextLetterBtn').textContent === 'Check ✓' && !$('#nextLetterBtn').disabled);
      $('#nextLetterBtn').click();
      check('check reveals letters', W().checked && [...document.querySelectorAll('#writeBoxes .answer')].map((x) => x.textContent).join('') === 'cat');
      check('unwritten box dashed', W().boxes[2].wrap.classList.contains('missing'));
      check('self-mark buttons shown', !$('#markRightBtn').hidden && !$('#markWrongBtn').hidden );
      $('#markRightBtn').click();
      check('marked right, not perfect (hint)', quiz.results[0].correct && !quiz.results[0].perfect && !$('#nextBtn').hidden);
      next();
      $('#giveUpBtn').click();
      check('show me in write mode reveals', W().checked && !quiz.results[1].correct);
      next();
      draw();
      checkWriting();
      $('#markWrongBtn').click();
      check('marked wrong goes to missed', quiz.missed.length === 2);

      p.difficulty = 'easy';
      startQuiz();
      quiz.items[0] = { w: 'dog', s: '' };
      loadWord();
      check('easy shows a box per letter', W().boxes.length === 3);
      check('easy: first box says next', $('#nextLetterBtn').textContent === 'Next →');
      W().boxes[2].wrap.click();
      check('easy: last box says check, off until written', $('#nextLetterBtn').textContent === 'Check ✓' && $('#nextLetterBtn').disabled);
      draw();
      check('easy: check on after writing', !$('#nextLetterBtn').disabled);
      $('#nextLetterBtn').click();
      check('easy: check button checks', W().checked);

      // Pens on the writing screen: unlocked ones switch, locked ones don't.
      startQuiz();
      check('pen row shows every pen', $('#penRow').children.length === PENS.length && $('#penRow .using').dataset.pen === 'ink');
      p.stars = 6;
      $('#penRow [data-pen="sky"]').click();
      check('locked pen stays locked', p.pen === 'ink' && $('#feedback').textContent.includes('15 stars'));
      renderPenRow();
      $('#penRow [data-pen="grape"]').click();
      check('unlocked pen picked from the pad', p.pen === 'grape' && $('#penRow .using').dataset.pen === 'grape');
      p.pen = 'ink';

      // Handwriting check: self-marked words are kept, packed small, for Parent mode.
      const pts = [[0.1, 0.1], [0.11, 0.1], [0.5, 0.5], [0.9, 0.95]];
      const back = unpackStrokes(packStrokes([pts, [[0.3, 0.3]]]));
      check('strokes pack and unpack', back.length === 2 && back[0].length === 3 && back[1].length === 1
        && Math.abs(back[0][2][0] - 0.9) < 0.02 && Math.abs(back[0][0][1] - 0.1) < 0.02);
      const kept = p.writing || [];
      check('self-marked words kept, give-ups not', kept.length === 2 && kept[0].w === 'cat' && kept[0].said && !kept[1].said
        && kept[0].boxes.length === 3 && kept[0].hint);
      check('marked right with a blank letter is flagged', writingFlag(kept[0]) && !writingFlag(kept[1]));
      p.words.cat.last = true;
      quiz = null;
      show('parent');
      activeTab = 'progress';
      renderParent();
      check('progress shows the handwriting, flagged ones open', $('#tab-progress .hw-review[open]') !== null
        && $('#tab-progress .hw-item.flagged') !== null && $('#tab-progress canvas[data-hw]').width > 1);
      $('#tab-progress [data-hw-wrong]').click();
      check('"It was wrong" puts the word on the practice list', kept[0].fixed && p.words.cat.last === false
        && missedWords(p).some((x) => x.w === 'cat') && !$('#tab-progress [data-hw-wrong]'));
      check('progress shows words learned', $('#tab-progress').textContent.includes('words learned'));

      // Words learned on the start screen.
      currentId = p.id;
      Object.assign(p, { source: 'grade', grade: '2', difficulty: 'easy' });
      const easy2 = WORDS['2'].easy;
      p.words = {};
      recordWord(p, { w: easy2[0][0] }, true);
      recordWord(p, { w: easy2[1][0] }, false);
      recordWord(p, { w: WORDS['2'].hard[0][0] }, true);
      show('setup');
      check('start screen: words learned at this level and grade', $('#learned .learned-head b').textContent === `1 of ${easy2.length}`
        && $('#learned').textContent.includes(`All of 2nd grade: 2 of ${DIFFS.reduce((n, d) => n + WORDS['2'][d].length, 0)}`));

      // Stars from a parent.
      show('parent');
      activeTab = 'players';
      renderParent();
      p.stars = 3;
      const card = () => $(`#tab-players [data-player="${p.id}"]`);
      card().querySelector('[data-stars]').value = '5';
      card().querySelector('[data-act="stars"]').click();
      check('parent gives stars', p.stars === 8 && p.bonus.at(-1).stars === 5 && card().textContent.includes('Gave'));
      card().querySelector('[data-stars]').value = '2';
      card().querySelector('[data-act="take"]').click();
      check('Take away takes stars', p.stars === 6 && p.bonus.at(-1).stars === -2 && card().textContent.includes('Took away 2 stars'));
      card().querySelector('[data-stars]').value = '20';
      card().querySelector('[data-act="take"]').click();
      check('taking stars stops at 0', p.stars === 0 && p.bonus.at(-1).stars === -6);
      const m = mergeProfiles({ stars: 2, history: [], bonus: [{ t: 1, stars: 2 }] }, { stars: 7, history: [], bonus: [{ t: 1, stars: 2 }, { t: 2, stars: 5 }] });
      check('sync merge keeps stars given on the other device', m.stars === 7 && m.bonus.length === 2);

      // Family sync, against a stand-in for the Worker (same rules: PIN, newest wins, cursor).
      const fake = { pin: '2468', seq: 0, rows: new Map() };
      const put = (c) => {
        const k = `${c.kind}:${c.id}`;
        const cur = fake.rows.get(k);
        if (cur && !(c.updated > cur.updated)) return false;
        fake.rows.set(k, { ...c, data: c.deleted ? null : c.data, deleted: !!c.deleted, seq: ++fake.seq });
        return true;
      };
      window.fetch = async (url, opts) => {
        const body = JSON.parse(opts.body);
        if (opts.headers['X-Family-Pin'] !== fake.pin) return { ok: false, status: 401, json: async () => ({}) };
        const lost = body.changes.filter((c) => !put(c));
        const page = [...fake.rows.values()].filter((r) => r.seq > body.since).sort((a, b) => a.seq - b.seq);
        const winners = lost.map((c) => fake.rows.get(`${c.kind}:${c.id}`)).filter((r) => !page.includes(r));
        return { ok: true, status: 200, json: async () => ({ cursor: page.length ? page[page.length - 1].seq : body.since, more: false, records: [...page, ...winners] }) };
      };
      const otherDevice = (prof, updated) => put({ kind: 'profile', id: prof.id, data: JSON.stringify(prof), updated });
      const onServer = (id) => JSON.parse(fake.rows.get(`profile:${id}`).data);

      db = freshDb();
      syncDisconnect();
      const fam = newProfile('Hailee', '👧', '2');
      fam.history = [1, 2, 3].map((t) => ({ t, correct: 9, total: 10, stars: 3 }));
      otherDevice(fam, 1000);
      const twin = newProfile('hailee', '🦄', '2');
      twin.history = [{ t: 50, correct: 5, total: 10, stars: 1 }];
      const liam = newProfile('Liam', '🦖', '6');
      db.profiles.push(twin, liam);
      let pinErr = '';
      try { await syncConnect('0000'); } catch (e) { pinErr = e.message; }
      check('wrong family PIN refused', /not right/.test(pinErr) && !syncState.pin);
      await syncConnect('2468');
      check('join: family player comes in, same-name twin folded in', db.profiles.length === 2
        && db.profiles.some((x) => x.id === fam.id && x.history.length === 3) && !db.profiles.some((x) => x.id === twin.id));
      check("join: this device's own player goes up", fake.rows.has(`profile:${liam.id}`));
      const hp = db.profiles.find((x) => x.id === fam.id);
      hp.stars += 3;
      hp.history.push({ t: 100, correct: 10, total: 10, stars: 3 });
      saveDb();
      await syncNow();
      check('a change here reaches the family', onServer(fam.id).history.length === 4);
      const s1 = onServer(fam.id);
      otherDevice({ ...s1, history: [...s1.history, { t: 200, correct: 8, total: 10, stars: 2 }], stars: s1.stars + 2 }, Date.now() + 1000);
      await syncNow();
      check('a change elsewhere arrives, in the same object', db.profiles.find((x) => x.id === fam.id) === hp && hp.history.length === 5);
      // A quiz here and one elsewhere before they synced, the other one newer: neither is lost.
      hp.history.push({ t: 300, correct: 6, total: 10, stars: 1 });
      hp.stars += 1;
      saveDb();
      const s2 = onServer(fam.id);
      otherDevice({ ...s2, history: [...s2.history, { t: 310, correct: 8, total: 10, stars: 2 }], stars: s2.stars + 2 }, Date.now() + 5000);
      await syncNow();
      await syncNow();
      const s3 = onServer(fam.id);
      check('both quizzes kept, here and there', hp.history.some((x) => x.t === 300) && hp.history.some((x) => x.t === 310)
        && s3.history.length === 7 && s3.stars === hp.stars && hp.stars === s1.stars + 2 + 1 + 2);
      put({ kind: 'profile', id: liam.id, data: null, deleted: true, updated: Date.now() + 9000 });
      await syncNow();
      check('deleted elsewhere, gone here', !db.profiles.some((x) => x.id === liam.id));
      show('parent');
      activeTab = 'settings';
      renderParent();
      check('settings show sync on', !$('#syncOn').hidden && $('#syncStatus').textContent.startsWith('On.'));

      // Natural voices (they come with sync), against a stand-in for /speak.
      const spoken = [];
      window.fetch = async (url, opts) => {
        const { text } = JSON.parse(opts.body);
        spoken.push(text);
        if (text === 'used up') return { ok: false, status: 503 };
        return { ok: true, status: 200, blob: async () => new Blob(['mp3'], { type: 'audio/mpeg' }) };
      };
      const tick = () => new Promise((r) => setTimeout(r, 50));
      voiceEl.play = () => Promise.resolve(); // nothing to hear here
      currentId = hp.id;
      check('settings list natural voices first', $('#voiceSelect').options[0].value === 'natural:thalia' && $('#naturalNote').hidden);
      say('apple', hp);
      await tick();
      check('says it in a natural voice', say.last.voice === 'thalia' && spoken.includes('apple') && Math.abs(say.last.rate - 1.05) < 0.01);
      saySpelled('tie', true);
      await tick();
      check('spelling: one clip per letter, "I" as "Eye."', ['T.', 'Eye.', 'E.'].every((t) => spoken.includes(t))
        && spoken.filter((t) => t === 'tie').length === 1 && say.last.text === 'tie. t, i, e. tie.');
      hp.voiceStyle = 'squeaky';
      const before = spoken.length;
      say('apple', hp);
      check('a kept clip plays straight away, no fetch', say.last.text === 'apple' && spoken.length === before);
      check('squeaky shifts the pitch', Math.abs(say.last.rate - 1.375) < 0.01 && voiceEl.preservesPitch === false);
      hp.voiceStyle = 'happy';
      prefetchSpeech([{ w: 'dog' }], hp);
      await tick();
      check('a quiz fetches its words and letters ahead', ['dog', 'D.', 'O.', 'G.'].every((t) => spoken.includes(t)));
      say('used up', hp);
      await tick();
      check("day's clips used up: device voice", !('speechSynthesis' in window) || say.last instanceof SpeechSynthesisUtterance);
      naturalPausedUntil = 0;

      // Drawing break, with drawings synced through a stand-in for /drawings. Kept in memory here:
      // headless Edge's IndexedDB doesn't answer under --virtual-time-budget (test/drawings-idb.mjs
      // checks IndexedDB in a real-time browser instead).
      openDrawIdb = async () => null;
      const pics = new Map();
      window.fetch = async (url, opts) => {
        const b = JSON.parse(opts.body);
        const ok = (x) => ({ ok: true, status: 200, json: async () => x });
        if (!url.endsWith('/drawings')) return { ok: false, status: 404 };
        if (b.op === 'list') return ok({ drawings: [...pics.values()].filter((d) => d.player === b.player).map(({ id, updated, deleted }) => ({ id, updated, deleted })) });
        if (b.op === 'get') return ok(pics.get(b.id));
        const cur = pics.get(b.id);
        if (cur && !(b.updated > cur.updated)) return ok({ kept: false, updated: cur.updated });
        pics.set(b.id, { id: b.id, player: b.player, image: b.image, updated: b.updated, deleted: b.deleted });
        return ok({ kept: true, updated: b.updated });
      };
      const earnBreak = () => {
        startQuiz();
        for (let i = 0; i < 5; i++) {
          if (i === 2) $('#giveUpBtn').click(); else type(quiz.word.target);
          if (i < 4) next();
        }
      };
      const pe = (kind, x, y) => {
        const r = drawCanvas.getBoundingClientRect();
        drawCanvas.dispatchEvent(new PointerEvent(kind, { clientX: r.left + x * r.width, clientY: r.top + y * r.height, pointerId: 1, bubbles: true }));
      };
      const line = (x1, y1, x2, y2) => { pe('pointerdown', x1, y1); pe('pointermove', x2, y2); pe('pointerup', x2, y2); };
      const px = (x, y) => [...drawCtx.getImageData(x * DRAW_SIZE, y * DRAW_SIZE, 1, 1).data];
      const isRed = ([r, g]) => r > 200 && g < 110;
      const isWhite = ([r, g, b]) => r > 250 && g > 250 && b > 250;
      currentId = hp.id;
      earnBreak();
      $('#drawBreakBtn').click();
      await drawWork;
      check('drawing break: none yet, so straight to a new drawing, clock at 3:00', !$('#screen-draw').hidden && !$('#drawPad').hidden
        && drawing && $('#drawClock').textContent === '3:00' && $('#drawBreakBtn').hidden);
      $('#drawColors [data-color="#e5484d"]').click();
      line(0.2, 0.2, 0.8, 0.8);
      check('drawing: paints in the picked color', isRed(px(0.5, 0.5)) && isWhite(px(0.8, 0.2)));
      $('#drawUndoBtn').click();
      check('drawing: undo takes the stroke off', isWhite(px(0.5, 0.5)) && !drawing.strokes.length);
      line(0.2, 0.2, 0.8, 0.8);
      $('#drawClearBtn').click();
      check('drawing: clear', isWhite(px(0.5, 0.5)));
      $('#drawUndoBtn').click();
      check('drawing: undo brings a clear back', isRed(px(0.5, 0.5)));
      $('#drawEraseBtn').click();
      line(0.5, 0.1, 0.5, 0.9);
      check('drawing: eraser', isWhite(px(0.5, 0.5)) && isRed(px(0.3, 0.3)));
      $('#drawEraseBtn').click();
      drawEndAt = Date.now() + 20e3;
      tickDrawClock();
      check('drawing: 30-second warning', $('#drawClock').classList.contains('warn') && !$('#drawMsg').hidden);
      $('#drawDoneBtn').click();
      await drawWork;
      const firstId = (await drawingsOf(hp.id))[0]?.id;
      check('back to spelling where it left off, no second break', !$('#screen-quiz').hidden && quiz.drawBreak === 'used'
        && quiz.i === 4 && quiz.word.done && $('#drawBreakBtn').hidden);
      check('drawing kept on this device and sent to the family', firstId && pics.get(firstId)?.image.startsWith('data:image/png')
        && !(await getDrawing(firstId)).dirty);
      // One made on another iPad comes in; carrying on with the first one starts from it.
      const otherId = `${hp.id}-other`;
      pics.set(otherId, { id: otherId, player: hp.id, image: pics.get(firstId).image, updated: Date.now() + 1000, deleted: false });
      earnBreak();
      $('#drawBreakBtn').click();
      await drawWork;
      check('second break: the gallery, with the one from the other iPad', !$('#drawPicker').hidden && !drawing
        && $('#drawGallery').querySelectorAll('[data-open]').length === 2 && !!$('#drawGallery [data-new]'));
      $(`#drawGallery [data-open="${firstId}"]`).click();
      await drawWork;
      check('carry on: the saved drawing is back on the pad', drawing?.id === firstId && isRed(px(0.3, 0.3)) && !drawing.locked);
      const before1 = pics.get(firstId).updated;
      line(0.1, 0.95, 0.9, 0.95);
      drawEndAt = Date.now() - 1;
      tickDrawClock();
      check("time's up: it says so and stops drawing", $('#drawMsg').textContent.startsWith('Time') && drawing.locked);
      endDrawBreak(); // what the timer does a moment later
      await drawWork;
      check("time's up: kept with the new stroke, back to spelling", !$('#screen-quiz').hidden
        && pics.get(firstId).updated > before1 && (await drawingsOf(hp.id)).length === 2);
      // Deleting one from the gallery deletes it everywhere.
      earnBreak();
      $('#drawBreakBtn').click();
      await drawWork;
      $(`#drawGallery [data-del="${firstId}"]`).click();
      await drawWork;
      check('deleting a drawing: gone here and from the family', $('#drawGallery').querySelectorAll('[data-open]').length === 1
        && pics.get(firstId).deleted && (await getDrawing(firstId)).deleted);
      $('#drawDoneBtn').click();
      check('leaving from the gallery uses up the break', !$('#screen-quiz').hidden && quiz.drawBreak === 'used');
      quiz = null;
      drawMem.clear();
      syncDisconnect();
      renderParent();
      check('turned off: players stay', !syncState.pin && db.profiles.length === 1 && !$('#syncOff').hidden);
      check('turned off: device voices again', !isNatural(voiceFor(hp)) && !$('#naturalNote').hidden);
      localStorage.removeItem(SYNC_KEY);
    } catch (e) {
      out.push(`FAIL exception: ${e.message}\n${e.stack}`);
    }
    localStorage.removeItem(STORE_KEY);
    document.getElementById('out').textContent = out.join('\n');
  })();
})();
