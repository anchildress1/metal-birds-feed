import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadSourceConfig } from '../config/loader.js';
import { splitPdf } from './chunks.js';
import {
  chunkKey,
  extractPdfRows,
  pdfExtractOptions,
  textLayerPages,
  type PdfExtraction,
} from './extract.js';

/**
 * Writes each fixture PDF's per-chunk responses to `extraction/<pdf>.json`. Billed.
 * @returns the written paths.
 * @throws on a bad id, a non-PDF source, no fixture PDF, or a failed chunk (recording untouched).
 */
export const recordExtraction = async (
  sourceId: string,
  fixturesRoot = 'fixtures'
): Promise<string[]> => {
  // The id becomes a path segment; a source id is kebab-case by convention.
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sourceId))
    throw new Error(`usage: make record-extraction SOURCE=<id> (got "${sourceId}")`);
  const config = loadSourceConfig(`sources/${sourceId}.yaml`);
  if (config.format !== 'pdf') throw new Error(`Source "${sourceId}" is not a PDF source`);
  const inputDir = join(fixturesRoot, sourceId, 'input');
  const pdfs = readdirSync(inputDir).filter((f) => f.endsWith('.pdf'));
  if (pdfs.length === 0) throw new Error(`No fixture PDF in ${inputDir}`);
  const outDir = join(fixturesRoot, sourceId, 'extraction');
  mkdirSync(outDir, { recursive: true });

  const written: string[] = [];
  for (const pdf of pdfs) {
    // Sequential: each extraction paces from zero, so concurrent PDFs exceed the RPM.
    const bytes = readFileSync(join(inputDir, pdf));
    const recorded: PdfExtraction = { entries: {} };
    const options = pdfExtractOptions(config, {
      // A recording is a fresh answer, never a replay of the last one.
      read: () => Promise.resolve(null),
      write: (extraction) => {
        recorded.entries = extraction.entries;
        return Promise.resolve();
      },
    });
    // A partial recording's gaps read as unsent chunks.
    await extractPdfRows(bytes, options);
    const [pages, chunks] = await Promise.all([textLayerPages(bytes), splitPdf(bytes)]);
    const responses = chunks.map(
      (c) =>
        recorded.entries[
          chunkKey(
            c.pages.map((p) => pages[p]),
            options.columns
          )
        ] ?? null
    );
    const out = join(outDir, `${pdf}.json`);
    writeFileSync(out, `${JSON.stringify(responses, null, 2)}\n`);
    written.push(out);
  }
  return written;
};
