import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Aircraft } from '../src/schema.js';

const mockSend = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/client-s3', () => ({
  /* eslint-disable @typescript-eslint/no-explicit-any */
  S3Client: class {
    send: any = mockSend;
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

import { R2DiffWriter } from '../src/writer.js';
import { contentHash } from '../src/engine.js';
import { NoSuchKey } from '@aws-sdk/client-s3';

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
    certification_date: '1979-06-20',
    airworthiness_date: null,
    expiration_date: '2026-10-31',
    last_action_date: '2023-10-15',
    cruise_speed_ktas: 106,
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
    mockSend.mockRejectedValueOnce(new NoSuchKey());

    const writer = new R2DiffWriter(R2_CONFIG, true);
    const records = new Map([['id001', makeAircraft('id001', 'N12345', 'a4e294')]]);
    const stats = await writer.write(records, 'faa');

    expect(stats.put).toBe(1);
    expect(stats.skipped).toBe(0);
  });

  it('rethrows non-NoSuchKey manifest errors', async () => {
    mockSend.mockRejectedValueOnce(new Error('AccessDenied'));

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
        return Promise.reject(new NoSuchKey());
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
