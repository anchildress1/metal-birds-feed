import { createHash } from 'node:crypto';
import type { SourceConfig, FieldMapping } from './types/config.js';
import { applyScalar, applyArray, applyCompound } from './transforms.js';
import { parseCSV, type Row } from './parser.js';
import { AircraftSchema, type Aircraft } from './schema.js';
import { log } from './logger.js';

export interface EngineStats {
  total: number;
  ok: number;
  failed: number;
  skipped: number;
}

export async function translate(
  config: SourceConfig,
  files: Map<string, Buffer>
): Promise<{ records: Map<string, Aircraft>; stats: EngineStats }> {
  const joinMaps = await buildJoinMaps(config, files);

  const primaryBuf = files.get(config.primary);
  if (!primaryBuf)
    throw new Error(`Primary file "${config.primary}" not found in downloaded files`);

  const primaryColumns = config.columns?.[config.primary];
  const rows = await parseCSV(primaryBuf, config.encoding, config.delimiter, primaryColumns);

  const records = new Map<string, Aircraft>();
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const merged = mergeJoins(row, config, joinMaps);

    const rawId = resolveScalar(
      merged,
      { field: config.source_id, transform: 'trim_or_null' },
      config.trim_all
    );
    if (!rawId) {
      log('warn', 'translate_skip', { source: config.id, row: i + 2, reason: 'missing source_id' });
      skipped++;
      continue;
    }

    try {
      const record = buildRecord(config, merged, rawId);
      const parsed = AircraftSchema.safeParse(record);
      if (!parsed.success) {
        log('error', 'translate_invalid', {
          source: config.id,
          row: i + 2,
          source_id: rawId,
          msg: parsed.error.issues.map((e) => e.message).join('; '),
        });
        failed++;
        continue;
      }
      records.set(rawId, parsed.data);
    } catch (err) {
      log('error', 'translate_error', {
        source: config.id,
        row: i + 2,
        source_id: rawId,
        msg: err instanceof Error ? err.message : String(err),
      });
      failed++;
    }
  }

  const stats: EngineStats = { total: rows.length, ok: records.size, failed, skipped };
  log('info', 'translate_complete', { source: config.id, ...stats });
  return { records, stats };
}

async function buildJoinMaps(
  config: SourceConfig,
  files: Map<string, Buffer>
): Promise<Map<string, Map<string, Row>>> {
  const entries = await Promise.all(
    config.joins.map(async (join) => {
      const buf = files.get(join.file);
      if (!buf) throw new Error(`Join file "${join.file}" not found`);
      const cols = config.columns?.[join.file];
      const rows = await parseCSV(buf, config.encoding, config.delimiter, cols);
      const index = new Map<string, Row>();
      for (const row of rows) {
        const key = row[join.key]?.trim() ?? '';
        if (key) index.set(key, row);
      }
      return [join.name, index] as const;
    })
  );
  return new Map(entries);
}

function mergeJoins(row: Row, config: SourceConfig, joinMaps: Map<string, Map<string, Row>>): Row {
  const merged: Row = { ...row };
  for (const join of config.joins) {
    const joinKey = row[join.on]?.trim() ?? '';
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
  const mapped = lookup[value];
  if (mapped !== undefined) return mapped;
  if (defaultValue !== undefined) return defaultValue;
  if (value === '') return null;
  throw new Error(`Unknown lookup value "${value}" for field "${field}"`);
}

function resolveCompound(row: Row, mapping: FieldMapping, trimAll: boolean): string | null {
  const fields = mapping.fields ?? [];
  const transform = mapping.compound_transform;
  if (!transform) return mapping.default ?? null;
  const values = fields.map((f) => {
    const raw = row[f] ?? '';
    return trimAll ? raw.trim() : raw;
  });
  const transformed = applyCompound(transform, values);
  if (transformed === null) return mapping.default ?? null;
  if (mapping.lookup) {
    return resolveLookup(transformed, mapping.lookup, mapping.default, fields.join(','));
  }
  return transformed;
}

function resolveScalar(row: Row, mapping: FieldMapping, trimAll: boolean): string | null {
  if (mapping.constant !== undefined) return mapping.constant;

  if (mapping.compound_transform) return resolveCompound(row, mapping, trimAll);

  const field = mapping.field;
  if (!field) return mapping.default ?? null;

  const raw = row[field] ?? '';
  const trimmed = trimAll ? raw.trim() : raw;
  const transformed = mapping.transform ? applyScalar(mapping.transform, trimmed) : trimmed;
  if (transformed === null) return mapping.default ?? null;

  if (mapping.lookup) return resolveLookup(transformed, mapping.lookup, mapping.default, field);

  return transformed === '' ? (mapping.default ?? null) : transformed;
}

function resolveArray(row: Row, mapping: FieldMapping, trimAll: boolean): string[] {
  const field = mapping.field;
  if (!field) return [];
  let value = row[field] ?? '';
  if (trimAll) value = value.trim();
  if (!mapping.array_transform) return [];
  return applyArray(mapping.array_transform, value);
}

function buildRecord(config: SourceConfig, row: Row, sourceId: string): unknown {
  const m = config.mapping;

  function scalar(key: string): string | null {
    const fm = m[key];
    if (!fm) return null;
    return resolveScalar(row, fm, config.trim_all);
  }

  function arr(key: string): string[] {
    const fm = m[key];
    if (!fm) return [];
    if (fm.array_transform) return resolveArray(row, fm, config.trim_all);
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
    certification_date: scalar('certification_date'),
    airworthiness_date: scalar('airworthiness_date'),
    expiration_date: scalar('expiration_date'),
    last_action_date: scalar('last_action_date'),
    cruise_speed_ktas: num('cruise_speed_ktas'),
  };
}

export function contentHash(record: Aircraft): string {
  return createHash('sha256').update(JSON.stringify(record)).digest('hex').slice(0, 16);
}
