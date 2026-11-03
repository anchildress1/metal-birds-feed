import { afterEach, beforeEach, expect, it, mock } from 'bun:test';
import { PassThrough, Writable } from 'node:stream';
import { setImmediate } from 'node:timers/promises';
import { crc32 } from 'node:zlib';

const entryBytes = Buffer.from('registration\nN123AB\n');
const writeBytes = mock<(bytes: Uint8Array) => void>();
const finalize = mock<() => void>();
let releaseWrite: () => void;
const createParser = () =>
  new Writable({
    highWaterMark: 1,
    write(bytes: Uint8Array, _encoding, callback) {
      writeBytes(bytes);
      if (writeBytes.mock.calls.length === 1) releaseWrite = callback;
      else callback();
    },
    final(callback) {
      finalize();
      parser.emit(
        'entry',
        Object.assign(new PassThrough(), {
          path: 'MASTER.txt',
          vars: { flags: 0, crc32: crc32(entryBytes) },
          buffer: () => Promise.resolve(entryBytes),
        })
      );
      callback();
    },
  });
let parser = createParser();
beforeEach(() => {
  writeBytes.mockClear();
  finalize.mockClear();
  parser = createParser();
});

// Control the external ZIP parser's backpressure with a real writable stream.
void mock.module('unzipper', () => ({ Parse: () => parser, Open: {} }));
const { download } = await import('../src/downloader.js');
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});
const config = {
  url: 'https://example.com/registry.zip',
  format: 'zip' as const,
  entries: { master: 'MASTER.txt' },
};
const setBody = (body: ReadableStream<Uint8Array>) => {
  globalThis.fetch = Object.assign(
    mock(() => Promise.resolve(new Response(body))),
    { preconnect: realFetch.preconnect }
  );
};

it('pauses reading ZIP bytes until the parser drains and preserves chunk order', async () => {
  const chunks = [new Uint8Array([1, 2]), new Uint8Array([3, 4])];
  let chunkIndex = 0;
  const pull = mock((controller: ReadableStreamDefaultController<Uint8Array>) => {
    const next = chunks[chunkIndex++];
    if (next) controller.enqueue(next);
    else controller.close();
  });
  const body = new ReadableStream({ pull }, { highWaterMark: 0 });
  setBody(body);

  const pending = download(config, { attempts: 1 });
  await setImmediate();
  expect(writeBytes).toHaveBeenCalledTimes(1);
  expect([...writeBytes.mock.calls[0][0]]).toEqual([...chunks[0]]);
  expect(pull).toHaveBeenCalledTimes(1);
  expect(finalize).not.toHaveBeenCalled();

  releaseWrite();
  const files = await pending;
  expect(writeBytes.mock.calls.map(([bytes]) => [...bytes])).toEqual(
    chunks.map((bytes) => [...bytes])
  );
  expect(pull).toHaveBeenCalledTimes(3);
  expect(finalize).toHaveBeenCalledTimes(1);
  expect(body.locked).toBe(false);
  expect(files.get('master')).toEqual(entryBytes);
});

it.each(['reading', 'draining'] as const)(
  'cancels the response and releases its lock when parsing fails while %s',
  async (boundary) => {
    const cancel = mock(() => Promise.resolve());
    const body = new ReadableStream<Uint8Array>(
      {
        start(controller) {
          if (boundary === 'draining') controller.enqueue(new Uint8Array([1, 2]));
        },
        cancel,
      },
      { highWaterMark: 0 }
    );
    setBody(body);
    const pending = download(config, { attempts: 1 });
    void pending.catch(() => {});
    await setImmediate();
    expect(body.locked).toBe(true);
    expect(writeBytes).toHaveBeenCalledTimes(boundary === 'draining' ? 1 : 0);
    parser.destroy(new Error('invalid archive'));
    await expect(pending).rejects.toThrow('invalid archive');
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(body.locked).toBe(false);
    expect(finalize).not.toHaveBeenCalled();
  }
);
