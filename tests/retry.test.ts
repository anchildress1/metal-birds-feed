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
    const sleep = mock(() => Promise.resolve());
    const onRetry = mock();

    await expect(
      retry(fn, { baseDelayMs: 100, sleep, onRetry, isRetryable: () => false })
    ).rejects.toThrow(/permanent/);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('hands the thrown error to isRetryable', async () => {
    const boom = new Error('seen');
    const isRetryable = mock(() => false);

    await expect(retry(() => Promise.reject(boom), { ...FAST, isRetryable })).rejects.toBe(boom);
    expect(isRetryable).toHaveBeenCalledWith(boom);
  });

  it('rethrows the last error after exhausting attempts', async () => {
    const fn = mock().mockRejectedValue(new Error('still down'));

    await expect(retry(fn, { ...FAST, attempts: 3 })).rejects.toThrow(/still down/);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('invokes onRetry once per retry with the attempt number and error', async () => {
    const onRetry = mock();
    const boom = new Error('boom');
    const fn = mock().mockRejectedValue(boom);

    await expect(retry(fn, { ...FAST, attempts: 3, onRetry })).rejects.toBe(boom);
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, boom);
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, boom);
  });

  it('retries every error by default when no isRetryable is given', async () => {
    const fn = mock()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockResolvedValueOnce('ok');

    await expect(retry(fn, FAST)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  describe('backoff', () => {
    const recordDelays = (): { delays: number[]; sleep: (ms: number) => Promise<void> } => {
      const delays: number[] = [];
      return {
        delays,
        sleep: (ms) => {
          delays.push(ms);
          return Promise.resolve();
        },
      };
    };

    it('doubles the delay range each attempt, jittered within [half, full]', async () => {
      const { delays, sleep } = recordDelays();
      const fn = mock().mockRejectedValue(new Error('x'));

      await expect(retry(fn, { baseDelayMs: 100, attempts: 4, sleep })).rejects.toThrow();

      expect(delays).toHaveLength(3);
      expect(delays[0]).toBeGreaterThanOrEqual(50);
      expect(delays[0]).toBeLessThanOrEqual(100);
      expect(delays[1]).toBeGreaterThanOrEqual(100);
      expect(delays[1]).toBeLessThanOrEqual(200);
      expect(delays[2]).toBeGreaterThanOrEqual(200);
      expect(delays[2]).toBeLessThanOrEqual(400);
    });

    it('does not sleep after the final failed attempt', async () => {
      const { delays, sleep } = recordDelays();
      const fn = mock().mockRejectedValue(new Error('x'));

      await expect(retry(fn, { baseDelayMs: 100, attempts: 2, sleep })).rejects.toThrow();

      expect(delays).toHaveLength(1);
    });

    it('sleeps exactly zero for a zero base delay', async () => {
      const { delays, sleep } = recordDelays();
      const fn = mock().mockRejectedValue(new Error('x'));

      await expect(retry(fn, { baseDelayMs: 0, attempts: 3, sleep })).rejects.toThrow();

      expect(delays).toEqual([0, 0]);
    });
  });
});
