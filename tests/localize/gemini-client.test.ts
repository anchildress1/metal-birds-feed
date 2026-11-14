import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { setImmediate } from 'node:timers/promises';
import { ApiError } from '@google/genai';
import { z } from 'zod';
import type { RetryOptions } from '../../src/retry.js';
import {
  translateBatch,
  isRetryableGeminiError,
  isGeminiAuthError,
  type TranslationItem,
} from '../../src/localize/gemini-client.js';
import { fakeGeminiHttp, geminiReply, geminiStatus, type SentRequest } from '../gemini-http.js';

// No-op sleep keeps backoff out of the test clock, mirroring tests/downloader.test.ts's FAST_RETRY.
const FAST_RETRY: RetryOptions = { baseDelayMs: 0, sleep: async () => {} };
const NO_RETRY: RetryOptions = { attempts: 1 };
type ChunkCallback = (
  translated: Map<string, string>,
  requested: TranslationItem[]
) => Promise<void>;

const apiError = (status: number) => new ApiError({ message: `status ${status}`, status });
const textResponse = (body: unknown) => geminiReply(JSON.stringify(body));
// The SDK sends a string `contents` as one user text part.
const sentItems = (req: SentRequest): { id: string; text: string }[] =>
  z
    .array(z.object({ id: z.string(), text: z.string() }))
    .parse(JSON.parse(String(req.body.contents[0].parts[0].text)));

let gemini: ReturnType<typeof fakeGeminiHttp>;
beforeEach(() => {
  gemini = fakeGeminiHttp();
});
afterEach(() => {
  gemini.restore();
});

describe('isRetryableGeminiError', () => {
  it('treats 429/5xx as retryable', () => {
    for (const status of [429, 500, 502, 503, 504]) {
      expect(isRetryableGeminiError(apiError(status))).toBe(true);
    }
  });

  it('treats 4xx auth/request errors as terminal', () => {
    for (const status of [400, 401, 403, 404]) {
      expect(isRetryableGeminiError(apiError(status))).toBe(false);
    }
  });

  it('treats a network-level error with no status as retryable', () => {
    expect(isRetryableGeminiError(new TypeError('fetch failed'))).toBe(true);
    expect(isRetryableGeminiError(null)).toBe(true);
    expect(isRetryableGeminiError('boom')).toBe(true);
  });

  it('treats a non-numeric status as terminal', () => {
    expect(isRetryableGeminiError({ status: 'nope' })).toBe(false);
  });
});

describe('isGeminiAuthError', () => {
  it.each([401, 403])('treats %i as an auth failure', (status) => {
    expect(isGeminiAuthError(apiError(status))).toBe(true);
  });

  it.each([400, 404, 429, 500, 503])('does not treat %i as an auth failure', (status) => {
    expect(isGeminiAuthError(apiError(status))).toBe(false);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'boom'],
    ['a network error with no status', new TypeError('fetch failed')],
    ['a non-numeric status', { status: '401' }],
  ])('does not treat %s as an auth failure', (_label, value) => {
    expect(isGeminiAuthError(value)).toBe(false);
  });
});

