import { describe, it, expect } from 'bun:test';
import {
  authorize,
  parseHexes,
  buildSelect,
  toResponseMap,
  route,
  HttpError,
  type EnrichmentRecord,
  type RunQuery,
  type CheckLimit,
} from '../../src/worker/handler.js';

const rec = (hex: string, reg: string): EnrichmentRecord => ({
  icao_hex: hex,
  registration: reg,
  airframe_type: null,
  manufacturer: 'CESSNA',
  model: '172',
  owner_name: null,
  owner_country: null,
  operator_name: null,
  status: 'valid',
});

const expectHttp = (fn: () => unknown, status: number): void => {
  try {
    fn();
    throw new Error('expected HttpError');
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(status);
  }
};

describe('authorize', () => {
  it('500s when no server token is configured', () => {
    expectHttp(() => authorize('Bearer x', undefined), 500);
  });

  it('401s on a mismatched token', () => {
    expectHttp(() => authorize('Bearer wrong', 'right'), 401);
  });

  it('401s on a missing header', () => {
    expectHttp(() => authorize(null, 'right'), 401);
  });

  it('passes on the exact bearer token', () => {
    expect(() => authorize('Bearer right', 'right')).not.toThrow();
  });
});

describe('parseHexes', () => {
  it('400s when hexes is not an array', () => {
    expectHttp(() => parseHexes({ hexes: 'a1b2c3' }), 400);
  });

  it('400s when body is null', () => {
    expectHttp(() => parseHexes(null), 400);
  });

  it('400s on a malformed hex', () => {
    expectHttp(() => parseHexes({ hexes: ['A1B2C3'] }), 400); // uppercase rejected
  });

  it('400s on a non-string element', () => {
    expectHttp(() => parseHexes({ hexes: [123456] }), 400);
  });

  it('400s past the max-hex cap', () => {
    const many = Array.from({ length: 501 }, (_, i) => i.toString(16).padStart(6, '0'));
    expectHttp(() => parseHexes({ hexes: many }), 400);
  });

  it('dedups repeated hexes', () => {
    expect(parseHexes({ hexes: ['a1b2c3', 'a1b2c3', '4d5e6f'] })).toEqual(['a1b2c3', '4d5e6f']);
  });

  it('accepts an empty array', () => {
    expect(parseHexes({ hexes: [] })).toEqual([]);
  });
});

describe('buildSelect', () => {
  it('emits one placeholder per hex', () => {
    expect(buildSelect(3)).toContain('IN (?, ?, ?)');
  });
});

describe('toResponseMap', () => {
  it('keys by hex and strips icao_hex from the value', () => {
    const map = toResponseMap([rec('a1b2c3', 'N1')]);
    expect(map['a1b2c3']).toMatchObject({ registration: 'N1' });
    expect(map['a1b2c3']).not.toHaveProperty('icao_hex');
  });
});

describe('route', () => {
  const ok: RunQuery = () => Promise.resolve([rec('a1b2c3', 'N1')]);
  const boom: RunQuery = () => Promise.reject(new Error('d1 down'));
  const pass: CheckLimit = () => Promise.resolve(true);
  const deny: CheckLimit = () => Promise.resolve(false);

  it('404s an unknown path', async () => {
    const res = await route('POST', '/other', 'Bearer t', 't', { hexes: [] }, pass, ok);
    expect(res.status).toBe(404);
  });

  it('405s a non-POST method', async () => {
    const res = await route('GET', '/enrich', 'Bearer t', 't', undefined, pass, ok);
    expect(res.status).toBe(405);
  });

  it('authorizes before routing — a bad token on any path is 401, not 404', async () => {
    const res = await route('POST', '/other', 'Bearer nope', 't', { hexes: ['a1b2c3'] }, pass, ok);
    expect(res.status).toBe(401);
  });

  it('401s before touching the body when auth fails', async () => {
    const res = await route('POST', '/enrich', 'Bearer nope', 't', { hexes: ['a1b2c3'] }, pass, ok);
    expect(res.status).toBe(401);
  });

  it('429s when the rate limit is exceeded, without querying', async () => {
    let called = false;
    const spy: RunQuery = () => {
      called = true;
      return Promise.resolve([]);
    };
    const res = await route('POST', '/enrich', 'Bearer t', 't', { hexes: ['a1b2c3'] }, deny, spy);
    expect(res.status).toBe(429);
    expect(called).toBe(false);
  });

  it('returns an empty map for zero hexes without querying', async () => {
    let called = false;
    const spy: RunQuery = () => {
      called = true;
      return Promise.resolve([]);
    };
    const res = await route('POST', '/enrich', 'Bearer t', 't', { hexes: [] }, pass, spy);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
    expect(called).toBe(false);
  });

  it('returns the enrichment map on a hit', async () => {
    const res = await route('POST', '/enrich', 'Bearer t', 't', { hexes: ['a1b2c3'] }, pass, ok);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ a1b2c3: { registration: 'N1' } });
  });

  it('collapses an unexpected query failure into a generic 500', async () => {
    const res = await route('POST', '/enrich', 'Bearer t', 't', { hexes: ['a1b2c3'] }, pass, boom);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'internal error' });
  });

  it('surfaces a 400 for a malformed body', async () => {
    const res = await route('POST', '/enrich', 'Bearer t', 't', { hexes: ['nope'] }, pass, ok);
    expect(res.status).toBe(400);
  });
});
