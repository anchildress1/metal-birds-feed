import { TextDecoder } from 'node:util';
import type { SourceConfig, FieldMapping } from './types/config.js';
import { applyScalar, applyArray, applyCompound } from './transforms.js';
import {
  parseCSV,
  parseSpreadsheet,
  parseXls,
  parseHtml,
  parseJson,
  parsePdf,
  type Row,
} from './parser.js';
import { AircraftSchema, type Aircraft } from './schema.js';
import { latestKnownDate } from './recency.js';
import { log, errorMessage } from './logger.js';

// Dispatches the primary-file parse based on `config.format`. Each branch routes to the parser for
// that format; the hucre spreadsheet path (ods/xlsx) is the fallthrough. Joins always read CSV —
// sources that need spreadsheet joins do not exist yet.
const parsePrimary = async (buf: Buffer, config: SourceConfig): Promise<Row[]> => {
  if (config.format === 'csv') {
    return parseCSV(buf, {
      encoding: config.encoding,
      delimiter: config.delimiter,
      trim: config.trim_all,
      columns: config.columns?.[config.primary],
      skip_rows: config.skip_rows,
      allowed_ragged_rows: config.allowed_ragged_rows?.[config.primary],
    });
  }
  if (config.format === 'xls') {
    return parseXls(buf, {
      trim: config.trim_all,
      columns: config.columns?.[config.primary],
      sheet: config.sheet,
      skip_rows: config.skip_rows,
    });
  }
  if (config.format === 'json') {
    return parseJson(buf, { encoding: config.encoding, record_path: config.record_path });
  }
  if (config.format === 'pdf') {
    const pdf = config.pdf;
    if (!pdf) throw new Error(`Source "${config.id}" has format "pdf" but no pdf config`);
    return parsePdf(buf, {
      field_axis: pdf.field_axis,
      column_pos: pdf.column_pos,
      columns: config.columns?.[config.primary] ?? [],
      anchor_pattern: pdf.anchor_pattern,
      allowed_anchorless_pages: pdf.allowed_anchorless_pages,
      trim: config.trim_all,
    });
  }
  if (config.format === 'html') {
    return parseHtml(buf, {
      encoding: config.encoding,
      trim: config.trim_all,
      columns: config.columns?.[config.primary],
      sheet: config.sheet,
      skip_rows: config.skip_rows,
    });
  }
  return parseSpreadsheet(buf, {
    format: config.format,
    trim: config.trim_all,
    columns: config.columns?.[config.primary],
    sheet: config.sheet,
    skip_rows: config.skip_rows,
  });
};

export interface EngineStats {
  total: number;
  ok: number;
  failed: number;
  skipped: number;
  duplicateSkipped: number;
}

interface MissingSourceIdPolicy {
  max: number;
  field: string;
  pattern: RegExp;
}

// Asserts the translated record count matches a total the source publishes about itself (e.g. a
// "Kokku ... /total" cell), failing the run loudly on mismatch so a dropped/added row or a
// preamble-count shift can't silently publish a wrong-size fleet. The pattern source is repo-
// controlled source YAML (justifies the non-literal-regexp suppression below, since it isn't
// runtime input); the loader also validates it's a syntactically valid regex with exactly one
// capture group. It's still matched against the decoded primary file — externally-fetched register
// content — so ReDoS risk is bounded by review, not by sandboxing: keep these patterns simple
// (bounded quantifiers, no nested unbounded repetition) and treat them as reviewed code at PR time.
const assertRecordCount = (config: SourceConfig, primaryBuf: Buffer, actual: number): void => {
  const check = config.record_count;
  if (!check) return;
  const text = new TextDecoder(config.encoding).decode(primaryBuf);
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
  const expected = new RegExp(check.pattern).exec(text)?.[1];
  if (expected === undefined)
    throw new Error(`Source "${config.id}": record_count pattern matched no count in primary file`);
  if (actual !== Number(expected))
    throw new Error(
      `Source "${config.id}": translated ${actual} records but the source publishes ${expected}`
    );
};

