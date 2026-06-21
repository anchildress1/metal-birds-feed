import { describe, it, expect, mock, afterEach } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { download, type RetryOptions } from '../src/downloader.js';
import type { DownloadConfig } from '../src/types/config.js';

// No-op sleep keeps backoff out of the test clock; assertions cover attempt counts, not timing.
const FAST_RETRY: RetryOptions = { baseDelayMs: 0, sleep: async () => {} };

const REAL_FETCH = globalThis.fetch;
const setFetch = (fn: unknown): void => {
  globalThis.fetch = fn as typeof globalThis.fetch;
};

const FIXTURE_ZIP = resolve(import.meta.dirname, '..', 'fixtures', 'faa', 'ReleasableAircraft.zip');

const zipArrayBuffer = (): ArrayBuffer => {
  const z = readFileSync(FIXTURE_ZIP);
  return z.buffer.slice(z.byteOffset, z.byteOffset + z.byteLength);
};

const okZipResponse = () => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  arrayBuffer: () => Promise.resolve(zipArrayBuffer()),
});

const httpErrResponse = (status: number) => ({ ok: false, status, statusText: 'err' });

const FAA_DOWNLOAD_CONFIG: DownloadConfig = {
  url: 'https://registry.faa.gov/database/ReleasableAircraft.zip',
  format: 'zip',
  entries: {
    master: 'MASTER.txt',
    acftref: 'ACFTREF.txt',
    engine: 'ENGINE.txt',
  },
};

function mockFetch(buf: Buffer, ok = true, status = 200): void {
  setFetch(
    mock().mockResolvedValue({
      ok,
      status,
      statusText: ok ? 'OK' : 'Not Found',
      arrayBuffer: () =>
        Promise.resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)),
    })
  );
}

interface MockResponse {
  ok: boolean;
  status: number;
  statusText: string;
  body: Buffer | string;
}

const mockFetchSequence = (responses: MockResponse[]): ReturnType<typeof mock> => {
  const fn = mock();
  for (const r of responses) {
    fn.mockResolvedValueOnce({
      ok: r.ok,
      status: r.status,
      statusText: r.statusText,
      arrayBuffer: () => {
        const buf = typeof r.body === 'string' ? Buffer.from(r.body, 'utf8') : r.body;
        return Promise.resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
      },
      text: () => Promise.resolve(typeof r.body === 'string' ? r.body : r.body.toString('utf8')),
    });
  }
  setFetch(fn);
  return fn;
};

afterEach(() => {
  globalThis.fetch = REAL_FETCH;
});

