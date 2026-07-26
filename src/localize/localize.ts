import type { Aircraft } from '../schema.js';
import type { R2ArtifactWriter } from '../writer.js';
import { requireEnv } from '../env.js';
import { hashTranslatable, type TranslationCache } from './cache.js';
import { translateBatch } from './gemini-client.js';
import { log, errorMessage } from '../logger.js';

// idera_authorised_party is excluded: it's the authorised party's NAME (a proper noun), not
// descriptive text — see mv-caa.yaml/au-casa.yaml's own field comments.
const TRANSLATABLE_FIELDS = ['cancellation_reason', 'airworthiness_class', 'lien_status'] as const;

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
  const candidates = new Map<string, { field: string; text: string }>();
  for (const record of records.values()) {
    for (const field of TRANSLATABLE_FIELDS) {
      const text = record[field];
      if (text !== null) candidates.set(hashTranslatable(field, text), { field, text });
    }
  }

  if (candidates.size === 0) {
    return { records, stats: { candidates: 0, cache_hits: 0, translated: 0, failed: 0 } };
  }

  let cache: TranslationCache = {};
  try {
    cache = await writer.readTranslationCache(sourceId);
  } catch (err) {
    log('warn', 'localize_cache_read_failed', { source: sourceId, msg: errorMessage(err) });
  }

  const delta = [...candidates.entries()].filter(([hash]) => !(hash in cache));
  const deltaIds = new Set(delta.map(([id]) => id));

  const translated: TranslationCache = {};
  let failed = 0;

  if (delta.length > 0 && !dryRun) {
    const apiKey = requireEnv('GEMINI_API_KEY'); // outside try/catch: a missing key must throw, not degrade
    try {
      const { translated: result, errors } = await translateBatch(
        delta.map(([id, { field, text }]) => ({ id, field, text })),
        { apiKey }
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
    } catch (err) {
      failed = delta.length;
      log('warn', 'localize_translate_failed', { source: sourceId, msg: errorMessage(err) });
    }
  }

  const updatedCache = { ...cache, ...translated };
  // Gated on any success, not `failed === 0` — a partial batch's successes are already id-filtered
  // and confirmed-good, so they shouldn't be re-billed to Gemini next run just because siblings failed.
  if (Object.keys(translated).length > 0) {
    try {
      await writer.writeTranslationCache(sourceId, updatedCache);
    } catch (err) {
      log('warn', 'localize_cache_write_failed', { source: sourceId, msg: errorMessage(err) });
    }
  }

  const localized = new Map<string, Aircraft>();
  for (const [id, record] of records) {
    const en = Object.fromEntries(
      TRANSLATABLE_FIELDS.map((field) => {
        const text = record[field];
        return [
          field,
          text === null ? null : (updatedCache[hashTranslatable(field, text)] ?? null),
        ];
      })
    ) as Aircraft['translations_en'];
    localized.set(id, { ...record, translations_en: en });
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
