import type { Database } from 'bun:sqlite';
import { route, type FeedRow, type RunQuery, type CheckLimit } from './handler.js';

// Fixed-window in-process limiter. The endpoint has a single legitimate consumer, so one global
// window is enough to cap a leaked token; `now` is injected for testability. Per-instance under
// scale-out (acceptable — the cap only needs to stop enumeration, not be globally exact).
export const createRateLimiter = (
  limit: number,
  windowMs: number,
  now: () => number
): CheckLimit => {
  let windowStart = now();
  let count = 0;
  return () => {
    const t = now();
    if (t - windowStart >= windowMs) {
      windowStart = t;
      count = 0;
    }
    count++;
    return Promise.resolve(count <= limit);
  };
};

// SQLite-backed query for the injected handler. bun:sqlite binds the spread params positionally into
// the `?` placeholders buildSelect emits.
export const makeRunQuery =
  (db: Database): RunQuery =>
  (sql, params) =>
    Promise.resolve(db.query(sql).all(...params) as FeedRow[]);

// Adapts a runtime Request to the pure router: read the body (best-effort JSON on POST), route, and
// serialize. Kept here (not in the Bun.serve entry) so it is unit-tested with a plain Request.
export const serveRequest = async (
  request: Request,
  token: string | undefined,
  checkLimit: CheckLimit,
  runQuery: RunQuery
): Promise<Response> => {
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
    token,
    body,
    checkLimit,
    runQuery
  );
  return Response.json(result.body, { status: result.status });
};
