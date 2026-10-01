import { afterEach, expect, mock, test } from 'bun:test';

const ingest = mock(() => Promise.resolve(1));

await mock.module('../src/manual-drop.js', () => ({ ingest }));

afterEach(() => {
  delete process.env['INGEST_SOURCE'];
  delete process.env['INGEST_FILE'];
  delete process.env['DRY_RUN'];
});

test('passes the make-supplied source, file, and dry-run flag through', async () => {
  process.env['INGEST_SOURCE'] = 'th-caat';
  process.env['INGEST_FILE'] = 'drops/r.pdf';
  process.env['DRY_RUN'] = 'true';

  await import('../src/ingest.js');

  expect(ingest).toHaveBeenCalledWith('th-caat', 'drops/r.pdf', true);
});
