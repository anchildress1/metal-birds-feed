import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Aircraft } from './schema.js';
import { latestKnownDate } from './recency.js';
import { log, errorMessage } from './logger.js';

// The minimal, hex-addressable slice of a record that metal-birds-watch renders in a plane popup:
// registration, type, and owner. PII beyond owner/operator name+country is already absent from the
// canonical schema, so nothing is dropped here that the artifact still carries.
export interface EnrichmentRow {
  icao_hex: string;
  registration: string;
  airframe_type: string | null;
  manufacturer: string | null;
  model: string | null;
  owner_name: string | null;
  owner_country: string | null;
  operator_name: string | null;
  status: string;
  source: string;
}

const COLUMNS = [
  'icao_hex',
  'registration',
  'airframe_type',
  'manufacturer',
  'model',
  'owner_name',
  'owner_country',
  'operator_name',
  'status',
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
    airframe_type: r.airframe_type,
    manufacturer: r.manufacturer,
    model: r.model,
    owner_name: r.owner.name,
    owner_country: r.owner.country,
    operator_name: r.operator.name,
    status: r.status,
    source: r.source,
  }));
};

// Values originate from the validated canonical schema, not user input; single-quote doubling is
// the only escaping a SQLite text literal requires. Emitting literals (not bound parameters) lets a
// single INSERT carry a full chunk without hitting D1's per-query bound-parameter ceiling. Every
// enrichment column is text-or-null, so this handles exactly those two cases.
export const sqlLiteral = (value: string | null): string =>
  value === null ? 'NULL' : `'${value.replaceAll("'", "''")}'`;

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
    const rows = toEnrichmentRows(records);
    await mkdir(dir, { recursive: true });
    await writeFile(resolve(dir, `${source}.sql`), buildEnrichmentSql(source, rows));
    log('info', 'enrichment_sql_written', { source, rows: rows.length });
  } catch (err) {
    log('error', 'enrichment_sql_failed', { source, msg: errorMessage(err) });
  }
};
