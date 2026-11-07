# Backlog

Ideas parked for later, roughly in order of how much fun they'd add.

- **Drawing break follow-ups** (the break itself was built 2026-11-05). Ideas, not asked for:
  drawings in Parent mode (see them, delete them), in the backup file, and the Rainbow pen as a
  drawing color for players who've unlocked it.
- **Progress to parents' phones** (2026-11-04; asked for again 11-05, parked). A short summary
  when a quiz ends ("Hailee: 9/10, missed *because*, 3-day streak"). Sync is built now, so the
  Worker can spot new quizzes itself: in `/sync`, compare a player's incoming `history` with the
  stored copy, and announce entries that are new and less than a day old (so a device joining
  with old quizzes doesn't spam). The client would add `missed` (and maybe how many handwriting
  words were self-marked) to each history entry so the message can say more. Ways to send it,
  all free:
  - **ntfy** (simplest, ~30 lines): the Worker POSTs JSON to `https://ntfy.sh/` with a secret
    topic (Worker secret `NTFY_TOPIC`); parents install the ntfy app and subscribe. The topic
    name is the only secret.
  - Web push into SpellIt! itself: no extra app, but iPhone needs it on the home screen, plus a
    service worker and VAPID signing in the Worker. Much more code.
  - Email via Cloudflare Email Routing (needs a domain on Cloudflare).

- **Follow-ups from the 2026-11-05 parent tools** (Claude's suggestions, not asked for yet):
  - Tell the kid when a parent gives stars ("🎁 Dad gave you 5 stars!") on their start screen.
    The grants are already logged in `p.bonus`; it needs a "seen up to" time on the player.
  - Handwriting "It was wrong" only puts the word back on the practice list. It could also
    take back that word's share of the quiz's score and stars (for now: Players tab, Take away).
- **The rest of the emojis** (open question from 11-04, never answered). Quiz and tool buttons
  became line icons after Hailee disliked the emojis. Still emojis: the voice-style buttons
  (Happy, Squeaky, Deep...), the streak and star badges, and the results screen lines. Ask
  whether to swap those too.
- **Treats / reward shop.** Parent sets rewards ("ice cream = 30 stars") and kids spend the stars
  they earn. A parent approves each one. This needs a "spent stars" field next to `stars`.
- **Most improved.** A weekly badge for the player whose score went up most vs. last week. Parent
  mode already shows "last 5 vs 5 before".
- **Achievements:** first perfect quiz, 7-day streak, 100 words spelled, and so on.
- **More words** for grades 1, 3–5, 7–8 (40 per level now; grades 2, 6 and Adult have 60).
- **Sound effects.** Ding on a right letter, boop on a wrong one, fanfare on a perfect quiz.
  Generate them with the existing `AudioContext` (no audio files). Add a mute toggle in Settings.
  Could also be unlockable sound packs.
- **Unlockable avatars.** There are 72 avatars now (people first), all free. Lock some behind
  stars or achievements and show them in the shop next to themes and pens. Skin-tone choices
  for the people would be a nice touch.
