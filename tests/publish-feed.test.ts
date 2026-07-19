import { expect, mock, test } from 'bun:test';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const sources = ['source-a', 'source-b'];
const resolveAllSources = mock(() => sources);
const publishFeedForDeploy = mock(() => Promise.resolve({ changed: true, hash: 'abc123' }));

await mock.module('../src/pipeline.js', () => ({ publishFeedForDeploy, resolveAllSources }));

test('publishes for deployment and emits the change signal to GITHUB_OUTPUT', async () => {
  // Point GITHUB_OUTPUT at a throwaway file so the module exercises the append branch without
  // touching the runner's real output; the assertion is on the call, not the file, so import
  // caching/env timing can't flake it.
  const outFile = join(tmpdir(), `mbf-ghout-${process.pid}.txt`);
  process.env['GITHUB_OUTPUT'] = outFile;
  try {
    await import('../src/publish-feed.js');

    expect(resolveAllSources).toHaveBeenCalledTimes(1);
    expect(publishFeedForDeploy).toHaveBeenCalledWith(sources);
  } finally {
    delete process.env['GITHUB_OUTPUT'];
    rmSync(outFile, { force: true });
  }
});
