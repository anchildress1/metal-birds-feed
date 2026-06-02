import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadSourceConfig } from './config/loader.js';
import { download } from './downloader.js';
import { translate } from './engine.js';
import { R2DiffWriter } from './writer.js';
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
  const writer = new R2DiffWriter(
    {
      accountId: requireEnv('MBF_R2_ACCOUNT_ID'),
      accessKeyId: requireEnv('MBF_R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('MBF_R2_SECRET_ACCESS_KEY'),
      bucketName: requireEnv('MBF_R2_BUCKET_NAME'),
    },
    dryRun
  );

  let priorState: SourceState | null = null;
  if (config.cadence_days !== undefined) {
    priorState = await writer.readState(sourceId);
    if (!dryRun && shouldSkip(priorState, config.cadence_days, new Date())) {
      log('info', 'cadence_skip', { source: sourceId, cadence_days: config.cadence_days });
      return {
        source: sourceId,
        skipped: true,
        cadence_days: config.cadence_days,
        new_state: priorState,
      };
    }
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

  const writeStats = await writer.write(records, sourceId);

  let newState: SourceState | null = priorState;
  if (config.cadence_days !== undefined && !dryRun) {
    const now = new Date().toISOString();
    newState = {
      last_run: now,
      last_content_change: writeStats.changed ? now : (priorState?.last_content_change ?? now),
      record_count: writeStats.record_count,
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
  if (existing.some((i) => i.title.includes(`[staleness] ${entry.source}`))) return;

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
  if (!listRes.ok) return;
  const issues = (await listRes.json()) as Array<{ number: number; title: string }>;
  const matching = issues.filter((i) => i.title.includes(`[staleness] ${source}`));
  await Promise.allSettled(
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
};

export async function main(): Promise<void> {
  const sourceEnv = process.env['REFRESH_SOURCE']?.trim() ?? '';
  const sources = sourceEnv
    ? [sourceEnv]
    : readdirSync('sources')
        .filter((f) => f.endsWith('.yaml'))
        .map((f) => f.replace(/\.yaml$/, ''));

  const results = await Promise.allSettled(sources.map(run));

  let anyFailed = false;
  const stalenessEntries: StalenessEntry[] = [];
  const now = new Date();
  const dryRun = process.env['DRY_RUN'] === 'true';

  for (const [i, result] of results.entries()) {
    if (result.status === 'rejected') {
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      log('error', 'pipeline_failed', { source: sources[i], msg });
      anyFailed = true;
      continue;
    }
    const { cadence_days, new_state, skipped, source } = result.value;
    if (cadence_days !== undefined) {
      stalenessEntries.push(buildStalenessEntry(source, cadence_days, new_state, now));
      // Close any open staleness issue when content has just changed.
      const token = process.env['GITHUB_TOKEN'];
      const repo = process.env['GITHUB_REPOSITORY'];
      if (!dryRun && !skipped && new_state && token && repo) {
        const changed = new_state.last_content_change === new_state.last_run;
        if (changed) await closeStalenessIssues(source, token, repo).catch(() => undefined);
      }
    }
  }

  if (stalenessEntries.length > 0) {
    const markdown = buildSummaryMarkdown(stalenessEntries);
    const summaryPath = process.env['GITHUB_STEP_SUMMARY'];
    if (summaryPath) {
      await writeFile(summaryPath, `\n${markdown}\n`, { flag: 'a' });
    }

    const token = process.env['GITHUB_TOKEN'];
    const repo = process.env['GITHUB_REPOSITORY'];
    if (!dryRun && token && repo) {
      await Promise.allSettled(
        stalenessEntries.filter((e) => e.overdue).map((e) => createStalenessIssue(e, token, repo))
      );
    }
  }

  if (anyFailed) process.exit(1);
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
