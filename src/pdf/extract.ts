import { createHash } from 'node:crypto';
import { extractTextItems, getDocumentProxy } from 'unpdf';
import { z } from 'zod';
import { readPositiveIntegerEnv } from '../env.js';
import { DEFAULT_REQUESTS_PER_MINUTE } from '../localize/gemini-client.js';
import { errorMessage, log } from '../logger.js';
import type { Row } from '../parser.js';
import type { RetryOptions } from '../retry.js';
import type { PdfConfig, SourceConfig } from '../types/config.js';
import { splitPdf, type PdfChunk } from './chunks.js';
import { PDF_EXTRACT_FINGERPRINT, requestTableRows } from './gemini-table.js';

// Validated Gemini responses for a source, one per chunk, keyed by `chunkKey`.
export const PdfExtractionSchema = z.object({ entries: z.record(z.string(), z.unknown()) });
export type PdfExtraction = z.infer<typeof PdfExtractionSchema>;

export interface PdfExtractionCache {
  read(): Promise<PdfExtraction | null>;
  write(extraction: PdfExtraction): Promise<void>;
}

export interface ExtractPdfOptions extends PdfConfig {
  source: string;
  columns: string[];
  trim: boolean;
  // Gemini output varies run to run on the same bytes; without a cache an unchanged PDF would
  // advance upstream_hash and churn history and staleness.
  cache: PdfExtractionCache;
  retryOptions?: RetryOptions;
}

/** A PDF source's extraction options, from its config. */
export const pdfExtractOptions = (
  config: SourceConfig,
  cache?: PdfExtractionCache
): ExtractPdfOptions => {
  const columns = config.columns?.[config.primary];
  // The loader guarantees the block and columns for format pdf; this narrows them. The cache is
  // optional only on mapRows, whose other formats never read it.
  if (config.pdf === undefined || columns === undefined || cache === undefined)
    throw new Error(
      `Source "${config.id}" needs a pdf block, primary columns, and an extraction cache`
    );
  return { ...config.pdf, source: config.id, columns, trim: config.trim_all, cache };
};

const pageSpan = (pages: number[]): string => `${pages[0] + 1}-${pages[pages.length - 1] + 1}`;

const noWhitespace = (s: string): string => s.replace(/\s+/g, '');

/** Every page's text items, in reading order. */
export const textLayerPages = async (pdf: Buffer): Promise<string[][]> => {
  // unpdf ships canvas/DOM-typed declarations our tsconfig cannot resolve (masked by skipLibCheck),
  // so its exports surface as untyped at this call boundary.
  const { items } = (await extractTextItems(await getDocumentProxy(new Uint8Array(pdf)))) as {
    items: { str: string }[][];
  };
  return items.map((page) => page.map((i) => i.str));
};

/** Cache key for one chunk's response: what it answered (its pages' text, the columns asked for) and who answered (model + prompt). */
export const chunkKey = (pageTexts: string[][], columns: string[]): string =>
  createHash('sha256')
    .update(
      [...pageTexts.map((items) => items.join('\n')), columns.join('\t')].join('\f') +
        PDF_EXTRACT_FINGERPRINT
    )
    .digest('hex');

// Each item of `a` not matched one-for-one by an item of `b`.
const unmatched = (a: string[], b: string[]): string[] => {
  const pool = new Map<string, number>();
  for (const s of b) pool.set(s, (pool.get(s) ?? 0) + 1);
  return a.filter((s) => {
    const left = pool.get(s) ?? 0;
    pool.set(s, left - 1);
    return left <= 0;
  });
};

const cellText = (value: string, trim: boolean): string =>
  trim
    ? value
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .join('\n')
    : value;

