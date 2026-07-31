import { describe, it, expect, mock, beforeEach, spyOn } from 'bun:test';
import { Database } from 'bun:sqlite';
import type { Aircraft } from '../src/schema.js';
import type { FeedRow } from '../src/feed-row.js';
import type { SourceState } from '../src/cadence.js';

const FEED_ROW: FeedRow = {
  icao_hex: 'a1b2c3',
  registration: 'N1',
  icao_type_code: null,
  status: 'valid',
  country: 'US',
  manufacturer: null,
  model: null,
  serial_number: null,
  year_manufactured: null,
  airframe_type: null,
  category: null,
  engine_manufacturer: null,
  engine_model: null,
  engine_type: null,
  engine_count: null,
  engine_horsepower: null,
  engine_thrust_lbs: null,
  seats: null,
  max_passengers: null,
  cruise_speed_ktas: null,
  max_takeoff_weight_kg: null,
  owner_name: null,
  owner_kind: null,
  owner_state: null,
  owner_country: null,
  operator_name: null,
  operator_kind: null,
  operator_state: null,
  operator_country: null,
  cancellation_reason: null,
  airworthiness_class: null,
  source: 'faa',
};

const mockSend = mock();
const s3ClientConfig: { value: unknown } = { value: undefined };

void mock.module('@aws-sdk/client-s3', () => ({
  /* eslint-disable @typescript-eslint/no-explicit-any */
  S3Client: class {
    send: any = mockSend;
    constructor(config: unknown) {
      s3ClientConfig.value = config;
    }
  },
  /* eslint-enable @typescript-eslint/no-explicit-any */
  GetObjectCommand: class {
    readonly _kind = 'get';
    constructor(public input: { Bucket: string; Key: string }) {}
  },
  PutObjectCommand: class {
    readonly _kind = 'put';
    constructor(
      public input: { Bucket: string; Key: string; Body: Uint8Array | string; ContentType: string }
    ) {}
  },
  HeadObjectCommand: class {
    readonly _kind = 'head';
    constructor(public input: { Bucket: string; Key: string }) {}
  },
  NoSuchKey: class NoSuchKey extends Error {
    constructor() {
      super('The specified key does not exist.');
      this.name = 'NoSuchKey';
    }
  },
}));

const { R2ArtifactWriter, isTransientS3Error } = await import('../src/writer.js');
const { NoSuchKey } = await import('@aws-sdk/client-s3');

const s3Error = (message: string, httpStatusCode: number): Error =>
  Object.assign(new Error(message), { $metadata: { httpStatusCode } });

const noSuchKey = (): Error => new NoSuchKey({ message: 'x', $metadata: {} });

const R2_CONFIG = {
  accountId: 'test-account',
  accessKeyId: 'access-key',
  secretAccessKey: 'dummy', // gitleaks:allow
  bucketName: 'test-bucket',
};

const HASH64 = 'a'.repeat(64);
// Stands in for the pre-localization hash. Distinct from HASH64 so a test asserting on one cannot
// pass by accidentally matching the other.
const HASH_UP = 'b'.repeat(64);

function makeAircraft(id: string, reg: string, hex: string | null = null): Aircraft {
  return {
    source: 'faa',
    source_id: id,
    registration: reg,
    icao_hex: hex,
    icao_type_code: null,
    status: 'valid',
    country: 'US',
    manufacturer: 'CESSNA',
    model: '172',
    serial_number: '12345',
    year_manufactured: 1979,
    airframe_type: 'fixed-wing-single-engine',
    category: 'standard',
    build_certification: 'type-certificated',
    airworthiness_class: '1',
    airworthiness_class_source_text: '1',
    operating_environment: 'land',
    operational_classes: ['4'],
    operational_classes_source_text: ['4'],
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
  };
}

const stateResponse = (state: SourceState): object => ({
  Body: { transformToString: () => Promise.resolve(JSON.stringify(state)) },
});

interface PutCmd {
  _kind: 'put';
  input: { Key: string; Body: Uint8Array | string; ContentType: string };
}
const putCalls = (): PutCmd[] =>
  (mockSend.mock.calls as unknown[][]).map((c) => c[0] as PutCmd).filter((c) => c._kind === 'put');

beforeEach(() => {
  mockSend.mockReset();
});

