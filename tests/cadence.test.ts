import { describe, it, expect } from 'bun:test';
import {
  shouldSkip,
  isOverdue,
  buildStalenessEntry,
  buildSummaryMarkdown,
  stalenessThresholdDays,
  STALENESS_MULTIPLIER,
} from '../src/cadence.js';
import type { SourceState, StalenessEntry } from '../src/cadence.js';

const HASH64 = 'a'.repeat(64);
const HASH_UP = 'b'.repeat(64);

const DAY_MS = 86_400_000;

const entryFor = (
  source: string,
  cadence: number,
  state: SourceState | null,
  now: Date
): StalenessEntry => {
  const entry = buildStalenessEntry(source, { cadence_days: cadence }, state, now);
  if (entry === null) throw new Error('a cadence source must yield an entry');
  return entry;
};

// Absolute, because a relative offset would make the UTC-day assertions depend on the wall clock.
const stateAt = (lastRun: string, lastChange: string): SourceState => ({
  last_run: lastRun,
  last_content_change: lastChange,
  record_count: 1000,
  content_hash: HASH64,
  upstream_hash: HASH_UP,
});

const makeState = (lastRunDaysAgo: number, lastChangeDaysAgo: number): SourceState => {
  const now = Date.now();
  return {
    last_run: new Date(now - lastRunDaysAgo * DAY_MS).toISOString(),
    last_content_change: new Date(now - lastChangeDaysAgo * DAY_MS).toISOString(),
    record_count: 1000,
    content_hash: HASH64,
    upstream_hash: HASH_UP,
  };
};

describe('stalenessThresholdDays', () => {
  it('uses stale_after_days over the cadence-derived threshold', () => {
    expect(stalenessThresholdDays({ cadence_days: 30, stale_after_days: 90 })).toBe(90);
  });

  it('derives 1.5x cadence_days when stale_after_days is absent', () => {
    expect(stalenessThresholdDays({ cadence_days: 7 })).toBe(10.5);
  });

  it('uses stale_after_days alone for a source polled every tick', () => {
    expect(stalenessThresholdDays({ stale_after_days: 280 })).toBe(280);
  });

  it('is undefined for a source declaring neither', () => {
    expect(stalenessThresholdDays({})).toBeUndefined();
  });
});

