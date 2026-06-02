import { describe, it, expect } from 'vitest';
import {
  shouldSkip,
  isOverdue,
  buildStalenessEntry,
  buildSummaryMarkdown,
  STALENESS_MULTIPLIER,
} from '../src/cadence.js';
import type { SourceState } from '../src/cadence.js';

const DAY_MS = 86_400_000;

const makeState = (lastRunDaysAgo: number, lastChangeDaysAgo: number): SourceState => {
  const now = Date.now();
  return {
    last_run: new Date(now - lastRunDaysAgo * DAY_MS).toISOString(),
    last_content_change: new Date(now - lastChangeDaysAgo * DAY_MS).toISOString(),
    record_count: 1000,
  };
};

describe('shouldSkip', () => {
  it('returns false when state is null (no prior run)', () => {
    expect(shouldSkip(null, 30, new Date())).toBe(false);
  });

  it('returns true when last_run is within cadence window', () => {
    const state = makeState(10, 10);
    expect(shouldSkip(state, 30, new Date())).toBe(true);
  });

  it('returns false when last_run is outside cadence window', () => {
    const state = makeState(31, 31);
    expect(shouldSkip(state, 30, new Date())).toBe(false);
  });

  it('returns false at exactly the cadence boundary (not strictly less)', () => {
    const now = new Date();
    const state: SourceState = {
      last_run: new Date(now.getTime() - 30 * DAY_MS).toISOString(),
      last_content_change: new Date(now.getTime() - 30 * DAY_MS).toISOString(),
    };
    expect(shouldSkip(state, 30, now)).toBe(false);
  });

  it('returns false when last_run is an invalid date string', () => {
    const state: SourceState = { last_run: 'not-a-date', last_content_change: '2026-01-01' };
    expect(shouldSkip(state, 30, new Date())).toBe(false);
  });

  it('returns true for a 1-day cadence run 12 hours ago', () => {
    const state = makeState(0.5, 0.5);
    expect(shouldSkip(state, 1, new Date())).toBe(true);
  });

  it('returns true when last_run is in the future (clock skew permanently suppresses until that date passes)', () => {
    const state: SourceState = {
      last_run: new Date(Date.now() + 10 * DAY_MS).toISOString(),
      last_content_change: new Date().toISOString(),
    };
    expect(shouldSkip(state, 30, new Date())).toBe(true);
  });
});

describe('isOverdue', () => {
  it('returns false when state is null', () => {
    expect(isOverdue(null, 30, new Date())).toBe(false);
  });

  it('returns false when last_content_change is recent', () => {
    const state = makeState(10, 10);
    expect(isOverdue(state, 30, new Date())).toBe(false);
  });

  it('returns true when last_content_change exceeds 1.5× cadence', () => {
    const state = makeState(1, 50); // 50 days ago, cadence 30 → threshold 45 days
    expect(isOverdue(state, 30, new Date())).toBe(true);
  });

  it('returns false at exactly the staleness threshold (not strictly greater)', () => {
    const cadence = 30;
    const threshold = cadence * STALENESS_MULTIPLIER;
    const now = new Date();
    const state: SourceState = {
      last_run: new Date(now.getTime() - DAY_MS).toISOString(),
      last_content_change: new Date(now.getTime() - threshold * DAY_MS).toISOString(),
    };
    expect(isOverdue(state, cadence, now)).toBe(false);
  });

  it('returns false when last_content_change is an invalid date string', () => {
    const state: SourceState = { last_run: '2026-01-01', last_content_change: 'bad-date' };
    expect(isOverdue(state, 30, new Date())).toBe(false);
  });

  it('returns true for an annual source silent for two years', () => {
    const state = makeState(30, 730);
    expect(isOverdue(state, 365, new Date())).toBe(true);
  });
});

describe('buildStalenessEntry', () => {
  it('marks overdue when change is older than 1.5× cadence', () => {
    const state = makeState(1, 50);
    const entry = buildStalenessEntry('faa', 30, state, new Date());
    expect(entry.overdue).toBe(true);
    expect(entry.source).toBe('faa');
    expect(entry.cadence_days).toBe(30);
    expect(entry.days_since_change).toBeGreaterThanOrEqual(50);
  });

  it('marks ok when change is within cadence', () => {
    const state = makeState(5, 15);
    const entry = buildStalenessEntry('tc-ca', 30, state, new Date());
    expect(entry.overdue).toBe(false);
    expect(entry.days_since_change).toBeGreaterThanOrEqual(15);
  });

  it('returns last_content_change: null and days_since_change: -1 when state is null', () => {
    const entry = buildStalenessEntry('nl-ilt', 30, null, new Date());
    expect(entry.last_content_change).toBeNull();
    expect(entry.days_since_change).toBe(-1);
    expect(entry.overdue).toBe(false);
  });
});

describe('buildSummaryMarkdown', () => {
  it('returns empty string for empty entries', () => {
    expect(buildSummaryMarkdown([])).toBe('');
  });

  it('includes header row and separator', () => {
    const state = makeState(5, 15);
    const entries = [buildStalenessEntry('faa', 30, state, new Date())];
    const md = buildSummaryMarkdown(entries);
    expect(md).toContain('## Source cadence status');
    expect(md).toContain('| Source | Cadence (days)');
    expect(md).toContain('| --- |');
  });

  it('marks overdue entries with ⚠️ and ok entries with ✅', () => {
    const now = new Date();
    const okState = makeState(1, 10);
    const overdueState = makeState(1, 50);
    const entries = [
      buildStalenessEntry('faa', 30, okState, now),
      buildStalenessEntry('tc-ca', 30, overdueState, now),
    ];
    const md = buildSummaryMarkdown(entries);
    expect(md).toContain('✅ ok');
    expect(md).toContain('⚠️ overdue');
  });

  it('sorts entries alphabetically by source', () => {
    const state = makeState(1, 5);
    const now = new Date();
    const entries = [
      buildStalenessEntry('tw-caa', 30, state, now),
      buildStalenessEntry('faa', 30, state, now),
      buildStalenessEntry('nl-ilt', 30, state, now),
    ];
    const md = buildSummaryMarkdown(entries);
    const faaIdx = md.indexOf('faa');
    const nlIdx = md.indexOf('nl-ilt');
    const twIdx = md.indexOf('tw-caa');
    expect(faaIdx).toBeLessThan(nlIdx);
    expect(nlIdx).toBeLessThan(twIdx);
  });

  it('shows "never" for entries with no prior state', () => {
    const entries = [buildStalenessEntry('faa', 30, null, new Date())];
    const md = buildSummaryMarkdown(entries);
    expect(md).toContain('never');
    expect(md).toContain('unknown');
  });
});