// Checks one chunk's rows one for one against the marks its pages print. The text layer is the
// count the model cannot fake: a model that stops early or merges rows still reports STOP.
const validateChunk = (
  raw: unknown,
  printedMarks: string[],
  schema: z.ZodType<Record<string, string | null>[]>,
  options: ExtractPdfOptions
): Row[] => {
  const rows = schema.parse(raw).map((cells, i) => {
    const row: Row = {};
    for (const [name, value] of Object.entries(cells)) {
      const text = value === null ? '' : cellText(value, options.trim);
      if (text.length > 0) row[name] = text;
    }
    if (row[options.mark_field] === undefined)
      throw new Error(`Gemini PDF extraction row ${i + 1} has no ${options.mark_field}`);
    return row;
  });
  const printed = printedMarks.map(noWhitespace);
  const extracted = rows.map((r) => noWhitespace(r[options.mark_field]));
  const missing = unmatched(printed, extracted);
  const invented = unmatched(extracted, printed);
  if (missing.length > 0 || invented.length > 0)
    throw new Error(
      `PDF marks disagree with the extracted rows (${printed.length} printed, ${extracted.length} extracted): ` +
        `missing ${JSON.stringify(missing.slice(0, 10))}, not printed ${JSON.stringify(invented.slice(0, 10))}`
    );
  return rows;
};

interface ChunkResult {
  key: string;
  raw: unknown;
  fresh: boolean;
  rows: Row[];
}

/**
 * Extracts the register table from a PDF via Gemini, one Row per printed record, in page chunks
 * (one response cannot hold a large register). Reuses a cached response for any chunk whose pages,
 * columns, model, and prompt are unchanged and that still validates; requests the rest at
 * `GEMINI_REQUESTS_PER_MINUTE`. Saves each requested chunk to `cache` as soon as it validates.
 * @throws when the file is not a PDF, its text layer prints no mark, a page prints no mark outside
 *   the trailing `markless_pages`, its two page counts disagree, the cache cannot be read, any
 *   chunk's request fails (see `requestTableRows`) or its response breaks the schema, has a row
 *   without a mark, or disagrees with the marks its pages print, or the end-of-run cache rewrite
 *   of an otherwise clean run fails.
 */
