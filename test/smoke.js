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

    // Blank sentence.
    $('#blankBtn').click();
    check('blank hides word', !$('#blankText').textContent.toLowerCase().includes(quiz.word.target) && $('#blankText').textContent.includes('_____'));

    check('every built-in word has a meaning', Object.values(WORDS).every((g) => Object.values(g).every((l) => l.every(([w]) => DEFS[w.toLowerCase()]))));

    // Rest correct.
    while (!quiz.reviewing && quiz.i < quiz.items.length) {
      if (!quiz.word.done) type(quiz.word.target);
      next();
    }
    check('review round starts with missed word', quiz.reviewing && quiz.word.target === missedWord);
    check('history saved', db.profiles[0].history.length === 1 && db.profiles[0].history[0].correct === 9);
    type(missedWord);
    next();
    check('results shown', !$('#screen-results').hidden);
    check('2 stars for 9/10? (3 stars)', db.profiles[0].history[0].stars === 3);
    check('day streak 1', dayStreak(db.profiles[0]) === 1);
    check('missed word cleared after review', missedWords(db.profiles[0]).length === 0);

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
    $('#penGrid [data-id="grape"]').click();
    check('unlocked pen picked', sp.pen === 'grape' && $('#penGrid .using').dataset.id === 'grape');
    show('home');
    check('home stays classic', document.documentElement.dataset.theme === 'classic');
    show('setup');
    check('setup wears the theme', document.documentElement.dataset.theme === 'ocean');
    Object.assign(sp, { stars: starsWere, theme: 'classic', pen: 'ink' });

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
    check('note points to the next level', starCapNote(fp, 0).includes('2nd grade Hard'));
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
    } catch (e) {
      out.push(`FAIL exception: ${e.message}\n${e.stack}`);
    }
    localStorage.removeItem(STORE_KEY);
    document.getElementById('out').textContent = out.join('\n');
  })();
})();
