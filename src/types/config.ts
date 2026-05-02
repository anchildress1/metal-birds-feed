export type ScalarTransformName =
  | 'trim'
  | 'trim_or_null'
  | 'lowercase'
  | 'uppercase'
  | 'int_or_null'
  | 'float_or_null'
  | 'date_yyyymmdd_or_null'
  | 'mph_to_ktas_or_null'
  | 'faa_cert_class';

export type ArrayTransformName = 'faa_cert_ops';

export interface FieldMapping {
  field?: string;
  constant?: string | null;
  transform?: ScalarTransformName;
  array_transform?: ArrayTransformName;
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

export interface SourceConfig {
  id: string;
  label: string;
  country: string;
  encoding: 'utf8' | 'latin1';
  download: DownloadConfig;
  primary: string;
  delimiter: string;
  trim_all: boolean;
  joins: JoinConfig[];
  source_id: string;
  registration: string;
  mapping: Record<string, FieldMapping>;
}
