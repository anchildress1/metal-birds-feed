import { resolve } from 'node:path';
import { loadSourceConfig } from './config/loader.js';
import { download } from './downloader.js';
import { translate } from './engine.js';
import { R2DiffWriter } from './writer.js';
import { log } from './logger.js';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

async function run(sourceId: string): Promise<void> {
  log('info', 'pipeline_start', { source: sourceId });
  const start = Date.now();

  const configPath = resolve('sources', `${sourceId}.yaml`);
  const config = loadSourceConfig(configPath);

  const files = await download(config.download);
  const { records, stats } = await translate(config, files);

  log('info', 'translate_summary', { source: sourceId, ...stats });

  const dryRun = process.env['DRY_RUN'] === 'true';

  if (dryRun) {
    log('info', 'dry_run_mode', { source: sourceId, records: records.size });
  } else {
    const writer = new R2DiffWriter(
      {
        accountId: requireEnv('MBF_R2_ACCOUNT_ID'),
        accessKeyId: requireEnv('MBF_R2_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv('MBF_R2_SECRET_ACCESS_KEY'),
        bucketName: requireEnv('MBF_R2_BUCKET_NAME'),
      },
      false
    );
    await writer.write(records, sourceId);
  }

  log('info', 'pipeline_complete', { source: sourceId, elapsed_ms: Date.now() - start });
}

async function main(): Promise<void> {
  const sourceEnv = process.env['REFRESH_SOURCE']?.trim() ?? '';
  const sources = sourceEnv ? [sourceEnv] : ['faa'];

  const errors: string[] = [];
  for (const source of sources) {
    try {
      await run(source);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log('error', 'pipeline_failed', { source, msg });
      errors.push(source);
    }
  }

  if (errors.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
