// Pure request logic for the enrichment Worker, kept out of the Cloudflare-runtime entry (worker/
// index.ts) so it typechecks, lints, and is unit-tested in the main Bun suite. The entry injects a
// RunQuery backed by the D1 binding; everything decision-making lives here.

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

// Single-consumer private endpoint: a shared bearer token is the whole gate. A missing server-side
// token is a 500 (misconfiguration), never an open door.
export const authorize = (header: string | null, token: string | undefined): void => {
  if (!token) throw new HttpError(500, 'server misconfigured');
  if (header !== `Bearer ${token}`) throw new HttpError(401, 'unauthorized');
};

// Rejects the whole request on any malformed hex rather than silently dropping bad entries — a
// caller sending garbage should learn, not get a quietly-partial map. Dedups so the IN-list and the
// bound-parameter count stay minimal.
export const parseHexes = (body: unknown): string[] => {
  const raw = (body as { hexes?: unknown } | null)?.hexes;
  if (!Array.isArray(raw)) throw new HttpError(400, 'hexes must be an array');
  if (raw.length > MAX_HEXES) throw new HttpError(400, `too many hexes (max ${MAX_HEXES})`);
  const deduped = [...new Set(raw)];
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
  runQuery: RunQuery
): Promise<RouteResult> => {
  if (path !== '/enrich') throw new HttpError(404, 'not found');
  if (method !== 'POST') throw new HttpError(405, 'method not allowed');
  authorize(authHeader, token);
  const hexes = parseHexes(body);
  if (hexes.length === 0) return { status: 200, body: {} };
  const rows = await runQuery(buildSelect(hexes.length), hexes);
  return { status: 200, body: toResponseMap(rows) };
};

// The single entry the Cloudflare handler calls. Converts thrown HttpErrors into status codes and
// swallows anything unexpected as a generic 500 so a stack trace never reaches the caller.
export const route = async (
  method: string,
  path: string,
  authHeader: string | null,
  token: string | undefined,
  body: unknown,
  runQuery: RunQuery
): Promise<RouteResult> => {
  try {
    return await handleEnrich(method, path, authHeader, token, body, runQuery);
  } catch (err) {
    if (err instanceof HttpError) return { status: err.status, body: { error: err.message } };
    return { status: 500, body: { error: 'internal error' } };
  }
};
