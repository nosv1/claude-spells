// The Worker's overnight-fill plan (worker/src/fill.js), checked against the real word bank and
// against the app's own code: a clip only helps if it's for the exact text the app will ask for.
//   node --test test/fill.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseBank, fillOrder, LETTERS } from '../worker/src/fill.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const bankJs = read('words.js');
const appJs = read('app.js');
// The app's functions, taken from app.js as written.
// A function runs to its closing brace at the start of a line; a const to its first ";" at a line end.
const grab = (start) => {
  const at = appJs.indexOf(start);
  assert.ok(at >= 0, `app.js has ${start}`);
  const rest = appJs.slice(at);
  return rest.slice(0, start.startsWith('function') ? rest.search(/\n\}/) + 2 : rest.search(/;\r?\n/) + 1);
};
const appLetterClip = new Function(`${grab('const letterClip =')}; return letterClip;`)();

test('reads every word in the bank', () => {
  const bank = parseBank(bankJs);
  const WORDS = new Function(`${bankJs}; return WORDS;`)();
  const want = Object.entries(WORDS).flatMap(([grade, levels]) => Object.entries(levels)
    .flatMap(([level, list]) => list.map(([w, s]) => ({ grade, level, w, s }))));
  assert.deepEqual(bank, want);
});

test('letters match the app', () => {
  assert.deepEqual(LETTERS, [...'abcdefghijklmnopqrstuvwxyz'].map(appLetterClip));
});

test('order: letters, own lists, players\' levels, their grades, then the rest; no repeats', () => {
  const bank = parseBank(bankJs);
  const order = fillOrder(bank, [{ grade: '6', difficulty: 'hard' }], [{ words: [{ w: 'Thursday', s: 'We swim on Thursday.' }, { w: 'bogus' }] }, { words: 'junk' }]);
  assert.deepEqual(order.slice(0, 26), LETTERS);
  assert.deepEqual(order.slice(26, 29), ['Thursday', 'bogus', 'We swim on Thursday.']);
  const sixHard = bank.find((b) => b.grade === '6' && b.level === 'hard');
  const sixEasy = bank.find((b) => b.grade === '6' && b.level === 'easy');
  const oneEasy = bank.find((b) => b.grade === '1' && b.level === 'easy');
  assert.equal(order[29], sixHard.w, "then the player's own level");
  assert.ok(order.indexOf(sixHard.s) < order.indexOf(sixEasy.w), 'their level before the rest of their grade');
  assert.ok(order.indexOf(sixEasy.w) < order.indexOf(oneEasy.w), 'their grade before other grades');
  assert.equal(new Set(order).size, order.length);
});

test('cheap enough for the Free plan (10 ms of CPU a run)', () => {
  const profiles = [{ grade: '2', difficulty: 'easy' }, { grade: '6', difficulty: 'medium' }, { grade: 'adult', difficulty: 'hard' }];
  fillOrder(parseBank(bankJs), profiles, []); // warm up
  const t = performance.now();
  fillOrder(parseBank(bankJs), profiles, []);
  assert.ok(performance.now() - t < 5, `${(performance.now() - t).toFixed(1)} ms`);
});
