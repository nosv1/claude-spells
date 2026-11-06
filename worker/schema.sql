-- SpellIt! family sync. Apply: npx wrangler@4 d1 execute spellit --remote --file schema.sql

-- One row per player ('profile') or Parent-mode word list ('list'). data is the app's JSON for it.
-- updated: when the device changed it (its clock, ms), for newest-wins. seq: the order the
-- service took changes in, so a device can ask for everything after the last one it saw.
CREATE TABLE IF NOT EXISTS records (
  kind TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT,
  updated INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  seq INTEGER NOT NULL,
  PRIMARY KEY (kind, id)
);
CREATE INDEX IF NOT EXISTS records_seq ON records (seq);

-- Wrong PINs, for the rate limit.
CREATE TABLE IF NOT EXISTS fails (
  ip TEXT NOT NULL,
  t INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS fails_t ON fails (t);

-- Natural-voice clips (Workers AI text to speech), made once and kept: one per voice and text.
CREATE TABLE IF NOT EXISTS clips (
  voice TEXT NOT NULL,
  text TEXT NOT NULL,
  audio BLOB NOT NULL,
  made INTEGER NOT NULL,
  PRIMARY KEY (voice, text)
);

-- Characters sent to the voice service each day (UTC), to stay inside Workers AI's free daily
-- allowance (10,000 neurons, about 3,600 characters of Aura-2).
CREATE TABLE IF NOT EXISTS spend (
  day TEXT PRIMARY KEY,
  chars INTEGER NOT NULL
);

-- Drawing-break pictures, one row per drawing: image is a PNG or JPEG data URL (null once deleted).
-- Apart from records, so a sync never carries them. updated: the device's clock, for newest-wins.
CREATE TABLE IF NOT EXISTS drawings (
  id TEXT PRIMARY KEY,
  player TEXT NOT NULL,
  image TEXT,
  updated INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS drawings_player ON drawings (player);
