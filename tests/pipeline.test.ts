import { describe, it, expect, mock, spyOn, beforeEach, afterEach } from 'bun:test';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { SourceConfig } from '../src/types/config.js';
import type { Aircraft } from '../src/schema.js';
import { hashFeedRows } from '../src/feed.js';
import { DB_SCHEMA_VERSION } from '../src/db.js';

const REAL_FETCH = globalThis.fetch;
const setFetch = (fn: unknown): void => {
  globalThis.fetch = fn as typeof globalThis.fetch;
};

const mockLoadSourceConfig = mock();
const mockDownload = mock();
const mockFetchPublishedTotal = mock();
const mockTranslate = mock();
const mockR2Write = mock();
const mockR2Constructor = mock();
const mockReadState = mock();
const mockWriteState = mock();
const mockReadArtifactHeader = mock();
const mockFeedRowsExist = mock();
const mockWriteFeedRows = mock();
const mockReadFeedRows = mock();
const mockReadDeployedFeedHash = mock();
const mockWriteDeployedFeedHash = mock();
const mockLog = mock();
const mockLocalizeRecords = mock();

void mock.module('../src/config/loader.js', () => ({ loadSourceConfig: mockLoadSourceConfig }));
void mock.module('../src/downloader.js', () => ({
  download: mockDownload,
  fetchPublishedTotal: mockFetchPublishedTotal,
}));
void mock.module('../src/engine.js', () => ({ translate: mockTranslate }));
void mock.module('../src/localize/localize.js', () => ({ localizeRecords: mockLocalizeRecords }));
void mock.module('../src/logger.js', () => ({
  log: mockLog,
  errorMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));
void mock.module('../src/writer.js', () => ({
  R2ArtifactWriter: class {
    constructor(...args: unknown[]) {
      mockR2Constructor(...args);
    }

    write = mockR2Write;
    readState = mockReadState;
    writeState = mockWriteState;
    readArtifactHeader = mockReadArtifactHeader;
    feedRowsExist = mockFeedRowsExist;
    writeFeedRows = mockWriteFeedRows;
    readFeedRows = mockReadFeedRows;
    readDeployedFeedHash = mockReadDeployedFeedHash;
    writeDeployedFeedHash = mockWriteDeployedFeedHash;
  },
  // pipeline.ts reads this to decide whether a run is trustworthy enough to prune the translation
  // cache; a mock omitting it fails the import, not the assertion.
  MIN_RETAIN_RATIO: 0.5,
}));

const { main, publishFeed, publishFeedForDeploy, markFeedDeployed, resolveFeedOutputPath, run } =
  await import('../src/pipeline.js');

const CONFIG: SourceConfig = {
  id: 'faa',
  label: 'FAA',
  country: 'US',
  language: 'en',
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
const HASH64 = '0'.repeat(64);

// toFeedRows is the real implementation here (src/feed.js is not mocked), so any record reaching a
// non-dry-run write needs the full canonical shape, not a stub.
const aircraft = (overrides: Partial<Aircraft> = {}): Aircraft => ({
  source: 'faa',
  source_id: '1',
  registration: 'N1',
  icao_hex: 'a1b2c3',
  icao_type_code: null,
  status: 'valid',
  country: 'US',
  manufacturer: 'CESSNA',
  model: '172',
  serial_number: null,
  year_manufactured: null,
  airframe_type: null,
  category: null,
  build_certification: null,
  airworthiness_class: null,
  airworthiness_class_source_text: null,
  operating_environment: null,
  operational_classes: [],
  operational_classes_source_text: [],
  engine: {
    manufacturer: null,
    model: null,
    type: null,
    count: null,
    horsepower: null,
    thrust_lbs: null,
  },
  owner: { name: null, kind: null, state: null, country: null },
  operator: { name: null, kind: null, state: null, country: null },
  legal_owner: { name: null, kind: null, state: null, country: null },
  idera_authorised_party: null,
  certification_date: null,
  airworthiness_date: null,
  expiration_date: null,
  last_action_date: null,
  cruise_speed_ktas: null,
  max_takeoff_weight_kg: null,
  seats: null,
  max_passengers: null,
  min_crew: null,
  airworthiness_review_date: null,
  cancellation_reason: null,
  cancellation_reason_source_text: null,
  lien_status: null,
  lien_status_source_text: null,
  propeller: null,
  home_base: null,
  interdiction_code: null,
  ...overrides,
});

beforeEach(() => {
  process.env['MBF_R2_ACCOUNT_ID'] = 'account';
  process.env['MBF_R2_ACCESS_KEY_ID'] = 'key';
  process.env['MBF_R2_SECRET_ACCESS_KEY'] = 'secret';
  process.env['MBF_R2_BUCKET_NAME'] = 'bucket';
  process.env['DRY_RUN'] = 'true';
  delete process.env['REFRESH_SOURCE'];

  mockLoadSourceConfig.mockReset();
  mockDownload.mockReset();
  mockFetchPublishedTotal.mockReset();
  mockTranslate.mockReset();
  mockR2Write.mockReset();
  mockR2Constructor.mockReset();
  mockReadState.mockReset();
  mockWriteState.mockReset();
  mockReadArtifactHeader.mockReset();
  mockFeedRowsExist.mockReset();
  mockWriteFeedRows.mockReset();
  mockReadFeedRows.mockReset();
  mockReadDeployedFeedHash.mockReset();
  mockWriteDeployedFeedHash.mockReset();
  mockLog.mockReset();
  mockLocalizeRecords.mockReset();

  mockLoadSourceConfig.mockReturnValue(CONFIG);
  mockDownload.mockResolvedValue(new Map([['master', Buffer.from('')]]));
  mockTranslate.mockResolvedValue({
    records: new Map(),
    stats: { total: 1, ok: 1, failed: 0 },
  });
  mockLocalizeRecords.mockImplementation((records: unknown) =>
    Promise.resolve({
      records,
      stats: { candidates: 0, cache_hits: 0, translated: 0, failed: 0 },
    })
  );
  mockR2Write.mockResolvedValue({
    changed: false,
    record_count: 0,
    content_hash: 'h0',
  });
  mockReadState.mockResolvedValue(null);
  mockWriteState.mockResolvedValue(undefined);
  mockReadArtifactHeader.mockResolvedValue({
    schemaVersion: DB_SCHEMA_VERSION,
    lastModified: new Date(0),
  });
  mockFeedRowsExist.mockResolvedValue(true);
  mockWriteFeedRows.mockResolvedValue(undefined);
  mockReadFeedRows.mockResolvedValue([]);
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
  delete process.env['MBF_FEED_DB_OUT'];
  globalThis.fetch = REAL_FETCH;
});

describe('run', () => {
  it('writes translated records when every row succeeds', async () => {
    await run('faa');

    expect(mockR2Constructor).toHaveBeenCalledTimes(1);
    expect(mockR2Write).toHaveBeenCalledWith(expect.any(Map), 'faa', null, expect.any(String));
  });

  // The engine reads files, never the network, so the count body has to arrive as an argument.
  it('fetches the published total and hands it to the engine when a source declares one', async () => {
    mockLoadSourceConfig.mockReturnValue({
      ...CONFIG,
      record_count: { pattern: '(\\d+)', url: 'https://example.test/count', against: 'parsed' },
    });
    mockFetchPublishedTotal.mockResolvedValue('17571');

    await run('faa');

    expect(mockFetchPublishedTotal).toHaveBeenCalledWith(
      'https://example.test/count',
      CONFIG.download.headers
    );
    expect(mockTranslate).toHaveBeenCalledWith(expect.anything(), expect.any(Map), '17571');
  });

  it('skips the count fetch for a source that declares no endpoint', async () => {
    await run('faa');

    expect(mockFetchPublishedTotal).not.toHaveBeenCalled();
    expect(mockTranslate).toHaveBeenCalledWith(expect.anything(), expect.any(Map), undefined);
  });

  it('aborts write when any row fails translation', async () => {
    mockTranslate.mockResolvedValueOnce({
      records: new Map(),
      stats: { total: 10, ok: 9, failed: 1 },
    });

    await expect(run('faa')).rejects.toThrow(/aborting write/i);

    expect(mockR2Write).not.toHaveBeenCalled();
  });

  // The two maps must differ structurally: toHaveBeenCalledWith is deep equality, so
  // interchangeable-looking maps let a `localized` -> `records` regression pass silently and ship
  // untranslated text to both durable outputs.
  it('withholds cache pruning when the run is short enough to be a truncated upstream', async () => {
    // localizeRecords runs before writer.write can reject a truncated download, so the same
    // retain-ratio decides whether pruning is safe. Below it, paid translations must survive.
    mockReadState.mockResolvedValueOnce({
      last_run: '2020-01-01T00:00:00.000Z',
      last_content_change: '2020-01-01T00:00:00.000Z',
      record_count: 100,
      content_hash: 'a'.repeat(64),
      upstream_hash: 'b'.repeat(64),
    });

    await run('faa').catch(() => undefined);

    expect(mockLocalizeRecords).toHaveBeenCalledWith(
      expect.anything(),
      'faa',
      'en',
      expect.anything(),
      expect.any(Boolean),
      false
    );
  });

  it('writes localizeRecords output, not the pre-localization records, to both durable outputs', async () => {
    process.env['DRY_RUN'] = 'false';
    const translated = new Map([['1', aircraft({ cancellation_reason: 'AERONAVE EXPORTADA' })]]);
    const localized = new Map([['1', aircraft({ cancellation_reason: 'AIRCRAFT EXPORTED' })]]);
    mockTranslate.mockResolvedValueOnce({
      records: translated,
      stats: { total: 1, ok: 1, failed: 0 },
    });
    mockLocalizeRecords.mockResolvedValueOnce({
      records: localized,
      stats: { candidates: 1, cache_hits: 0, translated: 1, failed: 1 },
    });

    await run('faa');

    expect(mockLocalizeRecords).toHaveBeenCalledWith(
      translated,
      'faa',
      'en',
      expect.anything(),
      false,
      // allowPrune: no prior state in this fixture, so there is no truncation to guard against
      true
    );
    expect(mockR2Write).toHaveBeenCalledWith(localized, 'faa', null, expect.any(String));
    expect(mockWriteFeedRows).toHaveBeenCalledWith('faa', [
      expect.objectContaining({ cancellation_reason: 'AIRCRAFT EXPORTED' }),
    ]);
    expect(mockLog).toHaveBeenCalledWith(
      'warn',
      'localize_partial_failure',
      expect.objectContaining({ failed: 1 })
    );
  });

  it('propagates a localizeRecords rejection (e.g. missing API key) before any durable write', async () => {
    process.env['DRY_RUN'] = 'false';
    mockLocalizeRecords.mockRejectedValueOnce(
      new Error('Missing required environment variable: GEMINI_API_KEY')
    );

    await expect(run('faa')).rejects.toThrow('GEMINI_API_KEY');

    expect(mockR2Write).not.toHaveBeenCalled();
    expect(mockWriteFeedRows).not.toHaveBeenCalled();
    expect(mockWriteState).not.toHaveBeenCalled();
  });

  it('does not write state when the artifact write fails', async () => {
    // If state were stamped despite a failed PUT, its content_hash would mark the never-written
    // artifact as current and skip-if-unchanged would suppress every subsequent PUT — permanent
    // silent staleness. Correct today by code order only; this pins it.
    process.env['DRY_RUN'] = 'false';
    mockR2Write.mockRejectedValueOnce(new Error('PUT failed'));

    await expect(run('faa')).rejects.toThrow(/PUT failed/);

    expect(mockWriteState).not.toHaveBeenCalled();
  });

  it('does not write state when the feed slice write fails', async () => {
    process.env['DRY_RUN'] = 'false';
    mockWriteFeedRows.mockRejectedValueOnce(new Error('feed PUT failed'));

    await expect(run('faa')).rejects.toThrow('feed PUT failed');

    expect(mockWriteFeedRows).toHaveBeenCalledTimes(1);
    expect(mockWriteState).not.toHaveBeenCalled();
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
      content_hash: HASH64,
    });

    const result = await run('faa');

    expect(result.skipped).toBe(true);
    expect(mockDownload).not.toHaveBeenCalled();
    expect(mockR2Write).not.toHaveBeenCalled();
  });

  it('does not honor a cadence skip when the artifact is missing (self-heal)', async () => {
    // Otherwise-skippable per cadence, but the artifact object itself is gone (e.g. deleted
    // independently of its state) — writer.write()'s self-heal path only runs when write() is
    // actually called, so honoring the skip here would leave the artifact 404ing for consumers
    // until the cadence window passes.
    process.env['DRY_RUN'] = 'false';
    const recentTimestamp = new Date(Date.now() - 5 * 86_400_000).toISOString();
    mockLoadSourceConfig.mockReturnValueOnce({
      ...CONFIG,
      cadence_days: 30,
    });
    mockReadState.mockResolvedValueOnce({
      last_run: recentTimestamp,
      last_content_change: recentTimestamp,
      content_hash: HASH64,
    });
    mockReadArtifactHeader.mockResolvedValueOnce(null);

    const result = await run('faa');

    expect(result.skipped).toBe(false);
    expect(mockDownload).toHaveBeenCalledTimes(1);
    expect(mockR2Write).toHaveBeenCalledTimes(1);
  });

  // content_hash's DB_SCHEMA_VERSION salt (writer.ts) only takes effect once write() actually
  // runs — a cadence-gated source honoring the skip on state alone could otherwise carry a
  // stale-schema artifact for up to its full cadence window after a schema bump.
  it('does not honor a cadence skip when the artifact carries a stale schema version', async () => {
    process.env['DRY_RUN'] = 'false';
    const recentTimestamp = new Date(Date.now() - 5 * 86_400_000).toISOString();
    mockLoadSourceConfig.mockReturnValueOnce({ ...CONFIG, cadence_days: 30 });
    mockReadState.mockResolvedValueOnce({
      last_run: recentTimestamp,
      last_content_change: recentTimestamp,
      content_hash: HASH64,
    });
    mockReadArtifactHeader.mockResolvedValueOnce({
      schemaVersion: DB_SCHEMA_VERSION - 1,
      lastModified: new Date(0),
    });

    const result = await run('faa');

    expect(result.skipped).toBe(false);
    expect(mockDownload).toHaveBeenCalledTimes(1);
    expect(mockR2Write).toHaveBeenCalledTimes(1);
  });

  // A prior run's write() can succeed (artifact now current) while writeFeedRows/writeState then
  // fail (e.g. a transient R2 outage) — state's last_run stays stale, but the artifact's
  // lastModified is newer than it. Trusting schema version alone would read that as fully caught
  // up and skip retrying the stale feed slice for up to the full cadence window.
  it('does not honor a cadence skip when the artifact was modified after the last recorded run', async () => {
    process.env['DRY_RUN'] = 'false';
    const recentTimestamp = new Date(Date.now() - 5 * 86_400_000).toISOString();
    mockLoadSourceConfig.mockReturnValueOnce({ ...CONFIG, cadence_days: 30 });
    mockReadState.mockResolvedValueOnce({
      last_run: recentTimestamp,
      last_content_change: recentTimestamp,
      content_hash: HASH64,
    });
    mockReadArtifactHeader.mockResolvedValueOnce({
      schemaVersion: DB_SCHEMA_VERSION,
      lastModified: new Date(),
    });

    const result = await run('faa');

    expect(result.skipped).toBe(false);
    expect(mockDownload).toHaveBeenCalledTimes(1);
    expect(mockR2Write).toHaveBeenCalledTimes(1);
  });

  it('does not honor a cadence skip when the feed slice is missing', async () => {
    process.env['DRY_RUN'] = 'false';
    const recentTimestamp = new Date(Date.now() - 5 * 86_400_000).toISOString();
    mockLoadSourceConfig.mockReturnValueOnce({ ...CONFIG, cadence_days: 30 });
    mockReadState.mockResolvedValueOnce({
      last_run: recentTimestamp,
      last_content_change: recentTimestamp,
      content_hash: HASH64,
    });
    mockFeedRowsExist.mockResolvedValueOnce(false);

    const result = await run('faa');

    expect(result.skipped).toBe(false);
    expect(mockDownload).toHaveBeenCalledTimes(1);
    expect(mockWriteFeedRows).toHaveBeenCalledTimes(1);
    expect(mockWriteState).toHaveBeenCalledTimes(1);
  });

  it('does not skip cadence-gated sources when prior state has no content hash', async () => {
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

    expect(result.skipped).toBe(false);
    expect(mockDownload).toHaveBeenCalledTimes(1);
    expect(mockR2Write).toHaveBeenCalledTimes(1);
    expect(mockWriteState).toHaveBeenCalledTimes(1);
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
    expect(mockDownload).toHaveBeenCalledTimes(1);
    expect(mockR2Write).toHaveBeenCalledTimes(1);
    expect(mockWriteState).not.toHaveBeenCalled();
  });

  it('proceeds with download when cadence state is null (first run)', async () => {
    mockLoadSourceConfig.mockReturnValueOnce({ ...CONFIG, cadence_days: 30 });
    mockReadState.mockResolvedValueOnce(null);

    const result = await run('faa');

    expect(result.skipped).toBe(false);
    expect(mockDownload).toHaveBeenCalledTimes(1);
    expect(mockR2Write).toHaveBeenCalledTimes(1);
  });

  it('reads and writes state even without cadence_days (for content-hash skip)', async () => {
    process.env['DRY_RUN'] = 'false';

    await run('faa');

    expect(mockReadState).toHaveBeenCalledTimes(1);
    expect(mockWriteState).toHaveBeenCalledTimes(1);
    const [, state] = mockWriteState.mock.calls[0] as [string, { content_hash: string }];
    expect(state.content_hash).toBe('h0');
  });

  it.each(['../etc/passwd', 'faa/../secret', 'dir/faa'])(
    'rejects source ID containing path traversal or separator: %s',
    async (id: string) => {
      await expect(run(id)).rejects.toThrow(/path traversal/i);
    }
  );

  it('writes state with last_content_change=last_run when content changed', async () => {
    process.env['DRY_RUN'] = 'false';
    mockLoadSourceConfig.mockReturnValueOnce({ ...CONFIG, cadence_days: 30 });
    mockReadState.mockResolvedValueOnce(null);
    mockR2Write.mockResolvedValueOnce({
      changed: true,
      record_count: 3,
      content_hash: 'h',
    });

    await run('faa');

    expect(mockWriteState).toHaveBeenCalledTimes(1);
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
      changed: false,
      record_count: 5,
      content_hash: 'h',
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

describe('feed publication', () => {
  const outputPath = join('tests', `.feed-${process.pid}.sqlite`);

  afterEach(() => {
    rmSync(outputPath, { force: true });
    for (const file of readdirSync('tests').filter((name) =>
      name.startsWith(`.feed-${process.pid}`)
    ))
      rmSync(join('tests', file), { force: true });
  });

  it('resolves relative and in-root absolute output paths inside the sandbox', () => {
    const root = resolve('tests');

    expect(resolveFeedOutputPath('feed.sqlite', root)).toBe(join(root, 'feed.sqlite'));
    expect(resolveFeedOutputPath(join(root, 'feed.sqlite'), root)).toBe(join(root, 'feed.sqlite'));
  });

  it.each(['../feed.sqlite', '/tmp/feed.sqlite'])(
    'rejects output path outside the sandbox: %s',
    (path) => {
      expect(() => resolveFeedOutputPath(path, resolve('tests'))).toThrow(/path/i);
    }
  );

  it('refuses to publish when any configured source slice is missing', async () => {
    process.env['DRY_RUN'] = 'false';
    process.env['MBF_FEED_DB_OUT'] = outputPath;
    mockReadFeedRows.mockResolvedValueOnce([]).mockResolvedValueOnce(null);

    await expect(publishFeed(['faa', 'tc-ca'], false)).rejects.toThrow(
      'Missing feed rows for: tc-ca'
    );

    expect(mockReadFeedRows.mock.calls.map((call) => String(call[0]))).toEqual(['faa', 'tc-ca']);
    expect(existsSync(outputPath)).toBe(false);
  });

  it('preserves the prior database and propagates a source read failure', async () => {
    process.env['DRY_RUN'] = 'false';
    process.env['MBF_FEED_DB_OUT'] = outputPath;
    writeFileSync(outputPath, 'prior database');
    mockReadFeedRows.mockRejectedValueOnce(new Error('R2 unavailable'));

    await expect(publishFeed(['faa'], false)).rejects.toThrow('R2 unavailable');

    expect(readFileSync(outputPath, 'utf8')).toBe('prior database');
    expect(mockLog).toHaveBeenCalledWith(
      'error',
      'feed_publish_failed',
      expect.objectContaining({ msg: 'R2 unavailable' })
    );
  });

  it('publishes all requested source slices atomically', async () => {
    process.env['DRY_RUN'] = 'false';
    process.env['MBF_FEED_DB_OUT'] = outputPath;
    mockReadFeedRows.mockResolvedValue([]);

    await publishFeed(['faa', 'tc-ca'], false);

    expect(mockReadFeedRows.mock.calls.map((call) => String(call[0]))).toEqual(['faa', 'tc-ca']);
    expect(readFileSync(outputPath).subarray(0, 6).toString()).toBe('SQLite');
    expect(
      readdirSync('tests').some((name) => name.includes(`.feed-${process.pid}.sqlite.tmp-`))
    ).toBe(false);
  });

  it('returns the feed content hash on publish, and null when no output is configured', async () => {
    process.env['DRY_RUN'] = 'false';
    process.env['MBF_FEED_DB_OUT'] = outputPath;
    mockReadFeedRows.mockResolvedValue([]);

    expect(await publishFeed(['faa'], false)).toBe(hashFeedRows([]));

    delete process.env['MBF_FEED_DB_OUT'];
    expect(await publishFeed(['faa'], false)).toBeNull();
  });

  it('reports the feed changed when it differs from the deployed marker', async () => {
    process.env['DRY_RUN'] = 'false';
    process.env['MBF_FEED_DB_OUT'] = outputPath;
    mockReadFeedRows.mockResolvedValue([]);
    mockReadDeployedFeedHash.mockResolvedValue('f'.repeat(64));

    expect(await publishFeedForDeploy(['faa'])).toEqual({ changed: true, hash: hashFeedRows([]) });
  });

  it('reports the feed unchanged when it matches the deployed marker', async () => {
    process.env['DRY_RUN'] = 'false';
    process.env['MBF_FEED_DB_OUT'] = outputPath;
    mockReadFeedRows.mockResolvedValue([]);
    mockReadDeployedFeedHash.mockResolvedValue(hashFeedRows([]));

    expect(await publishFeedForDeploy(['faa'])).toEqual({ changed: false, hash: hashFeedRows([]) });
  });

  it('reports unchanged without consulting the marker when nothing is published', async () => {
    delete process.env['MBF_FEED_DB_OUT'];

    expect(await publishFeedForDeploy(['faa'])).toEqual({ changed: false, hash: null });
    expect(mockReadDeployedFeedHash).not.toHaveBeenCalled();
  });

  it('records a deployed hash and rejects an empty one', async () => {
    mockWriteDeployedFeedHash.mockResolvedValue(undefined);

    await markFeedDeployed(HASH64);
    expect(mockWriteDeployedFeedHash).toHaveBeenCalledWith(HASH64);

    await expect(markFeedDeployed('   ')).rejects.toThrow('non-empty feed hash');
    await expect(markFeedDeployed(undefined)).rejects.toThrow('non-empty feed hash');
  });

  it('publishes every configured source when REFRESH_SOURCE narrows the refresh', async () => {
    process.env['DRY_RUN'] = 'false';
    process.env['REFRESH_SOURCE'] = 'faa';
    process.env['MBF_FEED_DB_OUT'] = outputPath;
    mockReadFeedRows.mockResolvedValue([]);
    const expectedSources = readdirSync('sources')
      .filter((file) => file.endsWith('.yaml'))
      .map((file) => file.replace(/\.yaml$/, ''))
      .sort();

    await main();

    expect(mockDownload).toHaveBeenCalledTimes(1);
    expect(mockReadFeedRows.mock.calls.map((call) => String(call[0]))).toEqual(expectedSources);
    expect(readFileSync(outputPath).subarray(0, 6).toString()).toBe('SQLite');
  });
});

describe('main', () => {
  it('falls back to every sources/*.yaml file when REFRESH_SOURCE is unset', async () => {
    // No REFRESH_SOURCE set — resolveSources must read the real sources/ directory instead of
    // running a single hardcoded source, fanning out across every real config in the repo.
    const yamlCount = readdirSync('sources').filter((f) => f.endsWith('.yaml')).length;

    await main();

    expect(mockDownload.mock.calls).toHaveLength(yamlCount);
  });

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
      changed: false,
      record_count: 0,
      content_hash: 'h',
    });
    const fetchMock = mock()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // list open issues
      .mockResolvedValueOnce({ ok: true }); // create issue
    setFetch(fetchMock);

    await main();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [[, createCall]] = [fetchMock.mock.calls[1]] as [[string, RequestInit]];
    const body = JSON.parse(createCall.body as string) as { title: string; labels: string[] };
    expect(body.labels).toContain('data-staleness');
    expect(body.title).toContain('[staleness] faa');
  });

  it('opens a staleness issue for an overdue source even when cadence skips the run', async () => {
    // Cadence-skipped sources are exactly the ones most likely stuck (recent last_run, ancient
    // last_content_change); a refactor adding `if (skipped) continue` would kill their alarm.
    process.env['DRY_RUN'] = 'false';
    process.env['GITHUB_TOKEN'] = 'token';
    process.env['GITHUB_REPOSITORY'] = 'owner/repo';
    process.env['REFRESH_SOURCE'] = 'faa';
    const oldChange = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const recentRun = new Date(Date.now() - 5 * 86_400_000).toISOString();
    mockLoadSourceConfig.mockReturnValueOnce({ ...CONFIG, cadence_days: 30 });
    mockReadState.mockResolvedValueOnce({
      last_run: recentRun,
      last_content_change: oldChange,
      content_hash: HASH64,
    });
    const fetchMock = mock()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // list open issues
      .mockResolvedValueOnce({ ok: true }); // create issue
    setFetch(fetchMock);

    await main();

    expect(mockDownload).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [[, createCall]] = [fetchMock.mock.calls[1]] as [[string, RequestInit]];
    const body = JSON.parse(createCall.body as string) as { title: string };
    expect(body.title).toContain('[staleness] faa');
  });

  it('logs and skips issue creation when the open-issues list fetch fails', async () => {
    process.env['DRY_RUN'] = 'false';
    process.env['GITHUB_TOKEN'] = 'token';
    process.env['GITHUB_REPOSITORY'] = 'owner/repo';
    process.env['REFRESH_SOURCE'] = 'faa';
    const oldChange = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const recentRun = new Date(Date.now() - 5 * 86_400_000).toISOString();
    mockLoadSourceConfig.mockReturnValueOnce({ ...CONFIG, cadence_days: 30 });
    mockReadState.mockResolvedValueOnce({
      last_run: recentRun,
      last_content_change: oldChange,
      content_hash: HASH64,
    });
    const fetchMock = mock().mockResolvedValueOnce({ ok: false, status: 500 });
    setFetch(fetchMock);

    await main();

    // Failing to list means we never risk creating a duplicate issue blind.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockLog).toHaveBeenCalledWith(
      'error',
      'staleness_issue_list_failed',
      expect.objectContaining({ source: 'faa', status: 500 })
    );
  });

  it('logs when the staleness issue create call fails', async () => {
    process.env['DRY_RUN'] = 'false';
    process.env['GITHUB_TOKEN'] = 'token';
    process.env['GITHUB_REPOSITORY'] = 'owner/repo';
    process.env['REFRESH_SOURCE'] = 'faa';
    const oldChange = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const recentRun = new Date(Date.now() - 5 * 86_400_000).toISOString();
    mockLoadSourceConfig.mockReturnValueOnce({ ...CONFIG, cadence_days: 30 });
    mockReadState.mockResolvedValueOnce({
      last_run: recentRun,
      last_content_change: oldChange,
      content_hash: HASH64,
    });
    const fetchMock = mock()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // list open issues
      .mockResolvedValueOnce({ ok: false, status: 422 }); // create issue
    setFetch(fetchMock);

    await main();

    expect(mockLog).toHaveBeenCalledWith(
      'error',
      'staleness_issue_create_failed',
      expect.objectContaining({ source: 'faa', status: 422 })
    );
  });

  it('logs when the staleness issue create request rejects', async () => {
    process.env['DRY_RUN'] = 'false';
    process.env['GITHUB_TOKEN'] = 'token';
    process.env['GITHUB_REPOSITORY'] = 'owner/repo';
    process.env['REFRESH_SOURCE'] = 'faa';
    const oldChange = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const recentRun = new Date(Date.now() - 5 * 86_400_000).toISOString();
    mockLoadSourceConfig.mockReturnValueOnce({ ...CONFIG, cadence_days: 30 });
    mockReadState.mockResolvedValueOnce({
      last_run: recentRun,
      last_content_change: oldChange,
      content_hash: HASH64,
    });
    const fetchMock = mock()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
      .mockRejectedValueOnce(new Error('socket reset'));
    setFetch(fetchMock);

    await main();

    expect(mockLog).toHaveBeenCalledWith('error', 'staleness_issue_error', {
      source: 'faa',
      msg: 'socket reset',
    });
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
      changed: true,
      record_count: 1,
      content_hash: 'h',
    });
    const fetchMock = mock()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([{ number: 7, title: '[staleness] faa has not updated in 40 days' }]),
      })
      .mockResolvedValueOnce({ ok: true });
    setFetch(fetchMock);

    await main();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/issues/7');
  });

  it('logs staleness_close_failed when the close PATCH call rejects', async () => {
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
      changed: true,
      record_count: 1,
      content_hash: 'h',
    });
    const fetchMock = mock()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([{ number: 7, title: '[staleness] faa has not updated in 40 days' }]),
      })
      .mockRejectedValueOnce(new Error('network blip'));
    setFetch(fetchMock);

    await main();

    expect(mockLog).toHaveBeenCalledWith(
      'error',
      'staleness_close_failed',
      expect.objectContaining({ source: 'faa', msg: 'network blip' })
    );
  });

  it('logs staleness_close_error when closeStalenessIssues itself rejects', async () => {
    // Distinct from the PATCH-rejects case above: here the *list* call throws, so
    // closeStalenessIssues itself rejects rather than handling the failure internally —
    // this is the outer .catch() in closeWithLogging, not the Promise.allSettled loop.
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
      changed: true,
      record_count: 1,
      content_hash: 'h',
    });
    const fetchMock = mock().mockRejectedValueOnce(new Error('DNS failure'));
    setFetch(fetchMock);

    await main();

    expect(mockLog).toHaveBeenCalledWith(
      'error',
      'staleness_close_error',
      expect.objectContaining({ source: 'faa', msg: 'DNS failure' })
    );
  });

  it('does not close a sibling source whose name shares this source as a prefix', async () => {
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
      changed: true,
      record_count: 1,
      content_hash: 'h',
    });
    const fetchMock = mock().mockResolvedValueOnce({
      ok: true,
      // Only a sibling source's issue is open; `faa` must not match `faa-uas`.
      json: () =>
        Promise.resolve([{ number: 9, title: '[staleness] faa-uas has not updated in 40 days' }]),
    });
    setFetch(fetchMock);

    await main();

    // List call only — no PATCH to close the sibling's issue.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('makes no fetch calls when source has no cadence_days', async () => {
    process.env['DRY_RUN'] = 'false';
    process.env['GITHUB_TOKEN'] = 'token';
    process.env['GITHUB_REPOSITORY'] = 'owner/repo';
    process.env['REFRESH_SOURCE'] = 'faa';
    const fetchMock = mock();
    setFetch(fetchMock);

    await main();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exits with code 1 and logs pipeline_failed when a source run throws', async () => {
    process.env['DRY_RUN'] = 'false';
    process.env['REFRESH_SOURCE'] = 'faa';
    mockDownload.mockRejectedValueOnce(new Error('network timeout'));
    const exitSpy = spyOn(process, 'exit').mockImplementation(() => undefined as never);

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
    const exitSpy = spyOn(process, 'exit').mockImplementation(() => undefined as never);

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
      changed: true,
      record_count: 1,
      content_hash: 'h',
    });
    const fetchMock = mock().mockResolvedValueOnce({ ok: false, status: 403 });
    setFetch(fetchMock);

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
    const fetchMock = mock();
    setFetch(fetchMock);
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
    expect(mockDownload).toHaveBeenCalledTimes(1);
    expect(mockR2Write).toHaveBeenCalledTimes(1);
  });
});
