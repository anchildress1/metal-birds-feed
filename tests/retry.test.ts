import { describe, it, expect, mock } from 'bun:test';
import { retry, type RetryOptions } from '../src/retry.js';

// No-op sleep keeps backoff off the test clock; assertions cover attempt counts, not timing.
const FAST: RetryOptions = { baseDelayMs: 0, sleep: async () => {} };

describe('retry', () => {
  it('resolves on the first attempt without retrying', async () => {
    const fn = mock().mockResolvedValue('ok');

    await expect(retry(fn, FAST)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries a thrown error then resolves', async () => {
    const fn = mock().mockRejectedValueOnce(new Error('blip')).mockResolvedValueOnce('ok');

    await expect(retry(fn, FAST)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('stops immediately when isRetryable returns false', async () => {
    const fn = mock().mockRejectedValue(new Error('permanent'));

    await expect(retry(fn, { ...FAST, isRetryable: () => false })).rejects.toThrow(/permanent/);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('rethrows the last error after exhausting attempts', async () => {
    const fn = mock().mockRejectedValue(new Error('still down'));

    await expect(retry(fn, { ...FAST, attempts: 3 })).rejects.toThrow(/still down/);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('invokes onRetry once per retry with the attempt number and error', async () => {
    const onRetry = mock();
    const fn = mock().mockRejectedValue(new Error('boom'));

    await expect(retry(fn, { ...FAST, attempts: 3, onRetry })).rejects.toThrow();
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error));
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error));
  });

  it('retries every error by default when no isRetryable is given', async () => {
    const fn = mock()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockResolvedValueOnce('ok');

    await expect(retry(fn, FAST)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('sleeps a jittered backoff within [half, full] of the exponential delay', async () => {
    const delays: number[] = [];
    const sleep = (ms: number): Promise<void> => {
      delays.push(ms);
      return Promise.resolve();
    };
    const fn = mock().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce('ok');

    await retry(fn, { baseDelayMs: 100, attempts: 2, sleep });

    // attempt 1: full = 100, so jitter lands in [50, 100].
    expect(delays).toHaveLength(1);
    expect(delays[0]).toBeGreaterThanOrEqual(50);
    expect(delays[0]).toBeLessThanOrEqual(100);
  });
});
