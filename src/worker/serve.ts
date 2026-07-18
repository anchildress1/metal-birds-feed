import { route, type EnrichmentRecord } from './handler.js';

// Structural mirrors of the Cloudflare bindings this Worker uses, so the fetch orchestration
// typechecks and unit-tests in the main Bun suite without pulling @cloudflare/workers-types into the
// root project. The real D1Database and RateLimit bindings satisfy these shapes at deploy time.
export interface D1PreparedLike {
  bind(...params: string[]): { all<T>(): Promise<{ results: T[] }> };
}
export interface D1Like {
  prepare(sql: string): D1PreparedLike;
}
export interface RateLimitLike {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}
export interface Env {
  DB: D1Like;
  ENRICH_TOKEN: string;
  RATE_LIMITER: RateLimitLike;
}

// One shared key: the endpoint has a single legitimate consumer, so the cap is global and a leaked
// token can't outrun it by varying a per-caller key.
const RATE_LIMIT_KEY = 'enrich';

export const createFetch = async (request: Request, env: Env): Promise<Response> => {
  const runQuery = async (sql: string, params: string[]): Promise<EnrichmentRecord[]> => {
    const { results } = await env.DB.prepare(sql)
      .bind(...params)
      .all<EnrichmentRecord>();
    return results;
  };
  const checkLimit = async (): Promise<boolean> =>
    (await env.RATE_LIMITER.limit({ key: RATE_LIMIT_KEY })).success;

  let body: unknown;
  if (request.method === 'POST') {
    try {
      body = await request.json();
    } catch {
      body = undefined;
    }
  }

  const result = await route(
    request.method,
    new URL(request.url).pathname,
    request.headers.get('authorization'),
    env.ENRICH_TOKEN,
    body,
    checkLimit,
    runQuery
  );
  return Response.json(result.body, { status: result.status });
};
