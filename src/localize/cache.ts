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

const CurrentTranslationCacheSchema = z
  .object({
    version: z.literal(TRANSLATION_CACHE_VERSION),
    entries: TranslationEntriesSchema,
    // Required, not defaulted. `failures` arrived with version 2 and the version literal already
    // rejects every earlier envelope, so a v2 object without it is malformed rather than old —
    // defaulting would normalize a broken contract instead of letting the reader reject and
    // self-heal it.
    failures: TranslationFailuresSchema,
  })
  .strict();

export type TranslationCache = z.infer<typeof CurrentTranslationCacheSchema>;
export type TranslationEntries = TranslationCache['entries'];
export type TranslationFailures = TranslationCache['failures'];

export const emptyTranslationCache = (): TranslationCache => ({
  version: TRANSLATION_CACHE_VERSION,
  entries: {},
  failures: {},
});

// A recognized-but-obsolete generation (any other numeric `version`) resets to a fresh current
// envelope instead of failing as corruption — the caller bills the whole source once and writes
// the reset cache back, replacing the stale R2 object. `.refine` excludes the current version so
// a malformed current-version envelope still falls through to genuine corruption below, rather
// than being silently reset and losing the distinction the writer's rethrow-on-corruption relies
// on (see writer.ts readTranslationCache).
const ObsoleteTranslationCacheSchema = z
  .looseObject({ version: z.number().int() })
  .refine((v) => v.version !== TRANSLATION_CACHE_VERSION)
  .transform(() => emptyTranslationCache());

export const TranslationCacheSchema: z.ZodType<TranslationCache> = z.union([
  CurrentTranslationCacheSchema,
  ObsoleteTranslationCacheSchema,
]);

export const isExhausted = (failures: TranslationFailures, hash: string): boolean =>
  (failures[hash] ?? 0) >= MAX_TRANSLATION_ATTEMPTS;

export const hashTranslatable = (field: TranslatableField, text: string): string =>
  createHash('sha256').update(`${field}\0${text}`).digest('hex');
