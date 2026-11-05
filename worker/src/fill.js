// The overnight fill's plan: which clips to make, in order. No Worker APIs here, so the tests can
// run it in Node.

export const MAX_TEXT = 600;
export const tidy = (t) => t.replace(/\s+/g, ' ').trim();

// The built-in bank from words.js (WORDS[grade][level] = [[word, sentence], ...]): [{ grade, level, w, s }].
export function parseBank(js) {
  const out = [];
  let grade = '', level = '';
  const entry = /\['((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)'\]/;
  const unescape = (t) => t.replace(/\\(.)/g, '$1');
  for (const line of js.split('\n')) {
    let m;
    if ((m = /^  '?(\w+)'?: \{/.exec(line))) grade = m[1];
    else if ((m = /^    (easy|medium|hard): \[/.exec(line))) level = m[1];
    else if ((m = entry.exec(line))) out.push({ grade, level, w: unescape(m[1]), s: unescape(m[2]) });
  }
  return out;
}

// The app's spelling-out clips (app.js letterClip): the same text gives the same clip, so these
// must match the app.
export const LETTERS = [...'abcdefghijklmnopqrstuvwxyz'].map((c) => (c === 'i' ? 'Eye.' : `${c.toUpperCase()}.`));

// What to make first: the letters, then the family's own lists, then each player's grade and level,
// then the rest of their grades, then the whole bank. In each: words, then sentences.
export function fillOrder(bank, profiles, lists) {
  const groups = [lists.flatMap((l) => (Array.isArray(l.words) ? l.words : [])).filter((x) => typeof x?.w === 'string')];
  for (const p of profiles) groups.push(bank.filter((b) => b.grade === p.grade && b.level === p.difficulty));
  for (const p of profiles) groups.push(bank.filter((b) => b.grade === p.grade));
  groups.push(bank);
  const texts = [...LETTERS];
  for (const g of groups) {
    for (const x of g) texts.push(x.w);
    for (const x of g) if (typeof x.s === 'string') texts.push(x.s);
  }
  return [...new Set(texts.map(tidy))].filter((t) => t && t.length <= MAX_TEXT);
}
