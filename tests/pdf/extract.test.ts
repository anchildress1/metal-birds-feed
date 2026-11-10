import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { z } from 'zod';
import { loadSourceConfig } from '../../src/config/loader.js';
import { DEFAULT_REQUESTS_PER_MINUTE } from '../../src/localize/gemini-client.js';
import type { PdfExtraction } from '../../src/pdf/extract.js';
import { recordedTableRows } from './recorded-extraction.js';

const { splitPdf } = await import('../../src/pdf/chunks.js');
const split = mock(splitPdf);
void mock.module('../../src/pdf/chunks.js', () => ({ splitPdf: split }));
const requestTableRows = mock();
const mockGemini = (fingerprint: string) =>
  mock.module('../../src/pdf/gemini-table.js', () => ({
    requestTableRows,
    PDF_EXTRACT_FINGERPRINT: fingerprint,
  }));
void mockGemini('f'.repeat(64));
const { chunkKey, extractPdfRows } = await import('../../src/pdf/extract.js');

const HR = resolve(import.meta.dirname, '..', '..', 'fixtures', 'hr-ccaa', 'input');
const TAIL_PDF = readFileSync(resolve(HR, 'register-tail.pdf'));
const FULL_PDF = readFileSync(resolve(HR, 'register.pdf'));
const COLUMNS = ['mark', 'seq', 'mfr', 'model', 'serial', 'owner', 'address'];
const OPTIONS = {
  source: 'hr-ccaa',
  columns: COLUMNS,
  mark_field: 'mark',
  mark_pattern: '[A-Z]{3}',
  trim: true,
};

type Cells = Record<string, string | null>;
const [TAIL_CHUNK] = await splitPdf(TAIL_PDF);
const tailRows = async (): Promise<Cells[]> =>
  structuredClone((await recordedTableRows(TAIL_CHUNK.bytes)) as Cells[]);

const savedRpm = process.env.GEMINI_REQUESTS_PER_MINUTE;
beforeEach(() => {
  requestTableRows.mockReset();
  requestTableRows.mockImplementation(recordedTableRows);
  split.mockReset();
  split.mockImplementation(splitPdf);
  delete process.env.GEMINI_REQUESTS_PER_MINUTE;
});
afterEach(() => {
  if (savedRpm === undefined) delete process.env.GEMINI_REQUESTS_PER_MINUTE;
  else process.env.GEMINI_REQUESTS_PER_MINUTE = savedRpm;
});

