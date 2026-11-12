import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { z } from 'zod';
import { loadSourceConfig } from '../../src/config/loader.js';
import { DEFAULT_REQUESTS_PER_MINUTE } from '../../src/localize/gemini-client.js';
import type { PdfExtraction } from '../../src/pdf/extract.js';
import { recordedTableRows } from './recorded-extraction.js';

const unpdf = await import('unpdf');
// Held before mocking: mock.module rebinds the namespace export to the mock itself.
const realExtractTextItems = unpdf.extractTextItems;
const extractTextItems = mock(realExtractTextItems);
void mock.module('unpdf', () => ({ ...unpdf, extractTextItems }));
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
const { chunkKey, extractPdfRows, pdfExtractOptions } = await import('../../src/pdf/extract.js');

const HR = resolve(import.meta.dirname, '..', '..', 'fixtures', 'hr-ccaa', 'input');
const TAIL_PDF = readFileSync(resolve(HR, 'register-tail.pdf'));
const FULL_PDF = readFileSync(resolve(HR, 'register.pdf'));
const COLUMNS = ['mark', 'seq', 'mfr', 'model', 'serial', 'owner', 'address'];
const NO_CACHE = { read: () => Promise.resolve(null), write: () => Promise.resolve() };
const OPTIONS = {
  cache: NO_CACHE,
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
  extractTextItems.mockReset();
  extractTextItems.mockImplementation(realExtractTextItems);
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
    expect(requestTableRows).toHaveBeenCalledWith(TAIL_CHUNK.bytes, COLUMNS, {
      retryOptions: { baseDelayMs: 60_000 / DEFAULT_REQUESTS_PER_MINUTE },
      delayMs: 0,
      trace: { source: 'hr-ccaa', pages: '1-1' },
    });
  });

  it('backs a retry off from one request slot unless the caller sets its own base delay', async () => {
    process.env.GEMINI_REQUESTS_PER_MINUTE = '10';
    const sleep = () => Promise.resolve();
    await extractPdfRows(TAIL_PDF, OPTIONS);
    await extractPdfRows(TAIL_PDF, { ...OPTIONS, retryOptions: { baseDelayMs: 0, sleep } });
    expect(requestTableRows).toHaveBeenNthCalledWith(
      1,
      TAIL_CHUNK.bytes,
      COLUMNS,
      expect.objectContaining({ retryOptions: { baseDelayMs: 6000 } })
    );
    expect(requestTableRows).toHaveBeenNthCalledWith(
      2,
      TAIL_CHUNK.bytes,
      COLUMNS,
      expect.objectContaining({ retryOptions: { baseDelayMs: 0, sleep } })
    );
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
    const extracted = await extractPdfRows(TAIL_PDF, OPTIONS);
    expect(extracted).toHaveLength(5);
    // Only the comparison ignores whitespace; the row keeps the model's text for the transforms.
    expect(extracted[0]?.mark).toBe('V IO');
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
      '1 of 1 sent PDF chunks failed; pages 1-1: Gemini PDF extraction ended with MAX_TOKENS, not STOP'
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

  it('fails on a PDF whose text layer prints no mark, without calling Gemini, whatever the budget', async () => {
    for (const markless_pages of [undefined, 99])
      await expect(
        extractPdfRows(TAIL_PDF, { ...OPTIONS, mark_pattern: 'NOPE-[0-9]{9}', markless_pages })
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

  it('matches marks and exclusions against text items with their edge whitespace trimmed', async () => {
    // pdf.js trims the runs a generated PDF draws, so the real text layer is padded after the fact.
    extractTextItems.mockImplementation(async (...args) => {
      const layer = await realExtractTextItems(...args);
      return {
        ...layer,
        items: layer.items.map((page) => page.map((item) => ({ ...item, str: ` ${item.str}  ` }))),
      };
    });
    await expect(
      extractPdfRows(FULL_PDF, { ...OPTIONS, mark_pattern_exclusions: ['PZO'] })
    ).resolves.toHaveLength(33);
  });

  it('fails before any paid call when the PDF splits into more pages than its text layer', async () => {
    split.mockImplementation(async (pdf: Buffer) => {
      const chunks = await splitPdf(pdf);
      return [...chunks, { ...chunks[0], pages: [chunks.length] }];
    });
    await expect(extractPdfRows(TAIL_PDF, OPTIONS)).rejects.toThrow(
      'PDF splits into 2 pages but its text layer has 1'
    );
    expect(requestTableRows).not.toHaveBeenCalled();
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
    cache: NO_CACHE,
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

  it('keeps page order when a later chunk answers first', async () => {
    const [first] = await splitPdf(MV_PDF);
    requestTableRows.mockImplementation(async (pdf: Buffer) => {
      if (pdf.equals(first.bytes)) await new Promise((r) => setTimeout(r, 20));
      return recordedTableRows(pdf);
    });
    const rows = await extractPdfRows(MV_PDF, MV);
    const recorded = await Promise.all(
      (await splitPdf(MV_PDF)).map((c) => recordedTableRows(c.bytes))
    );
    expect(rows.map((r) => r.mark as string | null)).toEqual(
      recorded.flatMap((r) => (r as Cells[]).map((c) => c.mark))
    );
  });

  it('spaces request starts at GEMINI_REQUESTS_PER_MINUTE', async () => {
    process.env.GEMINI_REQUESTS_PER_MINUTE = '30';
    await extractPdfRows(MV_PDF, MV);
    expect(
      requestTableRows.mock.calls
        .map((c) => (c[2] as { delayMs: number }).delayMs)
        .sort((a, b) => a - b)
    ).toEqual([0, 2000]);
  });

  it('spaces at the default rate when GEMINI_REQUESTS_PER_MINUTE is unset', async () => {
    await extractPdfRows(MV_PDF, MV);
    expect(
      requestTableRows.mock.calls
        .map((c) => (c[2] as { delayMs: number }).delayMs)
        .sort((a, b) => a - b)
    ).toEqual([0, Math.ceil(60_000 / DEFAULT_REQUESTS_PER_MINUTE)]);
  });

  it('logs every failed chunk, not only the one the error names', async () => {
    requestTableRows
      .mockRejectedValueOnce(new Error('503'))
      .mockRejectedValueOnce(new Error('MAX_TOKENS'));
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});
    try {
      await expect(extractPdfRows(MV_PDF, MV)).rejects.toThrow(
        '2 of 2 sent PDF chunks failed; pages 1-5: 503'
      );
      const logged = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(logged).toContain('event=pdf_extract_chunk_failed source=mv-caa pages=1-5 error=503');
      expect(logged).toContain(
        'event=pdf_extract_chunk_failed source=mv-caa pages=6-8 error=MAX_TOKENS'
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  it('checks marks per chunk, so a row moved across a chunk boundary fails', async () => {
    const [first, second] = await Promise.all(
      (await splitPdf(MV_PDF)).map(async (c) => (await recordedTableRows(c.bytes)) as Cells[])
    );
    requestTableRows
      .mockResolvedValueOnce([...first, second[0]])
      .mockResolvedValueOnce(second.slice(1));
    await expect(extractPdfRows(MV_PDF, MV)).rejects.toThrow('2 of 2 sent PDF chunks failed');
  });

  // TAIL_PDF's page followed by five blank pages: a whole chunk printing no mark.
  const withBlankChunk = async (): Promise<Buffer> => {
    const doc = await PDFDocument.create();
    const source = await PDFDocument.load(TAIL_PDF);
    for (const page of await doc.copyPages(source, source.getPageIndices())) doc.addPage(page);
    for (let i = 0; i < 5; i++) doc.addPage();
    return Buffer.from(await doc.save());
  };

  it('fails before any paid call when more trailing pages print no mark than markless_pages allows', async () => {
    const pdf = await withBlankChunk();
    await expect(extractPdfRows(pdf, OPTIONS)).rejects.toThrow(
      '5 PDF pages print no item matching pdf.mark_pattern (pdf.markless_pages allows 0, at the end only): pages 2, 3, 4, 5, 6'
    );
    await expect(extractPdfRows(pdf, { ...OPTIONS, markless_pages: 4 })).rejects.toThrow(
      '1 PDF pages print no item matching pdf.mark_pattern (pdf.markless_pages allows 4, at the end only): pages 2'
    );
    expect(requestTableRows).not.toHaveBeenCalled();
  });

  it('never spends markless_pages on a mark-less page before the last marked one', async () => {
    const doc = await PDFDocument.create();
    const source = await PDFDocument.load(TAIL_PDF);
    const [first] = await doc.copyPages(source, [0]);
    const [second] = await doc.copyPages(source, [0]);
    doc.addPage(first);
    doc.addPage();
    doc.addPage(second);
    await expect(
      extractPdfRows(Buffer.from(await doc.save()), { ...OPTIONS, markless_pages: 1 })
    ).rejects.toThrow('(pdf.markless_pages allows 1, at the end only): pages 2');
    expect(requestTableRows).not.toHaveBeenCalled();
  });

  it('counts a page whose only pattern matches are exclusions as printing no mark', async () => {
    const doc = await PDFDocument.create();
    for (const pdf of [MV_PDF, TAIL_PDF]) {
      const source = await PDFDocument.load(pdf);
      const [page] = await doc.copyPages(source, [0]);
      doc.addPage(page);
    }
    const marks = (await tailRows()).map((r) => r.mark as string);
    await expect(
      extractPdfRows(Buffer.from(await doc.save()), {
        ...OPTIONS,
        mark_pattern: `8Q-[A-Z]{3}|${marks.join('|')}`,
        mark_pattern_exclusions: marks,
      })
    ).rejects.toThrow('at the end only): pages 2');
    expect(requestTableRows).not.toHaveBeenCalled();
  });

  it('counts only sent chunks in a failure, never an unsent mark-less one', async () => {
    requestTableRows.mockRejectedValue(new Error('503'));
    await expect(
      extractPdfRows(await withBlankChunk(), { ...OPTIONS, markless_pages: 5 })
    ).rejects.toThrow('1 of 1 sent PDF chunks failed');
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
    return write.mock.lastCall?.[0] ?? { entries: {} };
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
    expect(write).toHaveBeenLastCalledWith(stored);
  });

  it('drops stale entries even on a run that bills nothing', async () => {
    const stored = await storedFor();
    const { cache, write } = cacheOf({ entries: { ...stored.entries, stale: [] } });
    await extractPdfRows(TAIL_PDF, { ...OPTIONS, cache });
    expect(requestTableRows).not.toHaveBeenCalled();
    expect(write.mock.calls).toEqual([[stored]]);
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
    cache: NO_CACHE,
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
    return write.mock.lastCall?.[0] ?? { entries: {} };
  };

  it('round-trips a two-chunk document: one entry per chunk, then no call at all', async () => {
    const stored = await storedForMv();
    expect(Object.keys(stored.entries)).toHaveLength(2);
    const { cache, write } = cacheOf(stored);
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});
    try {
      await extractPdfRows(MV_PDF, { ...options, cache });
      expect(logSpy.mock.calls.map((c) => String(c[0])).join('\n')).toContain(
        'level=info event=pdf_extract_cache_hit source=mv-caa chunks=2'
      );
    } finally {
      logSpy.mockRestore();
    }
    expect(requestTableRows).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('bills only the uncached chunk, keeps the cached one in the write, and spends no slot on it', async () => {
    const stored = await storedForMv();
    const [firstKey] = Object.keys(stored.entries);
    const { cache, write } = cacheOf({ entries: { [firstKey]: stored.entries[firstKey] } });
    await extractPdfRows(MV_PDF, { ...options, cache });
    expect(requestTableRows).toHaveBeenCalledTimes(1);
    expect(requestTableRows.mock.calls[0][2]).toMatchObject({ delayMs: 0 });
    expect(write).toHaveBeenCalledWith(stored);
  });

  it('stores the chunks that validated before throwing for the one that did not', async () => {
    const [first] = await splitPdf(MV_PDF);
    requestTableRows.mockImplementation((pdf: Buffer) =>
      pdf.equals(first.bytes) ? recordedTableRows(pdf) : Promise.reject(new Error('503'))
    );
    const { cache, write } = cacheOf(null);
    await expect(extractPdfRows(MV_PDF, { ...options, cache })).rejects.toThrow(
      '1 of 2 sent PDF chunks failed; pages 6-8: 503'
    );
    expect(Object.values(write.mock.calls[0][0].entries)).toEqual([
      await recordedTableRows(first.bytes),
    ]);
  });

  it('saves a validated chunk before the others settle, so a killed run keeps what it paid for', async () => {
    const [first] = await splitPdf(MV_PDF);
    const { promise: gate, resolve: release } = Promise.withResolvers<void>();
    requestTableRows.mockImplementation(async (pdf: Buffer) => {
      if (!pdf.equals(first.bytes)) await gate;
      return recordedTableRows(pdf);
    });
    const { cache, write } = cacheOf(null);
    const { promise: firstWrite, resolve: wrote } = Promise.withResolvers<PdfExtraction>();
    write.mockImplementationOnce((e) => {
      wrote(e);
      return Promise.resolve();
    });
    const run = extractPdfRows(MV_PDF, { ...options, cache });
    expect(Object.values((await firstWrite).entries)).toEqual([
      await recordedTableRows(first.bytes),
    ]);
    release();
    await run;
    expect(write).toHaveBeenLastCalledWith(await storedForMv());
  });

  it('retries a cache write that failed mid-run once every chunk validated', async () => {
    const stored = await storedFor();
    const { cache, write } = cacheOf(null);
    write.mockRejectedValueOnce(new Error('PUT 500'));
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});
    try {
      await expect(extractPdfRows(TAIL_PDF, { ...OPTIONS, cache })).resolves.toHaveLength(5);
    } finally {
      logSpy.mockRestore();
    }
    expect(write.mock.calls).toEqual([[stored], [stored]]);
  });

  it('lands each cache write after the one before it, the end-of-run rewrite last', async () => {
    const stored = await storedForMv();
    requestTableRows.mockImplementation(recordedTableRows);
    const { cache, write } = cacheOf({ entries: { stale: [] } });
    const { promise: gate, resolve: release } = Promise.withResolvers<void>();
    const landed: string[][] = [];
    write.mockImplementationOnce(async (e) => {
      await gate;
      landed.push(Object.keys(e.entries));
    });
    write.mockImplementation((e) => {
      landed.push(Object.keys(e.entries));
      return Promise.resolve();
    });
    const run = extractPdfRows(MV_PDF, { ...options, cache });
    await new Promise((settle) => setTimeout(settle, 20));
    expect(requestTableRows).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenCalledTimes(1);
    release();
    await run;
    expect(landed.map((keys) => keys.length)).toEqual([2, 3, 2]);
    expect(write).toHaveBeenLastCalledWith(stored);
  });

  it('re-requests and replaces a cached response that no longer validates', async () => {
    const stored = await storedFor();
    const [key] = Object.keys(stored.entries);
    const { cache, write } = cacheOf({ entries: { [key]: (await tailRows()).slice(0, 4) } });
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});
    try {
      await expect(extractPdfRows(TAIL_PDF, { ...OPTIONS, cache })).resolves.toHaveLength(5);
      expect(logSpy.mock.calls.map((c) => String(c[0])).join('\n')).toContain(
        'level=warn event=pdf_extract_cache_invalid source=hr-ccaa pages=1-1'
      );
    } finally {
      logSpy.mockRestore();
    }
    expect(requestTableRows).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(stored);
  });

  it('throws a failed cache write when every chunk validated', async () => {
    const { cache, write } = cacheOf(null);
    write.mockRejectedValue(new Error('PUT 500'));
    await expect(extractPdfRows(TAIL_PDF, { ...OPTIONS, cache })).rejects.toThrow(
      'PDF extraction cache rewrite failed: PUT 500'
    );
  });

  it('reports the chunk failure, not a failed cache write, when both happen', async () => {
    const [first] = await splitPdf(MV_PDF);
    requestTableRows.mockImplementation((pdf: Buffer) =>
      pdf.equals(first.bytes) ? recordedTableRows(pdf) : Promise.reject(new Error('503'))
    );
    const { cache, write } = cacheOf(null);
    write.mockRejectedValue(new Error('PUT 500'));
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});
    try {
      await expect(extractPdfRows(MV_PDF, { ...options, cache })).rejects.toThrow(
        '1 of 2 sent PDF chunks failed; pages 6-8: 503'
      );
      // The swallowed PUT failure is the only record that the next run re-bills this chunk.
      expect(logSpy.mock.calls.map((c) => String(c[0])).join('\n')).toContain(
        'level=error event=pdf_extract_cache_write_failed source=mv-caa error="PUT 500"'
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  it('fails the source when the cache cannot be read', async () => {
    const cache = { read: () => Promise.reject(new Error('GET 500')), write: mock() };
    await expect(extractPdfRows(TAIL_PDF, { ...OPTIONS, cache })).rejects.toThrow('GET 500');
    expect(requestTableRows).not.toHaveBeenCalled();
  });
});

describe('pdfExtractOptions', () => {
  const hr = loadSourceConfig('sources/hr-ccaa.yaml');

  it('builds the options from a PDF source config and its cache', () => {
    expect(pdfExtractOptions(hr, NO_CACHE)).toMatchObject({
      source: 'hr-ccaa',
      columns: hr.columns?.[hr.primary],
      mark_field: hr.pdf?.mark_field,
      trim: hr.trim_all,
      cache: NO_CACHE,
    });
  });

  it('refuses a PDF source mapped without an extraction cache', () => {
    expect(() => pdfExtractOptions(hr, undefined)).toThrow(
      'Source "hr-ccaa" needs a pdf block, primary columns, and an extraction cache'
    );
  });
});
