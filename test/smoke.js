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

    db.profiles.push(newProfile('Tester', '🦊', '2'));
    currentId = db.profiles[0].id;
    show('setup');
    check('setup renders grade', $('#gradeSelect').value === '2');

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
      check('meaning shown with word blanked', $('#meaningText').textContent === '📖 A _____ is a made-up word.');

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
      check('write area shown, typing hidden', !$('#writeArea').hidden && $('#typeArea').hidden && !$('#checkBtn').hidden);
      check('keyboard not focused', document.activeElement !== input);
      check('pad is big', pad.getBoundingClientRect().width >= Math.min(300, innerHeight / 2 - 1));
      check('medium starts with 1 box', W().boxes.length === 1);
      check('next letter off until written', $('#nextLetterBtn').disabled);
      draw();
      check('stroke goes to active box', W().boxes[0].strokes.length === 1 && !$('#nextLetterBtn').disabled);
      $('#undoBtn').click();
      check('undo removes stroke', W().boxes[0].strokes.length === 0);
      $('#checkBtn').click();
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
      $('#checkBtn').click();
      check('check reveals letters', W().checked && [...document.querySelectorAll('#writeBoxes .answer')].map((x) => x.textContent).join('') === 'cat');
      check('unwritten box dashed', W().boxes[2].wrap.classList.contains('missing'));
      check('self-mark buttons shown', !$('#markRightBtn').hidden && !$('#markWrongBtn').hidden && $('#checkBtn').hidden);
      $('#markRightBtn').click();
      check('marked right, not perfect (hint)', quiz.results[0].correct && !quiz.results[0].perfect && !$('#nextBtn').hidden);
      next();
      $('#giveUpBtn').click();
      check('show me in write mode reveals', W().checked && !quiz.results[1].correct);
      next();
      draw();
      $('#checkBtn').click();
      $('#markWrongBtn').click();
      check('marked wrong goes to missed', quiz.missed.length === 2);

      p.difficulty = 'easy';
      startQuiz();
      quiz.items[0] = { w: 'dog', s: '' };
      loadWord();
      check('easy shows a box per letter', W().boxes.length === 3);
      W().boxes[2].wrap.click();
      check('easy: no next past last letter', $('#nextLetterBtn').disabled);
    } catch (e) {
      out.push(`FAIL exception: ${e.message}\n${e.stack}`);
    }
    localStorage.removeItem(STORE_KEY);
    document.getElementById('out').textContent = out.join('\n');
  })();
})();
