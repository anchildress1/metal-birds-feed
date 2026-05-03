import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  NoSuchKey,
} from '@aws-sdk/client-s3';
import { z } from 'zod';
import type { Aircraft } from './schema.js';
import { contentHash } from './engine.js';
import { log } from './logger.js';

const ManifestEntrySchema = z.object({
  hash: z.string(),
  icao_hex: z.string().nullable(),
  registration: z.string(),
});
const ManifestSchema = z.record(z.string(), ManifestEntrySchema);

type Manifest = z.infer<typeof ManifestSchema>;

const RefIndexSchema = z.object({ refs: z.array(z.string()).optional() });

export interface WriteStats {
  put: number;
  deleted: number;
  skipped: number;
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

interface DiffSets {
  toWrite: Set<string>;
  toDelete: Set<string>;
  dirtyHex: Set<string>;
  dirtyReg: Set<string>;
}

interface InverseMaps {
  hexToIds: Map<string, string[]>;
  regToIds: Map<string, string[]>;
}

interface ManifestLoad {
  manifest: Manifest;
  exists: boolean;
}

// Per-bucket worker-pool size. Effective peak in-flight = S3_CONCURRENCY × (writeRecords +
// deleteRecords + 2 updateIndex calls) when all four buckets have work. Sized conservatively
// so initial-load fan-out doesn't trip R2 throttling or saturate the SDK's HTTP socket pool.
const S3_CONCURRENCY = 16;

// Bound SDK retries — adaptive mode backs off automatically on R2 throttling (HTTP 503).
const S3_MAX_ATTEMPTS = 5;
const PROGRESS_INTERVAL_MS = 5_000;

const runWorkerPool = async <T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency: number
): Promise<void> => {
  if (items.length === 0) return;
  let cursor = 0;
  // Async-recursive worker: each step suspends through the microtask queue, so call-stack
  // depth stays bounded even at 290k+ items. Keeps slow ops from blocking fast ones (unlike
  // a batched approach where the slowest in each batch blocks the next).
  const runWorker = async (): Promise<void> => {
    const idx = cursor++;
    if (idx >= items.length) return;
    await fn(items[idx]);
    await runWorker();
  };
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(workers);
};

const buildManifest = (records: Map<string, Aircraft>): Manifest => {
  const manifest: Manifest = {};
  for (const [id, record] of records) {
    manifest[id] = {
      hash: contentHash(record),
      icao_hex: record.icao_hex,
      registration: record.registration,
    };
  }
  return manifest;
};

const trackDirtyOnUpdate = (
  old: Manifest[string] | undefined,
  entry: Manifest[string],
  dirtyHex: Set<string>,
  dirtyReg: Set<string>
): void => {
  // Empty registration / null icao_hex = record stays findable by-id but isn't indexed.
  // Skipping here keeps every unindexed record from collapsing to one stub index file.
  if (entry.icao_hex) dirtyHex.add(entry.icao_hex);
  if (entry.registration) dirtyReg.add(entry.registration);
  if (old?.icao_hex && old.icao_hex !== entry.icao_hex) dirtyHex.add(old.icao_hex);
  if (old?.registration && old.registration !== entry.registration) dirtyReg.add(old.registration);
};

const computeDiffs = (oldManifest: Manifest, newManifest: Manifest): DiffSets => {
  const diffs: DiffSets = {
    toWrite: new Set(),
    toDelete: new Set(),
    dirtyHex: new Set(),
    dirtyReg: new Set(),
  };

  for (const [id, entry] of Object.entries(newManifest)) {
    const old = oldManifest[id];
    if (old?.hash !== entry.hash) {
      diffs.toWrite.add(id);
      trackDirtyOnUpdate(old, entry, diffs.dirtyHex, diffs.dirtyReg);
    }
  }

  for (const [id, entry] of Object.entries(oldManifest)) {
    if (!newManifest[id]) {
      diffs.toDelete.add(id);
      if (entry.icao_hex) diffs.dirtyHex.add(entry.icao_hex);
      if (entry.registration) diffs.dirtyReg.add(entry.registration);
    }
  }

  return diffs;
};

// Precompute inverse maps so dirty-key resolution is O(n) not O(n * |dirty|)
const buildInverseMaps = (newManifest: Manifest): InverseMaps => {
  const hexToIds = new Map<string, string[]>();
  const regToIds = new Map<string, string[]>();
  for (const [id, entry] of Object.entries(newManifest)) {
    if (entry.icao_hex) {
      const ids = hexToIds.get(entry.icao_hex) ?? [];
      ids.push(id);
      hexToIds.set(entry.icao_hex, ids);
    }
    if (entry.registration) {
      const ids = regToIds.get(entry.registration) ?? [];
      ids.push(id);
      regToIds.set(entry.registration, ids);
    }
  }
  return { hexToIds, regToIds };
};

export class R2DiffWriter {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly dryRun: boolean;
  private completed = 0;
  private totalOps = 0;