export async function extractPdfRows(pdf: Buffer, options: ExtractPdfOptions): Promise<Row[]> {
  // A register behind a maintenance or error page answers 200 with HTML. The header may follow
  // leading bytes: readers accept it anywhere in the first 1024.
  if (!pdf.subarray(0, 1024).includes('%PDF-'))
    throw new Error(
      `Downloaded file is not a PDF (starts with "${pdf.subarray(0, 40).toString('latin1').replace(/\s+/g, ' ').trim()}")`
    );
  const pages = await textLayerPages(pdf);
  // Pattern source is `sources/<id>.yaml`, repo-controlled config validated by the loader. Wrapped
  // whole: an alternation anchored only at its ends leaves the inner branches matching substrings.
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
  const re = new RegExp(`^(?:${options.mark_pattern})$`);
  const excluded = new Set(options.mark_pattern_exclusions);
  const pageMarks = pages.map((items) =>
    items.map((s) => s.trim()).filter((s) => re.test(s) && !excluded.has(s))
  );
  // Before any paid call: a scanned or drifted PDF fails here for free.
  const markless = pageMarks.flatMap((marks, i) => (marks.length === 0 ? [i + 1] : []));
  if (markless.length === pages.length)
    throw new Error('PDF text layer has no item matching pdf.mark_pattern (scanned or drifted)');
  // Rows on a page printing no mark never reach the mark check, and PDF sources cannot use
  // record_count: an appended scanned page or a new mark series would drop its rows silently. The
  // budget covers trailing pages only, so a mid-document page losing its marks can never spend it.
  const allowed = options.markless_pages ?? 0;
  const lastMarked = pageMarks.findLastIndex((marks) => marks.length > 0);
  const firstBudgeted = Math.max(lastMarked + 1, pages.length - allowed) + 1;
  const unbudgeted = markless.filter((page) => page < firstBudgeted);
  if (unbudgeted.length > 0)
    throw new Error(
      `${unbudgeted.length} PDF pages print no item matching pdf.mark_pattern (pdf.markless_pages allows ${allowed}, at the end only): pages ${unbudgeted.join(', ')}`
    );

  const intervalMs = Math.ceil(
    60_000 / readPositiveIntegerEnv('GEMINI_REQUESTS_PER_MINUTE', DEFAULT_REQUESTS_PER_MINUTE)
  );
  const [chunks, prior] = await Promise.all([splitPdf(pdf), options.cache.read()]);
  // Two parsers count pages independently; a page only one of them sees is never checked.
  const chunked = chunks.reduce((n, c) => n + c.pages.length, 0);
  if (chunked !== pages.length)
    throw new Error(`PDF splits into ${chunked} pages but its text layer has ${pages.length}`);
  const schema = z.array(
    z.strictObject(Object.fromEntries(options.columns.map((c) => [c, z.string().nullable()])))
  );
  const cached = prior?.entries ?? {};
  const validated: Record<string, unknown> = {};
  let writeFailed = false;
  let writes = Promise.resolve();
  // Saved as each paid chunk lands: a job killed at its timeout mid-document would otherwise lose
  // every response it already paid for, and a slow register would re-bill them on every run.
  // Chained so a slower PUT never overwrites a later, fuller one.
  const persist = (): void => {
    const snapshot = { entries: { ...cached, ...validated } };
    writes = writes
      .then(() => options.cache.write(snapshot))
      .catch((err: unknown) => {
        writeFailed = true;
        log('error', 'pdf_extract_cache_write_failed', {
          source: options.source,
          error: errorMessage(err),
        });
      });
  };
  let requested = 0;
  // Starts spaced at the project's RPM: firing every chunk at once draws 429s that outlast the
  // retry budget.
  const request = (chunk: PdfChunk): Promise<unknown> =>
    requestTableRows(chunk.bytes, options.columns, {
      retryOptions: options.retryOptions,
      delayMs: requested++ * intervalMs,
      trace: { source: options.source, pages: pageSpan(chunk.pages) },
    });
  const settled = await Promise.allSettled(
    chunks.map(async (chunk): Promise<ChunkResult | null> => {
      const printed = chunk.pages.flatMap((p) => pageMarks[p]);
      // A page run printing no mark holds no row the check could admit; skip the paid call.
      if (printed.length === 0) return null;
      const key = chunkKey(
        chunk.pages.map((p) => pages[p]),
        options.columns
      );
      if (Object.hasOwn(cached, key)) {
        try {
          return {
            key,
            raw: cached[key],
            fresh: false,
            rows: validateChunk(cached[key], printed, schema, options),
          };
        } catch (err) {
          // A mark_field/pattern change can invalidate a response its key still matches; left in
          // place it would fail every run with no request to replace it.
          log('warn', 'pdf_extract_cache_invalid', {
            source: options.source,
            pages: pageSpan(chunk.pages),
            reason: errorMessage(err),
          });
        }
      }
      const raw = await request(chunk);
      const rows = validateChunk(raw, printed, schema, options);
      validated[key] = raw;
      persist();
      return { key, raw, fresh: true, rows };
    })
  );
  await writes;

  const done = settled.flatMap((s) => (s.status === 'fulfilled' && s.value ? [s.value] : []));
  const hits = done.filter((c) => !c.fresh).length;
  if (hits > 0) log('info', 'pdf_extract_cache_hit', { source: options.source, chunks: hits });
  const failures = settled.flatMap<{ pages: string; reason: unknown }>((s, i) =>
    s.status === 'rejected' ? [{ pages: pageSpan(chunks[i].pages), reason: s.reason }] : []
  );
  // A clean run rewrites the cache from this document's chunks alone, dropping entries for pages
  // no longer printed, and retries a PUT that failed mid-run; that one failing throws. After a
  // chunk failure the chunk is the actionable error, and the saved chunks already cut the re-bill.
  const current = Object.fromEntries(done.map((c) => [c.key, c.raw]));
  const stale = Object.keys(cached).some((k) => !Object.hasOwn(current, k));
  if (failures.length === 0 && (stale || writeFailed))
    await options.cache.write({ entries: current });

  if (failures.length > 0) {
    // The thrown error carries one cause; the others may be different faults (a 503 beside a real
    // mark mismatch) that a rerun would bill again unseen.
    for (const { pages: span, reason } of failures)
      log('error', 'pdf_extract_chunk_failed', {
        source: options.source,
        pages: span,
        error: errorMessage(reason),
      });
    const [first] = failures;
    throw new Error(
      `${failures.length} of ${chunks.length} PDF chunks failed; pages ${first.pages}: ${errorMessage(first.reason)}`,
      { cause: first.reason }
    );
  }
  return done.flatMap((c) => c.rows);
}