export async function translate(
  config: SourceConfig,
  files: Map<string, Buffer>
): Promise<{ records: Map<string, Aircraft>; stats: EngineStats }> {
  const joinMaps = await buildJoinMaps(config, files);
  const missingSourceIdPolicy = buildMissingSourceIdPolicy(config);

  const primaryBuf = files.get(config.primary);
  if (!primaryBuf)
    throw new Error(`Primary file "${config.primary}" not found in downloaded files`);

  const rows = await parsePrimary(primaryBuf, config);
  assertJoinHits(config, joinMaps, rows);

  const records = new Map<string, Aircraft>();
  // Raw merged row per source_id, used to detect a byte-identical re-publish.
  const seenRows = new Map<string, Row>();
  let failed = 0;
  // Tracked apart from duplicate skips: only missing-id skips count against the missing-id budget.
  let missingIdSkipped = 0;
  let duplicateSkipped = 0;

  const sourceIdMapping: FieldMapping = {
    field: config.source_id,
    transform: config.source_id_transform ?? 'trim_or_null',
  };
  const ctx: TranslateRowContext = {
    config,
    joinMaps,
    missingSourceIdPolicy,
    seenRows,
    records,
    sourceIdMapping,
  };
  for (let i = 0; i < rows.length; i++) {
    const outcome = translateRow(rows[i], i, missingIdSkipped, ctx);
    if (outcome.status === 'skipped') {
      if (outcome.reason === 'missing_id') missingIdSkipped++;
      else duplicateSkipped++;
    } else if (outcome.status === 'failed') failed++;
    else {
      records.set(outcome.id, outcome.record);
      seenRows.set(outcome.id, outcome.row);
    }
  }

  const skipped = missingIdSkipped + duplicateSkipped;
  const stats: EngineStats = {
    total: rows.length,
    ok: records.size,
    failed,
    skipped,
    duplicateSkipped,
  };
  // Runs before the "complete" log and only when there are no row-level failures: pipeline.ts's
  // own `stats.failed > 0` abort path already handles that case with a specific per-row error, and
  // logging translate_complete before a guard that can still throw would misreport the run as done.
  if (failed === 0) assertRecordCount(config, primaryBuf, records.size);
  log('info', 'translate_complete', { source: config.id, ...stats });
  return { records, stats };
}

type RowOutcome =
  | { status: 'ok'; id: string; record: Aircraft; row: Row }
  | { status: 'skipped'; reason: 'missing_id' | 'duplicate' }
  | { status: 'failed' };

type RecencyReason = 'cancelled_status' | 'newer_date';

// Resolves two rows sharing a reissued source_id within one source's file: a cancelled row never
// outranks a live one; otherwise the more recent known date wins. Returns null when neither status
// nor date distinguishes them — that's not a reissue signal, it's an ambiguous id collision the
// caller must fail on rather than guess via file order.
function resolveRecency(
  candidate: Aircraft,
  incumbent: Aircraft
): { winner: 'candidate' | 'incumbent'; reason: RecencyReason } | null {
  const candidateCancelled = candidate.status === 'cancelled';
  const incumbentCancelled = incumbent.status === 'cancelled';
  if (candidateCancelled !== incumbentCancelled) {
    return { winner: incumbentCancelled ? 'candidate' : 'incumbent', reason: 'cancelled_status' };
  }

  const candidateDate = latestKnownDate(candidate);
  const incumbentDate = latestKnownDate(incumbent);
  if (candidateDate !== incumbentDate) {
    return {
      winner: (candidateDate ?? '') > (incumbentDate ?? '') ? 'candidate' : 'incumbent',
      reason: 'newer_date',
    };
  }

  return null;
}

interface TranslateRowContext {
  config: SourceConfig;
  joinMaps: Map<string, Map<string, Row>>;
  missingSourceIdPolicy: MissingSourceIdPolicy | null;
  seenRows: Map<string, Row>;
  records: Map<string, Aircraft>;
  // config.source_id/source_id_transform never change across rows — built once per translate()
  // call instead of allocating an identical FieldMapping object on every row.
  sourceIdMapping: FieldMapping;
}

