// Single source of truth: the unions derive from these arrays and the loader enums + transform
// handler maps key off them, so a new name won't compile without a handler.
export const SCALAR_TRANSFORMS = [
  'trim',
  'trim_or_null',
  'na_or_null',
  'lowercase',
  'uppercase',
  'int_or_null',
  'float_or_null',
  'date_yyyymmdd_or_null',
  'date_yyyy_slash_or_null',
  'date_dd_slash_or_null',
  'date_ddmmyyyy_or_null',
  'date_dmmmyy_or_null',
  'iso_date_only_or_null',
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
] as const;

export const ARRAY_TRANSFORMS = ['faa_cert_ops'] as const;

export const COMPOUND_TRANSFORMS = [
  'tc_airframe',
  'nl_ilt_airframe',
  'casa_airframe',
  'es_aesa_airframe',
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
  lookup?: Record<string, string>;
  default?: string | null;
}

export interface JoinConfig {
  name: string;
  file: string;
  key: string;
  on: string;
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
  // Known non-tabular rows in the CSV (e.g. a "N rows selected." trailer) whose cell count
  // differs from the header. Any ragged row beyond this budget fails the parse: a short row
  // silently nulls trailing fields and a long row silently drops cells. Defaults to 0.
  allowed_ragged_rows?: number;
  allowed_missing_source_id_rows?: AllowedMissingSourceIdRowsConfig;
  joins: JoinConfig[];
  source_id: string;
  source_id_transform?: ScalarTransformName;
  registration: string;
  cadence_days?: number;
  mapping: Record<string, FieldMapping>;
}
