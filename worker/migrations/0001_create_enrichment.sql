-- Enrichment lookup table for the authorized consumer application. One row per hex-addressable
-- aircraft; icao_hex is the join key against an aircraft's ICAO 24-bit address (icao24). Populated
-- by `wrangler d1 execute --file` from the per-source dumps the refresh pipeline emits
-- (src/enrichment.ts).
CREATE TABLE IF NOT EXISTS enrichment (
  icao_hex TEXT PRIMARY KEY,
  registration TEXT NOT NULL,
  icao_type_code TEXT,
  status TEXT NOT NULL,
  country TEXT NOT NULL,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  year_manufactured INTEGER,
  airframe_type TEXT,
  category TEXT,
  engine_manufacturer TEXT,
  engine_model TEXT,
  engine_type TEXT,
  engine_count INTEGER,
  engine_horsepower REAL,
  engine_thrust_lbs REAL,
  seats INTEGER,
  max_passengers INTEGER,
  cruise_speed_ktas REAL,
  max_takeoff_weight_kg REAL,
  owner_name TEXT,
  owner_kind TEXT,
  owner_state TEXT,
  owner_country TEXT,
  operator_name TEXT,
  operator_kind TEXT,
  operator_state TEXT,
  operator_country TEXT,
  source TEXT NOT NULL
);

-- Per-source resync deletes by source before re-inserting; without this index that DELETE is a
-- full scan on every refresh.
CREATE INDEX IF NOT EXISTS idx_enrichment_source ON enrichment (source);
