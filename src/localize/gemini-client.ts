import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { z } from 'zod';
import { retry, type RetryOptions } from '../retry.js';

export interface TranslationItem {
  id: string;
  field: string;
  text: string;
}

export interface GeminiClientConfig {
  apiKey: string;
  model?: string;
  retryOptions?: RetryOptions;
}

const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

const MAX_BATCH_ITEMS = 200; // safety cap, not a real limit at today's volumes

const SYSTEM_INSTRUCTION = `<role>You translate short aircraft-registry administrative text into English.</role>

<instructions>
- Each item carries a "field" naming the registry field the text came from (cancellation_reason,
  lien_status, or airworthiness_class) — use it as context, do not include it in the output.
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

const TranslationResultSchema = z.array(z.object({ id: z.string(), text: z.string() }));

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

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

const CONCURRENT_CHUNK_LIMIT = 5; // caps in-flight requests so a large backlog can't 429-storm the API

const settleInBatches = async <T>(
  factories: (() => Promise<T>)[],
  limit: number
): Promise<PromiseSettledResult<T>[]> => {
  const results: PromiseSettledResult<T>[] = [];
  for (let i = 0; i < factories.length; i += limit) {
    results.push(...(await Promise.allSettled(factories.slice(i, i + limit).map((f) => f()))));
  }
  return results;
};

const translateChunk = async (
  items: TranslationItem[],
  ai: GoogleGenAI,
  model: string,
  retryOptions: RetryOptions | undefined
): Promise<Map<string, string>> => {
  const response = await retry(
    () =>
      ai.models.generateContent({
        model,
        contents: JSON.stringify(items),
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          // no temperature: deprecated and silently ignored on this model generation
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      }),
    { ...retryOptions, isRetryable: isRetryableGeminiError }
  );

  const text = response.text;
  if (text === undefined) throw new Error('Gemini response contained no text');

  // re-validate: an LLM tool call is untrusted input even with responseSchema
  const parsed = TranslationResultSchema.parse(JSON.parse(text));
  return new Map(parsed.map((p) => [p.id, p.text]));
};

export interface TranslateBatchResult {
  translated: Map<string, string>;
  errors: unknown[];
}

// Never throws — a failing chunk lands in `errors` instead of discarding other chunks' results.
export const translateBatch = async (
  items: TranslationItem[],
  config: GeminiClientConfig
): Promise<TranslateBatchResult> => {
  if (items.length === 0) return { translated: new Map(), errors: [] };

  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  const model = config.model ?? DEFAULT_MODEL;
  const chunks = chunk(items, MAX_BATCH_ITEMS);
  const settled = await settleInBatches(
    chunks.map((c) => () => translateChunk(c, ai, model, config.retryOptions)),
    CONCURRENT_CHUNK_LIMIT
  );

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
