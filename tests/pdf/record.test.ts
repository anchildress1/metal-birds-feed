import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { splitPdf } from '../../src/pdf/chunks.js';
import { recordedTableRows } from './recorded-extraction.js';

const requestTableRows =
  mock<(pdf: Buffer, columns: string[], opts?: { delayMs?: number }) => Promise<unknown>>(
    recordedTableRows
  );
void mock.module('../../src/pdf/gemini-table.js', () => ({
  requestTableRows,
  PDF_EXTRACT_FINGERPRINT: 'recorded',
}));
const { recordExtraction } = await import('../../src/pdf/record.js');

let root: string;
const savedRpm = process.env.GEMINI_REQUESTS_PER_MINUTE;
beforeEach(() => {
  requestTableRows.mockReset();
  requestTableRows.mockImplementation(recordedTableRows);
  process.env.GEMINI_REQUESTS_PER_MINUTE = '30';
  root = mkdtempSync(join(tmpdir(), 'mbf-record-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  if (savedRpm === undefined) delete process.env.GEMINI_REQUESTS_PER_MINUTE;
  else process.env.GEMINI_REQUESTS_PER_MINUTE = savedRpm;
});

const MV = resolve(import.meta.dirname, '..', '..', 'fixtures', 'mv-caa', 'input');
const TWO_CHUNKS = readFileSync(join(MV, 'register.pdf'));
const ALSO_TWO_CHUNKS = readFileSync(join(MV, 'register-rotated.pdf'));

const stage = (id: string, files: Record<string, string | Buffer>) => {
  mkdirSync(join(root, id, 'input'), { recursive: true });
  for (const [name, body] of Object.entries(files))
    writeFileSync(join(root, id, 'input', name), body);
};
const recorded = async (pdf: Buffer): Promise<unknown[]> =>
  Promise.all((await splitPdf(pdf)).map((c) => recordedTableRows(c.bytes)));
const read = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

describe('recordExtraction', () => {
  it('writes each fixture PDF’s validated per-chunk responses beside it, in chunk order', async () => {
    stage('mv-caa', { 'a.pdf': TWO_CHUNKS, 'b.pdf': ALSO_TWO_CHUNKS, 'notes.txt': 'skip me' });

    // readdir order is filesystem-defined.
    const written = (await recordExtraction('mv-caa', root)).sort();

    expect(written).toEqual([
      join(root, 'mv-caa', 'extraction', 'a.pdf.json'),
      join(root, 'mv-caa', 'extraction', 'b.pdf.json'),
    ]);
    expect(read(written[0])).toEqual(await recorded(TWO_CHUNKS));
    expect(read(written[1])).toEqual(await recorded(ALSO_TWO_CHUNKS));
    expect(readFileSync(written[0], 'utf8')).toEndWith(']\n]\n');
    expect(requestTableRows).toHaveBeenCalledTimes(4);
  });

  it('paces each PDF’s chunk requests at GEMINI_REQUESTS_PER_MINUTE', async () => {
    stage('mv-caa', { 'a.pdf': TWO_CHUNKS });
    await recordExtraction('mv-caa', root);
    expect(requestTableRows.mock.calls.map((c) => c[2]?.delayMs)).toEqual([0, 2000]);
  });

  it('leaves a PDF’s previous recording untouched when any of its chunks fails', async () => {
    stage('mv-caa', { 'a.pdf': TWO_CHUNKS });
    const out = join(root, 'mv-caa', 'extraction', 'a.pdf.json');
    mkdirSync(join(root, 'mv-caa', 'extraction'));
    writeFileSync(out, 'previous');
    const [first] = await splitPdf(TWO_CHUNKS);
    requestTableRows.mockImplementation((pdf: Buffer) =>
      pdf.equals(first.bytes) ? recordedTableRows(pdf) : Promise.reject(new Error('MAX_TOKENS'))
    );
    await expect(recordExtraction('mv-caa', root)).rejects.toThrow(
      /^a\.pdf: .*MAX_TOKENS \(already written: none\)$/
    );
    expect(readFileSync(out, 'utf8')).toBe('previous');
  });

  it('records null for a trailing chunk that prints no mark, which is never sent', async () => {
    // Five marked hr-ccaa pages, then the header-only kind of page markless_pages: 1 budgets.
    const HR = resolve(import.meta.dirname, '..', '..', 'fixtures', 'hr-ccaa', 'input');
    const doc = await PDFDocument.create();
    const parts = ['register.pdf', 'register-rotated.pdf', 'register-tail.pdf'].map((f) =>
      readFileSync(join(HR, f))
    );
    for (const part of parts) {
      const source = await PDFDocument.load(part);
      for (const page of await doc.copyPages(source, source.getPageIndices())) doc.addPage(page);
    }
    doc.addPage();
    const rows = (await Promise.all(parts.map(recorded))).flat(2);
    requestTableRows.mockResolvedValue(rows);
    stage('hr-ccaa', { 'a.pdf': Buffer.from(await doc.save()) });

    const [out] = await recordExtraction('hr-ccaa', root);

    expect(read(out)).toEqual([rows, null]);
    expect(requestTableRows).toHaveBeenCalledTimes(1);
  });

  it.each(['', '../hr-ccaa', 'hr_ccaa', 'HR-CCAA'])(
    'rejects the malformed source id %p before reading anything',
    async (id) => {
      await expect(recordExtraction(id, root)).rejects.toThrow('usage: make record-extraction');
      expect(requestTableRows).not.toHaveBeenCalled();
    }
  );

  it('rejects a source that is not a PDF source', async () => {
    await expect(recordExtraction('faa', root)).rejects.toThrow('Source "faa" is not a PDF source');
    expect(readdirSync(root)).toEqual([]);
  });

  it('rejects a source with no fixture PDF', async () => {
    stage('mv-caa', { 'notes.txt': 'no pdf here' });
    await expect(recordExtraction('mv-caa', root)).rejects.toThrow(
      `No fixture PDF in ${join(root, 'mv-caa', 'input')}`
    );
  });
});
