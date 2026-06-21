import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import type { Aircraft } from '../src/schema.js';
import type { SourceState } from '../src/cadence.js';

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
    operating_environment: 'land',
    operational_classes: ['4'],
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

    const stats = await writer.write(records, 'faa', null);

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

    const first = await writer.write(records, 'faa', null);
    const prior: SourceState = {
      last_run: 'x',
      last_content_change: 'x',
      record_count: 1,
      content_hash: first.content_hash,
    };
    mockSend.mockReset();
    mockSend.mockResolvedValue({});

    const second = await writer.write(records, 'faa', prior);

    expect(second.changed).toBe(false);
    expect(putCalls()).toHaveLength(0);
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
      prior
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
    await expect(writer.write(new Map(), 'faa', prior)).rejects.toThrow(
      /Refusing to write 0 records/
    );
  });

  it('refuses zero records even on a fresh source with no prior state', async () => {
    const writer = new R2ArtifactWriter(R2_CONFIG, false);
    await expect(writer.write(new Map(), 'faa', null)).rejects.toThrow(
      /Refusing to write 0 records/
    );
  });

  it('does not call S3 in dry-run mode', async () => {
    const writer = new R2ArtifactWriter(R2_CONFIG, true);
    const stats = await writer.write(
      new Map([['00001', makeAircraft('00001', 'N12345')]]),
      'faa',
      null
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
      content_hash: 'h',
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

describe('isTransientS3Error', () => {
  it('classifies 5xx, 429, and unknown as transient; 4xx and NoSuchKey as permanent', () => {
    expect(isTransientS3Error(s3Error('e', 500))).toBe(true);
    expect(isTransientS3Error(s3Error('e', 429))).toBe(true);
    expect(isTransientS3Error(new Error('socket'))).toBe(true);
    expect(isTransientS3Error(s3Error('e', 403))).toBe(false);
    expect(isTransientS3Error(noSuchKey())).toBe(false);
  });
});
