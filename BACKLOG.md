# Backlog

Ideas parked for later, roughly in order of how much fun they'd add.

- **Drawing break** (Hailee's idea, 2026-11-04; "not sure yet"). Halfway through a quiz, a
  3-minute free-draw pad with a countdown and a few colors, then back to the next word. Open
  questions: every quiz or a per-player switch? Keep the drawings (a gallery) or throw them away?
  A "Back to spelling" button to leave early.
- **Progress to parents' phones** (2026-11-04). A short summary when a quiz or a session ends
  ("Hailee: 9/10, missed *because*, 3-day streak"). Needs the Cloudflare sync first. Options:
  web push from the Worker (parent adds SpellIt! to their home screen and allows notifications;
  free, no accounts) or email via Cloudflare Email Routing (needs a domain on Cloudflare).

- **Treats / reward shop.** Parent sets rewards ("ice cream = 30 stars") and kids spend the stars
  they earn. A parent approves each one. This needs a "spent stars" field next to `stars`.
- **Most improved.** A weekly badge for the player whose score went up most vs. last week. Parent
  mode already shows "last 5 vs 5 before".
- **Achievements:** first perfect quiz, 7-day streak, 100 words spelled, and so on.
- **Recorded audio** for words where the device voice sounds bad.
- **More words** for grades 1, 3–5, 7–8 (40 per level now; grades 2, 6 and Adult have 60).
- **Sound effects.** Ding on a right letter, boop on a wrong one, fanfare on a perfect quiz.
  Generate them with the existing `AudioContext` (no audio files). Add a mute toggle in Settings.
  Could also be unlockable sound packs.
- **Unlockable avatars.** There are 72 avatars now (people first), all free. Lock some behind
  stars or achievements and show them in the shop next to themes and pens. Skin-tone choices
  for the people would be a nice touch.
