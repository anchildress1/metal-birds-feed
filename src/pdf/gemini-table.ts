import { createHash } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { FinishReason, GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { requireEnv } from '../env.js';
import { retry, type RetryOptions } from '../retry.js';
import { isRetryableGeminiError } from '../localize/gemini-client.js';
import { errorMessage, log } from '../logger.js';

// Flash-Lite tiers dropped rows on dense tables while reporting STOP.
export const PDF_EXTRACT_MODEL = 'gemini-3.8-flash';

const SYSTEM_INSTRUCTION = `<role>You transcribe one table from an aircraft-register PDF into JSON rows.</role>

<instructions>
- Return one object per aircraft row of the table, in document order, across every page.
- Each property is one table column, named by the keys in the schema, in the order the table prints them.
- Copy each cell's text exactly as printed.
- A cell printed on several lines: keep every line, separated by a newline character, in reading order.
- An empty cell is null.
</instructions>

<never>
- Do not translate, correct, abbreviate, expand, or reformat any value.
- Do not infer a value that is not printed in that row's cell.
- Do not move text from one row's cell into another row.
- Do not emit repeated column-header rows, page headers, page footers, page numbers, or disclaimer text as rows or as cell text.
- Do not skip a row because it looks like a duplicate.
</never>

<output>A JSON array of row objects matching the schema.</output>`;

// Per attempt. An aborted request is still billed and retried: keep it far above a dense chunk.
const REQUEST_TIMEOUT_MS = 600_000;

const USER_PART = { text: 'Based on the document above, return every aircraft row of its table.' };
const THINKING_CONFIG = { thinkingLevel: ThinkingLevel.LOW };

const responseSchema = (columns: string[]) => ({
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: Object.fromEntries(columns.map((c) => [c, { type: Type.STRING, nullable: true }])),
    required: columns,
    propertyOrdering: columns,
  },
});

// Keys the cache: every request input but the PDF and columns, which the chunk key carries.
export const PDF_EXTRACT_FINGERPRINT = createHash('sha256')
  .update(
    JSON.stringify([
      PDF_EXTRACT_MODEL,
      SYSTEM_INSTRUCTION,
      USER_PART,
      THINKING_CONFIG,
      responseSchema(['']),
    ])
  )
  .digest('hex');

export interface TableRequestOptions {
  retryOptions?: RetryOptions;
  /** Wait before the request, through `retryOptions.sleep` when given. */
  delayMs?: number;
  /** Tags each retry log. */
  trace?: Record<string, string>;
}

/**
 * @returns the parsed, unvalidated rows Gemini reads from the PDF's table.
 * @throws on a missing key, a failed transport, or a non-STOP, empty, or non-JSON response.
 */
export const requestTableRows = async (
  pdf: Buffer,
  columns: string[],
  { retryOptions, delayMs = 0, trace }: TableRequestOptions = {}
): Promise<unknown> => {
  const ai = new GoogleGenAI({ apiKey: requireEnv('GEMINI_API_KEY') });
  if (delayMs > 0) await (retryOptions?.sleep ?? setTimeout)(delayMs);
  // Transport only: a second answer to the same pages is billed in full and no more trustworthy.
  const response = await retry(
    () =>
      ai.models.generateContent({
        model: PDF_EXTRACT_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'application/pdf', data: pdf.toString('base64') } },
              USER_PART,
            ],
          },
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: responseSchema(columns),
          thinkingConfig: THINKING_CONFIG,
          httpOptions: { timeout: REQUEST_TIMEOUT_MS },
        },
      }),
    {
      onRetry: (attempt, err) =>
        log('warn', 'pdf_extract_retry', { ...trace, attempt, error: errorMessage(err) }),
      ...retryOptions,
      isRetryable: isRetryableGeminiError,
    }
  );
  const finish = response.candidates?.[0]?.finishReason;
  // Any non-STOP finish is an incomplete answer, even when its text parses.
  if (finish !== FinishReason.STOP) {
    const blocked = response.promptFeedback?.blockReason;
    const why =
      finish ??
      (blocked === undefined
        ? `no finish reason (${response.candidates?.length ?? 0} candidates)`
        : `a blocked prompt (${blocked})`);
    throw new Error(`Gemini PDF extraction ended with ${why}, not STOP`);
  }
  const text = response.text;
  if (text === undefined) throw new Error('Gemini PDF extraction returned no text');
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new Error(`Gemini PDF extraction returned invalid JSON (${text.length} chars)`, {
      cause,
    });
  }
};
