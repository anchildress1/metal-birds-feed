import { describe, it, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { createRateLimiter, makeRunQuery, serveRequest } from '../../src/service/serve-core.js';
import { buildFeedDb, toFeedRows } from '../../src/feed.js';
import type { Aircraft } from '../../src/schema.js';

const make = (id: string, hex: string): Aircraft =>
  ({
    source: 'faa',
    source_id: id,
    registration: `N${id}`,
    icao_hex: hex,
    icao_type_code: null,
    status: 'valid',
    country: 'US',
    manufacturer: 'CESSNA',
    model: '172',
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
  }) satisfies Aircraft;

const testDb = (): Database => Database.deserialize(buildFeedDb(toFeedRows([make('1', 'a1b2c3')])));

const post = (token: string | null, body: unknown): Request =>
  new Request('https://feed.local/feed', {
    method: 'POST',
    headers: token === null ? {} : { authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

describe('createRateLimiter', () => {
  it('allows up to the limit, then rejects within the window', async () => {
    const t = 1000;
    const check = createRateLimiter(2, 60_000, () => t);
    expect(await check()).toBe(true);
    expect(await check()).toBe(true);
    expect(await check()).toBe(false);
  });

  it('resets once the window elapses', async () => {
    let t = 0;
    const check = createRateLimiter(1, 1000, () => t);
    expect(await check()).toBe(true);
    expect(await check()).toBe(false);
    t = 1000;
    expect(await check()).toBe(true);
  });
});

describe('makeRunQuery', () => {
  it('runs the IN-query against the SQLite db', async () => {
    const db = testDb();
    try {
      const rows = await makeRunQuery(db)('SELECT * FROM feed WHERE icao_hex IN (?)', ['a1b2c3']);
      expect(rows[0]).toMatchObject({ icao_hex: 'a1b2c3', registration: 'N1' });
    } finally {
      db.close();
    }
  });
});

describe('serveRequest', () => {
  const pass = () => Promise.resolve(true);
  const withDb = async (req: Request, token = 'secret'): Promise<Response> => {
    const db = testDb();
    try {
      return await serveRequest(req, token, pass, makeRunQuery(db));
    } finally {
      db.close();
    }
  };

  it('returns the feed map for an authorized hit', async () => {
    const res = await withDb(post('secret', { hexes: ['a1b2c3'] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ a1b2c3: { registration: 'N1' } });
  });

  it('401s a wrong token', async () => {
    const req = new Request('https://feed.local/feed', {
      method: 'POST',
      headers: { authorization: 'Bearer nope' },
      body: 'x'.repeat(20_000),
    });
    const res = await withDb(req);
    expect(res.status).toBe(401);
  });

  it('429s when the limiter denies', async () => {
    const db = testDb();
    try {
      const res = await serveRequest(
        post('secret', { hexes: ['a1b2c3'] }),
        'secret',
        () => Promise.resolve(false),
        makeRunQuery(db)
      );
      expect(res.status).toBe(429);
    } finally {
      db.close();
    }
  });

  it('400s a body that is not valid JSON', async () => {
    const req = new Request('https://feed.local/feed', {
      method: 'POST',
      headers: { authorization: 'Bearer secret' },
      body: '{not json',
    });
    const res = await withDb(req);
    expect(res.status).toBe(400);
  });

  it('413s a body whose declared length exceeds the byte cap', async () => {
    const req = new Request('https://feed.local/feed', {
      method: 'POST',
      headers: { authorization: 'Bearer secret', 'content-length': '20000' },
      body: '{}',
    });

    const res = await withDb(req);

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'request body too large' });
  });

  it('413s a streamed body that exceeds the byte cap without a content-length header', async () => {
    const req = new Request('https://feed.local/feed', {
      method: 'POST',
      headers: { authorization: 'Bearer secret' },
      body: 'x'.repeat(20_000),
    });

    const res = await withDb(req);

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'request body too large' });
  });

  it('405s a GET', async () => {
    const req = new Request('https://feed.local/feed', {
      method: 'GET',
      headers: { authorization: 'Bearer secret' },
    });
    const res = await withDb(req);
    expect(res.status).toBe(405);
  });
});
