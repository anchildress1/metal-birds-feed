import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { splitPdf } from '../../src/pdf/chunks.js';
import { recordedTableRows } from './recorded-extraction.js';

const requestTableRows =
  mock<(pdf: Buffer, columns: string[], retry?: unknown, delayMs?: number) => Promise<unknown>>(
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
    expect(requestTableRows.mock.calls.map((c) => c[3])).toEqual([0, 2000]);
  });

  it('writes the chunks that validated, null for the one that failed, then throws', async () => {
    stage('mv-caa', { 'a.pdf': TWO_CHUNKS });
    const [first] = await splitPdf(TWO_CHUNKS);
    requestTableRows.mockImplementation((pdf: Buffer) =>
      pdf.equals(first.bytes) ? recordedTableRows(pdf) : Promise.reject(new Error('MAX_TOKENS'))
    );
    await expect(recordExtraction('mv-caa', root)).rejects.toThrow('MAX_TOKENS');
    const [firstRecorded] = await recorded(TWO_CHUNKS);
    expect(read(join(root, 'mv-caa', 'extraction', 'a.pdf.json'))).toEqual([firstRecorded, null]);
  });

  it('writes nothing for a PDF whose every chunk fails the mark check', async () => {
    stage('mv-caa', { 'a.pdf': TWO_CHUNKS });
    requestTableRows.mockResolvedValue([]);
    await expect(recordExtraction('mv-caa', root)).rejects.toThrow('PDF marks disagree');
    expect(readdirSync(join(root, 'mv-caa', 'extraction'))).toEqual([]);
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
