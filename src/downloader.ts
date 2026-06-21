import { Open } from 'unzipper';
import type { DownloadConfig } from './types/config.js';
import { log } from './logger.js';
import { retry, type RetryOptions } from './retry.js';

export type { RetryOptions };

// 4xx (e.g. 404 moved file) are permanent — retrying wastes the daily run. Only transient
// transport failures earn a retry.
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

// Retryable status surfaced after attempts are exhausted; carries the real status/statusText so
// the caller's final error reflects it instead of a synthetic message.
class RetryableResponse extends Error {
  constructor(readonly response: Response) {
    super(`retryable status ${response.status}`);
  }
}

// Permanent HTTP status (404/403/…). Carries the final user-facing message and is excluded from
// retry so a dead URL fails fast.
class TerminalHttpError extends Error {}

// Retries the FULL request — headers AND body read. A connection that drops mid-stream after a
// 200 (most likely on the large registry files this pipeline pulls) is retried, not just the
// initial handshake. Composes any caller-provided onRetry rather than clobbering it.
const readWithRetry = async <T>(
  url: string,
  init: RequestInit,
  label: string,
  read: (res: Response) => Promise<T>,
  opts: RetryOptions
): Promise<T> => {
  try {
    return await retry(
      async () => {
        const res = await fetch(url, init);
        if (!res.ok) {
          if (RETRYABLE_STATUS.has(res.status)) throw new RetryableResponse(res);
          throw new TerminalHttpError(`${label}: ${res.status} ${res.statusText}`);
        }
        return await read(res);
      },
      {
        ...opts,
        isRetryable: (err) => !(err instanceof TerminalHttpError),
        onRetry: (attempt, err) => {
          opts.onRetry?.(attempt, err);
          log('warn', 'download_retry', { url, attempt, reason: String(err) });
        },
      }
    );
  } catch (err) {
    if (err instanceof RetryableResponse)
      throw new Error(`${label}: ${err.response.status} ${err.response.statusText}`, {
        cause: err,
      });
    throw err;
  }
};

export async function download(
  config: DownloadConfig,
  opts: RetryOptions = {}
): Promise<Map<string, Buffer>> {
  const start = Date.now();
  const url = await resolveDownloadUrl(config, opts);
  log('info', 'download_start', { url });

  const buf = await readWithRetry(
    url,
    { headers: config.headers },
    'Download failed',
    async (res) => Buffer.from(await res.arrayBuffer()),
    opts
  );
  log('info', 'download_complete', {
    url,
    bytes: buf.byteLength,
    elapsed_ms: Date.now() - start,
  });

  if (config.format === 'file') {
    return extractFile(buf, config.entries);
  }
  return extractZip(buf, config.entries);
}

// Resolves the actual download URL. If `discover_url` + `discover_pattern` are configured
// (e.g., NL ILT, where the bulk-download filename embeds the publication date and rolls
// each refresh), fetch the index page, regex-match the first capture group, and return that
// URL — resolved against the index URL as the base for relative links. Otherwise, return
// `config.url` unchanged.
const resolveDownloadUrl = async (config: DownloadConfig, opts: RetryOptions): Promise<string> => {
  if (!config.discover_url || !config.discover_pattern) return config.url;
  log('info', 'discover_start', { discover_url: config.discover_url });
  const html = await readWithRetry(
    config.discover_url,
    { headers: config.headers },
    'Discovery fetch failed',
    (res) => res.text(),
    opts
  );
  // Pattern source is `sources/<id>.yaml`, a repo-controlled config — not runtime input.
  // Loader validates it as a syntactically valid regex before reaching this point.
  // Distinguish no-match (wrong pattern) from matched-but-no-capture (missing group).
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
  const match = new RegExp(config.discover_pattern).exec(html);
  if (!match) {
    throw new Error(`Discovery pattern found no match on ${config.discover_url}`);
  }
  const captured = match[1];
  if (!captured) {
    throw new Error(
      `Discovery pattern matched on ${config.discover_url} but captured no URL (pattern needs a capture group)`
    );
  }
  const resolved = new URL(captured, config.discover_url).toString();
  log('info', 'discover_complete', { resolved });
  return resolved;
};

const extractFile = (buf: Buffer, entries: Record<string, string>): Map<string, Buffer> => {
  // Loader enforces exactly one alias for `format: 'file'`; the path value is conventional
  // (the URL is the file). The single-alias key becomes the engine's lookup name.
  const aliases = Object.keys(entries);
  const alias = aliases[0];
  if (alias === undefined) {
    throw new Error('download.entries must contain exactly one alias for format=file');
  }
  return new Map([[alias, buf]]);
};

async function extractZip(
  buf: Buffer,
  entries: Record<string, string>
): Promise<Map<string, Buffer>> {
  const wanted = new Map(Object.entries(entries).map(([alias, path]) => [path, alias]));
  const result = new Map<string, Buffer>();

  const dir = await Open.buffer(buf);
  await Promise.all(
    dir.files
      .filter((f) => wanted.has(f.path))
      .map(
        (f) =>
          new Promise<void>((resolve, reject) => {
            const chunks: Buffer[] = [];
            f.stream()
              .on('data', (c: Buffer) => chunks.push(c))
              .on('end', () => {
                const alias = wanted.get(f.path);
                if (alias) result.set(alias, Buffer.concat(chunks));
                resolve();
              })
              .on('error', reject);
          })
      )
  );

  // Name the expected path and what the archive actually holds — the misconfiguration is almost
  // always the path (upstream renamed the file), not the alias.
  for (const [alias, path] of Object.entries(entries)) {
    if (!result.has(alias))
      throw new Error(
        `ZIP entry not found: alias "${alias}" expected "${path}"; archive has: ${dir.files.map((f) => f.path).join(', ')}`
      );
  }

  log('info', 'extract_complete', { files: result.size });
  return result;
}
