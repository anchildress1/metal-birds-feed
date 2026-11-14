import { TextDecoder } from 'node:util';
import { parse } from 'csv-parse';
import { readOds } from 'hucre/ods';
import { readXlsx } from 'hucre/xlsx';
import type { Sheet } from 'hucre';
import * as XLSX from 'xlsx';

export type Row = Record<string, string>;

// Strips a leading UTF-8 BOM (EF BB BF) at the byte level before decoding. TextDecoder only drops a
// BOM when it decodes as UTF-8; under latin1 the three bytes survive as `ï»¿` glued to the first
// header cell, silently renaming that column (FAA ships a BOM on ACFTREF/MASTER — unhandled it
// breaks the ACFTREF join and the N-NUMBER registration mapping). Byte-first strip is correct for
// both encodings and idempotent once removed.
const decodeText = (buf: Buffer, encoding: 'utf8' | 'latin1'): string => {
  const body =
    buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf
      ? buf.subarray(3)
      : buf;
  return new TextDecoder(encoding).decode(body);
};

export interface ParseOptions {
  encoding: 'utf8' | 'latin1';
  delimiter: string;
  trim: boolean;
  columns?: string[];
  // Leading rows dropped before parsing: banner/preamble lines, plus — when `columns` overrides
  // the header — the file's own header row (then the LAST dropped row; its width is asserted
  // against `columns`). Never data rows.
  skip_rows?: number;
  // Expected text of that discarded header row, index-paired with `columns`.
  header_text?: string[];
  // Budget for known non-tabular rows whose cell count differs from the header; see SourceConfig.
  allowed_ragged_rows?: number;
}

export interface ParseJsonOptions {
  encoding: 'utf8' | 'latin1';
  // Dot-path to the record array inside the JSON; empty/omitted means the response is the array.
  record_path?: string;
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
  // Expected text of the discarded header row, index-paired with `columns`.
  header_text?: string[];
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
  const text = decodeText(buf, options.encoding);
  const cast = options.trim ? (value: string): string => value.trim() : undefined;
  const columns =
    options.columns ?? ((header: string[]) => assertUniqueHeaders(header.map((h) => h.trim())));
  // from_line is 1-based and counts the header, so the header sits at skip_rows + 1.
  const fromLine = (options.skip_rows ?? 0) + 1;
  if (options.columns && (options.skip_rows ?? 0) >= 1) {
    assertDiscardedHeader(
      await parseSkippedRegion(text, options),
      options.columns,
      options.header_text
    );
  }
  const allowedRagged = options.allowed_ragged_rows ?? 0;
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
      (err, records: Row[], info?: { invalid_field_length: number }) => {
        const ragged = info?.invalid_field_length ?? 0;
        if (err) reject(err);
        // A ragged row is silent field loss — a short row nulls its trailing fields and a long
        // row drops cells — indistinguishable downstream from real nulls. Known non-tabular rows
        // (e.g. tc-ca's "N rows selected." trailer) are bounded by allowed_ragged_rows.
        else if (ragged > allowedRagged)
          reject(
            new Error(
              `CSV has ${ragged} row(s) whose cell count differs from the header (allowed: ${allowedRagged})`
            )
          );
        else resolve(records);
      }
    );
  });
}

// The rows skip_rows discards, parsed raggedly — banner lines above the header can be any width.
const parseSkippedRegion = (text: string, options: ParseOptions): Promise<string[][]> =>
  new Promise((resolve, reject) => {
    parse(
      text,
      {
        delimiter: options.delimiter,
        to_line: options.skip_rows,
        skip_empty_lines: true,
        relax_column_count: true,
        relax_quotes: true,
      },
      (err, records: string[][]) => {
        if (err) reject(err);
        else resolve(records);
      }
    );
  });

