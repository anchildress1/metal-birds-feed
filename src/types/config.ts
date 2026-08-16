// Single source of truth: the unions derive from these arrays and the loader enums + transform
// handler maps key off them, so a new name won't compile without a handler.
export const SCALAR_TRANSFORMS = [
  'trim',
  'trim_or_null',
  'na_or_null',
  'lowercase',
  'int_or_null',
  'float_or_null',
  'positive_float_or_null',
  'date_yyyymmdd_or_null',
  'date_yyyy_slash_or_null',
  'date_dd_slash_or_null',
  'date_ddmmyyyy_or_null',
  'date_dmmmyy_or_null',
  'iso_date_only_or_null',
  'iso_year_or_null',
  'first_line_or_null',
  'collapse_ws_or_null',
  'mv_idera_party',
  'excel_serial_year_or_null',
  'mph_to_ktas_or_null',
  'binary_to_hex_or_null',
  'faa_n_number',
  'faa_cert_class',
  'tc_full_registration',
  'nl_ilt_registration_or_null',
  'casa_full_registration',
  'casa_engine_detail_or_null',
  'br_registration',
  'br_airframe',
  'br_build_certification',
  'br_status',
  'br_party_name',
  'br_party_state',
  'br_party_kind',
  'es_aesa_detail_or_null',
  'es_aesa_class_en',
  'foca_hex_or_null',
  'foca_date_array_or_null',
  'foca_owner_name',
  'foca_owner_state',
  'foca_owner_kind',
  'foca_owner_country',
  'foca_operator_name',
  'foca_operator_state',
  'foca_operator_kind',
  'foca_operator_country',
  'ee_registration',
  'date_dd_dot_or_null',
  'no_hex_or_null',
  'no_owner_name',
  'no_owner_country',
  'no_owner_kind',
  'cl_registration',
  'last_comma_segment_or_null',
] as const;

export const ARRAY_TRANSFORMS = ['faa_cert_ops', 'no_airworthiness_classes'] as const;

export const COMPOUND_TRANSFORMS = [
  'tc_airframe',
  'nl_ilt_airframe',
  'casa_airframe',
  'es_aesa_airframe',
  'no_operator_kind',
] as const;

export type ScalarTransformName = (typeof SCALAR_TRANSFORMS)[number];

export type ArrayTransformName = (typeof ARRAY_TRANSFORMS)[number];

export type CompoundTransformName = (typeof COMPOUND_TRANSFORMS)[number];

export interface FieldMapping {
  field?: string;
  fields?: string[];
  constant?: string | null;
  transform?: ScalarTransformName;
  array_transform?: ArrayTransformName;
  compound_transform?: CompoundTransformName;
  // A null value means "this code is recognized, but the schema has no value for it" — distinct
  // from an absent key, which is unrecognized and fails the row (or takes `default`, loudly).
  // Without it, a source enumerating every upstream code would have to route its known-but-
  // unrepresentable codes through `default` and log a drift warning on each one.
  lookup?: Record<string, string | null>;
  // Raw cell values the register uses to state absence rather than to name something ("NĖRA" in
  // TKA Lithuania's home-base column). Matched verbatim against the cell before any transform or
  // lookup runs, and resolved exactly like a blank cell. Distinct from `lookup: {X: null}`, which
  // requires enumerating every other value in the column — unusable for free-text columns holding
  // hundreds of proper nouns, where the sentinel is the only value that is not data.
  null_values?: string[];
  default?: string | null;
}

export interface JoinConfig {
  name: string;
  file: string;
  key: string;
  on: string;
}

// Collapses rows that share a source_id but differ only in the listed canonical fields into one
// record, concatenating those fields instead of failing on the collision. Chile's register emits
// one row per co-registered party (same tail, differing NOMBRE DEL OPERADOR); merging preserves
// every party (no silent upstream loss) rather than dropping all but one. `fields` and any
// `set_on_merge` keys are the ONLY paths allowed to differ — a row differing anywhere else is a
// real collision and still falls through to recency resolution / failure.
export interface MergeDuplicatesConfig {
  // Canonical dotted paths (e.g. "operator.name") whose differing values are joined with `separator`.
  fields: string[];
  // Joiner between concatenated values; defaults to ", ". Chile uses " Y " to match its own
  // in-cell multi-party convention.
  separator?: string;
  // Canonical dotted paths stamped to a fixed value whenever a merge fires (e.g. operator.kind ->
  // co-owner). Applied after concatenation. A stamped path is exempt from the collision guard only
  // when neither row carries a conflicting value there (each null/empty or already the stamped
  // value); real, differing upstream data on either side fails loud instead of being silently
  // overwritten. Both sides matter because the stamp is written over the incumbent — guarding only
  // the candidate would let row order decide whether upstream data survives.
  set_on_merge?: Record<string, string | null>;
}

