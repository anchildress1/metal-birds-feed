import { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Aircraft } from './schema.js';
import type { FeedRow } from './feed-row.js';
import { latestKnownDate } from './recency.js';

// The descriptive, hex-addressable slice of a record a consumer application renders for a plane:
// identity, airframe, engine, performance, and ownership. Excludes registry-admin bookkeeping the
// canonical record still carries (certification/airworthiness dates, legal_owner, lien/interdiction
// codes, operational classes) — none of that describes the aircraft to a spotter. PII beyond
// owner/operator name/state/country is already absent from the schema. `source` is provenance.
export type { FeedRow };

const COLUMNS = [
  'icao_hex',
  'registration',
  'icao_type_code',
  'status',
  'country',
  'manufacturer',
  'model',
  'serial_number',
  'year_manufactured',
  'airframe_type',
  'category',
  'engine_manufacturer',
  'engine_model',
  'engine_type',
  'engine_count',
  'engine_horsepower',
  'engine_thrust_lbs',
  'seats',
  'max_passengers',
  'cruise_speed_ktas',
  'max_takeoff_weight_kg',
  'owner_name',
  'owner_kind',
  'owner_state',
  'owner_country',
  'operator_name',
  'operator_kind',
  'operator_state',
  'operator_country',
  'source',
] as const;

// Records sharing an icao_hex collapse to one winner deterministically so import order can't decide
// it: a cancelled record never shadows a live one, then the most recent known date wins, then
// source_id breaks the tie. Mirrors the engine's resolveRecency principle.
const preferWinner = (a: Aircraft, b: Aircraft): Aircraft => {
  const aCancelled = a.status === 'cancelled';
  const bCancelled = b.status === 'cancelled';
  if (aCancelled !== bCancelled) return aCancelled ? b : a;
  const aDate = latestKnownDate(a) ?? '';
  const bDate = latestKnownDate(b) ?? '';
  if (aDate !== bDate) return aDate > bDate ? a : b;
  return a.source_id <= b.source_id ? a : b;
};

// Per-source slice: collapse a source's records to one row per icao_hex (full recency via the
// Aircraft's dates), dropping rows without a hex — they're unreachable through the lookup.
export const toFeedRows = (records: Iterable<Aircraft>): FeedRow[] => {
  const byHex = new Map<string, Aircraft>();
  for (const r of records) {
    if (r.icao_hex === null) continue;
    const incumbent = byHex.get(r.icao_hex);
    byHex.set(r.icao_hex, incumbent === undefined ? r : preferWinner(incumbent, r));
  }
  return [...byHex.entries()].map(([icao_hex, r]) => ({
    icao_hex,
    registration: r.registration,
    icao_type_code: r.icao_type_code,
    status: r.status,
    country: r.country,
    manufacturer: r.manufacturer,
    model: r.model,
    serial_number: r.serial_number,
    year_manufactured: r.year_manufactured,
    airframe_type: r.airframe_type,
    category: r.category,
    engine_manufacturer: r.engine.manufacturer,
    engine_model: r.engine.model,
    engine_type: r.engine.type,
    engine_count: r.engine.count,
    engine_horsepower: r.engine.horsepower,
    engine_thrust_lbs: r.engine.thrust_lbs,
    seats: r.seats,
    max_passengers: r.max_passengers,
    cruise_speed_ktas: r.cruise_speed_ktas,
    max_takeoff_weight_kg: r.max_takeoff_weight_kg,
    owner_name: r.owner.name,
    owner_kind: r.owner.kind,
    owner_state: r.owner.state,
    owner_country: r.owner.country,
    operator_name: r.operator.name,
    operator_kind: r.operator.kind,
    operator_state: r.operator.state,
    operator_country: r.operator.country,
    source: r.source,
  }));
};

// Merge per-source slices into one row per icao_hex for the consolidated table. A live
// (non-cancelled) incumbent is never overwritten; a cancelled incumbent is replaced by any later
// row — so a live row always beats a cancelled one regardless of order, and among all-cancelled the
// last-seen wins. Sources are enumerated in sorted order (resolveAllSources), so the result is
// deterministic. The slice drops the date fields, so within-source recency is already resolved in
// toFeedRows; a cross-source hex collision (one airframe in two registries) is rare and transient.
export const mergeFeedRows = (groups: FeedRow[][]): FeedRow[] => {
  const byHex = new Map<string, FeedRow>();
  for (const group of groups) {
    for (const row of group) {
      const incumbent = byHex.get(row.icao_hex);
      if (incumbent === undefined || incumbent.status === 'cancelled') byHex.set(row.icao_hex, row);
    }
  }
  return [...byHex.values()];
};