// Parses a JSON API response into the same Row[] shape as the spreadsheet/CSV paths. Each record
// is flattened to a string map so the existing field-mapping + transform machinery applies
// unchanged: nested objects become dot-path keys ("details.aircraftAddresses.hex"), and arrays are
// serialized back to a JSON string at their key so a source-specific transform can unpack them
// (mirrors how the Brazilian register packs owner/operator JSON into a single CSV cell).
// Human-readable JSON type for error messages — distinguishes null and array from plain 'object'.
const jsonType = (value: unknown): string => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
};

// Promise.try: sync internals, but a parse throw must surface as a rejection like the other parsers.
export function parseJson(buf: Buffer, options: ParseJsonOptions): Promise<Row[]> {
  return Promise.try(() => {
    const text = decodeText(buf, options.encoding);
    const parsed: unknown = JSON.parse(text);
    const records = navigateToArray(parsed, options.record_path);
    return records.map((record, i) => {
      // Fail fast at the boundary: a non-object record (number/string/array) would flatten to an
      // empty-key row and later surface as a vague "missing source_id" instead of the real cause.
      if (record === null || typeof record !== 'object' || Array.isArray(record)) {
        throw new TypeError(`JSON record at index ${i} is not an object (got ${jsonType(record)})`);
      }
      return flattenRecord(record);
    });
  });
}

const navigateToArray = (root: unknown, path: string | undefined): unknown[] => {
  let node: unknown = root;
  if (path) {
    for (const key of path.split('.')) {
      if (node === null || typeof node !== 'object') {
        throw new TypeError(`JSON record_path "${path}" does not resolve to an object at "${key}"`);
      }
      if (!Object.hasOwn(node, key)) {
        throw new TypeError(
          `JSON record_path "${path}" did not resolve to an array; missing own property "${key}"`
        );
      }
      node = Reflect.get(node, key);
    }
  }
  if (!Array.isArray(node)) {
    throw new TypeError(
      `JSON record_path "${path ?? ''}" did not resolve to an array (got ${jsonType(node)})`
    );
  }
  return node;
};

// Flattens one record into a string map. Objects recurse with dot-path prefixes; arrays are
// JSON-stringified whole (a transform unpacks them); scalars stringify; null/undefined are omitted
// so `row[field] ?? ''` yields the empty-string default the engine expects.
const flattenRecord = (record: unknown): Row => {
  const row: Row = {};
  const walk = (value: unknown, prefix: string): void => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      row[prefix] = JSON.stringify(value);
      return;
    }
    if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        walk(v, prefix ? `${prefix}.${k}` : k);
      }
      return;
    }
    // Only primitive leaves remain; symbols/functions are not valid JSON and are omitted.
    if (typeof value === 'string') row[prefix] = value;
    else if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint')
      row[prefix] = String(value);
  };
  walk(record, '');
  return row;
};

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
    headerText: options.header_text,
  });
}

// Shared SheetJS AOA→Row[] tail for the binary-xls and html-table paths: read the sheet as an
// array-of-arrays, stringify each cell, then run the common header/skip_rows shaping. blankrows:false
// strips blank rows before skip_rows, so both paths count non-blank rows — unlike the hucre
// ods/xlsx path (parseSpreadsheet), which doesn't strip blanks before slicing skip_rows
// (tw-caa's skip_rows relies on this xls/html-specific behavior).
const sheetToRows = (sheet: XLSX.WorkSheet, options: BaseSpreadsheetOptions): Row[] => {
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
    headerText: options.header_text,
  });
};

// Parses legacy binary .xls (BIFF2–BIFF8 / OLE2) via SheetJS. Cells read raw (numeric serials kept;
// dates deferred to transforms).
// Promise.try: sync internals, but a throw must surface as a rejection.
export function parseXls(buf: Buffer, options: ParseXlsOptions): Promise<Row[]> {
  return Promise.try(() => {
    const wb = XLSX.read(buf, { type: 'buffer' });
    return sheetToRows(wb.Sheets[pickXlsSheet(wb.SheetNames, options.sheet)], options);
  });
}