describe('extractPdfRows', () => {
  it('returns one row per extracted record, keeping each printed line of a cell', async () => {
    const rows = await extractPdfRows(TAIL_PDF, OPTIONS);
    expect(rows.map((r) => r.mark)).toEqual(['VIO', 'XCA', 'XGB', 'ZAG', 'ZYZ']);
    expect(rows[2]?.owner).toBe('Karting centar-Zagreb i\nZagrebački prometni zavod\nd.o.o.');
    expect(requestTableRows).toHaveBeenCalledWith(TAIL_CHUNK.bytes, COLUMNS, undefined, 0);
  });

  it('omits a null cell, as an empty printed cell yields no value', async () => {
    const rows = await extractPdfRows(TAIL_PDF, OPTIONS);
    expect(rows[4]).not.toHaveProperty('address');
  });

  it('trims each line and drops blank lines when trim is set, and keeps them raw otherwise', async () => {
    const rows = await tailRows();
    rows[0].owner = '  Aviotrade  \n\n d.o.o. ';
    rows[1].address = '   ';
    requestTableRows.mockResolvedValue(rows);
    const trimmed = await extractPdfRows(TAIL_PDF, OPTIONS);
    expect(trimmed[0]?.owner).toBe('Aviotrade\nd.o.o.');
    expect(trimmed[1]).not.toHaveProperty('address');
    const raw = await extractPdfRows(TAIL_PDF, { ...OPTIONS, trim: false });
    expect(raw[0]?.owner).toBe('  Aviotrade  \n\n d.o.o. ');
    expect(raw[1]?.address).toBe('   ');
  });

  it('rejects a download that is not a PDF without calling Gemini', async () => {
    await expect(extractPdfRows(Buffer.from('<html>maintenance</html>'), OPTIONS)).rejects.toThrow(
      'Downloaded file is not a PDF (starts with "<html>maintenance</html>")'
    );
    expect(requestTableRows).not.toHaveBeenCalled();
  });

  it('accepts a PDF header ending within the first 1024 bytes, and nothing later', async () => {
    const shifted = (by: number) => Buffer.concat([Buffer.alloc(by, 0x20), TAIL_PDF]);
    requestTableRows.mockResolvedValue(await tailRows());
    await expect(extractPdfRows(shifted(1019), OPTIONS)).resolves.toHaveLength(5);
    await expect(extractPdfRows(shifted(1020), OPTIONS)).rejects.toThrow(
      'Downloaded file is not a PDF'
    );
  });

  it('rejects an empty response as missing every printed mark', async () => {
    requestTableRows.mockResolvedValue([]);
    await expect(extractPdfRows(TAIL_PDF, OPTIONS)).rejects.toThrow(
      '(5 printed, 0 extracted): missing ["VIO","XCA","XGB","ZAG","ZYZ"]'
    );
  });

  // The schema break, not some later failure, must be what rejects the response.
  const schemaIssue = async (): Promise<{ code: string; path: PropertyKey[] }> => {
    const error = await extractPdfRows(TAIL_PDF, OPTIONS).catch((e: unknown) => e);
    const cause = (error as Error).cause;
    expect(cause).toBeInstanceOf(z.ZodError);
    return (cause as z.ZodError).issues[0];
  };

  it.each([
    ['a key outside the columns', (r: Cells) => ({ ...r, extra: 'x' }), 'unrecognized_keys', [0]],
    [
      'a missing column',
      (r: Cells) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'serial')),
      'invalid_type',
      [0, 'serial'],
    ],
    ['a non-string cell', (r: Cells) => ({ ...r, seq: 732 }), 'invalid_type', [0, 'seq']],
  ])('rejects a row with %s', async (_label, mutate, code, path) => {
    const rows: unknown[] = await tailRows();
    rows[0] = mutate(rows[0] as Cells);
    requestTableRows.mockResolvedValue(rows);
    expect(await schemaIssue()).toMatchObject({ code, path });
  });

  it('rejects a response that is not an array', async () => {
    requestTableRows.mockResolvedValue({ rows: [] });
    expect(await schemaIssue()).toMatchObject({ code: 'invalid_type', path: [] });
  });

  it.each([null, '  '])('rejects a row whose mark is %p', async (mark) => {
    const rows = await tailRows();
    rows[1].mark = mark;
    requestTableRows.mockResolvedValue(rows);
    await expect(extractPdfRows(TAIL_PDF, OPTIONS)).rejects.toThrow(
      'Gemini PDF extraction row 2 has no mark'
    );
  });

  it('keeps a whitespace mark when trim is off, so the mark check rejects it', async () => {
    const rows = await tailRows();
    rows[1].mark = '  ';
    requestTableRows.mockResolvedValue(rows);
    await expect(extractPdfRows(TAIL_PDF, { ...OPTIONS, trim: false })).rejects.toThrow(
      'missing ["XCA"], not printed [""]'
    );
  });

  it('fails when the model drops a row the PDF prints', async () => {
    requestTableRows.mockResolvedValue((await tailRows()).slice(0, 4));
    await expect(extractPdfRows(TAIL_PDF, OPTIONS)).rejects.toThrow(
      'PDF marks disagree with the extracted rows (5 printed, 4 extracted): missing ["ZYZ"], not printed []'
    );
  });

  it('fails when the model returns a mark the PDF does not print', async () => {
    const rows = await tailRows();
    rows[0].mark = 'VIA';
    requestTableRows.mockResolvedValue(rows);
    await expect(extractPdfRows(TAIL_PDF, OPTIONS)).rejects.toThrow(
      'missing ["VIO"], not printed ["VIA"]'
    );
  });

  it('fails when the model repeats a row, counting marks one for one', async () => {
    const rows = await tailRows();
    requestTableRows.mockResolvedValue([...rows, rows[0]]);
    await expect(extractPdfRows(TAIL_PDF, OPTIONS)).rejects.toThrow(
      '(5 printed, 6 extracted): missing [], not printed ["VIO"]'
    );
  });

  it('compares marks with whitespace removed', async () => {
    const rows = await tailRows();
    rows[0].mark = 'V IO';
    requestTableRows.mockResolvedValue(rows);
    await expect(extractPdfRows(TAIL_PDF, OPTIONS)).resolves.toHaveLength(5);
  });

  // register.pdf prints "PZO" as its own line inside an owner cell; it matches the bare mark pattern.
  it('counts a pattern match as a mark unless it is listed in mark_pattern_exclusions', async () => {
    await expect(extractPdfRows(FULL_PDF, OPTIONS)).rejects.toThrow('missing ["PZO"]');
    await expect(
      extractPdfRows(FULL_PDF, { ...OPTIONS, mark_pattern_exclusions: ['PZO'] })
    ).resolves.toHaveLength(33);
  });

  it('propagates a Gemini failure, naming the pages it covered', async () => {
    const cause = new Error('Gemini PDF extraction ended with MAX_TOKENS, not STOP');
    requestTableRows.mockRejectedValue(cause);
    const error = await extractPdfRows(TAIL_PDF, OPTIONS).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      '1 of 1 PDF chunks failed; pages 1-1: Gemini PDF extraction ended with MAX_TOKENS, not STOP'
    );
    expect((error as Error).cause).toBe(cause);
  });

  it('rejects a malformed GEMINI_REQUESTS_PER_MINUTE before calling Gemini', async () => {
    process.env.GEMINI_REQUESTS_PER_MINUTE = 'fast';
    await expect(extractPdfRows(TAIL_PDF, OPTIONS)).rejects.toThrow(
      'GEMINI_REQUESTS_PER_MINUTE must be a positive integer'
    );
    expect(requestTableRows).not.toHaveBeenCalled();
  });

  it('fails on a PDF whose text layer prints no mark, without calling Gemini', async () => {
    await expect(
      extractPdfRows(TAIL_PDF, { ...OPTIONS, mark_pattern: 'NOPE-[0-9]{9}' })
    ).rejects.toThrow('PDF text layer has no item matching pdf.mark_pattern');
    expect(requestTableRows).not.toHaveBeenCalled();
  });

  it('matches mark_pattern against whole text items, every alternative included', async () => {
    // Unwrapped, the bare `o` branch would count every item containing an "o" ("Aviotrade").
    requestTableRows.mockResolvedValue((await tailRows()).slice(0, 1));
    await expect(
      extractPdfRows(TAIL_PDF, { ...OPTIONS, mark_pattern: 'VIO|o' })
    ).resolves.toHaveLength(1);
  });

  it('fails before any paid call when the two page counts disagree', async () => {
    split.mockImplementation(async (pdf: Buffer) => (await splitPdf(pdf)).slice(1));
    await expect(extractPdfRows(FULL_PDF, OPTIONS)).rejects.toThrow(
      'PDF splits into 0 pages but its text layer has 2'
    );
    expect(requestTableRows).not.toHaveBeenCalled();
  });
});

