import { describe, it, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import type { Aircraft } from '../src/schema.js';
import {
  toFeedRows,
  mergeFeedRows,
  registrationKey,
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
  // Nine of fifteen registers publish no Mode S address. Dropping them here is what made
  // /feed/registration unable to reach ~60k of 418k records — the endpoint's whole purpose.
  it('keeps a record without an icao_hex, reachable by its mark', () => {
    const rows = toFeedRows([make('1', 'a1b2c3'), make('2', null)]);
    expect(rows).toHaveLength(2);
    const hexless = rows.find((r) => r.icao_hex === null);
    expect(hexless?.registration_key).toBe('N2');
  });

  it('collapses two hex-less records sharing a mark to one row', () => {
    const rows = toFeedRows([
      make('1', null, { registration: 'PH-ABC', last_action_date: '2020-01-01' }),
      make('2', null, { registration: 'ph abc', last_action_date: '2024-01-01' }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.registration_key).toBe('PHABC');
    // preferWinner: the more recent record wins, exactly as it does on the hex path.
    expect(rows[0]?.registration).toBe('ph abc');
  });

  // Within one register a mark identifies one aircraft, so these are the same airframe seen twice.
  // Emitting both would manufacture an ambiguity and cost the mark its lookup key.
  it('lets a hex-bearing record supersede a hex-less one with the same mark', () => {
    const rows = toFeedRows([
      make('1', 'a1b2c3', { registration: 'PH-ABC' }),
      make('2', null, { registration: 'PH-ABC' }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.icao_hex).toBe('a1b2c3');
    expect(rows[0]?.registration_key).toBe('PHABC');
  });

  it('drops a hex-less record whose mark normalizes to nothing', () => {
    const rows = toFeedRows([make('1', null, { registration: '- -' })]);
    expect(rows).toEqual([]);
  });

  it('still excludes cancelled hex-less records', () => {
    const rows = toFeedRows([make('1', null, { status: 'cancelled' })]);
    expect(rows).toEqual([]);
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
  const rowFor = (
    hex: string | null,
    source: string,
    status: Aircraft['status'],
    reg: string
  ): FeedRow => toFeedRows([make('1', hex, { source, status, registration: reg })])[0];

  it('unions per-source slices into one row per hex', () => {
    const merged = mergeFeedRows([
      [rowFor('a1b2c3', 'faa', 'valid', 'N1')],
      [rowFor('4d5e6f', 'ca', 'valid', 'C-2')],
    ]);
    expect(merged).toHaveLength(2);
  });

  it('keeps the first slice to claim a hex, since no slice carries a cancelled row', () => {
    const faa = [rowFor('a1b2c3', 'faa', 'valid', 'N1')];
    const ca = [rowFor('a1b2c3', 'ca', 'valid', 'C-2')];
    expect(mergeFeedRows([faa, ca])[0]?.registration).toBe('N1');
  });

  it('carries hex-less rows from every slice into the merged feed', () => {
    const nl = [rowFor(null, 'nl-ilt', 'valid', 'PH-ABC')];
    const faa = [rowFor('a1b2c3', 'faa', 'valid', 'N1')];
    const merged = mergeFeedRows([faa, nl]);
    expect(merged).toHaveLength(2);
    expect(merged.find((r) => r.registration_key === 'PHABC')?.icao_hex).toBeNull();
  });

  // Two registers can issue marks that normalize alike. They are different aircraft, so neither can
  // own the key — answering with either would be wrong, and a miss is the honest result.
  it('clears a mark claimed by two different aircraft, keeping both reachable by hex', () => {
    const a = [rowFor('a1b2c3', 'cl-dgac', 'valid', 'CC-ABC')];
    const b = [rowFor('4d5e6f', 'tc-ca', 'valid', 'C-CABC')];
    const merged = mergeFeedRows([a, b]);
    expect(merged).toHaveLength(2);
    expect(merged.every((r) => r.registration_key === null)).toBe(true);
    expect(merged.map((r) => r.icao_hex).sort()).toEqual(['4d5e6f', 'a1b2c3']);
  });

  // Canada does this to itself: the 3-character mark ABC renders CF-ABC and the 4-character mark
  // FABC renders C-FABC, and both normalize to CFABC.
  it('clears a mark two rows of one register normalize onto', () => {
    const merged = mergeFeedRows([
      [rowFor('a1b2c3', 'tc-ca', 'valid', 'CF-ABC'), rowFor('4d5e6f', 'tc-ca', 'valid', 'C-FABC')],
    ]);
    expect(merged.every((r) => r.registration_key === null)).toBe(true);
  });

  // With the key cleared and no hex, nothing can select the row — storing it would grow the
  // in-memory database with rows no query can return.
  it('drops a hex-less row whose mark is ambiguous', () => {
    const merged = mergeFeedRows([
      [rowFor(null, 'nl-ilt', 'valid', 'PH-ABC')],
      [rowFor('a1b2c3', 'other', 'valid', 'PHABC')],
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.icao_hex).toBe('a1b2c3');
    expect(merged[0]?.registration_key).toBeNull();
  });

  it('leaves an unambiguous mark intact', () => {
    const merged = mergeFeedRows([
      [rowFor('a1b2c3', 'faa', 'valid', 'N1')],
      [rowFor(null, 'nl-ilt', 'valid', 'PH-ABC')],
    ]);
    expect(merged.map((r) => r.registration_key).sort()).toEqual(['N1', 'PHABC']);
  });
});

describe('registrationKey', () => {
  it("normalizes each registry's punctuation to one form", () => {
    expect(registrationKey('C-FABC')).toBe('CFABC');
    expect(registrationKey('N12345')).toBe('N12345');
    expect(registrationKey('VH-XYZ')).toBe('VHXYZ');
    expect(registrationKey('zk aac')).toBe('ZKAAC');
  });
});

describe('cancelled records', () => {
  // Excluded from the feed only; the per-source artifact still carries the full history.
  it('never reach the served feed', () => {
    expect(toFeedRows([make('1', 'a1b2c3', { status: 'cancelled' })])).toHaveLength(0);
    expect(toFeedRows([make('1', 'a1b2c3', { status: 'valid' })])).toHaveLength(1);
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

  // Both keys are nullable and both indexes are unique. SQLite does not treat NULLs as equal, so
  // many hex-less rows and many ambiguity-cleared marks coexist; without that the unique index
  // would reject the second one and INSERT OR REPLACE would quietly drop an aircraft.
  it('stores many hex-less rows and many cleared marks under unique indexes', () => {
    const rows = mergeFeedRows([
      toFeedRows([make('1', null, { registration: 'PH-AAA' })]),
      toFeedRows([make('2', null, { registration: 'ZK-BBB' })]),
      // Ambiguous pair: both keep their hex, both lose the mark.
      toFeedRows([make('3', 'a1b2c3', { registration: 'CC-ABC' })]),
      toFeedRows([make('4', '4d5e6f', { registration: 'C-CABC' })]),
    ]);
    const db = Database.deserialize(buildFeedDb(rows));
    try {
      expect(db.query('SELECT count(*) AS n FROM feed').get()).toEqual({ n: 4 });
      expect(db.query('SELECT count(*) AS n FROM feed WHERE icao_hex IS NULL').get()).toEqual({
        n: 2,
      });
      expect(
        db.query('SELECT count(*) AS n FROM feed WHERE registration_key IS NULL').get()
      ).toEqual({ n: 2 });
    } finally {
      db.close();
    }
  });

  it('reaches a hex-less aircraft by mark and never by the hex route', () => {
    const rows = mergeFeedRows([toFeedRows([make('1', null, { registration: 'PH-ABC' })])]);
    const db = Database.deserialize(buildFeedDb(rows));
    try {
      const byMark = db
        .query('SELECT registration FROM feed WHERE registration_key IN (?)')
        .all('PHABC');
      expect(byMark).toEqual([{ registration: 'PH-ABC' }]);
      // SQL IN never matches NULL, so the hex route cannot surface it without a second filter.
      expect(db.query('SELECT * FROM feed WHERE icao_hex IN (?)').all('PHABC')).toEqual([]);
    } finally {
      db.close();
    }
  });

  it('refuses to build when a duplicate populated key survives resolution', () => {
    const [row] = toFeedRows([make('1', 'a1b2c3', { registration: 'N1' })]);
    expect(() => buildFeedDb([row, { ...row, icao_hex: '4d5e6f' }])).toThrow(
      /registration_key collision/
    );
    expect(() => buildFeedDb([row, { ...row, registration_key: 'N2' }])).toThrow(
      /icao_hex collision/
    );
  });

  it('pins the producer shape marker', () => {
    const db = Database.deserialize(buildFeedDb([]));
    try {
      expect(db.query('PRAGMA user_version').get()).toEqual({ user_version: 6 });
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

  // hex-less rows all sort equal on hex, so without a tiebreak their order — and the hash — would
  // follow iteration order and churn a redeploy out of an unchanged feed.
  it('is order-independent when rows share a null hex', () => {
    const a = toFeedRows([make('1', null, { registration: 'PH-AAA' })]);
    const b = toFeedRows([make('2', null, { registration: 'ZK-BBB' })]);
    const c = toFeedRows([make('3', 'a1b2c3', { registration: 'N3' })]);
    expect(hashFeedRows([...a, ...b, ...c])).toBe(hashFeedRows([...c, ...b, ...a]));
  });

  it('changes when a hex-less row is added', () => {
    const base = toFeedRows([make('1', 'a1b2c3')]);
    const withHexless = [...base, ...toFeedRows([make('2', null, { registration: 'PH-ABC' })])];
    expect(hashFeedRows(withHexless)).not.toBe(hashFeedRows(base));
  });

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
  it('accepts the strict current envelope without requesting migration', () => {
    expect(FeedSliceSchema.parse({ version: FEED_SLICE_VERSION, rows: currentRows() })).toEqual({
      rows: currentRows(),
      needsMigration: false,
    });
  });

  // Pre-v3 slices are structurally readable but were written by a producer that discarded hex-less
  // records, so every one of them is short by exactly the rows this version exists to serve.
  // Rejecting drops the source to "no slice", which the pipeline self-heals by regenerating it.
  it('rejects a pre-versioned slice rather than migrating an incomplete one', () => {
    expect(FeedSliceSchema.safeParse(currentRows()).success).toBe(false);
    expect(FeedSliceSchema.safeParse(legacyRows()).success).toBe(false);
  });

  it('rejects the previous envelope version', () => {
    expect(FeedSliceSchema.safeParse({ version: 2, rows: currentRows() }).success).toBe(false);
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
