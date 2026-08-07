import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { z } from 'zod';
import { retry, type RetryOptions } from '../retry.js';
import { log } from '../logger.js';
import type { TranslatableField } from './cache.js';

export interface TranslationItem {
  id: string;
  field: TranslatableField;
  text: string;
}

export interface GeminiClientConfig {
  apiKey: string;
  model?: string;
  retryOptions?: RetryOptions;
  requestsPerMinute?: number;
  rateLimitSleep?: (ms: number) => Promise<void>;
}

const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

const MAX_BATCH_ITEMS = 200; // safety cap, not a real limit at today's volumes

const SYSTEM_INSTRUCTION = `<role>You translate short aircraft-registry administrative text into English.</role>

<instructions>
- Each item carries a "field" naming the registry field the text came from (cancellation_reason,
  airworthiness_class, lien_status, or operational_classes) — use it as context, do not include it
  in the output.
- Translate each item's text to English.
- Preserve technical and legal terminology; do not paraphrase or summarize.
- Return every item, in any order, each carrying its original id unchanged.
</instructions>

<never>
- Do not translate registration numbers, ICAO codes, or proper nouns embedded in the text.
- Do not add commentary, explanation, or text beyond the translation itself.
</never>

<output>A JSON array of {id, text} objects, one per input item.</output>`;

const RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      text: { type: Type.STRING },
    },
    required: ['id', 'text'],
    propertyOrdering: ['id', 'text'],
  },
};

const TranslationItemSchema = z.object({ id: z.string(), text: z.string().trim().min(1) });

// Per item, not per array. An all-or-nothing parse lets one blank or duplicated item discard up to
// MAX_BATCH_ITEMS good translations, which are then re-billed on every subsequent run — potentially
// forever, if the model reliably returns the same bad item. A wrong-shaped response as a whole is
// still an error, so it keeps the retry path.
const parseTranslations = (raw: unknown): Map<string, string> => {
  if (!Array.isArray(raw)) throw new Error('Gemini response was not a JSON array');
  const translated = new Map<string, string>();
  let rejected = 0;
  for (const item of raw) {
    const parsed = TranslationItemSchema.safeParse(item);
    // First value wins; a repeated id is the model contradicting itself, not new information.
    if (!parsed.success || translated.has(parsed.data.id)) rejected += 1;
    else translated.set(parsed.data.id, parsed.data.text);
  }
  // Count only: the ids are content hashes, so naming them identifies nothing to a reader.
  if (rejected > 0) log('warn', 'localize_items_rejected', { count: rejected });
  return translated;
};

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
export const DEFAULT_REQUESTS_PER_MINUTE = 10;
const MINUTE_MS = 60_000;
const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ApiError carries an HTTP-shaped `status`. A network-level failure (DNS, reset, timeout) has no
// status at all — mirrors isTransientS3Error's "status === undefined is transient" convention.
export const isRetryableGeminiError = (error: unknown): boolean => {
  const status = (error as { status?: unknown } | null)?.status;
  return status === undefined || (typeof status === 'number' && RETRYABLE_STATUS.has(status));
};

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

const translateChunk = async (
  items: TranslationItem[],
  ai: GoogleGenAI,
  model: string,
  retryOptions: RetryOptions | undefined,
  beforeRequest: () => Promise<void>
): Promise<Map<string, string>> => {
  return retry(
    async () => {
      await beforeRequest();
      const response = await ai.models.generateContent({
        model,
        contents: JSON.stringify(items),
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          // no temperature: deprecated and silently ignored on this model generation
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      const text = response.text;
      if (text === undefined) throw new Error('Gemini response contained no text');

      // Re-validate inside retry: an LLM response is untrusted even with responseSchema, and a
      // transient malformed response should receive the same bounded recovery as transport errors.
      return parseTranslations(JSON.parse(text));
    },
    { ...retryOptions, isRetryable: isRetryableGeminiError }
  );
};

export interface TranslateBatchResult {
  translated: Map<string, string>;
  errors: unknown[];
}

const translateAtRate = async (
  chunks: TranslationItem[][],
  ai: GoogleGenAI,
  config: GeminiClientConfig
): Promise<PromiseSettledResult<Map<string, string>>[]> => {
  const requestsPerMinute = config.requestsPerMinute ?? DEFAULT_REQUESTS_PER_MINUTE;
  if (!Number.isSafeInteger(requestsPerMinute) || requestsPerMinute <= 0) {
    throw new Error('requestsPerMinute must be a positive integer');
  }
  const intervalMs = Math.ceil(MINUTE_MS / requestsPerMinute);
  const results: PromiseSettledResult<Map<string, string>>[] = [];
  let requestStarted = false;
  const beforeRequest = async (): Promise<void> => {
    if (requestStarted) await (config.rateLimitSleep ?? defaultSleep)(intervalMs);
    requestStarted = true;
  };

  // Gemini quotas are project-wide RPM. refresh.yml serializes workflows and source jobs; this
  // intentionally sequential loop plus shared request gate spaces every API attempt, including
  // retries, so one cold source cannot burst the quota.
  for (const items of chunks) {
    try {
      results.push({
        status: 'fulfilled',
        value: await translateChunk(
          items,
          ai,
          config.model ?? DEFAULT_MODEL,
          config.retryOptions,
          beforeRequest
        ),
      });
    } catch (reason) {
      results.push({ status: 'rejected', reason });
    }
  }
  return results;
};

// A chunk failure lands in `errors` instead of discarding other chunks' results.
export const translateBatch = async (
  items: TranslationItem[],
  config: GeminiClientConfig
): Promise<TranslateBatchResult> => {
  if (items.length === 0) return { translated: new Map(), errors: [] };

  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  const chunks = chunk(items, MAX_BATCH_ITEMS);
  const settled = await translateAtRate(chunks, ai, config);

  const translated = new Map<string, string>();
  const errors: unknown[] = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      for (const [id, text] of result.value) translated.set(id, text);
    } else {
      errors.push(result.reason);
    }
  }
  return { translated, errors };
};
