import { parse } from 'csv-parse';

export type Row = Record<string, string>;

export interface ParseOptions {
  encoding: 'utf8' | 'latin1';
  delimiter: string;
  trim: boolean;
}

// Headers are always normalized (trimmed) — registry CSVs (FAA, in particular) ship column
// names with trailing whitespace, which silently breaks every per-field lookup downstream.
export async function parseCSV(buf: Buffer, options: ParseOptions): Promise<Row[]> {
  const text = new TextDecoder(options.encoding).decode(buf);
  return new Promise((resolve, reject) => {
    parse(
      text,
      {
        delimiter: options.delimiter,
        columns: (header: string[]) => header.map((h) => h.trim()),
        skip_empty_lines: true,
        relax_column_count: true,
        relax_quotes: true,
        trim: options.trim,
      },
      (err, records: Row[]) => {
        if (err) reject(err);
        else resolve(records);
      }
    );
  });
}
