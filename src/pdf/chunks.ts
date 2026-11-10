import { PDFDocument } from 'pdf-lib';

// One response tops out near 65k output tokens; a dense register page runs ~3k. Five pages keeps
// every chunk well under the cap and lets an append near the end re-bill one chunk.
export const PAGES_PER_CHUNK = 5;

export interface PdfChunk {
  // 0-based page indices this chunk carries, in order.
  pages: number[];
  bytes: Buffer;
}

/**
 * Splits a PDF into consecutive standalone PDFs of up to `PAGES_PER_CHUNK` pages each.
 * Byte-identical output for identical input: metadata dates are not stamped.
 */
export const splitPdf = async (pdf: Buffer): Promise<PdfChunk[]> => {
  const source = await PDFDocument.load(pdf, { updateMetadata: false });
  const count = source.getPageCount();
  const ranges: number[][] = [];
  for (let start = 0; start < count; start += PAGES_PER_CHUNK)
    ranges.push(
      Array.from({ length: Math.min(PAGES_PER_CHUNK, count - start) }, (_, i) => start + i)
    );
  return Promise.all(
    ranges.map(async (pages) => {
      const chunk = await PDFDocument.create({ updateMetadata: false });
      for (const page of await chunk.copyPages(source, pages)) chunk.addPage(page);
      return { pages, bytes: Buffer.from(await chunk.save()) };
    })
  );
};