  constructor(config: R2Config, dryRun = false) {
    this.bucket = config.bucketName;
    this.dryRun = dryRun;
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      maxAttempts: S3_MAX_ATTEMPTS,
      retryMode: 'adaptive',
    });
  }

  async write(records: Map<string, Aircraft>, source: string): Promise<WriteStats> {
    const { manifest: oldManifest, exists: manifestExists } = await this.loadManifest(source);
    const newManifest = buildManifest(records);
    const diffs = computeDiffs(oldManifest, newManifest);
    const inverse = buildInverseMaps(newManifest);
    // Skip per-key GET-merge only when the manifest object truly didn't exist. An empty-but-
    // present manifest may indicate a prior partial write — preserve other-source refs in
    // that case.
    const freshBucket = !manifestExists;

    this.completed = 0;
    this.totalOps =
      diffs.toWrite.size + diffs.toDelete.size + diffs.dirtyHex.size + diffs.dirtyReg.size + 1;

    log('info', 'write_plan', {
      source,
      fresh_bucket: freshBucket,
      dry_run: this.dryRun,
      to_write: diffs.toWrite.size,
      to_delete: diffs.toDelete.size,
      dirty_hex: diffs.dirtyHex.size,
      dirty_reg: diffs.dirtyReg.size,
      total_ops: this.totalOps,
    });

    const ticker = this.startProgressTicker(source);
    try {
      await Promise.all([
        this.writeRecords(diffs.toWrite, source, records),
        this.deleteRecords(diffs.toDelete, source),
        this.updateIndex(diffs.dirtyHex, 'by-icao-hex', inverse.hexToIds, source, freshBucket),
        this.updateIndex(diffs.dirtyReg, 'by-registration', inverse.regToIds, source, freshBucket),
      ]);
      await this.put(`aircraft/_manifest/${source}.json`, newManifest);
    } finally {
      clearInterval(ticker);
    }

    const stats: WriteStats = {
      put: diffs.toWrite.size,
      deleted: diffs.toDelete.size,
      skipped: records.size - diffs.toWrite.size,
    };
    log('info', 'write_complete', { source, dry_run: this.dryRun, ...stats });
    return stats;
  }

  private startProgressTicker(source: string): NodeJS.Timeout {
    return setInterval(() => {
      log('info', 'write_progress', {
        source,
        completed: this.completed,
        total: this.totalOps,
      });
    }, PROGRESS_INTERVAL_MS);
  }

  private async writeRecords(
    toWrite: Set<string>,
    source: string,
    records: Map<string, Aircraft>
  ): Promise<void> {
    await runWorkerPool(
      [...toWrite],
      async (id) => {
        const rec = records.get(id);
        /* v8 ignore next 2 — toWrite IDs are always present in records */
        if (rec) await this.put(`aircraft/by-id/${source}/${id}.json`, rec);
      },
      S3_CONCURRENCY
    );
  }

  private async deleteRecords(toDelete: Set<string>, source: string): Promise<void> {
    await runWorkerPool(
      [...toDelete],
      (id) => this.del(`aircraft/by-id/${source}/${id}.json`),
      S3_CONCURRENCY
    );
  }

  private async updateIndex(
    dirty: Set<string>,
    prefix: 'by-icao-hex' | 'by-registration',
    keyToIds: Map<string, string[]>,
    source: string,
    freshBucket: boolean
  ): Promise<void> {
    await runWorkerPool(
      [...dirty],
      async (key) => {
        const objectKey = `aircraft/${prefix}/${key}.json`;
        const sourceRefs = (keyToIds.get(key) ?? []).map((id) => `${source}:${id}`);
        const refs = freshBucket
          ? sourceRefs
          : await this.mergeIndexRefs(objectKey, sourceRefs, source);
        if (refs.length > 0) await this.put(objectKey, { refs });
        else await this.del(objectKey);
      },
      S3_CONCURRENCY
    );
  }

  private async loadManifest(source: string): Promise<ManifestLoad> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: `aircraft/_manifest/${source}.json` })
      );
      const body = await res.Body?.transformToString();
      if (!body) return { manifest: {}, exists: true };
      const parsed = ManifestSchema.safeParse(JSON.parse(body));
      if (!parsed.success)
        throw new Error(`Invalid manifest for ${source}: ${parsed.error.message}`);
      return { manifest: parsed.data, exists: true };
    } catch (err) {
      if (err instanceof NoSuchKey) return { manifest: {}, exists: false };
      log('error', 'manifest_load_failed', {
        source,
        msg: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  private async mergeIndexRefs(
    key: string,
    sourceRefs: string[],
    source: string
  ): Promise<string[]> {
    const existingRefs = await this.loadRefs(key);
    const sourcePrefix = `${source}:`;
    return Array.from(
      new Set([...existingRefs.filter((ref) => !ref.startsWith(sourcePrefix)), ...sourceRefs])
    );
  }

  private async loadRefs(key: string): Promise<string[]> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const body = await res.Body?.transformToString();
      if (!body) return [];
      const parsed = RefIndexSchema.safeParse(JSON.parse(body));
      if (!parsed.success) throw new Error(`Invalid ref index ${key}: ${parsed.error.message}`);
      return parsed.data.refs ?? [];
    } catch (err) {
      if (err instanceof NoSuchKey) return [];
      log('error', 'index_load_failed', {
        key,
        msg: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  private async put(key: string, body: unknown): Promise<void> {
    if (this.dryRun) {
      log('info', 'dry_run_put', { key });
      this.completed++;
      return;
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: JSON.stringify(body),
        ContentType: 'application/json',
      })
    );
    this.completed++;
  }

  private async del(key: string): Promise<void> {
    if (this.dryRun) {
      log('info', 'dry_run_delete', { key });
      this.completed++;
      return;
    }
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    this.completed++;
  }
}