// Maps one row to its outcome (record / skipped / failed) with the appropriate log; the caller
// owns the counters and the insert. `missingIdSkipped` is the running missing-id skip count, used
// only for the missing-id bound — duplicate skips are counted separately so they can't consume it.
function translateRow(
  row: Row,
  i: number,
  missingIdSkipped: number,
  ctx: TranslateRowContext
): RowOutcome {
  const { config, joinMaps, missingSourceIdPolicy, seenRows, records, sourceIdMapping } = ctx;
  const merged = mergeJoins(row, config, joinMaps);
  const rawId = resolveScalar(merged, sourceIdMapping, config.id);
  if (!rawId) {
    if (isAllowedMissingSourceIdRow(merged, missingSourceIdPolicy, missingIdSkipped)) {
      log('warn', 'translate_skip', {
        source: config.id,
        row: i + 2,
        reason: 'allowed missing source_id',
      });
      return { status: 'skipped', reason: 'missing_id' };
    }
    log('error', 'translate_invalid', {
      source: config.id,
      row: i + 2,
      reason: 'missing source_id',
    });
    return { status: 'failed' };
  }

  // Byte-identical re-publish (e.g. ANAC's RAB ships some marks twice) — skip.
  const priorRow = seenRows.get(rawId);
  if (priorRow && Bun.deepEquals(priorRow, merged)) {
    log('warn', 'translate_skip', {
      source: config.id,
      row: i + 2,
      source_id: rawId,
      reason: 'exact duplicate row',
    });
    return { status: 'skipped', reason: 'duplicate' };
  }

  try {
    const parsed = AircraftSchema.safeParse(buildRecord(config, merged, rawId));
    if (!parsed.success) {
      log('error', 'translate_invalid', {
        source: config.id,
        row: i + 2,
        source_id: rawId,
        msg: parsed.error.issues.map((e) => e.message).join('; '),
      });
      return { status: 'failed' };
    }

    const incumbent = priorRow && records.get(rawId);
    if (incumbent) {
      // Raw rows can differ in a field the mapping never surfaces (e.g. ANAC's OPERADORES lists a
      // second party's UF differently between publishes) while mapping to the identical canonical
      // record. The raw-row exact-dup check above missed this; check the mapped record too before
      // falling to recency resolution, which would otherwise fail on a collision that isn't one.
      if (Bun.deepEquals(parsed.data, incumbent)) {
        log('warn', 'translate_skip', {
          source: config.id,
          row: i + 2,
          source_id: rawId,
          reason:
            'exact duplicate row (canonical record identical; raw fields differ outside the schema)',
        });
        return { status: 'skipped', reason: 'duplicate' };
      }

      // Same id, different data: a mark reissue (e.g. NL-ILT deregisters then re-registers a
      // balloon under the same mark). Keep whichever row is actually newer instead of trusting
      // file position — resolve via status (a cancellation never outranks a live record), falling
      // back to the most recent known date. A collision with neither signal isn't a reissue; it
      // means the source_id assumption is wrong and last-wins would silently drop upstream data.
      const resolution = resolveRecency(parsed.data, incumbent);
      if (!resolution) {
        log('error', 'translate_duplicate_id', {
          source: config.id,
          row: i + 2,
          source_id: rawId,
          reason: 'no distinguishing signal (same status, same or absent recency dates)',
        });
        return { status: 'failed' };
      }
      if (resolution.winner === 'incumbent') {
        log('warn', 'translate_duplicate_id_stale', {
          source: config.id,
          row: i + 2,
          source_id: rawId,
          reason: resolution.reason,
        });
        return { status: 'skipped', reason: 'duplicate' };
      }
      log('warn', 'translate_duplicate_id_replaced', {
        source: config.id,
        row: i + 2,
        source_id: rawId,
        reason: resolution.reason,
      });
    }
    return { status: 'ok', id: rawId, record: parsed.data, row: merged };
  } catch (err) {
    log('error', 'translate_error', {
      source: config.id,
      row: i + 2,
      source_id: rawId,
      msg: errorMessage(err),
    });
    return { status: 'failed' };
  }
}

async function buildJoinMaps(
  config: SourceConfig,
  files: Map<string, Buffer>
): Promise<Map<string, Map<string, Row>>> {
  const entries = await Promise.all(
    config.joins.map(async (join) => {
      const buf = files.get(join.file);
      if (!buf) throw new Error(`Join file "${join.file}" not found`);
      const rows = await parseCSV(buf, {
        encoding: config.encoding,
        delimiter: config.delimiter,
        trim: config.trim_all,
        columns: config.columns?.[join.file],
        allowed_ragged_rows: config.allowed_ragged_rows?.[join.file],
      });
      const index = new Map<string, Row>();
      for (const row of rows) {
        const key = row[join.key] ?? '';
        if (key) index.set(key, row);
      }
      return [join.name, index] as const;
    })
  );
  return new Map(entries);
}

