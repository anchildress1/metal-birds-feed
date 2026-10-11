import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { Aircraft } from '../src/schema.js';
import type { EngineStats } from '../src/engine.js';
import type { SourceConfig } from '../src/types/config.js';

const mockLoadSourceConfig = mock();
const mockDownload = mock();
const mockMapSnapshots = mock();
const mockSeedHistory = mock();
const mockR2Constructor = mock();

void mock.module('../src/config/loader.js', () => ({ loadSourceConfig: mockLoadSourceConfig }));
void mock.module('../src/downloader.js', () => ({ download: mockDownload }));
void mock.module('../src/engine.js', () => ({ mapSnapshots: mockMapSnapshots }));
void mock.module('../src/logger.js', () => ({ log: mock() }));
void mock.module('../src/pipeline.js', () => ({
  r2ConfigFromEnv: () => ({}),
  validateSourceId: (id: string) => {
    if (id.includes('..')) throw new Error(`Path traversal rejected: ${id}`);
  },
}));
void mock.module('../src/writer.js', () => ({
  R2ArtifactWriter: class {
    constructor(...args: unknown[]) {
      mockR2Constructor(...args);
    }

    seedHistory = mockSeedHistory;
  },
}));

const { backfillHistory, replayHistory } = await import('../src/backfill.js');

const aircraft = (id: string): Aircraft => ({
  source: 'lt-tka',
  source_id: id,
  registration: id,
  icao_hex: null,
  icao_type_code: null,
  status: 'valid',
  country: 'LT',
  manufacturer: null,
  model: null,
  serial_number: null,
  year_manufactured: null,
  year_manufactured_range: null,
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
  propeller: null,
  home_base: null,
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
  interdiction_code: null,
});

const stats = (failed = 0): EngineStats => ({
  total: 1,
  ok: 1,
  failed,
  skipped: 0,
  duplicateSkipped: 0,
});
const snap = (snapshot: string, ids: string[], failed = 0) => ({
  snapshot,
  records: new Map(ids.map((id) => [id, aircraft(id)])),
  stats: stats(failed),
});
const byId = (rows: ReturnType<typeof replayHistory>['rows'], id: string) =>
  rows.filter((r) => r['source_id'] === id);

describe('replayHistory', () => {
  it('dates a row to the first publication it appears in', () => {
    const { rows } = replayHistory('x', [
      snap('2025-07-21', ['A']),
      snap('2025-10-21', ['A', 'B']),
    ]);

    expect(byId(rows, 'A')[0]).toMatchObject({ first_seen: '2025-07-21', removed_on: null });
    expect(byId(rows, 'B')[0]).toMatchObject({ first_seen: '2025-10-21', removed_on: null });
  });

  it('closes a row at the first publication that misses it, once a second one does too', () => {
    const { rows } = replayHistory('x', [
      snap('2025-07-21', ['A', 'B']),
      snap('2025-10-21', ['A']),
      snap('2026-03-09', ['A']),
    ]);

    expect(byId(rows, 'B')[0]).toMatchObject({
      first_seen: '2025-07-21',
      removed_on: '2025-10-21',
    });
  });

  it('leaves a row missing from only the newest publication still live', () => {
    const { rows } = replayHistory('x', [
      snap('2025-07-21', ['A', 'B']),
      snap('2025-10-21', ['A']),
    ]);

    expect(byId(rows, 'B')[0]).toMatchObject({ removed_on: null, missing_since: '2025-10-21' });
  });

  it('reopens a row that returns, keeping its first publication', () => {
    const { rows } = replayHistory('x', [
      snap('2025-07-21', ['A', 'B']),
      snap('2025-10-21', ['A']),
      snap('2026-01-01', ['A', 'B']),
    ]);

    expect(byId(rows, 'B')).toHaveLength(1);
    expect(byId(rows, 'B')[0]).toMatchObject({ first_seen: '2025-07-21', removed_on: null });
  });

  it('skips a publication with failed rows and says which', () => {
    const { rows, skipped } = replayHistory('x', [
      snap('2025-04-29', ['OLD'], 3),
      snap('2025-07-21', ['A']),
    ]);

    expect(skipped).toEqual(['2025-04-29']);
    expect(byId(rows, 'OLD')).toHaveLength(0);
    expect(byId(rows, 'A')[0]?.['first_seen']).toBe('2025-07-21');
  });

  it('applies publications oldest first however they arrive', () => {
    const { rows } = replayHistory('x', [snap('2025-07-21', ['A']), snap('2025-10-21', ['A'])]);

    expect(byId(rows, 'A')[0]?.['first_seen']).toBe('2025-07-21');
  });

  it('refuses a snapshot value that is not a date', () => {
    expect(() => replayHistory('x', [snap('2025-07', ['A'])])).toThrow(/not a YYYY-MM-DD date/);
  });

  it('refuses when the newest publication is the unusable one', () => {
    expect(() =>
      replayHistory('x', [snap('2025-07-21', ['A']), snap('2025-10-21', ['A'], 2)])
    ).toThrow(/newest publication is unusable/);
  });

  it('refuses when every publication is unusable', () => {
    expect(() => replayHistory('x', [snap('2025-07-21', ['A'], 1)])).toThrow(/unusable/);
  });
});

describe('backfillHistory', () => {
  const config = {
    id: 'lt-tka',
    download: { format: 'file', entries: {} },
  } as unknown as SourceConfig;

  beforeEach(() => {
    mockLoadSourceConfig.mockReset().mockReturnValue(config);
    mockDownload.mockReset().mockResolvedValue(new Map());
    mockMapSnapshots
      .mockReset()
      .mockResolvedValue([snap('2025-07-21', ['A']), snap('2025-10-21', ['A', 'B'])]);
    mockSeedHistory.mockReset().mockResolvedValue(undefined);
    mockR2Constructor.mockReset();
  });

  it('seeds the replayed rows and reports how many', async () => {
    const count = await backfillHistory('lt-tka', false);

    expect(count).toBe(2);
    expect(mockSeedHistory).toHaveBeenCalledTimes(1);
    const [source, rows, today] = mockSeedHistory.mock.calls[0] as [string, unknown[], string];
    expect(source).toBe('lt-tka');
    expect(rows).toHaveLength(2);
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('hands dry-run to the writer', async () => {
    await backfillHistory('lt-tka', true);

    expect(mockR2Constructor.mock.calls[0]?.[1]).toBe(true);
  });

  it('refuses a manual source, which keeps no accumulated publications', async () => {
    mockLoadSourceConfig.mockReturnValue({ ...config, download: { manual: true } });

    await expect(backfillHistory('lt-tka', false)).rejects.toThrow(/manual source/);
    expect(mockSeedHistory).not.toHaveBeenCalled();
  });

  it('rejects a traversal-bearing source id before touching anything', async () => {
    await expect(backfillHistory('../x', false)).rejects.toThrow(/Path traversal/);
    expect(mockDownload).not.toHaveBeenCalled();
  });
});
