import type { Aircraft } from './schema.js';

// Type-only import above means this module has no runtime dependencies, so importing it from both
// engine.ts and feed.ts stays safe under mock.module (a partial engine mock can't erase it).
export const RECENCY_DATE_FIELDS = [
  'certification_date',
  'airworthiness_date',
  'expiration_date',
  'last_action_date',
] as const;

// Most recent of a record's known dates, or null when it carries none. Drives recency tie-breaks
// wherever two records for the same airframe must be ranked.
export const latestKnownDate = (record: Aircraft): string | null =>
  RECENCY_DATE_FIELDS.map((f) => record[f])
    .filter((d): d is string => d !== null)
    .sort((a, b) => a.localeCompare(b))
    .at(-1) ?? null;
