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
  type HucreFormat,
} from '../src/parser.js';

const buf = (s: string): Buffer => Buffer.from(s, 'latin1');
const opts = (
  overrides: Partial<{
    delimiter: string;
    trim: boolean;
    columns: string[];
    skip_rows: number;
    allowed_ragged_rows: number;
    header_text: string[];
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

  describe('header_text', () => {
    const cols = { columns: ['REG', 'OWNER', 'OPERATOR'], skip_rows: 2 };
    const header_text = ['Mark', 'Owner/Lessor', 'Operator'];
    const file = (header: string) =>
      buf(`Updated 2026-10-18, 3 aircraft\n${header}\nN1,Alice,Bob\n`);

    it('accepts a header matching header_text, ignoring the banner above it', async () => {
      const rows = await parseCSV(
        file('Mark,Owner/Lessor,Operator'),
        opts({ ...cols, header_text })
      );
      expect(rows).toEqual([{ REG: 'N1', OWNER: 'Alice', OPERATOR: 'Bob' }]);
    });

    it('accepts whitespace variance, nbsp included', async () => {
      const rows = await parseCSV(
        file(' Mark ,Owner/\u00a0\u00a0Lessor,Operator\t'),
        opts({ ...cols, header_text: ['Mark', 'Owner/ Lessor', 'Operator'] })
      );
      expect(rows).toHaveLength(1);
    });

    it('rejects two swapped columns, naming both', async () => {
      const err = parseCSV(file('Mark,Operator,Owner/Lessor'), opts({ ...cols, header_text }));
      await expect(err).rejects.toThrow(
        /column 1 reads "Operator", expected "Owner\/Lessor"; column 2 reads "Owner\/Lessor", expected "Operator"/
      );
    });

    it('rejects a renamed header, case-sensitively', async () => {
      await expect(
        parseCSV(file('Mark,owner/lessor,Operator'), opts({ ...cols, header_text }))
      ).rejects.toThrow(/column 1 reads "owner\/lessor", expected "Owner\/Lessor"/);
    });

    it('rejects a blank discarded header row', async () => {
      await expect(
        parseCSV(buf(',,\n,,\nN1,Alice,Bob\n'), opts({ ...cols, header_text }))
      ).rejects.toThrow(/no non-empty discarded header row found; expected one starting "Mark"/i);
    });

    it('lets a blank discarded row through when header_text is absent', async () => {
      const rows = await parseCSV(buf(',,\n,,\nN1,Alice,Bob\n'), opts(cols));
      expect(rows).toHaveLength(1);
    });

    it('checks width only when header_text is absent', async () => {
      const rows = await parseCSV(file('Mark,Operator,Owner/Lessor'), opts(cols));
      expect(rows).toHaveLength(1);
    });
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

describe('parseSpreadsheet — discarded header with header_text', () => {
  it('rejects a blank discarded header row', async () => {
    const buf = await sheetBuf('ods', [
      {
        name: 'Sheet1',
        rows: [
          ['', ''],
          ['N1', 'Alice'],
        ],
      },
    ]);
    await expect(
      parseSpreadsheet(buf, {
        ...ssOpts({ columns: ['REG', 'OWNER'], skip_rows: 1 }),
        header_text: ['Mark', 'Owner'],
      })
    ).rejects.toThrow(/no non-empty discarded header row found; expected one starting "Mark"/i);
  });
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
    await expect(parseSpreadsheet(Buffer.from('not-a-spreadsheet'), ssOpts())).rejects.toThrow(
      /valid ZIP archive/i
    );
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
    ).rejects.toThrow(/valid ZIP archive/i);
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
    await expect(parseJson(jbuf('[{bad'), jopts())).rejects.toThrow(SyntaxError);
  });

  it.each([
    ['null', '[null]', /index 0 is not an object \(got null\)/i],
    ['a string', '["x"]', /index 0 is not an object \(got string\)/i],
  ])('fails fast when a record is %s', async (_label, body, message) => {
    await expect(parseJson(jbuf(body), jopts())).rejects.toThrow(message);
  });

  it('fails fast when a record is not an object', async () => {
    await expect(parseJson(jbuf('[{"r":"HB-1"},42]'), jopts())).rejects.toThrow(
      /record at index 1 is not an object/i
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

  it('rejects swapped columns against header_text', async () => {
    await expect(
      parseHtml(
        table([
          ['Owner', 'Mark'],
          ['Alice', 'N1'],
        ]),
        {
          encoding: 'utf8',
          trim: true,
          columns: ['REG', 'OWNER'],
          skip_rows: 1,
          header_text: ['Mark', 'Owner'],
        }
      )
    ).rejects.toThrow(
      /column 0 reads "Owner", expected "Mark"; column 1 reads "Mark", expected "Owner"/
    );
  });

  it('accepts a header matching header_text across &nbsp; and line breaks', async () => {
    const rows = await parseHtml(
      table([
        ['Mark', 'Owner&nbsp;/<br>Lessor'],
        ['N1', 'Alice'],
      ]),
      {
        encoding: 'utf8',
        trim: true,
        columns: ['REG', 'OWNER'],
        skip_rows: 1,
        header_text: ['Mark', 'Owner / Lessor'],
      }
    );
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
  it('keeps cell text verbatim instead of coercing it to numbers or dates', async () => {
    const rows = await parseHtml(
      Buffer.from('<table><tr><td>0123</td><td>1-2</td><td>172E10</td></tr></table>', 'utf8'),
      { encoding: 'utf8', trim: true, columns: ['serial', 'model', 'type'] }
    );
    expect(rows).toEqual([{ serial: '0123', model: '1-2', type: '172E10' }]);
  });

  it('extracts the server-rendered table into one row per aircraft, dropping preamble rows', async () => {
    const rows = await parseHtml(eeBuf(), {
      encoding: 'utf8',
      trim: true,
      columns: eeColumns,
      skip_rows: 2,
    });
    expect(rows).toHaveLength(10);
    expect(rows.every((row) => /^ES - /.test(row.registration_mark))).toBe(true);
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

  it('throws on a page with no parseable <table> (loud failure, never an empty set)', async () => {
    const buf = Buffer.from(
      '<html><body><p>register temporarily unavailable</p></body></html>',
      'utf8'
    );
    await expect(parseHtml(buf, { encoding: 'utf8', trim: true, skip_rows: 2 })).rejects.toThrow(
      /could not find <table>/i
    );
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
