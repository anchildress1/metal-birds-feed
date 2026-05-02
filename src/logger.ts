import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type LogLevel = 'info' | 'warn' | 'error';

const LOG_PATH = join(process.cwd(), 'logs', 'pipeline.log');
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
  return s.includes(' ') || s.includes('"') ? `"${s.replaceAll('"', String.raw`\"`)}"` : s;
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
