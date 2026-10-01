import { readFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { loadSourceConfig } from './config/loader.js';
import { mapRows } from './engine.js';
import { assertRecordCountForWrite, R2ArtifactWriter } from './writer.js';
import { log } from './logger.js';
import { requireEnv } from './env.js';

// Register files carry owner addresses before mapping drops them; confining drops to one ignored
// directory keeps them out of anything git might stage.
export const DROP_DIR = 'drops';

function assertInsideDrop(sandbox: string, path: string, input: string): void {
  const rel = relative(sandbox, path);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel))
    throw new Error(`Drop file must sit inside ${DROP_DIR}/: ${input}`);
}

export const resolveDropPath = (input: string, root = resolve('.')): string => {
  if (input.includes('..')) throw new Error(`Path traversal rejected: ${input}`);
  const sandbox = resolve(root, DROP_DIR);
  const abs = resolve(root, input);
  assertInsideDrop(sandbox, abs, input);
  const canonical = realpathSync(abs);
  // Canonicalize the root, not drops/: a drops symlink must not move the sandbox elsewhere.
  assertInsideDrop(resolve(realpathSync(root), DROP_DIR), canonical, input);
  return canonical;
};

/**
 * Stores a manual register drop after mapping and refresh record-count validation.
 * @returns the number of records the file maps to.
 */
export async function ingest(sourceId: string, file: string, dryRun: boolean): Promise<number> {
  if (sourceId.includes('..') || sourceId.includes('/') || sourceId.includes('\\'))
    throw new Error(`Path traversal rejected: ${sourceId}`);
  const config = loadSourceConfig(resolve('sources', `${sourceId}.yaml`));
  if (config.download.manual !== true)
    throw new Error(`${sourceId} is not a download.manual source; \`make refresh\` fetches it`);

  const bytes = await readFile(resolveDropPath(file));
  const [alias] = Object.keys(config.download.entries);
  const { records, stats } = await mapRows(config, new Map([[alias, bytes]]), undefined);
  if (stats.failed > 0 || records.size === 0)
    throw new Error(
      `${file} mapped ${records.size} records with ${stats.failed} failures for ${sourceId}; not stored`
    );

  const writer = new R2ArtifactWriter(
    {
      accountId: requireEnv('MBF_R2_ACCOUNT_ID'),
      accessKeyId: requireEnv('MBF_R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('MBF_R2_SECRET_ACCESS_KEY'),
      bucketName: requireEnv('MBF_R2_BUCKET_NAME'),
    },
    dryRun
  );
  assertRecordCountForWrite(records.size, sourceId, await writer.readState(sourceId));
  await writer.writeDrop(sourceId, bytes);
  log('info', 'drop_stored', { source: sourceId, bytes: bytes.byteLength, records: records.size });
  return records.size;
}
