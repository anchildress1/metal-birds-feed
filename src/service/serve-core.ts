import type { Database } from 'bun:sqlite';
import {
  HttpError,
  routeRequest,
  type FeedRow,
  type RunQuery,
  type CheckLimit,
} from './handler.js';

const MAX_BODY_BYTES = 16_384;

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

const readJsonBody = async (request: Request): Promise<unknown> => {
  if (request.body === null) return undefined;
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES)
    throw new HttpError(413, 'request body too large');

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = '';
  try {
    while (true) {
      // Sequential by design: each stream read depends on the previous chunk and enforces the cap
      // before retaining more request data.
      const result: unknown = await reader.read();
      if (typeof result !== 'object' || result === null)
        throw new Error('request body stream returned an invalid result');
      if (Reflect.get(result, 'done') === true) break;
      const chunk: unknown = Reflect.get(result, 'value');
      if (!(chunk instanceof Uint8Array))
        throw new Error('request body stream returned an invalid chunk');
      totalBytes += chunk.byteLength;
      if (totalBytes > MAX_BODY_BYTES) throw new HttpError(413, 'request body too large');
      text += decoder.decode(chunk, { stream: true });
    }
    text += decoder.decode();
  } finally {
    // Release the stream on every exit — a 413 cap breach or stream error would otherwise leave the
    // reader (and its underlying connection) open until GC. cancel() on a fully-drained stream is a
    // harmless no-op.
    await reader.cancel().catch(() => {});
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

// The router performs auth, route, method, and rate-limit checks before invoking the lazy body
// reader. The reader then applies a byte cap while streaming, so chunked requests cannot bypass it.
export const serveRequest = async (
  request: Request,
  token: string | undefined,
  checkLimit: CheckLimit,
  runQuery: RunQuery
): Promise<Response> => {
  const result = await routeRequest(
    request.method,
    new URL(request.url).pathname,
    request.headers.get('authorization'),
    token,
    () => readJsonBody(request),
    checkLimit,
    runQuery
  );
  return Response.json(result.body, { status: result.status });
};
