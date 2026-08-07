import { once } from 'node:events';
import { crc32 } from 'node:zlib';
import { Open, Parse, type Entry } from 'unzipper';
import type { DownloadConfig } from './types/config.js';
import { log } from './logger.js';
import { retry, type RetryOptions } from './retry.js';

export type { RetryOptions };

// At or above this size (or when Content-Length is absent), the ZIP is extracted from the
// response stream instead of buffering the whole archive — caps memory at the wanted entries,
// not compressed + decompressed whole-archive.
export const STREAM_THRESHOLD_BYTES = 256 * 1024 * 1024;

// Most 4xx (e.g. 404 moved file) are permanent — retrying wastes the daily run. Only statuses
// that can heal on their own (timeouts 408/425, rate limit 429, server-side 5xx) earn a retry.
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

// Retryable status surfaced after attempts are exhausted; carries the real status/statusText so
// the caller's final error reflects it instead of a synthetic message.
class RetryableResponse extends Error {
  constructor(readonly response: Response) {
    super(`retryable status ${response.status}`);
  }
}

// Permanent failures — HTTP status (404/403/…) or a config/archive mismatch. Carries the final
// user-facing message and is excluded from retry so a dead URL or wrong entry path fails fast
// instead of re-downloading the archive per attempt.
class TerminalError extends Error {}

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
          throw new TerminalError(`${label}: ${res.status} ${res.statusText}`);
        }
        return await read(res);
      },
      {
        ...opts,
        isRetryable: (err) => !(err instanceof TerminalError),
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
  const cookie = await primeCookies(config, opts);
  const url = await resolveDownloadUrl(config, opts, cookie);
  log('info', 'download_start', { url });

  // Extraction happens inside the retry so a body stream that drops mid-download is retried as
  // a whole request, in stream mode as much as in buffer mode.
  const files = await readWithRetry(
    url,
    buildRequestInit(config, cookie),
    'Download failed',
    async (res) => {
      if (config.format === 'file') {
        return extractFile(Buffer.from(await res.arrayBuffer()), config.entries);
      }
      const contentLength = contentLengthOf(res);
      const mode =
        contentLength !== null && contentLength < STREAM_THRESHOLD_BYTES ? 'buffer' : 'stream';
      log('info', 'download_mode', { url, mode, content_length: contentLength });
      if (mode === 'buffer') {
        return extractZip(Buffer.from(await res.arrayBuffer()), config.entries);
      }
      return extractZipStream(res, config.entries);
    },
    opts
  );
  log('info', 'download_complete', {
    url,
    files: files.size,
    elapsed_ms: Date.now() - start,
  });
  return files;
}

// Absent or unparseable Content-Length reads as unknown size → the caller streams to stay safe.
const contentLengthOf = (res: Response): number | null => {
  const raw = res.headers.get('content-length');
  const bytes = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(bytes) ? bytes : null;
};

// GET unless the source declares POST (e.g. a search-API register that returns the full set for an
// empty-query POST). For POST, the JSON body is serialized and Content-Type defaults to
// application/json unless the source overrides it.
const buildRequestInit = (config: DownloadConfig, cookie?: string): RequestInit => {
  const headers = withCookie(config.headers, cookie);
  if (config.method !== 'POST') return { headers };
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(config.body ?? {}),
  };
};

const withCookie = (
  headers: Record<string, string> | undefined,
  cookie: string | undefined
): Record<string, string> | undefined => (cookie ? { ...headers, Cookie: cookie } : headers);

// Fetches `prime_url` purely to collect the cookies the edge hands out, and folds them into one
// Cookie header for the requests that follow. Only name=value is kept — attributes (Path, Secure,
// SameSite) are directives to a browser jar, not part of what a client sends back.
//
// Throws when the priming request sets nothing: a declared prime_url that stops issuing cookies
// means the download is about to receive a challenge page under a 200, and that surfaces as an
// unintelligible parse error several steps later. Naming the real cause here is the difference
// between a five-minute fix and an afternoon.
const primeCookies = async (
  config: DownloadConfig,
  opts: RetryOptions
): Promise<string | undefined> => {
  if (!config.prime_url) return undefined;
  log('info', 'prime_start', { prime_url: config.prime_url });
  const cookie = await readWithRetry(
    config.prime_url,
    { headers: config.headers },
    'Prime fetch failed',
    (res) =>
      Promise.resolve(
        res.headers
          .getSetCookie()
          .map((c) => c.split(';')[0]?.trim())
          .filter((c): c is string => !!c)
          .join('; ')
      ),
    opts
  );
  if (!cookie) throw new Error(`Prime fetch set no cookies on ${config.prime_url}`);
  log('info', 'prime_complete', { prime_url: config.prime_url });
  return cookie;
};

