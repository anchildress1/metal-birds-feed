import { S3Client, GetObjectCommand, PutObjectCommand, NoSuchKey } from '@aws-sdk/client-s3';
import type { Aircraft } from './schema.js';
import { buildSqlite, hashRecords } from './db.js';
import { log } from './logger.js';
import { retry, type RetryOptions } from './retry.js';
import { SourceStateSchema, type SourceState } from './cadence.js';

// R2 intermittently returns 500 "We encountered an internal error. Please try again." under load.
// The SDK's adaptive retry rate-limiter drains its token bucket during a blip and then fast-fails
// the rest of a batch — so an app-level retry sits outside it, absorbing the residual transient
// errors. NoSuchKey is a real "absent" signal callers handle, never a transport failure — exclude
// it. 4xx (auth/validation) are permanent.
export const isTransientS3Error = (err: unknown): boolean => {
  if (err instanceof NoSuchKey) return false;
  const status = (err as { $metadata?: { httpStatusCode?: number } } | null)?.$metadata
    ?.httpStatusCode;
  return status === undefined || status >= 500 || status === 429;
};

const S3_RETRY: RetryOptions = {
  isRetryable: isTransientS3Error,
  onRetry: (attempt, err) =>
    log('warn', 's3_retry', { attempt, msg: err instanceof Error ? err.message : String(err) }),
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
    // artifact is rewritten — exactly what a format migration needs.
    if (priorState?.content_hash === content_hash) {
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
    return { changed: true, record_count: records.size, content_hash };
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
        msg: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async writeState(source: string, state: SourceState): Promise<void> {
    await this.put(`aircraft/_state/${source}.json`, JSON.stringify(state), 'application/json');
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
