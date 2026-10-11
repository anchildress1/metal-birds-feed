import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadSourceConfig } from '../src/config/loader.js';
import { mapSnapshots } from '../src/engine.js';
import { replayHistory } from '../src/backfill.js';

// Ground truth: the committed lt-tka rows, two publications of the accumulating register.
describe('lt-tka history replay', () => {
  const replay = async () => {
    const config = loadSourceConfig(resolve('sources', 'lt-tka.yaml'));
    const register = readFileSync(resolve('fixtures', 'lt-tka', 'input', 'register.csv'));
    return replayHistory('lt-tka', await mapSnapshots(config, new Map([['register', register]])));
  };

  it('replays both publications without skipping either', async () => {
    const { skipped } = await replay();

    expect(skipped).toEqual([]);
  });

  it('dates rows to the publication they first appear in', async () => {
    const { rows } = await replay();

    expect(new Set(rows.map((r) => r['first_seen']))).toEqual(
      new Set(['2025-04-29', '2026-03-09'])
    );
  });

  // Only one publication has missed them so far, so they are still live: closing needs a second.
  it('keeps rows missing from the newest publication live, stamped with that publication', async () => {
    const { rows } = await replay();
    const missing = rows.filter((r) => r['missing_since'] !== null);

    expect(missing.length).toBeGreaterThan(0);
    expect(
      missing.every((r) => r['missing_since'] === '2026-03-09' && r['removed_on'] === null)
    ).toBe(true);
    expect(rows.some((r) => r['removed_on'] !== null)).toBe(false);
  });
});
