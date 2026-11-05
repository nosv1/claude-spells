# SpellIt! (claude-spells)

A spelling practice web app for Chris's family (a 2nd grader, a 6th grader, and Chris). It's static
HTML/CSS/JS on GitHub Pages.

## Read first

**Before anything else this session, fetch and read Chris's profile:**
https://raw.githubusercontent.com/nosv1/nosv1/main/PROFILE.md

## This project

- **Mode: "just build it"** (his call, 2026-11-02). This is a family tool, not a skill-building
  project. Claude writes the code and Chris reviews it.
- **No build step, no dependencies.** `index.html` + `style.css` + `app.js` + `words.js` +
  `defs.js` + `sync.js`. Keep it that way so Pages serves the repo root as-is.
- **Family sync** (`sync.js`, API in `worker/`): a Cloudflare Worker + D1 on the same account as
  Ride Finder, at `https://spellit-sync.nosv1.workers.dev`. No accounts: the family PIN is the
  Worker secret `FAMILY_PIN` (never in the repo). Deploy: `cd worker && npx wrangler@4 deploy`.
  Test: `node --test test/worker.test.mjs` against `npx wrangler@4 dev --port 8792`.
- **Run it:** open `index.html`. **Test:** `bash test/run.sh` (headless Edge).
- **Before pushing a change the site serves:** `node tools/bump_version.mjs` (updates
  `version.json`, `APP_VERSION` and the `?v=` links, so open iPads see an Update banner).
- Ideas not built yet go in [BACKLOG.md](BACKLOG.md).
