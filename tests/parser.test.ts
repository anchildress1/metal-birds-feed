import { describe, it, expect } from 'vitest';
import { writeOds } from 'hucre/ods';
import { writeXlsx } from 'hucre/xlsx';
import * as XLSX from 'xlsx';
import { parseCSV, parseSpreadsheet, parseXls, type HucreFormat } from '../src/parser.js';

const buf = (s: string): Buffer => Buffer.from(s, 'latin1');
const opts = (
  overrides: Partial<{
    delimiter: string;
    trim: boolean;
    columns: string[];
    skip_rows: number;
  }> = {}
) => ({
  encoding: 'latin1' as const,
  delimiter: ',',
  trim: false,
  ...overrides,
});

describe('parseCSV', () => {
  it('parses a basic comma-delimited file with header row', async () => {
    const rows = await parseCSV(buf('CODE,MFR,MODEL\n001,CESSNA,172\n'), opts());
    expect(rows).toEqual([{ CODE: '001', MFR: 'CESSNA', MODEL: '172' }]);
  });

  it('preserves stray double-quote inside an unquoted field (FAA ACFTREF quirk)', async () => {
    // Mirrors the real-world FAA failure: MODEL value `BABY ACE "` triggers
    // INVALID_OPENING_QUOTE under default csv-parse settings.
    const rows = await parseCSV(
      buf('CODE,MFR,MODEL\n001,CORBEN,BABY ACE "\n002,KISSEL,GUNS"S\n'),
      opts()
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].MODEL).toBe('BABY ACE "');
    expect(rows[1].MODEL).toBe('GUNS"S');
  });

  it('tolerates rows with extra columns (relax_column_count)', async () => {
    const rows = await parseCSV(buf('A,B\n1,2,3\n'), opts());
    expect(rows[0].A).toBe('1');
    expect(rows[0].B).toBe('2');
  });

  it('skips fully empty lines', async () => {
    const rows = await parseCSV(buf('A,B\n1,2\n\n3,4\n'), opts());
    expect(rows).toHaveLength(2);
  });

  it('decodes latin1 bytes (non-ASCII manufacturer name)', async () => {
    const rows = await parseCSV(
      Buffer.from([0x4d, 0x46, 0x52, 0x0a, 0x42, 0xe9, 0x42, 0x45, 0x52, 0x0a]),
      opts()
    );
    expect(rows[0].MFR).toBe('BéBER');
  });

  it('supports a non-comma delimiter', async () => {
    const rows = await parseCSV(buf('A|B\n1|2\n'), opts({ delimiter: '|' }));
    expect(rows).toEqual([{ A: '1', B: '2' }]);
  });

  it('returns an empty array for header-only input', async () => {
    const rows = await parseCSV(buf('A,B\n'), opts());
    expect(rows).toEqual([]);
  });

  it('resolves to an empty array for completely empty input', async () => {
    await expect(parseCSV(buf(''), opts())).resolves.toEqual([]);
  });

  it('rejects when csv-parse encounters an unrecoverable structural error', async () => {
    await expect(parseCSV(buf('A,B\n"unterminated\n'), opts())).rejects.toThrow(
      /Quote Not Closed/i
    );
  });

  it('trims trailing whitespace from header names (FAA registry quirk)', async () => {
    // FAA's MASTER.txt headers are space-padded — `'N-NUMBER '` instead of `'N-NUMBER'`.
    // Without normalization, every per-field lookup downstream silently returns undefined.
    const rows = await parseCSV(buf('N-NUMBER ,SERIAL NUMBER \n12345,17282099\n'), opts());
    expect(rows[0]['N-NUMBER']).toBe('12345');
    expect(rows[0]['SERIAL NUMBER']).toBe('17282099');
    expect(rows[0]['N-NUMBER ']).toBeUndefined();
  });

  it('trims values when trim option is true', async () => {
    const rows = await parseCSV(buf('A,B\n  hello  ,  world  \n'), opts({ trim: true }));
    expect(rows[0]).toEqual({ A: 'hello', B: 'world' });
  });

  it('preserves value whitespace when trim option is false', async () => {
    const rows = await parseCSV(buf('A,B\n  hello  ,  world  \n'), opts({ trim: false }));
    expect(rows[0]).toEqual({ A: '  hello  ', B: '  world  ' });
  });

  it('parses quoted-then-unquoted in same field with trim enabled (FAA ACFTREF quirk)', async () => {
    // ACFTREF.txt line 38386: `"B"-BALLOON`. csv-parse's native trim: true rejects this
    // even with relax_quotes. Trimming in a cast callback sidesteps the regression.
    const rows = await parseCSV(
      buf('CODE,MFR,MODEL\n05630EP,HOLLROCK,"B"-BALLOON\n'),
      opts({ trim: true })
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].MODEL).toBe('"B"-BALLOON');
  });

  it('uses explicit columns when provided (no header row consumed)', async () => {
    const rows = await parseCSV(
      buf('001,CESSNA,172\n002,PIPER,PA28\n'),
      opts({ columns: ['CODE', 'MFR', 'MODEL'] })
    );
    expect(rows).toEqual([
      { CODE: '001', MFR: 'CESSNA', MODEL: '172' },
      { CODE: '002', MFR: 'PIPER', MODEL: 'PA28' },
    ]);
  });

  it('explicit columns parse all rows including the first one', async () => {
    const rows = await parseCSV(
      buf('"AAC","Piper"\n"AAJ","Dehavilland"\n'),
      opts({ columns: ['MARK', 'COMMON_NAME'] })
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].MARK).toBe('AAC');
    expect(rows[1].COMMON_NAME).toBe('Dehavilland');
  });

  it('skip_rows discards leading banner lines before the header (ANAC quirk)', async () => {
    const rows = await parseCSV(
      buf('Atualizado em: 2026-06-03\nA;B\n1;2\n3;4\n'),
      opts({ delimiter: ';', skip_rows: 1 })
    );
    expect(rows).toEqual([
      { A: '1', B: '2' },
      { A: '3', B: '4' },
    ]);
  });

  it('skip_rows of 0 leaves the header on the first line', async () => {
    const rows = await parseCSV(buf('A,B\n1,2\n'), opts({ skip_rows: 0 }));
    expect(rows).toEqual([{ A: '1', B: '2' }]);
  });
});

