import { describe, it, expect, mock } from 'bun:test';
import {
  authorize,
  parseHexes,
  buildSelect,
  toResponseMap,
  routeRequest,
  HttpError,
  type FeedRow,
  type RunQuery,
  type CheckLimit,
  type RouteResult,
} from '../../src/service/handler.js';

const rec = (hex: string, reg: string): FeedRow => ({
  icao_hex: hex,
  registration: reg,
  registration_key: reg.toUpperCase().replace(/[^A-Z0-9]/g, ''),
  icao_type_code: null,
  status: 'valid',
  country: 'US',
  manufacturer: 'CESSNA',
  model: '172',
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
});

// Test-only convenience over routeRequest for the many cases that already hold a parsed body.
const route = (
  method: string,
  path: string,
  authHeader: string | null,
  token: string | undefined,
  body: unknown,
  checkLimit: CheckLimit,
  runQuery: RunQuery
): Promise<RouteResult> =>
  routeRequest(method, path, authHeader, token, () => Promise.resolve(body), checkLimit, runQuery);

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

  it("attaches the source's exact attribution line to each row", () => {
    const map = toResponseMap([rec('a1b2c3', 'N1')]); // rec() is source 'faa'
    expect(map['a1b2c3'].attribution).toContain('Federal Aviation Administration (FAA)');
  });

  it('composes display-ready type and engine so the consumer never joins columns itself', () => {
    const map = toResponseMap([rec('a1b2c3', 'N1')]); // rec() is CESSNA / 172, no engine columns
    expect(map['a1b2c3'].type).toBe('CESSNA 172');
    expect(map['a1b2c3'].engine).toBeNull();
  });

  it('drops the maker when the model already leads with it (CAAS free-text models)', () => {
    const row: FeedRow = {
      ...rec('a1b2c3', 'N1'),
      manufacturer: 'Cessna',
      model: 'CESSNA 172N',
      engine_manufacturer: 'Lycoming',
      engine_model: 'Lycoming O-320-H',
    };
    const map = toResponseMap([row]);
    expect(map['a1b2c3'].type).toBe('CESSNA 172N');
    expect(map['a1b2c3'].engine).toBe('Lycoming O-320-H');
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
    const res = await route('GET', '/feed', 'Bearer t', 't', undefined, pass, ok);
    expect(res.status).toBe(405);
  });

  it('authorizes before routing — a bad token on any path is 401, not 404', async () => {
    const res = await route('POST', '/other', 'Bearer nope', 't', { hexes: ['a1b2c3'] }, pass, ok);
    expect(res.status).toBe(401);
  });

  it('401s before touching the body when auth fails', async () => {
    const res = await route('POST', '/feed', 'Bearer nope', 't', { hexes: ['a1b2c3'] }, pass, ok);
    expect(res.status).toBe(401);
  });

  it('429s when the rate limit is exceeded, without querying', async () => {
    let called = false;
    const spy: RunQuery = () => {
      called = true;
      return Promise.resolve([]);
    };
    const res = await route('POST', '/feed', 'Bearer t', 't', { hexes: ['a1b2c3'] }, deny, spy);
    expect(res.status).toBe(429);
    expect(called).toBe(false);
  });

  it('returns an empty map for zero hexes without querying', async () => {
    let called = false;
    const spy: RunQuery = () => {
      called = true;
      return Promise.resolve([]);
    };
    const res = await route('POST', '/feed', 'Bearer t', 't', { hexes: [] }, pass, spy);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
    expect(called).toBe(false);
  });

  it('returns the feed map on a hit', async () => {
    const res = await route('POST', '/feed', 'Bearer t', 't', { hexes: ['a1b2c3'] }, pass, ok);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ a1b2c3: { registration: 'N1' } });
  });

  it('queries all hexes in a single IN-query and returns the merged map', async () => {
    const hexes = Array.from({ length: 250 }, (_, i) => i.toString(16).padStart(6, '0'));
    const calls: number[] = [];
    const query: RunQuery = (_sql, params) => {
      calls.push(params.length);
      return Promise.resolve(params.map((h) => rec(h, `N-${h}`)));
    };
    const res = await route('POST', '/feed', 'Bearer t', 't', { hexes }, pass, query);
    expect(res.status).toBe(200);
    expect(calls).toEqual([250]); // one query — SQLite handles the full IN-list
    expect(Object.keys(res.body as object)).toHaveLength(250);
  });

  it('collapses an unexpected query failure into a generic 500', async () => {
    const res = await route('POST', '/feed', 'Bearer t', 't', { hexes: ['a1b2c3'] }, pass, boom);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'internal error' });
  });

  it('surfaces a 400 for a malformed body', async () => {
    const res = await route('POST', '/feed', 'Bearer t', 't', { hexes: ['nope'] }, pass, ok);
    expect(res.status).toBe(400);
  });

  it.each([
    { label: 'bad auth', method: 'POST', path: '/feed', header: 'Bearer nope', limit: pass },
    { label: 'wrong method', method: 'GET', path: '/feed', header: 'Bearer t', limit: pass },
    { label: 'rate limited', method: 'POST', path: '/feed', header: 'Bearer t', limit: deny },
  ])('does not load the body when request preflight fails: $label', async (input) => {
    const loadBody = mock(() => Promise.resolve({ hexes: ['a1b2c3'] }));

    await routeRequest(input.method, input.path, input.header, 't', loadBody, input.limit, ok);

    expect(loadBody).not.toHaveBeenCalled();
  });

  it('loads the body once after request preflight succeeds', async () => {
    const loadBody = mock(() => Promise.resolve({ hexes: ['a1b2c3'] }));

    const res = await routeRequest('POST', '/feed', 'Bearer t', 't', loadBody, pass, ok);

    expect(res.status).toBe(200);
    expect(loadBody).toHaveBeenCalledTimes(1);
  });
});

describe('/feed/registration', () => {
  const ok: RunQuery = () => Promise.resolve([rec('a1b2c3', 'C-FABC')]);
  const call = (body: unknown) =>
    routeRequest(
      'POST',
      '/feed/registration',
      'Bearer t',
      't',
      () => Promise.resolve(body),
      () => Promise.resolve(true),
      ok
    );

  it('keys the response by the normalized registration, not the hex', async () => {
    const res = await call({ registrations: ['C-FABC'] });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body as object)).toEqual(['CFABC']);
  });

  it('accepts any punctuation the caller happens to have', async () => {
    for (const sent of ['C-FABC', 'c fabc', 'CFABC', 'c-fabc']) {
      const res = await call({ registrations: [sent] });
      expect(Object.keys(res.body as object)).toEqual(['CFABC']);
    }
  });

  it('returns the hex on a registration lookup, since the caller keyed by something else', async () => {
    const res = await call({ registrations: ['C-FABC'] });
    expect((res.body as Record<string, { icao_hex?: string }>)['CFABC']?.icao_hex).toBe('a1b2c3');
  });

  it('never leaks the internal key into the payload', async () => {
    const res = await call({ registrations: ['C-FABC'] });
    expect(JSON.stringify(res.body)).not.toContain('registration_key');
  });

  it('rejects the whole request on a value that cannot be a mark', async () => {
    expect((await call({ registrations: ['C-FABC', '!'] })).status).toBe(400);
    expect((await call({ registrations: 'C-FABC' })).status).toBe(400);
  });

  it('still 404s an unknown path', async () => {
    const res = await routeRequest(
      'POST',
      '/feed/nope',
      'Bearer t',
      't',
      () => Promise.resolve({}),
      () => Promise.resolve(true),
      ok
    );
    expect(res.status).toBe(404);
  });
});
