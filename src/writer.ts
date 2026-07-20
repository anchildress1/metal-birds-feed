import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
} from '@aws-sdk/client-s3';
import type { Aircraft } from './schema.js';
import type { FeedRow } from './feed-row.js';
import { FeedRowsSchema } from './feed.js';
import { buildSqlite, hashRecords } from './db.js';
import { log, errorMessage } from './logger.js';
import { retry, type RetryOptions } from './retry.js';
import { SourceStateSchema, type SourceState } from './cadence.js';

// R2 intermittently returns 500 "We encountered an internal error. Please try again." under load.
// The SDK's adaptive retry rate-limiter drains its token bucket during a blip and then fast-fails
// the rest of a batch — so an app-level retry sits outside it, absorbing the residual transient
// errors. NoSuchKey is a real "absent" signal callers handle, never a transport failure — exclude
// it. 4xx (auth/validation) are permanent, except 429 — rate limits heal once the bucket drains.
export const isTransientS3Error = (err: unknown): boolean => {
  if (err instanceof NoSuchKey) return false;
  const status = (err as { $metadata?: { httpStatusCode?: number } } | null)?.$metadata
    ?.httpStatusCode;
  return status === undefined || status >= 500 || status === 429;
};

const S3_RETRY: RetryOptions = {
  isRetryable: isTransientS3Error,
  onRetry: (attempt, err) => log('warn', 's3_retry', { attempt, msg: errorMessage(err) }),
};

const S3_MAX_ATTEMPTS = 5;

// A run yielding under this fraction of the prior record count is treated as a truncated/partial
// upstream (an HTTP-success-but-short download that parses cleanly), not a real shrinkage —
// aircraft registries don't lose half their fleet in a refresh. Refuse rather than overwrite the
// good artifact with a partial one.
const MIN_RETAIN_RATIO = 0.5;

export interface WriteStats {
  changed: boolean;
  record_count: number;
  content_hash: string;
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

export class R2ArtifactWriter {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly dryRun: boolean;

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

  // Builds the source's SQLite artifact and writes it to aircraft/<source>.sqlite, skipping the
  // PUT when the record set is byte-for-byte the prior run's (content_hash match). `changed`
  // reports whether the artifact was rewritten so the caller can stamp last_content_change.
  async write(
    records: Map<string, Aircraft>,
    source: string,
    priorState: SourceState | null
  ): Promise<WriteStats> {
    const content_hash = hashRecords(records);

    // Zero records is upstream data loss for an aircraft registry, never a legitimate dataset —
    // refuse rather than publish an empty artifact. Unconditional (not gated on prior
    // record_count): a source on its first migration run has no prior _state, so a count check
    // alone would let a fresh source publish empty.
    if (records.size === 0) {
      throw new Error(`Refusing to write 0 records for "${source}" (suspected upstream data loss)`);
    }

    const priorCount = priorState?.record_count;
    if (
      priorCount !== undefined &&
      priorCount > 0 &&
      records.size / priorCount < MIN_RETAIN_RATIO
    ) {
      throw new Error(
        `Refusing to write ${records.size} records for "${source}": ${Math.round((1 - records.size / priorCount) * 100)}% drop from prior ${priorCount} (suspected truncated upstream). Delete aircraft/_state/${source}.json to override.`
      );
    }

    // A prior hash that is absent (legacy/first-run state) never equals the current one, so the
    // artifact is rewritten — exactly what a format migration needs. The skip additionally
    // requires the artifact to actually exist: state and artifact are separate objects, and an
    // externally deleted artifact (lifecycle rule, manual cleanup) would otherwise 404 for
    // consumers indefinitely while every run reports unchanged.
    const dataUnchanged = priorState?.content_hash === content_hash;
    if (dataUnchanged && (await this.artifactExists(source))) {
      log('info', 'artifact_unchanged', { source, record_count: records.size });
      return { changed: false, record_count: records.size, content_hash };
    }

    const bytes = buildSqlite(records);
    await this.put(`aircraft/${source}.sqlite`, bytes, 'application/vnd.sqlite3');
    log('info', 'artifact_written', {
      source,
      dry_run: this.dryRun,
      record_count: records.size,
      bytes: bytes.byteLength,
    });
    // `changed` reports DATA change only. A self-heal rewrite of a deleted artifact carries the
    // same record set, so it must not stamp last_content_change or close staleness issues.
    return { changed: !dataUnchanged, record_count: records.size, content_hash };
  }

  // In dry-run there is nothing on the remote to verify, so the skip stands on the hash alone.
  // HEAD 404s surface as generic errors (not NoSuchKey, which is GET-only), so any non-transient
  // failure reads as "absent" — the false-negative cost is one redundant PUT, never a lost one.
  // Public: pipeline.ts's cadence gate also needs this, to avoid honoring a cadence skip for a
  // source whose artifact was deleted independently of its state (see pipeline.ts's run()).
  async artifactExists(source: string): Promise<boolean> {
    if (this.dryRun) return true;
    try {
      await retry(
        () =>
          this.client.send(
            new HeadObjectCommand({ Bucket: this.bucket, Key: `aircraft/${source}.sqlite` })
          ),
        S3_RETRY
      );
      return true;
    } catch (err) {
      // Carry the error: a 404 and an R2 outage are indistinguishable by outcome here, so the
      // message is the only thing telling an operator which one they are triaging.
      log('warn', 'artifact_missing_on_hash_match', { source, msg: errorMessage(err) });
      return false;
    }
  }

