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
import { translateBatch } from './gemini-client.js';
import { log, errorMessage } from '../logger.js';

// idera_authorised_party and lien_status (for mv-caa specifically) are excluded: both can hold a
// party's NAME, not descriptive text — see mv-caa.yaml/au-casa.yaml's own field comments.
const TRANSLATABLE_FIELDS = [
  'cancellation_reason',
  'airworthiness_class',
] as const satisfies readonly TranslatableField[];

const DEFAULT_REQUESTS_PER_MINUTE = 10;

export interface LocalizationStats {
  candidates: number;
  cache_hits: number;
  translated: number;
  failed: number;
}

type Candidate = { field: TranslatableField; text: string };

const collectCandidates = (records: Map<string, Aircraft>): Map<string, Candidate> => {
  const candidates = new Map<string, Candidate>();
  for (const record of records.values()) {
    for (const field of TRANSLATABLE_FIELDS) {
      const text = record[field];
      if (text !== null) candidates.set(hashTranslatable(field, text), { field, text });
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
  translated: TranslationEntries;
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
    translated,
    stats: {
      cache_hits: candidates.size - delta.length,
      translated: Object.keys(translated).length,
      failed,
    },
  };
};

const applyTranslations = (
  records: Map<string, Aircraft>,
  cache: TranslationCache
): Map<string, Aircraft> => {
  const localized = new Map<string, Aircraft>();
  for (const [id, record] of records) {
    const translatedValue = (field: TranslatableField): string | null => {
      const text = record[field];
      return text === null ? null : (cache.entries[hashTranslatable(field, text)] ?? null);
    };
    const translations_en: Aircraft['translations_en'] = {
      cancellation_reason: translatedValue('cancellation_reason'),
      airworthiness_class: translatedValue('airworthiness_class'),
    };
    localized.set(id, { ...record, translations_en });
  }
  return localized;
};

export const localizeRecords = async (
  records: Map<string, Aircraft>,
  sourceId: string,
  writer: R2ArtifactWriter,
  dryRun = false
): Promise<{ records: Map<string, Aircraft>; stats: LocalizationStats }> => {
  const candidates = collectCandidates(records);
  if (candidates.size === 0) {
    return { records, stats: { candidates: 0, cache_hits: 0, translated: 0, failed: 0 } };
  }

  const { cache, stats } = await resolveTranslations(candidates, sourceId, writer, dryRun);

  return {
    records: applyTranslations(records, cache),
    stats: { candidates: candidates.size, ...stats },
  };
};
