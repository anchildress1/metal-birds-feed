import { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Aircraft } from './schema.js';
import type { FeedRow } from './feed-row.js';
import { latestKnownDate } from './recency.js';
import { log } from './logger.js';

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

// Per-source slice: one row per aircraft, collapsed on icao_hex where the register publishes one
// and on the normalized mark where it does not. Nine of fifteen registers publish no Mode S
// address, so keying the whole slice on hex silently excluded them from the feed entirely.
export const toFeedRows = (records: Iterable<Aircraft>): FeedRow[] => {
  const byHex = new Map<string, Aircraft>();
  const byMark = new Map<string, Aircraft>();
  for (const r of records) {
    // Cancelled marks are excluded from the served feed, not from the artifact: the feed enriches
    // live traffic, so a deregistered mark is never asked about, and marks get reissued — keeping
    // them is what would make registration ambiguous as a lookup key. The per-source artifact still
    // carries the full history.
    if (r.status === 'cancelled') continue;
    if (r.icao_hex !== null) {
      const incumbent = byHex.get(r.icao_hex);
      byHex.set(r.icao_hex, incumbent === undefined ? r : preferWinner(incumbent, r));
      continue;
    }
    // Marks normalize to '' only if the register published punctuation alone. Such a row carries
    // neither lookup key, so it can never be selected — it is left out rather than stored unreachable.
    const mark = registrationKey(r.registration);
    if (mark === '') continue;
    const incumbent = byMark.get(mark);
    byMark.set(mark, incumbent === undefined ? r : preferWinner(incumbent, r));
  }
  // Within one register a mark identifies one aircraft, so a hex-less record sharing a mark with a
  // hex-bearing one is the same aircraft in a less complete row. The hex-bearing row supersedes it;
  // keeping both would manufacture an ambiguity out of a single airframe.
  for (const r of byHex.values()) byMark.delete(registrationKey(r.registration));
  const collapsed: [string | null, Aircraft][] = [
    ...[...byHex.entries()].map(([hex, r]): [string | null, Aircraft] => [hex, r]),
    ...[...byMark.values()].map((r): [string | null, Aircraft] => [null, r]),
  ];
  return collapsed.map(([icao_hex, r]) => ({
    icao_hex,
    registration: r.registration,
    // Null, not '': a mark of pure punctuation normalizes to nothing, and no caller can send an
    // empty key (parseRegistrations requires 2-10 alphanumerics). Storing '' would put an
    // unreachable value in the unique index and let two such rows read as an ambiguous mark.
    registration_key: registrationKey(r.registration) || null,
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
  const hexless: FeedRow[] = [];
  for (const group of groups) {
    // No cancelled filter here. Every slice is written by toFeedRows, which excludes them, and the
    // pre-change slices were deleted so each source regenerated one — filtering again would be a
    // compatibility shim for data that no longer exists.
    for (const row of group) {
      if (row.icao_hex === null) {
        // Not deduped on the mark across sources: a hex is globally unique, so two sources sharing
        // one are the same airframe, but two registers can legitimately issue marks that normalize
        // alike. Those are different aircraft and are resolved as an ambiguity, not a duplicate.
        hexless.push(row);
        continue;
      }
      if (byHex.get(row.icao_hex) === undefined) byHex.set(row.icao_hex, row);
    }
  }
  return resolveRegistrationAmbiguity([...byHex.values(), ...hexless]);
};

// A mark reaching two different aircraft cannot be served: returning either would be a wrong
// answer, which is worse than a miss. Canada alone produces these without leaving the register —
// the 3-character mark ABC renders CF-ABC and the 4-character mark FABC renders C-FABC, and both
// normalize to CFABC. Cross-register cases (Chile CC-xxx against a Canadian C-Cxxx) behave the same.
// The key is dropped rather than the row, so a hex-bearing aircraft stays reachable by hex; a
// hex-less row losing its key has no remaining lookup path and is dropped outright rather than
// stored unreachable.
export const resolveRegistrationAmbiguity = (rows: FeedRow[]): FeedRow[] => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.registration_key === null) continue;
    counts.set(row.registration_key, (counts.get(row.registration_key) ?? 0) + 1);
  }
  const resolved: FeedRow[] = [];
  const cleared = new Set<string>();
  let dropped = 0;
  for (const row of rows) {
    const key = row.registration_key;
    if (key === null || (counts.get(key) ?? 0) < 2) {
      resolved.push(row);
      continue;
    }
    cleared.add(key);
    if (row.icao_hex === null) {
      dropped++;
      continue;
    }
    resolved.push({ ...row, registration_key: null });
  }
  // Never silent: a mark losing its lookup path is a real reduction in what the feed can answer,
  // and the sample is what makes a new collision diagnosable without re-deriving it from the data.
  if (cleared.size > 0)
    log('warn', 'feed_registration_key_ambiguous', {
      marks: cleared.size,
      rows_dropped: dropped,
      sample: [...cleared]
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 10)
        .join(','),
    });
  return resolved;
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
  // hex alone is no longer a total order: hex-less rows all sort equal on it, so the mark and the
  // source break the tie. Without that, iteration order would churn the hash and trigger redundant
  // Cloud Run redeploys on an unchanged feed.
  const sortKey = (r: FeedRow): string =>
    `${r.icao_hex ?? ''}\u0000${r.registration_key ?? ''}\u0000${r.source}\u0000${r.registration}`;
  for (const row of [...rows].sort((a, b) => sortKey(a).localeCompare(sortKey(b))))
    hash.update(`${sortKey(row)}\0${JSON.stringify(COLUMNS.map((column) => row[column]))}\n`);
  return hash.digest('hex');
};