function buildMissingSourceIdPolicy(config: SourceConfig): MissingSourceIdPolicy | null {
  const policy = config.allowed_missing_source_id_rows;
  if (!policy) return null;
  // Pattern source is `sources/<id>.yaml`, a repo-controlled config — not runtime input.
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
  const pattern = new RegExp(policy.pattern);
  return {
    max: policy.max,
    field: policy.field,
    pattern,
  };
}

function isAllowedMissingSourceIdRow(
  row: Row,
  policy: MissingSourceIdPolicy | null,
  skipped: number
): boolean {
  if (!policy || skipped >= policy.max) return false;
  const value = row[policy.field] ?? '';
  return policy.pattern.test(value);
}

// A declared join matching zero rows is upstream key drift or a broken join file — every record
// would lose that join's fields, and with all of them nullable the schema can't see the loss.
// Occasional misses are legal; a total miss is not.
const assertJoinHits = (
  config: SourceConfig,
  joinMaps: Map<string, Map<string, Row>>,
  rows: Row[]
): void => {
  if (rows.length === 0) return;
  for (const join of config.joins) {
    const map = joinMaps.get(join.name);
    // some() exits at the first hit — the guard only needs existence, not a count.
    const anyHit = rows.some((row) => map?.has(row[join.on] ?? ''));
    if (!anyHit)
      throw new Error(
        `Source "${config.id}": join "${join.name}" matched 0 of ${rows.length} rows — join key drifted upstream or the join file is broken`
      );
  }
};

function mergeJoins(row: Row, config: SourceConfig, joinMaps: Map<string, Map<string, Row>>): Row {
  const merged: Row = { ...row };
  for (const join of config.joins) {
    const joinKey = row[join.on] ?? '';
    const joinRow = joinMaps.get(join.name)?.get(joinKey) ?? {};
    for (const [k, v] of Object.entries(joinRow)) {
      merged[`${join.name}.${k}`] = v;
    }
  }
  return merged;
}

// A declared `default` absorbs any value the lookup table doesn't recognize, including a
// genuinely new/drifted upstream code — the schema still represents it (via the default), but
// with zero signal that a value the config author never anticipated came through. Every other
// bounded-skip mechanism in this engine (missing-id budget, ragged-row budget, anchorless-page
// budget) logs when it fires; this warns for the same reason, so a source that starts emitting an
// unrecognized code is visible in the run log instead of silently blending into "other".
function resolveLookup(
  value: string,
  lookup: Record<string, string>,
  defaultValue: string | null | undefined,
  field: string,
  source: string
): string | null {
  // hasOwn, not `!== undefined`: a cell equal to an inherited member ("valueOf", "__proto__")
  // must not return the prototype function.
  if (Object.hasOwn(lookup, value)) return lookup[value];
  if (defaultValue !== undefined) {
    if (value !== '') log('warn', 'translate_lookup_default', { source, field, value });
    return defaultValue;
  }
  if (value === '') return null;
  throw new Error(`Unknown lookup value "${value}" for field "${field}"`);
}

function resolveCompound(row: Row, mapping: FieldMapping, source: string): string | null {
  const fields = mapping.fields ?? [];
  const transform = mapping.compound_transform;
  if (!transform) return mapping.default ?? null;
  const values = fields.map((f) => row[f] ?? '');
  const transformed = applyCompound(transform, values);
  if (transformed === null) return mapping.default ?? null;
  if (mapping.lookup) {
    return resolveLookup(transformed, mapping.lookup, mapping.default, fields.join(','), source);
  }
  return transformed;
}

function resolveScalar(row: Row, mapping: FieldMapping, source: string): string | null {
  if (mapping.constant !== undefined) return mapping.constant;

  if (mapping.compound_transform) return resolveCompound(row, mapping, source);

  const field = mapping.field;
  if (!field) return mapping.default ?? null;

  const raw = row[field] ?? '';
  const transformed = mapping.transform ? applyScalar(mapping.transform, raw) : raw;
  if (transformed === null) return mapping.default ?? null;

  if (mapping.lookup) {
    return resolveLookup(transformed, mapping.lookup, mapping.default, field, source);
  }

  return transformed === '' ? (mapping.default ?? null) : transformed;
}

function resolveArray(row: Row, mapping: FieldMapping): string[] {
  const field = mapping.field;
  if (!field) return [];
  const value = row[field] ?? '';
  if (!mapping.array_transform) return [];
  return applyArray(mapping.array_transform, value);
}

