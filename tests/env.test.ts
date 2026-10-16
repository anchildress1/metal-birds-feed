import { afterEach, describe, expect, it } from 'bun:test';
import { readPositiveIntegerEnv, requireEnv } from '../src/env.js';

const ENV_NAME = 'MBF_TEST_POSITIVE_INTEGER';
const original = process.env[ENV_NAME];

afterEach(() => {
  if (original === undefined) {
    delete process.env[ENV_NAME];
  } else {
    process.env[ENV_NAME] = original;
  }
});

describe('readPositiveIntegerEnv', () => {
  it('returns the fallback when the variable is absent', () => {
    delete process.env[ENV_NAME];
    expect(readPositiveIntegerEnv(ENV_NAME, 10)).toBe(10);
  });

  it('treats an empty variable as absent', () => {
    process.env[ENV_NAME] = '';
    expect(readPositiveIntegerEnv(ENV_NAME, 10)).toBe(10);
  });

  it('reads a configured positive integer', () => {
    process.env[ENV_NAME] = '12';
    expect(readPositiveIntegerEnv(ENV_NAME, 10)).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope', '9007199254740992'])('rejects invalid value %s', (value) => {
    process.env[ENV_NAME] = value;
    expect(() => readPositiveIntegerEnv(ENV_NAME, 10)).toThrow(
      `${ENV_NAME} must be a positive integer`
    );
  });
});

describe('requireEnv', () => {
  it('returns the value when set', () => {
    process.env[ENV_NAME] = 'abc';
    expect(requireEnv(ENV_NAME)).toBe('abc');
  });

  it('throws naming the variable when it is missing', () => {
    delete process.env[ENV_NAME];
    expect(() => requireEnv(ENV_NAME)).toThrow(
      `Missing required environment variable: ${ENV_NAME}`
    );
  });

  it('throws when it is set but empty', () => {
    process.env[ENV_NAME] = '';
    expect(() => requireEnv(ENV_NAME)).toThrow(
      `Missing required environment variable: ${ENV_NAME}`
    );
  });
});
