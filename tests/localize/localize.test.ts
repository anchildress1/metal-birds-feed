import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { Aircraft } from '../../src/schema.js';
import {
  hashTranslatable,
  MAX_TRANSLATION_ATTEMPTS,
  TRANSLATION_CACHE_VERSION,
  type TranslationEntries,
} from '../../src/localize/cache.js';

const translateBatch = mock();
const requireEnv = mock(() => 'test-key');
const readPositiveIntegerEnv = mock(() => 10);

void mock.module('../../src/localize/gemini-client.js', () => ({
  translateBatch,
  DEFAULT_REQUESTS_PER_MINUTE: 10,
  // Real behaviour, not a stub: the auth hard-fail is the thing under test, so a mock that always
  // said false would let the regression through.
  isGeminiAuthError: (error: unknown) => {
    const status = (error as { status?: unknown } | null)?.status;
    return status === 401 || status === 403;
  },
}));
void mock.module('../../src/env.js', () => ({ readPositiveIntegerEnv, requireEnv }));

const { localizeRecords } = await import('../../src/localize/localize.js');
type GeminiClientConfig = {
  onChunkTranslated?: (m: Map<string, string>, requested: { id: string }[]) => Promise<void>;
};

// Mirrors the real client: translations reach the caller through onChunkTranslated as each chunk
// lands, not only via the return value. A mock that skipped the callback would let an incremental
// persistence regression pass.
const ok =
  (entries: [string, string][]) => async (items: { id: string }[], config: GeminiClientConfig) => {
    const translated = new Map(entries);
    await config.onChunkTranslated?.(translated, items);
    return { translated, errors: [] };
  };

const make = (id: string, overrides: Partial<Aircraft> = {}): Aircraft => ({
  source: 'br-anac',
  source_id: id,
  registration: `PP-${id}`,
  icao_hex: null,
  icao_type_code: null,
  status: 'valid',
  country: 'BR',
  manufacturer: null,
  model: null,
  serial_number: null,
  year_manufactured: null,
  airframe_type: null,
  category: null,
  build_certification: null,
  airworthiness_class: null,
  airworthiness_class_source_text: null,
  operating_environment: null,
  operational_classes: [],
  operational_classes_source_text: [],
  engine: {
    manufacturer: null,
    model: null,
    type: null,
    count: null,
    horsepower: null,
    thrust_lbs: null,
  },
  owner: { name: null, kind: null, state: null, country: null },
  operator: { name: null, kind: null, state: null, country: null },
  legal_owner: { name: null, kind: null, state: null, country: null },
  idera_authorised_party: null,
  certification_date: null,
  airworthiness_date: null,
  expiration_date: null,
  last_action_date: null,
  cruise_speed_ktas: null,
  max_takeoff_weight_kg: null,
  seats: null,
  max_passengers: null,
  min_crew: null,
  airworthiness_review_date: null,
  cancellation_reason: null,
  cancellation_reason_source_text: null,
  lien_status: null,
  lien_status_source_text: null,
  interdiction_code: null,
  ...overrides,
});

type FakeWriter = import('../../src/writer.js').R2ArtifactWriter;

// Only the two methods localizeRecords actually calls are exercised; the rest of
// R2ArtifactWriter's surface is irrelevant here. Mocks are returned alongside the writer (rather
// than read back off it) so assertions don't trip @typescript-eslint/unbound-method.
const cacheEnvelope = (
  entries: TranslationEntries = {},
  failures: Record<string, number> = {}
) => ({
  version: TRANSLATION_CACHE_VERSION,
  entries,
  failures,
});

const fakeWriter = (
  entries: TranslationEntries = {},
  failures: Record<string, number> = {}
): {
  writer: FakeWriter;
  readTranslationCache: ReturnType<typeof mock>;
  writeTranslationCache: ReturnType<typeof mock>;
} => {
  const readTranslationCache = mock(() => Promise.resolve(cacheEnvelope(entries, failures)));
  const writeTranslationCache = mock(() => Promise.resolve());
  return {
    writer: { readTranslationCache, writeTranslationCache } as unknown as FakeWriter,
    readTranslationCache,
    writeTranslationCache,
  };
};

