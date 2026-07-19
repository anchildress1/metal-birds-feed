import { resolve, sep } from 'node:path';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  if (!token || !UUID_RE.test(token)) throw new Error('FEED_TOKEN must be a UUID');

  return {
    dbPath: databasePath(env['MBF_FEED_DB_PATH'], root),
    port: portNumber(env['PORT']),
    token,
    rateLimit: positiveInteger('FEED_RATE_LIMIT', env['FEED_RATE_LIMIT'], 120),
    rateWindowMs: positiveInteger('FEED_RATE_WINDOW_MS', env['FEED_RATE_WINDOW_MS'], 60_000),
  };
};
