import { parse } from 'csv-parse';

export type Row = Record<string, string>;

export async function parseCSV(
  buf: Buffer,
  encoding: 'utf8' | 'latin1',
  delimiter: string
): Promise<Row[]> {
  const text = new TextDecoder(encoding).decode(buf);
  return new Promise((resolve, reject) => {
    parse(
      text,
      {
        delimiter,
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: false,
      },
      (err, records: Row[]) => {
        if (err) reject(err);
        else resolve(records);
      }
    );
  });
}
