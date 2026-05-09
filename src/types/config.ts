export type ScalarTransformName =
  | 'trim'
  | 'trim_or_null'
  | 'lowercase'
  | 'uppercase'
  | 'int_or_null'
  | 'float_or_null'
  | 'date_yyyymmdd_or_null'
  | 'date_yyyy_slash_or_null'
  | 'date_dd_slash_or_null'
  | 'iso_date_only_or_null'
  | 'mph_to_ktas_or_null'
  | 'binary_to_hex_or_null'
  | 'faa_n_number'
  | 'faa_cert_class'
  | 'tc_full_registration'
  | 'nl_ilt_registration_or_null'
  | 'casa_full_registration';

export type ArrayTransformName = 'faa_cert_ops';

export type CompoundTransformName = 'tc_airframe' | 'nl_ilt_airframe' | 'casa_airframe';

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

export interface DownloadConfig {
  url: string;
  format: DownloadFormat;
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

export type SourceFormat = 'csv' | 'ods' | 'xlsx';

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
  sheet?: string | number;
  skip_rows?: number;
  columns?: Record<string, string[]>;
  allowed_missing_source_id_rows?: AllowedMissingSourceIdRowsConfig;
  joins: JoinConfig[];
  source_id: string;
  source_id_transform?: ScalarTransformName;
  registration: string;
  mapping: Record<string, FieldMapping>;
}
