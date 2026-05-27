import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SourceConfig } from '../src/types/config.js';

const mockLoadSourceConfig = vi.hoisted(() => vi.fn());
const mockDownload = vi.hoisted(() => vi.fn());
const mockTranslate = vi.hoisted(() => vi.fn());
const mockR2Write = vi.hoisted(() => vi.fn());
const mockR2Constructor = vi.hoisted(() => vi.fn());
const mockReadState = vi.hoisted(() => vi.fn());
const mockWriteState = vi.hoisted(() => vi.fn());
const mockLog = vi.hoisted(() => vi.fn());

vi.mock('../src/config/loader.js', () => ({ loadSourceConfig: mockLoadSourceConfig }));
vi.mock('../src/downloader.js', () => ({ download: mockDownload }));
vi.mock('../src/engine.js', () => ({ translate: mockTranslate }));
vi.mock('../src/logger.js', () => ({ log: mockLog }));
vi.mock('../src/writer.js', () => ({
  R2DiffWriter: class {
    constructor(...args: unknown[]) {
      mockR2Constructor(...args);
    }

    write = mockR2Write;
    readState = mockReadState;
    writeState = mockWriteState;
  },
}));

import { run } from '../src/pipeline.js';

const CONFIG: SourceConfig = {
  id: 'faa',
  label: 'FAA',
  country: 'US',
  encoding: 'latin1',
  download: {
    url: 'https://registry.faa.gov/database/ReleasableAircraft.zip',
    format: 'zip',
    entries: { master: 'MASTER.txt' },
  },
  primary: 'master',
  delimiter: ',',
  trim_all: true,
  format: 'csv',
  joins: [],
  source_id: 'UNIQUE ID',
  registration: 'N-NUMBER',
  mapping: {},
};

beforeEach(() => {
  process.env['MBF_R2_ACCOUNT_ID'] = 'account';
  process.env['MBF_R2_ACCESS_KEY_ID'] = 'key';
  process.env['MBF_R2_SECRET_ACCESS_KEY'] = 'secret';
  process.env['MBF_R2_BUCKET_NAME'] = 'bucket';
  process.env['DRY_RUN'] = 'true';

  mockLoadSourceConfig.mockReset();
  mockDownload.mockReset();
  mockTranslate.mockReset();
  mockR2Write.mockReset();
  mockR2Constructor.mockReset();
  mockReadState.mockReset();
  mockWriteState.mockReset();
  mockLog.mockReset();

  mockLoadSourceConfig.mockReturnValue(CONFIG);
  mockDownload.mockResolvedValue(new Map([['master', Buffer.from('')]]));
  mockTranslate.mockResolvedValue({
    records: new Map(),
    stats: { total: 1, ok: 1, failed: 0 },
  });
  mockR2Write.mockResolvedValue({
    put: 0,
    deleted: 0,
    skipped: 0,
    changed: false,
    record_count: 0,
  });
  mockReadState.mockResolvedValue(null);
  mockWriteState.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env['MBF_R2_ACCOUNT_ID'];
  delete process.env['MBF_R2_ACCESS_KEY_ID'];
  delete process.env['MBF_R2_SECRET_ACCESS_KEY'];
  delete process.env['MBF_R2_BUCKET_NAME'];
  delete process.env['DRY_RUN'];
});

describe('run', () => {
  it('writes translated records when every row succeeds', async () => {
    await run('faa');

    expect(mockR2Constructor).toHaveBeenCalledOnce();
    expect(mockR2Write).toHaveBeenCalledWith(expect.any(Map), 'faa');
  });

  it('aborts write when any row fails translation', async () => {
    mockTranslate.mockResolvedValueOnce({
      records: new Map(),
      stats: { total: 10, ok: 9, failed: 1 },
    });

    await expect(run('faa')).rejects.toThrow(/aborting write/i);

    expect(mockR2Write).not.toHaveBeenCalled();
  });

  it('skips download and write when cadence check says not due', async () => {
    const recentTimestamp = new Date(Date.now() - 5 * 86_400_000).toISOString();
    mockLoadSourceConfig.mockReturnValueOnce({
      ...CONFIG,
      cadence_days: 30,
    });
    mockReadState.mockResolvedValueOnce({
      last_run: recentTimestamp,
      last_content_change: recentTimestamp,
    });

    const result = await run('faa');

    expect(result.skipped).toBe(true);
    expect(mockDownload).not.toHaveBeenCalled();
    expect(mockR2Write).not.toHaveBeenCalled();
  });

  it('proceeds with download when cadence state is null (first run)', async () => {
    mockLoadSourceConfig.mockReturnValueOnce({ ...CONFIG, cadence_days: 30 });
    mockReadState.mockResolvedValueOnce(null);

    const result = await run('faa');

    expect(result.skipped).toBe(false);
    expect(mockDownload).toHaveBeenCalledOnce();
    expect(mockR2Write).toHaveBeenCalledOnce();
  });
});