export type DownloadFormat = 'zip' | 'file';

export type DownloadMethod = 'GET' | 'POST';

export interface DownloadConfig {
  url: string;
  format: DownloadFormat;
  // Defaults to GET in the loader; absent on hand-built literals means GET.
  method?: DownloadMethod;
  // JSON request body, sent only when method is POST (e.g. the FOCA register's search endpoint
  // returns the full register for an empty-query POST). Serialized verbatim with JSON.stringify.
  body?: unknown;
  entries: Record<string, string>;
  headers?: Record<string, string>;
  // Bot-protection edges (CAA NZ sits behind Imperva) answer a cold, cookie-less request with a
  // 200 and a challenge page instead of the file — a success status carrying the wrong bytes.
  // Fetching this URL first and replaying the cookies it sets on the real request clears them.
  prime_url?: string;
  discover_url?: string;
  discover_pattern?: string;
}

export interface AllowedMissingSourceIdRowsConfig {
  max: number;
  field: string;
  pattern: string;
}

export type SourceFormat = 'csv' | 'ods' | 'xlsx' | 'xls' | 'json' | 'pdf' | 'html';

// Source-published fleet total used to catch silent structural drift. `pattern` is a regex with one
// capture group, matched against the decoded primary file; the engine asserts the translated record
// count equals that integer and fails the run on mismatch (e.g. a dropped row or a preamble-count
// shift that would otherwise publish a short fleet silently).
export interface RecordCountCheck {
  pattern: string;
}

// Coordinate-table extraction for PDFs whose rows/columns are positioned, not delimited.
// `field_axis` is the axis along which fields (columns) are distributed; the perpendicular axis is
// the record axis. Each field's value band sits at `column_pos[i]` on `field_axis`, paired by index
// with the field name in `columns[primary]`. One record per item matching `anchor_pattern`.
// (CAA Maldives publishes a 90°-rotated grid: fields run down y, records across x.)
export interface PdfConfig {
  field_axis: 'x' | 'y';
  column_pos: number[];
  anchor_pattern: string;
  // Budget of text-bearing pages expected to yield zero anchor matches (cover/preface/legend
  // pages). Any anchorless page beyond this fails the parse: a register page that silently loses
  // its anchors drops its whole fleet slice, and PDF sources cannot use record_count to catch it.
  // Defaults to 0 — declare cover pages explicitly rather than inferring them from position.
  allowed_anchorless_pages?: number;
}

export interface SourceConfig {
  id: string;
  label: string;
  country: string;
  // ISO 639-1 code of the language the register publishes in. `en` skips the Gemini pass entirely —
  // asking a translator to render English as English rewords curated values and mangles bare codes.
  language: string;
  encoding: 'utf8' | 'latin1';
  download: DownloadConfig;
  primary: string;
  delimiter: string;
  trim_all: boolean;
  format: SourceFormat;
  // Dot-path to the record array within a JSON response (e.g. "data.items"). Empty/omitted means
  // the response is itself the array. Only used when format is "json".
  record_path?: string;
  pdf?: PdfConfig;
  record_count?: RecordCountCheck;
  sheet?: string | number;
  skip_rows?: number;
  columns?: Record<string, string[]>;
  // Per parsed-file budget, keyed by the same aliases as `columns`: known non-tabular rows in
  // that CSV (e.g. a "N rows selected." trailer) whose cell count differs from the header. Any
  // ragged row beyond a file's budget fails the parse: a short row silently nulls trailing
  // fields and a long row silently drops cells. Defaults to 0 for every unlisted file.
  allowed_ragged_rows?: Record<string, number>;
  allowed_missing_source_id_rows?: AllowedMissingSourceIdRowsConfig;
  // Column naming the publication a row belongs to, for registers published as an accumulating
  // history rather than a current snapshot: every row not in the newest publication is dropped
  // before translation. Values compare as strings, so the format must sort lexicographically
  // (ISO-8601 dates do). Without it such a register serves stale rows — an aircraft deregistered in
  // the newest publication still has an active row in an older one, and the feed drops the
  // cancelled row and keeps the stale active one, answering a lookup with a wrong record.
  latest_snapshot_by?: string;
  joins: JoinConfig[];
  source_id: string;
  source_id_transform?: ScalarTransformName;
  registration: string;
  cadence_days?: number;
  merge_duplicates?: MergeDuplicatesConfig;
  mapping: Record<string, FieldMapping>;
}
