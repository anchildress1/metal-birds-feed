import type { Aircraft } from '../schema.js';
import type { R2ArtifactWriter } from '../writer.js';
import { readPositiveIntegerEnv, requireEnv } from '../env.js';
import {
  emptyTranslationCache,
  hashTranslatable,
  TRANSLATION_CACHE_VERSION,
  type TranslatableField,
  type TranslationCache,
  type TranslationEntries,
} from './cache.js';
import { translateBatch, DEFAULT_REQUESTS_PER_MINUTE } from './gemini-client.js';
import { log, errorMessage } from '../logger.js';

// Scalar (single-string) translatable fields. operational_classes is translated too, but as an
// array — handled separately below since each element gets its own cache entry.
//
// idera_authorised_party is excluded for every source: it's always a party's NAME, not descriptive
// text — see sources/mv-caa.yaml's own field comment.
const TRANSLATABLE_SCALAR_FIELDS = [
  'cancellation_reason',
  'airworthiness_class',
  'lien_status',
] as const satisfies readonly TranslatableField[];

// Fields already rendered in English by deterministic source mappings. Guard both collection and
// application: a cache entry written before an exclusion existed must not overwrite the mapping.
const FIELD_EXCLUDED_FOR_SOURCE = new Map<string, ReadonlySet<TranslatableField>>([
  ['cl-dgac', new Set(['operational_classes'])],
  ['es-aesa', new Set(['airworthiness_class'])],
  ['no-caa', new Set(['operational_classes'])],
]);

const isFieldExcluded = (sourceId: string, field: TranslatableField): boolean =>
  FIELD_EXCLUDED_FOR_SOURCE.get(sourceId)?.has(field) ?? false;

export interface LocalizationStats {
  candidates: number;
  cache_hits: number;
  translated: number;
  failed: number;
}

type Candidate = { field: TranslatableField; text: string };

const collectCandidates = (
  records: Map<string, Aircraft>,
  sourceId: string
): Map<string, Candidate> => {
  const candidates = new Map<string, Candidate>();
  for (const record of records.values()) {
    for (const field of TRANSLATABLE_SCALAR_FIELDS) {
      const text = record[field];
      if (text !== null && !isFieldExcluded(sourceId, field))
        candidates.set(hashTranslatable(field, text), { field, text });
    }
    if (!isFieldExcluded(sourceId, 'operational_classes'))
      for (const text of record.operational_classes) {
        candidates.set(hashTranslatable('operational_classes', text), {
          field: 'operational_classes',
          text,
        });
      }
  }
  return candidates;
};

// A malformed (not missing) rate limit must not become a second hard-fail path — only an absent
// GEMINI_API_KEY is allowed to throw. Falls back to the default and logs instead of propagating.
const resolveRequestsPerMinute = (sourceId: string): number => {
  try {
    return readPositiveIntegerEnv('GEMINI_REQUESTS_PER_MINUTE', DEFAULT_REQUESTS_PER_MINUTE);
  } catch (err) {
    log('warn', 'localize_rpm_config_invalid', { source: sourceId, msg: errorMessage(err) });
    return DEFAULT_REQUESTS_PER_MINUTE;
  }
};

interface ResolvedTranslations {
  cache: TranslationCache;
  stats: { cache_hits: number; translated: number; failed: number };
}

