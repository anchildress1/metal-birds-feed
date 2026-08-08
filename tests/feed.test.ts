import { describe, it, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import type { Aircraft } from '../src/schema.js';
import {
  toFeedRows,
  mergeFeedRows,
  buildFeedDb,
  hashFeedRows,
  FeedRowsSchema,
  FeedSliceSchema,
  FEED_SLICE_VERSION,
  type FeedRow,
} from '../src/feed.js';

const make = (id: string, hex: string | null, overrides: Partial<Aircraft> = {}): Aircraft => ({
  source: 'faa',
  source_id: id,
  registration: `N${id}`,
  icao_hex: hex,
  icao_type_code: null,
  status: 'valid',
  country: 'US',
  manufacturer: 'CESSNA',
  model: '172',
  serial_number: null,
  year_manufactured: null,
  airframe_type: null,
  category: null,
  build_certification: null,
  airworthiness_class: null,
  airworthiness_class_source_text: null,
  operating_environment: null,
  operational_classes: [],
  operational_classes_source_text: [],
  engine: {
    manufacturer: null,
    model: null,
    type: null,
    count: null,
    horsepower: null,
    thrust_lbs: null,
  },
  owner: { name: null, kind: null, state: null, country: null },
  operator: { name: null, kind: null, state: null, country: null },
  legal_owner: { name: null, kind: null, state: null, country: null },
  idera_authorised_party: null,
  certification_date: null,
  airworthiness_date: null,
  expiration_date: null,
  last_action_date: null,
  cruise_speed_ktas: null,
  max_takeoff_weight_kg: null,
  seats: null,
  max_passengers: null,
  min_crew: null,
  airworthiness_review_date: null,
  cancellation_reason: null,
  cancellation_reason_source_text: null,
  lien_status: null,
  lien_status_source_text: null,
  interdiction_code: null,
  ...overrides,
});

describe('toFeedRows', () => {
  it('drops records without an icao_hex', () => {
    const rows = toFeedRows([make('1', 'a1b2c3'), make('2', null)]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.icao_hex).toBe('a1b2c3');
  });

  it('maps nested owner/operator/engine and descriptive fields into flat columns', () => {
    const [row] = toFeedRows([
      make('1', 'a1b2c3', {
        icao_type_code: 'C172',
        year_manufactured: 1998,
        seats: 4,
        category: 'standard',
        engine: {
          manufacturer: 'LYCOMING',
          model: 'O-320',
          type: 'reciprocating',
          count: 1,
          horsepower: 160,
          thrust_lbs: null,
        },
        owner: { name: 'Jane Doe', kind: 'individual', state: 'TX', country: 'US' },
        operator: { name: 'Acme Air', kind: 'corporation', state: null, country: 'US' },
        airframe_type: 'fixed-wing-single-engine',
      }),
    ]);
    expect(row).toMatchObject({
      icao_hex: 'a1b2c3',
      registration: 'N1',
      icao_type_code: 'C172',
      year_manufactured: 1998,
      seats: 4,
      category: 'standard',
      airframe_type: 'fixed-wing-single-engine',
      engine_manufacturer: 'LYCOMING',
      engine_type: 'reciprocating',
      engine_count: 1,
      engine_horsepower: 160,
      owner_name: 'Jane Doe',
      owner_kind: 'individual',
      owner_state: 'TX',
      operator_name: 'Acme Air',
      source: 'faa',
    });
  });

  it('collapses a shared hex within a source, dropping a cancelled shadow of a live one', () => {
    const rows = toFeedRows([
      make('1', 'a1b2c3', { status: 'cancelled', registration: 'OLD' }),
      make('2', 'a1b2c3', { status: 'valid', registration: 'NEW' }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ registration: 'NEW', status: 'valid' });
  });

  it('is import-order-independent on a hex collision', () => {
    const a = make('1', 'a1b2c3', { status: 'cancelled', registration: 'OLD' });
    const b = make('2', 'a1b2c3', { status: 'valid', registration: 'NEW' });
    expect(toFeedRows([a, b])).toEqual(toFeedRows([b, a]));
  });

  it('returns an empty array for no records', () => {
    expect(toFeedRows([])).toEqual([]);
  });
});

describe('mergeFeedRows', () => {
  const rowFor = (hex: string, source: string, status: Aircraft['status'], reg: string): FeedRow =>
    toFeedRows([make('1', hex, { source, status, registration: reg })])[0];

  it('unions per-source slices into one row per hex', () => {
    const merged = mergeFeedRows([
      [rowFor('a1b2c3', 'faa', 'valid', 'N1')],
      [rowFor('4d5e6f', 'ca', 'valid', 'C-2')],
    ]);
    expect(merged).toHaveLength(2);
  });

  it('never lets a cancelled row replace a live one across sources', () => {
    const live = [rowFor('a1b2c3', 'faa', 'valid', 'LIVE')];
    const dead = [rowFor('a1b2c3', 'ca', 'cancelled', 'DEAD')];
    expect(mergeFeedRows([live, dead])[0]?.registration).toBe('LIVE');
    expect(mergeFeedRows([dead, live])[0]?.registration).toBe('LIVE');
  });
});

describe('buildFeedDb', () => {
  it('builds one queryable feed table keyed by icao_hex', () => {
    const rows = toFeedRows([
      make('1', 'a1b2c3', { year_manufactured: 1998, seats: 4, cruise_speed_ktas: 122 }),
      make('2', '4d5e6f', { registration: 'N2', country: 'US' }),
    ]);
    const db = Database.deserialize(buildFeedDb(rows));
    try {
      const hit = db.query('SELECT * FROM feed WHERE icao_hex = ?').get('a1b2c3') as Record<
        string,
        unknown
      >;
      expect(hit).toMatchObject({ registration: 'N1', year_manufactured: 1998, seats: 4 });
      expect(db.query('SELECT count(*) AS n FROM feed').get()).toEqual({ n: 2 });
    } finally {
      db.close();
    }
  });

  it('serves an IN-list point lookup across countries in a single table', () => {
    const rows = mergeFeedRows([
      toFeedRows([make('1', 'a1b2c3', { country: 'US' })]),
      toFeedRows([make('2', '4d5e6f', { country: 'CA', registration: 'C-2' })]),
    ]);
    const db = Database.deserialize(buildFeedDb(rows));
    try {
      const found = db
        .query('SELECT icao_hex FROM feed WHERE icao_hex IN (?, ?)')
        .all('a1b2c3', '4d5e6f');
      expect(found).toHaveLength(2);
    } finally {
      db.close();
    }
  });

  it('builds an empty table from no rows', () => {
    const db = Database.deserialize(buildFeedDb([]));
    try {
      expect(db.query('SELECT count(*) AS n FROM feed').get()).toEqual({ n: 0 });
    } finally {
      db.close();
    }
  });
});

describe('hashFeedRows', () => {
  const rows = (): FeedRow[] => [
    ...toFeedRows([make('1', 'a1b2c3')]),
    ...toFeedRows([make('2', '4d5e6f', { registration: 'N2' })]),
  ];

  it('is stable for the same content', () => {
    expect(hashFeedRows(rows())).toBe(hashFeedRows(rows()));
  });

  it('is independent of row order', () => {
    const [a, b] = rows();
    expect(hashFeedRows([a, b])).toBe(hashFeedRows([b, a]));
  });

  it('changes when any row content changes', () => {
    const [a, b] = rows();
    const mutated: FeedRow = { ...b, registration: 'N999' };
    expect(hashFeedRows([a, mutated])).not.toBe(hashFeedRows([a, b]));
  });

  it('returns a stable digest for no rows', () => {
    expect(hashFeedRows([])).toBe(hashFeedRows([]));
  });
});

describe('FeedRowsSchema', () => {
  const valid = (): FeedRow[] => toFeedRows([make('1', 'a1b2c3')]);

  it('accepts a well-formed FeedRow[] and an empty array', () => {
    expect(FeedRowsSchema.safeParse(valid()).success).toBe(true);
    expect(FeedRowsSchema.safeParse([]).success).toBe(true);
  });

  it('rejects a bare object, scalar rows, and a non-array', () => {
    expect(FeedRowsSchema.safeParse({}).success).toBe(false);
    expect(FeedRowsSchema.safeParse([1, 2, 3]).success).toBe(false);
    expect(FeedRowsSchema.safeParse('nope').success).toBe(false);
  });

  it('rejects a row missing a NOT NULL column', () => {
    expect(FeedRowsSchema.safeParse([{ icao_hex: 'a1b2c3' }]).success).toBe(false);
  });

  it('rejects a row whose numeric column carries a string', () => {
    const [row] = valid();
    expect(FeedRowsSchema.safeParse([{ ...row, year_manufactured: '1979' }]).success).toBe(false);
  });
});

describe('FeedSliceSchema', () => {
  const currentRows = (): FeedRow[] =>
    toFeedRows([
      make('1', 'a1b2c3', {
        cancellation_reason: 'Aircraft exported',
        airworthiness_class: 'Standard',
      }),
    ]);
  const legacyRows = () =>
    currentRows().map((row) =>
      Object.fromEntries(
        Object.entries(row).filter(
          ([key]) => key !== 'cancellation_reason' && key !== 'airworthiness_class'
        )
      )
    );
  const migratedLegacyRows = (): FeedRow[] =>
    currentRows().map((row) => ({
      ...row,
      cancellation_reason: null,
      airworthiness_class: null,
    }));

  it('accepts the strict current envelope without requesting migration', () => {
    expect(FeedSliceSchema.parse({ version: FEED_SLICE_VERSION, rows: currentRows() })).toEqual({
      rows: currentRows(),
      needsMigration: false,
    });
  });

  it('migrates an unversioned current array without losing translated fields', () => {
    expect(FeedSliceSchema.parse(currentRows())).toEqual({
      rows: currentRows(),
      needsMigration: true,
    });
  });

  it('migrates an exact legacy array by adding only the new nullable fields', () => {
    expect(FeedSliceSchema.parse(legacyRows())).toEqual({
      rows: migratedLegacyRows(),
      needsMigration: true,
    });
  });

  it('rejects unknown versions and malformed legacy rows', () => {
    const [legacy] = legacyRows();
    const missingRequired = Object.fromEntries(
      Object.entries(legacy).filter(([key]) => key !== 'registration')
    );

    expect(FeedSliceSchema.safeParse({ version: 999, rows: currentRows() }).success).toBe(false);
    expect(FeedSliceSchema.safeParse([missingRequired]).success).toBe(false);
    expect(FeedSliceSchema.safeParse([{ ...legacy, unexpected: 'drift' }]).success).toBe(false);
  });
});
