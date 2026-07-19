import { describe, expect, it } from 'bun:test';
import { resolve } from 'node:path';
import { loadServiceConfig } from '../../src/service/config.js';

const TOKEN = '00000000-0000-4000-8000-000000000001';

describe('loadServiceConfig', () => {
  it('loads secure defaults with a valid UUID token', () => {
    expect(loadServiceConfig({ FEED_TOKEN: TOKEN })).toEqual({
      dbPath: resolve('feed.sqlite'),
      port: 8080,
      token: TOKEN,
      rateLimit: 120,
      rateWindowMs: 60_000,
    });
  });

  it('loads explicit database, port, and limiter settings', () => {
    expect(
      loadServiceConfig(
        {
          FEED_TOKEN: `  ${TOKEN.toUpperCase()}  `,
          MBF_FEED_DB_PATH: '/app/current.sqlite',
          PORT: '65535',
          FEED_RATE_LIMIT: '1',
          FEED_RATE_WINDOW_MS: '1',
        },
        '/app'
      )
    ).toEqual({
      dbPath: '/app/current.sqlite',
      port: 65_535,
      token: TOKEN.toUpperCase(),
      rateLimit: 1,
      rateWindowMs: 1,
    });
  });

  it('defaults a whitespace-only database path', () => {
    expect(loadServiceConfig({ FEED_TOKEN: TOKEN, MBF_FEED_DB_PATH: '   ' }).dbPath).toBe(
      resolve('feed.sqlite')
    );
  });

  it('resolves a relative database path within the service root', () => {
    expect(
      loadServiceConfig({ FEED_TOKEN: TOKEN, MBF_FEED_DB_PATH: 'data/feed.sqlite' }, '/app').dbPath
    ).toBe('/app/data/feed.sqlite');
  });

  it.each(['../feed.sqlite', 'data/../feed.sqlite', 'data..sqlite'])(
    'rejects database path traversal %s',
    (value) => {
      expect(() =>
        loadServiceConfig({ FEED_TOKEN: TOKEN, MBF_FEED_DB_PATH: value }, '/app')
      ).toThrow('MBF_FEED_DB_PATH must not contain ..');
    }
  );

  it.each(['/tmp/feed.sqlite', '/app'])('rejects database path escape %s', (value) => {
    expect(() => loadServiceConfig({ FEED_TOKEN: TOKEN, MBF_FEED_DB_PATH: value }, '/app')).toThrow(
      'MBF_FEED_DB_PATH must stay within the service root'
    );
  });

  it.each([
    { label: 'missing', token: undefined },
    { label: 'empty', token: '' },
    { label: 'non-UUID', token: 'secret' },
    { label: 'nil UUID', token: '00000000-0000-0000-0000-000000000000' },
    { label: 'invalid variant', token: '00000000-0000-4000-7000-000000000001' },
  ])('rejects a $label token', ({ token }) => {
    expect(() => loadServiceConfig({ FEED_TOKEN: token })).toThrow('FEED_TOKEN must be a UUID');
  });

  it.each(['0', '-1', '1.5', 'Infinity', 'NaN', 'nope', '', '9007199254740992'])(
    'rejects invalid rate limit %s',
    (value) => {
      expect(() => loadServiceConfig({ FEED_TOKEN: TOKEN, FEED_RATE_LIMIT: value })).toThrow(
        'FEED_RATE_LIMIT must be a positive integer'
      );
    }
  );

  it.each(['0', '-1', '1.5', 'Infinity', 'NaN', 'nope', '', '9007199254740992'])(
    'rejects invalid rate window %s',
    (value) => {
      expect(() => loadServiceConfig({ FEED_TOKEN: TOKEN, FEED_RATE_WINDOW_MS: value })).toThrow(
        'FEED_RATE_WINDOW_MS must be a positive integer'
      );
    }
  );

  it.each([
    { value: '0', message: 'PORT must be a positive integer' },
    { value: '-1', message: 'PORT must be a positive integer' },
    { value: '1.5', message: 'PORT must be a positive integer' },
    { value: '65536', message: 'PORT must be between 1 and 65535' },
    { value: 'nope', message: 'PORT must be a positive integer' },
  ])('rejects invalid port $value', ({ value, message }) => {
    expect(() => loadServiceConfig({ FEED_TOKEN: TOKEN, PORT: value })).toThrow(message);
  });
});