// Reads the prior cache, sends only the delta to Gemini, and persists whatever came back —
// gated on any success, not `failed === 0`, since a partial batch's successes are already
// id-filtered and confirmed-good and shouldn't be re-billed to Gemini next run for siblings that
// failed. Never throws except via requireEnv('GEMINI_API_KEY'): a missing key is a setup bug and
// deliberately aborts the run; every other failure here (Gemini or cache, any status) degrades.
const resolveTranslations = async (
  candidates: Map<string, Candidate>,
  sourceId: string,
  writer: R2ArtifactWriter,
  dryRun: boolean
): Promise<ResolvedTranslations> => {
  let cache: TranslationCache = emptyTranslationCache();
  let cacheReadSucceeded = true;
  try {
    cache = await writer.readTranslationCache(sourceId);
  } catch (err) {
    cacheReadSucceeded = false;
    log('warn', 'localize_cache_read_failed', { source: sourceId, msg: errorMessage(err) });
  }

  const delta = [...candidates.entries()].filter(([hash]) => !(hash in cache.entries));
  const deltaIds = new Set(delta.map(([id]) => id));

  const translated: TranslationEntries = {};
  let failed = 0;

  if (delta.length > 0 && !dryRun) {
    const apiKey = requireEnv('GEMINI_API_KEY'); // outside try/catch: a missing key must throw, not degrade
    const { translated: result, errors } = await translateBatch(
      delta.map(([id, { field, text }]) => ({ id, field, text })),
      { apiKey, requestsPerMinute: resolveRequestsPerMinute(sourceId) }
    );
    // filters out any id the model returned that wasn't requested, which would otherwise fail
    // TranslationCacheSchema on the next read and discard the whole cache
    for (const [id, text] of result) if (deltaIds.has(id)) translated[id] = text;
    failed = delta.length - Object.keys(translated).length;
    if (errors.length > 0) {
      log('warn', 'localize_translate_failed', {
        source: sourceId,
        failed_chunks: errors.length,
        causes: errors.map(errorMessage),
      });
    }
  }

  const updatedCache: TranslationCache = {
    version: TRANSLATION_CACHE_VERSION,
    entries: { ...cache.entries, ...translated },
  };
  if (cacheReadSucceeded && Object.keys(translated).length > 0) {
    try {
      await writer.writeTranslationCache(sourceId, updatedCache);
    } catch (err) {
      log('warn', 'localize_cache_write_failed', { source: sourceId, msg: errorMessage(err) });
    }
  }

  return {
    cache: updatedCache,
    stats: {
      cache_hits: candidates.size - delta.length,
      translated: Object.keys(translated).length,
      failed,
    },
  };
};

// English-primary: the canonical field IS the translation, not an additive sibling. A cache miss
// (not yet translated, or Gemini/cache failed) keeps the original text rather than nulling — an
// enrichment step that hasn't run must not empty a populated upstream field.
const applyTranslations = (
  records: Map<string, Aircraft>,
  cache: TranslationCache,
  sourceId: string
): Map<string, Aircraft> => {
  const localized = new Map<string, Aircraft>();
  for (const [id, record] of records) {
    const translateScalar = (field: TranslatableField, text: string | null): string | null => {
      if (text === null || isFieldExcluded(sourceId, field)) return text;
      return cache.entries[hashTranslatable(field, text)] ?? text;
    };
    const translateArray = (values: string[]): string[] =>
      isFieldExcluded(sourceId, 'operational_classes')
        ? values
        : values.map((v) => cache.entries[hashTranslatable('operational_classes', v)] ?? v);

    localized.set(id, {
      ...record,
      cancellation_reason: translateScalar('cancellation_reason', record.cancellation_reason),
      airworthiness_class: translateScalar('airworthiness_class', record.airworthiness_class),
      lien_status: translateScalar('lien_status', record.lien_status),
      operational_classes: translateArray(record.operational_classes),
    });
  }
  return localized;
};

export const localizeRecords = async (
  records: Map<string, Aircraft>,
  sourceId: string,
  language: string,
  writer: R2ArtifactWriter,
  dryRun = false
): Promise<{ records: Map<string, Aircraft>; stats: LocalizationStats }> => {
  // An English register has nothing to translate, and asking for one anyway is actively harmful:
  // the model rewords curated labels (tc-ca's "Certificate of Airworthiness") and invents meaning
  // for bare codes (faa's "1", "4"), overwriting the canonical field in the artifact and the feed.
  if (language === 'en') {
    return { records, stats: { candidates: 0, cache_hits: 0, translated: 0, failed: 0 } };
  }

  const candidates = collectCandidates(records, sourceId);
  if (candidates.size === 0) {
    return { records, stats: { candidates: 0, cache_hits: 0, translated: 0, failed: 0 } };
  }

  const { cache, stats } = await resolveTranslations(candidates, sourceId, writer, dryRun);

  return {
    records: applyTranslations(records, cache, sourceId),
    stats: { candidates: candidates.size, ...stats },
  };
};