describe('shouldSkip', () => {
  it('returns false for a source with no cadence_days, even with an alarm', () => {
    expect(shouldSkip(makeState(0, 0), { stale_after_days: 30 }, new Date())).toBe(false);
  });

  it('escalates at stale_after_days, not 1.5x cadence', () => {
    const now = new Date('2026-09-02T06:03:00.000Z');
    // cadence 7 alone would escalate past 10.5 days; 20 silent days stays inside 30.
    const state = stateAt('2026-09-01T06:11:00.000Z', '2026-08-13T06:11:00.000Z');
    expect(shouldSkip(state, { cadence_days: 7, stale_after_days: 30 }, now)).toBe(true);
    expect(shouldSkip(state, { cadence_days: 7, stale_after_days: 15 }, now)).toBe(false);
  });

  it('returns false when state is null (no prior run)', () => {
    expect(shouldSkip(null, { cadence_days: 30 }, new Date())).toBe(false);
  });

  it('returns true when last_run is within cadence window', () => {
    const state = makeState(10, 10);
    expect(shouldSkip(state, { cadence_days: 30 }, new Date())).toBe(true);
  });

  it('returns false when last_run is outside cadence window', () => {
    const state = makeState(31, 31);
    expect(shouldSkip(state, { cadence_days: 30 }, new Date())).toBe(false);
  });

  it('returns false at exactly the cadence boundary (not strictly less)', () => {
    const now = new Date();
    const state: SourceState = {
      last_run: new Date(now.getTime() - 30 * DAY_MS).toISOString(),
      last_content_change: new Date(now.getTime() - 30 * DAY_MS).toISOString(),
      record_count: 1,
      content_hash: HASH64,
      upstream_hash: HASH_UP,
    };
    expect(shouldSkip(state, { cadence_days: 30 }, now)).toBe(false);
  });

  it('returns false when last_run is an invalid date string', () => {
    const state: SourceState = {
      last_run: 'not-a-date',
      last_content_change: '2026-01-01',
      record_count: 1,
      content_hash: HASH64,
      upstream_hash: HASH_UP,
    };
    expect(shouldSkip(state, { cadence_days: 30 }, new Date())).toBe(false);
  });

  it('returns true for a 1-day cadence already run earlier the same UTC day', () => {
    const now = new Date('2026-09-02T18:00:00.000Z');
    const state = stateAt('2026-09-02T06:11:00.000Z', '2026-09-02T06:11:00.000Z');
    expect(shouldSkip(state, { cadence_days: 1 }, now)).toBe(true);
  });

  // Regression: a strict ms window halved the effective rate of every `cadence_days: 1` source.
  it('does not skip a 1-day cadence on the next daily tick despite a sub-24h gap', () => {
    const state = stateAt('2026-09-01T06:11:00.000Z', '2026-09-01T06:11:00.000Z');
    const nextTick = new Date('2026-09-02T06:03:00.000Z');
    expect(nextTick.getTime() - new Date(state.last_run).getTime()).toBeLessThan(DAY_MS);
    expect(shouldSkip(state, { cadence_days: 1 }, nextTick)).toBe(false);
  });

  it('does not skip a 7-day cadence on the seventh daily tick despite a sub-7-day gap', () => {
    const state = stateAt('2026-09-01T06:11:00.000Z', '2026-08-30T06:11:00.000Z');
    const seventhTick = new Date('2026-09-08T06:03:00.000Z');
    expect(seventhTick.getTime() - new Date(state.last_run).getTime()).toBeLessThan(7 * DAY_MS);
    expect(shouldSkip(state, { cadence_days: 7 }, seventhTick)).toBe(false);
  });

  it('still skips a 7-day cadence on the sixth daily tick', () => {
    const state = stateAt('2026-09-01T06:11:00.000Z', '2026-08-30T06:11:00.000Z');
    expect(shouldSkip(state, { cadence_days: 7 }, new Date('2026-09-07T06:03:00.000Z'))).toBe(true);
  });

  it('returns false for an overdue source even when it ran minutes ago', () => {
    const now = new Date('2026-09-02T06:03:00.000Z');
    // cadence 7 → overdue past 10.5 days; 12 qualifies.
    const state = stateAt('2026-09-02T05:58:00.000Z', '2026-08-21T06:11:00.000Z');
    expect(isOverdue(state, 7 * STALENESS_MULTIPLIER, now)).toBe(true);
    expect(shouldSkip(state, { cadence_days: 7 }, now)).toBe(false);
  });

  it('keeps skipping a source that is inside the cadence window and not yet overdue', () => {
    const now = new Date('2026-09-02T06:03:00.000Z');
    const state = stateAt('2026-09-01T06:11:00.000Z', '2026-08-29T06:11:00.000Z');
    expect(isOverdue(state, 7 * STALENESS_MULTIPLIER, now)).toBe(false);
    expect(shouldSkip(state, { cadence_days: 7 }, now)).toBe(true);
  });

  it('skips while last_run is in the future and the content is not overdue', () => {
    const state: SourceState = {
      last_run: new Date(Date.now() + 10 * DAY_MS).toISOString(),
      last_content_change: new Date().toISOString(),
      record_count: 1,
      content_hash: HASH64,
      upstream_hash: HASH_UP,
    };
    expect(shouldSkip(state, { cadence_days: 30 }, new Date())).toBe(true);
  });

  it('does not let a future last_run suppress an overdue source', () => {
    const state: SourceState = {
      last_run: new Date(Date.now() + 10 * DAY_MS).toISOString(),
      last_content_change: new Date(Date.now() - 60 * DAY_MS).toISOString(),
      record_count: 1,
      content_hash: HASH64,
      upstream_hash: HASH_UP,
    };
    expect(shouldSkip(state, { cadence_days: 30 }, new Date())).toBe(false);
  });

  // isOverdue fails open on an unparseable timestamp to keep the alarm armed; the gate must not
  // follow it, or a value that never heals would refetch the register on every tick forever.
  it('keeps skipping inside the window when last_content_change cannot be parsed', () => {
    const state: SourceState = {
      last_run: new Date(Date.now() - 1 * DAY_MS).toISOString(),
      last_content_change: 'not-a-date',
      record_count: 1,
      content_hash: HASH64,
      upstream_hash: HASH_UP,
    };
    expect(isOverdue(state, 30 * STALENESS_MULTIPLIER, new Date())).toBe(true);
    expect(shouldSkip(state, { cadence_days: 30 }, new Date())).toBe(true);
  });
});

