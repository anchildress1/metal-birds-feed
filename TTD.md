# TTD: Streaming Download for Large Archives

## Status

Deferred — not blocking v1. FAA ZIP is ~36MB compressed; GHA `ubuntu-latest` has 7GB RAM. Current buffer approach is safe for all known v1 sources.

## Problem

`download()` in `src/downloader.ts` fully buffers the HTTP response body before extraction:

```
fetch(url) → res.arrayBuffer() → Buffer.from() → Open.buffer(buf)
```

Peak memory = compressed ZIP + all decompressed entries held simultaneously. For sources with archives in the hundreds of MB or larger, this risks OOM on CI runners or forces a runner upgrade.

## Threshold

- Trigger streaming mode when `Content-Length` ≥ **256MB**
- If `Content-Length` is absent: default to streaming (unknown size = assume large)
- Below threshold: keep current buffer path (simpler, allows parallel entry extraction)

GHA `ubuntu-latest`: 2 vCPU, 7GB RAM, 6-hour job timeout.

## Design

### Buffer path (current, unchanged below threshold)

```
fetch → arrayBuffer → Buffer → Open.buffer → parallel Promise.all on entries
```

### Streaming path (new, above threshold)

```
fetch → response.body (ReadableStream) → unzipper.Parse pipe → sequential entry events
```

`unzipper.Parse` reads the local file headers as they arrive in the stream. There is **no central directory read** in streaming mode — entries must be collected as they are encountered, in order. Random access is not available.

```typescript
import { Parse } from 'unzipper';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

async function extractZipStream(
  body: ReadableStream<Uint8Array>,
  entries: Record<string, string>
): Promise<Map<string, Buffer>> {
  const wanted = new Map(Object.entries(entries).map(([alias, path]) => [path, alias]));
  const result = new Map<string, Buffer>();
  const nodeStream = Readable.fromWeb(body);

  await pipeline(
    nodeStream,
    Parse().on('entry', (entry) => {
      const alias = wanted.get(entry.path);
      if (!alias) {
        entry.autodrain();
        return;
      }
      const chunks: Buffer[] = [];
      entry
        .on('data', (c: Buffer) => chunks.push(c))
        .on('end', () => result.set(alias, Buffer.concat(chunks)));
    })
  );

  return result;
}
```

> `Readable.fromWeb` converts the Fetch `ReadableStream` to a Node.js `Readable`. Available in Node 18+ / Bun.

### Dispatch logic

```typescript
const contentLength = Number(res.headers.get('content-length') ?? -1);
const STREAM_THRESHOLD_BYTES = 256 * 1024 * 1024;
const useStream = contentLength < 0 || contentLength >= STREAM_THRESHOLD_BYTES;

if (useStream) {
  if (!res.body) throw new Error('Response body is null — cannot stream');
  return extractZipStream(res.body, config.entries);
} else {
  const buf = Buffer.from(await res.arrayBuffer());
  return extractZip(buf, config.entries);
}
```

## API Surface Changes

### `src/types/config.ts` — no change required

`DownloadConfig` has no memory-model concept; threshold is an internal implementation detail, not a per-source config option.

### `src/downloader.ts` — changes

- Import `Parse` from `unzipper`, `Readable` from `node:stream`, `pipeline` from `node:stream/promises`
- Add `extractZipStream()` function
- Add `STREAM_THRESHOLD_BYTES` constant (export for testability)
- Add dispatch block in `download()` between buffer and stream paths
- Log which mode was selected: `log('info', 'download_mode', { url, mode: 'stream' | 'buffer', content_length: contentLength })`

### `sources/*.yaml` — no change required

## Constraints and Trade-offs

| Concern                | Buffer path                     | Stream path                          |
| ---------------------- | ------------------------------- | ------------------------------------ |
| Entry extraction order | Any (parallel)                  | Sequential (arrival order)           |
| Memory peak            | ZIP + all entries               | One entry at a time                  |
| Error visibility       | Full ZIP in hand before extract | Entry errors mid-stream              |
| Retry granularity      | Whole download                  | Whole download (HTTP, not resumable) |
| unzipper API           | `Open.buffer`                   | `Parse` pipe                         |

Streaming extraction is **sequential** — `Promise.all` across entries is not possible. Each entry must drain completely before the next arrives. This is acceptable for pipeline use where throughput matters more than extract parallelism.

## Files Affected

- `src/downloader.ts` — dispatch + new `extractZipStream` function
- `tests/downloader.test.ts` — stream path tests, threshold boundary tests, missing `Content-Length` test

## Entry Validation

After streaming extraction, the missing-entry check (`if (!result.has(alias)) throw`) applies identically to both paths — no change needed.

## Test Plan

- `Content-Length` below threshold → buffer path used
- `Content-Length` at threshold exactly → stream path used
- `Content-Length` absent → stream path used
- All wanted entries present → result map fully populated
- Unwanted entries → autodrained, not in result
- Missing wanted entry → throws with alias name
- HTTP error → throws before dispatch (existing behavior unchanged)
