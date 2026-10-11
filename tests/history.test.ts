import { describe, expect, it } from 'bun:test';
import { assertHistoryPreserved, mergeHistory, type ArtifactRow } from '../src/history.js';

const rec = (id: string, serial: string | null = null): ArtifactRow => ({
  source_id: id,
  serial_number: serial,
});
const incoming = (...rows: ArtifactRow[]): Map<string, ArtifactRow> =>
  new Map(rows.map((r) => [r['source_id'] as string, r]));
const stored = (id: string, firstSeen: string, extra: Partial<ArtifactRow> = {}): ArtifactRow => ({
  source_id: id,
  serial_number: null,
  first_seen: firstSeen,
  removed_on: null,
  missing_since: null,
  ...extra,
});
const find = (rows: ArtifactRow[], id: string, pred: (r: ArtifactRow) => boolean = () => true) =>
  rows.find((r) => r['source_id'] === id && pred(r));

describe('mergeHistory', () => {
  it('opens every record live on the first run', () => {
    const rows = mergeHistory(null, incoming(rec('A'), rec('B')), '2026-10-12');

    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r['first_seen']).toBe('2026-10-12');
      expect(r['removed_on']).toBeNull();
      expect(r['missing_since']).toBeNull();
    }
  });

  it('keeps first_seen for a row that is still present', () => {
    const rows = mergeHistory([stored('A', '2026-01-01')], incoming(rec('A')), '2026-10-12');

    expect(rows).toHaveLength(1);
    expect(rows[0]?.['first_seen']).toBe('2026-01-01');
  });

  it('stamps missing_since on the first miss and keeps the row live', () => {
    const rows = mergeHistory([stored('A', '2026-01-01')], incoming(), '2026-10-12');

    expect(rows).toEqual([stored('A', '2026-01-01', { missing_since: '2026-10-12' })]);
  });

  it('closes at the first miss date on the second consecutive miss', () => {
    const rows = mergeHistory(
      [stored('A', '2026-01-01', { missing_since: '2026-10-12' })],
      incoming(),
      '2026-10-19'
    );

    expect(rows).toEqual([
      stored('A', '2026-01-01', { removed_on: '2026-10-12', missing_since: null }),
    ]);
  });

  it('clears missing_since when the row comes back before the second miss', () => {
    const rows = mergeHistory(
      [stored('A', '2026-01-01', { missing_since: '2026-10-12' })],
      incoming(rec('A')),
      '2026-10-19'
    );

    expect(rows).toEqual([stored('A', '2026-01-01')]);
  });

  it('reopens a closed row with its original first_seen', () => {
    const rows = mergeHistory(
      [stored('A', '2026-01-01', { removed_on: '2026-05-01' })],
      incoming(rec('A')),
      '2026-10-19'
    );

    expect(rows).toEqual([stored('A', '2026-01-01')]);
  });

  it('reopens the most recently closed row when several are closed', () => {
    const older = stored('A', '2025-01-01', { removed_on: '2025-06-01' });
    const newer = stored('A', '2026-01-01', { removed_on: '2026-05-01' });

    const rows = mergeHistory([older, newer], incoming(rec('A')), '2026-10-19');

    expect(find(rows, 'A', (r) => r['removed_on'] === null)?.['first_seen']).toBe('2026-01-01');
    expect(rows).toContainEqual(older);
  });

  it('closes a live row and opens a new one when the serial changes', () => {
    const rows = mergeHistory(
      [stored('A', '2026-01-01', { serial_number: 'S1' })],
      incoming(rec('A', 'S2')),
      '2026-10-12'
    );

    expect(rows).toHaveLength(2);
    expect(find(rows, 'A', (r) => r['removed_on'] !== null)).toMatchObject({
      first_seen: '2026-01-01',
      removed_on: '2026-10-12',
      serial_number: 'S1',
    });
    expect(find(rows, 'A', (r) => r['removed_on'] === null)).toMatchObject({
      first_seen: '2026-10-12',
      serial_number: 'S2',
    });
  });

  it('opens a new row beside a closed one when the returning serial differs', () => {
    const rows = mergeHistory(
      [stored('A', '2026-01-01', { serial_number: 'S1', removed_on: '2026-05-01' })],
      incoming(rec('A', 'S2')),
      '2026-10-12'
    );

    expect(rows).toHaveLength(2);
    expect(find(rows, 'A', (r) => r['removed_on'] === null)?.['first_seen']).toBe('2026-10-12');
  });

  it.each([
    ['stored serial null', null, 'S2'],
    ['incoming serial null', 'S1', null],
    ['both null', null, null],
  ])('does not treat a null serial as reuse (%s)', (_label, before, after) => {
    const rows = mergeHistory(
      [stored('A', '2026-01-01', { serial_number: before })],
      incoming(rec('A', after)),
      '2026-10-12'
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.['first_seen']).toBe('2026-01-01');
  });

  it('carries every closed row forward untouched', () => {
    const old = stored('Z', '2025-01-01', { removed_on: '2025-06-01' });

    const rows = mergeHistory([old], incoming(rec('A')), '2026-10-12');

    expect(rows).toContainEqual(old);
  });

  it("replaces a present row's columns with the incoming record", () => {
    const rows = mergeHistory(
      [stored('A', '2026-01-01', { serial_number: null })],
      incoming({ source_id: 'A', serial_number: null, model: 'new' }),
      '2026-10-12'
    );

    expect(rows[0]?.['model']).toBe('new');
  });
});

describe('assertHistoryPreserved', () => {
  const closedRow = stored('A', '2026-01-01', { removed_on: '2026-05-01' });

  it('passes when closed rows are carried', () => {
    expect(() => assertHistoryPreserved('x', [closedRow], [closedRow])).not.toThrow();
  });

  it('passes when a closed row reopened with the same first_seen', () => {
    expect(() =>
      assertHistoryPreserved('x', [closedRow], [stored('A', '2026-01-01')])
    ).not.toThrow();
  });

  it('throws naming the first lost row', () => {
    expect(() => assertHistoryPreserved('x', [closedRow], [])).toThrow(
      /1 closed history row\(s\) would be dropped \(first: A \/ 2026-01-01\)/
    );
  });

  it('ignores live rows and an absent prior', () => {
    expect(() => assertHistoryPreserved('x', null, [])).not.toThrow();
    expect(() => assertHistoryPreserved('x', [stored('A', '2026-01-01')], [])).not.toThrow();
  });
});