describe('isOverdue', () => {
  it('returns false when state is null', () => {
    expect(isOverdue(null, 30 * STALENESS_MULTIPLIER, new Date())).toBe(false);
  });

  it('returns false when last_content_change is recent', () => {
    const state = makeState(10, 10);
    expect(isOverdue(state, 30 * STALENESS_MULTIPLIER, new Date())).toBe(false);
  });

  it('returns true when last_content_change exceeds 1.5× cadence', () => {
    const state = makeState(1, 50); // 50 days ago, cadence 30 → threshold 45 days
    expect(isOverdue(state, 30 * STALENESS_MULTIPLIER, new Date())).toBe(true);
  });

  it('returns false at exactly the staleness threshold (not strictly greater)', () => {
    const cadence = 30;
    const threshold = cadence * STALENESS_MULTIPLIER;
    const now = new Date();
    const state: SourceState = {
      last_run: new Date(now.getTime() - DAY_MS).toISOString(),
      last_content_change: new Date(now.getTime() - threshold * DAY_MS).toISOString(),
      record_count: 1,
      content_hash: HASH64,
      upstream_hash: HASH_UP,
    };
    expect(isOverdue(state, threshold, now)).toBe(false);
  });

  it('returns true when last_content_change is an invalid date string (fail open)', () => {
    // A garbage timestamp never heals itself; returning false would disarm the staleness alarm
    // for that source forever.
    const state: SourceState = {
      last_run: '2026-01-01',
      last_content_change: 'bad-date',
      record_count: 1,
      content_hash: HASH64,
      upstream_hash: HASH_UP,
    };
    expect(isOverdue(state, 30 * STALENESS_MULTIPLIER, new Date())).toBe(true);
  });

  it.each([
    ['within the skew tolerance', 5 * 60_000, false],
    ['exactly at the skew tolerance', 10 * 60_000, false],
    ['beyond the skew tolerance', 10 * 60_000 + 1, true],
    ['far in the future', 10 * DAY_MS, true],
  ])('treats a last_content_change %s ahead of the clock correctly', (_label, ahead, expected) => {
    const now = new Date('2026-10-16T12:00:00.000Z');
    const state: SourceState = {
      last_run: now.toISOString(),
      last_content_change: new Date(now.getTime() + ahead).toISOString(),
      record_count: 1,
      content_hash: HASH64,
      upstream_hash: HASH_UP,
    };
    expect(isOverdue(state, 30 * STALENESS_MULTIPLIER, now)).toBe(expected);
  });

  it('does not escalate the cadence gate on a last_content_change beyond the skew tolerance', () => {
    const now = new Date('2026-10-16T12:00:00.000Z');
    const state: SourceState = {
      last_run: now.toISOString(),
      last_content_change: new Date(now.getTime() + 10 * DAY_MS).toISOString(),
      record_count: 1,
      content_hash: HASH64,
      upstream_hash: HASH_UP,
    };
    expect(isOverdue(state, 1 * STALENESS_MULTIPLIER, now)).toBe(true);
    expect(shouldSkip(state, { cadence_days: 1 }, new Date(now.getTime() + 0))).toBe(true);
  });

  it('returns true for an annual source silent for two years', () => {
    const state = makeState(30, 730);
    expect(isOverdue(state, 365 * STALENESS_MULTIPLIER, new Date())).toBe(true);
  });
});

describe('buildStalenessEntry', () => {
  it('marks overdue when change is older than 1.5× cadence', () => {
    const state = makeState(1, 50);
    const entry = entryFor('faa', 30, state, new Date());
    expect(entry.overdue).toBe(true);
    expect(entry.source).toBe('faa');
    expect(entry.cadence_days).toBe(30);
    expect(entry.days_since_change).toBeGreaterThanOrEqual(50);
  });

  it('marks ok when change is within cadence', () => {
    const state = makeState(5, 15);
    const entry = entryFor('tc-ca', 30, state, new Date());
    expect(entry.overdue).toBe(false);
    expect(entry.days_since_change).toBeGreaterThanOrEqual(15);
  });

  it('returns last_content_change: null and days_since_change: null when state is null', () => {
    const entry = entryFor('nl-ilt', 30, null, new Date());
    expect(entry.last_content_change).toBeNull();
    expect(entry.days_since_change).toBeNull();
    expect(entry.overdue).toBe(false);
  });

  it('returns days_since_change: null and overdue when last_content_change is unparseable', () => {
    const state: SourceState = {
      last_run: new Date().toISOString(),
      last_content_change: 'not-a-valid-date',
      record_count: 1,
      content_hash: HASH64,
      upstream_hash: HASH_UP,
    };
    const entry = entryFor('faa', 30, state, new Date());
    expect(entry.days_since_change).toBeNull();
    expect(entry.last_content_change).toBe('not-a-valid-date');
    expect(entry.overdue).toBe(true);
  });

  it('clamps skew within the tolerance to 0 days, not overdue', () => {
    const now = new Date('2026-10-16T12:00:00.000Z');
    const state: SourceState = {
      ...makeState(1, 0),
      last_content_change: new Date(now.getTime() + 5 * 60_000).toISOString(),
    };
    const entry = entryFor('faa', 30, state, now);
    expect(entry.days_since_change).toBe(0);
    expect(entry.overdue).toBe(false);
  });

  it('reports a last_content_change beyond the skew tolerance as unknown and overdue', () => {
    const now = new Date('2026-10-16T12:00:00.000Z');
    const state: SourceState = {
      ...makeState(1, 0),
      last_content_change: new Date(now.getTime() + 3 * DAY_MS).toISOString(),
    };
    const entry = entryFor('faa', 30, state, now);
    expect(entry.days_since_change).toBeNull();
    expect(entry.overdue).toBe(true);
  });

  it('floors whole days since the last change', () => {
    const now = new Date('2026-10-16T12:00:00.000Z');
    const state: SourceState = {
      ...makeState(1, 0),
      last_content_change: '2026-10-13T18:00:00.000Z',
    };
    expect(entryFor('faa', 30, state, now).days_since_change).toBe(2);
  });
});

