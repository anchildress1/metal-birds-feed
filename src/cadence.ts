import { z } from 'zod';
import { DB_SCHEMA_VERSION } from './db.js';

export const SourceStateSchema = z.object({
  last_run: z.string(),
  last_content_change: z.string(),
  record_count: z.number().int().nonnegative(),
  // sha256 hex of the written artifact's record set; gates skip-if-unchanged.
  content_hash: z.string().regex(/^[0-9a-f]{64}$/),
  // sha256 hex of the same records *before* localization. Drives last_content_change, and so
  // staleness: translation catching up must not read as the register publishing something new.
  upstream_hash: z.string().regex(/^[0-9a-f]{64}$/),
  // Mirrors db.ts's DB_SCHEMA_VERSION. content_hash alone only busts the write-skip gate when a
  // schema change happens to alter some row's serialized value; a DDL-only change a source's
  // current data never actually exercises (e.g. loosening a NOT NULL constraint) would otherwise
  // never reach R2 until unrelated upstream data changed. A required literal means any version
  // bump — this one included — makes every prior state fail validation, self-healing to absent
  // and forcing exactly one rewrite per source on its next run.
  producer_version: z.literal(DB_SCHEMA_VERSION),
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
  // Fail open: an unparseable timestamp can never become parseable on its own, so returning
  // false here would disarm the staleness alarm for that source forever.
  if (Number.isNaN(lastChange.getTime())) return true;
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
