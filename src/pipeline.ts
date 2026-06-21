import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadSourceConfig } from './config/loader.js';
import { download } from './downloader.js';
import { translate } from './engine.js';
import { R2ArtifactWriter } from './writer.js';
import { log } from './logger.js';
import {
  shouldSkip,
  buildStalenessEntry,
  buildSummaryMarkdown,
  STALENESS_MULTIPLIER,
} from './cadence.js';
import type { SourceState, StalenessEntry } from './cadence.js';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

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

export async function run(sourceId: string): Promise<RunResult> {
  log('info', 'pipeline_start', { source: sourceId });
  const start = Date.now();

  validateSourceId(sourceId);
  const configPath = resolve('sources', `${sourceId}.yaml`);
  const config = loadSourceConfig(configPath);

  const dryRun = process.env['DRY_RUN'] === 'true';
  const writer = new R2ArtifactWriter(
    {
      accountId: requireEnv('MBF_R2_ACCOUNT_ID'),
      accessKeyId: requireEnv('MBF_R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('MBF_R2_SECRET_ACCESS_KEY'),
      bucketName: requireEnv('MBF_R2_BUCKET_NAME'),
    },
    dryRun
  );

  // State is read for every source: cadence sources gate on last_run, all sources gate the artifact
  // PUT on content_hash (skip-if-unchanged).
  const priorState = await writer.readState(sourceId);
  if (
    config.cadence_days !== undefined &&
    !dryRun &&
    shouldSkip(priorState, config.cadence_days, new Date())
  ) {
    log('info', 'cadence_skip', { source: sourceId, cadence_days: config.cadence_days });
    return {
      source: sourceId,
      skipped: true,
      cadence_days: config.cadence_days,
      new_state: priorState,
    };
  }

  const files = await download(config.download);
  const { records, stats } = await translate(config, files);

  log('info', 'translate_summary', { source: sourceId, ...stats });
  if (stats.failed > 0) {
    throw new Error(
      `Translation failed for ${stats.failed} of ${stats.total} ${sourceId} rows; aborting write`
    );
  }

  if (dryRun) {
    log('info', 'dry_run_mode', { source: sourceId, records: records.size });
  }

  const writeStats = await writer.write(records, sourceId, priorState);

  let newState: SourceState | null = priorState;
  if (!dryRun) {
    const now = new Date().toISOString();
    newState = {
      last_run: now,
      last_content_change: writeStats.changed ? now : (priorState?.last_content_change ?? now),
      record_count: writeStats.record_count,
      content_hash: writeStats.content_hash,
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

// Shared prefix so the matcher's startsWith can't let a prefix source name (`faa` vs `faa-uas`) collide.
const stalenessTitlePrefix = (source: string): string =>
  `[staleness] ${source} has not updated in `;

const isStalenessIssueFor = (issueTitle: string, source: string): boolean =>
  issueTitle.startsWith(stalenessTitlePrefix(source));

const createStalenessIssue = async (
  entry: StalenessEntry,
  token: string,
  repo: string
): Promise<void> => {
  const apiBase = `https://api.github.com/repos/${repo}`;
  const title = `${stalenessTitlePrefix(entry.source)}${entry.days_since_change} days`;

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
        msg: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    else if (!r.value.ok)
      log('error', 'staleness_close_failed', { source, status: r.value.status });
  }
};

interface GitHubCtx {
  token: string | undefined;
  repo: string | undefined;
}

const resolveSources = (): string[] => {
  const sourceEnv = process.env['REFRESH_SOURCE']?.trim() ?? '';
  return sourceEnv
    ? [sourceEnv]
    : readdirSync('sources')
        .filter((f) => f.endsWith('.yaml'))
        .map((f) => f.replace(/\.yaml$/, ''));
};

// Content just changed when this run's write stamped last_content_change to last_run.
const justChanged = (value: RunResult, dryRun: boolean): boolean =>
  !dryRun &&
  !value.skipped &&
  value.new_state !== null &&
  value.new_state.last_content_change === value.new_state.last_run;

const closeWithLogging = (source: string, token: string, repo: string): Promise<void> =>
  closeStalenessIssues(source, token, repo).catch((err) =>
    log('error', 'staleness_close_error', {
      source,
      msg: err instanceof Error ? err.message : String(err),
    })
  );

interface Failure {
  source: string;
  msg: string;
}

interface ProcessedResults {
  failures: Failure[];
  stalenessEntries: StalenessEntry[];
  closePromises: Promise<void>[];
}

const processResults = (
  results: PromiseSettledResult<RunResult>[],
  sources: string[],
  now: Date,
  dryRun: boolean,
  gh: GitHubCtx
): ProcessedResults => {
  const { token, repo } = gh;
  const failures: Failure[] = [];
  const stalenessEntries: StalenessEntry[] = [];
  const closePromises: Promise<void>[] = [];

  for (const [i, result] of results.entries()) {
    if (result.status === 'rejected') {
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      log('error', 'pipeline_failed', { source: sources[i], msg });
      failures.push({ source: sources[i] ?? 'unknown', msg });
      continue;
    }
    const { cadence_days, new_state, source } = result.value;
    if (cadence_days === undefined) continue;
    stalenessEntries.push(buildStalenessEntry(source, cadence_days, new_state, now));
    if (token && repo && justChanged(result.value, dryRun))
      closePromises.push(closeWithLogging(source, token, repo));
  }
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
      stalenessEntries.filter((e) => e.overdue).map((e) => createStalenessIssue(e, token, repo))
    );
};

export async function main(): Promise<void> {
  const sources = resolveSources();
  const results = await Promise.allSettled(sources.map(run));
  const now = new Date();
  const dryRun = process.env['DRY_RUN'] === 'true';
  const gh: GitHubCtx = {
    token: process.env['GITHUB_TOKEN'],
    repo: process.env['GITHUB_REPOSITORY'],
  };

  const { failures, stalenessEntries, closePromises } = processResults(
    results,
    sources,
    now,
    dryRun,
    gh
  );
  await Promise.allSettled(closePromises);
  await emitStaleness(stalenessEntries, dryRun, gh);
  await emitFailures(failures);

  if (failures.length > 0) process.exit(1);
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
