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

No server and no accounts. Progress is saved in the browser (`localStorage`), so each device keeps
its own. Use **Parent mode → Settings → Backup** to move it between devices.

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
