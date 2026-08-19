import { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import type { Aircraft, Engine, Owner } from './schema.js';

// The producer shape marker written into PRAGMA user_version, and salted into the artifact's
// content_hash below (writer.ts) so a schema/DDL-only change that happens not to alter any
// currently-processed row's serialized value — e.g. loosening a NOT NULL constraint no source's
// current data ever hit — still busts the write-skip gate, instead of never reaching R2 until
// unrelated upstream data changes. Salting the hash rather than versioning the state envelope
// keeps record_count/upstream_hash intact through the migration run, so the retain-ratio guard and
// staleness tracking keep working off the real prior values instead of an invalidated null state.
export const DB_SCHEMA_VERSION = 12;

const bySourceId = (a: Aircraft, b: Aircraft): number => {
  if (a.source_id < b.source_id) return -1;
  if (a.source_id > b.source_id) return 1;
  return 0;
};

// Content fingerprint over the sorted records, independent of SQLite's byte layout (which is not
// guaranteed stable run to run). Drives skip-if-unchanged. `salt` is optional and unused by the
// upstream_hash caller (pipeline.ts) — that hash must track only what the register itself
// published, never our own schema version, or a schema bump would misreport an unchanged register
// as having published something new and reset its staleness clock. writer.ts is the one caller
// that salts, with DB_SCHEMA_VERSION, for the artifact's own content_hash.
export const hashRecords = (records: Map<string, Aircraft>, salt = ''): string => {
  const hash = createHash('sha256');
  if (salt !== '') hash.update(`${salt}\0`);
  for (const record of [...records.values()].sort(bySourceId)) {
    hash.update(`${record.source_id}\0${JSON.stringify(record)}\n`);
  }
  return hash.digest('hex');
};

type Bind = string | number | null;

// Every column the artifact exposes, derived from the canonical schema: scalar fields keep their
// name; nested objects flatten to `owner_*`/`operator_*`/`engine_*`. `toColumns` is typed against
// this, so adding a field to `Aircraft`/`Owner`/`Engine` without mapping it here is a compile error
// (guards the AGENTS "no silent loss of upstream information" rule).
type FlatColumn =
  | Exclude<keyof Aircraft, 'engine' | 'owner' | 'operator' | 'legal_owner'>
  | `engine_${keyof Engine}`
  | `owner_${keyof Owner}`
  | `operator_${keyof Owner}`
  | `legal_owner_${keyof Owner}`;

// Single source of truth for column name → bound value. The INSERT column list and the bound
// values both derive from this one object, so they cannot drift in order or membership. The array
// fields (`operational_classes` and its `_source_text` twin) are serialized to JSON strings.
const toColumns = (r: Aircraft): Record<FlatColumn, Bind> => ({
  source: r.source,
  source_id: r.source_id,
  registration: r.registration,
  icao_hex: r.icao_hex,
  icao_type_code: r.icao_type_code,
  status: r.status,
  country: r.country,
  manufacturer: r.manufacturer,
  model: r.model,
  serial_number: r.serial_number,
  year_manufactured: r.year_manufactured,
  airframe_type: r.airframe_type,
  category: r.category,
  build_certification: r.build_certification,
  airworthiness_class: r.airworthiness_class,
  airworthiness_class_source_text: r.airworthiness_class_source_text,
  operating_environment: r.operating_environment,
  operational_classes: JSON.stringify(r.operational_classes),
  operational_classes_source_text: JSON.stringify(r.operational_classes_source_text),
  engine_manufacturer: r.engine.manufacturer,
  engine_model: r.engine.model,
  engine_type: r.engine.type,
  engine_count: r.engine.count,
  engine_horsepower: r.engine.horsepower,
  engine_thrust_lbs: r.engine.thrust_lbs,
  owner_name: r.owner.name,
  owner_kind: r.owner.kind,
  owner_state: r.owner.state,
  owner_country: r.owner.country,
  operator_name: r.operator.name,
  operator_kind: r.operator.kind,
  operator_state: r.operator.state,
  operator_country: r.operator.country,
  legal_owner_name: r.legal_owner.name,
  legal_owner_kind: r.legal_owner.kind,
  legal_owner_state: r.legal_owner.state,
  legal_owner_country: r.legal_owner.country,
  propeller: r.propeller,
  home_base: r.home_base,
  idera_authorised_party: r.idera_authorised_party,
  certification_date: r.certification_date,
  airworthiness_date: r.airworthiness_date,
  expiration_date: r.expiration_date,
  last_action_date: r.last_action_date,
  cruise_speed_ktas: r.cruise_speed_ktas,
  max_takeoff_weight_kg: r.max_takeoff_weight_kg,
  seats: r.seats,
  max_passengers: r.max_passengers,
  min_crew: r.min_crew,
  airworthiness_review_date: r.airworthiness_review_date,
  cancellation_reason: r.cancellation_reason,
  cancellation_reason_source_text: r.cancellation_reason_source_text,
  lien_status: r.lien_status,
  lien_status_source_text: r.lien_status_source_text,
  interdiction_code: r.interdiction_code,
});

// Column SQL types. STRICT enforces them at insert; `INTEGER` columns back `z.number().int()`
// fields, `REAL` columns back plain `z.number()`, the rest are `TEXT`. NOT NULL mirrors the
// non-nullable schema fields (`operational_classes` serializes to "[]", never null).
const DDL = `CREATE TABLE aircraft (
  source TEXT NOT NULL,
  source_id TEXT PRIMARY KEY,
  registration TEXT NOT NULL,
  icao_hex TEXT,
  icao_type_code TEXT,
  status TEXT,
  country TEXT NOT NULL,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  year_manufactured INTEGER,
  airframe_type TEXT,
  category TEXT,
  build_certification TEXT,
  airworthiness_class TEXT,
  airworthiness_class_source_text TEXT,
  operating_environment TEXT,
  operational_classes TEXT NOT NULL,
  operational_classes_source_text TEXT NOT NULL,
  engine_manufacturer TEXT,
  engine_model TEXT,
  engine_type TEXT,
  engine_count INTEGER,
  engine_horsepower REAL,
  engine_thrust_lbs REAL,
  owner_name TEXT,
  owner_kind TEXT,
  owner_state TEXT,
  owner_country TEXT,
  operator_name TEXT,
  operator_kind TEXT,
  operator_state TEXT,
  operator_country TEXT,
  legal_owner_name TEXT,
  legal_owner_kind TEXT,
  legal_owner_state TEXT,
  legal_owner_country TEXT,
  propeller TEXT,
  home_base TEXT,
  idera_authorised_party TEXT,
  certification_date TEXT,
  airworthiness_date TEXT,
  expiration_date TEXT,
  last_action_date TEXT,
  cruise_speed_ktas REAL,
  max_takeoff_weight_kg REAL,
  seats INTEGER,
  max_passengers INTEGER,
  min_crew INTEGER,
  airworthiness_review_date TEXT,
  cancellation_reason TEXT,
  cancellation_reason_source_text TEXT,
  lien_status TEXT,
  lien_status_source_text TEXT,
  interdiction_code TEXT
) STRICT`;

// Indexed for the common consumer filters; `source_id` is already the PK.
const INDEXES = [
  'CREATE INDEX idx_icao_hex ON aircraft (icao_hex)',
  'CREATE INDEX idx_registration ON aircraft (registration)',
  'CREATE INDEX idx_status ON aircraft (status)',
  'CREATE INDEX idx_airframe_type ON aircraft (airframe_type)',
  'CREATE INDEX idx_owner_country ON aircraft (owner_country)',
];

// One SQLite database per source: a row per aircraft with every canonical field as a typed column.
// Built in memory and returned as bytes for a direct R2 PUT — no filesystem.
export const buildSqlite = (records: Map<string, Aircraft>): Uint8Array => {
  const db = new Database(':memory:');
  try {
    // Producer shape marker — bump when the table layout or canonical record contract changes.
    // 7 widens the category and build_certification value domains; a version-aware consumer must
    // not read `restricted` or `light-sport` as if it were reading a version-6 artifact.
    // 8 narrows nine numeric columns to non-negative — engine_count, engine_horsepower,
    // engine_thrust_lbs, year_manufactured, cruise_speed_ktas, max_takeoff_weight_kg, seats,
    // max_passengers, min_crew — so a row carrying a negative value in any of them now fails
    // translation instead of reaching the artifact; a version-8-or-later consumer may rely on that.
    // 9 adds the propeller column — registers publish it as one undifferentiated free-text string,
    // so it is not a maker/model pair and the service does not compose it.
    // 10 widens the `status` value domain with `reserved`, for a mark held against a future
    // registration with no airframe behind it; a version-9-or-earlier consumer would read it as an
    // aircraft in some unnamed state rather than as no aircraft at all.
    // 11 adds the home_base column for the aerodrome a register names as the aircraft's base.
    // 12 makes status nullable, dropping the engine's blanket `?? 'other'` fallback for a blank or
    // unresolved cell; a version-11-or-earlier consumer would read every row as carrying a concrete
    // status and must not assume that here.
    db.run(`PRAGMA user_version = ${DB_SCHEMA_VERSION}`);
    db.run(DDL);
    for (const stmt of INDEXES) db.run(stmt);

    const rows = [...records.values()].sort(bySourceId);
    if (rows.length > 0) {
      const cols = Object.keys(toColumns(rows[0]));
      const placeholders = cols.map(() => '?').join(', ');
      const insert = db.prepare(
        `INSERT INTO aircraft (${cols.join(', ')}) VALUES (${placeholders})`
      );
      const insertAll = db.transaction((rs: Aircraft[]) => {
        for (const r of rs) insert.run(...Object.values(toColumns(r)));
      });
      insertAll(rows);
    }
    return db.serialize();
  } finally {
    db.close();
  }
};
