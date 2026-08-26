import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { writeOds } from 'hucre/ods';
import { writeXlsx } from 'hucre/xlsx';
import * as XLSX from 'xlsx';
import {
  parseCSV,
  parseSpreadsheet,
  parseXls,
  parseHtml,
  parseJson,
  parsePdf,
  type HucreFormat,
  type ParsePdfOptions,
} from '../src/parser.js';

const buf = (s: string): Buffer => Buffer.from(s, 'latin1');
const opts = (
  overrides: Partial<{
    delimiter: string;
    trim: boolean;
    columns: string[];
    skip_rows: number;
    allowed_ragged_rows: number;
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

  it('strips a leading UTF-8 BOM so the first header cell is not renamed (FAA ACFTREF drift)', async () => {
    // FAA added a UTF-8 BOM (EF BB BF) to its releases. Under latin1 those bytes would decode to
    // `ï»¿CODE`, so `key: CODE` finds no column and the ACFTREF join matches 0 rows. The strip must
    // leave the header clean.
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const rows = await parseCSV(Buffer.concat([bom, buf('CODE,MFR\n001,CESSNA\n')]), opts());
    expect(rows).toEqual([{ CODE: '001', MFR: 'CESSNA' }]);
    expect(Object.keys(rows[0])[0]).toBe('CODE');
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

  it('accepts explicit columns whose width matches the discarded header', async () => {
    const rows = await parseCSV(
      buf('reg,owner\nN1,Alice\n'),
      opts({ columns: ['REG', 'OWNER'], skip_rows: 1 })
    );
    expect(rows).toEqual([{ REG: 'N1', OWNER: 'Alice' }]);
  });

  it('rejects explicit columns when the discarded header is wider (column added upstream)', async () => {
    await expect(
      parseCSV(
        buf('reg,NEW,owner\nN1,x,Alice\n'),
        opts({ columns: ['REG', 'OWNER'], skip_rows: 1 })
      )
    ).rejects.toThrow(/columns \(2\).*header row \(3 cells\)/i);
  });

  it('rejects explicit columns when the discarded header is narrower (column removed upstream)', async () => {
    await expect(
      parseCSV(buf('reg\nN1\n'), opts({ columns: ['REG', 'OWNER'], skip_rows: 1 }))
    ).rejects.toThrow(/columns \(2\).*header row \(1 cells\)/i);
  });

  it('ignores banner lines above the header when checking width', async () => {
    const rows = await parseCSV(
      buf('Fleet register export\nreg,owner\nN1,Alice\n'),
      opts({ columns: ['REG', 'OWNER'], skip_rows: 2 })
    );
    expect(rows).toEqual([{ REG: 'N1', OWNER: 'Alice' }]);
  });

  it('skips the header check for headerless files (columns without skip_rows)', async () => {
    const rows = await parseCSV(buf('N1,Alice\n'), opts({ columns: ['REG', 'OWNER'] }));
    expect(rows).toEqual([{ REG: 'N1', OWNER: 'Alice' }]);
  });

  it('rejects a row with extra cells beyond the header (silent cell drop)', async () => {
    await expect(parseCSV(buf('A,B\n1,2,3\n'), opts())).rejects.toThrow(/cell count.*allowed: 0/i);
  });

  it('rejects a row with fewer cells than the header (silent field loss)', async () => {
    await expect(parseCSV(buf('A,B,C\n1,2,3\n4,5\n'), opts())).rejects.toThrow(
      /cell count.*allowed: 0/i
    );
  });

  it('allows a bounded ragged row via allowed_ragged_rows', async () => {
    const rows = await parseCSV(
      buf('A,B\n1,2\n9 rows selected.\n'),
      opts({ allowed_ragged_rows: 1 })
    );
    expect(rows).toHaveLength(2);
    expect(rows[1].A).toBe('9 rows selected.');
  });

  it('rejects ragged rows beyond the allowed_ragged_rows budget', async () => {
    await expect(
      parseCSV(buf('A,B\n1,2\nshort\nalso short\n'), opts({ allowed_ragged_rows: 1 }))
    ).rejects.toThrow(/2 row\(s\).*allowed: 1/i);
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

  it('rejects a duplicated header name instead of silently shadowing the earlier column', async () => {
    await expect(parseCSV(buf('name,name,x\n1,2,3\n'), opts())).rejects.toThrow(
      /duplicate header.*"name"/i
    );
  });

  it('rejects headers that collide only after trimming', async () => {
    await expect(parseCSV(buf('name ,name,x\n1,2,3\n'), opts())).rejects.toThrow(
      /duplicate header/i
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

  it('throws when the named sheet does not exist', async () => {
    const buf = await sheetBuf('ods', [{ name: 'Real', rows: [['A'], ['1']] }]);
    await expect(parseSpreadsheet(buf, ssOpts({ sheet: 'Nope' }))).rejects.toThrow(
      /"Nope" not found/
    );
  });

  it('throws when the index is out of range', async () => {
    const buf = await sheetBuf('ods', [{ name: 'Only', rows: [['A'], ['1']] }]);
    await expect(parseSpreadsheet(buf, ssOpts({ sheet: 5 }))).rejects.toThrow(/out of range/);
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

describe('parseJson', () => {
  const jbuf = (s: string): Buffer => Buffer.from(s, 'utf8');
  const jopts = (record_path?: string) => ({ encoding: 'utf8' as const, record_path });

  it('flattens a root array of records into dot-path string rows', async () => {
    const rows = await parseJson(jbuf('[{"a":"x","b":{"c":"y"}}]'), jopts(''));
    expect(rows).toEqual([{ a: 'x', 'b.c': 'y' }]);
  });

  it('serializes arrays to a JSON string for transforms to unpack', async () => {
    const rows = await parseJson(jbuf('[{"items":[1,2,3]}]'), jopts());
    expect(rows[0]?.items).toBe('[1,2,3]');
  });

  it('stringifies numbers and booleans, omits null/undefined leaves', async () => {
    const rows = await parseJson(jbuf('[{"n":42,"b":true,"z":null}]'), jopts());
    expect(rows[0]).toEqual({ n: '42', b: 'true' });
  });

  it('navigates a nested record_path to the array', async () => {
    const rows = await parseJson(jbuf('{"data":{"items":[{"r":"HB-1"}]}}'), jopts('data.items'));
    expect(rows).toEqual([{ r: 'HB-1' }]);
  });

  it('returns an empty array for an empty record set', async () => {
    await expect(parseJson(jbuf('[]'), jopts())).resolves.toEqual([]);
  });

  it('throws when the root is not an array', async () => {
    await expect(parseJson(jbuf('{"r":"HB-1"}'), jopts())).rejects.toThrow(
      /did not resolve to an array/i
    );
  });

  it('throws when record_path does not resolve to an array', async () => {
    await expect(parseJson(jbuf('{"data":{}}'), jopts('data.items'))).rejects.toThrow(
      /did not resolve to an array/i
    );
  });

  it('rejects an inherited record_path property instead of consuming polluted data', async () => {
    Object.defineProperty(Object.prototype, 'inheritedRecords', {
      configurable: true,
      value: [{ r: 'BAD' }],
    });
    try {
      await expect(parseJson(jbuf('{"data":{}}'), jopts('data.inheritedRecords'))).rejects.toThrow(
        /missing own property "inheritedRecords"/i
      );
    } finally {
      Reflect.deleteProperty(Object.prototype, 'inheritedRecords');
    }
  });

  it('throws when record_path traverses through a non-object', async () => {
    await expect(parseJson(jbuf('{"data":"x"}'), jopts('data.items'))).rejects.toThrow(
      /does not resolve to an object/i
    );
  });

  it('rejects malformed JSON', async () => {
    await expect(parseJson(jbuf('[{bad'), jopts())).rejects.toThrow();
  });

  it('fails fast when a record is not an object', async () => {
    await expect(parseJson(jbuf('[{"r":"HB-1"},42]'), jopts())).rejects.toThrow(
      /record at index 1 is not an object/i
    );
  });
});

const MV_PDF = resolve(import.meta.dirname, '..', 'fixtures', 'mv-caa', 'input', 'register.pdf');
const mvBuf = (): Buffer => readFileSync(MV_PDF);
// Mirrors sources/mv-caa.yaml: 90°-rotated grid, fields on y, records anchored on the 8Q mark
// along x. Keep both in step — the register alternates layouts, and this harness is what proves
// the parser still separates the bands after a flip.
const mvOpts = (overrides: Partial<ParsePdfOptions> = {}): ParsePdfOptions => ({
  field_axis: 'y',
  anchor_pattern: '^8Q-[A-Z]{3}$',
  column_pos: [
    746, 713.1, 685.8, 616.1, 551.8, 467.8, 420, 383.8, 299.8, 217.9, 205.6, 183, 156.9, 87.6, 66.2,
    40.6, 28.9,
  ],
  columns: [
    'status',
    'date_revision',
    'date_issue',
    'idera',
    'mortgage',
    'other_specifics',
    'basis',
    'operator',
    'legal_owner',
    'owner',
    'year',
    'serial',
    'mtow',
    'mfg',
    'mark',
    'cert_no',
    'sn',
  ],
  trim: true,
  ...overrides,
});

describe('parsePdf', () => {
  it('reconstructs one row per anchor across all pages', async () => {
    const rows = await parsePdf(mvBuf(), mvOpts());
    expect(rows).toHaveLength(137);
    expect(rows.every((r) => /^8Q-[A-Z]{3}$/.test(r.mark ?? ''))).toBe(true);
    expect(rows.every((r) => /^CR-/.test(r.cert_no ?? ''))).toBe(true);
  });

  it('snaps single-line fields to their column band', async () => {
    const rows = await parsePdf(mvBuf(), mvOpts());
    const r = rows.find((row) => row.mark === '8Q-OEQ')!;
    expect(r.cert_no).toBe('CR-121');
    expect(r.sn).toBe('21');
    expect(r.year).toBe('1967');
    expect(r.mtow).toBe('5262');
    expect(r.status).toBe('Valid');
    expect(r.date_issue).toBe('2-Dec-95');
  });

  it('joins a wrapped multi-line cell with newlines in reading order', async () => {
    const rows = await parsePdf(mvBuf(), mvOpts());
    const r = rows.find((row) => row.mark === '8Q-OEQ')!;
    const owner = r.owner.split('\n');
    expect(owner[0]).toBe('Trans Maldivian Airways Pvt. Ltd.');
    expect(owner.length).toBeGreaterThan(1);
    expect(r.mfg.split('\n')[0]).toBe('Viking Air (De Havilland)');
  });

  it('excludes the repeated header-label column and the page footer', async () => {
    const rows = await parsePdf(mvBuf(), mvOpts());
    const blob = rows.flatMap((r) => Object.values(r)).join('\n');
    expect(blob).not.toMatch(/Registration S\/N|Date of Original Issue|Nationality &/);
    expect(blob).not.toMatch(/Whilst reasonable care|Page \d of \d/);
  });

  it('throws when the anchor pattern matches nothing on a text-bearing page', async () => {
    // Silently returning [] here published a zero/short fleet whenever the register's mark
    // format drifted; the writer's guards can't attribute the loss to a page.
    await expect(parsePdf(mvBuf(), mvOpts({ anchor_pattern: '^ZZ-NOPE$' }))).rejects.toThrow(
      /page\(s\) [\d, ]+ carry text but no anchor_pattern matches/i
    );
  });

  it('throws when only some pages lose their anchors (partial template drift)', async () => {
    // 8Q-OEQ exists on one page only; the other pages still carry text, so their fleet slice
    // would silently vanish — a 10-40% loss that clears the writer's 50% retain floor.
    await expect(parsePdf(mvBuf(), mvOpts({ anchor_pattern: '^8Q-OEQ$' }))).rejects.toThrow(
      /page\(s\) [\d, ]+ carry text but no anchor_pattern matches/i
    );
  });
});

// Minimal single-font uncompressed PDF writer so multi-page layouts (cover pages, per-page anchor
// loss) can be exercised without a hand-crafted binary fixture. unpdf reads Td coordinates back
// verbatim, so item positions in `pages` are exactly what parsePdf sees.
interface SynthItem {
  str: string;
  x: number;
  y: number;
}

const pdfEsc = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const buildPdf = (pages: SynthItem[][]): Buffer => {
  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + 2 * i} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  pages.forEach((items, i) => {
    const pageNum = 4 + 2 * i;
    objects[pageNum] =
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${pageNum + 1} 0 R >>`;
    const stream = items
      .map((it) => `BT /F1 10 Tf ${it.x} ${it.y} Td (${pdfEsc(it.str)}) Tj ET`)
      .join('\n');
    objects[pageNum + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let n = 1; n < objects.length; n++) {
    offsets[n] = body.length;
    body += `${n} 0 obj\n${objects[n]}\nendobj\n`;
  }
  const xrefStart = body.length;
  let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let n = 1; n < objects.length; n++) {
    xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  }
  body += `${xref}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
};

// Same orientation as mv-caa: fields banded on y (value at 100, mark at 50), records along x.
const synthOpts = (overrides: Partial<ParsePdfOptions> = {}): ParsePdfOptions => ({
  field_axis: 'y',
  anchor_pattern: '^8Q-[A-Z]{3}$',
  column_pos: [100, 50],
  columns: ['value', 'mark'],
  trim: true,
  ...overrides,
});

const coverPage: SynthItem[] = [
  { str: 'Republic of Testland', x: 72, y: 700 },
  { str: 'Civil Aircraft Register', x: 72, y: 680 },
];
// A register page whose marks drifted out of the anchor format — text present, zero matches.
const driftedPage: SynthItem[] = [
  { str: '8QAAA', x: 100, y: 50 },
  { str: 'Alpha Air', x: 100, y: 100 },
];
const registerPage = (records: [mark: string, value: string][]): SynthItem[] =>
  records.flatMap(([mark, value], i) => [
    { str: mark, x: 100 + 200 * i, y: 50 },
    { str: value, x: 100 + 200 * i, y: 100 },
  ]);

const pageAB = registerPage([
  ['8Q-AAA', 'Alpha Air'],
  ['8Q-BBB', 'Bravo Air'],
]);
const pageC = registerPage([['8Q-CCC', 'Charlie Air']]);

// Anchors at 500/480 give a default safe zone floor of 470 and (with reach 20) a widened floor of
// 460. The footer sits at 465 — inside that widened band, not below it — so it reaches the
// allowlist check itself rather than being excluded by the outer bound first; a removed or
// always-true predicate would let it leak into BBB's address exactly as this test would then fail.
const finalContinuationPage: SynthItem[] = [
  { str: 'AAA', x: 50, y: 500 },
  { str: 'First owner', x: 100, y: 500 },
  { str: 'BBB', x: 50, y: 480 },
  { str: 'Second owner', x: 100, y: 480 },
  { str: 'Slovenia', x: 100, y: 460 },
  { str: 'Page 1 of 1', x: 100, y: 465 },
];

const finalContinuationOpts: ParsePdfOptions = {
  field_axis: 'x',
  anchor_pattern: '^[A-Z]{3}$',
  anchor_column: 0,
  before_first_anchor_reach: 20,
  before_first_anchor_pattern: '^Slovenia$',
  column_pos: [50, 100],
  columns: ['mark', 'address'],
  trim: true,
};

describe('parsePdf final record continuations', () => {
  it('keeps one final wrapped line while excluding the page footer', async () => {
    const rows = await parsePdf(buildPdf([finalContinuationPage]), finalContinuationOpts);

    expect(rows).toEqual([
      { mark: 'BBB', address: 'Second owner\nSlovenia' },
      { mark: 'AAA', address: 'First owner' },
    ]);
  });

  // A lone anchor has no adjacent gap, so outerSpread returns Infinity for both the default safe
  // zone and (pre-fix) the configured reach's Math.max — silently disabling the allowlist gate on
  // exactly the page that most needs it (a final publication page down to one aircraft).
  it('still applies the allowlist gate when the page has only one anchor', async () => {
    const singleAnchorPage: SynthItem[] = [
      { str: 'AAA', x: 50, y: 500 },
      { str: 'Sole owner', x: 100, y: 500 },
      { str: 'Slovenia', x: 100, y: 480 },
      { str: 'Page 1 of 1', x: 100, y: 472 },
    ];
    const rows = await parsePdf(
      buildPdf([singleAnchorPage]),
      synthOpts({
        field_axis: 'x',
        anchor_pattern: '^[A-Z]{3}$',
        anchor_column: 0,
        before_first_anchor_reach: 30,
        before_first_anchor_pattern: '^Slovenia$',
        column_pos: [50, 100],
        columns: ['mark', 'address'],
      })
    );

    expect(rows).toEqual([{ mark: 'AAA', address: 'Sole owner\nSlovenia' }]);
  });

  // A single-anchor page has no adjacent-record gap to size a safe zone from, so before this fix
  // defaultLo fell back to the anchor's exact coordinate — gating even the record's own same-row
  // fields the instant they sat a fraction of a point below it, which real PDF baselines do (CCAA
  // Croatia's own address column reaches 2.16pt below its mark on at least one live row).
  it('does not gate an ordinary same-row field on a single-anchor page', async () => {
    const singleAnchorJitterPage: SynthItem[] = [
      { str: 'AAA', x: 50, y: 500 },
      { str: 'Cessna 172', x: 100, y: 498 }, // 2pt same-row jitter, not a wrap continuation
      { str: 'Page 1 of 1', x: 100, y: 475 }, // 25pt below — genuine footer noise
    ];
    const rows = await parsePdf(
      buildPdf([singleAnchorJitterPage]),
      synthOpts({
        field_axis: 'x',
        anchor_pattern: '^[A-Z]{3}$',
        anchor_column: 0,
        before_first_anchor_reach: 30,
        before_first_anchor_pattern: '^Slovenia$',
        column_pos: [50, 100],
        columns: ['mark', 'model'],
      })
    );

    expect(rows).toEqual([{ mark: 'AAA', model: 'Cessna 172' }]);
  });
});

describe('parsePdf anchorless-page budget', () => {
  it('tolerates a leading cover page within allowed_anchorless_pages', async () => {
    const rows = await parsePdf(
      buildPdf([coverPage, pageAB, pageC]),
      synthOpts({ allowed_anchorless_pages: 1 })
    );
    expect(rows.map((r) => r.mark)).toEqual(['8Q-AAA', '8Q-BBB', '8Q-CCC']);
    expect(rows[2]?.value).toBe('Charlie Air');
  });

  it('still skips text-free pages without consuming the budget', async () => {
    const rows = await parsePdf(buildPdf([[], pageAB, pageC]), synthOpts());
    expect(rows).toHaveLength(3);
  });

  it('throws on an unbudgeted leading anchorless page (default 0)', async () => {
    await expect(parsePdf(buildPdf([coverPage, pageAB, pageC]), synthOpts())).rejects.toThrow(
      /page\(s\) 1 carry text but no anchor_pattern matches.*allowed_anchorless_pages: 0/i
    );
  });

  it('throws when an interior page loses its anchors', async () => {
    await expect(parsePdf(buildPdf([pageAB, driftedPage, pageC]), synthOpts())).rejects.toThrow(
      /page\(s\) 2 carry text but no anchor_pattern matches/i
    );
  });

  it('throws when a trailing page loses its anchors', async () => {
    await expect(parsePdf(buildPdf([pageAB, pageC, driftedPage]), synthOpts())).rejects.toThrow(
      /page\(s\) 3 carry text but no anchor_pattern matches/i
    );
  });

  it('throws naming every anchorless page once the budget is exceeded', async () => {
    // Budgeted cover page + a drifted register page: the budget covers one, not both, and the
    // error must attribute the loss to specific pages so drift is diagnosable from the log.
    await expect(
      parsePdf(
        buildPdf([coverPage, pageAB, driftedPage]),
        synthOpts({ allowed_anchorless_pages: 1 })
      )
    ).rejects.toThrow(/page\(s\) 1, 3 carry text but no anchor_pattern matches/i);
  });

  it('throws on full template drift even when every page fits the budget', async () => {
    await expect(
      parsePdf(buildPdf([coverPage, driftedPage]), synthOpts({ allowed_anchorless_pages: 5 }))
    ).rejects.toThrow(/no anchor_pattern matches on any page/i);
  });

  it('throws on a PDF with no text at all instead of returning an empty fleet', async () => {
    await expect(parsePdf(buildPdf([[], []]), synthOpts())).rejects.toThrow(
      /no anchor_pattern matches on any page/i
    );
  });
});

const EE_HTML = resolve(import.meta.dirname, '..', 'fixtures', 'ee-tram', 'input', 'register.html');
const eeBuf = (): Buffer => readFileSync(EE_HTML);
// Mirrors sources/ee-tram.yaml: 9-column table, two preamble rows dropped, explicit positional names.
const eeColumns = [
  'pad_lead',
  'registration_mark',
  'pad_2',
  'pad_3',
  'type',
  'serial',
  'owner',
  'operator',
  'pad_trail',
];

describe('shapeRows discarded-header width guard (html/xls/ods/xlsx shared path)', () => {
  const table = (rows: string[][]): Buffer =>
    Buffer.from(
      `<table>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`,
      'utf8'
    );

  it('accepts explicit columns whose width matches the discarded header', async () => {
    const rows = await parseHtml(
      table([
        ['reg', 'owner'],
        ['N1', 'Alice'],
      ]),
      {
        encoding: 'utf8',
        trim: true,
        columns: ['REG', 'OWNER'],
        skip_rows: 1,
      }
    );
    expect(rows).toEqual([{ REG: 'N1', OWNER: 'Alice' }]);
  });

  it('rejects explicit columns when the discarded header is wider (column added upstream)', async () => {
    await expect(
      parseHtml(
        table([
          ['reg', 'NEW', 'owner'],
          ['N1', 'x', 'Alice'],
        ]),
        {
          encoding: 'utf8',
          trim: true,
          columns: ['REG', 'OWNER'],
          skip_rows: 1,
        }
      )
    ).rejects.toThrow(/columns \(2\).*header row \(3 cells\)/i);
  });

  it('ignores a short banner row above the header when checking width', async () => {
    const rows = await parseHtml(table([['Fleet register'], ['reg', 'owner'], ['N1', 'Alice']]), {
      encoding: 'utf8',
      trim: true,
      columns: ['REG', 'OWNER'],
      skip_rows: 2,
    });
    expect(rows).toEqual([{ REG: 'N1', OWNER: 'Alice' }]);
  });

  it('skips the header check when skip_rows is absent', async () => {
    const rows = await parseHtml(table([['N1', 'Alice']]), {
      encoding: 'utf8',
      trim: true,
      columns: ['REG', 'OWNER'],
    });
    expect(rows).toEqual([{ REG: 'N1', OWNER: 'Alice' }]);
  });

  it('rejects a duplicated inferred header name', async () => {
    await expect(
      parseHtml(
        table([
          ['name', 'name', 'x'],
          ['1', '2', '3'],
        ]),
        { encoding: 'utf8', trim: true }
      )
    ).rejects.toThrow(/duplicate header.*"name"/i);
  });

  it('tolerates repeated empty header cells (padding columns carry no data)', async () => {
    const rows = await parseHtml(
      table([
        ['reg', '', '', 'owner'],
        ['N1', 'a', 'b', 'Alice'],
      ]),
      {
        encoding: 'utf8',
        trim: true,
      }
    );
    expect(rows).toEqual([{ reg: 'N1', owner: 'Alice' }]);
  });
});

describe('parseHtml', () => {
  it('extracts the server-rendered table into one row per aircraft, dropping preamble rows', async () => {
    const rows = await parseHtml(eeBuf(), {
      encoding: 'utf8',
      trim: true,
      columns: eeColumns,
      skip_rows: 2,
    });
    expect(rows).toHaveLength(10);
    const r = rows.find((row) => row.registration_mark === 'ES - MBA')!;
    expect(r.type).toBe('Airbus A320');
    expect(r.serial).toBe('6849');
    expect(r.owner).toBe('Wilmington Trust SP Services (Dublin) Limited');
    expect(r.operator).toBe('Marabu Airlines OÜ');
  });

  it('keeps commas, parentheses, and Estonian characters in cell text intact', async () => {
    const rows = await parseHtml(eeBuf(), {
      encoding: 'utf8',
      trim: true,
      columns: eeColumns,
      skip_rows: 2,
    });
    expect(rows.find((row) => row.registration_mark === 'ES - MBB')?.owner).toBe(
      'Bank of Utah, not in its individual capacity but solely as owner trustee'
    );
    expect(rows.find((row) => row.registration_mark === 'ES - PCO')?.operator).toBe(
      'Politsei- ja Piirivalveamet'
    );
  });

  it('does not leak the dropped metadata/header rows as records', async () => {
    const rows = await parseHtml(eeBuf(), {
      encoding: 'utf8',
      trim: true,
      columns: eeColumns,
      skip_rows: 2,
    });
    const marks = rows.map((r) => r.registration_mark);
    expect(marks).not.toContain('19.06.2026/updated');
    expect(marks.every((m) => /^ES - /.test(m))).toBe(true);
  });

  it('throws on a page with no parseable <table> (loud failure, never an empty set)', async () => {
    const buf = Buffer.from(
      '<html><body><p>register temporarily unavailable</p></body></html>',
      'utf8'
    );
    await expect(parseHtml(buf, { encoding: 'utf8', trim: true, skip_rows: 2 })).rejects.toThrow();
  });

  it('returns an empty array for a header-only table (no data rows)', async () => {
    const buf = Buffer.from('<table><tr><td>mark</td><td>type</td></tr></table>', 'utf8');
    const rows = await parseHtml(buf, {
      encoding: 'utf8',
      trim: true,
      columns: ['mark', 'type'],
      skip_rows: 1,
    });
    expect(rows).toEqual([]);
  });

  // A page with more than one <table> (nav chrome, a summary table above the register, etc.)
  // becomes "Sheet1", "Sheet2", ... — `sheet` selects which one, same as the xls path.
  const multiTableBuf = (): Buffer =>
    Buffer.from(
      '<table><tr><td>mark</td></tr><tr><td>first</td></tr></table>' +
        '<table><tr><td>mark</td></tr><tr><td>second</td></tr></table>',
      'utf8'
    );

  it('defaults to the first table when no sheet selector is given', async () => {
    const rows = await parseHtml(multiTableBuf(), {
      encoding: 'utf8',
      trim: true,
      columns: ['mark'],
      skip_rows: 1,
    });
    expect(rows).toEqual([{ mark: 'first' }]);
  });

  it('selects a later table by zero-based sheet index', async () => {
    const rows = await parseHtml(multiTableBuf(), {
      encoding: 'utf8',
      trim: true,
      columns: ['mark'],
      skip_rows: 1,
      sheet: 1,
    });
    expect(rows).toEqual([{ mark: 'second' }]);
  });

  it('selects a table by its generated sheet name', async () => {
    const rows = await parseHtml(multiTableBuf(), {
      encoding: 'utf8',
      trim: true,
      columns: ['mark'],
      skip_rows: 1,
      sheet: 'Sheet2',
    });
    expect(rows).toEqual([{ mark: 'second' }]);
  });
});