// Stable content hash over the consolidated feed, mirroring db.ts's per-source hashRecords: sorted
// by icao_hex (the row key) so merge/iteration order can't churn it. The scheduled deploy compares
// this against the last-deployed hash to skip a redundant Cloud Run redeploy when nothing changed.
export const hashFeedRows = (rows: FeedRow[]): string => {
  const hash = createHash('sha256');
  for (const row of [...rows].sort((a, b) => a.icao_hex.localeCompare(b.icao_hex)))
    hash.update(`${row.icao_hex}\0${JSON.stringify(row)}\n`);
  return hash.digest('hex');
};

const COLUMN_TYPES: Record<(typeof COLUMNS)[number], string> = {
  icao_hex: 'TEXT PRIMARY KEY',
  registration: 'TEXT NOT NULL',
  icao_type_code: 'TEXT',
  status: 'TEXT NOT NULL',
  country: 'TEXT NOT NULL',
  manufacturer: 'TEXT',
  model: 'TEXT',
  serial_number: 'TEXT',
  year_manufactured: 'INTEGER',
  airframe_type: 'TEXT',
  category: 'TEXT',
  engine_manufacturer: 'TEXT',
  engine_model: 'TEXT',
  engine_type: 'TEXT',
  engine_count: 'INTEGER',
  engine_horsepower: 'REAL',
  engine_thrust_lbs: 'REAL',
  seats: 'INTEGER',
  max_passengers: 'INTEGER',
  cruise_speed_ktas: 'REAL',
  max_takeoff_weight_kg: 'REAL',
  owner_name: 'TEXT',
  owner_kind: 'TEXT',
  owner_state: 'TEXT',
  owner_country: 'TEXT',
  operator_name: 'TEXT',
  operator_kind: 'TEXT',
  operator_state: 'TEXT',
  operator_country: 'TEXT',
  source: 'TEXT NOT NULL',
};

const COLUMN_DEFS = COLUMNS.map((c) => `${c} ${COLUMN_TYPES[c]}`).join(',\n  ');
const DDL = `CREATE TABLE feed (\n  ${COLUMN_DEFS}\n);`;

// Structural validator for a feed slice read back from R2, derived from the same COLUMN_TYPES the
// table is built from: NOT NULL columns must be present strings, INTEGER/REAL a number or null, TEXT
// a string or null. A slice that is valid JSON but not a well-formed FeedRow[] (a bare object, a row
// missing a required column, a scalar where a row belongs) is rejected at the read boundary so it
// self-heals, instead of passing through and crashing consolidation on a bad row.
const columnSchema = (type: string): z.ZodTypeAny => {
  if (type.includes('NOT NULL') || type.includes('PRIMARY KEY')) return z.string();
  if (type.startsWith('INTEGER') || type.startsWith('REAL')) return z.number().nullable();
  return z.string().nullable();
};

export const FeedRowsSchema = z.array(
  z.object(Object.fromEntries(COLUMNS.map((c) => [c, columnSchema(COLUMN_TYPES[c])])))
) as unknown as z.ZodType<FeedRow[]>;

// The consolidated, single-table lookup DB the service serves: one row per icao_hex across every
// source, queried as `SELECT * FROM feed WHERE icao_hex IN (...)` — no per-country union. Built
// in memory and serialized to bytes (no filesystem), matching db.ts. `country` is indexed so a
// consumer can also scope by registration country. PRAGMA user_version marks the producer shape.
export const buildFeedDb = (rows: FeedRow[]): Uint8Array => {
  const db = new Database(':memory:');
  try {
    db.run('PRAGMA journal_mode = OFF');
    db.run('PRAGMA user_version = 1');
    db.run(DDL);
    db.run('CREATE INDEX idx_feed_country ON feed (country)');
    const insert = db.prepare(
      `INSERT OR REPLACE INTO feed (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map(() => '?').join(', ')})`
    );
    const insertAll = db.transaction((batch: FeedRow[]) => {
      for (const row of batch) insert.run(...COLUMNS.map((c) => row[c]));
    });
    insertAll(rows);
    return db.serialize();
  } finally {
    db.close();
  }
};
