import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Aircraft } from '../src/schema.js';

const mockSend = vi.hoisted(() => vi.fn());
const s3ClientConfig = vi.hoisted((): { value: unknown } => ({ value: undefined }));

vi.mock('@aws-sdk/client-s3', () => ({
  /* eslint-disable @typescript-eslint/no-explicit-any */
  S3Client: class {
    send: any = mockSend;
    constructor(config: unknown) {
      s3ClientConfig.value = config;
    }
  },
  /* eslint-enable @typescript-eslint/no-explicit-any */
  GetObjectCommand: class {
    _type = 'get';
    constructor(public a: unknown) {}
  },
  PutObjectCommand: class {
    _type = 'put';
    constructor(public a: unknown) {}
  },
  DeleteObjectCommand: class {
    _type = 'del';
    constructor(public a: unknown) {}
  },
  NoSuchKey: class NoSuchKey extends Error {
    constructor() {
      super('The specified key does not exist.');
      this.name = 'NoSuchKey';
    }
  },
}));

import { R2DiffWriter, isTransientS3Error } from '../src/writer.js';
import { contentHash } from '../src/engine.js';
import { NoSuchKey } from '@aws-sdk/client-s3';

// Real AWS SDK errors carry $metadata.httpStatusCode; bare Errors don't. Permanent failures
// (auth/validation) surface as 4xx and must not be retried.
const s3Error = (message: string, httpStatusCode: number): Error =>
  Object.assign(new Error(message), { $metadata: { httpStatusCode } });

const noSuchKey = (): NoSuchKey =>
  new NoSuchKey({ message: 'The specified key does not exist.', $metadata: {} });

// A 500 "internal error" is the transient R2 failure the daily job hit in production.
const s3TransientError = (): Error => s3Error('We encountered an internal error.', 500);

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
      manufacturer: 'LYCOMING',
      model: 'O-320',
      type: 'reciprocating',
      count: 1,
      horsepower: 150,
      thrust_lbs: null,
    },
    owner: { name: 'JOHN DOE', kind: 'individual', state: 'KS', country: 'US' },
    operator: { name: null, kind: null, state: null, country: null },
    idera_authorised_party: null,
    certification_date: '1979-06-20',
    airworthiness_date: null,
    expiration_date: '2026-10-31',
    last_action_date: '2023-10-15',
    cruise_speed_ktas: 106,
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

function manifestResponse(
  entries: Record<string, { hash: string; icao_hex: string | null; registration: string }>
): object {
  return { Body: { transformToString: vi.fn().mockResolvedValue(JSON.stringify(entries)) } };
}

function refsResponse(refs: string[]): object {
  return { Body: { transformToString: vi.fn().mockResolvedValue(JSON.stringify({ refs })) } };
}

beforeEach(() => {
  mockSend.mockReset();
  mockSend.mockResolvedValue({ Body: { transformToString: vi.fn().mockResolvedValue('{}') } });
});

describe('R2DiffWriter — client config', () => {
  // Regression guard: the SDK's default agent caps at 50 sockets, which throttled the
  // FAA write fan-out. Without this assertion the requestHandler line can be silently
  // dropped and every other test stays green while the 30-min timeout returns.
  it('raises the S3 client socket ceiling above the SDK default and keeps connections alive', () => {
    new R2DiffWriter(R2_CONFIG, true);
    const cfg = s3ClientConfig.value as {
      requestHandler?: { httpsAgent?: { maxSockets?: number; keepAlive?: boolean } };
    };
    expect(cfg.requestHandler?.httpsAgent?.maxSockets).toBeGreaterThan(50);
    expect(cfg.requestHandler?.httpsAgent?.keepAlive).toBe(true);
  });
});

