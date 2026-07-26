import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { RetryOptions } from '../../src/retry.js';
import type { TranslationItem } from '../../src/localize/gemini-client.js';

// No-op sleep keeps backoff out of the test clock, mirroring tests/downloader.test.ts's FAST_RETRY.
const FAST_RETRY: RetryOptions = { baseDelayMs: 0, sleep: async () => {} };
const NO_RETRY: RetryOptions = { attempts: 1 };

const generateContent = mock();

class MockApiError extends Error {
  constructor(readonly status: number) {
    super(`status ${status}`);
  }
}

void mock.module('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
  Type: { ARRAY: 'ARRAY', OBJECT: 'OBJECT', STRING: 'STRING' },
  ThinkingLevel: { MINIMAL: 'MINIMAL', LOW: 'LOW' },
}));

const { translateBatch, isRetryableGeminiError } =
  await import('../../src/localize/gemini-client.js');

const textResponse = (body: unknown) => ({ text: JSON.stringify(body) });

describe('isRetryableGeminiError', () => {
  it('treats 429/5xx as retryable', () => {
    for (const status of [429, 500, 502, 503, 504]) {
      expect(isRetryableGeminiError(new MockApiError(status))).toBe(true);
    }
  });

  it('treats 4xx auth/request errors as terminal', () => {
    for (const status of [400, 401, 403, 404]) {
      expect(isRetryableGeminiError(new MockApiError(status))).toBe(false);
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

describe('translateBatch', () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  it('returns empty results without calling the API for an empty batch', async () => {
    const result = await translateBatch([], { apiKey: 'k' });
    expect(result.translated.size).toBe(0);
    expect(result.errors).toEqual([]);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('translates a batch and maps id -> text', async () => {
    generateContent.mockResolvedValue(
      textResponse([
        { id: 'a', text: 'Aircraft exported' },
        { id: 'b', text: 'Lien released' },
      ])
    );

    const { translated, errors } = await translateBatch(
      [
        { id: 'a', field: 'cancellation_reason', text: 'AERONAVE EXPORTADA' },
        { id: 'b', field: 'lien_status', text: 'GRAVAME LIBERADO' },
      ],
      { apiKey: 'k' }
    );

    expect(translated.get('a')).toBe('Aircraft exported');
    expect(translated.get('b')).toBe('Lien released');
    expect(errors).toEqual([]);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('splits batches larger than the chunk cap into separate calls', async () => {
    const rateLimitSleep = mock(() => Promise.resolve());
    generateContent.mockImplementation((args: { contents: string }) => {
      const items = JSON.parse(args.contents) as { id: string; text: string }[];
      return Promise.resolve(textResponse(items.map((i) => ({ id: i.id, text: `EN:${i.text}` }))));
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

    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(translated.get('id0')).toBe('EN:text0');
    expect(translated.get('id200')).toBe('EN:text200');
    expect(errors).toEqual([]);
    expect(rateLimitSleep).toHaveBeenCalledWith(5_000);
  });

  it('keeps a failing chunk from discarding another chunk that succeeded', async () => {
    generateContent.mockImplementation((args: { contents: string }) => {
      const items = JSON.parse(args.contents) as { id: string; text: string }[];
      if (items.some((i) => i.id === 'fails')) return Promise.reject(new MockApiError(401));
      return Promise.resolve(textResponse(items.map((i) => ({ id: i.id, text: `EN:${i.text}` }))));
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

  it('retries a retryable failure then succeeds', async () => {
    const rateLimitSleep = mock(() => Promise.resolve());
    generateContent
      .mockImplementationOnce(() => Promise.reject(new MockApiError(503)))
      .mockImplementationOnce(() => Promise.resolve(textResponse([{ id: 'a', text: 'ok' }])));

    const { translated, errors } = await translateBatch(
      [{ id: 'a', field: 'cancellation_reason', text: 'x' }],
      { apiKey: 'k', requestsPerMinute: 12, retryOptions: FAST_RETRY, rateLimitSleep }
    );

    expect(translated.get('a')).toBe('ok');
    expect(errors).toEqual([]);
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(rateLimitSleep).toHaveBeenCalledWith(5_000);
  });

  it('retries a malformed response then accepts a valid response', async () => {
    generateContent
      .mockResolvedValueOnce(textResponse([{ id: 'a' }]))
      .mockResolvedValueOnce(textResponse([{ id: 'a', text: 'ok' }]));

    const { translated, errors } = await translateBatch(
      [{ id: 'a', field: 'cancellation_reason', text: 'x' }],
      { apiKey: 'k', retryOptions: FAST_RETRY, rateLimitSleep: async () => {} }
    );

    expect(translated.get('a')).toBe('ok');
    expect(errors).toEqual([]);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('reports a terminal error as a chunk error without retrying', async () => {
    generateContent.mockImplementation(() => Promise.reject(new MockApiError(401)));

    const { translated, errors } = await translateBatch(
      [{ id: 'a', field: 'cancellation_reason', text: 'x' }],
      { apiKey: 'k', retryOptions: FAST_RETRY }
    );

    expect(translated.size).toBe(0);
    expect(errors).toHaveLength(1);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('reports a missing response text as a chunk error', async () => {
    generateContent.mockResolvedValue({ text: undefined });

    const { translated, errors } = await translateBatch(
      [{ id: 'a', field: 'cancellation_reason', text: 'x' }],
      { apiKey: 'k', retryOptions: NO_RETRY }
    );

    expect(translated.size).toBe(0);
    expect(errors).toHaveLength(1);
  });

  it('reports a malformed translation array as a chunk error', async () => {
    generateContent.mockResolvedValue(textResponse([{ id: 'a' }]));

    const { translated, errors } = await translateBatch(
      [{ id: 'a', field: 'cancellation_reason', text: 'x' }],
      { apiKey: 'k', retryOptions: NO_RETRY }
    );

    expect(translated.size).toBe(0);
    expect(errors).toHaveLength(1);
  });

  it('rejects a blank translation instead of caching it', async () => {
    generateContent.mockResolvedValue(textResponse([{ id: 'a', text: '  ' }]));

    const { translated, errors } = await translateBatch(
      [{ id: 'a', field: 'cancellation_reason', text: 'x' }],
      { apiKey: 'k', retryOptions: NO_RETRY }
    );

    expect(translated.size).toBe(0);
    expect(errors).toHaveLength(1);
  });

  it('rejects duplicate result IDs instead of keeping the last translation', async () => {
    generateContent.mockResolvedValue(
      textResponse([
        { id: 'a', text: 'first' },
        { id: 'a', text: 'second' },
      ])
    );

    const { translated, errors } = await translateBatch(
      [{ id: 'a', field: 'cancellation_reason', text: 'x' }],
      { apiKey: 'k', retryOptions: NO_RETRY }
    );

    expect(translated.size).toBe(0);
    expect(errors).toHaveLength(1);
  });

  it('rejects an invalid RPM limit before sending a request', async () => {
    await expect(
      translateBatch([{ id: 'a', field: 'cancellation_reason', text: 'x' }], {
        apiKey: 'k',
        requestsPerMinute: 0,
      })
    ).rejects.toThrow('requestsPerMinute must be a positive integer');

    expect(generateContent).not.toHaveBeenCalled();
  });
});