// Keyed by `keyof FeedRow`, not by COLUMNS: adding a field to FeedRow must be a compile error here
// rather than a column silently missing from the served DB. Mirrors db.ts's FlatColumn guard.
const COLUMN_TYPES: Record<keyof FeedRow, string> = {
  icao_hex: 'TEXT',
  registration: 'TEXT NOT NULL',
  registration_key: 'TEXT',
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

const COLUMN_DEFS = COLUMNS.map((c) => `${c} ${COLUMN_TYPES[c]}`).join(',\n  ');
const DDL = `CREATE TABLE feed (\n  ${COLUMN_DEFS}\n);`;

// Structural validator for a feed slice read back from R2, derived from the same COLUMN_TYPES the
// table is built from: NOT NULL columns must be present strings, INTEGER/REAL a number or null, TEXT
// a string or null. A slice that is valid JSON but not a well-formed FeedRow[] (a bare object, a row
// missing a required column, a scalar where a row belongs) is rejected at the read boundary so it
// self-heals, instead of passing through and crashing consolidation on a bad row.
const columnSchema = (type: string): z.ZodTypeAny => {
  if (type.includes('NOT NULL')) return z.string();
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
export const FEED_SLICE_VERSION = 3;

export interface ParsedFeedSlice {
  rows: FeedRow[];
  needsMigration: boolean;
}

// Only the current version is accepted. Earlier slices are structurally readable — every column
// they carry still validates — but they were written when the producer dropped hex-less records, so
// they are silently short by exactly the rows this version exists to serve. Migrating one would
// publish that gap; failing closed drops the source to "no slice", which the pipeline already
// self-heals by regenerating it from the register.
const CurrentFeedSliceSchema = z
  .strictObject({ version: z.literal(FEED_SLICE_VERSION), rows: FeedRowsSchema })
  .transform(({ rows }): ParsedFeedSlice => ({ rows, needsMigration: false }));

export const FeedSliceSchema: z.ZodType<ParsedFeedSlice> = CurrentFeedSliceSchema;

export const serializeFeedSlice = (rows: FeedRow[]): string =>
  JSON.stringify({ version: FEED_SLICE_VERSION, rows });

// The consolidated, single-table lookup DB the service serves: one row per aircraft across every
// source, queried as `SELECT * FROM feed WHERE icao_hex IN (...)` or `... registration_key IN (...)`
// — no per-country union. Built in memory and serialized to bytes (no filesystem), matching db.ts.
// `country` is indexed so a consumer can also scope by registration country. PRAGMA user_version
// marks the producer shape.
//
// Checked before insert rather than left to the unique indexes: the insert is INSERT OR REPLACE, so
// a collision would silently drop one aircraft instead of raising. Both keys are nullable and NULLs
// do not collide in a SQLite unique index, so only populated values are compared. Reaching either
// of these means resolveRegistrationAmbiguity or the merge was bypassed — a producer bug, not
// upstream data, so it refuses rather than picking a winner.
const assertUniqueKeys = (rows: FeedRow[], column: 'registration_key' | 'icao_hex'): void => {
  const seen = new Set<string>();
  const collisions: string[] = [];
  for (const row of rows) {
    const value = row[column];
    if (value === null) continue;
    if (seen.has(value)) collisions.push(value);
    else seen.add(value);
  }
  if (collisions.length > 0)
    throw new Error(
      `Refusing to build feed: ${collisions.length} ${column} collision(s) — ${collisions.slice(0, 5).join(', ')}${collisions.length > 5 ? ', …' : ''}`
    );
};

export const buildFeedDb = (rows: FeedRow[]): Uint8Array => {
  assertUniqueKeys(rows, 'registration_key');
  assertUniqueKeys(rows, 'icao_hex');
  const db = new Database(':memory:');
  try {
    db.run('PRAGMA journal_mode = OFF');
    db.run('PRAGMA user_version = 6');
    db.run(DDL);
    db.run('CREATE INDEX idx_feed_country ON feed (country)');
    // Unique rather than plain: NULLs never collide in a SQLite unique index, so hex-less rows and
    // ambiguity-cleared marks coexist freely while a populated key stays one-to-one with an aircraft.
    db.run('CREATE UNIQUE INDEX idx_feed_icao_hex ON feed (icao_hex)');
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