describe('download', () => {
  it('extracts all declared entries from a valid ZIP', async () => {
    const zip = readFileSync(FIXTURE_ZIP);
    mockFetch(zip);

    const files = await download(FAA_DOWNLOAD_CONFIG);

    expect(files.has('master')).toBe(true);
    expect(files.has('acftref')).toBe(true);
    expect(files.has('engine')).toBe(true);
    expect(files.get('master')!.length).toBeGreaterThan(0);
  });

  it('returns a Buffer for each entry', async () => {
    const zip = readFileSync(FIXTURE_ZIP);
    mockFetch(zip);

    const files = await download(FAA_DOWNLOAD_CONFIG);

    for (const buf of files.values()) {
      expect(buf).toBeInstanceOf(Buffer);
    }
  });

  it('extracted master content matches original fixture file', async () => {
    const zip = readFileSync(FIXTURE_ZIP);
    mockFetch(zip);

    const files = await download(FAA_DOWNLOAD_CONFIG);
    const master = files.get('master')!.toString('latin1');

    expect(master).toContain('N-NUMBER');
    expect(master).toContain('12345,17282099');
  });

  it('throws when fetch response is not ok', async () => {
    mockFetch(Buffer.alloc(0), false, 404);

    await expect(download(FAA_DOWNLOAD_CONFIG)).rejects.toThrow(/404/);
  });

  it('forwards headers from config to fetch', async () => {
    const zip = readFileSync(FIXTURE_ZIP);
    mockFetch(zip);

    await download({ ...FAA_DOWNLOAD_CONFIG, headers: { 'User-Agent': 'test-bot/1.0' } });

    const call = (globalThis.fetch as unknown as ReturnType<typeof mock>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(call[1]).toMatchObject({ headers: { 'User-Agent': 'test-bot/1.0' } });
  });

  it('throws when a required alias is missing from the ZIP', async () => {
    const zip = readFileSync(FIXTURE_ZIP);
    mockFetch(zip);

    const badConfig: DownloadConfig = {
      ...FAA_DOWNLOAD_CONFIG,
      entries: { ...FAA_DOWNLOAD_CONFIG.entries, missing: 'NOTEXIST.txt' },
    };

    await expect(download(badConfig)).rejects.toThrow(/not found.*NOTEXIST\.txt.*archive has/i);
  });
});

describe('download — format: file', () => {
  const FILE_CONFIG: DownloadConfig = {
    url: 'https://example.com/register.ods',
    format: 'file',
    entries: { register: '.' },
  };

  it('returns a single Map entry keyed by the configured alias', async () => {
    mockFetch(Buffer.from('binary-blob-bytes'));

    const files = await download(FILE_CONFIG);

    expect(files.size).toBe(1);
    expect(files.has('register')).toBe(true);
    expect(files.get('register')!.toString('utf8')).toBe('binary-blob-bytes');
  });

  it('throws when the fetch is not ok', async () => {
    mockFetch(Buffer.alloc(0), false, 404);

    await expect(download(FILE_CONFIG)).rejects.toThrow(/404/);
  });
});

describe('download — discover_url + discover_pattern', () => {
  const INDEX_HTML = `
    <html><body>
      <h1>Register data files</h1>
      <a href="/site/binaries/register/luchtvaartuigregister-ilt-datas2-2026-04-28.ods">April 2026</a>
      <a href="/site/binaries/register/luchtvaartuigregister-ilt-datas2-2026-03-31.ods">March 2026</a>
    </body></html>
  `;

  const DISCOVER_CONFIG: DownloadConfig = {
    url: 'https://www.example.test/old-fallback.ods',
    format: 'file',
    entries: { register: '.' },
    discover_url: 'https://www.example.test/register-data',
    discover_pattern: 'href="(/site/binaries/register/luchtvaartuigregister-[^"]+\\.ods)"',
  };

  it('fetches the index, extracts the first URL, and downloads it', async () => {
    const fetchFn = mockFetchSequence([
      { ok: true, status: 200, statusText: 'OK', body: INDEX_HTML },
      { ok: true, status: 200, statusText: 'OK', body: Buffer.from('ods-bytes') },
    ]);

    const files = await download(DISCOVER_CONFIG);

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn.mock.calls[0]?.[0]).toBe(DISCOVER_CONFIG.discover_url);
    // Resolved against the discover_url; absolute path, so host comes from discover_url.
    expect(fetchFn.mock.calls[1]?.[0]).toBe(
      'https://www.example.test/site/binaries/register/luchtvaartuigregister-ilt-datas2-2026-04-28.ods'
    );
    expect(files.get('register')!.toString('utf8')).toBe('ods-bytes');
  });

  it('throws when the discovery fetch fails after exhausting retries', async () => {
    const fetchFn = mockFetchSequence(
      Array.from({ length: 4 }, () => ({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        body: '',
      }))
    );

    await expect(download(DISCOVER_CONFIG, FAST_RETRY)).rejects.toThrow(
      /discovery fetch failed.*503/i
    );
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it('throws a no-match error when the pattern does not match the index page', async () => {
    mockFetchSequence([
      { ok: true, status: 200, statusText: 'OK', body: '<html><body>nothing here</body></html>' },
    ]);

    await expect(download(DISCOVER_CONFIG)).rejects.toThrow(/found no match/i);
  });

  it('throws a no-capture error when the pattern matches but has no capture group', async () => {
    mockFetchSequence([
      { ok: true, status: 200, statusText: 'OK', body: '<a href="latest.ods">latest</a>' },
    ]);

    const cfg: DownloadConfig = { ...DISCOVER_CONFIG, discover_pattern: 'href="[^"]+\\.ods"' };
    await expect(download(cfg)).rejects.toThrow(/captured no URL/i);
  });

  it('resolves a relative URL against the discover_url base', async () => {
    const fetchFn = mockFetchSequence([
      { ok: true, status: 200, statusText: 'OK', body: '<a href="latest.ods">latest</a>' },
      { ok: true, status: 200, statusText: 'OK', body: Buffer.from('ods-bytes') },
    ]);

    const cfg: DownloadConfig = {
      ...DISCOVER_CONFIG,
      discover_pattern: 'href="([^"]+\\.ods)"',
    };
    await download(cfg);

    expect(fetchFn.mock.calls[1]?.[0]).toBe('https://www.example.test/latest.ods');
  });

  it('honors an absolute URL captured by the pattern', async () => {
    const fetchFn = mockFetchSequence([
      {
        ok: true,
        status: 200,
        statusText: 'OK',
        body: '<a href="https://cdn.example.org/abs.ods">absolute</a>',
      },
      { ok: true, status: 200, statusText: 'OK', body: Buffer.from('ods-bytes') },
    ]);

    const cfg: DownloadConfig = {
      ...DISCOVER_CONFIG,
      discover_pattern: 'href="(https://[^"]+\\.ods)"',
    };
    await download(cfg);

    expect(fetchFn.mock.calls[1]?.[0]).toBe('https://cdn.example.org/abs.ods');
  });

  it('returns the first matching URL when multiple matches exist', async () => {
    const fetchFn = mockFetchSequence([
      { ok: true, status: 200, statusText: 'OK', body: INDEX_HTML },
      { ok: true, status: 200, statusText: 'OK', body: Buffer.from('ods-bytes') },
    ]);

    await download(DISCOVER_CONFIG);

    // First match in INDEX_HTML is the April 2026 file (declared first).
    expect(fetchFn.mock.calls[1]?.[0]).toContain('2026-04-28');
  });
});

describe('download — retry', () => {
  it('retries a transient 5xx then extracts the ZIP', async () => {
    const fn = mock()
      .mockResolvedValueOnce(httpErrResponse(503))
      .mockResolvedValueOnce(okZipResponse());
    setFetch(fn);

    const files = await download(FAA_DOWNLOAD_CONFIG, FAST_RETRY);

    expect(files.has('master')).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries a thrown network error then extracts the ZIP', async () => {
    const fn = mock()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(okZipResponse());
    setFetch(fn);

    const files = await download(FAA_DOWNLOAD_CONFIG, FAST_RETRY);

    expect(files.has('master')).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries a body read that drops mid-stream after a 200', async () => {
    // The connection delivers 200 headers, then the body stream fails — the failure this PR's
    // reviewer flagged. The whole request (headers + body) must be retried.
    const fn = mock()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: () => Promise.reject(new Error('terminated')),
      })
      .mockResolvedValueOnce(okZipResponse());
    setFetch(fn);

    const files = await download(FAA_DOWNLOAD_CONFIG, FAST_RETRY);

    expect(files.has('master')).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('invokes a caller-provided onRetry instead of clobbering it', async () => {
    const onRetry = mock();
    const fn = mock()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(okZipResponse());
    setFetch(fn);

    await download(FAA_DOWNLOAD_CONFIG, { ...FAST_RETRY, onRetry });

    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });

  it('fails fast on a permanent 404 without retrying', async () => {
    const fn = mock().mockResolvedValue(httpErrResponse(404));
    setFetch(fn);

    await expect(download(FAA_DOWNLOAD_CONFIG, FAST_RETRY)).rejects.toThrow(/Download failed: 404/);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after exhausting retries on a persistent 5xx', async () => {
    const fn = mock().mockResolvedValue(httpErrResponse(503));
    setFetch(fn);

    await expect(download(FAA_DOWNLOAD_CONFIG, { ...FAST_RETRY, attempts: 3 })).rejects.toThrow(
      /Download failed: 503/
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('rethrows a network error after exhausting attempts', async () => {
    const fn = mock().mockRejectedValue(new Error('ETIMEDOUT'));
    setFetch(fn);

    await expect(download(FAA_DOWNLOAD_CONFIG, { ...FAST_RETRY, attempts: 2 })).rejects.toThrow(
      /ETIMEDOUT/
    );
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