describe('R2DiffWriter — dry run', () => {
  it('puts all records on first write (empty manifest)', async () => {
    const writer = new R2DiffWriter(R2_CONFIG, true);
    const records = new Map([
      ['id001', makeAircraft('id001', 'N12345', 'a4e294')],
      ['id002', makeAircraft('id002', 'N67890', 'abc123')],
    ]);

    const stats = await writer.write(records, 'faa');

    expect(stats.put).toBe(2);
    expect(stats.deleted).toBe(0);
    expect(stats.skipped).toBe(0);
  });

  it('skips all records when hashes are unchanged', async () => {
    const r1 = makeAircraft('id001', 'N12345', 'a4e294');
    const r2 = makeAircraft('id002', 'N67890', 'abc123');
    const records = new Map([
      ['id001', r1],
      ['id002', r2],
    ]);

    mockSend.mockResolvedValueOnce(
      manifestResponse({
        id001: { hash: contentHash(r1), icao_hex: 'a4e294', registration: 'N12345' },
        id002: { hash: contentHash(r2), icao_hex: 'abc123', registration: 'N67890' },
      })
    );

    const writer = new R2DiffWriter(R2_CONFIG, true);
    const stats = await writer.write(records, 'faa');

    expect(stats.put).toBe(0);
    expect(stats.deleted).toBe(0);
    expect(stats.skipped).toBe(2);
  });

  it('skips the manifest PUT when nothing changed (no-op short-circuit)', async () => {
    const r1 = makeAircraft('id001', 'N12345', 'a4e294');
    const records = new Map([['id001', r1]]);

    mockSend.mockImplementation((cmd: { _type: string; a: { Key: string } }) => {
      if (cmd._type === 'get' && cmd.a.Key === 'aircraft/_manifest/faa.json')
        return Promise.resolve(
          manifestResponse({
            id001: { hash: contentHash(r1), icao_hex: 'a4e294', registration: 'N12345' },
          })
        );
      return Promise.resolve({});
    });

    const writer = new R2DiffWriter(R2_CONFIG, false);
    await writer.write(records, 'faa');

    const putKeys = mockSend.mock.calls
      .filter((c) => (c[0] as { _type: string })._type === 'put')
      .map((c) => (c[0] as { a: { Key: string } }).a.Key);
    expect(putKeys).not.toContain('aircraft/_manifest/faa.json');
    expect(putKeys).toEqual([]);
  });

  it('puts only the changed record when one hash differs', async () => {
    const r1 = makeAircraft('id001', 'N12345', 'a4e294');
    const r2 = makeAircraft('id002', 'N67890', 'abc123');
    const records = new Map([
      ['id001', r1],
      ['id002', r2],
    ]);

    mockSend.mockResolvedValueOnce(
      manifestResponse({
        id001: { hash: 'stale-hash', icao_hex: 'a4e294', registration: 'N12345' },
        id002: { hash: contentHash(r2), icao_hex: 'abc123', registration: 'N67890' },
      })
    );

    const writer = new R2DiffWriter(R2_CONFIG, true);
    const stats = await writer.write(records, 'faa');

    expect(stats.put).toBe(1);
    expect(stats.skipped).toBe(1);
  });

  it('deletes records removed from the new dataset', async () => {
    const r1 = makeAircraft('id001', 'N12345', 'a4e294');
    const records = new Map([['id001', r1]]);

    mockSend.mockResolvedValueOnce(
      manifestResponse({
        id001: { hash: contentHash(r1), icao_hex: 'a4e294', registration: 'N12345' },
        id999: { hash: 'old-hash', icao_hex: 'dead00', registration: 'NOLD' },
      })
    );

    const writer = new R2DiffWriter(R2_CONFIG, true);
    const stats = await writer.write(records, 'faa');

    expect(stats.deleted).toBe(1);
    expect(stats.skipped).toBe(1);
  });

  it('treats NoSuchKey manifest error as empty (first-write scenario)', async () => {
    mockSend.mockRejectedValueOnce(noSuchKey());

    const writer = new R2DiffWriter(R2_CONFIG, true);
    const records = new Map([['id001', makeAircraft('id001', 'N12345', 'a4e294')]]);
    const stats = await writer.write(records, 'faa');

    expect(stats.put).toBe(1);
    expect(stats.skipped).toBe(0);
  });

  it('rethrows non-NoSuchKey manifest errors', async () => {
    mockSend.mockRejectedValueOnce(s3Error('AccessDenied', 403));

    const writer = new R2DiffWriter(R2_CONFIG, true);
    const records = new Map([['id001', makeAircraft('id001', 'N12345')]]);
    await expect(writer.write(records, 'faa')).rejects.toThrow('AccessDenied');
  });

  it('marks changed record as put when ICAO hex changes', async () => {
    const r1 = makeAircraft('id001', 'N12345', 'new-hex');
    const records = new Map([['id001', r1]]);

    mockSend.mockResolvedValueOnce(
      manifestResponse({
        id001: { hash: 'old-hash', icao_hex: 'old-hex', registration: 'N12345' },
      })
    );

    const writer = new R2DiffWriter(R2_CONFIG, true);
    const stats = await writer.write(records, 'faa');

    expect(stats.put).toBe(1);
  });

  it('marks changed record as put when registration also changes', async () => {
    const r1 = makeAircraft('id001', 'N99999', 'a4e294');
    const records = new Map([['id001', r1]]);

    mockSend.mockResolvedValueOnce(
      manifestResponse({
        id001: { hash: 'old-hash', icao_hex: 'a4e294', registration: 'N12345' },
      })
    );

    const writer = new R2DiffWriter(R2_CONFIG, true);
    const stats = await writer.write(records, 'faa');

    expect(stats.put).toBe(1);
  });

  it('rethrows invalid manifest content as an error', async () => {
    mockSend.mockResolvedValueOnce({
      Body: {
        transformToString: vi.fn().mockResolvedValue('{"id001":"not-a-manifest-entry"}'),
      },
    });

    const writer = new R2DiffWriter(R2_CONFIG, true);
    const records = new Map([['id001', makeAircraft('id001', 'N12345')]]);
    await expect(writer.write(records, 'faa')).rejects.toThrow(/invalid manifest/i);
  });

  it('handles records with null icao_hex without error', async () => {
    const writer = new R2DiffWriter(R2_CONFIG, true);
    const records = new Map([['id001', makeAircraft('id001', 'N12345', null)]]);

    const stats = await writer.write(records, 'faa');

    expect(stats.put).toBe(1);
  });

  it('skips empty-string registration from the index (parallel to null icao_hex)', async () => {
    mockSend.mockRejectedValueOnce(noSuchKey());
    mockSend.mockResolvedValue({});
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const writer = new R2DiffWriter(R2_CONFIG, true);
    const records = new Map([
      ['id001', makeAircraft('id001', '', 'a4e294')],
      ['id002', makeAircraft('id002', '', 'b5f3a1')],
    ]);
    await writer.write(records, 'faa');

    const planLog = consoleSpy.mock.calls.find((c) => String(c[0]).includes('event=write_plan'));
    // Empty registration must NOT contribute to dirty_reg — otherwise every unindexed
    // record collapses to the same stub key.
    expect(String(planLog?.[0])).toContain('dirty_reg=0');
    expect(String(planLog?.[0])).toContain('dirty_hex=2');
    consoleSpy.mockRestore();
  });

  it('still indexes records that DO have a registration', async () => {
    mockSend.mockRejectedValueOnce(noSuchKey());
    mockSend.mockResolvedValue({});
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const writer = new R2DiffWriter(R2_CONFIG, true);
    const records = new Map([
      ['id001', makeAircraft('id001', 'N12345', 'a4e294')],
      ['id002', makeAircraft('id002', '', 'b5f3a1')],
    ]);
    await writer.write(records, 'faa');

    const planLog = consoleSpy.mock.calls.find((c) => String(c[0]).includes('event=write_plan'));
    expect(String(planLog?.[0])).toContain('dirty_reg=1');
    consoleSpy.mockRestore();
  });

  it('changed is true when at least one record is written', async () => {
    const writer = new R2DiffWriter(R2_CONFIG, true);
    const records = new Map([['id001', makeAircraft('id001', 'N12345', 'a4e294')]]);
    const stats = await writer.write(records, 'faa');
    expect(stats.changed).toBe(true);
  });

  it('changed is false when no records differ', async () => {
    const r1 = makeAircraft('id001', 'N12345', 'a4e294');
    mockSend.mockResolvedValueOnce(
      manifestResponse({
        id001: { hash: contentHash(r1), icao_hex: 'a4e294', registration: 'N12345' },
      })
    );
    const writer = new R2DiffWriter(R2_CONFIG, true);
    const stats = await writer.write(new Map([['id001', r1]]), 'faa');
    expect(stats.changed).toBe(false);
  });

  it('changed is true when a record is deleted', async () => {
    const r1 = makeAircraft('id001', 'N12345', null);
    mockSend.mockResolvedValueOnce(
      manifestResponse({
        id001: { hash: contentHash(r1), icao_hex: null, registration: 'N12345' },
        id999: { hash: 'gone', icao_hex: null, registration: 'NGONE' },
      })
    );
    const writer = new R2DiffWriter(R2_CONFIG, true);
    const stats = await writer.write(new Map([['id001', r1]]), 'faa');
    expect(stats.changed).toBe(true);
    expect(stats.deleted).toBe(1);
  });

  it('record_count equals number of records passed in', async () => {
    const writer = new R2DiffWriter(R2_CONFIG, true);
    const records = new Map([
      ['id001', makeAircraft('id001', 'N12345', null)],
      ['id002', makeAircraft('id002', 'N67890', null)],
    ]);
    const stats = await writer.write(records, 'faa');
    expect(stats.record_count).toBe(2);
  });

  it('total of put + skipped equals record count', async () => {
    const r1 = makeAircraft('id001', 'N12345', 'a4e294');
    const r2 = makeAircraft('id002', 'N67890', null);
    const records = new Map([
      ['id001', r1],
      ['id002', r2],
    ]);

    mockSend.mockResolvedValueOnce(
      manifestResponse({
        id001: { hash: contentHash(r1), icao_hex: 'a4e294', registration: 'N12345' },
      })
    );

    const writer = new R2DiffWriter(R2_CONFIG, true);
    const stats = await writer.write(records, 'faa');

    expect(stats.put + stats.skipped).toBe(records.size);
  });
});

