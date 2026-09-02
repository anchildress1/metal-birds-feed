import { resolve, sep } from 'node:path';
import { readdirSync } from 'node:fs';
import { rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadSourceConfig } from './config/loader.js';
import { download, fetchPublishedTotal } from './downloader.js';
import { translate } from './engine.js';
import type { EngineStats } from './engine.js';
import type { Aircraft } from './schema.js';
import { localizeRecords } from './localize/localize.js';
import { MIN_RETAIN_RATIO, R2ArtifactWriter, isArtifactCaughtUp, type R2Config } from './writer.js';
import { toFeedRows, mergeFeedRows, buildFeedDb, hashFeedRows, type FeedRow } from './feed.js';
import { hashRecords } from './db.js';
import { log, errorMessage } from './logger.js';
import { requireEnv } from './env.js';
import { retry, type RetryOptions } from './retry.js';
import {
  shouldSkip,
  buildStalenessEntry,
  buildSummaryMarkdown,
  STALENESS_MULTIPLIER,
} from './cadence.js';
import type { SourceState, StalenessEntry } from './cadence.js';

// A same-status/same-date duplicate collision with neither row a strict superset (engine.ts's
// `retryable: true`) is a fresh-data problem: ANAC has republished a corrected RAB file within the
// same day after this exact failure, three days running. Retrying the whole download+translate
// with real backoff gives the upstream a chance to settle before this source fails its whole run
// over one row. Any other translation failure is a deterministic bug in the same bytes — retrying
// would just burn a fresh download for nothing, so those still throw a plain Error immediately.
class RetryableTranslationFailure extends Error {}

// Long backoff, not the network-blip scale used elsewhere: this waits on an upstream data
// condition to clear, not a dropped connection. 3 attempts × ~45-180s of jittered backoff adds at
// most a few minutes, well inside the workflow's 30-minute job timeout, and costs nothing on a
// normal run.
const TRANSLATION_RETRY_BASE_DELAY_MS = 90_000;

const r2ConfigFromEnv = (): R2Config => ({
  accountId: requireEnv('MBF_R2_ACCOUNT_ID'),
  accessKeyId: requireEnv('MBF_R2_ACCESS_KEY_ID'),
  secretAccessKey: requireEnv('MBF_R2_SECRET_ACCESS_KEY'),
  bucketName: requireEnv('MBF_R2_BUCKET_NAME'),
});

function validateSourceId(sourceId: string): void {
  if (sourceId.includes('..') || sourceId.includes('/') || sourceId.includes('\\'))
    throw new Error(`Path traversal rejected: ${sourceId}`);
}

interface RunResult {
  source: string;
  skipped: boolean;
  cadence_days: number | undefined;
  new_state: SourceState | null;
}

