import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export type LogLevel = 'info' | 'warn' | 'error';

const LOG_PATH = join(process.cwd(), 'logs', 'pipeline.log');

mkdirSync(join(process.cwd(), 'logs'), { recursive: true });

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
  return s.includes(' ') || s.includes('"') ? `"${s.replace(/"/g, '\\"')}"` : s;
}

export function log(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  const parts: string[] = [`ts=${new Date().toISOString()}`, `level=${level}`, `event=${event}`];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(`${k}=${escape(v)}`);
  }
  const line = parts.join(' ');
  console.log(line);
  try {
    appendFileSync(LOG_PATH, line + '\n');
  } catch {
    // log write failures are non-fatal
  }
}