describe('R2ArtifactWriter — client config', () => {
  it('points the S3 client at the account R2 endpoint', () => {
    new R2ArtifactWriter(R2_CONFIG, true);
    expect((s3ClientConfig.value as { endpoint: string }).endpoint).toBe(
      'https://test-account.r2.cloudflarestorage.com'
    );
  });
});

describe('R2ArtifactWriter — write', () => {
  it('builds and writes a SQLite artifact on a fresh source (no prior state)', async () => {
    mockSend.mockResolvedValue({});
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    const records = new Map([['00001', makeAircraft('00001', 'N12345', 'a4e294')]]);

    const stats = await writer.write(records, 'faa', null, HASH_UP);

    expect(stats.changed).toBe(true);
    expect(stats.record_count).toBe(1);
    const put = putCalls().find((c) => c.input.Key === 'aircraft/faa.sqlite');
    expect(put).toBeDefined();
    expect(put!.input.ContentType).toBe('application/vnd.sqlite3');
    // The PUT body is a real, queryable SQLite database.
    const db = Database.deserialize(put!.input.Body as Uint8Array);
    const row = db.query('SELECT registration FROM aircraft WHERE icao_hex = ?').get('a4e294') as {
      registration: string;
    };
    expect(row.registration).toBe('N12345');
  });

  it('skips the PUT when the content hash matches prior state (unchanged)', async () => {
    mockSend.mockResolvedValue({});
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    const records = new Map([['00001', makeAircraft('00001', 'N12345', 'a4e294')]]);

    const first = await writer.write(records, 'faa', null, HASH_UP);
    const prior: SourceState = {
      last_run: 'x',
      last_content_change: 'x',
      record_count: 1,
      content_hash: first.content_hash,
    };
    mockSend.mockReset();
    mockSend.mockResolvedValue({});

    const second = await writer.write(records, 'faa', prior, HASH_UP);

    expect(second.changed).toBe(false);
    expect(putCalls()).toHaveLength(0);
  });

  // Change detection must track the register, not our own enrichment. A translation landing on an
  // unchanged register would otherwise stamp last_content_change and close the staleness issue for
  // a source that has published nothing for months — defeating the monitor entirely.
  it('writes a translation-only change without reporting an upstream change', async () => {
    mockSend.mockResolvedValue({});
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    const untranslated = new Map([['00001', makeAircraft('00001', 'N12345', 'a4e294')]]);
    const first = await writer.write(untranslated, 'faa', null, HASH_UP);

    const prior: SourceState = {
      last_run: 'x',
      last_content_change: 'x',
      record_count: 1,
      content_hash: first.content_hash,
      upstream_hash: HASH_UP,
    };
    mockSend.mockReset();
    mockSend.mockResolvedValue({});

    // Same upstream rows, now carrying English — the artifact differs, the register does not.
    const translated = new Map([
      ['00001', { ...makeAircraft('00001', 'N12345', 'a4e294'), airworthiness_class: 'Standard' }],
    ]);
    const second = await writer.write(translated, 'faa', prior, HASH_UP);

    expect(second.changed).toBe(false);
    expect(second.content_hash).not.toBe(first.content_hash);
    expect(putCalls().some((c) => c.input.Key === 'aircraft/faa.sqlite')).toBe(true);
  });

  it('rewrites when the hash matches but the artifact is missing (external-deletion self-heal)', async () => {
    // State and artifact are separate objects; a lifecycle rule or manual cleanup can delete the
    // artifact while state still holds its hash — without the HEAD check every run would report
    // unchanged while consumers 404 indefinitely. The re-PUT still reports changed: false — the
    // DATA is identical, so last_content_change must not be stamped and staleness issues must
    // not close just because the object was rewritten.
    mockSend.mockResolvedValue({});
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    const records = new Map([['00001', makeAircraft('00001', 'N12345', 'a4e294')]]);
    const first = await writer.write(records, 'faa', null, HASH_UP);
    const prior: SourceState = {
      last_run: 'x',
      last_content_change: 'x',
      record_count: 1,
      content_hash: first.content_hash,
    };
    mockSend.mockReset();
    mockSend.mockImplementation((cmd: { _kind: string }) =>
      cmd._kind === 'head' ? Promise.reject(s3Error('NotFound', 404)) : Promise.resolve({})
    );

    const second = await writer.write(records, 'faa', prior, HASH_UP);

    expect(second.changed).toBe(false);
    expect(putCalls().some((c) => c.input.Key === 'aircraft/faa.sqlite')).toBe(true);
  });

  it('rewrites the artifact when the content hash differs from prior state', async () => {
    mockSend.mockResolvedValue({});
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    const prior: SourceState = {
      last_run: 'x',
      last_content_change: 'x',
      record_count: 1,
      content_hash: 'stale',
    };

    const stats = await writer.write(
      new Map([['00001', makeAircraft('00001', 'N12345', 'a4e294')]]),
      'faa',
      prior,
      HASH_UP
    );

    expect(stats.changed).toBe(true);
    expect(putCalls().some((c) => c.input.Key === 'aircraft/faa.sqlite')).toBe(true);
  });

  it('refuses to write zero records when prior data exists (mass-delete guard)', async () => {
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    const prior: SourceState = {
      last_run: 'x',
      last_content_change: 'x',
      record_count: 300_000,
      content_hash: 'h',
    };
    await expect(writer.write(new Map(), 'faa', prior, HASH_UP)).rejects.toThrow(
      /Refusing to write 0 records/
    );
  });

  it('refuses zero records even on a fresh source with no prior state', async () => {
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    await expect(writer.write(new Map(), 'faa', null, HASH_UP)).rejects.toThrow(
      /Refusing to write 0 records/
    );
  });

  it('refuses a drop below half the prior record count (truncated-upstream guard)', async () => {
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    const prior: SourceState = { last_run: 'x', last_content_change: 'x', record_count: 100 };
    // 1 record vs prior 100 = 99% drop → suspected truncation.
    await expect(
      writer.write(new Map([['00001', makeAircraft('00001', 'N1')]]), 'faa', prior, HASH_UP)
    ).rejects.toThrow(/drop from prior 100/);
  });

  it('accepts a shrink at exactly the 50% retain floor (strict comparison)', async () => {
    // Legitimate registry cleanups land here; if threshold drift ever rejects this, every such
    // cleanup bricks the source's daily refresh until someone deletes its state by hand.
    mockSend.mockResolvedValue({});
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    const prior: SourceState = { last_run: 'x', last_content_change: 'x', record_count: 4 };
    const records = new Map([
      ['00001', makeAircraft('00001', 'N1')],
      ['00002', makeAircraft('00002', 'N2')],
    ]);

    const stats = await writer.write(records, 'faa', prior, HASH_UP);

    expect(stats.changed).toBe(true);
    expect(stats.record_count).toBe(2);
  });

  it('rejects a shrink just below the 50% retain floor', async () => {
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    const prior: SourceState = { last_run: 'x', last_content_change: 'x', record_count: 5 };
    const records = new Map([
      ['00001', makeAircraft('00001', 'N1')],
      ['00002', makeAircraft('00002', 'N2')],
    ]);

    await expect(writer.write(records, 'faa', prior, HASH_UP)).rejects.toThrow(/drop from prior 5/);
  });

  it('bypasses the truncation guard when prior state has no record_count (legacy escape hatch)', async () => {
    // Legacy state predates record_count, and deleting _state/<source>.json is the documented
    // override for a legitimate mass shrink — both flow through this bypass.
    mockSend.mockResolvedValue({});
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    const prior: SourceState = { last_run: 'x', last_content_change: 'x', content_hash: 'stale' };

    const stats = await writer.write(
      new Map([['00001', makeAircraft('00001', 'N1')]]),
      'faa',
      prior,
      HASH_UP
    );

    expect(stats.changed).toBe(true);
  });

  it('retries a transient error on the artifact PUT', async () => {
    mockSend.mockRejectedValueOnce(s3Error('internal', 500)).mockResolvedValueOnce({});
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    const stats = await writer.write(
      new Map([['00001', makeAircraft('00001', 'N1', 'a4e294')]]),
      'faa',
      null,
      HASH_UP
    );
    expect(stats.changed).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('does not call S3 in dry-run mode', async () => {
    const writer = new R2ArtifactWriter(R2_CONFIG, true);
    const stats = await writer.write(
      new Map([['00001', makeAircraft('00001', 'N12345')]]),
      'faa',
      null,
      HASH_UP
    );
    expect(stats.changed).toBe(true);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('R2ArtifactWriter — state', () => {
  it('writes state to aircraft/_state/<source>.json as JSON', async () => {
    mockSend.mockResolvedValue({});
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    const state: SourceState = {
      last_run: '2026-06-21T00:00:00Z',
      last_content_change: '2026-06-21T00:00:00Z',
      record_count: 5,
      content_hash: 'abc',
    };

    await writer.writeState('faa', state);

    const put = putCalls().find((c) => c.input.Key === 'aircraft/_state/faa.json');
    expect(put).toBeDefined();
    expect(put!.input.ContentType).toBe('application/json');
    expect(JSON.parse(put!.input.Body as string)).toEqual(state);
  });

  it('reads and parses prior state', async () => {
    const state: SourceState = {
      last_run: 'r',
      last_content_change: 'c',
      record_count: 9,
      content_hash: HASH64,
    };
    mockSend.mockResolvedValueOnce(stateResponse(state));
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    expect(await writer.readState('faa')).toEqual(state);
  });

  it('returns null when state is absent (NoSuchKey)', async () => {
    mockSend.mockRejectedValueOnce(noSuchKey());
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    expect(await writer.readState('faa')).toBeNull();
  });

  it('returns null for an empty state body', async () => {
    mockSend.mockResolvedValueOnce({ Body: { transformToString: () => Promise.resolve('') } });
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    expect(await writer.readState('faa')).toBeNull();
  });

  it('returns null for invalid JSON state', async () => {
    mockSend.mockResolvedValueOnce({
      Body: { transformToString: () => Promise.resolve('{not json') },
    });
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    expect(await writer.readState('faa')).toBeNull();
  });

  it('returns null for schema-invalid state', async () => {
    mockSend.mockResolvedValueOnce({
      Body: { transformToString: () => Promise.resolve(JSON.stringify({ last_run: 5 })) },
    });
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    expect(await writer.readState('faa')).toBeNull();
  });

  it('rethrows a non-NoSuchKey state read error', async () => {
    mockSend.mockRejectedValueOnce(s3Error('AccessDenied', 403));
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    await expect(writer.readState('faa')).rejects.toThrow('AccessDenied');
  });

  it('retries a transient state read error', async () => {
    const state: SourceState = { last_run: 'r', last_content_change: 'c' };
    mockSend
      .mockRejectedValueOnce(s3Error('internal', 500))
      .mockResolvedValueOnce(stateResponse(state));
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    expect(await writer.readState('faa')).toEqual(state);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });
});

describe('R2ArtifactWriter — translation cache', () => {
  const cache = { version: 1 as const, entries: { [HASH64]: 'Aircraft exported' } };
  const emptyCache = { version: 1 as const, entries: {} };
  const cacheResponse = (value: unknown) => ({
    Body: { transformToString: () => Promise.resolve(JSON.stringify(value)) },
  });

  it('writes the cache to aircraft/_translation_cache/<source>.json as JSON', async () => {
    mockSend.mockResolvedValue({});
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    await writer.writeTranslationCache('faa', cache);

    const put = putCalls().find((c) => c.input.Key === 'aircraft/_translation_cache/faa.json');
    expect(put).toBeDefined();
    expect(put!.input.ContentType).toBe('application/json');
    expect(JSON.parse(put!.input.Body as string)).toEqual(cache);
  });

  it('reads and parses a prior cache', async () => {
    mockSend.mockResolvedValueOnce(cacheResponse(cache));
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    expect(await writer.readTranslationCache('faa')).toEqual(cache);
  });

  it('returns an empty cache when absent (NoSuchKey)', async () => {
    mockSend.mockRejectedValueOnce(noSuchKey());
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    expect(await writer.readTranslationCache('faa')).toEqual(emptyCache);
  });

  it('returns an empty cache for an empty body', async () => {
    mockSend.mockResolvedValueOnce({ Body: { transformToString: () => Promise.resolve('') } });
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    expect(await writer.readTranslationCache('faa')).toEqual(emptyCache);
  });

  it('returns an empty cache for invalid JSON', async () => {
    mockSend.mockResolvedValueOnce({
      Body: { transformToString: () => Promise.resolve('{not json') },
    });
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    expect(await writer.readTranslationCache('faa')).toEqual(emptyCache);
  });

  it('returns a current empty cache for an obsolete cache generation', async () => {
    mockSend.mockResolvedValueOnce({
      Body: {
        transformToString: () =>
          Promise.resolve(JSON.stringify({ version: 0, entries: { [HASH64]: 'stale' } })),
      },
    });
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    expect(await writer.readTranslationCache('faa')).toEqual(emptyCache);
  });

  it('rethrows a non-NoSuchKey cache read error', async () => {
    mockSend.mockRejectedValueOnce(s3Error('AccessDenied', 403));
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    await expect(writer.readTranslationCache('faa')).rejects.toThrow('AccessDenied');
  });
});

describe('R2ArtifactWriter — artifactExists', () => {
  it('returns true when HEAD resolves', async () => {
    mockSend.mockResolvedValueOnce({});
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    expect(await writer.artifactExists('faa')).toBe(true);
  });

  it('short-circuits to true in dry-run without a HEAD', async () => {
    const writer = new R2ArtifactWriter(R2_CONFIG, true);
    expect(await writer.artifactExists('faa')).toBe(true);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns false and logs the underlying error when HEAD fails', async () => {
    mockSend.mockRejectedValueOnce(s3Error('Access Denied', 403));
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});
    try {
      expect(await writer.artifactExists('faa')).toBe(false);
      // A 404 and an R2 outage both land here — without the message an operator can't tell them
      // apart, and a transport failure reads as a benign missing artifact.
      const logged = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(logged).toContain('event=artifact_missing_on_hash_match');
      expect(logged).toContain('Access Denied');
    } finally {
      logSpy.mockRestore();
    }
  });
});

describe('isTransientS3Error', () => {
  it('classifies 5xx, 429, and unknown as transient; 4xx and NoSuchKey as permanent', () => {
    expect(isTransientS3Error(s3Error('e', 500))).toBe(true);
    expect(isTransientS3Error(s3Error('e', 429))).toBe(true);
    expect(isTransientS3Error(new Error('socket'))).toBe(true);
    expect(isTransientS3Error(s3Error('e', 403))).toBe(false);
    expect(isTransientS3Error(noSuchKey())).toBe(false);
    expect(isTransientS3Error(null)).toBe(true);
    expect(isTransientS3Error(undefined)).toBe(true);
  });
});

describe('R2ArtifactWriter — feed intermediates', () => {
  it('reports the slice exists when it reads back as a well-formed FeedRow[]', async () => {
    mockSend.mockResolvedValueOnce({
      Body: { transformToString: () => Promise.resolve(JSON.stringify([FEED_ROW])) },
    });
    const writer = new R2ArtifactWriter(R2_CONFIG, false);

    expect(await writer.feedRowsExist('faa')).toBe(true);
    const command = mockSend.mock.calls[0]?.[0] as { _kind: string; input: { Key: string } };
    expect(command._kind).toBe('get');
    expect(command.input.Key).toBe('aircraft/_feed/faa.json');
  });

  it('reports a structurally-invalid slice as missing so it self-heals', async () => {
    mockSend.mockResolvedValue({
      Body: { transformToString: () => Promise.resolve('[{"icao_hex":"a1b2c3"}]') },
    });
    expect(await new R2ArtifactWriter(R2_CONFIG, false).feedRowsExist('faa')).toBe(false);
  });

  it('reports an absent slice as missing so it self-heals', async () => {
    mockSend.mockRejectedValue(noSuchKey());
    expect(await new R2ArtifactWriter(R2_CONFIG, false).feedRowsExist('faa')).toBe(false);
  });

  it('reports a present-but-corrupt slice as missing so it self-heals', async () => {
    mockSend.mockResolvedValue({ Body: { transformToString: () => Promise.resolve('{not json') } });
    expect(await new R2ArtifactWriter(R2_CONFIG, false).feedRowsExist('faa')).toBe(false);
  });

  it('reports missing and logs when the slice read fails hard', async () => {
    mockSend.mockRejectedValue(s3Error('Not Found', 404));
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});
    try {
      expect(await writer.feedRowsExist('faa')).toBe(false);
      expect(logSpy.mock.calls.map((call) => String(call[0])).join('\n')).toContain(
        'event=feed_rows_missing_on_cadence_skip'
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  it('short-circuits feed slice existence in dry-run mode', async () => {
    const writer = new R2ArtifactWriter(R2_CONFIG, true);

    expect(await writer.feedRowsExist('faa')).toBe(true);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('writes the per-source slice JSON to aircraft/_feed/<source>.json', async () => {
    mockSend.mockResolvedValue({});
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    await writer.writeFeedRows('faa', [{ icao_hex: 'a1b2c3', registration: 'N1' } as never]);
    const put = putCalls().find((c) => c.input.Key === 'aircraft/_feed/faa.json');
    expect(put?.input.ContentType).toBe('application/json');
    expect(String(put?.input.Body)).toContain('a1b2c3');
  });

  it('reads a well-formed per-source slice back', async () => {
    mockSend.mockResolvedValue({
      Body: { transformToString: () => Promise.resolve(JSON.stringify([FEED_ROW])) },
    });
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    expect(await writer.readFeedRows('faa')).toEqual([FEED_ROW]);
  });

  it('treats a valid-JSON but wrong-shape slice as absent (structural validation)', async () => {
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    for (const body of ['{}', '[{"icao_hex":"a1b2c3"}]', '[1,2,3]', '"a string"']) {
      mockSend.mockResolvedValue({ Body: { transformToString: () => Promise.resolve(body) } });
      expect(await writer.readFeedRows('faa')).toBeNull();
    }
  });

  it('returns null when the slice is absent', async () => {
    mockSend.mockRejectedValue(noSuchKey());
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    expect(await writer.readFeedRows('faa')).toBeNull();
  });

  it('returns null for an empty body', async () => {
    mockSend.mockResolvedValue({ Body: { transformToString: () => Promise.resolve('') } });
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    expect(await writer.readFeedRows('faa')).toBeNull();
  });

  it('treats corrupt JSON as absent (parity with readState)', async () => {
    mockSend.mockResolvedValue({ Body: { transformToString: () => Promise.resolve('{not json') } });
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    expect(await writer.readFeedRows('faa')).toBeNull();
  });
});

describe('R2ArtifactWriter — deployed feed hash', () => {
  it('reads the deployed hash from aircraft/_feed/_deployed.json', async () => {
    mockSend.mockResolvedValue({
      Body: { transformToString: () => Promise.resolve(JSON.stringify({ hash: HASH64 })) },
    });
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    expect(await writer.readDeployedFeedHash()).toBe(HASH64);
    const command = mockSend.mock.calls[0]?.[0] as { input: { Key: string } };
    expect(command.input.Key).toBe('aircraft/_feed/_deployed.json');
  });

  it('returns null when the marker is absent', async () => {
    mockSend.mockRejectedValue(noSuchKey());
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    expect(await writer.readDeployedFeedHash()).toBeNull();
  });

  it('returns null for an empty body', async () => {
    mockSend.mockResolvedValue({ Body: { transformToString: () => Promise.resolve('') } });
    expect(await new R2ArtifactWriter(R2_CONFIG, false).readDeployedFeedHash()).toBeNull();
  });

  it('returns null when the marker lacks a string hash', async () => {
    mockSend.mockResolvedValue({
      Body: { transformToString: () => Promise.resolve(JSON.stringify({ hash: 7 })) },
    });
    expect(await new R2ArtifactWriter(R2_CONFIG, false).readDeployedFeedHash()).toBeNull();
  });

  it('treats corrupt JSON as absent', async () => {
    mockSend.mockResolvedValue({ Body: { transformToString: () => Promise.resolve('{not json') } });
    expect(await new R2ArtifactWriter(R2_CONFIG, false).readDeployedFeedHash()).toBeNull();
  });

  it('writes the marker JSON to aircraft/_feed/_deployed.json', async () => {
    mockSend.mockResolvedValue({});
    await new R2ArtifactWriter(R2_CONFIG, false).writeDeployedFeedHash(HASH64);
    const put = putCalls().find((c) => c.input.Key === 'aircraft/_feed/_deployed.json');
    expect(put?.input.ContentType).toBe('application/json');
    expect(String(put?.input.Body)).toContain(HASH64);
  });
});
