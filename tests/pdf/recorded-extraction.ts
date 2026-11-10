import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { splitPdf } from '../../src/pdf/chunks.js';

const FIXTURES = resolve(import.meta.dirname, '..', '..', 'fixtures');
const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex');

// Every fixture PDF chunk's recorded Gemini response (`make record-extraction`), keyed by the
// chunk's bytes. Built on first use: a top-level await here races Bun's mock.module evaluation.
const loadRecorded = async (): Promise<Map<string, unknown>> => {
  const recorded = new Map<string, unknown>();
  await Promise.all(
    readdirSync(FIXTURES)
      .filter((id) => existsSync(join(FIXTURES, id, 'extraction')))
      .flatMap((id) =>
        readdirSync(join(FIXTURES, id, 'extraction')).map(async (file) => {
          const pdf = readFileSync(join(FIXTURES, id, 'input', file.replace(/\.json$/, '')));
          const responses = JSON.parse(
            readFileSync(join(FIXTURES, id, 'extraction', file), 'utf8')
          ) as unknown[];
          const chunks = await splitPdf(pdf);
          if (chunks.length !== responses.length)
            throw new Error(`${id}/${file}: ${responses.length} recorded, ${chunks.length} chunks`);
          chunks.forEach((c, i) => recorded.set(sha(c.bytes), responses[i]));
        })
      )
  );
  return recorded;
};
let recordedOnce: Promise<Map<string, unknown>> | undefined;

/** Stands in for requestTableRows: the recorded response for a fixture PDF chunk. */
export const recordedTableRows = async (pdf: Buffer): Promise<unknown> => {
  recordedOnce ??= loadRecorded();
  const rows = (await recordedOnce).get(sha(pdf));
  if (rows === undefined) throw new Error('no recorded extraction for this PDF');
  return rows;
};
