import { expect, mock, test } from 'bun:test';

const markFeedDeployed = mock(() => Promise.resolve());

await mock.module('../src/pipeline.js', () => ({ markFeedDeployed }));

test('records the deployed hash passed on argv', async () => {
  const hash = 'deadbeef'.repeat(8);
  process.argv[2] = hash;

  await import('../src/mark-deployed.js');

  expect(markFeedDeployed).toHaveBeenCalledWith(hash);
});
