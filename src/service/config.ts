import { resolve, sep } from 'node:path';

// A bearer secret's strength is entropy, not shape — a UUID and any random 32-hex string carry the
// same protection, so we don't police the format (that would only reject good secrets and block
// rotation to a non-UUID). Fail fast at startup on the one thing that is a real misconfiguration:
// an absent or trivially short token.
const MIN_TOKEN_LENGTH = 16;

export interface ServiceConfig {
  dbPath: string;
  port: number;
  token: string;
  rateLimit: number;
  rateWindowMs: number;
}

const positiveInteger = (name: string, input: string | undefined, fallback: number): number => {
  if (input === undefined) return fallback;
  const value = Number(input);
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${name} must be a positive integer`);
  return value;
};

const portNumber = (input: string | undefined): number => {
  const port = positiveInteger('PORT', input, 8080);
  if (port > 65_535) throw new Error('PORT must be between 1 and 65535');
  return port;
};

const databasePath = (input: string | undefined, root: string): string => {
  const configured = input?.trim() || 'feed.sqlite';
  if (configured.includes('..')) throw new Error('MBF_FEED_DB_PATH must not contain ..');

  const sandboxRoot = resolve(root);
  const path = resolve(sandboxRoot, configured);
  if (path === sandboxRoot || !path.startsWith(`${sandboxRoot}${sep}`))
    throw new Error('MBF_FEED_DB_PATH must stay within the service root');
  return path;
};

export const loadServiceConfig = (
  env: Record<string, string | undefined> = process.env,
  root = process.cwd()
): ServiceConfig => {
  const token = env['FEED_TOKEN']?.trim();
  if (!token || token.length < MIN_TOKEN_LENGTH)
    throw new Error(`FEED_TOKEN must be set (at least ${MIN_TOKEN_LENGTH} characters)`);

  return {
    dbPath: databasePath(env['MBF_FEED_DB_PATH'], root),
    port: portNumber(env['PORT']),
    token,
    rateLimit: positiveInteger('FEED_RATE_LIMIT', env['FEED_RATE_LIMIT'], 120),
    rateWindowMs: positiveInteger('FEED_RATE_WINDOW_MS', env['FEED_RATE_WINDOW_MS'], 60_000),
  };
};
