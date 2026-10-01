import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SourceConfig } from '../src/types/config.js';

const mockLoadSourceConfig = mock();
const mockMapRows = mock();
const mockWriteDrop = mock();
const mockR2Constructor = mock();

void mock.module('../src/config/loader.js', () => ({ loadSourceConfig: mockLoadSourceConfig }));
void mock.module('../src/engine.js', () => ({ mapRows: mockMapRows }));
void mock.module('../src/logger.js', () => ({ log: mock() }));
void mock.module('../src/writer.js', () => ({
  R2ArtifactWriter: class {
    constructor(...args: unknown[]) {
      mockR2Constructor(...args);
    }

    writeDrop = mockWriteDrop;
  },
}));

const { ingest, resolveDropPath, DROP_DIR } = await import('../src/manual-drop.js');

const MANUAL: SourceConfig = {
  id: 'th-caat',
  label: 'CAAT',
  country: 'TH',
  language: 'en',
  encoding: 'utf8',
  download: {
    url: 'https://example.test/register.pdf',
    format: 'file',
    manual: true,
    entries: { register: 'register.pdf' },
  },
  primary: 'register',
  delimiter: ',',
  trim_all: true,
  format: 'pdf',
  joins: [],
  source_id: 'REG',
  registration: 'REG',
  mapping: {},
};

const FILE = `${DROP_DIR}/_test-ingest.pdf`;
const ROOT = resolve('.');

beforeEach(() => {
  process.env['MBF_R2_ACCOUNT_ID'] = 'account';
  process.env['MBF_R2_ACCESS_KEY_ID'] = 'key';
  process.env['MBF_R2_SECRET_ACCESS_KEY'] = 'secret';
  process.env['MBF_R2_BUCKET_NAME'] = 'bucket';
  mockLoadSourceConfig.mockReset().mockReturnValue(MANUAL);
  mockMapRows.mockReset().mockResolvedValue({
    records: new Map([['1', {}]]),
    stats: { total: 1, ok: 1, failed: 0 },
  });
  mockWriteDrop.mockReset().mockResolvedValue(undefined);
  mockR2Constructor.mockReset();
  mkdirSync(DROP_DIR, { recursive: true });
  writeFileSync(FILE, '%PDF-test');
});

afterEach(() => {
  rmSync(FILE, { force: true });
  for (const key of [
    'MBF_R2_ACCOUNT_ID',
    'MBF_R2_ACCESS_KEY_ID',
    'MBF_R2_SECRET_ACCESS_KEY',
    'MBF_R2_BUCKET_NAME',
  ])
    delete process.env[key];
});

describe('resolveDropPath', () => {
  it('resolves a file inside drops/', () => {
    expect(resolveDropPath('drops/register.pdf', ROOT)).toBe(resolve(ROOT, 'drops/register.pdf'));
  });

  it('accepts an absolute path inside drops/', () => {
    const abs = resolve(ROOT, 'drops/sub/register.pdf');
    expect(resolveDropPath(abs, ROOT)).toBe(abs);
  });

  it('rejects any path carrying ..', () => {
    expect(() => resolveDropPath('drops/../sources/faa.yaml', ROOT)).toThrow(/traversal/);
  });

  it.each(['sources/faa.yaml', '/etc/passwd', 'drops', 'dropsy/register.pdf'])(
    'rejects %s as outside drops/',
    (input) => {
      expect(() => resolveDropPath(input, ROOT)).toThrow(/inside drops\//);
    }
  );
});

describe('ingest', () => {
  it('stores the file bytes once they map cleanly', async () => {
    expect(await ingest('th-caat', FILE, false)).toBe(1);

    const files = mockMapRows.mock.calls[0]?.[1] as Map<string, Buffer>;
    expect(files.get('register')?.toString()).toBe('%PDF-test');
    expect(mockWriteDrop).toHaveBeenCalledWith('th-caat', expect.any(Buffer));
    expect(String(mockWriteDrop.mock.calls[0]?.[1])).toBe('%PDF-test');
  });

  it('hands dry-run to the writer', async () => {
    await ingest('th-caat', FILE, true);

    expect(mockR2Constructor.mock.calls[0]?.[1]).toBe(true);
  });

  // Every later refresh reads the stored drop, so a bad file stored once fails the source daily.
  it('refuses to store a file with failing rows', async () => {
    mockMapRows.mockResolvedValue({
      records: new Map([['1', {}]]),
      stats: { total: 2, ok: 1, failed: 1 },
    });

    await expect(ingest('th-caat', FILE, false)).rejects.toThrow(/1 failures.*not stored/);
    expect(mockWriteDrop).not.toHaveBeenCalled();
  });

  it('refuses to store a file that maps to nothing', async () => {
    mockMapRows.mockResolvedValue({ records: new Map(), stats: { total: 0, ok: 0, failed: 0 } });

    await expect(ingest('th-caat', FILE, false)).rejects.toThrow(/mapped 0 records/);
    expect(mockWriteDrop).not.toHaveBeenCalled();
  });

  it('refuses a source the pipeline fetches itself', async () => {
    mockLoadSourceConfig.mockReturnValue({
      ...MANUAL,
      download: { ...MANUAL.download, manual: undefined },
    });

    await expect(ingest('faa', FILE, false)).rejects.toThrow(/not a download\.manual source/);
    expect(mockMapRows).not.toHaveBeenCalled();
  });

  it('rejects a traversal-bearing source id before loading anything', async () => {
    await expect(ingest('../faa', FILE, false)).rejects.toThrow(/traversal/);
    expect(mockLoadSourceConfig).not.toHaveBeenCalled();
  });

  it('rejects a file outside drops/ before reading it', async () => {
    await expect(ingest('th-caat', 'sources/faa.yaml', false)).rejects.toThrow(/inside drops\//);
    expect(mockMapRows).not.toHaveBeenCalled();
  });
});
