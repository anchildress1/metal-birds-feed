import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import { createHash } from 'node:crypto';
import { ApiError } from '@google/genai';
import type { RetryOptions } from '../../src/retry.js';
import {
  requestTableRows,
  PDF_EXTRACT_MODEL,
  PDF_EXTRACT_FINGERPRINT,
} from '../../src/pdf/gemini-table.js';
import { fakeGeminiHttp, geminiReply, geminiStatus } from '../gemini-http.js';

const FAST_RETRY: RetryOptions = { baseDelayMs: 0, sleep: async () => {} };
const PDF = Buffer.from('%PDF-1.7 test');
const COLUMNS = ['mark', 'owner'];

let gemini: ReturnType<typeof fakeGeminiHttp>;
const savedKey = process.env.GEMINI_API_KEY;
beforeEach(() => {
  gemini = fakeGeminiHttp();
  process.env.GEMINI_API_KEY = 'test-key';
});
afterEach(() => {
  gemini.restore();
  if (savedKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = savedKey;
});

describe('requestTableRows', () => {
  it('sends the PDF inline with a per-column nullable string schema and returns the parsed JSON', async () => {
    gemini.respond.mockImplementation(() => geminiReply('[{"mark":"VIO","owner":null}]'));
    await expect(requestTableRows(PDF, COLUMNS)).resolves.toEqual([{ mark: 'VIO', owner: null }]);

    const [req] = gemini.sent;
    expect(req.url).toEndWith(`/models/${PDF_EXTRACT_MODEL}:generateContent`);
    expect(req.headers['x-goog-api-key']).toBe('test-key');
    expect(req.body.contents[0].parts[0]).toEqual({
      inlineData: { mimeType: 'application/pdf', data: PDF.toString('base64') },
    });
    expect(req.body.generationConfig).toEqual({
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingLevel: 'LOW' },
      responseSchema: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            mark: { type: 'STRING', nullable: true },
            owner: { type: 'STRING', nullable: true },
          },
          required: COLUMNS,
          propertyOrdering: COLUMNS,
        },
      },
    });
  });

  it('bounds each attempt with a request timeout, so a hung call settles and retries', async () => {
    gemini.respond
      .mockImplementationOnce(() => {
        throw new DOMException('The operation was aborted.', 'AbortError');
      })
      .mockImplementationOnce(() => geminiReply('[]'));
    await expect(requestTableRows(PDF, COLUMNS, { retryOptions: FAST_RETRY })).resolves.toEqual([]);
    expect(gemini.sent.map((r) => r.headers['x-server-timeout'])).toEqual(['600', '600']);
  });

  it('throws on a missing GEMINI_API_KEY before calling Gemini', async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(requestTableRows(PDF, COLUMNS)).rejects.toThrow(
      'Missing required environment variable: GEMINI_API_KEY'
    );
    expect(gemini.sent).toEqual([]);
  });

  it.each([
    ['MAX_TOKENS', 'Gemini PDF extraction ended with MAX_TOKENS, not STOP'],
    [null, 'ended with no finish reason (0 candidates), not STOP'],
  ])('throws without retrying when the response finished with %p', async (finish, message) => {
    gemini.respond.mockImplementation(() => geminiReply('[{"mark":"VIO"', finish));
    await expect(requestTableRows(PDF, COLUMNS, { retryOptions: FAST_RETRY })).rejects.toThrow(
      message
    );
    expect(gemini.sent).toHaveLength(1);
  });

  it('names the block reason of a blocked prompt', async () => {
    gemini.respond.mockImplementation(() => geminiReply(undefined, null, 'PROHIBITED_CONTENT'));
    await expect(requestTableRows(PDF, COLUMNS, { retryOptions: FAST_RETRY })).rejects.toThrow(
      'ended with a blocked prompt (PROHIBITED_CONTENT), not STOP'
    );
  });

  it('throws on a response with no text', async () => {
    gemini.respond.mockImplementation(() => geminiReply(undefined));
    await expect(requestTableRows(PDF, COLUMNS)).rejects.toThrow(
      'Gemini PDF extraction returned no text'
    );
  });

  it('throws on a response that is not JSON', async () => {
    gemini.respond.mockImplementation(() => geminiReply('not json'));
    await expect(requestTableRows(PDF, COLUMNS)).rejects.toThrow(
      'Gemini PDF extraction returned invalid JSON (8 chars)'
    );
  });

  it('retries a transient transport failure, logging each retry with its trace', async () => {
    gemini.respond
      .mockImplementationOnce(() => geminiStatus(503))
      .mockImplementationOnce(() => geminiReply('[]'));
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});
    try {
      await expect(
        requestTableRows(PDF, COLUMNS, {
          retryOptions: FAST_RETRY,
          trace: { source: 'hr-ccaa', pages: '6-10' },
        })
      ).resolves.toEqual([]);
      expect(gemini.sent).toHaveLength(2);
      expect(logSpy.mock.calls.map((c) => String(c[0])).join('\n')).toContain(
        'level=warn event=pdf_extract_retry source=hr-ccaa pages=6-10 attempt=1'
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  it('keeps its own transport-only retry predicate over a caller-supplied one', async () => {
    gemini.respond.mockImplementation(() => geminiStatus(403));
    const run = requestTableRows(PDF, COLUMNS, {
      retryOptions: { ...FAST_RETRY, isRetryable: () => true },
    });
    await expect(run).rejects.toBeInstanceOf(ApiError);
    await expect(run).rejects.toMatchObject({ status: 403 });
    expect(gemini.sent).toHaveLength(1);
  });

  it('does not retry a rejected key', async () => {
    gemini.respond.mockImplementation(() => geminiStatus(403));
    await expect(
      requestTableRows(PDF, COLUMNS, { retryOptions: FAST_RETRY })
    ).rejects.toMatchObject({ status: 403 });
    expect(gemini.sent).toHaveLength(1);
  });

  it('awaits pace before every attempt, a retry included', async () => {
    const order: string[] = [];
    const pace = mock(() => {
      order.push('pace');
      return Promise.resolve();
    });
    gemini.respond
      .mockImplementationOnce(() => {
        order.push('request');
        return geminiStatus(503);
      })
      .mockImplementationOnce(() => {
        order.push('request');
        return geminiReply('[]');
      });
    await requestTableRows(PDF, COLUMNS, { retryOptions: FAST_RETRY, pace });
    expect(order).toEqual(['pace', 'request', 'pace', 'request']);
  });

  it('fingerprints the model and the system instruction', async () => {
    await requestTableRows(PDF, COLUMNS);
    const [req] = gemini.sent;
    const model = /\/models\/([^:]+):generateContent$/.exec(req.url)?.[1];
    expect(PDF_EXTRACT_FINGERPRINT).toBe(
      createHash('sha256')
        .update(`${model}\n${req.body.systemInstruction.parts[0].text}`)
        .digest('hex')
    );
  });
});
