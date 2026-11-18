import { z } from 'zod';
import type { SourceConfig } from './types/config.js';

export const SourceStateSchema = z.object({
  last_run: z.string(),
  last_content_change: z.string(),
  record_count: z.number().int().nonnegative(),
  // sha256 hex of the written artifact's record set, salted with db.ts's DB_SCHEMA_VERSION; gates
  // skip-if-unchanged. The salt means a schema/DDL-only bump forces a mismatch here even when no
  // row's serialized value actually changed (e.g. loosening a NOT NULL constraint no source's
  // current data ever exercised) — otherwise that migration would never reach R2 until unrelated
  // upstream data changed. Salting the hash, not the schema, is deliberate: it forces exactly the
  // artifact rewrite without invalidating this whole object, so record_count/upstream_hash stay
  // available to the retain-ratio guard and staleness tracking through the migration run.
  content_hash: z.string().regex(/^[0-9a-f]{64}$/),
  // sha256 hex of the same records *before* localization, unsalted. Drives last_content_change,
  // and so staleness: translation catching up — or an internal schema bump — must not read as the
  // register publishing something new.
  upstream_hash: z.string().regex(/^[0-9a-f]{64}$/),
});
export type SourceState = z.infer<typeof SourceStateSchema>;

export type AlarmConfig = Pick<SourceConfig, 'cadence_days' | 'stale_after_days'>;

export interface StalenessEntry {
  source: string;
  cadence_days: number | null;
  threshold_days: number;
  last_content_change: string | null;
  // null: no usable last-change timestamp (none recorded, or unparseable).
  days_since_change: number | null;
  overdue: boolean;
}

const MS_PER_DAY = 86_400_000;
// Runs on different machines stamp last_content_change against their own clocks, so a timestamp a
// few minutes ahead is skew; beyond this it is corrupt state and must not silence the alarm.
const FUTURE_TOLERANCE_MS = 10 * 60_000;
// Without `stale_after_days`, a source is overdue once silent for 1.5× its poll cadence.
export const STALENESS_MULTIPLIER = 1.5;

// Unrounded on purpose: every reader of the threshold must see the figure isOverdue compares, or a
// rounded one reads as not yet crossed while the source is already overdue.
export const stalenessThresholdDays = (config: AlarmConfig): number | undefined =>
  config.stale_after_days ??
  (config.cadence_days === undefined ? undefined : config.cadence_days * STALENESS_MULTIPLIER);

// Epoch 0 is a UTC midnight, so flooring ms to days yields the UTC day number.
const utcDay = (d: Date): number => Math.floor(d.getTime() / MS_PER_DAY);

// A timestamp that is unparseable, or further ahead of the clock than skew explains, can never be
// trusted to age into correctness on a useful timescale.
const unusable = (changedAt: number, now: Date): boolean =>
  Number.isNaN(changedAt) || changedAt - now.getTime() > FUTURE_TOLERANCE_MS;

export const isOverdue = (state: SourceState | null, thresholdDays: number, now: Date): boolean => {
  if (!state) return false;
  const changedAt = new Date(state.last_content_change).getTime();
  // Fail open: returning false here would disarm the staleness alarm for that source.
  if (unusable(changedAt, now)) return true;
  return now.getTime() - changedAt > thresholdDays * MS_PER_DAY;
};

// False for a source with no cadence_days: it polls every tick.
export const shouldSkip = (state: SourceState | null, config: AlarmConfig, now: Date): boolean => {
  const cadenceDays = config.cadence_days;
  const thresholdDays = stalenessThresholdDays(config);
  if (!state || cadenceDays === undefined || thresholdDays === undefined) return false;
  const lastRun = new Date(state.last_run);
  if (Number.isNaN(lastRun.getTime())) return false;
  // Shares the staleness issue's threshold so the open issue and the daily polling stay one
  // condition rather than two knobs. Guarded on a usable timestamp: isOverdue fails open to keep
  // the alarm armed, but that value does not heal on its own, so escalating on it would disable
  // the gate and refetch the whole register every tick.
  const changedAt = new Date(state.last_content_change).getTime();
  if (!unusable(changedAt, now) && isOverdue(state, thresholdDays, now)) return false;
  // last_run is stamped at run completion, so a strict ms window falls short on the next cron tick
  // and pushes every cycle a day later.
  return utcDay(now) - utcDay(lastRun) < cadenceDays;
};

export const daysSinceChange = (lastChange: string | null, now: Date): number | null => {
  const changedAt = lastChange === null ? Number.NaN : new Date(lastChange).getTime();
  // Null is exactly the cases isOverdue treats as unknown; skew within the tolerance clamps to 0.
  return unusable(changedAt, now)
    ? null
    : Math.max(0, Math.floor((now.getTime() - changedAt) / MS_PER_DAY));
};

// Null: the source declares no alarm.
export const buildStalenessEntry = (
  source: string,
  config: AlarmConfig,
  state: SourceState | null,
  now: Date
): StalenessEntry | null => {
  const threshold = stalenessThresholdDays(config);
  if (threshold === undefined) return null;
  const lastChange = state?.last_content_change ?? null;
  return {
    source,
    cadence_days: config.cadence_days ?? null,
    threshold_days: threshold,
    last_content_change: lastChange,
    days_since_change: daysSinceChange(lastChange, now),
    overdue: isOverdue(state, threshold, now),
  };
};

export const buildSummaryMarkdown = (entries: StalenessEntry[]): string => {
  if (entries.length === 0) return '';
  const rows = [...entries]
    .sort((a, b) => a.source.localeCompare(b.source))
    .map((e) => {
      const status = e.overdue ? '⚠️ overdue' : '✅ ok';
      const lastChange = e.last_content_change ?? 'never';
      const days = e.days_since_change === null ? 'unknown' : String(e.days_since_change);
      const cadence = e.cadence_days === null ? 'daily' : String(e.cadence_days);
      return `| ${e.source} | ${cadence} | ${e.threshold_days} | ${lastChange} | ${days} | ${status} |`;
    });
  return [
    '## Source cadence status',
    '',
    '| Source | Cadence (days) | Alarm after (days) | Last content change | Days since change | Status |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
};
