import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { Aircraft } from '../../src/schema.js';
import {
  hashTranslatable,
  TRANSLATION_CACHE_VERSION,
  type TranslationEntries,
} from '../../src/localize/cache.js';

const translateBatch = mock();
const requireEnv = mock(() => 'test-key');
const readPositiveIntegerEnv = mock(() => 10);

void mock.module('../../src/localize/gemini-client.js', () => ({ translateBatch }));
void mock.module('../../src/env.js', () => ({ readPositiveIntegerEnv, requireEnv }));

const { localizeRecords } = await import('../../src/localize/localize.js');

const ok = (entries: [string, string][]) =>
  Promise.resolve({ translated: new Map(entries), errors: [] });

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
  operating_environment: null,
  operational_classes: [],
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
  lien_status: null,
  interdiction_code: null,
  translations_en: {
    cancellation_reason: null,
    airworthiness_class: null,
  },
  ...overrides,
});

type FakeWriter = import('../../src/writer.js').R2ArtifactWriter;

// Only the two methods localizeRecords actually calls are exercised; the rest of
// R2ArtifactWriter's surface is irrelevant here. Mocks are returned alongside the writer (rather
// than read back off it) so assertions don't trip @typescript-eslint/unbound-method.
const cacheEnvelope = (entries: TranslationEntries = {}) => ({
  version: TRANSLATION_CACHE_VERSION,
  entries,
});

