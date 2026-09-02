import { TextDecoder } from 'node:util';
import type {
  SourceConfig,
  FieldMapping,
  MergeDuplicatesConfig,
  JoinConfig,
} from './types/config.js';
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
    const columns = config.columns?.[config.primary] ?? [];
    return parsePdf(buf, {
      field_axis: pdf.field_axis,
      column_pos: pdf.column_pos,
      columns,
      anchor_pattern: pdf.anchor_pattern,
      allowed_anchorless_pages: pdf.allowed_anchorless_pages,
      before_first_anchor_reach: pdf.before_first_anchor_reach,
      before_first_anchor_pattern: pdf.before_first_anchor_pattern,
      // Loader validates anchor_field names a real column, so indexOf here is never -1.
      anchor_column: pdf.anchor_field ? columns.indexOf(pdf.anchor_field) : undefined,
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

// Asserts the mapped record count matches a total the source publishes about itself (e.g. a
// "Kokku ... /total" cell), failing the run loudly on mismatch so a dropped/added row or a
// preamble-count shift can't silently publish a wrong-size fleet. The pattern source is repo-
// controlled source YAML (justifies the non-literal-regexp suppression below, since it isn't
// runtime input); the loader also validates it's a syntactically valid regex with exactly one
// capture group. It's still matched against the decoded primary file — externally-fetched register
// content — so ReDoS risk is bounded by review, not by sandboxing: keep these patterns simple
// (bounded quantifiers, no nested unbounded repetition) and treat them as reviewed code at PR time.
const assertRecordCount = (
  config: SourceConfig,
  primaryBuf: Buffer,
  counts: { parsed: number; mapped: number },
  publishedTotal?: string
): void => {
  const check = config.record_count;
  if (!check) return;
  const against = check.against ?? 'mapped';
  const source = publishedTotal ?? new TextDecoder(config.encoding).decode(primaryBuf);
  const where = check.url ?? 'primary file';
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
  const expected = new RegExp(check.pattern).exec(source)?.[1];
  if (expected === undefined)
    throw new Error(`Source "${config.id}": record_count pattern matched no count in ${where}`);
  const actual = counts[against];
  if (actual !== Number(expected))
    throw new Error(
      `Source "${config.id}": ${against} ${actual} records but the source publishes ${expected}`
    );
};

// One line per distinct unrecognized value, carrying how many rows hit it — the magnitude is the
// part that says whether a code is a stray or half the register.
const reportUnmatchedLookups = (source: string): void => {
  const forSource = unmatchedLookups.get(source);
  if (forSource === undefined) return;
  for (const [key, rows] of [...forSource].sort((a, b) => b[1] - a[1])) {
    const [field, value] = key.split('\u0000');
    log('warn', 'map_lookup_default', { source, field, value, rows });
  }
  unmatchedLookups.delete(source);
};

// Keeps only the newest publication for a register whose feed accumulates snapshots instead of
// replacing them. Throws rather than returning nothing when the column holds no value anywhere: an
// upstream rename would otherwise drop every row, and a source that maps zero records is a
// far quieter failure than one that refuses to run.
const keepLatestSnapshot = (config: SourceConfig, rows: Row[]): Row[] => {
  const column = config.latest_snapshot_by;
  if (column === undefined || rows.length === 0) return rows;
  let latest = '';
  for (const row of rows) {
    const value = row[column] ?? '';
    if (value > latest) latest = value;
  }
  if (latest === '')
    throw new Error(
      `Source "${config.id}": latest_snapshot_by column "${column}" is empty on all ${rows.length} rows — renamed upstream?`
    );
  const kept = rows.filter((row) => (row[column] ?? '') === latest);
  // Dropping the bulk of the file is the normal case here, so say so: the count is what shows the
  // filter caught a real publication boundary rather than silently keeping one stray row.
  log('info', 'map_snapshot_filtered', {
    source: config.id,
    column,
    snapshot: latest,
    kept: kept.length,
    dropped: rows.length - kept.length,
  });
  return kept;
};

export async function mapRows(
  config: SourceConfig,
  files: Map<string, Buffer>,
  // Body of `record_count.url`, fetched by the caller: the engine reads files, never the network.
  publishedTotal?: string
): Promise<{ records: Map<string, Aircraft>; stats: EngineStats; retryable: boolean }> {
  unmatchedLookups.delete(config.id);
  const joinMaps = await buildJoinMaps(config, files);
  const missingSourceIdPolicy = buildMissingSourceIdPolicy(config);

  const primaryBuf = files.get(config.primary);
  if (!primaryBuf)
    throw new Error(`Primary file "${config.primary}" not found in downloaded files`);

  // Before assertJoinHits and the mapping loop, so joins are checked against the rows that will
  // actually be mapped and stats.total counts them rather than the whole accumulated history.
  const parsedRows = await parsePrimary(primaryBuf, config);
  const rows = keepLatestSnapshot(config, parsedRows);
  assertJoinHits(config, joinMaps, rows);

  const records = new Map<string, Aircraft>();
  // Raw merged row per source_id, used to detect a byte-identical re-publish.
  const seenRows = new Map<string, Row>();
  let failed = 0;
  // A subset of `failed`: collisions resolveRecency couldn't call, which fresh data from a later
  // publish can resolve on its own (see the RowOutcome comment above). Tracked separately so the
  // caller can retry only when EVERY failure this run is this class, never a mix that includes a
  // deterministic one.
  let ambiguousDuplicateFailed = 0;
  // Tracked apart from duplicate skips: only missing-id skips count against the missing-id budget.
  let missingIdSkipped = 0;
  let duplicateSkipped = 0;

  const sourceIdMapping: FieldMapping = {
    field: config.source_id,
    transform: config.source_id_transform ?? 'trim_or_null',
  };
  const ctx: MapRowContext = {
    config,
    joinMaps,
    missingSourceIdPolicy,
    seenRows,
    records,
    sourceIdMapping,
  };
  for (let i = 0; i < rows.length; i++) {
    const outcome = mapRow(rows[i], i, missingIdSkipped, ctx);
    if (outcome.status === 'skipped') {
      if (outcome.reason === 'missing_id') missingIdSkipped++;
      else duplicateSkipped++;
    } else if (outcome.status === 'failed') {
      failed++;
      if (outcome.reason === 'ambiguous_duplicate') ambiguousDuplicateFailed++;
    } else {
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
  // logging map_complete before a guard that can still throw would misreport the run as done.
  // Flushed before the count guard, not after: a record-count mismatch is upstream drift, and the
  // unrecognized values are the evidence for it — throwing first would withhold them from the only
  // run that needed them.
  reportUnmatchedLookups(config.id);
  if (failed === 0)
    assertRecordCount(
      config,
      primaryBuf,
      { parsed: parsedRows.length, mapped: records.size },
      publishedTotal
    );
  log('info', 'map_complete', { source: config.id, ...stats });
  // Retryable only when every failure this run is the ambiguous-duplicate class — a mix with even
  // one deterministic failure means retrying would burn a fresh download for nothing.
  return { records, stats, retryable: failed > 0 && failed === ambiguousDuplicateFailed };
}

type RowOutcome =
  | { status: 'ok'; id: string; record: Aircraft; row: Row }
  | { status: 'skipped'; reason: 'missing_id' | 'duplicate' }
  // 'ambiguous_duplicate' is a fresh-data problem, not a config bug: a same-status/same-date
  // collision with neither row a strict superset can resolve differently on a later publish (ANAC
  // has republished a corrected file within the same day after this exact failure). 'invalid' is a
  // schema-validation failure on a merged row — deterministic on the same bytes, re-fetching won't
  // change it. The caller uses this split to decide whether a fresh download is worth retrying.
  | { status: 'failed'; reason: 'invalid' | 'ambiguous_duplicate' };

type RecencyReason = 'cancelled_status' | 'newer_date' | 'strict_superset';

const populatedLeafCount = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return 0;
  if (Array.isArray(value)) return value.reduce((n: number, v) => n + populatedLeafCount(v), 0);
  if (typeof value === 'object')
    return Object.values(value).reduce((n: number, v) => n + populatedLeafCount(v), 0);
  return 1;
};

// A richer duplicate is safe only when every populated value in the sparse record is preserved.
// Counting fields alone would silently discard conflicting upstream values whenever one row also
// happened to contain an extra field.
const isPopulatedSubset = (sparse: unknown, rich: unknown): boolean => {
  if (sparse === null || sparse === undefined || sparse === '') return true;
  if (Array.isArray(sparse)) {
    if (!Array.isArray(rich)) return false;
    return sparse.every((value, index) => isPopulatedSubset(value, rich[index]));
  }
  if (typeof sparse === 'object') {
    if (typeof rich !== 'object' || rich === null || Array.isArray(rich)) return false;
    return Object.entries(sparse).every(([key, value]) =>
      isPopulatedSubset(value, Reflect.get(rich, key))
    );
  }
  return Object.is(sparse, rich);
};

const isStrictSuperset = (rich: Aircraft, sparse: Aircraft): boolean =>
  populatedLeafCount(rich) > populatedLeafCount(sparse) && isPopulatedSubset(sparse, rich);

// Resolves two rows sharing a reissued source_id within one source's file: a cancelled row never
// outranks a live one; otherwise the more recent known date wins; failing that, a strict canonical
// superset wins. Conflicting records are ambiguous collisions the caller must fail on rather than
// guess via file order.
function resolveRecency(
  candidate: Aircraft,
  incumbent: Aircraft
): { winner: 'candidate' | 'incumbent'; reason: RecencyReason } | null {
  // A null status is unknown, not evidence of being live — it must not automatically outrank (or
  // be outranked by) a row that explicitly states cancelled. The shortcut only applies when both
  // sides have a concrete status that actually disagrees about cancelled-ness; otherwise it falls
  // through to date/superset, and ultimately to the ambiguous-collision failure below.
  if (candidate.status !== null && incumbent.status !== null) {
    const candidateCancelled = candidate.status === 'cancelled';
    const incumbentCancelled = incumbent.status === 'cancelled';
    if (candidateCancelled !== incumbentCancelled) {
      return { winner: incumbentCancelled ? 'candidate' : 'incumbent', reason: 'cancelled_status' };
    }
  }

  const candidateDate = latestKnownDate(candidate);
  const incumbentDate = latestKnownDate(incumbent);
  if (candidateDate !== incumbentDate) {
    return {
      winner: (candidateDate ?? '') > (incumbentDate ?? '') ? 'candidate' : 'incumbent',
      reason: 'newer_date',
    };
  }

  if (isStrictSuperset(candidate, incumbent))
    return { winner: 'candidate', reason: 'strict_superset' };
  if (isStrictSuperset(incumbent, candidate))
    return { winner: 'incumbent', reason: 'strict_superset' };

  return null;
}

const getPath = (obj: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (node, key) => (node == null ? undefined : (node as Record<string, unknown>)[key]),
      obj
    );

// Every canonical path is an own property of a schema-validated record (all fields are required,
// nullable), so a missing own-property mid-traversal means the path isn't canonical. That guard is
// also what keeps a `__proto__`/`constructor` segment from walking onto Object.prototype and
// polluting it — such a segment is never an own property of a plain record.
const setPath = (obj: Record<string, unknown>, path: string, value: unknown): void => {
  const parents = path.split('.');
  const leaf = parents.pop() ?? path;
  let node = obj;
  for (const key of parents) {
    if (!Object.hasOwn(node, key)) throw new Error(`merge path "${path}" is not a canonical path`);
    const next = Reflect.get(node, key);
    if (next === null || typeof next !== 'object' || Array.isArray(next))
      throw new Error(`merge path "${path}" is not a canonical path`);
    node = next as Record<string, unknown>;
  }
  if (!Object.hasOwn(node, leaf)) throw new Error(`merge path "${path}" is not a canonical path`);
  node[leaf] = value;
};

// Arrays (operational_classes) are compared whole, not descended into — a differing element is a
// differing leaf, not a mergeable sub-path.
const isLeaf = (value: unknown): boolean =>
  value === null || typeof value !== 'object' || Array.isArray(value);

// Canonical dotted paths where two records' leaves differ. Used to gate merge_duplicates: a merge is
// safe only when every differing path is one the policy declares mergeable.
const collectDiffPaths = (a: unknown, b: unknown, prefix: string, out: Set<string>): void => {
  const keys = new Set([
    ...Object.keys((a as Record<string, unknown>) ?? {}),
    ...Object.keys((b as Record<string, unknown>) ?? {}),
  ]);
  for (const key of keys) {
    const av = (a as Record<string, unknown> | undefined)?.[key];
    const bv = (b as Record<string, unknown> | undefined)?.[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (isLeaf(av) || isLeaf(bv)) {
      if (!Bun.deepEquals(av, bv)) out.add(path);
    } else collectDiffPaths(av, bv, path, out);
  }
};

// Whether a differing canonical path is one the merge policy is allowed to reconcile. `fields` are
// concatenated (no value is lost). A set_on_merge path is exempt only when NEITHER row carries
// conflicting data there — each side null/empty, or already equal to the stamped value (the case on
// the 2nd+ merge, where the incumbent holds the stamp). Both sides are checked because the stamp is
// written over the incumbent: checking only the candidate would let file order decide whether real
// upstream data survives or the row fails. Real, differing data on either side falls through to
// recency and fails loud rather than being silently overwritten by the stamp.
const isReconcilablePath = (
  path: string,
  candidate: Aircraft,
  incumbent: Aircraft,
  policy: MergeDuplicatesConfig
): boolean => {
  if (policy.fields.includes(path)) return true;
  const setOnMerge = policy.set_on_merge;
  if (!setOnMerge || !Object.hasOwn(setOnMerge, path)) return false;
  const stamp = setOnMerge[path];
  const stampable = (value: unknown): boolean => value == null || value === '' || value === stamp;
  return stampable(getPath(candidate, path)) && stampable(getPath(incumbent, path));
};

// Folds a duplicate candidate into the incumbent: each policy field's new value is appended (joined
// by separator, skipping empties and values already present), then set_on_merge stamps its fixed
// values. Caller re-validates the result against the schema. A declared field holding a non-string
// value is a misconfiguration — merge can only concatenate strings — and throws rather than silently
// dropping the candidate's value.
const mergeDuplicateRecord = (
  incumbent: Aircraft,
  candidate: Aircraft,
  policy: MergeDuplicatesConfig
): unknown => {
  const merged = structuredClone(incumbent) as unknown as Record<string, unknown>;
  const separator = policy.separator ?? ', ';
  for (const field of policy.fields) {
    const incoming = getPath(candidate, field);
    if (incoming == null || incoming === '') continue;
    if (typeof incoming !== 'string')
      throw new Error(
        `merge_duplicates field "${field}" holds a non-string value; only string fields can be concatenated`
      );
    const existing = getPath(merged, field);
    if (typeof existing !== 'string' || existing === '') {
      setPath(merged, field, incoming);
      continue;
    }
    if (!existing.split(separator).includes(incoming))
      setPath(merged, field, `${existing}${separator}${incoming}`);
  }
  for (const [path, value] of Object.entries(policy.set_on_merge ?? {}))
    setPath(merged, path, value);
  return merged;
};

// Same id, differing only in paths the source declares mergeable (Chile lists one row per
// co-registered party): fold the candidate into the incumbent rather than treating it as a reissue
// collision. Null when any differing path is outside the policy — the caller then falls through to
// recency resolution, which fails loud rather than dropping upstream data.
const tryMergeDuplicate = (
  candidate: Aircraft,
  incumbent: Aircraft,
  policy: MergeDuplicatesConfig
): { record: unknown; fields: string[] } | null => {
  const diff = new Set<string>();
  collectDiffPaths(candidate, incumbent, '', diff);
  if (diff.size === 0) return null;
  if (![...diff].every((path) => isReconcilablePath(path, candidate, incumbent, policy)))
    return null;
  return { record: mergeDuplicateRecord(incumbent, candidate, policy), fields: [...diff] };
};

interface MapRowContext {
  config: SourceConfig;
  joinMaps: Map<string, Map<string, Row>>;
  missingSourceIdPolicy: MissingSourceIdPolicy | null;
  seenRows: Map<string, Row>;
  records: Map<string, Aircraft>;
  // config.source_id/source_id_transform never change across rows — built once per mapRows()
  // call instead of allocating an identical FieldMapping object on every row.
  sourceIdMapping: FieldMapping;
}

interface CollisionContext {
  candidate: Aircraft;
  incumbent: Aircraft;
  rawId: string;
  row: Row;
  rowNumber: number;
  config: SourceConfig;
}

// Same-source_id collision against the record already kept for that id: an identical canonical
// record is a duplicate, a policy-mergeable difference folds together, anything else resolves by
// recency (or fails). Returns the candidate outright only when it wins that resolution.
function resolveCollision(ctx: CollisionContext): RowOutcome {
  const { candidate, incumbent, rawId, row, rowNumber, config } = ctx;
  const logCtx = { source: config.id, row: rowNumber, source_id: rawId };

  // Raw rows can differ in a field the mapping never surfaces (e.g. ANAC's OPERADORES lists a
  // second party's UF differently between publishes) while mapping to the identical canonical
  // record. The raw-row exact-dup check upstream missed this; check the mapped record too before
  // falling to recency resolution, which would otherwise fail on a collision that isn't one.
  if (Bun.deepEquals(candidate, incumbent)) {
    log('warn', 'map_skip', {
      ...logCtx,
      reason:
        'exact duplicate row (canonical record identical; raw fields differ outside the schema)',
    });
    return { status: 'skipped', reason: 'duplicate' };
  }

  const mergePolicy = config.merge_duplicates;
  const merged = mergePolicy && tryMergeDuplicate(candidate, incumbent, mergePolicy);
  if (merged) {
    const revalidated = AircraftSchema.safeParse(merged.record);
    if (!revalidated.success) {
      log('error', 'map_invalid', {
        ...logCtx,
        msg: revalidated.error.issues.map((e) => e.message).join('; '),
      });
      return { status: 'failed', reason: 'invalid' };
    }
    log('warn', 'map_duplicate_id_merged', { ...logCtx, fields: merged.fields });
    return { status: 'ok', id: rawId, record: revalidated.data, row };
  }

  // Same id, different data: a mark reissue (e.g. NL-ILT deregisters then re-registers a balloon
  // under the same mark). Keep whichever row is actually newer instead of trusting file position —
  // resolve via status (a cancellation never outranks a live record), falling back to the most
  // recent known date. A collision with neither signal isn't a reissue; it means the source_id
  // assumption is wrong and last-wins would silently drop upstream data.
  const resolution = resolveRecency(candidate, incumbent);
  if (!resolution) {
    log('error', 'map_duplicate_id', {
      ...logCtx,
      reason:
        'no safe distinguishing signal (same status/date, neither record is a strict superset)',
    });
    return { status: 'failed', reason: 'ambiguous_duplicate' };
  }
  if (resolution.winner === 'incumbent') {
    log('warn', 'map_duplicate_id_stale', { ...logCtx, reason: resolution.reason });
    return { status: 'skipped', reason: 'duplicate' };
  }
  log('warn', 'map_duplicate_id_replaced', { ...logCtx, reason: resolution.reason });
  return { status: 'ok', id: rawId, record: candidate, row };
}

// Maps one row to its outcome (record / skipped / failed) with the appropriate log; the caller
// owns the counters and the insert. `missingIdSkipped` is the running missing-id skip count, used
// only for the missing-id bound — duplicate skips are counted separately so they can't consume it.
function mapRow(row: Row, i: number, missingIdSkipped: number, ctx: MapRowContext): RowOutcome {
  const { config, joinMaps, missingSourceIdPolicy, seenRows, records, sourceIdMapping } = ctx;
  const merged = mergeJoins(row, config, joinMaps);
  const rawId = resolveScalar(merged, sourceIdMapping, config.id);
  if (!rawId) {
    if (isAllowedMissingSourceIdRow(merged, missingSourceIdPolicy, missingIdSkipped)) {
      log('warn', 'map_skip', {
        source: config.id,
        row: i + 2,
        reason: 'allowed missing source_id',
      });
      return { status: 'skipped', reason: 'missing_id' };
    }
    log('error', 'map_invalid', {
      source: config.id,
      row: i + 2,
      reason: 'missing source_id',
    });
    return { status: 'failed', reason: 'invalid' };
  }

  // Byte-identical re-publish (e.g. ANAC's RAB ships some marks twice) — skip.
  const priorRow = seenRows.get(rawId);
  if (priorRow && Bun.deepEquals(priorRow, merged)) {
    log('warn', 'map_skip', {
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
      log('error', 'map_invalid', {
        source: config.id,
        row: i + 2,
        source_id: rawId,
        msg: parsed.error.issues.map((e) => e.message).join('; '),
      });
      return { status: 'failed', reason: 'invalid' };
    }

    const incumbent = priorRow && records.get(rawId);
    if (incumbent)
      return resolveCollision({
        candidate: parsed.data,
        incumbent,
        rawId,
        row: merged,
        rowNumber: i + 2,
        config,
      });
    return { status: 'ok', id: rawId, record: parsed.data, row: merged };
  } catch (err) {
    log('error', 'map_error', {
      source: config.id,
      row: i + 2,
      source_id: rawId,
      msg: errorMessage(err),
    });
    return { status: 'failed', reason: 'invalid' };
  }
}

// Distinctness scoped to the columns the merge actually reads — merge.fields plus any set_on_merge
// target — not the whole row. A register carries columns this join never maps (TC's STREET_NAME,
// MAIL_RECIPIENT, ACTIVE_FLAG); a stale value in one of those must not turn one real owner's
// duplicated row into a manufactured second party, the same tolerance the mapping's own comment
// documents for unread address columns. A row differing only in a set_on_merge target column (TC's
// TYPE_OF_OWNER_E) still counts as a second party, since that column is read, just not concatenated.
function countDistinctRows(group: Row[], relevantColumns: string[]): number {
  const signature = (row: Row): string =>
    JSON.stringify(relevantColumns.map((column) => row[column] ?? ''));
  return new Set(group.map(signature)).size;
}

// One key's rows, reduced to the single row the mapping reads. Byte-identical repeats collapse; a
// real difference is a conflict unless the join declares how its parties merge.
function resolveJoinGroup(config: SourceConfig, join: JoinConfig, key: string, group: Row[]): Row {
  const first = group[0];
  if (first === undefined || group.length === 1) return first ?? {};

  const merge = join.merge_duplicates;
  if (!merge) {
    if (group.some((row) => !Bun.deepEquals(first, row)))
      throw new Error(
        `Source "${config.id}": join "${join.name}" has conflicting duplicate key "${key}"`
      );
    return first;
  }

  // Each merged field is a deduplicated, blank-skipping bag of values, not an index-parallel array —
  // a party missing one field would otherwise desync that field's position against the others, and
  // the schema holds each as a single string with no positional contract for a reader to rely on.
  const separator = merge.separator ?? ', ';
  const merged: Row = { ...first };
  for (const field of merge.fields) {
    const seen: string[] = [];
    for (const row of group) {
      const value = row[field] ?? '';
      if (value !== '' && !seen.includes(value)) seen.push(value);
    }
    merged[field] = seen.join(separator);
  }
  // A key only "merged" when the group held more than one genuinely distinct party — byte-identical
  // repeats (e.g. a register listing the same party twice) are not co-ownership.
  const relevantColumns = [...merge.fields, ...Object.keys(merge.set_on_merge ?? {})];
  if (countDistinctRows(group, relevantColumns) > 1)
    for (const [field, value] of Object.entries(merge.set_on_merge ?? {})) merged[field] = value;
  return merged;
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
      const groups = new Map<string, Row[]>();
      for (const row of rows) {
        const key = row[join.key] ?? '';
        if (!key) continue;
        const group = groups.get(key);
        if (group) group.push(row);
        else groups.set(key, [row]);
      }
      const index = new Map<string, Row>();
      for (const [key, group] of groups) {
        index.set(key, resolveJoinGroup(config, join, key, group));
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
// Counted per distinct (field, value) for the run, not logged per row. An unrecognized code is a
// property of the register, so one row and 300,000 rows carry the same information — and at FAA's
// volume the per-row form emitted tens of thousands of identical lines, burying the errors someone
// actually needed to read. The count is reported once, with the total, in map_complete.
// Partitioned by source rather than one flat map: mapRows() is async, so two sources running
// concurrently would otherwise clear each other's counts and report each other's values.
const unmatchedLookups = new Map<string, Map<string, number>>();

function resolveLookup(
  value: string,
  lookup: Record<string, string | null>,
  defaultValue: string | null | undefined,
  field: string,
  source: string
): string | null {
  // hasOwn, not `!== undefined`: a cell equal to an inherited member ("valueOf", "__proto__")
  // must not return the prototype function.
  if (Object.hasOwn(lookup, value)) return lookup[value];
  if (defaultValue !== undefined) {
    if (value !== '') {
      const forSource = unmatchedLookups.get(source) ?? new Map<string, number>();
      const key = `${field}\u0000${value}`;
      forSource.set(key, (forSource.get(key) ?? 0) + 1);
      unmatchedLookups.set(source, forSource);
    }
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
  // Before the transform, so a sentinel never reaches one that would pass it through as a value.
  if (mapping.null_values?.includes(raw)) return mapping.default ?? null;

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

// status is the schema's one field where null carries feed-exclusion meaning distinct from any
// value a register could actually publish. A mapping's `default` exists to absorb a genuinely new
// or unrecognized status code (AU/FAA/NL/TC each enumerate many but not all) — not to paper over a
// blank cell as if the register had stated something. resolveScalar can't make that distinction
// generically without risking every other default-bearing field's established behavior, so status
// gets its own resolution here: a blank cell always stays null, and only a non-blank, unrecognized
// code falls to the default. `null_values` is not reproduced — no status mapping uses it.
function resolveStatusCompound(
  fm: FieldMapping,
  transform: NonNullable<FieldMapping['compound_transform']>,
  row: Row,
  source: string
): string | null {
  const fields = fm.fields ?? [];
  const values = fields.map((f) => row[f] ?? '');
  // Blankness is the transform's call here, not this function's: a compound status reads several
  // columns and only the transform knows whether the combination means "the register said nothing".
  // A null return therefore stays null rather than falling to `default`.
  const transformed = applyCompound(transform, values);
  if (transformed === null) return null;
  if (fm.lookup) return resolveLookup(transformed, fm.lookup, fm.default, fields.join(','), source);
  return transformed;
}

function resolveStatus(mapping: FieldMap, row: Row, source: string): string | null {
  const fm = mapping['status'];
  if (!fm) return null;
  if (fm.constant !== undefined) return fm.constant;
  if (fm.compound_transform) return resolveStatusCompound(fm, fm.compound_transform, row, source);
  const field = fm.field;
  if (!field) return fm.default ?? null;
  const raw = row[field] ?? '';
  const transformed = fm.transform ? applyScalar(fm.transform, raw) : raw;
  if (transformed === null || transformed === '') return null;
  if (fm.lookup) return resolveLookup(transformed, fm.lookup, fm.default, field, source);
  return transformed;
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

  const airworthinessClass = scalarField(m, row, 'airworthiness_class', s);
  const cancellationReason = scalarField(m, row, 'cancellation_reason', s);
  const lienStatus = scalarField(m, row, 'lien_status', s);
  const operationalClasses = arrField(m, row, 'operational_classes', s);
  const operationalClassesSourceText = arrField(m, row, 'operational_classes_source_text', s);

  // A *_source_text field mirrors its primary, except where the config already renders the primary
  // in English at parse time (deterministic transform, e.g. es-aesa's `clase` -> es_aesa_class_en);
  // that source declares an explicit `<field>_source_text` mapping back to the raw cell, which wins
  // or the untranslated original is lost.
  const sourceText = (field: string, mirrored: string | null): string | null =>
    scalarField(m, row, `${field}_source_text`, s) ?? mirrored;

  return {
    source: config.id,
    source_id: sourceId,
    registration: scalarField(m, row, 'registration', s),
    icao_hex: scalarField(m, row, 'icao_hex', s),
    icao_type_code: scalarField(m, row, 'icao_type_code', s),
    // resolveStatus, not scalarField — status is the one nullable canonical field, and its own
    // mapping-level `default` (AU/FAA/NL/TC use one for unrecognized codes) must not also catch a
    // blank cell, which states nothing at all rather than an unrecognized-but-stated code.
    status: resolveStatus(m, row, s),
    country: scalarField(m, row, 'country', s) ?? config.country,
    manufacturer: scalarField(m, row, 'manufacturer', s),
    model: scalarField(m, row, 'model', s),
    serial_number: scalarField(m, row, 'serial_number', s),
    year_manufactured: numField(m, row, 'year_manufactured', s),
    airframe_type: scalarField(m, row, 'airframe_type', s),
    category: scalarField(m, row, 'category', s),
    build_certification: scalarField(m, row, 'build_certification', s),
    airworthiness_class: airworthinessClass,
    airworthiness_class_source_text: sourceText('airworthiness_class', airworthinessClass),
    operating_environment: scalarField(m, row, 'operating_environment', s),
    operational_classes: operationalClasses,
    operational_classes_source_text: operationalClassesSourceText.length
      ? operationalClassesSourceText
      : operationalClasses,
    engine: {
      manufacturer: scalarField(m, row, 'engine.manufacturer', s),
      model: scalarField(m, row, 'engine.model', s),
      type: scalarField(m, row, 'engine.type', s),
      count: numField(m, row, 'engine.count', s),
      horsepower: numField(m, row, 'engine.horsepower', s),
      thrust_lbs: numField(m, row, 'engine.thrust_lbs', s),
    },
    propeller: scalarField(m, row, 'propeller', s),
    home_base: scalarField(m, row, 'home_base', s),
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
    cancellation_reason: cancellationReason,
    cancellation_reason_source_text: sourceText('cancellation_reason', cancellationReason),
    lien_status: lienStatus,
    lien_status_source_text: sourceText('lien_status', lienStatus),
    interdiction_code: scalarField(m, row, 'interdiction_code', s),
  };
}