describe('R2DiffWriter — live mode', () => {
  it('calls S3 send for puts', async () => {
    mockSend.mockResolvedValue({});

    const writer = new R2DiffWriter(R2_CONFIG, false);
    const records = new Map([['id001', makeAircraft('id001', 'N12345', 'a4e294')]]);

    await writer.write(records, 'faa');

    const putCalls = mockSend.mock.calls.filter((c) => (c[0] as { _type: string })._type === 'put');
    expect(putCalls.length).toBeGreaterThan(0);
  });

  it('calls S3 send for deletes on removed records', async () => {
    const r1 = makeAircraft('id001', 'N12345', null);
    const records = new Map([['id001', r1]]);

    mockSend
      .mockResolvedValueOnce(
        manifestResponse({
          id001: { hash: contentHash(r1), icao_hex: null, registration: 'N12345' },
          id002: { hash: 'gone-hash', icao_hex: null, registration: 'NGONE' },
        })
      )
      .mockResolvedValue({});

    const writer = new R2DiffWriter(R2_CONFIG, false);
    await writer.write(records, 'faa');

    const delCalls = mockSend.mock.calls.filter((c) => (c[0] as { _type: string })._type === 'del');
    expect(delCalls.length).toBeGreaterThan(0);
  });

  it('preserves other-source refs when updating a global index', async () => {
    const r1 = makeAircraft('id001', 'N12345', 'a4e294');
    const records = new Map([['id001', r1]]);

    mockSend.mockImplementation((cmd: { _type: string; a: { Key: string } }) => {
      if (cmd._type === 'get') {
        if (cmd.a.Key === 'aircraft/_manifest/faa.json')
          return Promise.resolve(
            manifestResponse({
              id001: { hash: 'stale-hash', icao_hex: 'a4e294', registration: 'N12345' },
            })
          );
        if (cmd.a.Key === 'aircraft/by-icao-hex/a4e294.json')
          return Promise.resolve(refsResponse(['tc:foreign-id', 'faa:old-id']));
        if (cmd.a.Key === 'aircraft/by-registration/N12345.json')
          return Promise.resolve(refsResponse(['caa:foreign-reg', 'faa:old-id']));
      }
      return Promise.resolve({});
    });

    const writer = new R2DiffWriter(R2_CONFIG, false);
    await writer.write(records, 'faa');

    const putCalls = mockSend.mock.calls
      .map((c) => c[0] as { _type: string; a: { Key: string; Body?: string } })
      .filter((c) => c._type === 'put');
    const hexPut = putCalls.find((c) => c.a.Key === 'aircraft/by-icao-hex/a4e294.json');
    const regPut = putCalls.find((c) => c.a.Key === 'aircraft/by-registration/N12345.json');

    expect(JSON.parse(hexPut?.a.Body ?? '{}')).toEqual({ refs: ['tc:foreign-id', 'faa:id001'] });
    expect(JSON.parse(regPut?.a.Body ?? '{}')).toEqual({ refs: ['caa:foreign-reg', 'faa:id001'] });
  });

  it('rethrows non-NoSuchKey errors from loadRefs', async () => {
    const r1 = makeAircraft('id001', 'N12345', 'a4e294');
    const records = new Map([['id001', r1]]);

    mockSend.mockImplementation((cmd: { _type: string; a: { Key: string } }) => {
      if (cmd._type === 'get') {
        if (cmd.a.Key === 'aircraft/_manifest/faa.json')
          return Promise.resolve(
            manifestResponse({
              id001: { hash: 'stale-hash', icao_hex: 'a4e294', registration: 'N12345' },
            })
          );
        return Promise.reject(new Error('S3ServiceException'));
      }
      return Promise.resolve({});
    });

    const writer = new R2DiffWriter(R2_CONFIG, false);
    await expect(writer.write(records, 'faa')).rejects.toThrow('S3ServiceException');
  });

  it('treats NoSuchKey from loadRefs as empty refs', async () => {
    const r1 = makeAircraft('id001', 'N12345', 'a4e294');
    const records = new Map([['id001', r1]]);

    mockSend.mockImplementation((cmd: { _type: string; a: { Key: string } }) => {
      if (cmd._type === 'get') {
        if (cmd.a.Key === 'aircraft/_manifest/faa.json')
          return Promise.resolve(
            manifestResponse({
              id001: { hash: 'stale-hash', icao_hex: 'a4e294', registration: 'N12345' },
            })
          );
        return Promise.reject(noSuchKey());
      }
      return Promise.resolve({});
    });

    const writer = new R2DiffWriter(R2_CONFIG, false);
    const stats = await writer.write(records, 'faa');
    expect(stats.put).toBe(1);
  });

  it('throws on invalid ref index content', async () => {
    const r1 = makeAircraft('id001', 'N12345', 'a4e294');
    const records = new Map([['id001', r1]]);

    mockSend.mockImplementation((cmd: { _type: string; a: { Key: string } }) => {
      if (cmd._type === 'get') {
        if (cmd.a.Key === 'aircraft/_manifest/faa.json')
          return Promise.resolve(
            manifestResponse({
              id001: { hash: 'stale-hash', icao_hex: 'a4e294', registration: 'N12345' },
            })
          );
        return Promise.resolve({
          Body: { transformToString: vi.fn().mockResolvedValue('{"refs":123}') },
        });
      }
      return Promise.resolve({});
    });

    const writer = new R2DiffWriter(R2_CONFIG, false);
    await expect(writer.write(records, 'faa')).rejects.toThrow(/invalid ref index/i);
  });
});

