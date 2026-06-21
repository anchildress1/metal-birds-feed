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
        // Invalid JSON treated as absent — pipeline proceeds with a fresh run.
        return null;
      }
      const parsed = SourceStateSchema.safeParse(json);
      // Malformed schema treated as absent — pipeline proceeds with a fresh run.
      return parsed.success ? parsed.data : null;
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
