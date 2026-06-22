import { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import type { Aircraft } from './schema.js';

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

// The canonical schema is fixed and known, so the artifact stores every field as a real column
// rather than an opaque JSON blob — consumers can filter/sort on any field (status, airframe_type,
// owner_country, year, …), not just the three former index keys. Nested objects flatten to
// `owner_*`/`operator_*`/`engine_*`; the one array (`operational_classes`) is a JSON string column.
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

// Insertion order; `rowValues` returns values in this exact order. Column names also appear in DDL
// (SQLite maps the INSERT column list by name, so DDL order is independent).
const COLUMNS = [
  'source',
  'source_id',
  'registration',
  'icao_hex',
  'icao_type_code',
  'status',
  'country',
  'manufacturer',
  'model',
  'serial_number',
  'year_manufactured',
  'airframe_type',
  'category',
  'build_certification',
  'airworthiness_class',
  'operating_environment',
  'operational_classes',
  'engine_manufacturer',
  'engine_model',
  'engine_type',
  'engine_count',
  'engine_horsepower',
  'engine_thrust_lbs',
  'owner_name',
  'owner_kind',
  'owner_state',
  'owner_country',
  'operator_name',
  'operator_kind',
  'operator_state',
  'operator_country',
  'idera_authorised_party',
  'certification_date',
  'airworthiness_date',
  'expiration_date',
  'last_action_date',
  'cruise_speed_ktas',
  'max_takeoff_weight_kg',
  'seats',
  'max_passengers',
  'min_crew',
  'airworthiness_review_date',
  'cancellation_reason',
  'lien_status',
  'interdiction_code',
] as const;

// Indexed for the common consumer filters; `source_id` is already the PK.
const INDEXES = [
  'CREATE INDEX idx_icao_hex ON aircraft (icao_hex)',
  'CREATE INDEX idx_registration ON aircraft (registration)',
  'CREATE INDEX idx_status ON aircraft (status)',
  'CREATE INDEX idx_airframe_type ON aircraft (airframe_type)',
  'CREATE INDEX idx_owner_country ON aircraft (owner_country)',
];

type Bind = string | number | null;

const rowValues = (r: Aircraft): Bind[] => [
  r.source,
  r.source_id,
  r.registration,
  r.icao_hex,
  r.icao_type_code,
  r.status,
  r.country,
  r.manufacturer,
  r.model,
  r.serial_number,
  r.year_manufactured,
  r.airframe_type,
  r.category,
  r.build_certification,
  r.airworthiness_class,
  r.operating_environment,
  JSON.stringify(r.operational_classes),
  r.engine.manufacturer,
  r.engine.model,
  r.engine.type,
  r.engine.count,
  r.engine.horsepower,
  r.engine.thrust_lbs,
  r.owner.name,
  r.owner.kind,
  r.owner.state,
  r.owner.country,
  r.operator.name,
  r.operator.kind,
  r.operator.state,
  r.operator.country,
  r.idera_authorised_party,
  r.certification_date,
  r.airworthiness_date,
  r.expiration_date,
  r.last_action_date,
  r.cruise_speed_ktas,
  r.max_takeoff_weight_kg,
  r.seats,
  r.max_passengers,
  r.min_crew,
  r.airworthiness_review_date,
  r.cancellation_reason,
  r.lien_status,
  r.interdiction_code,
];

// One SQLite database per source: a row per aircraft with every canonical field as a typed column.
// Built in memory and returned as bytes for a direct R2 PUT — no filesystem.
export const buildSqlite = (records: Map<string, Aircraft>): Uint8Array => {
  const db = new Database(':memory:');
  try {
    // Producer shape marker — bump when the table layout or canonical record contract changes.
    db.run('PRAGMA user_version = 2');
    db.run(DDL);
    for (const stmt of INDEXES) db.run(stmt);
    const placeholders = COLUMNS.map(() => '?').join(', ');
    const insert = db.prepare(
      `INSERT INTO aircraft (${COLUMNS.join(', ')}) VALUES (${placeholders})`
    );
    const insertAll = db.transaction((rows: Aircraft[]) => {
      for (const r of rows) insert.run(...rowValues(r));
    });
    insertAll([...records.values()].sort(bySourceId));
    return db.serialize();
  } finally {
    db.close();
  }
};
