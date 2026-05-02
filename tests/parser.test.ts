import { describe, it, expect } from 'vitest';
import { parseCSV } from '../src/parser.js';

const buf = (s: string): Buffer => Buffer.from(s, 'latin1');

describe('parseCSV', () => {
  it('parses a basic comma-delimited file with header row', async () => {
    const rows = await parseCSV(buf('CODE,MFR,MODEL\n001,CESSNA,172\n'), 'latin1', ',');
    expect(rows).toEqual([{ CODE: '001', MFR: 'CESSNA', MODEL: '172' }]);
  });

  it('preserves stray double-quote inside an unquoted field (FAA ACFTREF quirk)', async () => {
    // Mirrors the real-world FAA failure: MODEL value `BABY ACE "` triggers
    // INVALID_OPENING_QUOTE under default csv-parse settings.
    const rows = await parseCSV(
      buf('CODE,MFR,MODEL\n001,CORBEN,BABY ACE "\n002,KISSEL,GUNS"S\n'),
      'latin1',
      ','
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].MODEL).toBe('BABY ACE "');
    expect(rows[1].MODEL).toBe('GUNS"S');
  });

  it('tolerates rows with extra columns (relax_column_count)', async () => {
    const rows = await parseCSV(buf('A,B\n1,2,3\n'), 'latin1', ',');
    expect(rows[0].A).toBe('1');
    expect(rows[0].B).toBe('2');
  });

  it('skips fully empty lines', async () => {
    const rows = await parseCSV(buf('A,B\n1,2\n\n3,4\n'), 'latin1', ',');
    expect(rows).toHaveLength(2);
  });

  it('decodes latin1 bytes (non-ASCII manufacturer name)', async () => {
    // 0xE9 = é in latin1
    const rows = await parseCSV(
      Buffer.from([
        0x4d,
        0x46,
        0x52,
        0x0a, // "MFR\n"
        0x42,
        0xe9,
        0x42,
        0x45,
        0x52,
        0x0a, // "BéBER\n"
      ]),
      'latin1',
      ','
    );
    expect(rows[0].MFR).toBe('BéBER');
  });

  it('supports a non-comma delimiter', async () => {
    const rows = await parseCSV(buf('A|B\n1|2\n'), 'latin1', '|');
    expect(rows).toEqual([{ A: '1', B: '2' }]);
  });

  it('returns an empty array for header-only input', async () => {
    const rows = await parseCSV(buf('A,B\n'), 'latin1', ',');
    expect(rows).toEqual([]);
  });

  it('resolves to an empty array for completely empty input', async () => {
    await expect(parseCSV(buf(''), 'latin1', ',')).resolves.toEqual([]);
  });

  it('rejects when csv-parse encounters an unrecoverable structural error', async () => {
    // An unterminated quoted field at EOF is unrecoverable even with
    // relax_quotes — csv-parse raises CSV_QUOTE_NOT_CLOSED.
    await expect(parseCSV(buf('A,B\n"unterminated\n'), 'latin1', ',')).rejects.toThrow(
      /Quote Not Closed/i
    );
  });

  it('uses explicit columns when provided (no header row consumed)', async () => {
    const rows = await parseCSV(buf('001,CESSNA,172\n002,PIPER,PA28\n'), 'latin1', ',', [
      'CODE',
      'MFR',
      'MODEL',
    ]);
    expect(rows).toEqual([
      { CODE: '001', MFR: 'CESSNA', MODEL: '172' },
      { CODE: '002', MFR: 'PIPER', MODEL: 'PA28' },
    ]);
  });

  it('explicit columns parse all rows including the first one', async () => {
    const rows = await parseCSV(buf('"AAC","Piper"\n"AAJ","Dehavilland"\n'), 'latin1', ',', [
      'MARK',
      'COMMON_NAME',
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].MARK).toBe('AAC');
    expect(rows[1].COMMON_NAME).toBe('Dehavilland');
  });
});
