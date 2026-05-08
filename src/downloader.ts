import { Open } from 'unzipper';
import type { DownloadConfig } from './types/config.js';
import { log } from './logger.js';

export async function download(config: DownloadConfig): Promise<Map<string, Buffer>> {
  const start = Date.now();
  const url = await resolveDownloadUrl(config);
  log('info', 'download_start', { url });

  const res = await fetch(url, { headers: config.headers });
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);

  const buf = Buffer.from(await res.arrayBuffer());
  log('info', 'download_complete', {
    url,
    bytes: buf.byteLength,
    elapsed_ms: Date.now() - start,
  });

  if (config.format === 'file') {
    return extractFile(buf, config.entries);
  }
  return extractZip(buf, config.entries);
}

// Resolves the actual download URL. If `discover_url` + `discover_pattern` are configured
// (e.g., NL ILT, where the bulk-download filename embeds the publication date and rolls
// each refresh), fetch the index page, regex-match the first capture group, and return that
// URL — resolved against the index URL as the base for relative links. Otherwise, return
// `config.url` unchanged.
const resolveDownloadUrl = async (config: DownloadConfig): Promise<string> => {
  if (!config.discover_url || !config.discover_pattern) return config.url;
  log('info', 'discover_start', { discover_url: config.discover_url });
  const res = await fetch(config.discover_url, { headers: config.headers });
  if (!res.ok) {
    throw new Error(`Discovery fetch failed: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();
  // Pattern source is `sources/<id>.yaml`, a repo-controlled config — not runtime input.
  // Loader validates it as a syntactically valid regex before reaching this point.
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
  const match = new RegExp(config.discover_pattern).exec(html);
  const captured = match?.[1];
  if (!captured) {
    throw new Error(
      `Discovery pattern matched no URL on ${config.discover_url} (pattern needs a capture group)`
    );
  }
  const resolved = new URL(captured, config.discover_url).toString();
  log('info', 'discover_complete', { resolved });
  return resolved;
};

const extractFile = (buf: Buffer, entries: Record<string, string>): Map<string, Buffer> => {
  // Loader enforces exactly one alias for `format: 'file'`; the path value is conventional
  // (the URL is the file). The single-alias key becomes the engine's lookup name.
  const aliases = Object.keys(entries);
  const alias = aliases[0];
  if (alias === undefined) {
    throw new Error('download.entries must contain exactly one alias for format=file');
  }
  return new Map([[alias, buf]]);
};

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
                const alias = wanted.get(f.path);
                if (alias) result.set(alias, Buffer.concat(chunks));
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
