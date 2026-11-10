import { describe, it, expect } from 'bun:test';
import { PDFDocument } from 'pdf-lib';
import { PAGES_PER_CHUNK, splitPdf } from '../../src/pdf/chunks.js';

const pdfOf = async (pages: number): Promise<Buffer> => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([100 + i, 100]);
  return Buffer.from(await doc.save());
};

const widths = async (bytes: Buffer): Promise<number[]> =>
  (await PDFDocument.load(bytes)).getPages().map((p) => p.getWidth());

describe('splitPdf', () => {
  it('splits into consecutive runs of PAGES_PER_CHUNK, the last one short', async () => {
    const chunks = await splitPdf(await pdfOf(12));
    expect(PAGES_PER_CHUNK).toBe(5);
    expect(chunks.map((c) => c.pages)).toEqual([
      [0, 1, 2, 3, 4],
      [5, 6, 7, 8, 9],
      [10, 11],
    ]);
    expect(await widths(chunks[2].bytes)).toEqual([110, 111]);
  });

  it('keeps a document within one chunk whole', async () => {
    const chunks = await splitPdf(await pdfOf(3));
    expect(chunks.map((c) => c.pages)).toEqual([[0, 1, 2]]);
    expect(await widths(chunks[0].bytes)).toEqual([100, 101, 102]);
  });

  it('honors a smaller chunk size', async () => {
    const chunks = await splitPdf(await pdfOf(3), 2);
    expect(chunks.map((c) => c.pages)).toEqual([[0, 1], [2]]);
  });

  // The recorded fixtures key on chunk bytes.
  it('produces byte-identical chunks for identical input', async () => {
    const pdf = await pdfOf(7);
    const [a, b] = await Promise.all([splitPdf(pdf), splitPdf(pdf)]);
    expect(a.map((c, i) => c.bytes.equals(b[i].bytes))).toEqual([true, true]);
  });

  it('rejects bytes that are not a PDF', async () => {
    await expect(splitPdf(Buffer.from('<html>'))).rejects.toThrow();
  });
});
