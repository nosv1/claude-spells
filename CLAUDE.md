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
  `defs.js` + `sync.js` + `draw.js`. Keep it that way so Pages serves the repo root as-is.
- **Family sync** (`sync.js`, API in `worker/`): a Cloudflare Worker + D1 on the same account as
  Ride Finder, at `https://spellit-sync.nosv1.workers.dev`. No accounts: the family PIN is the
  Worker secret `FAMILY_PIN` (never in the repo). Test: `node --test test/worker.test.mjs
  test/fill.test.mjs` against `npx wrangler@4 dev --port 8792 --test-scheduled`.
  - **Deploy: `node tools/deploy_worker.mjs`** (Chris's OK for Claude to deploy, 2026-11-05, "put
    up your own safeguards so you don't break anything"). It refuses uncommitted or unpushed
    code, and any schema that isn't `CREATE ... IF NOT EXISTS`. It runs the Worker tests locally
    and does a dry-run build. After deploying it checks `GET /health` and CORS, and rolls back
    automatically if either fails. `--check` runs only the checks. `.claude/settings.json`
    allows only this script and denies raw `wrangler deploy`, `rollback`, `secret` and remote
    `d1 execute`. Never work around that: change data through the app (sync), not D1.
  - **Clean up after `wrangler dev` / `wrangler tail` on Windows.** Stopping the task (or
    `timeout`) only kills the outer `npx` shell; `wrangler` and its `workerd.exe` runtimes keep
    running. When done, check for leftover `workerd.exe` / `wrangler` processes and stop them.
    Nothing local needs to stay running: the site, voices and overnight fill are all on Cloudflare.
- **Natural voices** (`/speak` on the same Worker): Workers AI Aura-2, clips kept in D1, capped at
  `DAILY_CHARS` a day so it stays inside the free allowance. A cron in the last UTC hour spends what's
  left making clips ahead (`worker/src/fill.js`). **Chris won't pay for this**: keep it free.
- **Drawing break** (`draw.js`, `/drawings` on the same Worker; built 2026-11-05). Getting 3 of
  the first 5 words right (no "Show me") earns 3 minutes of drawing, once per quiz, with no stars.
  Each player has a gallery to carry on with. The pictures are PNG data URLs kept in IndexedDB
  (too big for localStorage) and in D1's `drawings` table, apart from `/sync`. They aren't in
  the Parent-mode backup file.
  - The smoke test keeps drawings in memory, because headless Edge's IndexedDB doesn't answer
    under `--virtual-time-budget`. `node test/drawings-idb.mjs` checks the IndexedDB side in
    real-time headless Edge.
- **Run it:** open `index.html`. **Test:** `bash test/run.sh` (headless Edge).
  - **Claude: run tests from PowerShell, not the Bash tool.** In the Bash tool's sandbox, Edge
    exits 0 and prints nothing, so `run.sh` looks like it passed with no output. Use
    `powershell -NoProfile -ExecutionPolicy Bypass -File test/run.ps1`: it prints the
    PASS/FAIL lines, then "N passed, M failed", and exits 1 on any failure. No output at all
    means the browser didn't run: that is not a pass.
  - **To look at a screen:** `test/run.ps1 -Shot <name>` saves `shot.png` (iPad-sized, 820×1180)
    of the demo data in `test/shot.js`: `home`, `setup`, `quiz`, `write`, `results`, `parent`,
    `players`, `lists`, `break`, `draw`, `gallery`, `shop` (with "How do I earn stars?" open),
    `capped` (a 6th grader on 1st grade words). Move it out of the repo after viewing (it
    isn't ignored).
- **Before pushing a change the site serves:** `node tools/bump_version.mjs` (updates
  `version.json`, `APP_VERSION` and the `?v=` links, so open iPads see an Update banner).
- Ideas not built yet go in [BACKLOG.md](BACKLOG.md).

## Live family data (as of 2026-11-05)

- **Players:** Hailee, Seth, Aiden and Chris, synced through the Worker's D1 (`records` table).
- **Voices:** on 11-05 Chris had everyone set to the natural voice **Helena** "for now". That was
  done by changing the player records through sync, not in code. Players can change their own
  voice on their start screen. The overnight fill makes clips only in the voices players use.
- **Stars** were reset once on 11-04 (`STARS_EPOCH = 1` in `app.js`), after the fair-stars rules.
  The reset came after Hailee farmed stars on 1st-grade Easy. A quiz now pays the lowest of three
  caps (`starLimit` in `app.js`; built 11-06 after Chris said a 6th grader on 1st grade should
  never get 2 stars): the player's **school grade** (`p.schoolGrade`, set in Parent mode ›
  Players), **mastery** (`masteredLevel`, `starCap`), and **the same quiz again today**
  (`repeatCap`). The full math is in README "How stars work" (Chris's brother asked) and,
  shorter, in the Shop's "How do I earn stars?". Update both if the rules change, and keep
  them in mind before adding any new way to earn stars.
  - **Players made before 11-06 have no school grade**, so that cap is off for them until a parent
    sets it in Parent mode › Players (asked Chris to do it for Hailee, Seth, Aiden and Chris).
- **Hailee's taste** (she's the one asking for features): emoji-style UI icons bothered her
  (the sponge, monkey and speaker buttons became line icons, `ICONS` in `app.js`). She wanted
  more person avatars, a Flower theme and cursive names. Lean toward her taste for kid-facing
  looks, and keep the letters to spell in plain print.
- Changing live data: edit it through sync (a device, or a newer record via the Worker) so every
  iPad picks it up. Don't edit D1 rows by hand: devices would push their older copy back.
- **Drawing break: live, but not yet tried on a real iPad** (site 2026.11.05.4, Worker deployed
  11-05 via `tools/deploy_worker.mjs`, commit 844bd38). Next session, ask how it went:
  - Did drawing feel right with a finger or Apple Pencil (palm touches, lag on the 1024 px canvas)?
  - Did a drawing carry over between iPads?
  - The earn rule: Chris lowered it to 3 of the first 5 on 11-06 ("4 is kinda tough if they're
    learning new words"); it's `DRAW_EARN` in `draw.js`.
  - Hailee's reaction: she asked for this one, so her look-and-feel notes come first.