describe('extractPdfRows page chunks', () => {
  const MV_PDF = readFileSync(
    resolve(import.meta.dirname, '..', '..', 'fixtures', 'mv-caa', 'input', 'register.pdf')
  );
  const mv = loadSourceConfig('sources/mv-caa.yaml');
  const MV = {
    source: 'mv-caa',
    columns: mv.columns?.[mv.primary] ?? [],
    mark_field: 'mark',
    mark_pattern: mv.pdf?.mark_pattern ?? '',
    trim: true,
  };

  it('extracts each chunk separately and returns the rows in page order', async () => {
    const rows = await extractPdfRows(MV_PDF, MV);
    const chunks = await splitPdf(MV_PDF);
    expect(requestTableRows).toHaveBeenCalledTimes(2);
    const recorded = await Promise.all(chunks.map((c) => recordedTableRows(c.bytes)));
    expect(rows.map((r) => r.mark as string | null)).toEqual(
      recorded.flatMap((r) => (r as Cells[]).map((c) => c.mark))
    );
  });

  it('spaces request starts at GEMINI_REQUESTS_PER_MINUTE', async () => {
    process.env.GEMINI_REQUESTS_PER_MINUTE = '30';
    await extractPdfRows(MV_PDF, MV);
    expect(requestTableRows.mock.calls.map((c) => c[3] as number).sort((a, b) => a - b)).toEqual([
      0, 2000,
    ]);
  });

  it('spaces at the default rate when GEMINI_REQUESTS_PER_MINUTE is unset', async () => {
    await extractPdfRows(MV_PDF, MV);
    expect(requestTableRows.mock.calls.map((c) => c[3] as number).sort((a, b) => a - b)).toEqual([
      0,
      Math.ceil(60_000 / DEFAULT_REQUESTS_PER_MINUTE),
    ]);
  });

  it('checks marks per chunk, so a row moved across a chunk boundary fails', async () => {
    const [first, second] = await Promise.all(
      (await splitPdf(MV_PDF)).map(async (c) => (await recordedTableRows(c.bytes)) as Cells[])
    );
    requestTableRows
      .mockResolvedValueOnce([...first, second[0]])
      .mockResolvedValueOnce(second.slice(1));
    await expect(extractPdfRows(MV_PDF, MV)).rejects.toThrow('2 of 2 PDF chunks failed');
  });

  // TAIL_PDF's page followed by five blank pages: a whole chunk printing no mark.
  const withBlankChunk = async (): Promise<Buffer> => {
    const doc = await PDFDocument.create();
    const source = await PDFDocument.load(TAIL_PDF);
    for (const page of await doc.copyPages(source, source.getPageIndices())) doc.addPage(page);
    for (let i = 0; i < 5; i++) doc.addPage();
    return Buffer.from(await doc.save());
  };

  it('fails before any paid call when more pages print no mark than markless_pages allows', async () => {
    const pdf = await withBlankChunk();
    await expect(extractPdfRows(pdf, OPTIONS)).rejects.toThrow(
      '5 PDF pages print no item matching pdf.mark_pattern (pdf.markless_pages allows 0): pages 2, 3, 4, 5, 6'
    );
    await expect(extractPdfRows(pdf, { ...OPTIONS, markless_pages: 4 })).rejects.toThrow(
      'allows 4'
    );
    expect(requestTableRows).not.toHaveBeenCalled();
  });

  it('skips the paid call for a chunk whose pages print no mark, within markless_pages', async () => {
    requestTableRows.mockImplementation(tailRows);
    const rows = await extractPdfRows(await withBlankChunk(), { ...OPTIONS, markless_pages: 5 });
    expect(rows).toHaveLength(5);
    expect(requestTableRows).toHaveBeenCalledTimes(1);
  });
});