const fakeWriter = (
  entries: TranslationEntries = {}
): {
  writer: FakeWriter;
  readTranslationCache: ReturnType<typeof mock>;
  writeTranslationCache: ReturnType<typeof mock>;
} => {
  const readTranslationCache = mock(() => Promise.resolve(cacheEnvelope(entries)));
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

    const { records: result, stats } = await localizeRecords(records, 'br-anac', writer);

    expect(stats).toEqual({ candidates: 0, cache_hits: 0, translated: 0, failed: 0 });
    expect(readTranslationCache).not.toHaveBeenCalled();
    expect(translateBatch).not.toHaveBeenCalled();
    expect(result.get('1')!.translations_en.cancellation_reason).toBeNull();
  });

  it('translates a cache miss and persists the updated cache', async () => {
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    translateBatch.mockReturnValue(ok([[hash, 'Aircraft exported']]));
    const { writer, writeTranslationCache } = fakeWriter();

    const { records: result, stats } = await localizeRecords(records, 'br-anac', writer);

    expect(stats).toEqual({ candidates: 1, cache_hits: 0, translated: 1, failed: 0 });
    expect(result.get('1')!.translations_en.cancellation_reason).toBe('Aircraft exported');
    expect(writeTranslationCache).toHaveBeenCalledWith(
      'br-anac',
      cacheEnvelope({ [hash]: 'Aircraft exported' })
    );
  });

  it('never overwrites the original field, on success or failure', async () => {
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    translateBatch.mockReturnValue(ok([[hash, 'Aircraft exported']]));
    const { writer } = fakeWriter();

    const { records: success } = await localizeRecords(records, 'br-anac', writer);
    expect(success.get('1')!.cancellation_reason).toBe('AERONAVE EXPORTADA');

    translateBatch.mockReturnValue(
      Promise.resolve({ translated: new Map(), errors: [new Error('x')] })
    );
    const { writer: writer2 } = fakeWriter();
    const { records: failure } = await localizeRecords(records, 'br-anac', writer2);
    expect(failure.get('1')!.cancellation_reason).toBe('AERONAVE EXPORTADA');
  });

  it('resolves from cache without calling Gemini', async () => {
    const hash = hashTranslatable('airworthiness_class', 'CA PADRAO');
    const records = new Map([['1', make('1', { airworthiness_class: 'CA PADRAO' })]]);
    const { writer } = fakeWriter({ [hash]: 'Standard (cached)' });

    const { records: result, stats } = await localizeRecords(records, 'br-anac', writer);

    expect(stats).toEqual({ candidates: 1, cache_hits: 1, translated: 0, failed: 0 });
    expect(result.get('1')!.translations_en.airworthiness_class).toBe('Standard (cached)');
    expect(translateBatch).not.toHaveBeenCalled();
  });

  it('dedupes identical (field, text) pairs across records into one Gemini item', async () => {
    const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    const records = new Map([
      ['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })],
      ['2', make('2', { cancellation_reason: 'AERONAVE EXPORTADA' })],
    ]);
    translateBatch.mockReturnValue(ok([[hash, 'Aircraft exported']]));
    const { writer } = fakeWriter();

    const { records: result, stats } = await localizeRecords(records, 'br-anac', writer);

    expect(stats.candidates).toBe(1);
    expect(translateBatch).toHaveBeenCalledTimes(1);
    expect(translateBatch.mock.calls[0][0]).toEqual([
      { id: hash, field: 'cancellation_reason', text: 'AERONAVE EXPORTADA' },
    ]);
    expect(result.get('1')!.translations_en.cancellation_reason).toBe('Aircraft exported');
    expect(result.get('2')!.translations_en.cancellation_reason).toBe('Aircraft exported');
  });

  it('leaves translations null and skips the cache write when every chunk errors', async () => {
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    translateBatch.mockReturnValue(
      Promise.resolve({ translated: new Map(), errors: [new Error('quota exceeded')] })
    );
    const { writer, writeTranslationCache } = fakeWriter();

    const { records: result, stats } = await localizeRecords(records, 'br-anac', writer);

    expect(stats).toEqual({ candidates: 1, cache_hits: 0, translated: 0, failed: 1 });
    expect(result.get('1')!.translations_en.cancellation_reason).toBeNull();
    expect(writeTranslationCache).not.toHaveBeenCalled();
  });

  it('leaves translations null on an auth-shaped Gemini error, without throwing', async () => {
    // Only an absent GEMINI_API_KEY (requireEnv) throws. Any error the Gemini call itself
    // produces — auth, bad request, malformed response — degrades the same as a transient one.
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    const error = Object.assign(new Error('API key rejected'), { status: 401 });
    translateBatch.mockReturnValue(Promise.resolve({ translated: new Map(), errors: [error] }));
    const { writer, writeTranslationCache } = fakeWriter();

    const { records: result, stats } = await localizeRecords(records, 'br-anac', writer);

    expect(stats.failed).toBe(1);
    expect(result.get('1')!.translations_en.cancellation_reason).toBeNull();
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
    translateBatch.mockReturnValue(ok([[hashA, 'Aircraft exported']]));
    const { writer, writeTranslationCache } = fakeWriter();

    const { records: result, stats } = await localizeRecords(records, 'br-anac', writer);

    expect(stats).toEqual({ candidates: 2, cache_hits: 0, translated: 1, failed: 1 });
    expect(result.get('1')!.translations_en.cancellation_reason).toBe('Aircraft exported');
    expect(result.get('1')!.translations_en.airworthiness_class).toBeNull();
    const cache = writeTranslationCache.mock.calls[0][1] as ReturnType<typeof cacheEnvelope>;
    expect(cache).toEqual(cacheEnvelope({ [hashA]: 'Aircraft exported' }));
    expect(cache.entries[hashB]).toBeUndefined();
  });

  it('discards an id in the response that was never requested', async () => {
    const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    translateBatch.mockReturnValue(
      ok([
        [hash, 'Aircraft exported'],
        ['unrequested-id', 'junk'],
      ])
    );
    const { writer, writeTranslationCache } = fakeWriter();

    await localizeRecords(records, 'br-anac', writer);

    expect(writeTranslationCache).toHaveBeenCalledWith(
      'br-anac',
      cacheEnvelope({ [hash]: 'Aircraft exported' })
    );
  });

  it('proceeds with an empty cache when the cache read fails, without throwing', async () => {
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    translateBatch.mockReturnValue(ok([[hash, 'Aircraft exported']]));
    const { writer, writeTranslationCache } = fakeWriter();
    (writer.readTranslationCache as ReturnType<typeof mock>).mockRejectedValue(
      new Error('R2 down')
    );

    const { records: result, stats } = await localizeRecords(records, 'br-anac', writer);

    expect(stats.failed).toBe(0);
    expect(result.get('1')!.translations_en.cancellation_reason).toBe('Aircraft exported');
    expect(writeTranslationCache).not.toHaveBeenCalled();
  });

  it('degrades on an access-denied cache read the same as a transient one', async () => {
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    const error = Object.assign(new Error('AccessDenied'), {
      $metadata: { httpStatusCode: 403 },
    });
    translateBatch.mockReturnValue(ok([[hash, 'Aircraft exported']]));
    const { writer } = fakeWriter();
    (writer.readTranslationCache as ReturnType<typeof mock>).mockRejectedValue(error);

    const { records: result } = await localizeRecords(records, 'br-anac', writer);

    expect(translateBatch).toHaveBeenCalledTimes(1);
    expect(result.get('1')!.translations_en.cancellation_reason).toBe('Aircraft exported');
  });

  it('still returns the in-memory translation when the cache write fails, without throwing', async () => {
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    translateBatch.mockReturnValue(ok([[hash, 'Aircraft exported']]));
    const { writer } = fakeWriter();
    (writer.writeTranslationCache as ReturnType<typeof mock>).mockRejectedValue(
      new Error('R2 down')
    );

    const { records: result } = await localizeRecords(records, 'br-anac', writer);

    expect(result.get('1')!.translations_en.cancellation_reason).toBe('Aircraft exported');
  });

  it('degrades on an access-denied cache write the same as a transient one', async () => {
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    translateBatch.mockReturnValue(ok([[hash, 'Aircraft exported']]));
    const error = Object.assign(new Error('AccessDenied'), {
      $metadata: { httpStatusCode: 403 },
    });
    const { writer } = fakeWriter();
    (writer.writeTranslationCache as ReturnType<typeof mock>).mockRejectedValue(error);

    const { records: result } = await localizeRecords(records, 'br-anac', writer);

    expect(result.get('1')!.translations_en.cancellation_reason).toBe('Aircraft exported');
  });

  it('falls back to the default RPM and still translates when GEMINI_REQUESTS_PER_MINUTE is malformed', async () => {
    readPositiveIntegerEnv.mockImplementation(() => {
      throw new Error('GEMINI_REQUESTS_PER_MINUTE must be a positive integer');
    });
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    translateBatch.mockReturnValue(ok([[hash, 'Aircraft exported']]));
    const { writer } = fakeWriter();

    const { records: result } = await localizeRecords(records, 'br-anac', writer);

    expect(result.get('1')!.translations_en.cancellation_reason).toBe('Aircraft exported');
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

    await expect(localizeRecords(records, 'br-anac', writer)).rejects.toThrow(
      'Missing required environment variable: GEMINI_API_KEY'
    );
    expect(translateBatch).not.toHaveBeenCalled();
  });

  it('never calls Gemini or writes the cache in dry-run mode', async () => {
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    const { writer, writeTranslationCache } = fakeWriter();

    const { records: result, stats } = await localizeRecords(records, 'br-anac', writer, true);

    expect(translateBatch).not.toHaveBeenCalled();
    expect(writeTranslationCache).not.toHaveBeenCalled();
    expect(stats).toEqual({ candidates: 1, cache_hits: 0, translated: 0, failed: 0 });
    expect(result.get('1')!.translations_en.cancellation_reason).toBeNull();
  });

  it('passes null through for an unpopulated field even when others are translated', async () => {
    const records = new Map([['1', make('1', { cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');
    translateBatch.mockReturnValue(ok([[hash, 'Aircraft exported']]));
    const { writer } = fakeWriter();

    const { records: result } = await localizeRecords(records, 'br-anac', writer);

    expect(result.get('1')!.translations_en.airworthiness_class).toBeNull();
  });
});
