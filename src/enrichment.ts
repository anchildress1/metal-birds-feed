import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import type { Aircraft } from './schema.js';
import { latestKnownDate } from './recency.js';
import { log, errorMessage } from './logger.js';

// The descriptive, hex-addressable slice of a record a consumer application renders for a plane:
// identity, airframe, engine, performance, and ownership. Excludes registry-admin bookkeeping the
// canonical record still carries (certification/airworthiness dates, legal_owner, lien/interdiction
// codes, operational classes) — none of that describes the aircraft to a spotter. PII beyond
// owner/operator name/state/country is already absent from the schema. `source` is provenance.
export interface EnrichmentRow {
  icao_hex: string;
  registration: string;
  icao_type_code: string | null;
  status: string;
  country: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  year_manufactured: number | null;
  airframe_type: string | null;
  category: string | null;
  engine_manufacturer: string | null;
  engine_model: string | null;
  engine_type: string | null;
  engine_count: number | null;
  engine_horsepower: number | null;
  engine_thrust_lbs: number | null;
  seats: number | null;
  max_passengers: number | null;
  cruise_speed_ktas: number | null;
  max_takeoff_weight_kg: number | null;
  owner_name: string | null;
  owner_kind: string | null;
  owner_state: string | null;
  owner_country: string | null;
  operator_name: string | null;
  operator_kind: string | null;
  operator_state: string | null;
  operator_country: string | null;
  source: string;
}

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

// The enrichment table is one row per icao_hex (its PK), but distinct source_ids can share a hex
// (reissue, re-registration). Pick a single winner deterministically so import order can't decide
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

// icao_hex is the only join key against OpenSky's icao24; a row without one is unreachable through
// the enrichment lookup, so it is dropped rather than stored unqueryable.
export const toEnrichmentRows = (records: Map<string, Aircraft>): EnrichmentRow[] => {
  const byHex = new Map<string, Aircraft>();
  for (const r of records.values()) {
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

// Values originate from the validated canonical schema, not user input; single-quote doubling is
// the only escaping a SQLite text literal requires. Emitting literals (not bound parameters) lets a
// single INSERT carry a full chunk without hitting D1's per-query bound-parameter ceiling. Numbers
// (year, engine count, weights, speeds) render bare; text is quoted.
export const sqlLiteral = (value: string | number | null): string => {
  if (value === null) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${value.replaceAll("'", "''")}'`;
};

const CHUNK_SIZE = 500;

// On a cross-source icao_hex collision, keep the live record: update on conflict only when the
// incoming row is not cancelled, or the row already stored is. This makes a cancelled record unable
// to overwrite a valid one regardless of which source imports last (within-source collisions are
// already resolved in toEnrichmentRows).
const CONFLICT_CLAUSE =
  `ON CONFLICT(icao_hex) DO UPDATE SET ${COLUMNS.filter((c) => c !== 'icao_hex')
    .map((c) => `${c} = excluded.${c}`)
    .join(', ')} ` + `WHERE excluded.status <> 'cancelled' OR enrichment.status = 'cancelled'`;

// One DELETE+INSERT script per source: the DELETE clears the source's prior rows (dropping
// deregistered tails the new run no longer emits), then a guarded upsert repopulates.
export const buildEnrichmentSql = (source: string, rows: EnrichmentRow[]): string => {
  const statements = [`DELETE FROM enrichment WHERE source = ${sqlLiteral(source)};`];
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const values = rows
      .slice(i, i + CHUNK_SIZE)
      .map((row) => `(${COLUMNS.map((c) => sqlLiteral(row[c])).join(', ')})`)
      .join(',\n');
    statements.push(
      `INSERT INTO enrichment (${COLUMNS.join(', ')}) VALUES\n${values}\n${CONFLICT_CLAUSE};`
    );
  }
  return `${statements.join('\n')}\n`;
};

// Env-gated, best-effort. Emits <MBF_ENRICH_SQL_DIR>/<source>.sql for `wrangler d1 execute --file`
// to load into the enrichment D1. R2 stays the source of truth; a failed emit logs and never fails
// the refresh run, since the artifact — not this derived cache — is the durable output.
export const writeEnrichmentSql = async (
  source: string,
  records: Map<string, Aircraft>
): Promise<void> => {
  const dir = process.env['MBF_ENRICH_SQL_DIR']?.trim();
  if (!dir) return;
  try {
    // MBF_ENRICH_SQL_DIR is the operator-chosen sandbox root (relative paths are fine — the README
    // uses them). Enforce that `<source>.sql` resolves inside it, so a traversal in `source` can't
    // escape and write elsewhere (AGENTS: no `..` in path inputs; enforce containment after resolve).
    const root = resolve(dir);
    const path = resolve(root, `${source}.sql`);
    if (!path.startsWith(root + sep)) {
      log('error', 'enrichment_sql_failed', { source, reason: 'path_escape' });
      return;
    }
    const rows = toEnrichmentRows(records);
    await mkdir(root, { recursive: true });
    await writeFile(path, buildEnrichmentSql(source, rows));
    log('info', 'enrichment_sql_written', { source, rows: rows.length });
  } catch (err) {
    log('error', 'enrichment_sql_failed', { source, msg: errorMessage(err) });
  }
};
