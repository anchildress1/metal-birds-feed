import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

import { main, run } from '../src/pipeline.js';

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
  delete process.env['GITHUB_TOKEN'];
  delete process.env['GITHUB_REPOSITORY'];
  delete process.env['REFRESH_SOURCE'];
  vi.unstubAllGlobals();
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
    process.env['DRY_RUN'] = 'false';
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

  it('does not skip cadence-gated sources in dry-run mode', async () => {
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

    expect(result.skipped).toBe(false);
    expect(mockDownload).toHaveBeenCalledOnce();
    expect(mockR2Write).toHaveBeenCalledOnce();
    expect(mockWriteState).not.toHaveBeenCalled();
  });

  it('proceeds with download when cadence state is null (first run)', async () => {
    mockLoadSourceConfig.mockReturnValueOnce({ ...CONFIG, cadence_days: 30 });
    mockReadState.mockResolvedValueOnce(null);

    const result = await run('faa');

    expect(result.skipped).toBe(false);
    expect(mockDownload).toHaveBeenCalledOnce();
    expect(mockR2Write).toHaveBeenCalledOnce();
  });

  it('does not call readState or writeState when cadence_days is not configured', async () => {
    process.env['DRY_RUN'] = 'false';

    await run('faa');

    expect(mockReadState).not.toHaveBeenCalled();
    expect(mockWriteState).not.toHaveBeenCalled();
  });

  it.each(['../etc/passwd', 'faa/../secret', 'dir/faa'])(
    'rejects source ID containing path traversal or separator: %s',
    async (id) => {
      await expect(run(id)).rejects.toThrow(/path traversal/i);
    }
  );

  it('writes state with last_content_change=last_run when content changed', async () => {
    process.env['DRY_RUN'] = 'false';
    mockLoadSourceConfig.mockReturnValueOnce({ ...CONFIG, cadence_days: 30 });
    mockReadState.mockResolvedValueOnce(null);
    mockR2Write.mockResolvedValueOnce({
      put: 3,
      deleted: 0,
      skipped: 0,
      changed: true,
      record_count: 3,
    });

    await run('faa');

    expect(mockWriteState).toHaveBeenCalledOnce();
    const [, state] = mockWriteState.mock.calls[0] as [
      string,
      { last_run: string; last_content_change: string },
    ];
    expect(state.last_content_change).toBe(state.last_run);
  });

  it('preserves prior last_content_change in state when content is unchanged', async () => {
    process.env['DRY_RUN'] = 'false';
    const priorChange = '2026-04-01T00:00:00.000Z';
    mockLoadSourceConfig.mockReturnValueOnce({ ...CONFIG, cadence_days: 30 });
    mockReadState.mockResolvedValueOnce({
      last_run: new Date(Date.now() - 35 * 86_400_000).toISOString(),
      last_content_change: priorChange,
    });
    mockR2Write.mockResolvedValueOnce({
      put: 0,
      deleted: 0,
      skipped: 5,
      changed: false,
      record_count: 5,
    });

    await run('faa');

    const [, state] = mockWriteState.mock.calls[0] as [
      string,
      { last_run: string; last_content_change: string },
    ];
    expect(state.last_content_change).toBe(priorChange);
    expect(state.last_run).not.toBe(priorChange);
  });
});

