import { z } from 'zod';

export const SourceStateSchema = z.object({
  last_run: z.string(),
  last_content_change: z.string(),
  last_etag: z.string().optional(),
  record_count: z.number().int().nonnegative().optional(),
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

export const shouldSkip = (state: SourceState | null, cadenceDays: number, now: Date): boolean => {
  if (!state) return false;
  const lastRun = new Date(state.last_run);
  if (Number.isNaN(lastRun.getTime())) return false;
  return now.getTime() - lastRun.getTime() < cadenceDays * MS_PER_DAY;
};

export const isOverdue = (state: SourceState | null, cadenceDays: number, now: Date): boolean => {
  if (!state) return false;
  const lastChange = new Date(state.last_content_change);
  if (Number.isNaN(lastChange.getTime())) return false;
  return now.getTime() - lastChange.getTime() > cadenceDays * STALENESS_MULTIPLIER * MS_PER_DAY;
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
