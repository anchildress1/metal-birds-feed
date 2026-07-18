import { describe, it, expect } from 'bun:test';
import { createFetch, type Env } from '../../src/worker/serve.js';

interface Row {
  icao_hex: string;
  registration: string;
  airframe_type: string | null;
  manufacturer: string | null;
  model: string | null;
  owner_name: string | null;
  owner_country: string | null;
  operator_name: string | null;
  status: string;
}

const row: Row = {
  icao_hex: 'a1b2c3',
  registration: 'N1',
  airframe_type: null,
  manufacturer: 'CESSNA',
  model: '172',
  owner_name: null,
  owner_country: null,
  operator_name: null,
  status: 'valid',
};

const makeEnv = (over: Partial<Env> = {}): Env => ({
  ENRICH_TOKEN: 'secret',
  DB: {
    prepare: () => ({
      bind: () => ({ all: <T>() => Promise.resolve({ results: [row] as unknown as T[] }) }),
    }),
  },
  RATE_LIMITER: { limit: () => Promise.resolve({ success: true }) },
  ...over,
});

const post = (token: string | null, body: unknown): Request =>
  new Request('https://enrich.example/enrich', {
    method: 'POST',
    headers: token === null ? {} : { authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

describe('createFetch', () => {
  it('returns the enrichment map for an authorized hit', async () => {
    const res = await createFetch(post('secret', { hexes: ['a1b2c3'] }), makeEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ a1b2c3: { registration: 'N1' } });
  });

  it('401s a wrong token', async () => {
    const res = await createFetch(post('wrong', { hexes: ['a1b2c3'] }), makeEnv());
    expect(res.status).toBe(401);
  });

  it('429s when the limiter denies the request', async () => {
    const env = makeEnv({ RATE_LIMITER: { limit: () => Promise.resolve({ success: false }) } });
    const res = await createFetch(post('secret', { hexes: ['a1b2c3'] }), env);
    expect(res.status).toBe(429);
  });

  it('405s a GET', async () => {
    const req = new Request('https://enrich.example/enrich', {
      method: 'GET',
      headers: { authorization: 'Bearer secret' },
    });
    const res = await createFetch(req, makeEnv());
    expect(res.status).toBe(405);
  });

  it('400s a body that is not valid JSON', async () => {
    const req = new Request('https://enrich.example/enrich', {
      method: 'POST',
      headers: { authorization: 'Bearer secret' },
      body: '{not json',
    });
    const res = await createFetch(req, makeEnv());
    expect(res.status).toBe(400);
  });
});
