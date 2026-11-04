# Backlog

Ideas parked for later, roughly in order of how much fun they'd add.

- **Treats / reward shop.** Parent sets rewards ("ice cream = 30 stars") and kids spend the stars
  they earn. A parent approves each one. This needs a "spent stars" field next to `stars`.
- **Most improved.** A weekly badge for the player whose score went up most vs. last week. Parent
  mode already shows "last 5 vs 5 before".
- **Achievements:** first perfect quiz, 7-day streak, 100 words spelled, and so on.
- **Recorded audio** for words where the device voice sounds bad.
- **More words** for grades 1, 3–5, 7–8 (12 per level now; grades 2, 6 and Adult have 20).
- **Unlockable themes.** Spend or earn stars to unlock color themes (space, ocean, jungle, candy).
  Needs a `theme` field per player and colors moved into CSS variables per theme.
- **Sound effects.** Ding on a right letter, boop on a wrong one, fanfare on a perfect quiz.
  Generate them with the existing `AudioContext` (no audio files). Add a mute toggle in Settings.
  Could also be unlockable sound packs.
- **Unlockable avatars.** There are 36 avatars now, all free. Lock some behind stars or
  achievements and show them grayed out with the price in the picker. Also let players change
  their avatar after they're created (right now you can't).