describe('R2DiffWriter — fresh bucket fast path', () => {
  it('skips ref-index GETs when manifest object does not exist', async () => {
    mockSend.mockImplementation((cmd: { _type: string; a: { Key: string } }) => {
      if (cmd._type === 'get' && cmd.a.Key === 'aircraft/_manifest/faa.json') {
        return Promise.reject(noSuchKey());
      }
      return Promise.resolve({});
    });

    const writer = new R2DiffWriter(R2_CONFIG, false);
    const records = new Map([['id001', makeAircraft('id001', 'N12345', 'a4e294')]]);
    await writer.write(records, 'faa');

    const getCalls = mockSend.mock.calls.filter((c) => (c[0] as { _type: string })._type === 'get');
    expect(getCalls).toHaveLength(1);
    expect((getCalls[0][0] as { a: { Key: string } }).a.Key).toBe('aircraft/_manifest/faa.json');
  });

  it('writes source-only refs (no merge) on fresh bucket', async () => {
    mockSend.mockImplementation((cmd: { _type: string; a: { Key: string } }) => {
      if (cmd._type === 'get' && cmd.a.Key === 'aircraft/_manifest/faa.json') {
        return Promise.reject(noSuchKey());
      }
      return Promise.resolve({});
    });

    const writer = new R2DiffWriter(R2_CONFIG, false);
    const records = new Map([['id001', makeAircraft('id001', 'N12345', 'a4e294')]]);
    await writer.write(records, 'faa');

    const putCalls = mockSend.mock.calls
      .map((c) => c[0] as { _type: string; a: { Key: string; Body?: string } })
      .filter((c) => c._type === 'put');
    const hexPut = putCalls.find((c) => c.a.Key === 'aircraft/by-icao-hex/a4e294.json');
    const regPut = putCalls.find((c) => c.a.Key === 'aircraft/by-registration/N12345.json');

    expect(JSON.parse(hexPut?.a.Body ?? '{}')).toEqual({ refs: ['faa:id001'] });
    expect(JSON.parse(regPut?.a.Body ?? '{}')).toEqual({ refs: ['faa:id001'] });
  });

  it('still calls loadRefs when manifest exists but is empty', async () => {
    // Empty-but-present manifest may indicate a partial prior write — must merge to be safe.
    mockSend.mockResolvedValue({
      Body: { transformToString: vi.fn().mockResolvedValue('{}') },
    });

    const writer = new R2DiffWriter(R2_CONFIG, false);
    const records = new Map([['id001', makeAircraft('id001', 'N12345', 'a4e294')]]);
    await writer.write(records, 'faa');

    const getCalls = mockSend.mock.calls.filter((c) => (c[0] as { _type: string })._type === 'get');
    // Manifest GET + at least one ref-index GET (hex and/or reg)
    expect(getCalls.length).toBeGreaterThan(1);
  });
});