describe('translateBatch', () => {
  it('returns empty results without calling the API for an empty batch', async () => {
    const result = await translateBatch([], { apiKey: 'k' });
    expect(result.translated.size).toBe(0);
    expect(result.errors).toEqual([]);
    expect(gemini.sent).toEqual([]);
  });

  it('sends the items as JSON under the key, with an {id, text} array schema', async () => {
    const items: TranslationItem[] = [
      { id: 'a', field: 'cancellation_reason', text: 'AERONAVE EXPORTADA' },
    ];
    gemini.respond.mockImplementation(() => textResponse([{ id: 'a', text: 'Aircraft exported' }]));
    await translateBatch(items, { apiKey: 'k' });

    const [req] = gemini.sent;
    expect(req.url).toEndWith('/models/gemini-3.1-flash-lite:generateContent');
    expect(req.headers['x-goog-api-key']).toBe('k');
    expect(JSON.parse(String(req.body.contents[0].parts[0].text))).toEqual(items);
    expect(req.body.generationConfig).toEqual({
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingLevel: 'LOW' },
      responseSchema: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { id: { type: 'STRING' }, text: { type: 'STRING' } },
          required: ['id', 'text'],
          propertyOrdering: ['id', 'text'],
        },
      },
    });
  });

  it('translates a batch and maps id -> text', async () => {
    gemini.respond.mockImplementation(() =>
      textResponse([
        { id: 'a', text: 'Aircraft exported' },
        { id: 'b', text: 'Lien released' },
      ])
    );

    const { translated, errors } = await translateBatch(
      [
        { id: 'a', field: 'cancellation_reason', text: 'AERONAVE EXPORTADA' },
        { id: 'b', field: 'airworthiness_class', text: 'CA PADRAO' },
      ],
      { apiKey: 'k' }
    );

    expect(translated.get('a')).toBe('Aircraft exported');
    expect(translated.get('b')).toBe('Lien released');
    expect(errors).toEqual([]);
    expect(gemini.sent).toHaveLength(1);
  });

  it('splits batches larger than the chunk cap into separate calls', async () => {
    const rateLimitSleep = mock(() => Promise.resolve());
    gemini.respond.mockImplementation((req: SentRequest) => {
      const items = sentItems(req);
      return textResponse(items.map((i) => ({ id: i.id, text: `EN:${i.text}` })));
    });

    const items: TranslationItem[] = Array.from({ length: 201 }, (_, i) => ({
      id: `id${i}`,
      field: 'cancellation_reason',
      text: `text${i}`,
    }));
    const { translated, errors } = await translateBatch(items, {
      apiKey: 'k',
      requestsPerMinute: 12,
      rateLimitSleep,
    });

    expect(gemini.sent).toHaveLength(2);
    expect(translated.get('id0')).toBe('EN:text0');
    expect(translated.get('id200')).toBe('EN:text200');
    expect(errors).toEqual([]);
    expect(rateLimitSleep).toHaveBeenCalledWith(5_000);
  });

  it('keeps a failing chunk from discarding another chunk that succeeded', async () => {
    gemini.respond.mockImplementation((req: SentRequest) => {
      const items = sentItems(req);
      if (items.some((i) => i.id === 'fails')) return geminiStatus(400);
      return textResponse(items.map((i) => ({ id: i.id, text: `EN:${i.text}` })));
    });

    // 201 items forces 2 chunks (cap is 200): the first chunk always contains 'fails' and rejects,
    // the second (just 'ok') succeeds — proves one chunk's failure doesn't discard the other's work.
    const failingChunk: TranslationItem[] = Array.from({ length: 200 }, (_, i) => ({
      id: i === 0 ? 'fails' : `id${i}`,
      field: 'cancellation_reason',
      text: `text${i}`,
    }));
    const items: TranslationItem[] = [
      ...failingChunk,
      { id: 'ok', field: 'cancellation_reason', text: 'x' },
    ];

    const { translated, errors } = await translateBatch(items, {
      apiKey: 'k',
      retryOptions: FAST_RETRY,
      rateLimitSleep: async () => {},
    });

    expect(errors).toHaveLength(1);
    expect(translated.get('ok')).toBe('EN:x');
    expect(translated.has('fails')).toBe(false);
  });

  it('stops sending chunks once the key is rejected', async () => {
    gemini.respond.mockImplementation(() => geminiStatus(401));
    const items: TranslationItem[] = Array.from({ length: 401 }, (_, i) => ({
      id: `id${i}`,
      field: 'cancellation_reason',
      text: `text${i}`,
    }));

    const { translated, errors } = await translateBatch(items, {
      apiKey: 'k',
      retryOptions: FAST_RETRY,
      rateLimitSleep: async () => {},
    });

    expect(gemini.sent).toHaveLength(1);
    expect(errors).toEqual([expect.objectContaining({ status: 401 })]);
    expect(translated.size).toBe(0);
  });

  it('exhausts its attempts on a persistent 503 and reports the chunk as an error', async () => {
    gemini.respond.mockImplementation(() => geminiStatus(503));

    const { translated, errors } = await translateBatch(
      [{ id: 'a', field: 'cancellation_reason', text: 'x' }],
      { apiKey: 'k', retryOptions: { ...FAST_RETRY, attempts: 3 }, rateLimitSleep: async () => {} }
    );

    expect(translated.size).toBe(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(ApiError);
    expect(gemini.sent).toHaveLength(3);
  });

  describe('onChunkTranslated', () => {
    const echo = (req: SentRequest) => {
      const items = sentItems(req);
      return textResponse(items.map((i) => ({ id: i.id, text: `EN:${i.text}` })));
    };
    const manyItems = (n: number): TranslationItem[] =>
      Array.from({ length: n }, (_, i) => ({
        id: `id${i}`,
        field: 'cancellation_reason' as const,
        text: `text${i}`,
      }));

    it("fires once per successful chunk with that chunk's translations and requested items", async () => {
      gemini.respond.mockImplementation(echo);
      const onChunkTranslated = mock<ChunkCallback>(() => Promise.resolve());

      await translateBatch(manyItems(201), {
        apiKey: 'k',
        rateLimitSleep: async () => {},
        onChunkTranslated,
      });

      expect(onChunkTranslated).toHaveBeenCalledTimes(2);
      const [firstMap, firstItems] = onChunkTranslated.mock.calls[0];
      const [secondMap, secondItems] = onChunkTranslated.mock.calls[1];
      expect(firstItems).toHaveLength(200);
      expect(firstMap.size).toBe(200);
      expect(firstMap.get('id0')).toBe('EN:text0');
      expect(secondItems.map((i) => i.id)).toEqual(['id200']);
      expect([...secondMap]).toEqual([['id200', 'EN:text200']]);
    });

    it.each(['provider', 'checkpoint'] as const)(
      'waits for the pending %s before starting the next request interval',
      async (boundary) => {
        const blocked = Promise.withResolvers<void>();
        const interval = Promise.withResolvers<void>();
        const rateLimitSleep = mock(() => interval.promise);
        const onChunkTranslated = mock<ChunkCallback>(async () => {
          if (boundary === 'checkpoint') await blocked.promise;
        });
        gemini.respond.mockImplementation(async (req: SentRequest) => {
          if (boundary === 'provider') await blocked.promise;
          return echo(req);
        });

        const pending = translateBatch(manyItems(401), {
          apiKey: 'k',
          requestsPerMinute: 12,
          rateLimitSleep,
          onChunkTranslated,
        });
        // Yield the event loop so any incorrectly concurrent chunk can reach the boundary.
        await setImmediate();
        expect(gemini.sent).toHaveLength(1);
        expect(rateLimitSleep).not.toHaveBeenCalled();
        expect(onChunkTranslated).toHaveBeenCalledTimes(boundary === 'checkpoint' ? 1 : 0);

        blocked.resolve();
        await setImmediate();
        expect(onChunkTranslated).toHaveBeenCalledTimes(1);
        expect(rateLimitSleep).toHaveBeenCalledTimes(1);
        expect(rateLimitSleep).toHaveBeenCalledWith(5_000);
        expect(gemini.sent).toHaveLength(1);

        interval.resolve();
        const { translated, errors } = await pending;
        expect(errors).toEqual([]);
        expect(translated.size).toBe(401);
        expect(translated.get('id400')).toBe('EN:text400');
        expect(gemini.sent).toHaveLength(3);
        expect(rateLimitSleep).toHaveBeenCalledTimes(2);
        expect(onChunkTranslated.mock.calls.map(([, items]) => items[0].id)).toEqual([
          'id0',
          'id200',
          'id400',
        ]);
      }
    );

    it('does not fire for a chunk that failed', async () => {
      gemini.respond.mockImplementation((req: SentRequest) => {
        const items = sentItems(req);
        return items.some((i) => i.id === 'id0') ? geminiStatus(400) : echo(req);
      });
      const onChunkTranslated = mock<ChunkCallback>(() => Promise.resolve());

      const { errors } = await translateBatch(manyItems(201), {
        apiKey: 'k',
        retryOptions: FAST_RETRY,
        rateLimitSleep: async () => {},
        onChunkTranslated,
      });

      expect(errors).toHaveLength(1);
      expect(onChunkTranslated).toHaveBeenCalledTimes(1);
      expect(onChunkTranslated.mock.calls[0][1].map((i) => i.id)).toEqual(['id200']);
    });

    it('swallows a throwing callback so no chunk result is lost or double-recorded', async () => {
      gemini.respond.mockImplementation(echo);
      const onChunkTranslated = mock(() => Promise.reject(new Error('cache write failed')));

      const { translated, errors } = await translateBatch(manyItems(201), {
        apiKey: 'k',
        rateLimitSleep: async () => {},
        onChunkTranslated,
      });

      expect(errors).toEqual([]);
      expect(translated.size).toBe(201);
      expect(onChunkTranslated).toHaveBeenCalledTimes(2);
    });
  });

  it('retries a retryable failure then succeeds', async () => {
    const rateLimitSleep = mock(() => Promise.resolve());
    gemini.respond
      .mockImplementationOnce(() => geminiStatus(503))
      .mockImplementationOnce(() => textResponse([{ id: 'a', text: 'ok' }]));

    const { translated, errors } = await translateBatch(
      [{ id: 'a', field: 'cancellation_reason', text: 'x' }],
      { apiKey: 'k', requestsPerMinute: 12, retryOptions: FAST_RETRY, rateLimitSleep }
    );

    expect(translated.get('a')).toBe('ok');
    expect(errors).toEqual([]);
    expect(gemini.sent).toHaveLength(2);
    expect(rateLimitSleep).toHaveBeenCalledWith(5_000);
  });

  it('retries a wrong-shaped response then accepts a valid response', async () => {
    gemini.respond
      .mockImplementationOnce(() => textResponse({ not: 'an array' }))
      .mockImplementationOnce(() => textResponse([{ id: 'a', text: 'ok' }]));

    const { translated, errors } = await translateBatch(
      [{ id: 'a', field: 'cancellation_reason', text: 'x' }],
      { apiKey: 'k', retryOptions: FAST_RETRY, rateLimitSleep: async () => {} }
    );

    expect(translated.get('a')).toBe('ok');
    expect(errors).toEqual([]);
    expect(gemini.sent).toHaveLength(2);
  });

  it('reports a terminal error as a chunk error without retrying', async () => {
    gemini.respond.mockImplementation(() => geminiStatus(401));

    const { translated, errors } = await translateBatch(
      [{ id: 'a', field: 'cancellation_reason', text: 'x' }],
      { apiKey: 'k', retryOptions: FAST_RETRY }
    );

    expect(translated.size).toBe(0);
    expect(errors).toHaveLength(1);
    expect(gemini.sent).toHaveLength(1);
  });

  it('reports a missing response text as a chunk error', async () => {
    gemini.respond.mockImplementation(() => geminiReply(undefined));

    const { translated, errors } = await translateBatch(
      [{ id: 'a', field: 'cancellation_reason', text: 'x' }],
      { apiKey: 'k', retryOptions: NO_RETRY }
    );

    expect(translated.size).toBe(0);
    expect(errors).toHaveLength(1);
  });

  it('reports a response that is not an array as a chunk error', async () => {
    gemini.respond.mockImplementation(() => textResponse({ not: 'an array' }));

    const { translated, errors } = await translateBatch(
      [{ id: 'a', field: 'cancellation_reason', text: 'x' }],
      { apiKey: 'k', retryOptions: NO_RETRY }
    );

    expect(translated.size).toBe(0);
    expect(errors).toHaveLength(1);
  });

  it('drops a blank translation without caching it or failing the chunk', async () => {
    gemini.respond.mockImplementation(() => textResponse([{ id: 'a', text: '  ' }]));

    const { translated, errors } = await translateBatch(
      [{ id: 'a', field: 'cancellation_reason', text: 'x' }],
      { apiKey: 'k', retryOptions: NO_RETRY }
    );

    expect(translated.size).toBe(0);
    expect(errors).toEqual([]);
  });

  it('keeps the first of a duplicated result ID rather than the model contradicting itself', async () => {
    gemini.respond.mockImplementation(() =>
      textResponse([
        { id: 'a', text: 'first' },
        { id: 'a', text: 'second' },
      ])
    );

    const { translated, errors } = await translateBatch(
      [{ id: 'a', field: 'cancellation_reason', text: 'x' }],
      { apiKey: 'k', retryOptions: NO_RETRY }
    );

    expect(translated.get('a')).toBe('first');
    expect(errors).toEqual([]);
  });

  // The reason per-item validation exists: an all-or-nothing parse discarded every good
  // translation in the chunk, which then got re-billed on the next run.
  it('keeps the good items when one item in the chunk is malformed', async () => {
    gemini.respond.mockImplementation(() =>
      textResponse([{ id: 'a', text: 'alpha' }, { id: 'b' }, { id: 'c', text: 'gamma' }])
    );

    const { translated, errors } = await translateBatch(
      ['a', 'b', 'c'].map((id) => ({ id, field: 'cancellation_reason' as const, text: id })),
      { apiKey: 'k', retryOptions: NO_RETRY }
    );

    expect(translated.get('a')).toBe('alpha');
    expect(translated.get('c')).toBe('gamma');
    expect(translated.has('b')).toBe(false);
    expect(errors).toEqual([]);
  });

  it('rejects an invalid RPM limit before sending a request', async () => {
    await expect(
      translateBatch([{ id: 'a', field: 'cancellation_reason', text: 'x' }], {
        apiKey: 'k',
        requestsPerMinute: 0,
      })
    ).rejects.toThrow('requestsPerMinute must be a positive integer');

    expect(gemini.sent).toEqual([]);
  });
});
