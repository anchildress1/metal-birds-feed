import { resolve } from 'node:path';
import { buildStalenessEntry, STALENESS_MULTIPLIER, type SourceState } from './cadence.js';
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
  /** Days of silence before the staleness issue opens; null for a source with no cadence. */
  threshold_days: number | null;
  days_since_change: number | null;
  overdue: boolean;
}

const readFromR2 = (source: string): Promise<SourceState | null> =>
  new R2ArtifactWriter(r2ConfigFromEnv()).readState(source);

/**
 * Logs and returns a source's stored refresh state against its staleness threshold.
 * @throws on a traversal-bearing or unknown source id, or an unreadable state object.
 */
export const reportSourceState = async (
  source: string,
  readState: (source: string) => Promise<SourceState | null> = readFromR2,
  now = new Date()
): Promise<StateReport> => {
  validateSourceId(source);
  if (source === '')
    throw new Error('usage: make state SOURCE=<id>, or set REFRESH_SOURCE in .env');
  const cadence = loadSourceConfig(resolve('sources', `${source}.yaml`)).cadence_days ?? null;
  const state = await readState(source);
  const entry = cadence === null ? null : buildStalenessEntry(source, cadence, state, now);
  const report: StateReport = {
    source,
    last_run: state?.last_run ?? null,
    last_content_change: state?.last_content_change ?? null,
    record_count: state?.record_count ?? null,
    cadence_days: cadence,
    threshold_days: cadence === null ? null : Math.round(cadence * STALENESS_MULTIPLIER),
    days_since_change: entry?.days_since_change ?? null,
    overdue: entry?.overdue ?? false,
  };
  log('info', 'source_state', { ...report });
  return report;
};
