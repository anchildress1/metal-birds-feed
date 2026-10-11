import { expect, mock, test } from 'bun:test';

const evaluatePausedStaleness = mock(() => Promise.resolve());

await mock.module('../src/pipeline.js', () => ({ evaluatePausedStaleness }));

test('evaluates paused-source staleness once', async () => {
  await import('../src/paused-staleness.js');

  expect(evaluatePausedStaleness).toHaveBeenCalledTimes(1);
});
