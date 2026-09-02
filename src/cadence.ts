import { z } from 'zod';

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

export interface StalenessEntry {
  source: string;
  cadence_days: number;
  last_content_change: string | null;
  days_since_change: number;
  overdue: boolean;
}

const MS_PER_DAY = 86_400_000;
// A source is considered overdue once it has been silent for 1.5× its declared cadence.
export const STALENESS_MULTIPLIER = 1.5;

// Epoch 0 is a UTC midnight, so flooring ms to days yields the UTC day number.
const utcDay = (d: Date): number => Math.floor(d.getTime() / MS_PER_DAY);

export const isOverdue = (state: SourceState | null, cadenceDays: number, now: Date): boolean => {
  if (!state) return false;
  const lastChange = new Date(state.last_content_change);
  // Fail open: an unparseable timestamp can never become parseable on its own, so returning
  // false here would disarm the staleness alarm for that source forever.
  if (Number.isNaN(lastChange.getTime())) return true;
  return now.getTime() - lastChange.getTime() > cadenceDays * STALENESS_MULTIPLIER * MS_PER_DAY;
};

export const shouldSkip = (state: SourceState | null, cadenceDays: number, now: Date): boolean => {
  if (!state) return false;
  const lastRun = new Date(state.last_run);
  if (Number.isNaN(lastRun.getTime())) return false;
  // Shares the staleness issue's threshold so the open issue and the daily polling stay one
  // condition rather than two knobs.
  if (isOverdue(state, cadenceDays, now)) return false;
  // last_run is stamped at run completion, so a strict ms window falls short on the next cron tick
  // and pushes every cycle a day later.
  return utcDay(now) - utcDay(lastRun) < cadenceDays;
};

export const buildStalenessEntry = (
  source: string,
  cadenceDays: number,
  state: SourceState | null,
  now: Date
): StalenessEntry => {
  const lastChange = state?.last_content_change ?? null;
  const msSinceChange = lastChange ? now.getTime() - new Date(lastChange).getTime() : Infinity;
  const daysSinceChange = Number.isFinite(msSinceChange)
    ? Math.floor(msSinceChange / MS_PER_DAY)
    : -1;
  return {
    source,
    cadence_days: cadenceDays,
    last_content_change: lastChange,
    days_since_change: daysSinceChange,
    overdue: isOverdue(state, cadenceDays, now),
  };
};

export const buildSummaryMarkdown = (entries: StalenessEntry[]): string => {
  if (entries.length === 0) return '';
  const rows = [...entries]
    .sort((a, b) => a.source.localeCompare(b.source))
    .map((e) => {
      const status = e.overdue ? '⚠️ overdue' : '✅ ok';
      const lastChange = e.last_content_change ?? 'never';
      const days = e.days_since_change >= 0 ? String(e.days_since_change) : 'unknown';
      return `| ${e.source} | ${e.cadence_days} | ${lastChange} | ${days} | ${status} |`;
    });
  return [
    '## Source cadence status',
    '',
    '| Source | Cadence (days) | Last content change | Days since change | Status |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
};
