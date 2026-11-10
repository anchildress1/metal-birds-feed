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
 * Records Gemini's validated response for every page chunk of every
 * `<fixturesRoot>/<id>/input/*.pdf`, in chunk order (null for a chunk printing no mark), into
 * `<fixturesRoot>/<id>/extraction/<pdf>.json`. Billed: one paced call per marked chunk.
 * @returns the written paths.
 * @throws when the id is malformed, the source is not a PDF source, it has no fixture PDF, or a
 *   chunk fails extraction (its validated siblings are still written).
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
    // Sequential: each extraction paces its own chunks from zero, so concurrent PDFs would stack
    // their first requests past the RPM.
    const bytes = readFileSync(join(inputDir, pdf));
    let captured: PdfExtraction | undefined;
    const options = pdfExtractOptions(config, {
      // A recording is a fresh answer, never a replay of the last one.
      read: () => Promise.resolve(null),
      write: (extraction) => {
        captured = extraction;
        return Promise.resolve();
      },
    });
    try {
      await extractPdfRows(bytes, options);
    } finally {
      if (captured !== undefined) {
        const [pages, chunks] = await Promise.all([textLayerPages(bytes), splitPdf(bytes)]);
        const entries = captured.entries;
        const responses = chunks.map(
          (c) =>
            entries[
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
    }
  }
  return written;
};