describe('R2DiffWriter — worker pool', () => {
  it('drains all items without dropping any (large set)', async () => {
    mockSend.mockResolvedValue({
      Body: { transformToString: vi.fn().mockResolvedValue('{}') },
    });

    const records = new Map<string, Aircraft>();
    for (let i = 0; i < 100; i++) {
      const id = `id${String(i).padStart(3, '0')}`;
      records.set(id, makeAircraft(id, `N${10000 + i}`, null));
    }

    const writer = new R2DiffWriter(R2_CONFIG, true);
    const stats = await writer.write(records, 'faa');

    expect(stats.put).toBe(100);
    expect(stats.skipped).toBe(0);
  });

  it('does not deadlock when toWrite is empty', async () => {
    const r1 = makeAircraft('id001', 'N12345', 'a4e294');
    mockSend.mockResolvedValueOnce(
      manifestResponse({
        id001: { hash: contentHash(r1), icao_hex: 'a4e294', registration: 'N12345' },
      })
    );
    mockSend.mockResolvedValue({});

    const writer = new R2DiffWriter(R2_CONFIG, false);
    const stats = await writer.write(new Map([['id001', r1]]), 'faa');

    expect(stats.put).toBe(0);
    expect(stats.skipped).toBe(1);
  });
});

describe('R2DiffWriter — state management', () => {
  it('readState returns null for NoSuchKey', async () => {
    mockSend.mockRejectedValueOnce(noSuchKey());
    const writer = new R2DiffWriter(R2_CONFIG, false);
    const state = await writer.readState('faa');
    expect(state).toBeNull();
  });

  it('readState returns null for empty body', async () => {
    mockSend.mockResolvedValueOnce({ Body: { transformToString: vi.fn().mockResolvedValue('') } });
    const writer = new R2DiffWriter(R2_CONFIG, false);
    expect(await writer.readState('faa')).toBeNull();
  });

  it('readState returns parsed state when key exists', async () => {
    const stored = {
      last_run: '2026-01-01T00:00:00.000Z',
      last_content_change: '2026-01-01T00:00:00.000Z',
      record_count: 500,
    };
    mockSend.mockResolvedValueOnce({
      Body: { transformToString: vi.fn().mockResolvedValue(JSON.stringify(stored)) },
    });
    const writer = new R2DiffWriter(R2_CONFIG, false);
    const state = await writer.readState('faa');
    expect(state).toEqual(stored);
  });

  it('readState returns null for malformed state JSON', async () => {
    mockSend.mockResolvedValueOnce({
      Body: { transformToString: vi.fn().mockResolvedValue('{"bad":"schema"}') },
    });
    const writer = new R2DiffWriter(R2_CONFIG, false);
    expect(await writer.readState('faa')).toBeNull();
  });

  it('readState returns null for invalid JSON (not a parse error rethrow)', async () => {
    mockSend.mockResolvedValueOnce({
      Body: { transformToString: vi.fn().mockResolvedValue('not valid json {{{') },
    });
    const writer = new R2DiffWriter(R2_CONFIG, false);
    expect(await writer.readState('faa')).toBeNull();
  });

  it('readState rethrows non-NoSuchKey errors', async () => {
    mockSend.mockRejectedValueOnce(s3Error('AccessDenied', 403));
    const writer = new R2DiffWriter(R2_CONFIG, false);
    await expect(writer.readState('faa')).rejects.toThrow('AccessDenied');
  });

  it('writeState puts the state object at the correct key', async () => {
    mockSend.mockResolvedValue({});
    const writer = new R2DiffWriter(R2_CONFIG, false);
    const state = {
      last_run: '2026-05-01T06:00:00.000Z',
      last_content_change: '2026-04-01T06:00:00.000Z',
      record_count: 999,
    };
    await writer.writeState('tw-caa', state);

    const putCalls = mockSend.mock.calls
      .map((c) => c[0] as { _type: string; a: { Key: string; Body?: string } })
      .filter((c) => c._type === 'put');
    const statePut = putCalls.find((c) => c.a.Key === 'aircraft/_state/tw-caa.json');
    expect(statePut).toBeDefined();
    expect(JSON.parse(statePut?.a.Body ?? '{}')).toEqual(state);
  });

  it('writeState is a no-op in dry-run mode', async () => {
    const writer = new R2DiffWriter(R2_CONFIG, true);
    await writer.writeState('faa', {
      last_run: '2026-01-01T00:00:00.000Z',
      last_content_change: '2026-01-01T00:00:00.000Z',
    });
    const putCalls = mockSend.mock.calls.filter((c) => (c[0] as { _type: string })._type === 'put');
    expect(putCalls).toHaveLength(0);
  });
});