describe('main', () => {
  it('opens a staleness issue when source is overdue and token is present', async () => {
    process.env['DRY_RUN'] = 'false';
    process.env['GITHUB_TOKEN'] = 'token';
    process.env['GITHUB_REPOSITORY'] = 'owner/repo';
    process.env['REFRESH_SOURCE'] = 'faa';
    const oldChange = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const recentRun = new Date(Date.now() - 5 * 86_400_000).toISOString();
    mockLoadSourceConfig.mockReturnValueOnce({ ...CONFIG, cadence_days: 30 });
    mockReadState.mockResolvedValueOnce({ last_run: recentRun, last_content_change: oldChange });
    mockR2Write.mockResolvedValueOnce({
      put: 0,
      deleted: 0,
      skipped: 0,
      changed: false,
      record_count: 0,
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // list open issues
      .mockResolvedValueOnce({ ok: true }); // create issue
    vi.stubGlobal('fetch', fetchMock);

    await main();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [[, createCall]] = [fetchMock.mock.calls[1]] as [[string, RequestInit]];
    const body = JSON.parse(createCall.body as string) as { title: string; labels: string[] };
    expect(body.labels).toContain('data-staleness');
    expect(body.title).toContain('[staleness] faa');
  });

  it('calls closeStalenessIssues when content changes on a cadence-tracked source', async () => {
    process.env['DRY_RUN'] = 'false';
    process.env['GITHUB_TOKEN'] = 'token';
    process.env['GITHUB_REPOSITORY'] = 'owner/repo';
    process.env['REFRESH_SOURCE'] = 'faa';
    const pastTimestamp = new Date(Date.now() - 35 * 86_400_000).toISOString();
    mockLoadSourceConfig.mockReturnValueOnce({ ...CONFIG, cadence_days: 30 });
    mockReadState.mockResolvedValueOnce({
      last_run: pastTimestamp,
      last_content_change: pastTimestamp,
    });
    mockR2Write.mockResolvedValueOnce({
      put: 1,
      deleted: 0,
      skipped: 0,
      changed: true,
      record_count: 1,
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ number: 7, title: '[staleness] faa went silent' }]),
      })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await main();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/issues/7');
  });

  it('makes no fetch calls when source has no cadence_days', async () => {
    process.env['DRY_RUN'] = 'false';
    process.env['GITHUB_TOKEN'] = 'token';
    process.env['GITHUB_REPOSITORY'] = 'owner/repo';
    process.env['REFRESH_SOURCE'] = 'faa';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await main();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exits with code 1 and logs pipeline_failed when a source run throws', async () => {
    process.env['DRY_RUN'] = 'false';
    process.env['REFRESH_SOURCE'] = 'faa';
    mockDownload.mockRejectedValueOnce(new Error('network timeout'));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await main();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockLog).toHaveBeenCalledWith(
      'error',
      'pipeline_failed',
      expect.objectContaining({ msg: 'network timeout' })
    );
    exitSpy.mockRestore();
  });

  it('writes a failure table to the job summary when a source fails', async () => {
    process.env['DRY_RUN'] = 'false';
    process.env['REFRESH_SOURCE'] = 'faa';
    const summaryPath = join(tmpdir(), `mbf-summary-${Date.now()}.md`);
    process.env['GITHUB_STEP_SUMMARY'] = summaryPath;
    mockDownload.mockRejectedValueOnce(new Error('We encountered an internal error.'));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    try {
      await main();

      const summary = readFileSync(summaryPath, 'utf8');
      expect(summary).toContain('## ❌ Refresh failures');
      expect(summary).toContain('| faa | We encountered an internal error. |');
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      exitSpy.mockRestore();
      rmSync(summaryPath, { force: true });
      delete process.env['GITHUB_STEP_SUMMARY'];
    }
  });

  it('does not attempt PATCH when closeStalenessIssues list fetch returns an error status', async () => {
    process.env['DRY_RUN'] = 'false';
    process.env['GITHUB_TOKEN'] = 'token';
    process.env['GITHUB_REPOSITORY'] = 'owner/repo';
    process.env['REFRESH_SOURCE'] = 'faa';
    const pastTimestamp = new Date(Date.now() - 35 * 86_400_000).toISOString();
    mockLoadSourceConfig.mockReturnValueOnce({ ...CONFIG, cadence_days: 30 });
    mockReadState.mockResolvedValueOnce({
      last_run: pastTimestamp,
      last_content_change: pastTimestamp,
    });
    mockR2Write.mockResolvedValueOnce({
      put: 1,
      deleted: 0,
      skipped: 0,
      changed: true,
      record_count: 1,
    });
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 403 });
    vi.stubGlobal('fetch', fetchMock);

    await main();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockLog).toHaveBeenCalledWith(
      'error',
      'staleness_close_list_failed',
      expect.objectContaining({ status: 403 })
    );
  });

  it('does not mutate GitHub staleness issues during dry-run', async () => {
    const staleTimestamp = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    process.env['REFRESH_SOURCE'] = 'faa';
    process.env['GITHUB_TOKEN'] = 'token';
    process.env['GITHUB_REPOSITORY'] = 'owner/repo';
    mockLoadSourceConfig.mockReturnValueOnce({
      ...CONFIG,
      cadence_days: 30,
    });
    mockReadState.mockResolvedValueOnce({
      last_run: staleTimestamp,
      last_content_change: staleTimestamp,
    });

    await main();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockDownload).toHaveBeenCalledOnce();
    expect(mockR2Write).toHaveBeenCalledOnce();
  });
});
