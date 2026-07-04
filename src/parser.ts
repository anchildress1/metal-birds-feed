import { TextDecoder } from 'node:util';
import { parse } from 'csv-parse';
import { readOds } from 'hucre/ods';
import { readXlsx } from 'hucre/xlsx';
import type { Sheet } from 'hucre';
import * as XLSX from 'xlsx';
import { extractTextItems, getDocumentProxy } from 'unpdf';

export type Row = Record<string, string>;

export interface ParseOptions {
  encoding: 'utf8' | 'latin1';
  delimiter: string;
  trim: boolean;
  columns?: string[];
  // Preamble rows dropped before the header line (not data rows after it).
  skip_rows?: number;
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
  const columns =
    options.columns ?? ((header: string[]) => assertUniqueHeaders(header.map((h) => h.trim())));
  // from_line is 1-based and counts the header, so the header sits at skip_rows + 1.
  const fromLine = (options.skip_rows ?? 0) + 1;
  if (options.columns && (options.skip_rows ?? 0) >= 1) {
    assertDiscardedHeaderWidth(await parseSkippedRegion(text, options), options.columns);
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

// eslint-disable-next-line @typescript-eslint/require-await -- sync internals; async so a parse throw becomes a rejection, matching the other parsers
export async function parseJson(buf: Buffer, options: ParseJsonOptions): Promise<Row[]> {
  const text = new TextDecoder(options.encoding).decode(buf);
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
}

const navigateToArray = (root: unknown, path: string | undefined): unknown[] => {
  let node: unknown = root;
  if (path) {
    for (const key of path.split('.')) {
      if (node === null || typeof node !== 'object') {
        throw new TypeError(`JSON record_path "${path}" does not resolve to an object at "${key}"`);
      }
      node = (node as Record<string, unknown>)[key];
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
  });
};

// Parses legacy binary .xls (BIFF2–BIFF8 / OLE2) via SheetJS. Cells read raw (numeric serials kept;
// dates deferred to transforms).
// eslint-disable-next-line @typescript-eslint/require-await -- sync internals; async so throws become rejections
export async function parseXls(buf: Buffer, options: ParseXlsOptions): Promise<Row[]> {
  const wb = XLSX.read(buf, { type: 'buffer' });
  return sheetToRows(wb.Sheets[pickXlsSheet(wb.SheetNames, options.sheet)], options);
}

export type ParseHtmlOptions = BaseSpreadsheetOptions & { encoding: 'utf8' | 'latin1' };

// Parses an HTML page whose register is a server-rendered <table> (e.g. Estonia's Transpordiamet,
// which embeds the full fleet as one table with no separate data API). SheetJS turns each <table>
// into a sheet; with no `sheet` selector the first table is used, and the same column/skip_rows
// shaping as the spreadsheet paths applies. A page with no parseable table makes SheetJS throw,
// failing the run loudly rather than yielding an empty set. Dynamic page chrome never reaches the
// artifact because content_hash is over the parsed records, not the raw page.
// eslint-disable-next-line @typescript-eslint/require-await -- sync internals; async so throws become rejections
export async function parseHtml(buf: Buffer, options: ParseHtmlOptions): Promise<Row[]> {
  const html = new TextDecoder(options.encoding).decode(buf);
  const wb = XLSX.read(html, { type: 'string' });
  return sheetToRows(wb.Sheets[pickXlsSheet(wb.SheetNames, options.sheet)], options);
}

export interface ParsePdfOptions {
  field_axis: 'x' | 'y';
  // Value-band coordinate per field on `field_axis`, index-paired with `columns`.
  column_pos: number[];
  columns: string[];
  anchor_pattern: string;
  trim: boolean;
}

interface PdfItem {
  str: string;
  x: number;
  y: number;
}

const axisCoord = (it: PdfItem, axis: 'x' | 'y'): number => (axis === 'x' ? it.x : it.y);

// Index of the position nearest to `value`. Used both to snap an item to its field band and to its
// record (anchor) along the record axis.
const nearestIndex = (positions: number[], value: number): number => {
  let best = 0;
  let bestDist = Math.abs(positions[0] - value);
  for (let i = 1; i < positions.length; i++) {
    const d = Math.abs(positions[i] - value);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
};

// Half the smallest gap between adjacent records. Used as the outer reach beyond the first/last
// record so the repeated header-label column (a half-slot outside the record range) and the
// page-footer text are dropped, while every real cell line (which clusters tighter than half a slot
// around its record) is kept. A lone record on a page has no gap, so reach is unbounded.
const outerSpread = (sortedCoords: number[]): number => {
  if (sortedCoords.length < 2) return Infinity;
  let min = Infinity;
  for (let i = 1; i < sortedCoords.length; i++) {
    min = Math.min(min, sortedCoords[i] - sortedCoords[i - 1]);
  }
  return min / 2;
};

const pushTo = (m: Map<number, PdfItem[]>, key: number, it: PdfItem): void => {
  const arr = m.get(key);
  if (arr) arr.push(it);
  else m.set(key, [it]);
};

// Joins each field's items into a cell, ordered in reading order along the record axis (ascending
// when records run along x, descending when along y — PDF y grows upward). Wrapped lines are joined
// with "\n" so line-slicing transforms (first/last line) can recover structure.
const buildPdfRow = (
  cells: Map<number, PdfItem[]>,
  options: ParsePdfOptions,
  recordAxis: 'x' | 'y'
): Row => {
  const dir = recordAxis === 'x' ? 1 : -1;
  const row: Row = {};
  for (const [fi, its] of cells) {
    its.sort((a, b) => dir * (axisCoord(a, recordAxis) - axisCoord(b, recordAxis)));
    const text = its.map((t) => (options.trim ? t.str.trim() : t.str)).join('\n');
    const name = options.columns[fi];
    if (name !== undefined) row[name] = text;
  }
  return row;
};

const toPdfItems = (raw: { str: string; x: number; y: number }[]): PdfItem[] =>
  raw.filter((i) => i.str.trim().length > 0).map((i) => ({ str: i.str, x: i.x, y: i.y }));

const parsePdfPage = (page: PdfItem[], options: ParsePdfOptions, anchorRe: RegExp): Row[] => {
  const recordAxis: 'x' | 'y' = options.field_axis === 'y' ? 'x' : 'y';
  const anchors = page
    .filter((it) => anchorRe.test(it.str.trim()))
    .sort((a, b) => axisCoord(a, recordAxis) - axisCoord(b, recordAxis));
  if (anchors.length === 0) return [];

  const anchorCoords = anchors.map((a) => axisCoord(a, recordAxis));
  const spread = outerSpread(anchorCoords);
  const lo = anchorCoords[0] - spread;
  // anchors is non-empty (guarded above), so first/last coords are defined.
  const hi = anchorCoords.at(-1)! + spread;

  const buckets = anchors.map(() => new Map<number, PdfItem[]>());
  for (const it of page) {
    const rc = axisCoord(it, recordAxis);
    if (rc < lo || rc > hi) continue;
    const ri = nearestIndex(anchorCoords, rc);
    const fi = nearestIndex(options.column_pos, axisCoord(it, options.field_axis));
    pushTo(buckets[ri], fi, it);
  }
  return buckets.map((cells) => buildPdfRow(cells, options, recordAxis));
};

// Reconstructs a positioned-coordinate PDF table into Row[]. Items are snapped to a field by nearest
// `column_pos` and to a record by nearest anchor along the perpendicular axis. See `PdfConfig`.
export async function parsePdf(buf: Buffer, options: ParsePdfOptions): Promise<Row[]> {
  // unpdf ships canvas/DOM-typed declarations our tsconfig cannot resolve (masked by skipLibCheck),
  // so its exports surface as untyped at this call boundary. The runtime values are correct; cast
  // the result to the structurally-known item shape to contain the untyped surface to this line.
  const { items } = (await extractTextItems(await getDocumentProxy(new Uint8Array(buf)))) as {
    items: PdfItem[][];
  };
  // Pattern source is `sources/<id>.yaml`, repo-controlled config validated by the loader.
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
  const anchorRe = new RegExp(options.anchor_pattern);
  const rows: Row[] = [];
  for (const [i, pageItems] of items.entries()) {
    const page = toPdfItems(pageItems);
    // A page with no text at all carries no records to lose. A page WITH text but zero anchor
    // matches means the template or mark format drifted on that page — its whole slice of the
    // fleet would vanish while the >0-records and 50%-floor guards stay green.
    if (page.length === 0) continue;
    const pageRows = parsePdfPage(page, options, anchorRe);
    if (pageRows.length === 0)
      throw new Error(
        `PDF page ${i + 1} has text but no anchor_pattern matches — page layout or mark format drifted`
      );
    rows.push(...pageRows);
  }
  return rows;
}

interface ShapeOptions {
  trim: boolean;
  columns?: string[];
  skipRows: number;
}

// Shared row-shaping so hucre and SheetJS paths produce identical Row[] output.
const shapeRows = (rawRows: string[][], options: ShapeOptions): Row[] => {
  if (options.columns && options.skipRows >= 1) {
    assertDiscardedHeaderWidth(rawRows.slice(0, options.skipRows), options.columns);
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
// any width.
const assertDiscardedHeaderWidth = (skippedRows: string[][], columns: string[]): void => {
  const header = skippedRows.findLast((cells) => cells.some((c) => c.trim().length > 0));
  if (header && header.length !== columns.length)
    throw new Error(
      `Explicit columns (${columns.length}) do not match the file's discarded header row (${header.length} cells) — upstream layout changed`
    );
};

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
