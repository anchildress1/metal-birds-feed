import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { download } from '../src/downloader.js';
import type { DownloadConfig } from '../src/types/config.js';

const FIXTURE_ZIP = resolve(import.meta.dirname, '..', 'fixtures', 'faa', 'ReleasableAircraft.zip');

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
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
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

const mockFetchSequence = (responses: MockResponse[]): ReturnType<typeof vi.fn> => {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({
      ok: r.ok,
      status: r.status,
      statusText: r.statusText,
      arrayBuffer: () => {
        const buf = typeof r.body === 'string' ? Buffer.from(r.body, 'utf8') : r.body;
        return Promise.resolve(
          buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
        );
      },
      text: () => Promise.resolve(typeof r.body === 'string' ? r.body : r.body.toString('utf8')),
    });
  }
  vi.stubGlobal('fetch', fn);
  return fn;
};

afterEach(() => {
  vi.unstubAllGlobals();
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

    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(call[1]).toMatchObject({ headers: { 'User-Agent': 'test-bot/1.0' } });
  });

  it('throws when a required alias is missing from the ZIP', async () => {
    const zip = readFileSync(FIXTURE_ZIP);
    mockFetch(zip);

    const badConfig: DownloadConfig = {
      ...FAA_DOWNLOAD_CONFIG,
      entries: { ...FAA_DOWNLOAD_CONFIG.entries, missing: 'NOTEXIST.txt' },
    };

    await expect(download(badConfig)).rejects.toThrow(/not found/i);
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

  it('throws when the discovery fetch fails', async () => {
    mockFetchSequence([{ ok: false, status: 503, statusText: 'Service Unavailable', body: '' }]);

    await expect(download(DISCOVER_CONFIG)).rejects.toThrow(/discovery fetch failed.*503/i);
  });

  it('throws when the pattern matches no URL on the index page', async () => {
    mockFetchSequence([
      { ok: true, status: 200, statusText: 'OK', body: '<html><body>nothing here</body></html>' },
    ]);

    await expect(download(DISCOVER_CONFIG)).rejects.toThrow(
      /discovery pattern matched no url/i
    );
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