interface SheetSpec {
  name: string;
  rows: string[][];
}

const sheetBuf = async (format: HucreFormat, sheets: SheetSpec[]): Promise<Buffer> => {
  const wb = { sheets };
  const bytes = format === 'ods' ? await writeOds(wb) : await writeXlsx(wb);
  return Buffer.from(bytes);
};

const ssOpts = (
  overrides: Partial<{
    format: HucreFormat;
    trim: boolean;
    columns: string[];
    sheet: string | number;
    skip_rows: number;
  }> = {}
) => ({
  format: 'ods' as HucreFormat,
  trim: false,
  ...overrides,
});

describe('parseSpreadsheet — ods', () => {
  it('parses a basic .ods with header row', async () => {
    const buf = await sheetBuf('ods', [
      {
        name: 'Sheet1',
        rows: [
          ['CODE', 'MFR', 'MODEL'],
          ['001', 'CESSNA', '172'],
        ],
      },
    ]);
    const rows = await parseSpreadsheet(buf, ssOpts());
    expect(rows).toEqual([{ CODE: '001', MFR: 'CESSNA', MODEL: '172' }]);
  });

  it('uses explicit columns when provided (no header row consumed)', async () => {
    const buf = await sheetBuf('ods', [
      {
        name: 'Sheet1',
        rows: [
          ['001', 'CESSNA', '172'],
          ['002', 'PIPER', 'PA28'],
        ],
      },
    ]);
    const rows = await parseSpreadsheet(buf, ssOpts({ columns: ['CODE', 'MFR', 'MODEL'] }));
    expect(rows).toEqual([
      { CODE: '001', MFR: 'CESSNA', MODEL: '172' },
      { CODE: '002', MFR: 'PIPER', MODEL: 'PA28' },
    ]);
  });

  it('trims cell values when trim option is true', async () => {
    const buf = await sheetBuf('ods', [
      {
        name: 'Sheet1',
        rows: [
          ['A', 'B'],
          ['  hello  ', '  world  '],
        ],
      },
    ]);
    const rows = await parseSpreadsheet(buf, ssOpts({ trim: true }));
    expect(rows[0]).toEqual({ A: 'hello', B: 'world' });
  });

  it('preserves cell whitespace when trim option is false', async () => {
    const buf = await sheetBuf('ods', [
      {
        name: 'Sheet1',
        rows: [
          ['A', 'B'],
          ['  hello  ', '  world  '],
        ],
      },
    ]);
    const rows = await parseSpreadsheet(buf, ssOpts({ trim: false }));
    expect(rows[0]).toEqual({ A: '  hello  ', B: '  world  ' });
  });

  it('trims trailing whitespace from header names (real-world spreadsheet quirk)', async () => {
    // Mirrors the FAA CSV case: registry exports often ship space-padded headers, which
    // silently breaks every per-field lookup downstream unless normalized.
    const buf = await sheetBuf('ods', [
      {
        name: 'Sheet1',
        rows: [
          ['CODE ', 'MFR '],
          ['001', 'CESSNA'],
        ],
      },
    ]);
    const rows = await parseSpreadsheet(buf, ssOpts());
    expect(rows[0].CODE).toBe('001');
    expect(rows[0].MFR).toBe('CESSNA');
    expect(rows[0]['CODE ']).toBeUndefined();
  });

  it('skips fully empty rows', async () => {
    const buf = await sheetBuf('ods', [
      {
        name: 'Sheet1',
        rows: [
          ['A', 'B'],
          ['1', '2'],
          ['', ''],
          ['3', '4'],
        ],
      },
    ]);
    const rows = await parseSpreadsheet(buf, ssOpts());
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.A)).toEqual(['1', '3']);
  });

  it('returns an empty array for header-only input', async () => {
    const buf = await sheetBuf('ods', [{ name: 'Sheet1', rows: [['A', 'B']] }]);
    const rows = await parseSpreadsheet(buf, ssOpts());
    expect(rows).toEqual([]);
  });

  it('returns an empty array for a sheet with no rows', async () => {
    const buf = await sheetBuf('ods', [{ name: 'Sheet1', rows: [] }]);
    const rows = await parseSpreadsheet(buf, ssOpts());
    expect(rows).toEqual([]);
  });

  it('selects a sheet by name', async () => {
    const buf = await sheetBuf('ods', [
      {
        name: 'Ignore',
        rows: [
          ['X', 'Y'],
          ['9', '9'],
        ],
      },
      {
        name: 'Register',
        rows: [
          ['A', 'B'],
          ['1', '2'],
        ],
      },
    ]);
    const rows = await parseSpreadsheet(buf, ssOpts({ sheet: 'Register' }));
    expect(rows).toEqual([{ A: '1', B: '2' }]);
  });

  it('selects a sheet by numeric index', async () => {
    const buf = await sheetBuf('ods', [
      {
        name: 'First',
        rows: [
          ['A', 'B'],
          ['1', '2'],
        ],
      },
      {
        name: 'Second',
        rows: [
          ['C', 'D'],
          ['3', '4'],
        ],
      },
    ]);
    const rows = await parseSpreadsheet(buf, ssOpts({ sheet: 1 }));
    expect(rows).toEqual([{ C: '3', D: '4' }]);
  });

  it('defaults to the first sheet when sheet is not specified', async () => {
    const buf = await sheetBuf('ods', [
      { name: 'First', rows: [['A'], ['1']] },
      { name: 'Second', rows: [['B'], ['2']] },
    ]);
    const rows = await parseSpreadsheet(buf, ssOpts());
    expect(rows).toEqual([{ A: '1' }]);
  });

  it('returns an empty array when the named sheet does not exist', async () => {
    const buf = await sheetBuf('ods', [{ name: 'Real', rows: [['A'], ['1']] }]);
    const rows = await parseSpreadsheet(buf, ssOpts({ sheet: 'Nope' }));
    expect(rows).toEqual([]);
  });

  it('returns an empty array when the index is out of range', async () => {
    const buf = await sheetBuf('ods', [{ name: 'Only', rows: [['A'], ['1']] }]);
    const rows = await parseSpreadsheet(buf, ssOpts({ sheet: 5 }));
    expect(rows).toEqual([]);
  });

  it('skips empty header columns rather than emitting empty-key fields', async () => {
    const buf = await sheetBuf('ods', [
      {
        name: 'Sheet1',
        rows: [
          ['A', '', 'C'],
          ['1', '2', '3'],
        ],
      },
    ]);
    const rows = await parseSpreadsheet(buf, ssOpts());
    expect(rows[0]).toEqual({ A: '1', C: '3' });
    expect(rows[0]['']).toBeUndefined();
  });

  it('rejects when the buffer is not a valid .ods archive', async () => {
    await expect(parseSpreadsheet(Buffer.from('not-a-spreadsheet'), ssOpts())).rejects.toThrow();
  });

  it('discards the configured number of leading rows (skip_rows)', async () => {
    // Mirrors the NL ILT case where `columns:` overrides the messy bracket-annotated
    // header but the file's own header row still occupies index 0 and would otherwise
    // be treated as data.
    const buf = await sheetBuf('ods', [
      {
        name: 'Sheet1',
        rows: [
          ['file-header-A', 'file-header-B'],
          ['1', '2'],
          ['3', '4'],
        ],
      },
    ]);
    const rows = await parseSpreadsheet(buf, ssOpts({ columns: ['A', 'B'], skip_rows: 1 }));
    expect(rows).toEqual([
      { A: '1', B: '2' },
      { A: '3', B: '4' },
    ]);
  });

  it('skip_rows works without explicit columns (header re-detected after skip)', async () => {
    const buf = await sheetBuf('ods', [
      {
        name: 'Sheet1',
        rows: [
          ['# metadata banner row', '', ''],
          ['CODE', 'MFR', 'MODEL'],
          ['001', 'CESSNA', '172'],
        ],
      },
    ]);
    const rows = await parseSpreadsheet(buf, ssOpts({ skip_rows: 1 }));
    expect(rows).toEqual([{ CODE: '001', MFR: 'CESSNA', MODEL: '172' }]);
  });

  it('skip_rows defaulting to 0 leaves the input unchanged', async () => {
    const buf = await sheetBuf('ods', [
      {
        name: 'Sheet1',
        rows: [
          ['A', 'B'],
          ['1', '2'],
        ],
      },
    ]);
    const rows = await parseSpreadsheet(buf, ssOpts());
    expect(rows).toEqual([{ A: '1', B: '2' }]);
  });

  it('stringifies numeric, boolean, and Date cell values (CellValue round-trip)', async () => {
    // hucre preserves cell types through write/read; the parser must coerce non-string
    // CellValues into the Row[] shape the engine consumes.
    const { writeOds: writeOds2 } = await import('hucre/ods');
    const buf = Buffer.from(
      await writeOds2({
        sheets: [
          {
            name: 'Sheet1',
            rows: [
              ['LABEL', 'COUNT', 'ACTIVE', 'WHEN'],
              ['alpha', 42, true, new Date('2026-01-15T00:00:00Z')],
            ],
          },
        ],
      })
    );
    const rows = await parseSpreadsheet(buf, ssOpts());
    expect(rows).toHaveLength(1);
    expect(rows[0].LABEL).toBe('alpha');
    expect(rows[0].COUNT).toBe('42');
    expect(rows[0].ACTIVE).toBe('true');
    expect(rows[0].WHEN).toMatch(/^2026-01-15T/);
  });
});

