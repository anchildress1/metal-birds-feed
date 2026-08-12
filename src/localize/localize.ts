import type { Aircraft } from '../schema.js';
import type { R2ArtifactWriter } from '../writer.js';
import { readPositiveIntegerEnv, requireEnv } from '../env.js';
import {
  emptyTranslationCache,
  hashTranslatable,
  isExhausted,
  TRANSLATION_CACHE_VERSION,
  type TranslatableField,
  type TranslationCache,
  type TranslationEntries,
  type TranslationFailures,
} from './cache.js';
import { translateBatch, isGeminiAuthError, DEFAULT_REQUESTS_PER_MINUTE } from './gemini-client.js';
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

// Below this share of a chunk's requested items coming back, the response reads as truncated rather
// than as the model rejecting individual strings — so no item is charged an attempt.
const MIN_CHUNK_RETURN_RATIO = 0.5;

// Share of existing cache entries that must still be candidates before pruning is allowed to run.
// Mirrors writer.ts's MIN_RETAIN_RATIO: registries turn over their descriptive text gradually, so
// losing half of it in one refresh is a defect somewhere, not a publication.
const MIN_RETAIN_RATIO = 0.5;

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

// Folds this run's results into the prior cache and drops anything upstream no longer publishes.
//
// A hash that succeeded clears its failure count — counting consecutive failures, not lifetime
// ones, so one bad run never accumulates toward the give-up threshold. A hash that was offered and
// did not come back increments.
//
// Pruning to `live` matters because cardinality is not bounded by a label vocabulary: br-anac's
// cancellation reasons are per-record free text carrying dates and protocol numbers, so entries
// accrue roughly per cancelled aircraft and the whole object is re-uploaded every translating run.
// The cost of over-pruning is re-translation, never wrong data — a truncated upstream would shrink
// `live` and re-bill those entries next run, which is why the record-count and retain-ratio guards
// exist upstream of this.
const buildCache = (
  prior: TranslationCache,
  translated: TranslationEntries,
  attempted: Set<string>,
  live: ReadonlySet<string> | null
): TranslationCache => {
  const failures: TranslationFailures = {};
  for (const [hash, count] of Object.entries(prior.failures))
    if (live === null || live.has(hash)) failures[hash] = count;
  for (const hash of attempted) {
    if (hash in translated) delete failures[hash];
    else failures[hash] = (failures[hash] ?? 0) + 1;
  }

  const entries: TranslationEntries = {};
  if (live === null) Object.assign(entries, prior.entries, translated);
  else
    // Iterating `live` rather than copying the prior cache and filtering: the candidate set is the
    // small side, and the cache is the one that grows per cancelled aircraft.
    for (const hash of live) {
      const text = translated[hash] ?? prior.entries[hash];
      if (text !== undefined) entries[hash] = text;
    }

  return { version: TRANSLATION_CACHE_VERSION, entries, failures };
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
// Degrades to an empty cache and reports whether the read worked. The caller needs the
// distinction: "nothing cached yet" and "could not read" look identical afterwards, but only one
// may be translated against — an empty cache from a failed read would make the delta the whole
// source and bill for it.
const readCache = async (
  writer: R2ArtifactWriter,
  sourceId: string
): Promise<{ cache: TranslationCache; ok: boolean }> => {
  try {
    return { cache: await writer.readTranslationCache(sourceId), ok: true };
  } catch (err) {
    log('warn', 'localize_cache_read_failed', { source: sourceId, msg: errorMessage(err) });
    return { cache: emptyTranslationCache(), ok: false };
  }
};

// Writability is the read gate from the other side, and has to be settled before the spend rather
// than after it. A cache that reads fine but cannot be written keeps nothing a run buys, so the
// identical delta is re-sent and re-billed on every run forever while the job stays green — the
// same shape of indefinitely-repeating cost that makes a rejected GEMINI_API_KEY a hard failure
// rather than a warning. Writing back the object just read costs one PUT and settles it. When the
// read reset an obsolete generation, that PUT is also what makes the reset durable, so a version
// bump cannot re-reset and re-buy the same delta on every subsequent run.
const persistCache = async (
  writer: R2ArtifactWriter,
  sourceId: string,
  cache: TranslationCache
): Promise<boolean> => {
  try {
    await writer.writeTranslationCache(sourceId, cache);
    return true;
  } catch (err) {
    log('warn', 'localize_cache_unwritable', { source: sourceId, msg: errorMessage(err) });
    return false;
  }
};

const resolveTranslations = async (
  candidates: Map<string, Candidate>,
  sourceId: string,
  writer: R2ArtifactWriter,
  dryRun: boolean,
  allowPrune: boolean
): Promise<ResolvedTranslations> => {
  const { cache, ok: cacheReadSucceeded } = await readCache(writer, sourceId);

  // Skip both what is already translated and what has failed enough times to look like a property
  // of the text rather than a bad run — otherwise a string the model reliably mangles is re-sent,
  // and re-billed, on every refresh forever.
  // null disables pruning for this run. Two independent gates, because they fail differently.
  //
  // `allowPrune` is the caller's record-count judgement: localizeRecords runs before writer.write
  // applies the retain-ratio guard, so a truncated upstream would otherwise prune the cache to its
  // short candidate set, fail the artifact write, and leave the next healthy run to re-buy every
  // dropped string — for br-anac, most of what has ever been paid for.
  //
  // The second gate measures the thing actually being destroyed. A record count can be perfectly
  // stable while the candidate set collapses: a mapping typo or an upstream column rename that
  // nulls cancellation_reason on most rows leaves records.size untouched, so the caller says prune
  // and the cache sheds those entries anyway. Reverting the mapping would then re-buy all of them.
  // Comparing survivors against the existing cache catches that, and covers the case where a
  // corrupt _state self-heals to null and the record-count gate has nothing to compare against.
  const candidateHashes = new Set(candidates.keys());
  const priorEntryCount = Object.keys(cache.entries).length;
  const retained = Object.keys(cache.entries).filter((hash) => candidateHashes.has(hash)).length;
  const retainsEnough = priorEntryCount === 0 || retained / priorEntryCount >= MIN_RETAIN_RATIO;
  if (allowPrune && !retainsEnough)
    log('warn', 'localize_prune_withheld', {
      source: sourceId,
      prior_entries: priorEntryCount,
      retained,
    });
  const live = allowPrune && retainsEnough ? candidateHashes : null;
  const delta = [...candidates.entries()].filter(
    ([hash]) => !(hash in cache.entries) && !isExhausted(cache.failures, hash)
  );
  const deltaIds = new Set(delta.map(([id]) => id));

  const translated: TranslationEntries = {};
  // Only ids from chunks that actually came back. A chunk lost to an auth outage or a network blip
  // says nothing about whether its text is translatable, and counting it would retire good strings
  // after three bad days.
  const attempted = new Set<string>();
  let persistFailed = false;
  let failed = 0;

  // A failed cache read leaves an empty cache, which makes the delta the entire source. Translating
  // against it would bill a full-source batch and then discard the result, since the write below is
  // gated on the same read having succeeded — and the next run would repeat it. Degrade to source
  // text for this run instead; the following run reads the real cache and translates only the delta.
  // persistCache applies the same reasoning to the write side — see it for why an unwritable cache
  // must stop the batch instead of degrading into an unbounded re-bill.
  const translating =
    delta.length > 0 &&
    !dryRun &&
    cacheReadSucceeded &&
    (await persistCache(writer, sourceId, cache));
  if (translating) {
    const apiKey = requireEnv('GEMINI_API_KEY'); // outside try/catch: a missing key must throw, not degrade
    // Persist as each chunk lands rather than once at the end: the job has a wall-clock timeout and
    // a cold source can exceed it, which would discard everything already paid for and re-bill the
    // identical delta next run, never converging. Swallowing the write keeps a persistence blip
    // from abandoning translations already bought — they still apply to this run's records.
    const persistChunk = async (
      chunkTranslations: Map<string, string>,
      requested: { id: string }[]
    ): Promise<void> => {
      // A model can self-truncate inside the response schema — well-formed JSON, fewer items — which
      // reaches the per-item drop path rather than the error path. Charging every requested id a
      // failed attempt would retire the chunk's tail after three runs, which is exactly the harm the
      // attempt limit exists to avoid. Below the retention floor, treat it as the chunk failing.
      const returned = requested.filter(({ id }) => chunkTranslations.has(id)).length;
      if (returned >= requested.length * MIN_CHUNK_RETURN_RATIO)
        for (const { id } of requested) attempted.add(id);
      else
        log('warn', 'localize_chunk_shortfall', {
          source: sourceId,
          requested: requested.length,
          returned,
        });
      // filters out any id the model returned that wasn't requested, which would otherwise fail
      // TranslationCacheSchema on the next read and discard the whole cache
      const before = Object.keys(translated).length;
      for (const [id, text] of chunkTranslations) if (deltaIds.has(id)) translated[id] = text;
      // A chunk whose items were all dropped adds nothing, so this PUT would rewrite the cache
      // byte-for-byte; the failure counts it produced are written once at the end instead.
      if (Object.keys(translated).length === before) return;
      try {
        // Successes only. A run killed mid-batch never offered the later chunks, and charging them
        // a failed attempt would retire translatable text after three interrupted runs.
        await writer.writeTranslationCache(
          sourceId,
          buildCache(cache, translated, new Set(Object.keys(translated)), live)
        );
      } catch (err) {
        // Recorded so the end-of-run write still fires. Without it a steady-state run whose last
        // chunk failed to persist would discard translations already billed for, and re-buy them.
        persistFailed = true;
        log('warn', 'localize_cache_write_failed', { source: sourceId, msg: errorMessage(err) });
      }
    };

    const { errors } = await translateBatch(
      delta.map(([id, { field, text }]) => ({ id, field, text })),
      {
        apiKey,
        requestsPerMinute: resolveRequestsPerMinute(sourceId),
        onChunkTranslated: persistChunk,
      }
    );
    failed = delta.length - Object.keys(translated).length;
    // Before the warn: a rejected key recurs identically on every run, so it earns the same hard
    // fail as a missing one rather than a warning nobody reads on a green job. This does not block
    // the feed — deploy-feed runs under `!cancelled()` and reuses a failed source's prior slice.
    const authError = errors.find(isGeminiAuthError);
    if (authError !== undefined)
      throw new Error(`GEMINI_API_KEY rejected by Gemini: ${errorMessage(authError)}`);
    if (errors.length > 0) {
      log('warn', 'localize_translate_failed', {
        source: sourceId,
        failed_chunks: errors.length,
        causes: errors.map(errorMessage),
      });
    }
  }

  const updatedCache = buildCache(cache, translated, attempted, live);

  // persistChunk records successes only, so a run where everything landed has already written this
  // exact object and needs no second PUT. Failures are counted here, once the full delta is known —
  // a hash missing after every chunk is what "did not come back" means — so they still need one.
  const droppedByModel = [...attempted].some((id) => !(id in translated));
  // Pruning alone is a reason to write even when nothing was translated this run — a source whose
  // delta is empty still sheds entries as upstream text turns over. `!dryRun` because a dry run
  // must not mutate R2, and its empty `attempted` set would otherwise make this the only write.
  const pruned =
    live !== null &&
    (Object.keys(cache.entries).some((hash) => !live.has(hash)) ||
      Object.keys(cache.failures).some((hash) => !live.has(hash)));
  if (cacheReadSucceeded && !dryRun && (droppedByModel || pruned || persistFailed)) {
    try {
      await writer.writeTranslationCache(sourceId, updatedCache);
    } catch (err) {
      log('warn', 'localize_cache_write_failed', { source: sourceId, msg: errorMessage(err) });
    }
  }

  // Counted from actual entries, not `candidates - delta`: an exhausted hash leaves the delta while
  // still having no translation, so the subtraction would book it as a hit and drive `failed` to
  // zero — silencing pipeline.ts's localize_partial_failure while the artifact carries source text.
  //
  // Restricted to hashes the delta never offered. One that was offered and dropped is already in
  // `failed`; counting it again because the drop crossed the attempt limit made `failed` exceed
  // `candidates` and the stats stop summing.
  const exhausted = [...candidates.keys()].filter(
    (hash) =>
      !deltaIds.has(hash) && !(hash in updatedCache.entries) && isExhausted(cache.failures, hash)
  ).length;

  return {
    cache: updatedCache,
    stats: {
      cache_hits: [...candidates.keys()].filter((hash) => hash in cache.entries).length,
      translated: Object.keys(translated).length,
      failed: failed + exhausted,
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
  dryRun = false,
  // Pruning is destructive and irreversible for this run's cache; the caller owns the judgement of
  // whether the record set is trustworthy, because only it has the prior count to compare against.
  allowPrune = false
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

  const { cache, stats } = await resolveTranslations(
    candidates,
    sourceId,
    writer,
    dryRun,
    allowPrune
  );

  return {
    records: applyTranslations(records, cache, sourceId),
    stats: { candidates: candidates.size, ...stats },
  };
};
