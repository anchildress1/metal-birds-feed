import { createHash } from 'node:crypto';
import { z } from 'zod';

// Fields eligible for English rendering. An explicit union, not derived from Aircraft: eligibility
// is a translation-pipeline concern, not a schema shape — idera_authorised_party is a string field
// too, and is deliberately never a candidate.
export type TranslatableField =
  'cancellation_reason' | 'airworthiness_class' | 'lien_status' | 'operational_classes';

// Values are non-empty: the primary field falls back with `?? text`, which an empty string passes
// straight through (it is not nullish), blanking a populated upstream value. R2 is the boundary
// where a corrupted or hand-edited object can introduce one, so reject it on read.
const TranslationEntriesSchema = z.record(
  z.string().regex(/^[0-9a-f]{64}$/),
  z.string().trim().min(1)
);

// Consecutive failed attempts per hash. Without this, an item the model reliably mangles misses the
// cache on every run and is re-billed forever. Counted rather than a boolean so a transient blip
// doesn't blacklist a translatable string.
const TranslationFailuresSchema = z.record(
  z.string().regex(/^[0-9a-f]{64}$/),
  z.number().int().positive()
);

// Attempts before a hash stops being offered to Gemini. Three consecutive whole-run failures is a
// property of the text, not a bad day.
export const MAX_TRANSLATION_ATTEMPTS = 3;

// Bump when the model, prompt, or generation contract changes. The envelope makes obsolete entries
// fail validation as one generation instead of accumulating unreachable hashes forever.
export const TRANSLATION_CACHE_VERSION = 2;

export const TranslationCacheSchema = z
  .object({
    version: z.literal(TRANSLATION_CACHE_VERSION),
    entries: TranslationEntriesSchema,
    // Absent on a cache written before failures were tracked; an empty map is the honest reading,
    // since nothing had been recorded as failing.
    failures: TranslationFailuresSchema.default({}),
  })
  .strict();

export type TranslationCache = z.infer<typeof TranslationCacheSchema>;
export type TranslationEntries = TranslationCache['entries'];
export type TranslationFailures = TranslationCache['failures'];

export const emptyTranslationCache = (): TranslationCache => ({
  version: TRANSLATION_CACHE_VERSION,
  entries: {},
  failures: {},
});

export const isExhausted = (failures: TranslationFailures, hash: string): boolean =>
  (failures[hash] ?? 0) >= MAX_TRANSLATION_ATTEMPTS;

export const hashTranslatable = (field: TranslatableField, text: string): string =>
  createHash('sha256').update(`${field}\0${text}`).digest('hex');
