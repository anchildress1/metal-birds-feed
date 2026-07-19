import { expect, mock, test } from 'bun:test';

const sources = ['source-a', 'source-b'];
const resolveAllSources = mock(() => sources);
const publishFeed = mock(() => Promise.resolve());

await mock.module('../src/pipeline.js', () => ({ publishFeed, resolveAllSources }));

test('publishes every configured source for deployment', async () => {
  await import('../src/publish-feed.js');

  expect(resolveAllSources).toHaveBeenCalledTimes(1);
  expect(publishFeed).toHaveBeenCalledWith(sources, false);
});
