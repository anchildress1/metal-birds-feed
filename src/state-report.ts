import { resolve } from 'node:path';
import { daysSinceChange, isOverdue, stalenessThresholdDays, type SourceState } from './cadence.js';
import { loadSourceConfig } from './config/loader.js';
import { log } from './logger.js';
import { r2ConfigFromEnv, validateSourceId } from './pipeline.js';
import { R2ArtifactWriter } from './writer.js';

export interface StateReport {
  source: string;
  last_run: string | null;
  last_content_change: string | null;
  record_count: number | null;
  cadence_days: number | null;
  paused: boolean;
  threshold_days: number | null;
  days_since_change: number | null;
  overdue: boolean;
}

const readFromR2 = (source: string): Promise<SourceState | null> =>
  new R2ArtifactWriter(r2ConfigFromEnv()).readState(source);

export const reportSourceState = async (
  source: string,
  readState: (source: string) => Promise<SourceState | null> = readFromR2,
  now = new Date()
): Promise<StateReport> => {
  validateSourceId(source);
  if (source === '')
    throw new Error('usage: make state SOURCE=<id>, or set REFRESH_SOURCE in .env');
  const config = loadSourceConfig(resolve('sources', `${source}.yaml`));
  const cadence = config.cadence_days ?? null;
  const state = await readState(source);
  const report: StateReport = {
    source,
    last_run: state?.last_run ?? null,
    last_content_change: state?.last_content_change ?? null,
    record_count: state?.record_count ?? null,
    cadence_days: cadence,
    paused: config.paused === true,
    threshold_days: cadence === null ? null : stalenessThresholdDays(cadence),
    days_since_change: daysSinceChange(state?.last_content_change ?? null, now),
    overdue: cadence !== null && isOverdue(state, cadence, now),
  };
  log('info', 'source_state', { ...report });
  return report;
};
