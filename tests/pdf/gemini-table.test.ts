import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import { createHash } from 'node:crypto';
import type { RetryOptions } from '../../src/retry.js';

const FAST_RETRY: RetryOptions = { baseDelayMs: 0, sleep: async () => {} };
interface GenerateRequest {
  model: string;
  contents: { parts: unknown[] }[];
  config: {
    responseMimeType: string;
    thinkingConfig: unknown;
    responseSchema: unknown;
    systemInstruction: string;
  };
}
const generateContent = mock<(req: GenerateRequest) => Promise<unknown>>();
const constructed: unknown[] = [];

class MockApiError extends Error {
  constructor(readonly status: number) {
    super(`status ${status}`);
  }
}

void mock.module('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
    constructor(opts: unknown) {
      constructed.push(opts);
    }
  },
  Type: { ARRAY: 'ARRAY', OBJECT: 'OBJECT', STRING: 'STRING' },
  ThinkingLevel: { LOW: 'LOW' },
  FinishReason: { STOP: 'STOP', MAX_TOKENS: 'MAX_TOKENS' },
}));

const { requestTableRows, PDF_EXTRACT_MODEL, PDF_EXTRACT_FINGERPRINT } =
  await import('../../src/pdf/gemini-table.js');

const PDF = Buffer.from('%PDF-1.7 test');
const COLUMNS = ['mark', 'owner'];
// `null` stands for a candidate-less response; `undefined` would fall back to the STOP default.
const response = (
  text: string | undefined,
  finishReason: string | null = 'STOP',
  blockReason?: string
) => ({
  text,
  candidates: finishReason === null ? [] : [{ finishReason }],
  promptFeedback: blockReason === undefined ? undefined : { blockReason },
});

const savedKey = process.env.GEMINI_API_KEY;
beforeEach(() => {
  generateContent.mockReset();
  constructed.length = 0;
  process.env.GEMINI_API_KEY = 'test-key';
});
afterEach(() => {
  if (savedKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = savedKey;
});

describe('requestTableRows', () => {
  it('sends the PDF inline with a per-column nullable string schema and returns the parsed JSON', async () => {
    generateContent.mockResolvedValue(response('[{"mark":"VIO","owner":null}]'));
    await expect(requestTableRows(PDF, COLUMNS)).resolves.toEqual([{ mark: 'VIO', owner: null }]);

    expect(constructed).toEqual([{ apiKey: 'test-key' }]);
    const req = generateContent.mock.calls[0][0];
    expect(req.model).toBe(PDF_EXTRACT_MODEL);
    expect(req.contents[0]?.parts[0]).toEqual({
      inlineData: { mimeType: 'application/pdf', data: PDF.toString('base64') },
    });
    expect(req.config.responseMimeType).toBe('application/json');
    expect(req.config.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
    expect(req.config.responseSchema).toEqual({
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
    });
  });

  it('throws on a missing GEMINI_API_KEY before calling Gemini', async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(requestTableRows(PDF, COLUMNS)).rejects.toThrow(
      'Missing required environment variable: GEMINI_API_KEY'
    );
    expect(generateContent).not.toHaveBeenCalled();
  });

  it.each([
    ['MAX_TOKENS', 'Gemini PDF extraction ended with MAX_TOKENS, not STOP'],
    [null, 'ended with no finish reason (prompt blocked: unknown), not STOP'],
  ])('throws without retrying when the response finished with %p', async (finish, message) => {
    generateContent.mockResolvedValue(response('[{"mark":"VIO"', finish));
    await expect(requestTableRows(PDF, COLUMNS, FAST_RETRY)).rejects.toThrow(message);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('names the block reason of a blocked prompt', async () => {
    generateContent.mockResolvedValue(response(undefined, null, 'PROHIBITED_CONTENT'));
    await expect(requestTableRows(PDF, COLUMNS, FAST_RETRY)).rejects.toThrow(
      'prompt blocked: PROHIBITED_CONTENT'
    );
  });

  it('throws on a response with no text', async () => {
    generateContent.mockResolvedValue(response(undefined));
    await expect(requestTableRows(PDF, COLUMNS)).rejects.toThrow(
      'Gemini PDF extraction returned no text'
    );
  });

  it('throws on a response that is not JSON', async () => {
    generateContent.mockResolvedValue(response('not json'));
    await expect(requestTableRows(PDF, COLUMNS)).rejects.toThrow(
      'Gemini PDF extraction returned invalid JSON (8 chars)'
    );
  });

  it('retries a transient transport failure, logging each retry with its trace', async () => {
    generateContent
      .mockRejectedValueOnce(new MockApiError(503))
      .mockResolvedValueOnce(response('[]'));
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});
    try {
      await expect(
        requestTableRows(PDF, COLUMNS, FAST_RETRY, 0, { source: 'hr-ccaa', pages: '6-10' })
      ).resolves.toEqual([]);
      expect(generateContent).toHaveBeenCalledTimes(2);
      expect(logSpy.mock.calls.map((c) => String(c[0])).join('\n')).toContain(
        'level=warn event=pdf_extract_retry source=hr-ccaa pages=6-10 attempt=1'
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  it('keeps its own transport-only retry predicate over a caller-supplied one', async () => {
    generateContent.mockRejectedValue(new MockApiError(403));
    await expect(
      requestTableRows(PDF, COLUMNS, { ...FAST_RETRY, isRetryable: () => true })
    ).rejects.toThrow('status 403');
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('does not retry a rejected key', async () => {
    generateContent.mockRejectedValue(new MockApiError(403));
    await expect(requestTableRows(PDF, COLUMNS, FAST_RETRY)).rejects.toThrow('status 403');
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('waits delayMs through the injected sleep before the request', async () => {
    const order: string[] = [];
    const sleep = mock((ms: number) => {
      order.push(`sleep ${ms}`);
      return Promise.resolve();
    });
    generateContent.mockImplementation(() => {
      order.push('request');
      return Promise.resolve(response('[]'));
    });
    await requestTableRows(PDF, COLUMNS, { ...FAST_RETRY, sleep }, 2000);
    expect(order).toEqual(['sleep 2000', 'request']);
  });

  it('does not sleep for a zero delay', async () => {
    const sleep = mock(() => Promise.resolve());
    generateContent.mockResolvedValue(response('[]'));
    await requestTableRows(PDF, COLUMNS, { ...FAST_RETRY, sleep });
    expect(sleep).not.toHaveBeenCalled();
  });

  it('fingerprints exactly the model and system instruction it sends', async () => {
    generateContent.mockResolvedValue(response('[]'));
    await requestTableRows(PDF, COLUMNS);
    const req = generateContent.mock.calls[0][0];
    expect(PDF_EXTRACT_FINGERPRINT).toBe(
      createHash('sha256').update(`${req.model}\n${req.config.systemInstruction}`).digest('hex')
    );
  });
});