// Module-level (not closures over `row`/`mapping` re-created per buildRecord call): buildRecord
// runs once per parsed row, so per-row closure allocation is real overhead at FAA's ~300k-row
// scale. Each helper takes the row/mapping it needs explicitly instead of capturing them.
type FieldMap = Record<string, FieldMapping>;

function scalarField(mapping: FieldMap, row: Row, key: string, source: string): string | null {
  const fm = mapping[key];
  if (!fm) return null;
  return resolveScalar(row, fm, source);
}

function arrField(mapping: FieldMap, row: Row, key: string, source: string): string[] {
  const fm = mapping[key];
  if (!fm) return [];
  if (fm.array_transform) return resolveArray(row, fm);
  const v = scalarField(mapping, row, key, source);
  return v ? [v] : [];
}

function numField(mapping: FieldMap, row: Row, key: string, source: string): number | null {
  const v = scalarField(mapping, row, key, source);
  if (v === null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

interface PartyFields {
  name: string | null;
  kind: string | null;
  state: string | null;
  country: string | null;
}

// owner/operator/legal_owner are all the same four sub-fields, keyed by prefix.
function partyFields(mapping: FieldMap, row: Row, prefix: string, source: string): PartyFields {
  return {
    name: scalarField(mapping, row, `${prefix}.name`, source),
    kind: scalarField(mapping, row, `${prefix}.kind`, source),
    state: scalarField(mapping, row, `${prefix}.state`, source),
    country: scalarField(mapping, row, `${prefix}.country`, source),
  };
}

function buildRecord(config: SourceConfig, row: Row, sourceId: string): unknown {
  const m = config.mapping;
  const s = config.id;
  return {
    source: config.id,
    source_id: sourceId,
    registration: scalarField(m, row, 'registration', s),
    icao_hex: scalarField(m, row, 'icao_hex', s),
    icao_type_code: scalarField(m, row, 'icao_type_code', s),
    status: scalarField(m, row, 'status', s) ?? 'other',
    country: scalarField(m, row, 'country', s) ?? config.country,
    manufacturer: scalarField(m, row, 'manufacturer', s),
    model: scalarField(m, row, 'model', s),
    serial_number: scalarField(m, row, 'serial_number', s),
    year_manufactured: numField(m, row, 'year_manufactured', s),
    airframe_type: scalarField(m, row, 'airframe_type', s),
    category: scalarField(m, row, 'category', s),
    build_certification: scalarField(m, row, 'build_certification', s),
    airworthiness_class: scalarField(m, row, 'airworthiness_class', s),
    operating_environment: scalarField(m, row, 'operating_environment', s),
    operational_classes: arrField(m, row, 'operational_classes', s),
    engine: {
      manufacturer: scalarField(m, row, 'engine.manufacturer', s),
      model: scalarField(m, row, 'engine.model', s),
      type: scalarField(m, row, 'engine.type', s),
      count: numField(m, row, 'engine.count', s),
      horsepower: numField(m, row, 'engine.horsepower', s),
      thrust_lbs: numField(m, row, 'engine.thrust_lbs', s),
    },
    owner: partyFields(m, row, 'owner', s),
    operator: partyFields(m, row, 'operator', s),
    legal_owner: partyFields(m, row, 'legal_owner', s),
    idera_authorised_party: scalarField(m, row, 'idera_authorised_party', s),
    certification_date: scalarField(m, row, 'certification_date', s),
    airworthiness_date: scalarField(m, row, 'airworthiness_date', s),
    expiration_date: scalarField(m, row, 'expiration_date', s),
    last_action_date: scalarField(m, row, 'last_action_date', s),
    cruise_speed_ktas: numField(m, row, 'cruise_speed_ktas', s),
    max_takeoff_weight_kg: numField(m, row, 'max_takeoff_weight_kg', s),
    seats: numField(m, row, 'seats', s),
    max_passengers: numField(m, row, 'max_passengers', s),
    min_crew: numField(m, row, 'min_crew', s),
    airworthiness_review_date: scalarField(m, row, 'airworthiness_review_date', s),
    cancellation_reason: scalarField(m, row, 'cancellation_reason', s),
    lien_status: scalarField(m, row, 'lien_status', s),
    interdiction_code: scalarField(m, row, 'interdiction_code', s),
  };
}
