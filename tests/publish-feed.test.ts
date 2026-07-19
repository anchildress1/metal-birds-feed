import { expect, mock, test } from 'bun:test';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const sources = ['source-a', 'source-b'];
const resolveAllSources = mock(() => sources);
const publishFeedForDeploy = mock(() => Promise.resolve({ changed: true, hash: 'abc123' }));

await mock.module('../src/pipeline.js', () => ({ publishFeedForDeploy, resolveAllSources }));

test('publishes for deployment and writes the change signal to GITHUB_OUTPUT', async () => {
  const outFile = join(tmpdir(), `mbf-ghout-${process.pid}.txt`);
  rmSync(outFile, { force: true });
  process.env['GITHUB_OUTPUT'] = outFile;
  try {
    await import('../src/publish-feed.js');

    expect(resolveAllSources).toHaveBeenCalledTimes(1);
    expect(publishFeedForDeploy).toHaveBeenCalledWith(sources);
    const written = readFileSync(outFile, 'utf8');
    expect(written).toContain('changed=true');
    expect(written).toContain('hash=abc123');
  } finally {
    delete process.env['GITHUB_OUTPUT'];
    rmSync(outFile, { force: true });
  }
});
