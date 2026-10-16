import { describe, expect, it } from 'bun:test';
import { RECENCY_DATE_FIELDS, latestKnownDate } from '../src/recency.js';
import type { Aircraft } from '../src/schema.js';

const record = (dates: Partial<Record<(typeof RECENCY_DATE_FIELDS)[number], string | null>>) =>
  ({
    certification_date: null,
    airworthiness_date: null,
    expiration_date: null,
    last_action_date: null,
    ...dates,
  }) as Aircraft;

describe('latestKnownDate', () => {
  it('returns null when the record carries no date', () => {
    expect(latestKnownDate(record({}))).toBeNull();
  });

  it('returns the only date a record carries', () => {
    expect(latestKnownDate(record({ expiration_date: '2030-01-01' }))).toBe('2030-01-01');
  });

  it.each([...RECENCY_DATE_FIELDS])('finds the newest date when it sits in %s', (field) => {
    const dates = Object.fromEntries(RECENCY_DATE_FIELDS.map((f) => [f, '2020-01-01']));
    expect(latestKnownDate(record({ ...dates, [field]: '2031-06-30' }))).toBe('2031-06-30');
  });

  it('returns the shared value when dates are equal', () => {
    expect(
      latestKnownDate(record({ certification_date: '2020-05-05', last_action_date: '2020-05-05' }))
    ).toBe('2020-05-05');
  });
});
