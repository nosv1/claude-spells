# SpellIt! (claude-spells)

A spelling practice web app for Chris's family (a 2nd grader, a 6th grader, and Chris). It's static
HTML/CSS/JS on GitHub Pages.

## Read first

**Before anything else this session, fetch and read Chris's profile:**
https://raw.githubusercontent.com/nosv1/nosv1/main/PROFILE.md

## This project

- **Mode: "just build it"** (his call, 2026-11-02). This is a family tool, not a skill-building
  project. Claude writes the code and Chris reviews it. **Push straight to `main`** once tests
  pass and the version is bumped: no branch or PR here (his call, 2026-11-05; this overrides the
  profile's "code goes on a branch").
- **No build step, no dependencies.** `index.html` + `style.css` + `app.js` + `words.js` +
  `defs.js` + `sync.js`. Keep it that way so Pages serves the repo root as-is.
- **Family sync** (`sync.js`, API in `worker/`): a Cloudflare Worker + D1 on the same account as
  Ride Finder, at `https://spellit-sync.nosv1.workers.dev`. No accounts: the family PIN is the
  Worker secret `FAMILY_PIN` (never in the repo). Deploy: `cd worker && npx wrangler@4 deploy`.
  Test: `node --test test/worker.test.mjs test/fill.test.mjs` against
  `npx wrangler@4 dev --port 8792 --test-scheduled`.
  - **Clean up after `wrangler dev` / `wrangler tail` on Windows.** Stopping the task (or
    `timeout`) only kills the outer `npx` shell; `wrangler` and its `workerd.exe` runtimes keep
    running. When done, check for leftover `workerd.exe` / `wrangler` processes and stop them.
    Nothing local needs to stay running: the site, voices and overnight fill are all on Cloudflare.
- **Natural voices** (`/speak` on the same Worker): Workers AI Aura-2, clips kept in D1, capped at
  `DAILY_CHARS` a day so it stays inside the free allowance. A cron in the last UTC hour spends what's
  left making clips ahead (`worker/src/fill.js`). **Chris won't pay for this**: keep it free.
- **Run it:** open `index.html`. **Test:** `bash test/run.sh` (headless Edge).
  - **Claude: run tests from PowerShell, not the Bash tool.** In the Bash tool's sandbox, Edge
    exits 0 and prints nothing, so `run.sh` looks like it passed with no output. Use
    `powershell -NoProfile -ExecutionPolicy Bypass -File test/run.ps1`: it prints the
    PASS/FAIL lines, then "N passed, M failed", and exits 1 on any failure. No output at all
    means the browser didn't run: that is not a pass.
  - **To look at a screen:** `test/run.ps1 -Shot <name>` saves `shot.png` (iPad-sized, 820×1180)
    of the demo data in `test/shot.js`: `home`, `setup`, `quiz`, `write`, `results`, `parent`,
    `players`, `lists`. Move it out of the repo after viewing (it isn't ignored).
- **Before pushing a change the site serves:** `node tools/bump_version.mjs` (updates
  `version.json`, `APP_VERSION` and the `?v=` links, so open iPads see an Update banner).
- Ideas not built yet go in [BACKLOG.md](BACKLOG.md).

## Live family data (as of 2026-11-05)

- **Players:** Hailee, Seth, Aiden and Chris, synced through the Worker's D1 (`records` table).
- **Voices:** on 11-05 Chris had everyone set to the natural voice **Helena** "for now". That was
  done by changing the player records through sync, not in code. Players can change their own
  voice on their start screen. The overnight fill makes clips only in the voices players use.
- **Stars** were reset once on 11-04 (`STARS_EPOCH = 1` in `app.js`), after the fair-stars rules.
- Changing live data: edit it through sync (a device, or a newer record via the Worker) so every
  iPad picks it up. Don't edit D1 rows by hand: devices would push their older copy back.