export async function run(sourceId: string, opts: RetryOptions = {}): Promise<RunResult> {
  log('info', 'pipeline_start', { source: sourceId });
  const start = Date.now();

  validateSourceId(sourceId);
  const configPath = resolve('sources', `${sourceId}.yaml`);
  const config = loadSourceConfig(configPath);

  const dryRun = process.env['DRY_RUN'] === 'true';
  // The only other bypass is DRY_RUN, which writes nothing.
  const force = process.env['FORCE_REFRESH'] === 'true';
  const writer = new R2ArtifactWriter(r2ConfigFromEnv(), dryRun);

  // State is read for every source: cadence sources gate on last_run, all sources gate the artifact
  // PUT on content_hash (skip-if-unchanged).
  const priorState = await writer.readState(sourceId);
  const hasCurrentArtifactState = priorState?.content_hash !== undefined;
  if (
    config.cadence_days !== undefined &&
    hasCurrentArtifactState &&
    !dryRun &&
    !force &&
    shouldSkip(priorState, config.cadence_days, new Date()) &&
    (await writer.feedRowsExist(sourceId)) &&
    // Checked last: it's the most expensive condition. readArtifactHeader + isArtifactCaughtUp
    // (writer.ts) cover what a plain existence check used to (a missing artifact reads as "not
    // caught up" here too) plus schema-version and freshness — the same ground truth write()
    // trusts for its own unchanged-skip, so a cadence skip and a mid-run skip can't disagree.
    isArtifactCaughtUp(await writer.readArtifactHeader(sourceId), priorState)
  ) {
    log('info', 'cadence_skip', { source: sourceId, cadence_days: config.cadence_days });
    return {
      source: sourceId,
      skipped: true,
      cadence_days: config.cadence_days,
      new_state: priorState,
    };
  }

  const attemptDownloadAndTranslate = async (): Promise<{
    records: Map<string, Aircraft>;
    stats: EngineStats;
  }> => {
    const files = await download(config.download);
    const countUrl = config.record_count?.url;
    // After the register itself, so the two responses bracket as little publishing time as
    // possible: a publication landing between them reports a total the download predates, which
    // fails the run. Rerunning clears it, and that is the right trade against absorbing a
    // truncated download.
    const publishedTotal =
      countUrl === undefined
        ? undefined
        : await fetchPublishedTotal(countUrl, config.download.headers);
    const { records, stats, retryable } = await translate(config, files, publishedTotal);

    log('info', 'translate_summary', { source: sourceId, ...stats });
    if (stats.failed > 0) {
      const msg = `Translation failed for ${stats.failed} of ${stats.total} ${sourceId} rows; aborting write`;
      throw retryable ? new RetryableTranslationFailure(msg) : new Error(msg);
    }
    return { records, stats };
  };

  const { records } = await retry(attemptDownloadAndTranslate, {
    attempts: 3,
    baseDelayMs: TRANSLATION_RETRY_BASE_DELAY_MS,
    ...opts,
    isRetryable: (err) => err instanceof RetryableTranslationFailure,
    onRetry: (attempt, err) => {
      opts.onRetry?.(attempt, err);
      log('warn', 'pipeline_retry', { source: sourceId, attempt, reason: errorMessage(err) });
    },
  });

  if (dryRun) {
    log('info', 'dry_run_mode', { source: sourceId, records: records.size });
  }

  // Pruning the translation cache is destructive and happens before writer.write's retain-ratio
  // guard can reject a truncated upstream, so the same threshold is applied here first — otherwise
  // a short-but-parseable download would prune the cache to its truncated candidate set, fail the
  // artifact write, and leave the next healthy run to re-buy every dropped translation.
  const priorCount = priorState?.record_count;
  const allowPrune =
    priorCount === undefined || priorCount === 0 || records.size / priorCount >= MIN_RETAIN_RATIO;

  const { records: localized, stats: localizeStats } = await localizeRecords(
    records,
    sourceId,
    config.language,
    writer,
    dryRun,
    allowPrune
  );
  log('info', 'localize_summary', { source: sourceId, ...localizeStats });
  if (localizeStats.failed > 0)
    log('warn', 'localize_partial_failure', { source: sourceId, failed: localizeStats.failed });

  // Hashed pre-localization: change detection must track the register, not our own enrichment.
  const writeStats = await writer.write(localized, sourceId, priorState, hashRecords(records));

  // State advances only after both durable outputs exist. Otherwise cadence gating could suppress
  // recovery from a missing feed slice for the full source cadence.
  if (!dryRun) await writer.writeFeedRows(sourceId, toFeedRows(localized.values()));

  let newState: SourceState | null = priorState;
  if (!dryRun) {
    const now = new Date().toISOString();
    newState = {
      last_run: now,
      last_content_change: writeStats.changed ? now : (priorState?.last_content_change ?? now),
      record_count: writeStats.record_count,
      content_hash: writeStats.content_hash,
      upstream_hash: writeStats.upstream_hash,
    };
    await writer.writeState(sourceId, newState);
  }

  log('info', 'pipeline_complete', { source: sourceId, elapsed_ms: Date.now() - start });
  return {
    source: sourceId,
    skipped: false,
    cadence_days: config.cadence_days,
    new_state: newState,
  };
}

// Match on `[staleness] <source> ` (trailing space) — avoids the `faa` vs `faa-uas` prefix
// collision while staying robust to the human-readable title wording changing over time.
const isStalenessIssueFor = (issueTitle: string, source: string): boolean =>
  issueTitle.startsWith(`[staleness] ${source} `);

