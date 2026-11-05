// Seeds demo data and opens a screen for screenshots: shot.html#quiz, #home, #results, #parent
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
  if (screen === 'setup') show('setup');
  if (screen === 'quiz' || screen === 'results') {
    startQuiz();
    quiz.items[0] = { w: 'because', s: 'I wore a coat because it was cold.' };
    loadWord();
    $('#blankBtn').click();
    $('#meaningBtn').click();
    input.value = 'becu';
    input.dispatchEvent(new Event('input'));
    if (screen === 'results') {
      while (!quiz.reviewing && quiz.i < quiz.items.length) { if (!quiz.word.done) { input.value = quiz.word.target; input.dispatchEvent(new Event('input')); } next(); }
      showResults();
    }
  }
  if (screen === 'parent') {
    for (let i = 0; i < 8; i++) a.history.push({ t: Date.now() - i * 864e5, source: 'grade', grade: '2', difficulty: 'easy', correct: 5 + (i % 4), total: 10, stars: 1 });
    a.words = { because: { w: 'because', wrong: 3, right: 1 }, friend: { w: 'friend', wrong: 2, right: 2 } };
    show('parent');
  }
})();
