import { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import type { Aircraft, Engine, Owner } from './schema.js';

const bySourceId = (a: Aircraft, b: Aircraft): number => {
  if (a.source_id < b.source_id) return -1;
  if (a.source_id > b.source_id) return 1;
  return 0;
};

// Content fingerprint over the sorted records, independent of SQLite's byte layout (which is not
// guaranteed stable run to run). Drives skip-if-unchanged.
export const hashRecords = (records: Map<string, Aircraft>): string => {
  const hash = createHash('sha256');
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
// values both derive from this one object, so they cannot drift in order or membership. The lone
// array (`operational_classes`) is serialized to a JSON string.
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
  operating_environment: r.operating_environment,
  operational_classes: JSON.stringify(r.operational_classes),
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
  lien_status: r.lien_status,
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
  status TEXT NOT NULL,
  country TEXT NOT NULL,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  year_manufactured INTEGER,
  airframe_type TEXT,
  category TEXT,
  build_certification TEXT,
  airworthiness_class TEXT,
  operating_environment TEXT,
  operational_classes TEXT NOT NULL,
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
  lien_status TEXT,
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
    db.run('PRAGMA user_version = 3');
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