describe('localizeRecords', () => {
  beforeEach(() => {
    translateBatch.mockReset();
    requireEnv.mockReset();
    requireEnv.mockReturnValue('test-key');
    readPositiveIntegerEnv.mockReset();
    readPositiveIntegerEnv.mockReturnValue(10);
  });

  it('short-circuits without touching the writer or Gemini when no field is populated', async () => {
    const records = new Map([['1', make('1')]]);
    const { writer, readTranslationCache } = fakeWriter();

    const { records: result, stats } = await localizeRecords(records, 'br-anac', 'pt', writer);

    expect(stats).toEqual({ candidates: 0, cache_hits: 0, translated: 0, failed: 0 });
    expect(readTranslationCache).not.toHaveBeenCalled();
    expect(translateBatch).not.toHaveBeenCalled();
    expect(result.get('1')!.cancellation_reason).toBeNull();
  });

  it('translates a cache miss into the primary field and persists the updated cache', async () => {
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    translateBatch.mockImplementation(ok([[hash, 'Aircraft exported']]));
    const { writer, writeTranslationCache } = fakeWriter();

    const { records: result, stats } = await localizeRecords(records, 'br-anac', 'pt', writer);

    expect(stats).toEqual({ candidates: 1, cache_hits: 0, translated: 1, failed: 0 });
    expect(result.get('1')!.cancellation_reason).toBe('Aircraft exported');
    expect(writeTranslationCache).toHaveBeenCalledWith(
      'br-anac',
      cacheEnvelope({ [hash]: 'Aircraft exported' })
    );
  });

  it('never touches source_text, and falls back the primary field to it on failure', async () => {
    const records = new Map([
      [
        '1',
        make('1', {
          cancellation_reason: 'AERONAVE EXPORTADA',
          cancellation_reason_source_text: 'AERONAVE EXPORTADA',
        }),
      ],
    ]);
    const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    translateBatch.mockImplementation(ok([[hash, 'Aircraft exported']]));
    const { writer } = fakeWriter();

    const { records: success } = await localizeRecords(records, 'br-anac', 'pt', writer);
    expect(success.get('1')!.cancellation_reason).toBe('Aircraft exported');
    expect(success.get('1')!.cancellation_reason_source_text).toBe('AERONAVE EXPORTADA');

    translateBatch.mockReturnValue(
      Promise.resolve({ translated: new Map(), errors: [new Error('x')] })
    );
    const { writer: writer2 } = fakeWriter();
    const { records: failure } = await localizeRecords(records, 'br-anac', 'pt', writer2);
    expect(failure.get('1')!.cancellation_reason).toBe('AERONAVE EXPORTADA');
    expect(failure.get('1')!.cancellation_reason_source_text).toBe('AERONAVE EXPORTADA');
  });

  it('persists each chunk as it lands, so a later chunk failing keeps the earlier one', async () => {
    const hashA = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    const records = new Map([
      ['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })],
      ['2', make('2', { airworthiness_class: 'CA PADRAO' })],
    ]);
    // Two chunks: the first lands and is persisted, the second throws. Without per-chunk
    // persistence the first chunk's paid-for translation would be discarded with the batch.
    translateBatch.mockImplementation(
      async (items: { id: string }[], config: GeminiClientConfig) => {
        // Only the first chunk reports back; the second errored, so its items are never attempted.
        await config.onChunkTranslated?.(new Map([[hashA, 'Aircraft exported']]), [items[0]]);
        return {
          translated: new Map([[hashA, 'Aircraft exported']]),
          errors: [new Error('chunk 2')],
        };
      }
    );
    const { writer, writeTranslationCache } = fakeWriter();

    const { records: result, stats } = await localizeRecords(records, 'br-anac', 'pt', writer);

    expect(writeTranslationCache).toHaveBeenCalledTimes(1);
    expect(writeTranslationCache).toHaveBeenCalledWith(
      'br-anac',
      cacheEnvelope({ [hashA]: 'Aircraft exported' })
    );
    expect(result.get('1')!.cancellation_reason).toBe('Aircraft exported');
    // The unfinished half degrades to source text rather than blocking the finished half.
    expect(result.get('2')!.airworthiness_class).toBe('CA PADRAO');
    expect(stats.failed).toBe(1);
  });

  it('does not re-upload an identical cache after the last chunk already persisted it', async () => {
    const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    translateBatch.mockImplementation(ok([[hash, 'Aircraft exported']]));
    const { writer, writeTranslationCache } = fakeWriter();

    await localizeRecords(records, 'br-anac', 'pt', writer);

    expect(writeTranslationCache).toHaveBeenCalledTimes(1);
  });

  it('records a failed attempt so a repeatedly-mangled string stops being re-billed', async () => {
    const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    // Offered, nothing came back — the per-item drop path, not a chunk error.
    translateBatch.mockImplementation(ok([]));
    const { writer, writeTranslationCache } = fakeWriter();

    await localizeRecords(records, 'br-anac', 'pt', writer);

    expect(writeTranslationCache).toHaveBeenCalledWith('br-anac', cacheEnvelope({}, { [hash]: 1 }));
  });

  it('stops offering a hash once it has failed the attempt limit', async () => {
    const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    const { writer } = fakeWriter({}, { [hash]: MAX_TRANSLATION_ATTEMPTS });

    const { records: result, stats } = await localizeRecords(records, 'br-anac', 'pt', writer);

    expect(translateBatch).not.toHaveBeenCalled();
    expect(stats.translated).toBe(0);
    expect(result.get('1')!.cancellation_reason).toBe('AERONAVE EXPORTADA');
  });

  it('clears the failure count when a previously-failing hash succeeds', async () => {
    const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    translateBatch.mockImplementation(ok([[hash, 'Aircraft exported']]));
    // Below the limit, so still offered — counting consecutive failures, not lifetime ones.
    const { writer, writeTranslationCache } = fakeWriter(
      {},
      { [hash]: MAX_TRANSLATION_ATTEMPTS - 1 }
    );

    await localizeRecords(records, 'br-anac', 'pt', writer);

    expect(writeTranslationCache).toHaveBeenLastCalledWith(
      'br-anac',
      cacheEnvelope({ [hash]: 'Aircraft exported' }, {})
    );
  });

  it('resolves from cache without calling Gemini', async () => {
    const hash = hashTranslatable('airworthiness_class', 'CA PADRAO');
    const records = new Map([['1', make('1', { airworthiness_class: 'CA PADRAO' })]]);
    const { writer } = fakeWriter({ [hash]: 'Standard (cached)' });

    const { records: result, stats } = await localizeRecords(records, 'br-anac', 'pt', writer);

    expect(stats).toEqual({ candidates: 1, cache_hits: 1, translated: 0, failed: 0 });
    expect(result.get('1')!.airworthiness_class).toBe('Standard (cached)');
    expect(translateBatch).not.toHaveBeenCalled();
  });

  it('dedupes identical (field, text) pairs across records into one Gemini item', async () => {
    const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    const records = new Map([
      ['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })],
      ['2', make('2', { cancellation_reason: 'AERONAVE EXPORTADA' })],
    ]);
    translateBatch.mockImplementation(ok([[hash, 'Aircraft exported']]));
    const { writer } = fakeWriter();

    const { records: result, stats } = await localizeRecords(records, 'br-anac', 'pt', writer);

    expect(stats.candidates).toBe(1);
    expect(translateBatch).toHaveBeenCalledTimes(1);
    expect(translateBatch.mock.calls[0][0]).toEqual([
      { id: hash, field: 'cancellation_reason', text: 'AERONAVE EXPORTADA' },
    ]);
    expect(result.get('1')!.cancellation_reason).toBe('Aircraft exported');
    expect(result.get('2')!.cancellation_reason).toBe('Aircraft exported');
  });

  it('falls back to the original text and skips the cache write when every chunk errors', async () => {
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    translateBatch.mockReturnValue(
      Promise.resolve({ translated: new Map(), errors: [new Error('quota exceeded')] })
    );
    const { writer, writeTranslationCache } = fakeWriter();

    const { records: result, stats } = await localizeRecords(records, 'br-anac', 'pt', writer);

    expect(stats).toEqual({ candidates: 1, cache_hits: 0, translated: 0, failed: 1 });
    expect(result.get('1')!.cancellation_reason).toBe('AERONAVE EXPORTADA');
    expect(writeTranslationCache).not.toHaveBeenCalled();
  });

  it('falls back to the original text on a non-auth Gemini error, without throwing', async () => {
    // A bad request or malformed response degrades like a transient failure — the run still ships,
    // just untranslated. Only an absent key throws.
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    const error = Object.assign(new Error('bad request'), { status: 400 });
    translateBatch.mockReturnValue(Promise.resolve({ translated: new Map(), errors: [error] }));
    const { writer, writeTranslationCache } = fakeWriter();

    const { records: result, stats } = await localizeRecords(records, 'br-anac', 'pt', writer);

    expect(stats.failed).toBe(1);
    expect(result.get('1')!.cancellation_reason).toBe('AERONAVE EXPORTADA');
    expect(writeTranslationCache).not.toHaveBeenCalled();
  });

  it('counts a partial response accurately and still caches the entries that came back', async () => {
    const hashA = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    const hashB = hashTranslatable('airworthiness_class', 'CA PADRAO');
    const records = new Map([
      [
        '1',
        make('1', { cancellation_reason: 'AERONAVE EXPORTADA', airworthiness_class: 'CA PADRAO' }),
      ],
    ]);
    // Only hashA comes back — hashB silently missing from a well-formed-but-partial response.
    translateBatch.mockImplementation(ok([[hashA, 'Aircraft exported']]));
    const { writer, writeTranslationCache } = fakeWriter();

    const { records: result, stats } = await localizeRecords(records, 'br-anac', 'pt', writer);

    expect(stats).toEqual({ candidates: 2, cache_hits: 0, translated: 1, failed: 1 });
    expect(result.get('1')!.cancellation_reason).toBe('Aircraft exported');
    expect(result.get('1')!.airworthiness_class).toBe('CA PADRAO');
    const cache = writeTranslationCache.mock.calls[0][1] as ReturnType<typeof cacheEnvelope>;
    expect(cache).toEqual(cacheEnvelope({ [hashA]: 'Aircraft exported' }));
    expect(cache.entries[hashB]).toBeUndefined();
  });

  it('discards an id in the response that was never requested', async () => {
    const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    translateBatch.mockImplementation(
      ok([
        [hash, 'Aircraft exported'],
        ['unrequested-id', 'junk'],
      ])
    );
    const { writer, writeTranslationCache } = fakeWriter();

    await localizeRecords(records, 'br-anac', 'pt', writer);

    expect(writeTranslationCache).toHaveBeenCalledWith(
      'br-anac',
      cacheEnvelope({ [hash]: 'Aircraft exported' })
    );
  });

  // An unreadable cache makes the delta the whole source. Translating it would bill a full batch
  // and then discard the result, because the write is gated on the same read having succeeded.
  it('skips translation when the cache read fails, rather than re-billing the whole source', async () => {
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    translateBatch.mockImplementation(ok([[hash, 'Aircraft exported']]));
    const { writer, writeTranslationCache } = fakeWriter();
    (writer.readTranslationCache as ReturnType<typeof mock>).mockRejectedValue(
      new Error('R2 down')
    );

    const { records: result, stats } = await localizeRecords(records, 'br-anac', 'pt', writer);

    expect(translateBatch).not.toHaveBeenCalled();
    expect(writeTranslationCache).not.toHaveBeenCalled();
    expect(stats.failed).toBe(0);
    expect(stats.translated).toBe(0);
    // Degrades to the untranslated original, never null.
    expect(result.get('1')!.cancellation_reason).toBe('AERONAVE EXPORTADA');
  });

  it('degrades on an access-denied cache read the same as a transient one', async () => {
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    const error = Object.assign(new Error('AccessDenied'), {
      $metadata: { httpStatusCode: 403 },
    });
    translateBatch.mockImplementation(ok([[hash, 'Aircraft exported']]));
    const { writer } = fakeWriter();
    (writer.readTranslationCache as ReturnType<typeof mock>).mockRejectedValue(error);

    const { records: result } = await localizeRecords(records, 'br-anac', 'pt', writer);

    expect(translateBatch).not.toHaveBeenCalled();
    expect(result.get('1')!.cancellation_reason).toBe('AERONAVE EXPORTADA');
  });

  it('still returns the in-memory translation when the cache write fails, without throwing', async () => {
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    translateBatch.mockImplementation(ok([[hash, 'Aircraft exported']]));
    const { writer } = fakeWriter();
    (writer.writeTranslationCache as ReturnType<typeof mock>).mockRejectedValue(
      new Error('R2 down')
    );

    const { records: result } = await localizeRecords(records, 'br-anac', 'pt', writer);

    expect(result.get('1')!.cancellation_reason).toBe('Aircraft exported');
  });

  it('degrades on an access-denied cache write the same as a transient one', async () => {
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    translateBatch.mockImplementation(ok([[hash, 'Aircraft exported']]));
    const error = Object.assign(new Error('AccessDenied'), {
      $metadata: { httpStatusCode: 403 },
    });
    const { writer } = fakeWriter();
    (writer.writeTranslationCache as ReturnType<typeof mock>).mockRejectedValue(error);

    const { records: result } = await localizeRecords(records, 'br-anac', 'pt', writer);

    expect(result.get('1')!.cancellation_reason).toBe('Aircraft exported');
  });

  it('falls back to the default RPM and still translates when GEMINI_REQUESTS_PER_MINUTE is malformed', async () => {
    readPositiveIntegerEnv.mockImplementation(() => {
      throw new Error('GEMINI_REQUESTS_PER_MINUTE must be a positive integer');
    });
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    translateBatch.mockImplementation(ok([[hash, 'Aircraft exported']]));
    const { writer } = fakeWriter();

    const { records: result } = await localizeRecords(records, 'br-anac', 'pt', writer);

    expect(result.get('1')!.cancellation_reason).toBe('Aircraft exported');
    expect(translateBatch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ requestsPerMinute: 10 })
    );
  });

  it('throws on a missing GEMINI_API_KEY rather than degrading silently', async () => {
    requireEnv.mockImplementation(() => {
      throw new Error('Missing required environment variable: GEMINI_API_KEY');
    });
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    const { writer } = fakeWriter();

    await expect(localizeRecords(records, 'br-anac', 'pt', writer)).rejects.toThrow(
      'Missing required environment variable: GEMINI_API_KEY'
    );
    expect(translateBatch).not.toHaveBeenCalled();
  });

  it.each([401, 403])('fails the run when Gemini rejects the key with %i', async (status) => {
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    translateBatch.mockReturnValue(
      Promise.resolve({
        translated: new Map(),
        errors: [Object.assign(new Error('denied'), { status })],
      })
    );
    const { writer, writeTranslationCache } = fakeWriter();

    // A rejected key is a setup bug, not a runtime blip: it recurs identically every run, and
    // staleness cannot catch it because upstream_hash keeps advancing while the register publishes.
    await expect(localizeRecords(records, 'br-anac', 'pt', writer)).rejects.toThrow(
      /GEMINI_API_KEY rejected by Gemini/
    );
    expect(writeTranslationCache).not.toHaveBeenCalled();
  });

  it('never calls Gemini or writes the cache in dry-run mode, and leaves the original text in place', async () => {
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    const { writer, writeTranslationCache } = fakeWriter();

    const { records: result, stats } = await localizeRecords(
      records,
      'br-anac',
      'pt',
      writer,
      true
    );

    expect(translateBatch).not.toHaveBeenCalled();
    expect(writeTranslationCache).not.toHaveBeenCalled();
    expect(stats).toEqual({ candidates: 1, cache_hits: 0, translated: 0, failed: 0 });
    expect(result.get('1')!.cancellation_reason).toBe('AERONAVE EXPORTADA');
  });

  it('passes null through for an unpopulated field even when others are translated', async () => {
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    translateBatch.mockImplementation(ok([[hash, 'Aircraft exported']]));
    const { writer } = fakeWriter();

    const { records: result } = await localizeRecords(records, 'br-anac', 'pt', writer);

    expect(result.get('1')!.airworthiness_class).toBeNull();
  });

  it('translates lien_status for a source other than mv-caa', async () => {
    const hash = hashTranslatable('lien_status', 'ALIENACAO FIDUCIARIA');
    const records = new Map([['1', make('1', { lien_status: 'ALIENACAO FIDUCIARIA' })]]);
    translateBatch.mockImplementation(ok([[hash, 'Fiduciary lien']]));
    const { writer } = fakeWriter();

    const { records: result, stats } = await localizeRecords(records, 'br-anac', 'pt', writer);

    expect(stats.candidates).toBe(1);
    expect(result.get('1')!.lien_status).toBe('Fiduciary lien');
  });

  // mv-caa publishes in English and its mortgage cell holds a party name; the language gate keeps
  // both out of Gemini, where "First Bank Ltd" could come back reworded.
  it('skips Gemini entirely for an English register', async () => {
    const records = new Map([
      ['1', make('1', { source: 'mv-caa', lien_status: 'First Bank Ltd' })],
    ]);
    const { writer } = fakeWriter();

    const { records: result, stats } = await localizeRecords(records, 'mv-caa', 'en', writer);

    expect(stats.candidates).toBe(0);
    expect(translateBatch).not.toHaveBeenCalled();
    expect(result.get('1')!.lien_status).toBe('First Bank Ltd');
  });

  // A non-English source still reaches Gemini, but only for the fields that are actually free text:
  // cl-dgac's operational_classes comes from a lookup that already emits canonical English tokens.
  // Guarded at apply-time as well as collection: an entry cached before the source joined the
  // exclusion set would otherwise still be applied on every later run.
  it('ignores a stale cached translation for an excluded array field', async () => {
    const stale = hashTranslatable('operational_classes', 'commercial');
    const live = hashTranslatable('cancellation_reason', 'CANCELADA');
    // cancellation_reason keeps the record past the zero-candidate short-circuit, so the apply path
    // actually runs and the array guard is the only thing protecting the excluded field.
    const records = new Map([
      [
        '1',
        make('1', {
          source: 'cl-dgac',
          cancellation_reason: 'CANCELADA',
          operational_classes: ['commercial'],
        }),
      ],
    ]);
    const { writer } = fakeWriter({ [stale]: 'comercial (stale)', [live]: 'Cancelled' });

    const { records: result, stats } = await localizeRecords(records, 'cl-dgac', 'es', writer);

    expect(stats.candidates).toBe(1);
    expect(result.get('1')!.cancellation_reason).toBe('Cancelled');
    expect(result.get('1')!.operational_classes).toEqual(['commercial']);
  });

  it('excludes an already-canonical array field within a non-English source', async () => {
    const hash = hashTranslatable('cancellation_reason', 'CANCELADA');
    const records = new Map([
      [
        '1',
        make('1', {
          source: 'cl-dgac',
          cancellation_reason: 'CANCELADA',
          operational_classes: ['commercial'],
        }),
      ],
    ]);
    translateBatch.mockImplementation(ok([[hash, 'Cancelled']]));
    const { writer } = fakeWriter();

    const { records: result, stats } = await localizeRecords(records, 'cl-dgac', 'es', writer);

    expect(stats.candidates).toBe(1);
    expect(result.get('1')!.cancellation_reason).toBe('Cancelled');
    expect(result.get('1')!.operational_classes).toEqual(['commercial']);
  });

  it('ignores AESA airworthiness classes already rendered in English, including stale cache entries', async () => {
    const classHash = hashTranslatable('airworthiness_class', 'ultralight airplane');
    const reasonHash = hashTranslatable('cancellation_reason', 'BAJA DEFINITIVA');
    const records = new Map([
      [
        '1',
        make('1', {
          source: 'es-aesa',
          airworthiness_class: 'ultralight airplane',
          airworthiness_class_source_text: 'ULM - AVION',
          cancellation_reason: 'BAJA DEFINITIVA',
        }),
      ],
    ]);
    translateBatch.mockImplementation(ok([[reasonHash, 'Permanent deregistration']]));
    const { writer } = fakeWriter({ [classHash]: 'light sport aircraft' });

    const { records: result, stats } = await localizeRecords(records, 'es-aesa', 'es', writer);

    expect(stats.candidates).toBe(1);
    expect(translateBatch).toHaveBeenCalledWith(
      [{ id: reasonHash, field: 'cancellation_reason', text: 'BAJA DEFINITIVA' }],
      expect.anything()
    );
    expect(result.get('1')!.airworthiness_class).toBe('ultralight airplane');
    expect(result.get('1')!.cancellation_reason).toBe('Permanent deregistration');
  });

  it('translates each operational_classes element independently and preserves array order', async () => {
    const hashA = hashTranslatable('operational_classes', 'INSTRUCAO');
    const hashB = hashTranslatable('operational_classes', 'AGRICOLA');
    const records = new Map([['1', make('1', { operational_classes: ['INSTRUCAO', 'AGRICOLA'] })]]);
    translateBatch.mockImplementation(
      ok([
        [hashA, 'Instruction'],
        [hashB, 'Agricultural'],
      ])
    );
    const { writer } = fakeWriter();

    const { records: result, stats } = await localizeRecords(records, 'br-anac', 'pt', writer);

    expect(stats.candidates).toBe(2);
    expect(result.get('1')!.operational_classes).toEqual(['Instruction', 'Agricultural']);
  });

  it('falls back per-element to the original operational_classes text on a partial response', async () => {
    const hashA = hashTranslatable('operational_classes', 'INSTRUCAO');
    const records = new Map([['1', make('1', { operational_classes: ['INSTRUCAO', 'AGRICOLA'] })]]);
    translateBatch.mockImplementation(ok([[hashA, 'Instruction']]));
    const { writer } = fakeWriter();

    const { records: result } = await localizeRecords(records, 'br-anac', 'pt', writer);

    expect(result.get('1')!.operational_classes).toEqual(['Instruction', 'AGRICOLA']);
  });
});
