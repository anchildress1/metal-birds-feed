import type { SourceConfig, FieldMapping } from './types/config.js';
import { applyScalar, applyArray, applyCompound } from './transforms.js';
import { parseCSV, parseSpreadsheet, parseXls, parseJson, type Row } from './parser.js';
import { AircraftSchema, type Aircraft } from './schema.js';
import { log } from './logger.js';

// Dispatches the primary-file parse based on `config.format`. CSV is the existing path;
// `ods`/`xlsx` route to the hucre spreadsheet parser; legacy binary `xls` routes to the
// SheetJS-backed parser; `json` flattens an API response into rows. Joins always read CSV —
// sources that need spreadsheet joins do not exist yet.
const parsePrimary = async (buf: Buffer, config: SourceConfig): Promise<Row[]> => {
  if (config.format === 'csv') {
    return parseCSV(buf, {
      encoding: config.encoding,
      delimiter: config.delimiter,
      trim: config.trim_all,
      columns: config.columns?.[config.primary],
      skip_rows: config.skip_rows,
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
}

interface MissingSourceIdPolicy {
  max: number;
  field: string;
  pattern: RegExp;
}

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

  const records = new Map<string, Aircraft>();
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const outcome = translateRow(
      rows[i],
      i,
      config,
      joinMaps,
      missingSourceIdPolicy,
      skipped,
      records
    );
    if (outcome.status === 'skipped') skipped++;
    else if (outcome.status === 'failed') failed++;
    else records.set(outcome.id, outcome.record);
  }

  const stats: EngineStats = { total: rows.length, ok: records.size, failed, skipped };
  log('info', 'translate_complete', { source: config.id, ...stats });
  return { records, stats };
}

type RowOutcome =
  | { status: 'ok'; id: string; record: Aircraft }
  | { status: 'skipped' }
  | { status: 'failed' };

// Maps one row to its outcome (record / skipped / failed) with the appropriate log; the caller
// owns the counters and the insert. `skipped` is the running skip count, for the missing-id bound.
function translateRow(
  row: Row,
  i: number,
  config: SourceConfig,
  joinMaps: Map<string, Map<string, Row>>,
  missingSourceIdPolicy: MissingSourceIdPolicy | null,
  skipped: number,
  records: Map<string, Aircraft>
): RowOutcome {
  const merged = mergeJoins(row, config, joinMaps);
  const rawId = resolveSourceId(merged, config);
  if (!rawId) {
    if (isAllowedMissingSourceIdRow(merged, missingSourceIdPolicy, skipped)) {
      log('warn', 'translate_skip', {
        source: config.id,
        row: i + 2,
        reason: 'allowed missing source_id',
      });
      return { status: 'skipped' };
    }
    log('error', 'translate_invalid', {
      source: config.id,
      row: i + 2,
      reason: 'missing source_id',
    });
    return { status: 'failed' };
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
    // source_id is the source's permanent unique key; a duplicate means the id assumption is wrong
    // (e.g. a non-unique mark used as id) and last-wins would silently drop a record.
    if (records.has(rawId)) {
      log('error', 'translate_duplicate_id', { source: config.id, row: i + 2, source_id: rawId });
      return { status: 'failed' };
    }
    return { status: 'ok', id: rawId, record: parsed.data };
  } catch (err) {
    log('error', 'translate_error', {
      source: config.id,
      row: i + 2,
      source_id: rawId,
      msg: err instanceof Error ? err.message : String(err),
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

function resolveLookup(
  value: string,
  lookup: Record<string, string>,
  defaultValue: string | null | undefined,
  field: string
): string | null {
  // hasOwn, not `!== undefined`: a cell equal to an inherited member ("valueOf", "__proto__")
  // must not return the prototype function.
  if (Object.hasOwn(lookup, value)) return lookup[value];
  if (defaultValue !== undefined) return defaultValue;
  if (value === '') return null;
  throw new Error(`Unknown lookup value "${value}" for field "${field}"`);
}

function resolveCompound(row: Row, mapping: FieldMapping): string | null {
  const fields = mapping.fields ?? [];
  const transform = mapping.compound_transform;
  if (!transform) return mapping.default ?? null;
  const values = fields.map((f) => row[f] ?? '');
  const transformed = applyCompound(transform, values);
  if (transformed === null) return mapping.default ?? null;
  if (mapping.lookup) {
    return resolveLookup(transformed, mapping.lookup, mapping.default, fields.join(','));
  }
  return transformed;
}

function resolveScalar(row: Row, mapping: FieldMapping): string | null {
  if (mapping.constant !== undefined) return mapping.constant;

  if (mapping.compound_transform) return resolveCompound(row, mapping);

  const field = mapping.field;
  if (!field) return mapping.default ?? null;

  const raw = row[field] ?? '';
  const transformed = mapping.transform ? applyScalar(mapping.transform, raw) : raw;
  if (transformed === null) return mapping.default ?? null;

  if (mapping.lookup) return resolveLookup(transformed, mapping.lookup, mapping.default, field);

  return transformed === '' ? (mapping.default ?? null) : transformed;
}

function resolveArray(row: Row, mapping: FieldMapping): string[] {
  const field = mapping.field;
  if (!field) return [];
  const value = row[field] ?? '';
  if (!mapping.array_transform) return [];
  return applyArray(mapping.array_transform, value);
}

function resolveSourceId(row: Row, config: SourceConfig): string | null {
  if (config.source_id_compound_transform) {
    return resolveCompound(row, {
      fields: config.source_id_fields,
      compound_transform: config.source_id_compound_transform,
    });
  }
  if (!config.source_id) {
    throw new Error('Internal invariant violated: source_id is undefined but no source_id_compound_transform is configured');
  }
  return resolveScalar(row, {
    field: config.source_id,
    transform: config.source_id_transform ?? 'trim_or_null',
  });
}

function buildRecord(config: SourceConfig, row: Row, sourceId: string): unknown {
  const m = config.mapping;

  function scalar(key: string): string | null {
    const fm = m[key];
    if (!fm) return null;
    return resolveScalar(row, fm);
  }

  function arr(key: string): string[] {
    const fm = m[key];
    if (!fm) return [];
    if (fm.array_transform) return resolveArray(row, fm);
    const v = scalar(key);
    return v ? [v] : [];
  }

  function num(key: string): number | null {
    const v = scalar(key);
    if (v === null) return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }

  return {
    source: config.id,
    source_id: sourceId,
    registration: scalar('registration') ?? '',
    icao_hex: scalar('icao_hex'),
    icao_type_code: scalar('icao_type_code'),
    status: scalar('status') ?? 'other',
    country: scalar('country') ?? config.country,
    manufacturer: scalar('manufacturer'),
    model: scalar('model'),
    serial_number: scalar('serial_number'),
    year_manufactured: num('year_manufactured'),
    airframe_type: scalar('airframe_type'),
    category: scalar('category'),
    build_certification: scalar('build_certification'),
    airworthiness_class: scalar('airworthiness_class'),
    operating_environment: scalar('operating_environment'),
    operational_classes: arr('operational_classes'),
    engine: {
      manufacturer: scalar('engine.manufacturer'),
      model: scalar('engine.model'),
      type: scalar('engine.type'),
      count: num('engine.count'),
      horsepower: num('engine.horsepower'),
      thrust_lbs: num('engine.thrust_lbs'),
    },
    owner: {
      name: scalar('owner.name'),
      kind: scalar('owner.kind'),
      state: scalar('owner.state'),
      country: scalar('owner.country'),
    },
    operator: {
      name: scalar('operator.name'),
      kind: scalar('operator.kind'),
      state: scalar('operator.state'),
      country: scalar('operator.country'),
    },
    idera_authorised_party: scalar('idera_authorised_party'),
    certification_date: scalar('certification_date'),
    airworthiness_date: scalar('airworthiness_date'),
    expiration_date: scalar('expiration_date'),
    last_action_date: scalar('last_action_date'),
    cruise_speed_ktas: num('cruise_speed_ktas'),
    max_takeoff_weight_kg: num('max_takeoff_weight_kg'),
    seats: num('seats'),
    max_passengers: num('max_passengers'),
    min_crew: num('min_crew'),
    airworthiness_review_date: scalar('airworthiness_review_date'),
    cancellation_reason: scalar('cancellation_reason'),
    lien_status: scalar('lien_status'),
    interdiction_code: scalar('interdiction_code'),
  };
}
