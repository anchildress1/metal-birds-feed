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

export class R2DiffWriter {
  private client: S3Client;
  private bucket: string;
  private dryRun: boolean;

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
    });
  }

  async write(records: Map<string, Aircraft>, source: string): Promise<WriteStats> {
    const oldManifest = await this.loadManifest(source);
    const newManifest: Manifest = {};

    for (const [id, record] of records) {
      newManifest[id] = {
        hash: contentHash(record),
        icao_hex: record.icao_hex,
        registration: record.registration,
      };
    }

    const toWrite = new Set<string>();
    const toDelete = new Set<string>();
    const dirtyHex = new Set<string>();
    const dirtyReg = new Set<string>();

    for (const [id, entry] of Object.entries(newManifest)) {
      const old = oldManifest[id];
      if (!old || old.hash !== entry.hash) {
        toWrite.add(id);
        if (entry.icao_hex) dirtyHex.add(entry.icao_hex);
        dirtyReg.add(entry.registration);
        if (old?.icao_hex && old.icao_hex !== entry.icao_hex) dirtyHex.add(old.icao_hex);
        if (old?.registration && old.registration !== entry.registration)
          dirtyReg.add(old.registration);
      }
    }

    for (const [id, entry] of Object.entries(oldManifest)) {
      if (!newManifest[id]) {
        toDelete.add(id);
        if (entry.icao_hex) dirtyHex.add(entry.icao_hex);
        dirtyReg.add(entry.registration);
      }
    }

    // Precompute inverse maps so dirty-key resolution is O(n) not O(n * |dirty|)
    const hexToIds = new Map<string, string[]>();
    const regToIds = new Map<string, string[]>();
    for (const [id, entry] of Object.entries(newManifest)) {
      if (entry.icao_hex) {
        const ids = hexToIds.get(entry.icao_hex) ?? [];
        ids.push(id);
        hexToIds.set(entry.icao_hex, ids);
      }
      const ids = regToIds.get(entry.registration) ?? [];
      ids.push(id);
      regToIds.set(entry.registration, ids);
    }

    await Promise.all([
      Promise.all(
        [...toWrite].map(async (id) => {
          const rec = records.get(id);
          /* v8 ignore next 2 — toWrite IDs are always present in records */
          if (rec) await this.put(`aircraft/by-id/${source}/${id}.json`, rec);
        })
      ),
      Promise.all([...toDelete].map((id) => this.del(`aircraft/by-id/${source}/${id}.json`))),
      Promise.all(
        [...dirtyHex].map(async (hex) => {
          const refs = await this.mergeIndexRefs(
            `aircraft/by-icao-hex/${hex}.json`,
            (hexToIds.get(hex) ?? []).map((id) => `${source}:${id}`),
            source
          );
          if (refs.length > 0) {
            await this.put(`aircraft/by-icao-hex/${hex}.json`, { refs });
          } else {
            await this.del(`aircraft/by-icao-hex/${hex}.json`);
          }
        })
      ),
      Promise.all(
        [...dirtyReg].map(async (reg) => {
          const refs = await this.mergeIndexRefs(
            `aircraft/by-registration/${reg}.json`,
            (regToIds.get(reg) ?? []).map((id) => `${source}:${id}`),
            source
          );
          if (refs.length > 0) {
            await this.put(`aircraft/by-registration/${reg}.json`, { refs });
          } else {
            await this.del(`aircraft/by-registration/${reg}.json`);
          }
        })
      ),
    ]);

    await this.put(`aircraft/_manifest/${source}.json`, newManifest);

    const stats: WriteStats = {
      put: toWrite.size,
      deleted: toDelete.size,
      skipped: records.size - toWrite.size,
    };
    log('info', 'write_complete', { source, dry_run: this.dryRun, ...stats });
    return stats;
  }

  private async loadManifest(source: string): Promise<Manifest> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: `aircraft/_manifest/${source}.json` })
      );
      const body = await res.Body?.transformToString();
      if (!body) return {};
      const parsed = ManifestSchema.safeParse(JSON.parse(body));
      if (!parsed.success)
        throw new Error(`Invalid manifest for ${source}: ${parsed.error.message}`);
      return parsed.data;
    } catch (err) {
      if (err instanceof NoSuchKey) return {};
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
  }

  private async del(key: string): Promise<void> {
    if (this.dryRun) {
      log('info', 'dry_run_delete', { key });
      return;
    }
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
