// Pure request logic for the enrichment Worker, kept out of the Cloudflare-runtime entry (worker/
// index.ts → src/worker/serve.ts) so it typechecks, lints, and is unit-tested in the main Bun
// suite. serve.ts injects the D1-backed RunQuery and the rate-limit CheckLimit; the decisions live
// here.

const HEX_RE = /^[0-9a-f]{6}$/;
const MAX_HEXES = 500;

export interface EnrichmentRecord {
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

export type RunQuery = (sql: string, params: string[]) => Promise<EnrichmentRecord[]>;
export type CheckLimit = () => Promise<boolean>;

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
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
};

// Single-consumer private endpoint: a shared bearer token is the whole gate. A missing server-side
// token is a 500 (misconfiguration), never an open door.
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
  'SELECT icao_hex, registration, airframe_type, manufacturer, model, owner_name, owner_country, operator_name, status ' +
  `FROM enrichment WHERE icao_hex IN (${Array.from({ length: count }, () => '?').join(', ')})`;

export const toResponseMap = (
  rows: EnrichmentRecord[]
): Record<string, Omit<EnrichmentRecord, 'icao_hex'>> => {
  const out: Record<string, Omit<EnrichmentRecord, 'icao_hex'>> = {};
  for (const { icao_hex, ...rest } of rows) out[icao_hex] = rest;
  return out;
};

const handleEnrich = async (
  method: string,
  path: string,
  authHeader: string | null,
  token: string | undefined,
  body: unknown,
  checkLimit: CheckLimit,
  runQuery: RunQuery
): Promise<RouteResult> => {
  // Auth first, before routing, so an unauthenticated probe can't map the route surface. Rate limit
  // runs only after a valid token hits the real endpoint, so an unauthenticated flood can't drain
  // the shared budget out from under the legitimate consumer.
  authorize(authHeader, token);
  if (path !== '/enrich') throw new HttpError(404, 'not found');
  if (method !== 'POST') throw new HttpError(405, 'method not allowed');
  if (!(await checkLimit())) throw new HttpError(429, 'rate limited');
  const hexes = parseHexes(body);
  if (hexes.length === 0) return { status: 200, body: {} };
  const rows = await runQuery(buildSelect(hexes.length), hexes);
  return { status: 200, body: toResponseMap(rows) };
};

// The single entry serve.ts calls. Converts thrown HttpErrors into status codes and swallows
// anything unexpected as a generic 500 so a stack trace never reaches the caller.
export const route = async (
  method: string,
  path: string,
  authHeader: string | null,
  token: string | undefined,
  body: unknown,
  checkLimit: CheckLimit,
  runQuery: RunQuery
): Promise<RouteResult> => {
  try {
    return await handleEnrich(method, path, authHeader, token, body, checkLimit, runQuery);
  } catch (err) {
    if (err instanceof HttpError) return { status: err.status, body: { error: err.message } };
    return { status: 500, body: { error: 'internal error' } };
  }
};
