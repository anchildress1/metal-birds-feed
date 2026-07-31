import { createHash } from 'node:crypto';
import { z } from 'zod';

// Fields eligible for English rendering. An explicit union, not derived from Aircraft: eligibility
// is a translation-pipeline concern, not a schema shape — idera_authorised_party is a string field
// too, and is deliberately never a candidate.
export type TranslatableField =
  | 'cancellation_reason'
  | 'airworthiness_class'
  | 'lien_status'
  | 'operational_classes';

// Values are non-empty: the primary field falls back with `?? text`, which an empty string passes
// straight through (it is not nullish), blanking a populated upstream value. R2 is the boundary
// where a corrupted or hand-edited object can introduce one, so reject it on read.
const TranslationEntriesSchema = z.record(
  z.string().regex(/^[0-9a-f]{64}$/),
  z.string().trim().min(1)
);

// Bump when the model, prompt, or generation contract changes. The envelope makes obsolete entries
// fail validation as one generation instead of accumulating unreachable hashes forever.
export const TRANSLATION_CACHE_VERSION = 1;

export const TranslationCacheSchema = z
  .object({
    version: z.literal(TRANSLATION_CACHE_VERSION),
    entries: TranslationEntriesSchema,
  })
  .strict();

export type TranslationCache = z.infer<typeof TranslationCacheSchema>;
export type TranslationEntries = TranslationCache['entries'];

export const emptyTranslationCache = (): TranslationCache => ({
  version: TRANSLATION_CACHE_VERSION,
  entries: {},
});

export const hashTranslatable = (field: TranslatableField, text: string): string =>
  createHash('sha256').update(`${field}\0${text}`).digest('hex');
