import { randomInt } from 'node:crypto';

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  isRetryable?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown) => void;
}

export const DEFAULT_ATTEMPTS = 4;
const DEFAULT_BASE_DELAY_MS = 500;

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Full jitter over [half, full] of the exponential delay. randomInt (CSPRNG) over Math.random:
// the value is timing-only, but a non-weak RNG keeps Sonar S2245 quiet without suppression.
const backoffMs = (base: number, attempt: number): number => {
  const full = base * 2 ** (attempt - 1);
  const half = Math.floor(full / 2);
  return half + (half > 0 ? randomInt(half + 1) : 0);
};

// Retries `fn` with exponential backoff + full jitter while `isRetryable` allows it
// (default: retry every error). Sequential by nature — each attempt depends on the prior one
// failing — so recursion, not a loop. Jitter spreads concurrent retries so a transient blip
// doesn't resync every caller into a thundering retry herd.
export const retry = async <T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
  attempt = 1
): Promise<T> => {
  const attempts = opts.attempts ?? DEFAULT_ATTEMPTS;
  try {
    return await fn();
  } catch (err) {
    const retryable = opts.isRetryable?.(err) ?? true;
    if (!retryable || attempt >= attempts) throw err;
    opts.onRetry?.(attempt, err);
    await (opts.sleep ?? defaultSleep)(
      backoffMs(opts.baseDelayMs ?? DEFAULT_BASE_DELAY_MS, attempt)
    );
    return retry(fn, opts, attempt + 1);
  }
};
