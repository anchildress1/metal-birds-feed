-- Enrichment lookup table for metal-birds-watch. One row per hex-addressable aircraft; icao_hex is
-- the join key against OpenSky's icao24. Populated by `wrangler d1 execute --file` from the
-- per-source dumps the refresh pipeline emits (src/enrichment.ts).
CREATE TABLE IF NOT EXISTS enrichment (
  icao_hex TEXT PRIMARY KEY,
  registration TEXT NOT NULL,
  airframe_type TEXT,
  manufacturer TEXT,
  model TEXT,
  owner_name TEXT,
  owner_country TEXT,
  operator_name TEXT,
  status TEXT NOT NULL,
  source TEXT NOT NULL
);

-- Per-source resync deletes by source before re-inserting; without this index that DELETE is a
-- full scan on every refresh.
CREATE INDEX IF NOT EXISTS idx_enrichment_source ON enrichment (source);