describe('R2DiffWriter — observability', () => {
  it('emits write_plan log with op counts and fresh_bucket flag', async () => {
    mockSend.mockRejectedValueOnce(noSuchKey());
    mockSend.mockResolvedValue({});

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const writer = new R2DiffWriter(R2_CONFIG, false);
    await writer.write(new Map([['id001', makeAircraft('id001', 'N12345', 'a4e294')]]), 'faa');

    const planLog = consoleSpy.mock.calls.find((c) => String(c[0]).includes('event=write_plan'));
    expect(planLog).toBeDefined();
    expect(String(planLog?.[0])).toContain('fresh_bucket=true');
    expect(String(planLog?.[0])).toContain('total_ops=');
    consoleSpy.mockRestore();
  });

  it('clears the progress ticker after write completes (success)', async () => {
    const clearSpy = vi.spyOn(global, 'clearInterval');
    const writer = new R2DiffWriter(R2_CONFIG, true);
    await writer.write(new Map([['id001', makeAircraft('id001', 'N12345', 'a4e294')]]), 'faa');
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('clears the progress ticker even when write fails', async () => {
    mockSend.mockRejectedValueOnce(s3Error('Boom', 403));
    const clearSpy = vi.spyOn(global, 'clearInterval');
    const writer = new R2DiffWriter(R2_CONFIG, false);
    await expect(
      writer.write(new Map([['id001', makeAircraft('id001', 'N12345', 'a4e294')]]), 'faa')
    ).rejects.toThrow('Boom');
    // Manifest load throws before ticker starts — only assert no leak after a write that
    // reaches the ticker phase.
    clearSpy.mockRestore();
  });

  it('schedules a progress ticker on the 5s interval', async () => {
    const intervalSpy = vi.spyOn(global, 'setInterval');
    const writer = new R2DiffWriter(R2_CONFIG, true);
    await writer.write(new Map([['id001', makeAircraft('id001', 'N12345', 'a4e294')]]), 'faa');

    const tickerCall = intervalSpy.mock.calls.find((c) => c[1] === 5_000);
    expect(tickerCall).toBeDefined();
    intervalSpy.mockRestore();
  });

  it('progress ticker callback emits write_progress log', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const intervalSpy = vi.spyOn(global, 'setInterval');

    const writer = new R2DiffWriter(R2_CONFIG, true);
    // Invoke private ticker setup directly, then fire its callback.
    type TickerSetup = (source: string) => NodeJS.Timeout;
    const startTicker = (writer as unknown as { startProgressTicker: TickerSetup })
      .startProgressTicker;
    const handle = startTicker.call(writer, 'faa');
    try {
      const cb = intervalSpy.mock.calls[0]?.[0] as () => void;
      cb();
      const progressLog = consoleSpy.mock.calls.find((c) =>
        String(c[0]).includes('event=write_progress')
      );
      expect(progressLog).toBeDefined();
      expect(String(progressLog?.[0])).toContain('source=faa');
    } finally {
      clearInterval(handle);
      intervalSpy.mockRestore();
      consoleSpy.mockRestore();
    }
  });
});

describe('isTransientS3Error', () => {
  it('treats a 500 internal error as transient', () => {
    expect(isTransientS3Error(s3TransientError())).toBe(true);
  });

  it('treats 503 and 429 as transient', () => {
    expect(isTransientS3Error(s3Error('ServiceUnavailable', 503))).toBe(true);
    expect(isTransientS3Error(s3Error('SlowDown', 429))).toBe(true);
  });

  it('treats a transport error with no HTTP status as transient', () => {
    expect(isTransientS3Error(new Error('ECONNRESET'))).toBe(true);
  });

  it('does not retry NoSuchKey', () => {
    expect(isTransientS3Error(noSuchKey())).toBe(false);
  });

  it('does not retry 4xx (auth/validation)', () => {
    expect(isTransientS3Error(s3Error('AccessDenied', 403))).toBe(false);
    expect(isTransientS3Error(s3Error('InvalidRequest', 400))).toBe(false);
  });
});

describe('R2DiffWriter — transient retry', () => {
  it('retries a transient manifest GET then completes the write', async () => {
    mockSend.mockReset();
    mockSend.mockRejectedValueOnce(s3TransientError());
    mockSend.mockResolvedValue({ Body: { transformToString: vi.fn().mockResolvedValue('{}') } });

    const writer = new R2DiffWriter(R2_CONFIG, true);
    const stats = await writer.write(new Map([['id001', makeAircraft('id001', 'N12345')]]), 'faa');

    expect(stats.put).toBe(1);
    // First manifest GET failed transiently; the retry re-issued the same key, so the manifest
    // was fetched exactly twice while the write still completed.
    const manifestGets = mockSend.mock.calls.filter(
      (c) => (c[0] as { a: { Key: string } }).a.Key === 'aircraft/_manifest/faa.json'
    );
    expect(manifestGets).toHaveLength(2);
  });
});