describe('buildStalenessEntry alarm config', () => {
  it('returns null for a source declaring no alarm', () => {
    expect(buildStalenessEntry('x', {}, makeState(1, 500), new Date())).toBeNull();
  });

  it('judges a source with both keys against stale_after_days, keeping its cadence', () => {
    const entry = buildStalenessEntry(
      'lt-tka',
      { cadence_days: 7, stale_after_days: 30 },
      makeState(1, 20),
      new Date()
    );
    expect(entry).toMatchObject({ cadence_days: 7, threshold_days: 30, overdue: false });
  });

  it('reports a daily-polled source against stale_after_days', () => {
    const entry = buildStalenessEntry(
      'lk-caasl',
      { stale_after_days: 280 },
      makeState(1, 300),
      new Date()
    );
    expect(entry).toMatchObject({ cadence_days: null, threshold_days: 280, overdue: true });
  });
});

describe('buildSummaryMarkdown', () => {
  it('returns empty string for empty entries', () => {
    expect(buildSummaryMarkdown([])).toBe('');
  });

  it('includes header row and separator', () => {
    const state = makeState(5, 15);
    const entries = [entryFor('faa', 30, state, new Date())];
    const md = buildSummaryMarkdown(entries);
    expect(md).toContain('## Source cadence status');
    expect(md).toContain('| Source | Cadence (days)');
    expect(md).toContain('| --- |');
  });

  it('marks overdue entries with ⚠️ and ok entries with ✅', () => {
    const now = new Date();
    const okState = makeState(1, 10);
    const overdueState = makeState(1, 50);
    const entries = [entryFor('faa', 30, okState, now), entryFor('tc-ca', 30, overdueState, now)];
    const md = buildSummaryMarkdown(entries);
    expect(md).toContain('✅ ok');
    expect(md).toContain('⚠️ overdue');
  });

  it('sorts entries alphabetically by source', () => {
    const state = makeState(1, 5);
    const now = new Date();
    const entries = [
      entryFor('tw-caa', 30, state, now),
      entryFor('faa', 30, state, now),
      entryFor('nl-ilt', 30, state, now),
    ];
    const md = buildSummaryMarkdown(entries);
    const faaIdx = md.indexOf('faa');
    const nlIdx = md.indexOf('nl-ilt');
    const twIdx = md.indexOf('tw-caa');
    expect(faaIdx).toBeLessThan(nlIdx);
    expect(nlIdx).toBeLessThan(twIdx);
  });

  it('shows "never" for entries with no prior state', () => {
    const entries = [entryFor('faa', 30, null, new Date())];
    const md = buildSummaryMarkdown(entries);
    expect(md).toContain('never');
    expect(md).toContain('unknown');
  });

  it('populates all six columns with correct values', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const state: SourceState = {
      last_run: '2026-05-31T00:00:00.000Z',
      last_content_change: '2026-05-16T00:00:00.000Z',
      record_count: 1,
      content_hash: HASH64,
      upstream_hash: HASH_UP,
    };
    const entries = [entryFor('faa', 30, state, now)];
    const md = buildSummaryMarkdown(entries);
    expect(md).toContain('| faa | 30 | 45 | 2026-05-16T00:00:00.000Z | 16 | ✅ ok |');
  });

  it('shows "daily" as the cadence of a source with only stale_after_days', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const entry = buildStalenessEntry('nl-ilt', { stale_after_days: 11 }, null, now);
    expect(buildSummaryMarkdown(entry === null ? [] : [entry])).toContain(
      '| nl-ilt | daily | 11 |'
    );
  });
});
