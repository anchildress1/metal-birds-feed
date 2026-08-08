import { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Aircraft } from './schema.js';
import type { FeedRow } from './feed-row.js';
import { latestKnownDate } from './recency.js';

// Consumer-facing per-plane slice: identity/airframe/engine/performance/ownership plus the
// English-primary legal/admin free-text fields — not the *_source_text originals (those stay in
// the per-source artifact for provenance), and not the fields with no consumer value (dates,
// legal_owner, interdiction code, operational classes).
export type { FeedRow };

// Registries punctuate marks differently — FAA "N12345", TC "C-FABC", CASA "VH-XYZ" — and a caller
// holding a tail number off a photo should not have to know which. Uppercase and strip everything
// that is not alphanumeric, on both the stored key and the query, so the two meet in one form.
export const registrationKey = (registration: string): string =>
  registration.toUpperCase().replace(/[^A-Z0-9]/g, '');

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
    // Cancelled marks are excluded from the served feed, not from the artifact: the feed enriches
    // live traffic, so a deregistered mark is never asked about, and marks get reissued — keeping
    // them is what would make registration ambiguous as a lookup key. The per-source artifact still
    // carries the full history.
    if (r.status === 'cancelled') continue;
    if (r.icao_hex === null) continue;
    const incumbent = byHex.get(r.icao_hex);
    byHex.set(r.icao_hex, incumbent === undefined ? r : preferWinner(incumbent, r));
  }
  return [...byHex.entries()].map(([icao_hex, r]) => ({
    icao_hex,
    registration: r.registration,
    registration_key: registrationKey(r.registration),
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
    cancellation_reason: r.cancellation_reason,
    airworthiness_class: r.airworthiness_class,
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
    // No cancelled filter here. Every slice is written by toFeedRows, which excludes them, and the
    // pre-change slices were deleted so each source regenerated one — filtering again would be a
    // compatibility shim for data that no longer exists.
    for (const row of group) {
      if (byHex.get(row.icao_hex) === undefined) byHex.set(row.icao_hex, row);
    }
  }
  return [...byHex.values()];
};

// Stable content hash over the consolidated feed, mirroring db.ts's per-source hashRecords: sorted
// by icao_hex (the row key) so merge/iteration order can't churn it. The scheduled deploy compares
// this against the last-deployed hash to skip a redundant Cloud Run redeploy when nothing changed.
// Hashes values in `COLUMNS` order rather than `JSON.stringify(row)`, which is key-order sensitive:
// a migrated legacy slice appends its added fields after `source`, while a zod re-parse emits them
// in schema order, so the same data hashed two ways would disagree and trigger a redundant Cloud
// Run image build. Column order is the contract, and adding a column still changes the hash.
export const hashFeedRows = (rows: FeedRow[]): string => {
  const hash = createHash('sha256');
  for (const row of [...rows].sort((a, b) => a.icao_hex.localeCompare(b.icao_hex)))
    hash.update(`${row.icao_hex}\0${JSON.stringify(COLUMNS.map((column) => row[column]))}\n`);
  return hash.digest('hex');
};

// Keyed by `keyof FeedRow`, not by COLUMNS: adding a field to FeedRow must be a compile error here
// rather than a column silently missing from the served DB. Mirrors db.ts's FlatColumn guard.
const COLUMN_TYPES: Record<keyof FeedRow, string> = {
  icao_hex: 'TEXT PRIMARY KEY',
  registration: 'TEXT NOT NULL',
  registration_key: 'TEXT NOT NULL',
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
  cancellation_reason: 'TEXT',
  airworthiness_class: 'TEXT',
  source: 'TEXT NOT NULL',
};

// Single source of column truth: the DDL, the INSERT, and FeedRowsSchema all derive from this,
// so a field cannot reach FeedRow without reaching the served database.
const COLUMNS = Object.keys(COLUMN_TYPES) as (keyof FeedRow)[];

type LegacyFeedRow = Omit<FeedRow, 'cancellation_reason' | 'airworthiness_class'>;

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

type FeedRowShape = { [K in keyof FeedRow]: z.ZodType<FeedRow[K]> };
const FeedRowObjectSchema = z.strictObject(
  Object.fromEntries(
    COLUMNS.map((column) => [column, columnSchema(COLUMN_TYPES[column])])
  ) as FeedRowShape
);
export const FeedRowsSchema: z.ZodType<FeedRow[]> = z.array(FeedRowObjectSchema);
const LegacyFeedRowsSchema: z.ZodType<LegacyFeedRow[]> = z.array(
  FeedRowObjectSchema.omit({ cancellation_reason: true, airworthiness_class: true })
);

export const FEED_SLICE_VERSION = 2;

export interface ParsedFeedSlice {
  rows: FeedRow[];
  needsMigration: boolean;
}

const CurrentFeedSliceSchema = z
  .strictObject({ version: z.literal(FEED_SLICE_VERSION), rows: FeedRowsSchema })
  .transform(({ rows }): ParsedFeedSlice => ({ rows, needsMigration: false }));

const UnversionedCurrentFeedSliceSchema = FeedRowsSchema.transform((rows): ParsedFeedSlice => ({
  rows,
  needsMigration: true,
}));

const UnversionedLegacyFeedSliceSchema = LegacyFeedRowsSchema.transform(
  (rows): ParsedFeedSlice => ({
    rows: rows.map((row) => ({
      ...row,
      cancellation_reason: null,
      airworthiness_class: null,
    })),
    needsMigration: true,
  })
);

// Bounded migration: production slices predate the versioned envelope and the two additive nullable
// fields. Exact old/current arrays upgrade once and are rewritten by the reader; malformed rows and
// unknown envelope versions still fail closed.
export const FeedSliceSchema = z.union([
  CurrentFeedSliceSchema,
  UnversionedCurrentFeedSliceSchema,
  UnversionedLegacyFeedSliceSchema,
]);

export const serializeFeedSlice = (rows: FeedRow[]): string =>
  JSON.stringify({ version: FEED_SLICE_VERSION, rows });

// The consolidated, single-table lookup DB the service serves: one row per icao_hex across every
// source, queried as `SELECT * FROM feed WHERE icao_hex IN (...)` — no per-country union. Built
// in memory and serialized to bytes (no filesystem), matching db.ts. `country` is indexed so a
// consumer can also scope by registration country. PRAGMA user_version marks the producer shape.
// Checked before insert, not left to the unique index: the insert is INSERT OR REPLACE, so a
// collision would silently drop one aircraft instead of raising. Two rows sharing a normalized mark
// means either a reissued registration the source never marked cancelled, or the same mark in two
// registries — both are real upstream questions, and picking a winner would answer them by accident.
// Mirrors the engine's duplicate-source_id rule: refuse rather than last-wins.
const assertUniqueRegistrationKeys = (rows: FeedRow[]): void => {
  const seen = new Map<string, string>();
  const collisions: string[] = [];
  for (const row of rows) {
    const prior = seen.get(row.registration_key);
    if (prior === undefined) seen.set(row.registration_key, row.icao_hex);
    else collisions.push(`${row.registration_key} (${prior} and ${row.icao_hex})`);
  }
  if (collisions.length > 0)
    throw new Error(
      `Refusing to build feed: ${collisions.length} registration_key collision(s) — ${collisions.slice(0, 5).join(', ')}${collisions.length > 5 ? ', …' : ''}`
    );
};

export const buildFeedDb = (rows: FeedRow[]): Uint8Array => {
  assertUniqueRegistrationKeys(rows);
  const db = new Database(':memory:');
  try {
    db.run('PRAGMA journal_mode = OFF');
    db.run('PRAGMA user_version = 5');
    db.run(DDL);
    db.run('CREATE INDEX idx_feed_country ON feed (country)');
    db.run('CREATE UNIQUE INDEX idx_feed_registration_key ON feed (registration_key)');
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
