import { download, fetchPublishedTotal } from './downloader.js';
import { loadSourceConfig } from './config/loader.js';
import { resolve } from 'node:path';
import { toRow } from './db.js';
import { mapSnapshots, type Snapshot } from './engine.js';
import { mergeHistory, type ArtifactRow } from './history.js';
import { log } from './logger.js';
import { r2ConfigFromEnv, validateSourceId } from './pipeline.js';
import { R2ArtifactWriter } from './writer.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Replays an accumulating register's publications, oldest first, through the same merge a live
 * run uses, so the result is the history those runs would have recorded on each publication date.
 * A publication with failed rows (a double-loaded or self-contradicting load) is skipped: its
 * rows cannot be told apart, so it dates nothing.
 */
export const replayHistory = (
  source: string,
  snapshots: Snapshot[]
): { rows: ArtifactRow[]; skipped: string[] } => {
  let rows: ArtifactRow[] | null = null;
  const skipped: string[] = [];
  for (const { snapshot, records, stats } of snapshots) {
    if (!DATE.test(snapshot))
      throw new Error(`Source "${source}": snapshot "${snapshot}" is not a YYYY-MM-DD date`);
    if (stats.failed > 0) {
      skipped.push(snapshot);
      continue;
    }
    rows = mergeHistory(rows, new Map([...records].map(([id, r]) => [id, toRow(r)])), snapshot);
  }
  if (rows === null || skipped.includes(snapshots.at(-1)?.snapshot ?? ''))
    throw new Error(
      `Source "${source}": the newest publication is unusable, so there is no history to seed`
    );
  return { rows, skipped };
};

/**
 * Seeds a source's artifact with history replayed from its own accumulated publications.
 * @throws when the source keeps no snapshots, is manual, or its artifact already carries history.
 */
export async function backfillHistory(sourceId: string, dryRun: boolean): Promise<number> {
  validateSourceId(sourceId);
  const config = loadSourceConfig(resolve('sources', `${sourceId}.yaml`));
  if (config.download.manual === true)
    throw new Error(`${sourceId} is a manual source; it has no accumulated publications to replay`);
  const files = await download(config.download);
  const countUrl = config.record_count?.url;
  const publishedTotal =
    countUrl === undefined
      ? undefined
      : await fetchPublishedTotal(countUrl, config.download.headers);
  const snapshots = await mapSnapshots(config, files, publishedTotal);
  const { rows, skipped } = replayHistory(sourceId, snapshots);
  const closedRows = rows.filter((r) => r['removed_on'] !== null).length;
  log('info', 'history_replayed', {
    source: sourceId,
    snapshots: snapshots.length,
    skipped,
    rows: rows.length,
    closed: closedRows,
  });
  await new R2ArtifactWriter(r2ConfigFromEnv(), dryRun).seedHistory(
    sourceId,
    rows,
    new Date().toISOString().slice(0, 10)
  );
  return rows.length;
}
