import { parse } from 'csv-parse';
import { readOds } from 'hucre/ods';
import { readXlsx } from 'hucre/xlsx';
import type { CellValue, Sheet } from 'hucre';

export type Row = Record<string, string>;

export interface ParseOptions {
  encoding: 'utf8' | 'latin1';
  delimiter: string;
  trim: boolean;
  columns?: string[];
}

export type SpreadsheetFormat = 'ods' | 'xlsx';

export interface ParseSpreadsheetOptions {
  format: SpreadsheetFormat;
  trim: boolean;
  columns?: string[];
  sheet?: string | number;
  // Number of leading rows to discard before parsing. When `columns` overrides the
  // header row, the file's own header row still appears at index 0 and would otherwise
  // be parsed as data; set `skip_rows: 1` to drop it. Defaults to 0.
  skip_rows?: number;
}

// Headers are normalized (trimmed) when inferred from the first row, because registry CSVs
// (FAA, in particular) ship column names with trailing whitespace, which silently breaks every
// per-field lookup downstream. When `columns` is provided (headerless CSVs like Transport
// Canada's), the explicit array is used directly and no header row is consumed.
//
// Value trim runs in a `cast` callback rather than csv-parse's native `trim: true`, because
// `trim: true` interacts with quote parsing in a way that rejects FAA's `"B"-BALLOON` style
// (quoted-then-unquoted in the same field) even with relax_quotes. Trimming after the
// quote-handling pass sidesteps that regression.
export async function parseCSV(buf: Buffer, options: ParseOptions): Promise<Row[]> {
  const text = new TextDecoder(options.encoding).decode(buf);
  const cast = options.trim ? (value: string): string => value.trim() : undefined;
  const columns = options.columns ?? ((header: string[]) => header.map((h) => h.trim()));
  return new Promise((resolve, reject) => {
    parse(
      text,
      {
        delimiter: options.delimiter,
        columns,
        skip_empty_lines: true,
        relax_column_count: true,
        relax_quotes: true,
        cast,
      },
      (err, records: Row[]) => {
        if (err) reject(err);
        else resolve(records);
      }
    );
  });
}

// Parses .ods (OpenDocument Spreadsheet) and .xlsx via hucre. Returns the same Row[] shape
// as parseCSV so the engine can dispatch by source format and treat the rows uniformly.
//
// Header normalization mirrors parseCSV: when `columns` is provided, the explicit array is used
// directly and every spreadsheet row becomes a data row. Otherwise the first non-empty row is
// the header and trailing whitespace is trimmed from each header cell (Dutch ILT and other
// real-world spreadsheets ship space-padded headers, exactly like FAA's CSVs).
//
// Cell-value trim runs on each cell when `options.trim` is true; spreadsheet cells often carry
// whitespace from manual editing and the engine's downstream lookups assume clean strings.
export async function parseSpreadsheet(
  buf: Buffer,
  options: ParseSpreadsheetOptions
): Promise<Row[]> {
  const wb = options.format === 'ods' ? await readOds(buf) : await readXlsx(buf);
  const sheet = pickSheet(wb.sheets, options.sheet);
  if (!sheet) return [];

  const skipRows = options.skip_rows ?? 0;
  const rawRows = sheet.rows.slice(skipRows).map((cells) => cells.map((c) => stringifyCell(c)));
  const trimmed = options.trim ? rawRows.map((cells) => cells.map((c) => c.trim())) : rawRows;

  const { headers, dataRows } = resolveHeadersAndData(trimmed, options.columns);
  return dataRows.map((cells) => headersToRow(headers, cells));
}

const pickSheet = (sheets: Sheet[], selector: string | number | undefined): Sheet | undefined => {
  if (sheets.length === 0) return undefined;
  if (selector === undefined) return sheets[0];
  if (typeof selector === 'number') return sheets[selector];
  return sheets.find((s) => s.name === selector);
};

const stringifyCell = (cell: CellValue): string => {
  if (cell === null) return '';
  if (typeof cell === 'string') return cell;
  if (cell instanceof Date) return cell.toISOString();
  // CellValue is `string | number | boolean | Date | null` — only number/boolean remain.
  return String(cell);
};

const isNonEmptyRow = (cells: string[]): boolean => cells.some((c) => c.length > 0);

interface HeadersAndData {
  headers: string[];
  dataRows: string[][];
}

const resolveHeadersAndData = (
  rows: string[][],
  explicitColumns: string[] | undefined
): HeadersAndData => {
  if (explicitColumns) {
    return { headers: explicitColumns, dataRows: rows.filter(isNonEmptyRow) };
  }
  const headerIndex = rows.findIndex(isNonEmptyRow);
  if (headerIndex === -1) return { headers: [], dataRows: [] };
  const headers = rows[headerIndex].map((h) => h.trim());
  const dataRows = rows.slice(headerIndex + 1).filter(isNonEmptyRow);
  return { headers, dataRows };
};

const headersToRow = (headers: string[], cells: string[]): Row => {
  const row: Row = {};
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (header.length > 0) row[header] = cells[i] ?? '';
  }
  return row;
};