  // Cadence skips are only safe when the feed slice both exists and is usable. A HEAD would pass a
  // present-but-corrupt-JSON slice, which `readFeedRows` later treats as absent — so `publishFeed`
  // fails closed every run while nothing regenerates the slice until cadence expiry. Read+parse here
  // (via readFeedRows, which returns null for absent OR corrupt) so the self-heal path covers a bad
  // intermediate, not only a missing one. R2 egress is free, so the extra GET costs one cheap op.
  async feedRowsExist(source: string): Promise<boolean> {
    if (this.dryRun) return true;
    try {
      return (await this.readFeedRows(source)) !== null;
    } catch (err) {
      log('warn', 'feed_rows_missing_on_cadence_skip', { source, msg: errorMessage(err) });
      return false;
    }
  }

  async readState(source: string): Promise<SourceState | null> {
    try {
      const res = await retry(
        () =>
          this.client.send(
            new GetObjectCommand({ Bucket: this.bucket, Key: `aircraft/_state/${source}.json` })
          ),
        S3_RETRY
      );
      const body = await res.Body?.transformToString();
      if (!body) return null;
      let json: unknown;
      try {
        json = JSON.parse(body);
      } catch {
        // Present-but-corrupt state is worse than absent — log it. Run proceeds fresh (re-PUT).
        log('error', 'state_parse_failed', { source, reason: 'invalid_json' });
        return null;
      }
      const parsed = SourceStateSchema.safeParse(json);
      if (!parsed.success) {
        log('error', 'state_parse_failed', {
          source,
          reason: 'schema_invalid',
          msg: parsed.error.message,
        });
        return null;
      }
      return parsed.data;
    } catch (err) {
      if (err instanceof NoSuchKey) return null;
      log('error', 'state_load_failed', {
        source,
        msg: errorMessage(err),
      });
      throw err;
    }
  }

  async writeState(source: string, state: SourceState): Promise<void> {
    await this.put(`aircraft/_state/${source}.json`, JSON.stringify(state), 'application/json');
  }

  // Per-source feed slice, the build intermediate main() merges into the consolidated DB.
  // Stored as JSON so consolidation reads it back without a SQLite round trip.
  async writeFeedRows(source: string, rows: FeedRow[]): Promise<void> {
    await this.put(`aircraft/_feed/${source}.json`, JSON.stringify(rows), 'application/json');
  }

  async readFeedRows(source: string): Promise<FeedRow[] | null> {
    try {
      const res = await retry(
        () =>
          this.client.send(
            new GetObjectCommand({ Bucket: this.bucket, Key: `aircraft/_feed/${source}.json` })
          ),
        S3_RETRY
      );
      const body = await res.Body?.transformToString();
      if (!body) return null;
      let json: unknown;
      try {
        json = JSON.parse(body);
      } catch {
        // Present-but-corrupt slice reads as absent (parity with readState): publishFeed then fails
        // closed on the named source rather than crashing the whole Promise.all on a raw parse error.
        log('error', 'feed_rows_parse_failed', { source, reason: 'invalid_json' });
        return null;
      }
      // Valid JSON isn't enough: a wrong-shape slice (bare object, row missing a NOT NULL column,
      // scalar rows) would crash consolidation on merge/hash/insert. Reject it as absent so the
      // cadence self-heal regenerates the slice instead.
      const parsed = FeedRowsSchema.safeParse(json);
      if (!parsed.success) {
        log('error', 'feed_rows_parse_failed', {
          source,
          reason: 'schema_invalid',
          msg: parsed.error.message,
        });
        return null;
      }
      return parsed.data;
    } catch (err) {
      if (err instanceof NoSuchKey) return null;
      log('error', 'feed_rows_load_failed', { source, msg: errorMessage(err) });
      throw err;
    }
  }

  // Content hash of the consolidated feed last deployed to Cloud Run. The scheduled deploy job reads
  // it to decide whether a redeploy is warranted, and advances it only after a successful deploy.
  async readDeployedFeedHash(): Promise<string | null> {
    try {
      const res = await retry(
        () =>
          this.client.send(
            new GetObjectCommand({ Bucket: this.bucket, Key: 'aircraft/_feed/_deployed.json' })
          ),
        S3_RETRY
      );
      const body = await res.Body?.transformToString();
      if (!body) return null;
      try {
        const parsed = JSON.parse(body) as { hash?: unknown };
        return typeof parsed.hash === 'string' ? parsed.hash : null;
      } catch {
        log('error', 'deployed_feed_hash_parse_failed', { reason: 'invalid_json' });
        return null;
      }
    } catch (err) {
      if (err instanceof NoSuchKey) return null;
      log('error', 'deployed_feed_hash_load_failed', { msg: errorMessage(err) });
      throw err;
    }
  }

  async writeDeployedFeedHash(hash: string): Promise<void> {
    await this.put('aircraft/_feed/_deployed.json', JSON.stringify({ hash }), 'application/json');
  }

  private async put(key: string, body: Uint8Array | string, contentType: string): Promise<void> {
    if (this.dryRun) {
      log('info', 'dry_run_put', { key });
      return;
    }
    await retry(
      () =>
        this.client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
          })
        ),
      S3_RETRY
    );
  }
}
