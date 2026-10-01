import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { SourceConfig } from '../src/types/config.js';
import type { SourceState } from '../src/cadence.js';
import { assertRecordCountForWrite } from '../src/writer.js';

const mockLoadSourceConfig = mock();
const mockMapRows = mock();
const mockWriteDrop = mock();
const mockR2Constructor = mock();
const mockReadState = mock();

void mock.module('../src/config/loader.js', () => ({ loadSourceConfig: mockLoadSourceConfig }));
void mock.module('../src/engine.js', () => ({ mapRows: mockMapRows }));
void mock.module('../src/logger.js', () => ({ log: mock() }));
void mock.module('../src/writer.js', () => ({
  assertRecordCountForWrite,
  R2ArtifactWriter: class {
    constructor(...args: unknown[]) {
      mockR2Constructor(...args);
    }

    writeDrop = mockWriteDrop;
    readState = mockReadState;
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
const PRIOR: SourceState = {
  last_run: '2026-09-01T00:00:00Z',
  last_content_change: '2026-09-01T00:00:00Z',
  record_count: 1000,
  content_hash: '0'.repeat(64),
  upstream_hash: '0'.repeat(64),
};

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
  mockReadState.mockReset().mockResolvedValue(null);
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
  let root: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'mbf-drop-path-')));
    mkdirSync(join(root, DROP_DIR, 'sub'), { recursive: true });
    writeFileSync(join(root, DROP_DIR, 'register.pdf'), '%PDF-test');
    writeFileSync(join(root, DROP_DIR, 'sub', 'register.pdf'), '%PDF-test');
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('resolves a file inside drops/', () => {
    expect(resolveDropPath('drops/register.pdf', root)).toBe(resolve(root, 'drops/register.pdf'));
  });

  it('accepts an absolute path inside drops/', () => {
    const abs = resolve(root, 'drops/sub/register.pdf');
    expect(resolveDropPath(abs, root)).toBe(abs);
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

  it.each(['file', 'directory'])('rejects an escaping %s symlink', (kind) => {
    const outside = join(root, 'outside');
    mkdirSync(outside);
    writeFileSync(join(outside, 'register.pdf'), '%PDF-outside');
    const link = join(root, DROP_DIR, 'link');
    symlinkSync(kind === 'file' ? join(outside, 'register.pdf') : outside, link);

    const input = kind === 'file' ? 'drops/link' : 'drops/link/register.pdf';
    expect(() => resolveDropPath(input, root)).toThrow(/inside drops\//);
  });

  it('rejects a drops directory symlink pointing outside the sandbox', () => {
    rmSync(join(root, DROP_DIR), { recursive: true });
    mkdirSync(join(root, 'outside'));
    writeFileSync(join(root, 'outside/register.pdf'), '%PDF-outside');
    symlinkSync(join(root, 'outside'), join(root, DROP_DIR));

    expect(() => resolveDropPath('drops/register.pdf', root)).toThrow(/inside drops\//);
  });

  it('returns the canonical target of a symlink staying inside drops', () => {
    symlinkSync(join(root, DROP_DIR, 'register.pdf'), join(root, DROP_DIR, 'link.pdf'));

    expect(resolveDropPath('drops/link.pdf', root)).toBe(join(root, DROP_DIR, 'register.pdf'));
  });

  it('accepts a repository root reached through a symlink', () => {
    const alias = join(root, 'workspace');
    symlinkSync(root, alias);

    expect(resolveDropPath('drops/register.pdf', alias)).toBe(join(root, DROP_DIR, 'register.pdf'));
  });

  it('rejects a missing file', () => {
    expect(() => resolveDropPath('drops/missing.pdf', root)).toThrow(/ENOENT/);
  });

  it('rejects a dangling symlink', () => {
    symlinkSync(join(root, 'missing.pdf'), join(root, DROP_DIR, 'link.pdf'));

    expect(() => resolveDropPath('drops/link.pdf', root)).toThrow(/ENOENT/);
  });
});

describe('ingest', () => {
  it('stores the file bytes once they map cleanly', async () => {
    expect(await ingest('th-caat', FILE, false)).toBe(1);

    const files = mockMapRows.mock.calls[0]?.[1] as Map<string, Buffer>;
    expect(files.get('register')?.toString()).toBe('%PDF-test');
    expect(mockWriteDrop).toHaveBeenCalledWith('th-caat', expect.any(Buffer));
    expect(String(mockWriteDrop.mock.calls[0]?.[1])).toBe('%PDF-test');
    expect(mockReadState).toHaveBeenCalledWith('th-caat');
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

  it('preserves the previous drop when refresh would reject the replacement count', async () => {
    const previous = Buffer.from('previous good drop');
    let stored: Buffer = previous;
    mockReadState.mockResolvedValue(PRIOR);
    mockWriteDrop.mockImplementation((_source: string, bytes: Buffer) => {
      stored = bytes;
      return Promise.resolve();
    });

    await expect(ingest('th-caat', FILE, false)).rejects.toThrow(/drop from prior 1000/);
    expect(stored).toBe(previous);
    expect(mockWriteDrop).not.toHaveBeenCalled();
  });

  it.each([1, 2, 0])(
    'accepts a replacement with one record against prior count %i',
    async (count) => {
      mockReadState.mockResolvedValue({ ...PRIOR, record_count: count });

      expect(await ingest('th-caat', FILE, false)).toBe(1);
      expect(mockWriteDrop).toHaveBeenCalledTimes(1);
    }
  );

  it('counts mapped cancelled records before feed filtering', async () => {
    mockReadState.mockResolvedValue({ ...PRIOR, record_count: 4 });
    mockMapRows.mockResolvedValue({
      records: new Map([
        ['1', { status: 'valid' }],
        ['2', { status: 'cancelled' }],
      ]),
      stats: { total: 2, ok: 2, failed: 0 },
    });

    expect(await ingest('th-caat', FILE, false)).toBe(2);
    expect(mockWriteDrop).toHaveBeenCalledTimes(1);
  });

  it('preserves the previous drop when prior state cannot be read', async () => {
    mockReadState.mockRejectedValue(new Error('state unavailable'));

    await expect(ingest('th-caat', FILE, false)).rejects.toThrow('state unavailable');
    expect(mockWriteDrop).not.toHaveBeenCalled();
  });

  it('applies the refresh acceptance guard in dry-run', async () => {
    mockReadState.mockResolvedValue(PRIOR);

    await expect(ingest('th-caat', FILE, true)).rejects.toThrow(/drop from prior 1000/);
    expect(mockWriteDrop).not.toHaveBeenCalled();
  });

  it('propagates parser failures without reading state or storing bytes', async () => {
    mockMapRows.mockRejectedValue(new Error('invalid PDF'));

    await expect(ingest('th-caat', FILE, false)).rejects.toThrow('invalid PDF');
    expect(mockReadState).not.toHaveBeenCalled();
    expect(mockWriteDrop).not.toHaveBeenCalled();
  });

  it('propagates a drop upload failure', async () => {
    mockWriteDrop.mockRejectedValue(new Error('drop upload denied'));

    await expect(ingest('th-caat', FILE, false)).rejects.toThrow('drop upload denied');
    expect(mockReadState).toHaveBeenCalledWith('th-caat');
    expect(mockWriteDrop).toHaveBeenCalledTimes(1);
  });

  it('rejects an escaping symlink before mapping or storing its target', async () => {
    const link = `${DROP_DIR}/_test-ingest-link.pdf`;
    symlinkSync(resolve('fixtures/th-caat/input/register.pdf'), link);
    try {
      await expect(ingest('th-caat', link, false)).rejects.toThrow(/inside drops\//);
      expect(mockMapRows).not.toHaveBeenCalled();
      expect(mockWriteDrop).not.toHaveBeenCalled();
    } finally {
      rmSync(link, { force: true });
    }
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
