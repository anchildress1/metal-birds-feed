import { Open } from 'unzipper';
import type { DownloadConfig } from './types/config.js';
import { log } from './logger.js';

export async function download(config: DownloadConfig): Promise<Map<string, Buffer>> {
  const start = Date.now();
  log('info', 'download_start', { url: config.url });

  const res = await fetch(config.url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);

  const buf = Buffer.from(await res.arrayBuffer());
  log('info', 'download_complete', {
    url: config.url,
    bytes: buf.byteLength,
    elapsed_ms: Date.now() - start,
  });

  return extractZip(buf, config.entries);
}

async function extractZip(
  buf: Buffer,
  entries: Record<string, string>
): Promise<Map<string, Buffer>> {
  const wanted = new Map(Object.entries(entries).map(([alias, path]) => [path, alias]));
  const result = new Map<string, Buffer>();

  const dir = await Open.buffer(buf);
  await Promise.all(
    dir.files
      .filter((f) => wanted.has(f.path))
      .map(
        (f) =>
          new Promise<void>((resolve, reject) => {
            const chunks: Buffer[] = [];
            f.stream()
              .on('data', (c: Buffer) => chunks.push(c))
              .on('end', () => {
                result.set(wanted.get(f.path)!, Buffer.concat(chunks));
                resolve();
              })
              .on('error', reject);
          })
      )
  );

  for (const alias of Object.keys(entries)) {
    if (!result.has(alias)) throw new Error(`ZIP entry not found for alias "${alias}"`);
  }

  log('info', 'extract_complete', { files: result.size });
  return result;
}
