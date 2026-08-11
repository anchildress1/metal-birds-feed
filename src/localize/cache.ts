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

// Bump when the model, prompt, or generation contract changes. A recognized older envelope resets
// to a fresh empty one rather than accumulating unreachable hashes forever — see
// ObsoleteTranslationCacheSchema below for how "recognized older" is distinguished from corruption
// and from a newer envelope this build predates.
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

// Three-way discrimination the writer needs: an unrecognized/malformed body at any version, a
// recognized older generation (reset), or the current envelope — see writer.ts readTranslationCache
// for what each does (rethrow, log-and-reset, or pass through) and why it needs to know which.
export type ParsedTranslationCache =
  { kind: 'current'; cache: TranslationCache } | { kind: 'obsolete'; priorVersion: number };

const CurrentTranslationCacheEnvelopeSchema = CurrentTranslationCacheSchema.transform(
  (cache): ParsedTranslationCache => ({ kind: 'current', cache })
);

// Only a version strictly OLDER than current is a recognized prior generation, and only that
// resets — an object whose internal shape is also malformed still resets, since an old generation
// is discarded unconditionally regardless of its shape, so validating it further would change
// nothing observable. A version NEWER than current must NOT match: it means this build is older
// than the code that wrote the cache (e.g. an ad-hoc rollback, AGENTS.md's supported recovery
// path), and silently resetting it would destroy translations a later release already paid for.
// It falls through to genuine corruption/rethrow instead, which degrades for one run without
// touching the R2 object — the safe default when the shape can't be understood.
const ObsoleteTranslationCacheSchema = z
  .looseObject({ version: z.number().int() })
  .refine((v) => v.version < TRANSLATION_CACHE_VERSION)
  .transform((v): ParsedTranslationCache => ({ kind: 'obsolete', priorVersion: v.version }));

// Genuine corruption (no numeric version at all, a current-version body that fails validation, or
// a version newer than this build knows) matches neither branch and fails the union.
export const ParsedTranslationCacheSchema: z.ZodType<ParsedTranslationCache> = z.union([
  CurrentTranslationCacheEnvelopeSchema,
  ObsoleteTranslationCacheSchema,
]);

// Flattens the discriminated result to a bare cache for callers that don't need to know a reset
// happened (tests, anything reading a cache without the write-back/logging writer.ts does).
export const TranslationCacheSchema: z.ZodType<TranslationCache> =
  ParsedTranslationCacheSchema.transform((r) =>
    r.kind === 'current' ? r.cache : emptyTranslationCache()
  );

export const isExhausted = (failures: TranslationFailures, hash: string): boolean =>
  (failures[hash] ?? 0) >= MAX_TRANSLATION_ATTEMPTS;

export const hashTranslatable = (field: TranslatableField, text: string): string =>
  createHash('sha256').update(`${field}\0${text}`).digest('hex');
