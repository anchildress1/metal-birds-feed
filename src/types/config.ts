export type ScalarTransformName =
  | 'trim'
  | 'trim_or_null'
  | 'lowercase'
  | 'uppercase'
  | 'int_or_null'
  | 'float_or_null'
  | 'date_yyyymmdd_or_null'
  | 'date_yyyy_slash_or_null'
  | 'mph_to_ktas_or_null'
  | 'binary_to_hex_or_null'
  | 'faa_n_number'
  | 'faa_cert_class'
  | 'tc_full_registration';

export type ArrayTransformName = 'faa_cert_ops';

export type CompoundTransformName = 'tc_airframe';

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

export interface DownloadConfig {
  url: string;
  format: 'zip';
  entries: Record<string, string>;
  headers?: Record<string, string>;
}

export interface AllowedMissingSourceIdRowsConfig {
  max: number;
  field: string;
  pattern: string;
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
  columns?: Record<string, string[]>;
  allowed_missing_source_id_rows?: AllowedMissingSourceIdRowsConfig;
  joins: JoinConfig[];
  source_id: string;
  registration: string;
  mapping: Record<string, FieldMapping>;
}