describe('parseSpreadsheet — xlsx', () => {
  it('parses a basic .xlsx with header row', async () => {
    const buf = await sheetBuf('xlsx', [
      {
        name: 'Sheet1',
        rows: [
          ['CODE', 'MFR'],
          ['001', 'CESSNA'],
        ],
      },
    ]);
    const rows = await parseSpreadsheet(buf, ssOpts({ format: 'xlsx' }));
    expect(rows).toEqual([{ CODE: '001', MFR: 'CESSNA' }]);
  });

  it('returns the same Row[] shape as the ods path for the same data', async () => {
    const sheets: SheetSpec[] = [
      {
        name: 'Sheet1',
        rows: [
          ['A', 'B'],
          ['1', '2'],
          ['3', '4'],
        ],
      },
    ];
    const odsRows = await parseSpreadsheet(await sheetBuf('ods', sheets), ssOpts());
    const xlsxRows = await parseSpreadsheet(
      await sheetBuf('xlsx', sheets),
      ssOpts({ format: 'xlsx' })
    );
    expect(odsRows).toEqual(xlsxRows);
  });

  it('rejects when the buffer is not a valid .xlsx archive', async () => {
    await expect(
      parseSpreadsheet(Buffer.from('not-a-spreadsheet'), ssOpts({ format: 'xlsx' }))
    ).rejects.toThrow();
  });
});

