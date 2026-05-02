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
    master: 'ReleasableAircraft/MASTER.txt',
    acftref: 'ReleasableAircraft/ACFTREF.txt',
    engine: 'ReleasableAircraft/ENGINE.txt',
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
    expect(master).toContain('N12345');
  });

  it('throws when fetch response is not ok', async () => {
    mockFetch(Buffer.alloc(0), false, 404);

    await expect(download(FAA_DOWNLOAD_CONFIG)).rejects.toThrow(/404/);
  });

  it('throws when a required alias is missing from the ZIP', async () => {
    const zip = readFileSync(FIXTURE_ZIP);
    mockFetch(zip);

    const badConfig: DownloadConfig = {
      ...FAA_DOWNLOAD_CONFIG,
      entries: { ...FAA_DOWNLOAD_CONFIG.entries, missing: 'ReleasableAircraft/NOTEXIST.txt' },
    };

    await expect(download(badConfig)).rejects.toThrow(/not found/i);
  });
});
