# SpellIt!

A spelling practice app for kids (and grown-ups). It says a word out loud and you type it. Each letter turns
green or red as you type it.

- **Grades 1–8 plus Adult**, each with Easy / Medium / Hard word lists ([words.js](words.js)).
- **Three clues:** the word, the word in a sentence, and what the word means (with the word
  itself blanked out). Built-in meanings are in [defs.js](defs.js). Words without one are looked up at
  [dictionaryapi.dev](https://dictionaryapi.dev/).
- **Quizzes are 10 words** with one hint each. Missed words come back in a practice round at the
  end, which keeps going round until each one is right (or the speller taps Stop practice).
- **Typing or handwriting.** In handwriting mode the speller checks their own letters; pens unlocked
  in the shop can be switched right on the writing screen.
- **Players** each get their own stars, day streak, and missed-words list, and see how many words
  of their level and grade they've learned (last try right).
- **Parent mode** (optional PIN) shows everyone's progress and lets you add your own word lists,
  like the weekly list from school, either as a list of their own or straight into a grade level
  (say, 2nd grade Easy) alongside the built-in words. It also shows the handwriting behind each word a speller marked
  themselves (flagging blank or extra letters, with an "It was wrong" button), and lets you give or
  take away stars. You can also pick the voice and its speed and back up your data.

No accounts. Progress is saved in the browser (`localStorage`), and **Family sync** (a family PIN)
shares it between the family's devices. **Parent mode → Settings → Backup** saves it to a file.

## How stars work

**1. The score.** Each quiz is scored on the first try at each word. A word you got with a hint
still counts as right; "Show me" counts as wrong. The practice round at the end doesn't change the
score.

| Score (of 10)  | Stars |
| -------------- | ----- |
| 9 or 10 (90%+) | 3     |
| 7 or 8 (70%+)  | 2     |
| 5 or 6 (50%+)  | 1     |
| 4 or fewer     | 0     |

**2. The limits.** Easy or repeated quizzes have a lower top score. You get the stars from your
score, but no more than the lowest of these three limits:

- **Your school grade.** A parent sets each player's real grade (Parent mode → Players). Grade
  words below it pay less:
  - 1 grade below: up to 2 stars
  - 2 grades below: up to 1 star
  - 3 or more grades below: no stars (a 6th grader on 1st grade words)
  - Your grade or above: up to 3 stars

  You can still practice any grade. This limit only changes the stars.
- **Levels you've mastered.** There are 3 levels in each grade: Easy, Medium and Hard. You master
  one by scoring 90% or more on it twice. Your highest mastered level pays up to 2 stars, and the
  2 levels just below it up to 1. Anything 3 or more levels below it pays nothing. A level above it
  pays the full 3.

  For example, if you've mastered 2nd grade Medium:

  | Level                     | Up to   |
  | ------------------------- | ------- |
  | 2nd Hard and up           | 3 stars |
  | 2nd Medium                | 2 stars |
  | 2nd Easy, 1st Hard        | 1 star  |
  | 1st Medium and below      | none    |

- **The same quiz again today.** The same quiz means the same grade and level, or the same word
  list. Each time you do it again on the same day, the top score drops by a star:
  - 1st time today: up to 3 stars
  - 2nd time: up to 2
  - 3rd time: up to 1
  - 4th time on: none until tomorrow

  Practicing your missed words doesn't count: those words are different each time.

Word lists from Parent mode only have the same-day limit, and missed-word practice has no limits.
When a limit lowers your stars, the start screen and the results say which one did, and what to
try for 3 stars.

**3. Other stars.** A parent can give or take away stars in Parent mode → Players. The drawing
break gives no stars.

The code is in [app.js](app.js): `starsFor` (the score), `schoolCap`, `starCap` (mastery),
`repeatCap` and `starLimit`.

## Run it

Open `index.html` in a browser. That's it.

**Voices.** A device joined to Family sync gets the natural ★ voices: neural text to speech
(Deepgram Aura-2 on Cloudflare Workers AI) through the sync Worker. Each clip is made once and kept,
and new clips stop for the day inside Workers AI's free allowance, so it costs nothing. Each night,
what's left of the allowance makes clips ahead: the family's own lists first, then the built-in words. Without sync,
offline, or once the day's new clips are used up, it uses the browser's own voices, which depend on
the device. Pick a voice in Parent mode → Settings.

## Publish on GitHub Pages

Repo **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**. The site appears at
`https://nosv1.github.io/claude-spells/`.

## Test

```bash
bash test/run.sh
```

Runs a scripted quiz in headless Edge and prints PASS/FAIL lines. Set `BROWSER=` to use another
Chromium browser.

## Adding built-in words

Add `['word', 'A sentence that uses the word.']` to the right grade and difficulty in
[words.js](words.js). The sentence must use the word exactly. Its meaning in [defs.js](defs.js)
shouldn't use the word, because the word shows as a blank there.
