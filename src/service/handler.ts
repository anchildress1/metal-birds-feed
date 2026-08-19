// Pure request logic for the feed service, kept out of the Bun.serve runtime entry
// (src/service/server.ts) so it typechecks, lints, and is unit-tested in the main Bun suite. The
// server injects a SQLite-backed RunQuery and the rate-limit CheckLimit; the decisions live here.

import type { FeedRow } from '../feed-row.js';
import { registrationKey, REGISTRATION_KEY_RE } from '../registration.js';
import { attributionFor } from './attributions.js';

// Re-exported so the service + tests import the row shape from one place; the query is SELECT *, so
// FeedRow is the single typed description of a returned row.
export type { FeedRow };

// Carries the extra fields so the consumer renders directly and never joins columns or keeps its own
// source→notice map: `type`/`engine` are the display-ready maker+model strings, `attribution` the
// credit line from the attributions module. The rest is the FeedRow minus the hex map key.
// `registration_key` is always dropped — it is an internal normalization, and `registration` is the
// published form a consumer displays. `icao_hex` is present only on registration lookups, where the
// caller keyed by something else and the hex is new information; on /feed it stays the map key and
// is absent from the value, exactly as before.
export type FeedResponseRow = Omit<FeedRow, 'icao_hex' | 'registration_key'> & {
  // Present only on /feed/registration, and null there for the ten of sixteen registers that publish
  // no Mode S address — the caller learns the hex is unavailable rather than that the field is missing.
  icao_hex?: string | null;
  type: string | null;
  engine: string | null;
  attribution: string;
};

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

// Case is not information in a Mode S address: "A004B3" and "a004b3" are the same aircraft, and
// rejecting one of them made the two routes disagree — /feed/registration normalizes its input
// while this rejected the equivalent. Lowercased to match the stored column, which is what the
// registers publish and what feed.ts writes. Dedups after normalization so mixed-case repeats count
// once against the cap and the IN-list stays minimal. Anything that still is not a 6-character hex
// string fails the whole request rather than being dropped: a caller sending garbage should learn,
// not get a quietly-partial map.
export const parseHexes = (body: unknown): string[] => {
  const raw = (body as { hexes?: unknown } | null)?.hexes;
  if (!Array.isArray(raw)) throw new HttpError(400, 'hexes must be an array');
  const normalized = raw.map((h) => (typeof h === 'string' ? h.trim().toLowerCase() : ''));
  const deduped = [...new Set(normalized)];
  if (deduped.length > MAX_HEXES) throw new HttpError(400, `too many hexes (max ${MAX_HEXES})`);
  for (const h of deduped) {
    if (!HEX_RE.test(h)) throw new HttpError(400, 'each hex must be 6 hexadecimal characters');
  }
  return deduped;
};

export const buildSelect = (count: number): string =>
  `SELECT * FROM feed WHERE icao_hex IN (${Array.from({ length: count }, () => '?').join(', ')})`;

export const buildRegistrationSelect = (count: number): string =>
  `SELECT * FROM feed WHERE registration_key IN (${Array.from({ length: count }, () => '?').join(', ')})`;

// Normalizes through the same function that builds the key, so a caller may send "C-FABC",
// "c fabc", or "CFABC" and reach the same row. Rejects the whole request on a value that cannot be
// a mark, matching parseHexes: a caller sending garbage should learn, not get a quietly-partial map.
export const parseRegistrations = (body: unknown): string[] => {
  const raw = (body as { registrations?: unknown } | null)?.registrations;
  if (!Array.isArray(raw)) throw new HttpError(400, 'registrations must be an array');
  const normalized = raw.map((r) => (typeof r === 'string' ? registrationKey(r) : ''));
  const deduped = [...new Set(normalized)];
  if (deduped.length > MAX_HEXES)
    throw new HttpError(400, `too many registrations (max ${MAX_HEXES})`);
  for (const r of deduped) {
    if (!REGISTRATION_KEY_RE.test(r))
      throw new HttpError(400, 'each registration must be 2-10 alphanumeric characters');
  }
  return deduped;
};

// Maker + model as one display string, dropping the maker when the model already leads with it: some
// registries (CAAS) store the make inside the free-text model ("CESSNA 172N"), which would otherwise
// render "Cessna CESSNA 172N". null when the registry supplied neither part.
const composeMakerModel = (maker: string | null, model: string | null): string | null => {
  if (!maker) return model || null;
  if (!model) return maker;
  return model.toLowerCase().startsWith(maker.toLowerCase()) ? model : `${maker} ${model}`;
};

export const toResponseMap = (
  rows: FeedRow[],
  byRegistration = false
): Record<string, FeedResponseRow> => {
  const out: Record<string, FeedResponseRow> = {};
  for (const { icao_hex, registration_key, ...rest } of rows) {
    const key = byRegistration ? registration_key : icao_hex;
    // Unreachable in practice: a NULL key cannot have matched the IN-list that selected the row.
    // Skipping rather than coercing keeps a producer bug from surfacing as a "null" map entry.
    if (key === null) continue;
    out[key] = {
      ...rest,
      ...(byRegistration ? { icao_hex } : {}),
      type: composeMakerModel(rest.manufacturer, rest.model),
      engine: composeMakerModel(rest.engine_manufacturer, rest.engine_model),
      attribution: attributionFor(rest.source),
    };
  }
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
  // `/feed` keys on icao_hex and is the ADS-B path; `/feed/registration` keys on the normalized
  // mark and reaches the nine sources that publish no hex. Both are batched exact point lookups —
  // neither exposes an attribute query, filter, or list surface.
  if (path !== '/feed' && path !== '/feed/registration') throw new HttpError(404, 'not found');
  if (method !== 'POST') throw new HttpError(405, 'method not allowed');
  if (!(await checkLimit())) throw new HttpError(429, 'rate limited');

  const body = await loadBody();
  const byRegistration = path === '/feed/registration';
  const keys = byRegistration ? parseRegistrations(body) : parseHexes(body);
  if (keys.length === 0) return { status: 200, body: {} };
  // SQLite's variable limit (>=999) comfortably exceeds MAX_HEXES, so one IN-query suffices — no
  // chunking (unlike D1's 100-parameter cap).
  const sql = byRegistration ? buildRegistrationSelect(keys.length) : buildSelect(keys.length);
  const rows = await runQuery(sql, keys);
  return { status: 200, body: toResponseMap(rows, byRegistration) };
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
