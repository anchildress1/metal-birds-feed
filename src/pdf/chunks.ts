import { PDFDocument } from 'pdf-lib';

// Well under the output-token cap per response; an append re-bills only the last chunk.
export const PAGES_PER_CHUNK = 5;

export interface PdfChunk {
  // 0-based page indices this chunk carries, in order.
  pages: number[];
  bytes: Buffer;
}

/** Splits a PDF into standalone `PAGES_PER_CHUNK`-page PDFs, byte-identical for identical input. */
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
