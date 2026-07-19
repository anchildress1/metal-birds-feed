// Pure request logic for the feed service, kept out of the Bun.serve runtime entry
// (src/service/server.ts) so it typechecks, lints, and is unit-tested in the main Bun suite. The
// server injects a SQLite-backed RunQuery and the rate-limit CheckLimit; the decisions live here.

import type { FeedRow } from '../feed-row.js';
import { attributionFor } from './attributions.js';

// Re-exported so the service + tests import the row shape from one place; the query is SELECT *, so
// FeedRow is the single typed description of a returned row.
export type { FeedRow };

// The descriptive slice as returned to the consumer: every FeedRow column except the hex key (which
// becomes the map key), plus the source's exact attribution line so the caller renders credit
// verbatim without holding its own source→notice map.
export type FeedResponseRow = Omit<FeedRow, 'icao_hex'> & { attribution: string };

const HEX_RE = /^[0-9a-f]{6}$/;
const MAX_HEXES = 500;

export type RunQuery = (sql: string, params: string[]) => Promise<FeedRow[]>;
export type CheckLimit = () => Promise<boolean>;
export type LoadBody = () => Promise<unknown>;

export interface RouteResult {
  status: number;
  body: unknown;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

// Length-independent compare over the full string so a valid-vs-invalid token can't be
// distinguished by response timing. The length check leaks only the token length, which is fixed
// and not itself the secret.
const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  // Indices are always in range (equal lengths, i < length), so codePointAt never returns
  // undefined; the ?? 0 only satisfies the type.
  for (let i = 0; i < a.length; i++) mismatch |= (a.codePointAt(i) ?? 0) ^ (b.codePointAt(i) ?? 0);
  return mismatch === 0;
};

// Single-consumer private endpoint: a shared UUID bearer secret is the whole gate. A missing
// server-side token is a 500 (misconfiguration), never an open door.
export const authorize = (header: string | null, token: string | undefined): void => {
  if (!token) throw new HttpError(500, 'server misconfigured');
  if (header === null || !timingSafeEqual(header, `Bearer ${token}`))
    throw new HttpError(401, 'unauthorized');
};

// Rejects the whole request on any malformed hex rather than silently dropping bad entries — a
// caller sending garbage should learn, not get a quietly-partial map. Dedups before the cap so a
// payload of repeated hexes is measured by its unique count, and the IN-list stays minimal.
export const parseHexes = (body: unknown): string[] => {
  const raw = (body as { hexes?: unknown } | null)?.hexes;
  if (!Array.isArray(raw)) throw new HttpError(400, 'hexes must be an array');
  const deduped = [...new Set(raw)];
  if (deduped.length > MAX_HEXES) throw new HttpError(400, `too many hexes (max ${MAX_HEXES})`);
  for (const h of deduped) {
    if (typeof h !== 'string' || !HEX_RE.test(h))
      throw new HttpError(400, 'each hex must be 6 lowercase hex characters');
  }
  return deduped as string[];
};

export const buildSelect = (count: number): string =>
  `SELECT * FROM feed WHERE icao_hex IN (${Array.from({ length: count }, () => '?').join(', ')})`;

export const toResponseMap = (rows: FeedRow[]): Record<string, FeedResponseRow> => {
  const out: Record<string, FeedResponseRow> = {};
  for (const { icao_hex, ...rest } of rows)
    out[icao_hex] = { ...rest, attribution: attributionFor(rest.source) };
  return out;
};

const handleFeed = async (
  method: string,
  path: string,
  authHeader: string | null,
  token: string | undefined,
  loadBody: LoadBody,
  checkLimit: CheckLimit,
  runQuery: RunQuery
): Promise<RouteResult> => {
  // Auth first, before routing, so an unauthenticated probe can't map the route surface. Rate limit
  // runs only after a valid token hits the real endpoint, so an unauthenticated flood can't drain
  // the shared budget out from under the legitimate consumer.
  authorize(authHeader, token);
  if (path !== '/feed') throw new HttpError(404, 'not found');
  if (method !== 'POST') throw new HttpError(405, 'method not allowed');
  if (!(await checkLimit())) throw new HttpError(429, 'rate limited');
  const hexes = parseHexes(await loadBody());
  if (hexes.length === 0) return { status: 200, body: {} };
  // SQLite's variable limit (>=999) comfortably exceeds MAX_HEXES, so one IN-query suffices — no
  // chunking (unlike D1's 100-parameter cap).
  const rows = await runQuery(buildSelect(hexes.length), hexes);
  return { status: 200, body: toResponseMap(rows) };
};

// The single entry server.ts calls. Converts thrown HttpErrors into status codes and swallows
// anything unexpected as a generic 500 so a stack trace never reaches the caller.
export const routeRequest = async (
  method: string,
  path: string,
  authHeader: string | null,
  token: string | undefined,
  loadBody: LoadBody,
  checkLimit: CheckLimit,
  runQuery: RunQuery
): Promise<RouteResult> => {
  try {
    return await handleFeed(method, path, authHeader, token, loadBody, checkLimit, runQuery);
  } catch (err) {
    if (err instanceof HttpError) return { status: err.status, body: { error: err.message } };
    // Log server-side (Cloud Run captures stderr) so an unexpected failure is diagnosable; the
    // caller still gets only a generic 500, never a stack trace.
    console.error('feed request failed', err);
    return { status: 500, body: { error: 'internal error' } };
  }
};

// Convenience wrapper for callers and unit tests that already hold a parsed body.
export const route = (
  method: string,
  path: string,
  authHeader: string | null,
  token: string | undefined,
  body: unknown,
  checkLimit: CheckLimit,
  runQuery: RunQuery
): Promise<RouteResult> =>
  routeRequest(method, path, authHeader, token, () => Promise.resolve(body), checkLimit, runQuery);
