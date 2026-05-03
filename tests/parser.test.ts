import { describe, it, expect } from 'vitest';
import { parseCSV } from '../src/parser.js';

const buf = (s: string): Buffer => Buffer.from(s, 'latin1');
const opts = (overrides: Partial<{ delimiter: string; trim: boolean }> = {}) => ({
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
});
