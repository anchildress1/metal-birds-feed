import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadSourceConfig } from '../config/loader.js';
import { errorMessage, log } from '../logger.js';
import { splitPdf } from './chunks.js';
import {
  chunkKey,
  extractPdfRows,
  pdfExtractOptions,
  textLayerPages,
  type PdfExtraction,
} from './extract.js';

/**
 * Writes each fixture PDF's per-chunk responses to `extraction/<pdf>.json`, logging each path. Billed.
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

  const recordOne = async (pdf: string, written: string[]): Promise<string> => {
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
    // A failed chunk throws before the write, so this PDF keeps its previous recording.
    await extractPdfRows(bytes, options).catch((err: unknown) => {
      const done = written.length > 0 ? written.join(', ') : 'none';
      throw new Error(`${pdf}: ${errorMessage(err)} (already written: ${done})`, { cause: err });
    });
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
    log('info', 'pdf_extraction_recorded', { source: sourceId, path: out });
    return out;
  };

  // Chained, not concurrent: each extraction paces from zero, so concurrent PDFs exceed the RPM.
  return pdfs.reduce<Promise<string[]>>(
    (prior, pdf) => prior.then(async (written) => [...written, await recordOne(pdf, written)]),
    Promise.resolve([])
  );
};
