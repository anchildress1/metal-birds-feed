import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type LogLevel = 'info' | 'warn' | 'error';

// Every catch site that logs an error's message needs this same narrowing — `unknown` catch
// values aren't always Error instances (a rejected fetch, a thrown string/object).
export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

// Tests share this logger, and a `bun test` run concurrent with a live refresh interleaves
// thousands of fixture lines into the real run's log — the diagnostics for a 15-minute refresh
// become unreadable. Bun sets NODE_ENV=test, so the two never contend for the same file.
const LOG_PATH = join(
  process.cwd(),
  'logs',
  process.env.NODE_ENV === 'test' ? 'test.log' : 'pipeline.log'
);
const ESCAPED_QUOTE = String.raw`\"`;
let logDirReady = false;

const ensureLogDir = (): void => {
  if (logDirReady) return;
  try {
    mkdirSync(dirname(LOG_PATH), { recursive: true });
    logDirReady = true;
  } catch {
    // dir creation is best-effort; appendFileSync failures are also tolerated below
  }
};

function escape(v: unknown): string {
  let s: string;
  if (v == null) {
    s = '';
  } else if (typeof v === 'string') {
    s = v;
  } else if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') {
    s = String(v);
  } else {
    try {
      s = JSON.stringify(v) ?? '';
    } catch {
      s = '[Unserializable]';
    }
  }
  return s.includes(' ') || s.includes('"') ? `"${s.replaceAll('"', ESCAPED_QUOTE)}"` : s;
}

export function log(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  const parts: string[] = [`ts=${new Date().toISOString()}`, `level=${level}`, `event=${event}`];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(`${k}=${escape(v)}`);
  }
  const line = parts.join(' ');
  console.log(line);
  ensureLogDir();
  try {
    appendFileSync(LOG_PATH, line + '\n');
  } catch {
    // log write failures are non-fatal
  }
}