const createStalenessIssue = async (
  entry: StalenessEntry,
  token: string,
  repo: string
): Promise<void> => {
  const apiBase = `https://api.github.com/repos/${repo}`;
  const title = `[staleness] ${entry.source} has not updated in ${entry.days_since_change} days`;

  const listRes = await fetch(`${apiBase}/issues?labels=data-staleness&state=open&per_page=100`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!listRes.ok) {
    log('error', 'staleness_issue_list_failed', { source: entry.source, status: listRes.status });
    return;
  }
  const existing = (await listRes.json()) as Array<{ title: string }>;
  if (existing.some((i) => isStalenessIssueFor(i.title, entry.source))) return;

  const threshold = Math.round(entry.cadence_days * STALENESS_MULTIPLIER);
  const body = [
    '## Source cadence alert',
    '',
    `- **Source:** ${entry.source}`,
    `- **Cadence:** ${entry.cadence_days} days`,
    `- **Last content change:** ${entry.last_content_change ?? 'never'}`,
    `- **Days since change:** ${entry.days_since_change}`,
    '',
    `The register has been silent for ${entry.days_since_change} days (threshold: ${threshold} days).`,
    '',
    `While this is open the cadence gate is bypassed: \`${entry.source}\` refreshes on every daily`,
    `cron tick instead of every ${entry.cadence_days} days. If the register genuinely publishes less`,
    `often than declared, raise \`cadence_days\` in \`sources/${entry.source}.yaml\` rather than`,
    'leaving it polling daily.',
    '',
    '> Auto-opened by the Registry Refresh workflow. Closes automatically on next successful content change.',
  ].join('\n');

  const createRes = await fetch(`${apiBase}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body, labels: ['data-staleness'] }),
  });
  if (!createRes.ok) {
    log('error', 'staleness_issue_create_failed', {
      source: entry.source,
      status: createRes.status,
    });
  }
};

const closeStalenessIssues = async (source: string, token: string, repo: string): Promise<void> => {
  const apiBase = `https://api.github.com/repos/${repo}`;
  const listRes = await fetch(`${apiBase}/issues?labels=data-staleness&state=open&per_page=100`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!listRes.ok) {
    log('error', 'staleness_close_list_failed', { source, status: listRes.status });
    return;
  }
  const issues = (await listRes.json()) as Array<{ number: number; title: string }>;
  const matching = issues.filter((i) => isStalenessIssueFor(i.title, source));
  const results = await Promise.allSettled(
    matching.map((i) =>
      fetch(`${apiBase}/issues/${i.number}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
      })
    )
  );
  for (const r of results) {
    if (r.status === 'rejected')
      log('error', 'staleness_close_failed', {
        source,
        msg: errorMessage(r.reason),
      });
    else if (!r.value.ok)
      log('error', 'staleness_close_failed', { source, status: r.value.status });
  }
};

interface GitHubCtx {
  token: string | undefined;
  repo: string | undefined;
}

export const resolveAllSources = (): string[] =>
  readdirSync('sources')
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => f.replace(/\.yaml$/, ''))
    .sort((a, b) => a.localeCompare(b));

const resolveSources = (): string[] => {
  const sourceEnv = process.env['REFRESH_SOURCE']?.trim() ?? '';
  return sourceEnv ? [sourceEnv] : resolveAllSources();
};

// Content just changed when this run's write stamped last_content_change to last_run.
const justChanged = (value: RunResult, dryRun: boolean): boolean =>
  !dryRun &&
  !value.skipped &&
  value.new_state !== null &&
  value.new_state.last_content_change === value.new_state.last_run;

const closeWithLogging = async (source: string, token: string, repo: string): Promise<void> => {
  try {
    await closeStalenessIssues(source, token, repo);
  } catch (err) {
    log('error', 'staleness_close_error', {
      source,
      msg: errorMessage(err),
    });
  }
};

// Mirrors closeWithLogging: createStalenessIssue's fetches aren't individually try/caught, and
// emitStaleness batches many of these behind Promise.allSettled — without this wrapper a rejected
// fetch (DNS/timeout/reset) vanishes into an unread settled result, and the exact "register has
// gone silent" condition this feature exists to catch goes unreported with no log trace at all.
const createWithLogging = async (
  entry: StalenessEntry,
  token: string,
  repo: string
): Promise<void> => {
  try {
    await createStalenessIssue(entry, token, repo);
  } catch (err) {
    log('error', 'staleness_issue_error', {
      source: entry.source,
      msg: errorMessage(err),
    });
  }
};

interface Failure {
  source: string;
  msg: string;
}

interface ProcessedResults {
  failures: Failure[];
  stalenessEntries: StalenessEntry[];
  closePromises: Promise<void>[];
}

// A failed run still owes a staleness reading. Escalation makes an overdue source run instead of
// skip, and the conditions that keep a register silent are the same ones that break its download —
// so without this the alarm goes quiet exactly when it matters. Prior state is authoritative here:
// nothing was written.
const stalenessFromPriorState = async (
  source: string,
  writer: R2ArtifactWriter,
  now: Date
): Promise<StalenessEntry | null> => {
  try {
    const cadenceDays = loadSourceConfig(resolve('sources', `${source}.yaml`)).cadence_days;
    if (cadenceDays === undefined) return null;
    return buildStalenessEntry(source, cadenceDays, await writer.readState(source), now);
  } catch (err) {
    log('warn', 'staleness_entry_unavailable', { source, msg: errorMessage(err) });
    return null;
  }
};

const processResults = async (
  results: PromiseSettledResult<RunResult>[],
  sources: string[],
  now: Date,
  dryRun: boolean,
  gh: GitHubCtx,
  writer: R2ArtifactWriter
): Promise<ProcessedResults> => {
  const { token, repo } = gh;
  const failures: Failure[] = [];
  const stalenessEntries: StalenessEntry[] = [];
  const closePromises: Promise<void>[] = [];

  const rejected: string[] = [];

  for (const [i, result] of results.entries()) {
    if (result.status === 'rejected') {
      const source = sources[i] ?? 'unknown';
      const msg = errorMessage(result.reason);
      log('error', 'pipeline_failed', { source, msg });
      failures.push({ source, msg });
      rejected.push(source);
      continue;
    }
    const { cadence_days, new_state, source } = result.value;
    if (cadence_days === undefined) continue;
    stalenessEntries.push(buildStalenessEntry(source, cadence_days, new_state, now));
    if (token && repo && justChanged(result.value, dryRun))
      closePromises.push(closeWithLogging(source, token, repo));
  }
  const recovered = await Promise.all(rejected.map((s) => stalenessFromPriorState(s, writer, now)));
  stalenessEntries.push(...recovered.filter((e) => e !== null));

  return { failures, stalenessEntries, closePromises };
};

const ESCAPED_PIPE = String.raw`\|`;

// Pipe-escape + newline-flatten keeps a multi-line error from breaking the Markdown table row.
const escapeCell = (msg: string): string => msg.replaceAll('|', ESCAPED_PIPE).replaceAll('\n', ' ');

// Surface failures in the GitHub Actions run summary so a red run names the source and reason
// without digging through per-job logs.
const emitFailures = async (failures: Failure[]): Promise<void> => {
  const summaryPath = process.env['GITHUB_STEP_SUMMARY'];
  if (failures.length === 0 || !summaryPath) return;
  const rows = failures.map((f) => `| ${f.source} | ${escapeCell(f.msg)} |`);
  const markdown = [
    '## ❌ Refresh failures',
    '',
    '| Source | Error |',
    '| --- | --- |',
    ...rows,
  ].join('\n');
  await writeFile(summaryPath, `\n${markdown}\n`, { flag: 'a' });
};

const emitStaleness = async (
  stalenessEntries: StalenessEntry[],
  dryRun: boolean,
  gh: GitHubCtx
): Promise<void> => {
  if (stalenessEntries.length === 0) return;

  const markdown = buildSummaryMarkdown(stalenessEntries);
  const summaryPath = process.env['GITHUB_STEP_SUMMARY'];
  if (summaryPath) await writeFile(summaryPath, `\n${markdown}\n`, { flag: 'a' });

  const { token, repo } = gh;
  if (!dryRun && token && repo)
    await Promise.allSettled(
      stalenessEntries.filter((e) => e.overdue).map((e) => createWithLogging(e, token, repo))
    );
};

export const resolveFeedOutputPath = (input: string, root = resolve('.')): string => {
  if (input.includes('..')) throw new Error('Path traversal rejected: MBF_FEED_DB_OUT');
  const sandboxRoot = resolve(root);
  const outputPath = resolve(sandboxRoot, input);
  if (outputPath === sandboxRoot || !outputPath.startsWith(`${sandboxRoot}${sep}`))
    throw new Error('Path escape rejected: MBF_FEED_DB_OUT');
  return outputPath;
};

const writeFeedAtomically = async (path: string, bytes: Uint8Array): Promise<void> => {
  const temporaryPath = `${path}.tmp-${process.pid}`;
  try {
    await writeFile(temporaryPath, bytes);
    await rename(temporaryPath, path);
  } catch (err) {
    try {
      await rm(temporaryPath, { force: true });
    } catch (cleanupErr) {
      log('warn', 'feed_publish_cleanup_failed', { msg: errorMessage(cleanupErr) });
    }
    throw err;
  }
};

// Rebuilds the consolidated DB from every configured source, even when REFRESH_SOURCE narrows the
// refresh itself. Missing intermediates fail closed so a partial database is never deployable.
// Returns the feed content hash when it publishes (null when MBF_FEED_DB_OUT is unset or dry-run).
export const publishFeed = async (sources: string[], dryRun: boolean): Promise<string | null> => {
  const outputInput = process.env['MBF_FEED_DB_OUT']?.trim();
  if (!outputInput || dryRun) return null;
  try {
    const outputPath = resolveFeedOutputPath(outputInput);
    const writer = new R2ArtifactWriter(r2ConfigFromEnv(), false);
    const loaded = await Promise.all(sources.map((source) => writer.readFeedRows(source)));
    const missing = sources.filter((_, index) => loaded[index] === null);
    // Fails closed rather than publishing a partial feed. Names the fix because the cause is
    // almost always ordering: slices are written by the refresh, and this only assembles them.
    if (missing.length > 0)
      throw new Error(
        `Missing feed rows for: ${missing.join(', ')}. Run \`make refresh\` (or \`make build-feed\` to refresh and assemble in one step) — these sources have not written a feed slice yet.`
      );
    const groups = loaded.filter((group): group is FeedRow[] => group !== null);
    const rows = mergeFeedRows(groups);
    const hash = hashFeedRows(rows);
    await writeFeedAtomically(outputPath, buildFeedDb(rows));
    log('info', 'feed_published', {
      rows: rows.length,
      sources: groups.length,
      out: outputPath,
      hash,
    });
    return hash;
  } catch (err) {
    log('error', 'feed_publish_failed', { msg: errorMessage(err) });
    throw err;
  }
};

export interface FeedDeployStatus {
  changed: boolean;
  hash: string | null;
}

// Publishes the feed, then reports whether it differs from the feed currently live on Cloud Run
// (per the R2 marker) so the scheduled deploy runs on an actual content update, not on every cron
// tick. Decoupled from per-source success: a failed source keeps its prior slice, so the feed only
// reports "changed" when a source genuinely published new data this run.
export const publishFeedForDeploy = async (sources: string[]): Promise<FeedDeployStatus> => {
  const hash = await publishFeed(sources, false);
  if (hash === null) return { changed: false, hash: null };
  const deployed = await new R2ArtifactWriter(r2ConfigFromEnv(), false).readDeployedFeedHash();
  return { changed: hash !== deployed, hash };
};

// Advances the deployed-feed marker; called only after a successful Cloud Run deploy so a failed
// deploy never suppresses the next one.
export const markFeedDeployed = async (hash: string | undefined): Promise<void> => {
  const value = hash?.trim();
  if (!value) throw new Error('markFeedDeployed requires a non-empty feed hash');
  await new R2ArtifactWriter(r2ConfigFromEnv(), false).writeDeployedFeedHash(value);
};

export async function main(): Promise<void> {
  const sources = resolveSources();
  // Not `sources.map(run)`: Array.prototype.map passes (value, index, array) positionally, and
  // `run`'s second parameter is retry options — the numeric index would land there by accident.
  const results = await Promise.allSettled(sources.map((sourceId) => run(sourceId)));
  const now = new Date();
  const dryRun = process.env['DRY_RUN'] === 'true';
  const gh: GitHubCtx = {
    token: process.env['GITHUB_TOKEN'],
    repo: process.env['GITHUB_REPOSITORY'],
  };

  const { failures, stalenessEntries, closePromises } = await processResults(
    results,
    sources,
    now,
    dryRun,
    gh,
    new R2ArtifactWriter(r2ConfigFromEnv(), dryRun)
  );
  await Promise.allSettled(closePromises);
  await emitStaleness(stalenessEntries, dryRun, gh);
  await emitFailures(failures);

  if (failures.length > 0) {
    process.exit(1);
    return;
  }
  await publishFeed(resolveAllSources(), dryRun);
}

const isCliEntryPoint = (): boolean =>
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCliEntryPoint()) {
  try {
    await main();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
