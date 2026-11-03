# SpellIt!

A spelling practice app for kids (and grown-ups). It says a word out loud and you type it. Each letter turns
green or red as you type it.

- **Grades 1–8 plus Adult**, each with Easy / Medium / Hard word lists ([words.js](words.js)).
- **Four clues:** the word, the word in a sentence, the sentence with the word blanked out, and
  what the word means. Built-in meanings are in [defs.js](defs.js). Words without one are looked up at
  [dictionaryapi.dev](https://dictionaryapi.dev/).
- **Quizzes are 10 words** with one hint each. Missed words come back in a practice round at the end.
- **Players** each get their own stars, day streak, and missed-words list.
- **Parent mode** (optional PIN) shows everyone's progress and lets you add your own word lists,
  like the weekly list from school. You can also pick the voice and its speed and back up your data.

No server and no accounts. Progress is saved in the browser (`localStorage`), so each device keeps
its own. Use **Parent mode → Settings → Backup** to move it between devices.

## Run it

Open `index.html` in a browser. That's it.

Speech uses the browser's built-in voices, so quality depends on the device. Safari on iPad/Mac and
Edge on Windows have the most natural ones. Pick a voice in Parent mode → Settings.

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
[words.js](words.js). The sentence must contain the word exactly so it can be blanked out. Avoid
sentences where the word is hiding inside another word ("snow" in "snowman").
