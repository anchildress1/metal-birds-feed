// Pure request logic for the enrichment Worker, kept out of the Cloudflare-runtime entry (worker/
// index.ts → src/worker/serve.ts) so it typechecks, lints, and is unit-tested in the main Bun
// suite. serve.ts injects the D1-backed RunQuery and the rate-limit CheckLimit; the decisions live
// here.

const HEX_RE = /^[0-9a-f]{6}$/;
const MAX_HEXES = 500;
// D1 caps bound parameters at 100 per query, so a request is split into IN-lists of at most this
// many hexes and the row groups are merged. Keeps the ≤500 request contract callable.
const D1_MAX_PARAMS = 100;

// Mirrors the enrichment table (worker/migrations). The query is SELECT *, so this stays the single
// typed description of a row; adding a column to the table + producer surfaces it here without
// editing a hand-maintained SELECT list.
export interface EnrichmentRecord {
  icao_hex: string;
  registration: string;
  icao_type_code: string | null;
  status: string;
  country: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  year_manufactured: number | null;
  airframe_type: string | null;
  category: string | null;
  engine_manufacturer: string | null;
  engine_model: string | null;
  engine_type: string | null;
  engine_count: number | null;
  engine_horsepower: number | null;
  engine_thrust_lbs: number | null;
  seats: number | null;
  max_passengers: number | null;
  cruise_speed_ktas: number | null;
  max_takeoff_weight_kg: number | null;
  owner_name: string | null;
  owner_kind: string | null;
  owner_state: string | null;
  owner_country: string | null;
  operator_name: string | null;
  operator_kind: string | null;
  operator_state: string | null;
  operator_country: string | null;
  source: string;
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
  `SELECT * FROM enrichment WHERE icao_hex IN (${Array.from({ length: count }, () => '?').join(', ')})`;

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
  const chunks: string[][] = [];
  for (let i = 0; i < hexes.length; i += D1_MAX_PARAMS)
    chunks.push(hexes.slice(i, i + D1_MAX_PARAMS));
  const groups = await Promise.all(chunks.map((c) => runQuery(buildSelect(c.length), c)));
  return { status: 200, body: toResponseMap(groups.flat()) };
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
