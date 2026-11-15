import { describe, it, expect, mock, spyOn, afterEach } from 'bun:test';
import type { SourceState } from '../src/cadence.js';

const writer = await import('../src/writer.js');
const r2Constructor = mock();
const r2ReadState = mock<(source: string) => Promise<null>>(() => Promise.resolve(null));
void mock.module('../src/writer.js', () => ({
  ...writer,
  R2ArtifactWriter: class {
    constructor(...args: unknown[]) {
      r2Constructor(...args);
    }

    readState = r2ReadState;
  },
}));
const { reportSourceState } = await import('../src/state-report.js');

const NOW = new Date('2026-11-14T12:00:00Z');
const state = (lastChange: string): SourceState => ({
  last_run: '2026-11-14T10:00:00.000Z',
  last_content_change: lastChange,
  record_count: 2955,
  content_hash: 'a'.repeat(64),
  upstream_hash: 'b'.repeat(64),
});
const reader = (s: SourceState | null) => () => Promise.resolve(s);

const logSpy = spyOn(console, 'log').mockImplementation(() => {});
afterEach(() => logSpy.mockClear());

describe('reportSourceState', () => {
  it('reports stored state against the threshold, and logs the report', async () => {
    const report = await reportSourceState(
      'lt-tka',
      reader(state('2026-10-24T13:24:31.179Z')),
      NOW
    );
    expect(report).toEqual({
      source: 'lt-tka',
      last_run: '2026-11-14T10:00:00.000Z',
      last_content_change: '2026-10-24T13:24:31.179Z',
      record_count: 2955,
      cadence_days: 41,
      paused: true,
      threshold_days: 61.5,
      days_since_change: 20,
      overdue: false,
    });
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('event=source_state source=lt-tka');
  });

  it('flags a source silent past 1.5x its cadence', async () => {
    const report = await reportSourceState('lt-tka', reader(state('2026-09-01T00:00:00Z')), NOW);
    expect(report.overdue).toBe(true);
    expect(report.days_since_change).toBe(74);
  });

  it('reports nulls, not overdue, for a source with no stored state', async () => {
    const report = await reportSourceState('lt-tka', reader(null), NOW);
    expect(report).toMatchObject({
      last_run: null,
      last_content_change: null,
      record_count: null,
      days_since_change: null,
      overdue: false,
    });
  });

  it('reports a change age but no threshold for a source with no cadence', async () => {
    const report = await reportSourceState('au-casa', reader(state('2026-11-02T12:00:00Z')), NOW);
    expect(report).toMatchObject({
      cadence_days: null,
      paused: false,
      threshold_days: null,
      days_since_change: 12,
      overdue: false,
    });
  });

  it('flags overdue past the unrounded threshold, before the rounded one', async () => {
    const report = await reportSourceState('lt-tka', reader(state('2026-09-13T18:00:00Z')), NOW);
    expect(report).toMatchObject({ threshold_days: 61.5, days_since_change: 61, overdue: true });
  });

  it.each([
    ['', 'usage: make state SOURCE=<id>, or set REFRESH_SOURCE in .env'],
    ['../lt-tka', 'Path traversal rejected'],
  ])('rejects source id %p before reading state', async (id, message) => {
    let read = false;
    await expect(
      reportSourceState(
        id,
        () => {
          read = true;
          return Promise.resolve(null);
        },
        NOW
      )
    ).rejects.toThrow(message);
    expect(read).toBe(false);
  });

  it('reads the stored state from R2 by default', async () => {
    const env = {
      MBF_R2_ACCOUNT_ID: 'a',
      MBF_R2_ACCESS_KEY_ID: 'k',
      MBF_R2_SECRET_ACCESS_KEY: 's',
      MBF_R2_BUCKET_NAME: 'b',
    };
    const saved = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
    Object.assign(process.env, env);
    try {
      await reportSourceState('lt-tka');
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
    expect(r2Constructor).toHaveBeenCalledWith({
      accountId: 'a',
      accessKeyId: 'k',
      secretAccessKey: 's',
      bucketName: 'b',
    });
    expect(r2ReadState).toHaveBeenCalledWith('lt-tka');
  });

  it('rejects an unknown source before reading state', async () => {
    const readState = mock(() => Promise.resolve(null));
    await expect(reportSourceState('xx-none', readState, NOW)).rejects.toThrow('ENOENT');
    expect(readState).not.toHaveBeenCalled();
  });
});