export type ParseHtmlOptions = BaseSpreadsheetOptions & { encoding: 'utf8' | 'latin1' };

// Parses an HTML page whose register is a server-rendered <table> (e.g. Estonia's Transpordiamet,
// which embeds the full fleet as one table with no separate data API). SheetJS turns each <table>
// into a sheet; with no `sheet` selector the first table is used, and the same column/skip_rows
// shaping as the spreadsheet paths applies. A page with no parseable table makes SheetJS throw,
// failing the run loudly rather than yielding an empty set. Dynamic page chrome never reaches the
// artifact because content_hash is over the parsed records, not the raw page.
// Promise.try: sync internals, but a throw must surface as a rejection.
export function parseHtml(buf: Buffer, options: ParseHtmlOptions): Promise<Row[]> {
  return Promise.try(() => {
    const html = decodeText(buf, options.encoding);
    // Without raw, SheetJS parses HTML cell text as values: serial "0123" loses its zero, "1-2"
    // becomes a date, "172E10" a number.
    const wb = XLSX.read(html, { type: 'string', raw: true });
    return sheetToRows(wb.Sheets[pickXlsSheet(wb.SheetNames, options.sheet)], options);
  });
}

interface ShapeOptions {
  trim: boolean;
  columns?: string[];
  skipRows: number;
  headerText?: string[];
}

// Shared row-shaping so hucre and SheetJS paths produce identical Row[] output.
const shapeRows = (rawRows: string[][], options: ShapeOptions): Row[] => {
  if (options.columns && options.skipRows >= 1) {
    assertDiscardedHeader(rawRows.slice(0, options.skipRows), options.columns, options.headerText);
  }
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

// Row assembly is last-wins per header name, so a duplicated header silently shadows the earlier
// column's data — and hand-maintained registry spreadsheets do ship duplicated labels. Empty
// names are padding cells that never carry data, so only non-empty duplicates are fatal.
const assertUniqueHeaders = (headers: string[]): string[] => {
  const seen = new Set<string>();
  for (const h of headers) {
    if (h.length === 0) continue;
    if (seen.has(h))
      throw new Error(`Duplicate header name "${h}" — the earlier column would be shadowed`);
    seen.add(h);
  }
  return headers;
};

// A source that declares `columns` pins the upstream layout, and the discarded header row is the
// only run-time witness to it. Width drift means a column was added or removed upstream —
// positional mapping would silently shift every field across the change, and row-count/hash
// guards can't see it. The last non-empty skipped row is the header; banners above it may be
// any width and carry volatile text (dates, counts), so only the header row is compared. Width
// alone misses two columns swapping places; `headerText` catches that and a rename.
const assertDiscardedHeader = (
  skippedRows: string[][],
  columns: string[],
  headerText: string[] | undefined
): void => {
  const header = skippedRows.findLast((cells) => cells.some((c) => c.trim().length > 0));
  if (!header) {
    if (headerText)
      throw new Error(
        `No non-empty discarded header row found; expected one starting "${headerText[0]}" — upstream layout changed`
      );
    return;
  }
  if (header.length !== columns.length)
    throw new Error(
      `Explicit columns (${columns.length}) do not match the file's discarded header row (${header.length} cells) — upstream layout changed`
    );
  const mismatches = (headerText ?? []).flatMap((expected, i) => {
    const actual = normalizeHeaderCell(header[i]);
    return actual === normalizeHeaderCell(expected)
      ? []
      : [`column ${i} reads "${actual}", expected "${expected}"`];
  });
  if (mismatches.length > 0)
    throw new Error(
      `Discarded header row does not match header_text — upstream layout changed: ${mismatches.join('; ')}`
    );
};

// Whitespace, nbsp included, is layout rather than wording: HTML and spreadsheet exports reflow it.
function normalizeHeaderCell(cell: string): string {
  return cell.replace(/\s+/g, ' ').trim();
}

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
  const headers = assertUniqueHeaders(rows[headerIndex].map((h) => h.trim()));
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
