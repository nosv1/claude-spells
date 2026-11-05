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
