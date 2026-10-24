import { afterEach, expect, it, mock } from 'bun:test';
import { EventEmitter } from 'node:events';
import { setImmediate } from 'node:timers/promises';
import { crc32 } from 'node:zlib';

const parsed = Promise.withResolvers<void>();
const entryBytes = Buffer.from('registration\nN123AB\n');
const parser = Object.assign(new EventEmitter(), {
  write: mock<(bytes: Uint8Array) => boolean>(() => true).mockReturnValueOnce(false),
  end: mock(() => {
    parser.emit('entry', {
      path: 'MASTER.txt',
      vars: { flags: 0, crc32: crc32(entryBytes) },
      buffer: () => Promise.resolve(entryBytes),
    });
    parsed.resolve();
  }),
  destroy: mock((error: Error) => parsed.reject(error)),
  promise: () => parsed.promise,
});

// Control the external ZIP parser's drain event without relying on archive size or timing.
void mock.module('unzipper', () => ({ Parse: () => parser, Open: {} }));
const { download } = await import('../src/downloader.js');
const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

it('pauses reading ZIP bytes until the parser drains and preserves chunk order', async () => {
  const chunks = [new Uint8Array([1, 2]), new Uint8Array([3, 4])];
  let chunkIndex = 0;
  const pull = mock((controller: ReadableStreamDefaultController<Uint8Array>) => {
    const next = chunks[chunkIndex++];
    if (next) controller.enqueue(next);
    else controller.close();
  });
  const body = new ReadableStream({ pull }, { highWaterMark: 0 });
  globalThis.fetch = Object.assign(
    mock(() => Promise.resolve(new Response(body))),
    {
      preconnect: realFetch.preconnect,
    }
  );

  const pending = download(
    { url: 'https://example.com/registry.zip', format: 'zip', entries: { master: 'MASTER.txt' } },
    { attempts: 1 }
  );
  await setImmediate();
  expect(parser.write).toHaveBeenCalledTimes(1);
  expect(parser.write).toHaveBeenCalledWith(chunks[0]);
  expect(pull).toHaveBeenCalledTimes(1);
  expect(parser.end).not.toHaveBeenCalled();

  parser.emit('drain');
  const files = await pending;
  expect(parser.write.mock.calls.map(([bytes]) => bytes)).toEqual(chunks);
  expect(pull).toHaveBeenCalledTimes(3);
  expect(parser.end).toHaveBeenCalledTimes(1);
  expect(parser.destroy).not.toHaveBeenCalled();
  expect(files.get('master')).toEqual(entryBytes);
});