// Resolves the actual download URL. If `discover_url` + `discover_pattern` are configured
// (e.g., NL ILT, where the bulk-download filename embeds the publication date and rolls
// each refresh), fetch the index page, regex-match the first capture group, and return that
// URL — resolved against the index URL as the base for relative links. Otherwise, return
// `config.url` unchanged.
const resolveDownloadUrl = async (
  config: DownloadConfig,
  opts: RetryOptions,
  cookie?: string
): Promise<string> => {
  if (!config.discover_url || !config.discover_pattern) return config.url;
  log('info', 'discover_start', { discover_url: config.discover_url });
  const html = await readWithRetry(
    config.discover_url,
    { headers: withCookie(config.headers, cookie) },
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
                try {
                  const alias = wanted.get(f.path);
                  if (alias) {
                    const buf = Buffer.concat(chunks);
                    assertEntryCrc(buf, f.crc32, f.path);
                    result.set(alias, buf);
                  }
                  resolve();
                } catch (err) {
                  reject(err instanceof Error ? err : new Error(String(err)));
                }
              })
              .on('error', reject);
          })
      )
  );

  assertAllEntries(
    result,
    entries,
    dir.files.map((f) => f.path)
  );
  log('info', 'extract_complete', { files: result.size });
  return result;
}

// Streaming extraction: entries are decompressed as the response body arrives, so only the
// wanted entries are ever held in memory — never the whole archive.
async function extractZipStream(
  res: Response,
  entries: Record<string, string>
): Promise<Map<string, Buffer>> {
  if (!res.body) throw new TerminalError('Download failed: response has no body to stream');

  const wanted = new Map(Object.entries(entries).map(([alias, path]) => [path, alias]));
  const result = new Map<string, Buffer>();
  const seen: string[] = [];

  // A synchronous 'entry' listener, not forceStream + async iteration: unzipper picks the
  // entry's inflater in the same tick it delivers the entry, so only a listener can flag
  // autodrain() early enough to skip decompressing unwanted entries rather than inflating
  // them and throwing the bytes away.
  const parser = Parse();
  const pending: Promise<void>[] = [];
  parser.on('entry', (entry: Entry) => {
    seen.push(entry.path);
    const alias = wanted.get(entry.path);
    if (alias) {
      pending.push(bufferEntry(entry, alias, result));
    } else {
      entry.autodrain();
    }
  });

  // Manual pump, not Readable.fromWeb(...).pipe(parser): pipe() never forwards source errors,
  // and under Bun fromWeb doesn't emit 'error' at all — a connection dropped mid-body would
  // hang the parse forever instead of rejecting into the retry. reader.read() rejects reliably,
  // so the pump routes the failure into the parser, which rejects the promise() below.
  // Bun types Response.body as an untyped ReadableStream; the payload is always bytes.
  const reader = res.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  void (async () => {
    try {
      // Sequential by nature — each read depends on the prior chunk being written.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!parser.write(value)) await once(parser, 'drain');
      }
      parser.end();
    } catch (err) {
      parser.destroy(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  try {
    await parser.promise();
  } finally {
    // Close the connection if parsing bailed early; on a dead socket cancel itself can
    // reject, and that must not mask the parse error.
    try {
      await reader.cancel();
    } catch {
      // connection already gone
    }
    // A mid-entry failure also fails the parser, whose error is the one thrown — settle the
    // losing entry-buffer rejections here so none are ever left unhandled.
    await Promise.allSettled(pending);
  }
  // Entry buffers can settle a tick after the parser finishes; collect (rethrowing any
  // buffer-only failure) before asserting.
  await Promise.all(pending);

  assertAllEntries(result, entries, seen);
  log('info', 'extract_complete', { files: result.size });
  return result;
}

// Buffers one wanted entry, verifies its CRC, and records it under its alias. Flag bit 3 defers
// the real CRC to a data descriptor unzipper never copies back into vars, so the local-header
// value is meaningless then — verify only when present.
const bufferEntry = async (
  entry: Entry,
  alias: string,
  result: Map<string, Buffer>
): Promise<void> => {
  const buf = await entry.buffer();
  if (!(entry.vars.flags & 0x08)) assertEntryCrc(buf, entry.vars.crc32, entry.path);
  result.set(alias, buf);
};

// unzipper never verifies the archive's own CRC, and mangled deflate can stay structurally
// valid — without this check corrupted register bytes ship in a green run. Plain Error, not
// TerminalError: in-transit corruption is cured by a re-download, so it must stay retryable.
const assertEntryCrc = (buf: Buffer, expected: number, path: string): void => {
  const actual = crc32(buf);
  if (actual !== expected)
    throw new Error(`ZIP entry CRC mismatch for "${path}": expected ${expected}, got ${actual}`);
};

// Name the expected path and what the archive actually holds — the misconfiguration is almost
// always the path (upstream renamed the file), not the alias. Terminal: a wrong path is
// deterministic, so retrying would re-download the archive for nothing.
const assertAllEntries = (
  result: Map<string, Buffer>,
  entries: Record<string, string>,
  archivePaths: string[]
): void => {
  for (const [alias, path] of Object.entries(entries)) {
    if (!result.has(alias))
      throw new TerminalError(
        `ZIP entry not found: alias "${alias}" expected "${path}"; archive has: ${archivePaths.join(', ')}`
      );
  }
};
