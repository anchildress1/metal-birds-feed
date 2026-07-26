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

// idera_authorised_party is excluded: it's the authorised party's NAME (a proper noun), not
// descriptive text — see mv-caa.yaml/au-casa.yaml's own field comments.
const TRANSLATABLE_FIELDS = [
  'cancellation_reason',
  'airworthiness_class',
  'lien_status',
] as const satisfies readonly TranslatableField[];

export interface LocalizationStats {
  candidates: number;
  cache_hits: number;
  translated: number;
  failed: number;
}

export const localizeRecords = async (
  records: Map<string, Aircraft>,
  sourceId: string,
  writer: R2ArtifactWriter,
  dryRun = false
): Promise<{ records: Map<string, Aircraft>; stats: LocalizationStats }> => {
  const candidates = new Map<string, { field: TranslatableField; text: string }>();
  for (const record of records.values()) {
    for (const field of TRANSLATABLE_FIELDS) {
      const text = record[field];
      if (text !== null) candidates.set(hashTranslatable(field, text), { field, text });
    }
  }

  if (candidates.size === 0) {
    return { records, stats: { candidates: 0, cache_hits: 0, translated: 0, failed: 0 } };
  }

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
      {
        apiKey,
        requestsPerMinute: readPositiveIntegerEnv('GEMINI_REQUESTS_PER_MINUTE', 10),
      }
    );
    // filters out any id the model returned that wasn't requested, which would otherwise fail
    // TranslationCacheSchema on the next read and discard the whole cache
    for (const [id, text] of result) if (deltaIds.has(id)) translated[id] = text;
    failed = delta.length - Object.keys(translated).length;
    if (errors.length > 0) {
      log('warn', 'localize_translate_failed', {
        source: sourceId,
        failed_chunks: errors.length,
      });
    }
  }

  const updatedCache: TranslationCache = {
    version: TRANSLATION_CACHE_VERSION,
    entries: { ...cache.entries, ...translated },
  };
  // Gated on any success, not `failed === 0` — a partial batch's successes are already id-filtered
  // and confirmed-good, so they shouldn't be re-billed to Gemini next run just because siblings failed.
  if (cacheReadSucceeded && Object.keys(translated).length > 0) {
    try {
      await writer.writeTranslationCache(sourceId, updatedCache);
    } catch (err) {
      log('warn', 'localize_cache_write_failed', { source: sourceId, msg: errorMessage(err) });
    }
  }

  const localized = new Map<string, Aircraft>();
  for (const [id, record] of records) {
    const translatedValue = (field: TranslatableField): string | null => {
      const text = record[field];
      return text === null ? null : (updatedCache.entries[hashTranslatable(field, text)] ?? null);
    };
    const translations_en: Aircraft['translations_en'] = {
      cancellation_reason: translatedValue('cancellation_reason'),
      airworthiness_class: translatedValue('airworthiness_class'),
      lien_status: translatedValue('lien_status'),
    };
    localized.set(id, { ...record, translations_en });
  }

  return {
    records: localized,
    stats: {
      candidates: candidates.size,
      cache_hits: candidates.size - delta.length,
      translated: Object.keys(translated).length, // counted directly so a dry-run skip reports 0, not a subtraction artifact
      failed,
    },
  };
};