describe('extractPdfRows extraction cache', () => {
  const cacheOf = (stored: PdfExtraction | null) => {
    const write = mock<(e: PdfExtraction) => Promise<void>>(() => Promise.resolve());
    return { cache: { read: () => Promise.resolve(stored), write }, write };
  };
  // What a fresh run stores for TAIL_PDF.
  const storedFor = async (options = OPTIONS): Promise<PdfExtraction> => {
    const { cache, write } = cacheOf(null);
    await extractPdfRows(TAIL_PDF, { ...options, cache });
    requestTableRows.mockClear();
    return write.mock.calls[0][0];
  };

  it('stores one validated response per chunk when nothing is cached', async () => {
    const stored = await storedFor();
    expect(Object.values(stored.entries)).toEqual([await tailRows()]);
  });

  it('reuses a stored chunk for the same pages, columns, model, and prompt without calling Gemini', async () => {
    const { cache, write } = cacheOf(await storedFor());
    await expect(extractPdfRows(TAIL_PDF, { ...OPTIONS, cache })).resolves.toHaveLength(5);
    expect(requestTableRows).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('re-requests a chunk when the columns asked for change', async () => {
    const { cache } = cacheOf(await storedFor());
    requestTableRows.mockImplementation(async () =>
      (await tailRows()).map((r) => ({ ...r, note: null }))
    );
    await extractPdfRows(TAIL_PDF, { ...OPTIONS, columns: [...COLUMNS, 'note'], cache });
    expect(requestTableRows).toHaveBeenCalledTimes(1);
  });

  it('keys a chunk on its pages, its columns, and the model + prompt fingerprint', async () => {
    const base = chunkKey([['VIO', 'Aviotrade']], COLUMNS);
    expect(chunkKey([['VIO', 'Aviotrade']], COLUMNS)).toBe(base);
    expect(chunkKey([['VIO', 'Aviotrade d.o.o.']], COLUMNS)).not.toBe(base);
    expect(chunkKey([['VIO'], ['Aviotrade']], COLUMNS)).not.toBe(base);
    expect(chunkKey([['VIO', 'Aviotrade']], [...COLUMNS, 'note'])).not.toBe(base);
    await mockGemini('0'.repeat(64));
    try {
      expect(chunkKey([['VIO', 'Aviotrade']], COLUMNS)).not.toBe(base);
    } finally {
      await mockGemini('f'.repeat(64));
    }
  });

  it('drops entries for pages the document no longer prints', async () => {
    const stored = await storedFor();
    const { cache, write } = cacheOf({ entries: { stale: [] } });
    await extractPdfRows(TAIL_PDF, { ...OPTIONS, cache });
    expect(write).toHaveBeenCalledWith(stored);
  });

  it('never stores a response that fails validation', async () => {
    requestTableRows.mockResolvedValue((await tailRows()).slice(0, 4));
    const { cache, write } = cacheOf(null);
    await expect(extractPdfRows(TAIL_PDF, { ...OPTIONS, cache })).rejects.toThrow(
      'PDF marks disagree'
    );
    expect(write).not.toHaveBeenCalled();
  });

  const MV_PDF = readFileSync(
    resolve(import.meta.dirname, '..', '..', 'fixtures', 'mv-caa', 'input', 'register.pdf')
  );
  const mv = loadSourceConfig('sources/mv-caa.yaml');
  const options = {
    source: 'mv-caa',
    columns: mv.columns?.[mv.primary] ?? [],
    mark_field: 'mark',
    mark_pattern: mv.pdf?.mark_pattern ?? '',
    trim: true,
  };
  // What a fresh run stores for both of MV_PDF's chunks, in chunk order.
  const storedForMv = async (): Promise<PdfExtraction> => {
    const { cache, write } = cacheOf(null);
    await extractPdfRows(MV_PDF, { ...options, cache });
    requestTableRows.mockClear();
    return write.mock.calls[0][0];
  };

  it('round-trips a two-chunk document: one entry per chunk, then no call at all', async () => {
    const stored = await storedForMv();
    expect(Object.keys(stored.entries)).toHaveLength(2);
    const { cache, write } = cacheOf(stored);
    await extractPdfRows(MV_PDF, { ...options, cache });
    expect(requestTableRows).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('bills only the uncached chunk, keeps the cached one in the write, and spends no slot on it', async () => {
    const stored = await storedForMv();
    const [firstKey] = Object.keys(stored.entries);
    const { cache, write } = cacheOf({ entries: { [firstKey]: stored.entries[firstKey] } });
    await extractPdfRows(MV_PDF, { ...options, cache });
    expect(requestTableRows).toHaveBeenCalledTimes(1);
    expect(requestTableRows.mock.calls[0][3]).toBe(0);
    expect(write).toHaveBeenCalledWith(stored);
  });

  it('stores the chunks that validated before throwing for the one that did not', async () => {
    const [first] = await splitPdf(MV_PDF);
    requestTableRows.mockImplementation((pdf: Buffer) =>
      pdf.equals(first.bytes) ? recordedTableRows(pdf) : Promise.reject(new Error('503'))
    );
    const { cache, write } = cacheOf(null);
    await expect(extractPdfRows(MV_PDF, { ...options, cache })).rejects.toThrow(
      '1 of 2 PDF chunks failed; pages 6-8: 503'
    );
    expect(Object.values(write.mock.calls[0][0].entries)).toEqual([
      await recordedTableRows(first.bytes),
    ]);
  });

  it('re-requests and replaces a cached response that no longer validates', async () => {
    const stored = await storedFor();
    const [key] = Object.keys(stored.entries);
    const { cache, write } = cacheOf({ entries: { [key]: (await tailRows()).slice(0, 4) } });
    await expect(extractPdfRows(TAIL_PDF, { ...OPTIONS, cache })).resolves.toHaveLength(5);
    expect(requestTableRows).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(stored);
  });

  it('throws a failed cache write when every chunk validated', async () => {
    const { cache, write } = cacheOf(null);
    write.mockRejectedValue(new Error('PUT 500'));
    await expect(extractPdfRows(TAIL_PDF, { ...OPTIONS, cache })).rejects.toThrow('PUT 500');
  });

  it('reports the chunk failure, not a failed cache write, when both happen', async () => {
    const [first] = await splitPdf(MV_PDF);
    requestTableRows.mockImplementation((pdf: Buffer) =>
      pdf.equals(first.bytes) ? recordedTableRows(pdf) : Promise.reject(new Error('503'))
    );
    const { cache, write } = cacheOf(null);
    write.mockRejectedValue(new Error('PUT 500'));
    await expect(extractPdfRows(MV_PDF, { ...options, cache })).rejects.toThrow(
      '1 of 2 PDF chunks failed; pages 6-8: 503'
    );
  });

  it('fails the source when the cache cannot be read', async () => {
    const cache = { read: () => Promise.reject(new Error('GET 500')), write: mock() };
    await expect(extractPdfRows(TAIL_PDF, { ...OPTIONS, cache })).rejects.toThrow('GET 500');
    expect(requestTableRows).not.toHaveBeenCalled();
  });
});