const xlsBuf = (sheets: { name: string; rows: unknown[][] }[]): Buffer => {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows), s.name);
  }
  // XLSX.write is typed `any`; narrow to Uint8Array (TS cannot infer it from the options).
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'biff8' }) as Uint8Array;
  return Buffer.from(bytes);
};

const xlsOpts = (
  overrides: Partial<{
    trim: boolean;
    columns: string[];
    sheet: string | number;
    skip_rows: number;
  }> = {}
) => ({ trim: false, ...overrides });

describe('parseXls — legacy binary .xls (BIFF8)', () => {
  it('parses a basic .xls with a header row', async () => {
    const buf = xlsBuf([
      {
        name: 'Sheet1',
        rows: [
          ['CODE', 'MFR'],
          ['001', 'CESSNA'],
        ],
      },
    ]);
    expect(await parseXls(buf, xlsOpts())).toEqual([{ CODE: '001', MFR: 'CESSNA' }]);
  });

  it('stringifies numeric cells (serials, ids) rather than dropping them', async () => {
    const buf = xlsBuf([
      {
        name: 'S',
        rows: [
          ['id', 'serial'],
          [1, 40833],
        ],
      },
    ]);
    expect(await parseXls(buf, xlsOpts())).toEqual([{ id: '1', serial: '40833' }]);
  });

  it('applies skip_rows + explicit columns (preamble and Chinese header discarded)', async () => {
    const buf = xlsBuf([
      {
        name: '一覽表',
        rows: [
          ['', '', '民用航空器機齡一覽表'],
          ['序號', '機號', '機型'],
          [1, 'B-00101', 'HBC BEECH 350'],
        ],
      },
    ]);
    const rows = await parseXls(buf, xlsOpts({ skip_rows: 2, columns: ['seq', 'reg', 'model'] }));
    expect(rows).toEqual([{ seq: '1', reg: 'B-00101', model: 'HBC BEECH 350' }]);
  });

  it('drops fully-blank rows between data rows', async () => {
    const buf = xlsBuf([
      {
        name: 'S',
        rows: [['A'], ['1'], ['', ''], ['2']],
      },
    ]);
    expect(await parseXls(buf, xlsOpts())).toEqual([{ A: '1' }, { A: '2' }]);
  });

  it('trims cell values when trim is enabled', async () => {
    const buf = xlsBuf([{ name: 'S', rows: [['A'], ['  hi  ']] }]);
    expect(await parseXls(buf, xlsOpts({ trim: true }))).toEqual([{ A: 'hi' }]);
  });

  it('selects a sheet by name', async () => {
    const buf = xlsBuf([
      { name: 'first', rows: [['A'], ['x']] },
      { name: 'second', rows: [['B'], ['y']] },
    ]);
    expect(await parseXls(buf, xlsOpts({ sheet: 'second' }))).toEqual([{ B: 'y' }]);
  });

  it('selects a sheet by zero-based index', async () => {
    const buf = xlsBuf([
      { name: 'first', rows: [['A'], ['x']] },
      { name: 'second', rows: [['B'], ['y']] },
    ]);
    expect(await parseXls(buf, xlsOpts({ sheet: 1 }))).toEqual([{ B: 'y' }]);
  });

  it('defaults to the first sheet when no selector is given', async () => {
    const buf = xlsBuf([
      { name: 'first', rows: [['A'], ['x']] },
      { name: 'second', rows: [['B'], ['y']] },
    ]);
    expect(await parseXls(buf, xlsOpts())).toEqual([{ A: 'x' }]);
  });

  it('throws when the named sheet does not exist', async () => {
    const buf = xlsBuf([{ name: 'only', rows: [['A'], ['x']] }]);
    await expect(parseXls(buf, xlsOpts({ sheet: 'missing' }))).rejects.toThrow('"missing"');
  });

  it('throws when the sheet index is out of range', async () => {
    const buf = xlsBuf([{ name: 'only', rows: [['A'], ['x']] }]);
    await expect(parseXls(buf, xlsOpts({ sheet: 9 }))).rejects.toThrow('out of range');
  });
});
