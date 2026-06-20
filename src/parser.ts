import { parse } from 'csv-parse';
import { readOds } from 'hucre/ods';
import { readXlsx } from 'hucre/xlsx';
import type { Sheet } from 'hucre';
import * as XLSX from 'xlsx';

export type Row = Record<string, string>;

export interface ParseOptions {
  encoding: 'utf8' | 'latin1';
  delimiter: string;
  trim: boolean;
  columns?: string[];
  // Preamble rows dropped before the header line (not data rows after it).
  skip_rows?: number;
}

// hucre handles modern .ods/.xlsx (OOXML/zip); xls routes to a separate SheetJS path.
export type HucreFormat = 'ods' | 'xlsx';

interface BaseSpreadsheetOptions {
  trim: boolean;
  columns?: string[];
  sheet?: string | number;
  // Number of leading rows to discard before parsing. When `columns` overrides the
  // header row, the file's own header row still appears at index 0 and would otherwise
  // be parsed as data; set `skip_rows: 1` to drop it. Defaults to 0.
  skip_rows?: number;
}

export interface ParseSpreadsheetOptions extends BaseSpreadsheetOptions {
  format: HucreFormat;
}

export type ParseXlsOptions = BaseSpreadsheetOptions;

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
  // from_line is 1-based and counts the header, so the header sits at skip_rows + 1.
  const fromLine = (options.skip_rows ?? 0) + 1;
  return new Promise((resolve, reject) => {
    parse(
      text,
      {
        delimiter: options.delimiter,
        columns,
        from_line: fromLine,
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

  const rawRows = sheet.rows.map((cells) => cells.map((c) => stringifyCell(c)));
  return shapeRows(rawRows, {
    trim: options.trim,
    columns: options.columns,
    skipRows: options.skip_rows ?? 0,
  });
}

// Parses legacy binary .xls (BIFF2–BIFF8 / OLE2) via SheetJS. Cells read raw (numeric serials
// kept; dates deferred to transforms). blankrows:false strips blank rows before skip_rows, so the
// xls path counts non-blank rows — unlike the hucre path (tw-caa's skip_rows relies on this).
// eslint-disable-next-line @typescript-eslint/require-await -- sync internals; async so throws become rejections
export async function parseXls(buf: Buffer, options: ParseXlsOptions): Promise<Row[]> {
  const wb = XLSX.read(buf, { type: 'buffer' });
  const name = pickXlsSheet(wb.SheetNames, options.sheet);
  const sheet = wb.Sheets[name];

  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: '',
    blankrows: false,
  });
  const rawRows = aoa.map((cells) => cells.map((c) => stringifyCell(c)));
  return shapeRows(rawRows, {
    trim: options.trim,
    columns: options.columns,
    skipRows: options.skip_rows ?? 0,
  });
}

interface ShapeOptions {
  trim: boolean;
  columns?: string[];
  skipRows: number;
}

// Shared row-shaping so hucre and SheetJS paths produce identical Row[] output.
const shapeRows = (rawRows: string[][], options: ShapeOptions): Row[] => {
  const sliced = rawRows.slice(options.skipRows);
  const trimmed = options.trim ? sliced.map((cells) => cells.map((c) => c.trim())) : sliced;
  const { headers, dataRows } = resolveHeadersAndData(trimmed, options.columns);
  return dataRows.map((cells) => headersToRow(headers, cells));
};

// Fail loud on a missing/out-of-range sheet; a silent empty result would let the writer delete
// the whole source. Mirrors pickXlsSheet.
const pickSheet = (sheets: Sheet[], selector: string | number | undefined): Sheet => {
  if (sheets.length === 0) throw new Error('Workbook contains no sheets');
  if (selector === undefined) return sheets[0];
  if (typeof selector === 'number') {
    if (selector >= sheets.length)
      throw new Error(
        `Sheet index ${selector} out of range (workbook has ${sheets.length} sheet(s))`
      );
    return sheets[selector];
  }
  const match = sheets.find((s) => s.name === selector);
  if (!match)
    throw new Error(
      `Sheet "${selector}" not found; available: ${sheets.map((s) => s.name).join(', ')}`
    );
  return match;
};

const pickXlsSheet = (names: string[], selector: string | number | undefined): string => {
  if (names.length === 0) throw new Error('Workbook contains no sheets');
  if (selector === undefined) return names[0];
  if (typeof selector === 'number') {
    if (selector >= names.length)
      throw new Error(
        `Sheet index ${selector} out of range (workbook has ${names.length} sheet(s))`
      );
    return names[selector];
  }
  const match = names.find((n) => n === selector);
  if (!match) throw new Error(`Sheet "${selector}" not found; available: ${names.join(', ')}`);
  return match;
};

const stringifyCell = (cell: unknown): string => {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'string') return cell;
  if (typeof cell === 'number' || typeof cell === 'boolean') return String(cell);
  if (cell instanceof Date) return cell.toISOString();
  // SheetJS error cells (e.g. #DIV/0!) surface as objects with a `w` formatted-value field.
  if (typeof cell === 'object' && 'w' in cell) {
    const { w } = cell as { w?: unknown };
    return typeof w === 'string' ? w : '';
  }
  return '';
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
