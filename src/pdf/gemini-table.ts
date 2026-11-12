import { createHash } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { FinishReason, GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { requireEnv } from '../env.js';
import { retry, type RetryOptions } from '../retry.js';
import { isRetryableGeminiError } from '../localize/gemini-client.js';
import { errorMessage, log } from '../logger.js';

// Chosen by bake-off against every fixture PDF: both Flash-Lite tiers varied run to run on dense
// tables, and one returned 1 of 137 rows while still reporting STOP.
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

// Changes with the model or the prompt, so a cached extraction from either never outlives them.
export const PDF_EXTRACT_FINGERPRINT = createHash('sha256')
  .update(`${PDF_EXTRACT_MODEL}\n${SYSTEM_INSTRUCTION}`)
  .digest('hex');

const responseSchema = (columns: string[]) => ({
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: Object.fromEntries(columns.map((c) => [c, { type: Type.STRING, nullable: true }])),
    required: columns,
    propertyOrdering: columns,
  },
});

export interface TableRequestOptions {
  retryOptions?: RetryOptions;
  /** Wait before the request, through `retryOptions.sleep` when given. */
  delayMs?: number;
  /** Tags each retry log. */
  trace?: Record<string, string>;
}

/**
 * Asks Gemini for every row of the PDF's table, one object per row keyed by `columns`.
 * @returns the parsed, unvalidated JSON response.
 * @throws when GEMINI_API_KEY is unset, a transport error is not retryable or outlasts the
 *   retries, or the response did not finish with STOP, has no text, or is not JSON.
 */
export const requestTableRows = async (
  pdf: Buffer,
  columns: string[],
  { retryOptions, delayMs = 0, trace = {} }: TableRequestOptions = {}
): Promise<unknown> => {
  const ai = new GoogleGenAI({ apiKey: requireEnv('GEMINI_API_KEY') });
  if (delayMs > 0) await (retryOptions?.sleep ?? setTimeout)(delayMs);
  // Only transport failures retry. A truncated or malformed answer is billed again in full, and a
  // second answer to the same pages is no more trustworthy than the first.
  const response = await retry(
    () =>
      ai.models.generateContent({
        model: PDF_EXTRACT_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'application/pdf', data: pdf.toString('base64') } },
              { text: 'Based on the document above, return every aircraft row of its table.' },
            ],
          },
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: responseSchema(columns),
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
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
  // MAX_TOKENS is truncated JSON that may still parse after a repair: never treat it as complete.
  if (finish !== FinishReason.STOP)
    throw new Error(
      `Gemini PDF extraction ended with ${finish ?? `no finish reason (prompt blocked: ${response.promptFeedback?.blockReason ?? 'unknown'})`}, not STOP`
    );
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
