import { describe, it, expect, spyOn } from 'bun:test';
import { Database } from 'bun:sqlite';
import type { Aircraft } from '../src/schema.js';
import {
  toFeedRows,
  mergeFeedRows,
  registrationKey,
  buildFeedDb,
  hashFeedRows,
  FeedSliceSchema,
  FEED_SLICE_VERSION,
  serializeFeedSlice,
  type FeedRow,
  type FeedSlice,
  type SliceRow,
} from '../src/feed.js';
import type { HistorySummary } from '../src/history.js';

// Every row predates history, so first_seen ranks nothing unless a test sets it.
const NO_HISTORY: HistorySummary = { firstSeen: new Map(), start: '2026-01-01' };
const sliceRows = (records: Aircraft[], history: HistorySummary = NO_HISTORY): SliceRow[] =>
  toFeedRows(records, {
    start: history.start,
    firstSeen: new Map([
      ...records.map((r): [string, string] => [r.source_id, history.start]),
      ...history.firstSeen,
    ]),
  }).rows;
const asSlice = (rows: SliceRow[], history_start = NO_HISTORY.start): FeedSlice => ({
  history_start,
  rows,
});
const merge = (groups: SliceRow[][]): FeedRow[] => mergeFeedRows(groups.map((g) => asSlice(g)));

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
  year_manufactured_range: null,
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
  propeller: null,
  home_base: null,
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
  status_source_text: null,
  emergency_transponder: null,
  remarks: null,
  ...overrides,
});

describe('toFeedRows', () => {
  // Dropping hex-less rows here is what made /feed/registration unable to reach them at all —
  // the endpoint's whole purpose.
  it('keeps a record without an icao_hex, reachable by its mark', () => {
    const rows = sliceRows([make('1', 'a1b2c3'), make('2', null)]);
    expect(rows).toHaveLength(2);
    const hexless = rows.find((r) => r.icao_hex === null);
    expect(hexless?.registration_key).toBe('N2');
  });

  it('collapses two hex-less records sharing a mark to one row', () => {
    const rows = sliceRows([
      make('1', null, { registration: 'PH-ABC', last_action_date: '2020-01-01' }),
      make('2', null, { registration: 'ph abc', last_action_date: '2024-01-01' }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.registration_key).toBe('PHABC');
    // The more recent record wins, exactly as it does on the hex path.
    expect(rows[0]?.registration).toBe('ph abc');
  });

  // Within one register a mark identifies one aircraft, so these are the same airframe seen twice.
  // Emitting both would manufacture an ambiguity and cost the mark its lookup key.
  it('lets a hex-bearing record supersede a hex-less one with the same mark', () => {
    const rows = sliceRows([
      make('1', 'a1b2c3', { registration: 'PH-ABC' }),
      make('2', null, { registration: 'PH-ABC' }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.icao_hex).toBe('a1b2c3');
    expect(rows[0]?.registration_key).toBe('PHABC');
  });

  // A mark shared between a hex winner and a candidate demoted by an *unrelated* hex collision is a
  // real ambiguity, not a duplicate of the winner — deleting the demoted candidate outright would let
  // an unrelated collision elsewhere silently hand the mark to the winner uncontested.
  it('does not let a same-mark hex winner delete a candidate demoted by an unrelated hex collision', () => {
    const rows = sliceRows([
      make('1', 'a1b2c3', { registration: 'LY-AAA' }),
      make('2', 'd4e5f6', { registration: 'LY-AAA' }),
      make('3', 'd4e5f6', { registration: 'LY-CCC' }),
    ]);
    const hexWinner = rows.find((r) => r.icao_hex === 'a1b2c3');
    expect(hexWinner?.registration_key).toBe('LYAAA');
    // Record 2 must still be reachable by mark — the unrelated hex collision on record 3 must not
    // erase it, and the two rows sharing "LYAAA" are exactly what the merge-level ambiguity pass
    // (resolveRegistrationAmbiguity) exists to resolve, not something toFeedRows should hide.
    expect(rows.filter((r) => r.registration_key === 'LYAAA')).toHaveLength(2);

    const merged = merge([rows]);
    const survivor = merged.find((r) => r.icao_hex === 'a1b2c3');
    expect(survivor?.registration_key).toBeNull();
    expect(merged.some((r) => r.icao_hex === null && r.registration === 'LY-AAA')).toBe(false);
  });

  // When the fallback candidates sharing a hex winner's mark can't be resolved between themselves
  // either, collapseGroups drops the whole byMark group before it ever reaches mergeFeedRows — with
  // no row left to carry the conflict forward, the hex winner would otherwise be served with that
  // mark uncontested. The hex path is still valid; only the disputed mark must be cleared, in-source.
  it("clears a hex winner's mark when its ambiguous-hex fallback candidates conflict with each other", () => {
    const rows = sliceRows([
      make('1', 'a1b2c3', { registration: 'LY-AAA' }),
      make('2', 'd4e5f6', { registration: 'LY-AAA', model: '172' }),
      make('3', 'd4e5f6', { registration: 'LY-AAA', model: '182' }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.icao_hex).toBe('a1b2c3');
    expect(rows[0]?.registration_key).toBeNull();
  });

  it('drops a hex-less record whose mark normalizes to nothing', () => {
    const rows = sliceRows([make('1', null, { registration: '- -' })]);
    expect(rows).toEqual([]);
  });

  // The hex-bearing counterpart is kept (the hex still reaches it) but must carry a null key, not
  // ''. An empty key is unreachable — parseRegistrations requires 2-10 alphanumerics — and two of
  // them would otherwise read as one ambiguous mark and clear each other.
  it('nulls the mark of a hex-bearing record whose registration normalizes to nothing', () => {
    const [row] = sliceRows([make('1', 'a1b2c3', { registration: '- -' })]);
    expect(row?.icao_hex).toBe('a1b2c3');
    expect(row?.registration_key).toBeNull();
  });

  it('does not treat two empty marks as an ambiguous collision', () => {
    const merged = merge([
      sliceRows([make('1', 'a1b2c3', { registration: '- -' })]),
      sliceRows([make('2', '4d5e6f', { registration: '...' })]),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.every((r) => r.registration_key === null)).toBe(true);
  });

  it('still excludes cancelled hex-less records', () => {
    const rows = sliceRows([make('1', null, { status: 'cancelled' })]);
    expect(rows).toEqual([]);
  });

  // A null status means the register stated nothing — the real state could be cancelled or reserved
  // as easily as anything else, so serving it would be inventing data. Excluded the same way,
  // whether or not the register publishes a hex.
  it('excludes a null-status record whether or not the register publishes a hex', () => {
    expect(sliceRows([make('1', null, { status: null })])).toEqual([]);
    expect(sliceRows([make('2', 'a1b2c3', { status: null })])).toEqual([]);
  });

  // `unknown` is a register publishing no status at all; excluding it like null would drop the
  // whole register from the feed.
  it('serves an unknown-status record whether or not the register publishes a hex', () => {
    expect(sliceRows([make('1', null, { status: 'unknown' })])[0]?.status).toBe('unknown');
    expect(sliceRows([make('2', 'a1b2c3', { status: 'unknown' })])[0]?.status).toBe('unknown');
  });

  // A reserved mark has no airframe behind it, so nothing can transmit it — and registers publish
  // the intended model against the row, which would read as a real aircraft if it were served.
  it('excludes reserved marks whether or not the register publishes a hex', () => {
    expect(sliceRows([make('1', null, { status: 'reserved', model: 'JAK-42' })])).toEqual([]);
    expect(sliceRows([make('2', 'a1b2c3', { status: 'reserved' })])).toEqual([]);
  });

  // The exclusion must not cost the live aircraft its mark: dropping the reserved row before the
  // collapse is what keeps this from reading as a duplicate-mark ambiguity and nulling both keys.
  it('leaves a live record holding a mark a reserved row also claims', () => {
    const rows = sliceRows([
      make('1', null, { status: 'reserved', registration: 'LY JVD' }),
      make('2', null, { status: 'valid', registration: 'LY-JVD' }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.registration_key).toBe('LYJVD');
    expect(rows[0]?.status).toBe('valid');
  });

  // The date is the only real signal, so it must beat arrival order in both directions.
  it('collapses records sharing a key to the most recent known date', () => {
    const older = make('1', null, {
      registration: 'LY-AAA',
      model: 'AN-2',
      last_action_date: '2020-01-01',
    });
    const newer = make('2', null, {
      registration: 'LY-AAA',
      model: 'JAK-52',
      last_action_date: '2026-01-01',
    });
    expect(sliceRows([older, newer])[0]?.model).toBe('JAK-52');
    expect(sliceRows([newer, older])[0]?.model).toBe('JAK-52');
  });

  // source_id used to break this tie. It is per-row and TKA Lithuania reissues it every
  // publication, so the served answer could flip with no upstream change; neither row is served now.
  it('drops a mark two undatable records claim with conflicting data', () => {
    const rows = sliceRows([
      make('1', null, { registration: 'LY-AXX', model: 'AN-2' }),
      make('2', null, { registration: 'LY-AXX', model: 'JAK-52' }),
    ]);
    expect(rows).toEqual([]);
  });

  // The register cannot order them, but history can: row 2 appeared after this source's history
  // began, so it is the newer claim on the mark.
  it('serves the row history proves newest when register dates cannot decide', () => {
    const history = {
      firstSeen: new Map([
        ['1', '2026-01-01'],
        ['2', '2026-06-01'],
      ]),
      start: '2026-01-01',
    };
    const a = make('1', null, { registration: 'LY-AXX', model: 'AN-2' });
    const b = make('2', null, { registration: 'LY-AXX', model: 'JAK-52' });
    expect(sliceRows([a, b], history).map((r) => r.model)).toEqual(['JAK-52']);
    expect(sliceRows([b, a], history).map((r) => r.model)).toEqual(['JAK-52']);
  });

  // Both first seen on the history start only proves both existed by then; neither is newer.
  it('still drops conflicting rows that both predate history', () => {
    const history = {
      firstSeen: new Map([
        ['1', '2026-01-01'],
        ['2', '2026-01-01'],
      ]),
      start: '2026-01-01',
    };
    const rows = sliceRows(
      [
        make('1', null, { registration: 'LY-AXX', model: 'AN-2' }),
        make('2', null, { registration: 'LY-AXX', model: 'JAK-52' }),
      ],
      history
    );
    expect(rows).toEqual([]);
  });

  // Rows 2 and 3 tie, but both supersede row 1, so row 1's differing data cannot poison the key.
  it('collapses identical survivors once history rules out a superseded row', () => {
    const history = {
      firstSeen: new Map([
        ['1', '2026-01-01'],
        ['2', '2026-06-01'],
        ['3', '2026-06-01'],
      ]),
      start: '2026-01-01',
    };
    const rows = sliceRows(
      [
        make('1', null, { registration: 'LY-AXX', model: 'AN-2' }),
        make('2', null, { registration: 'LY-AXX', model: 'JAK-52' }),
        make('3', null, { registration: 'LY-AXX', model: 'JAK-52' }),
      ],
      history
    );
    expect(rows.map((r) => r.model)).toEqual(['JAK-52']);
  });

  it('lets a register date outrank first_seen', () => {
    const history = {
      firstSeen: new Map([
        ['1', '2026-01-01'],
        ['2', '2026-06-01'],
      ]),
      start: '2026-01-01',
    };
    const rows = sliceRows(
      [
        make('1', null, { registration: 'LY-AXX', model: 'AN-2', last_action_date: '2026-09-01' }),
        make('2', null, { registration: 'LY-AXX', model: 'JAK-52' }),
      ],
      history
    );
    expect(rows.map((r) => r.model)).toEqual(['AN-2']);
  });

  it('stamps each slice row with its first_seen', () => {
    const slice = toFeedRows([make('1', 'a1b2c3'), make('2', '4d5e6f', { registration: 'N2' })], {
      firstSeen: new Map([
        ['1', '2026-06-01'],
        ['2', '2026-01-01'],
      ]),
      start: '2026-01-01',
    });
    expect(slice.history_start).toBe('2026-01-01');
    expect(Object.fromEntries(slice.rows.map((r) => [r.icao_hex, r.first_seen]))).toEqual({
      a1b2c3: '2026-06-01',
      '4d5e6f': '2026-01-01',
    });
  });

  // A defaulted date would rank the row against history it never had.
  it('throws on a live row its history does not date', () =>
    expect(() =>
      toFeedRows([make('1', 'a1b2c3')], { firstSeen: new Map(), start: '2026-01-01' })
    ).toThrow(/no first_seen for live row 1/));

  it('reports a dropped key rather than absorbing it', () => {
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});
    try {
      sliceRows([
        make('1', null, { registration: 'LY-AXX', model: 'AN-2' }),
        make('2', null, { registration: 'LY-AXX', model: 'JAK-52' }),
      ]);
      const line = logSpy.mock.calls.map((c) => String(c[0])).find((l) => l.includes('ambiguous'));
      expect(line).toContain('event=feed_source_key_ambiguous');
      expect(line).toContain('marks=1');
      expect(line).toContain('LYAXX');
    } finally {
      logSpy.mockRestore();
    }
  });

  // A register republishing a row verbatim is not a contradiction — there is nothing to choose
  // between. Only source_id differs, and it is not part of the served row.
  it('collapses duplicate rows that render identically', () => {
    const rows = sliceRows([
      make('1', null, { registration: 'LY-AAA' }),
      make('2', null, { registration: 'LY-AAA' }),
    ]);
    expect(rows).toHaveLength(1);
  });

  // Dropping the hex must not cost each aircraft its own tail-number lookup.
  it('falls an unresolvable hex back to the marks its candidates hold', () => {
    const rows = sliceRows([
      make('1', 'a1b2c3', { registration: 'LY-AAA', model: 'AN-2' }),
      make('2', 'a1b2c3', { registration: 'LY-BBB', model: 'JAK-52' }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.icao_hex === null)).toBe(true);
    expect(rows.map((r) => r.registration_key).sort()).toEqual(['LYAAA', 'LYBBB']);
  });

  // Both keys contradict themselves, so nothing is left to select the rows by.
  it('drops candidates of an unresolvable hex that also share a mark', () => {
    const rows = sliceRows([
      make('1', 'a1b2c3', { registration: 'LY-AAA', model: 'AN-2' }),
      make('2', 'a1b2c3', { registration: 'LY-AAA', model: 'JAK-52' }),
    ]);
    expect(rows).toEqual([]);
  });

  it('maps nested owner/operator/engine and descriptive fields into flat columns', () => {
    const [row] = sliceRows([
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
    const rows = sliceRows([
      make('1', 'a1b2c3', { status: 'cancelled', registration: 'OLD' }),
      make('2', 'a1b2c3', { status: 'valid', registration: 'NEW' }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ registration: 'NEW', status: 'valid' });
  });

  it('is import-order-independent on a hex collision', () => {
    const a = make('1', 'a1b2c3', { status: 'cancelled', registration: 'OLD' });
    const b = make('2', 'a1b2c3', { status: 'valid', registration: 'NEW' });
    expect(sliceRows([a, b])).toEqual(sliceRows([b, a]));
  });

  it('returns an empty array for no records', () => {
    expect(sliceRows([])).toEqual([]);
  });
});

describe('mergeFeedRows', () => {
  const rowFor = (
    hex: string | null,
    source: string,
    status: Aircraft['status'],
    reg: string,
    first_seen = NO_HISTORY.start
  ): SliceRow => ({
    ...sliceRows([make('1', hex, { source, status, registration: reg })])[0],
    first_seen,
  });

  it('unions per-source slices into one row per hex', () => {
    const merged = merge([
      [rowFor('a1b2c3', 'faa', 'valid', 'N1')],
      [rowFor('4d5e6f', 'ca', 'valid', 'C-2')],
    ]);
    expect(merged).toHaveLength(2);
  });

  it('keeps the first slice to claim a hex when history cannot order the claims', () => {
    const faa = [rowFor('a1b2c3', 'faa', 'valid', 'N1')];
    const ca = [rowFor('a1b2c3', 'ca', 'valid', 'C-2')];
    expect(merge([faa, ca])[0]?.registration).toBe('N1');
  });

  // An airframe exported from one register to another: the importing row appeared after that
  // source's history began, so it is provably the current registration.
  it('hands a hex to the claim history proves newest, whatever the slice order', () => {
    const faa = asSlice([rowFor('a1b2c3', 'faa', 'valid', 'N1')]);
    const ca = asSlice([rowFor('a1b2c3', 'ca', 'valid', 'C-2', '2026-06-01')]);
    expect(mergeFeedRows([faa, ca])[0]?.registration).toBe('C-2');
    expect(mergeFeedRows([ca, faa])[0]?.registration).toBe('C-2');
  });

  // Every row of a source onboarded later carries that later day as first_seen. Ranking on it raw
  // would hand that source every collision.
  it('never lets a later-onboarded source win on its history start alone', () => {
    const faa = asSlice([rowFor('a1b2c3', 'faa', 'valid', 'N1')]);
    const late = asSlice([rowFor('a1b2c3', 'zz', 'valid', 'ZZ-1', '2026-09-01')], '2026-09-01');
    expect(mergeFeedRows([faa, late])[0]?.registration).toBe('N1');
  });

  // The appearing row is dated, but the other only proves it existed by its later history start —
  // it may well be the older registration, so nothing is overridden.
  it('does not override a claim whose history start is later than the newer row', () => {
    const late = asSlice([rowFor('a1b2c3', 'zz', 'valid', 'ZZ-1', '2026-09-01')], '2026-09-01');
    const ca = asSlice([rowFor('a1b2c3', 'ca', 'valid', 'C-2', '2026-06-01')]);
    expect(mergeFeedRows([late, ca])[0]?.registration).toBe('ZZ-1');
  });

  // X supersedes Z but cannot be ordered against Y, so no claim is newest. Z is first in source
  // order, yet history already proves it stale; the fallback skips it.
  it('never falls back to a claim another claim supersedes', () => {
    const z = asSlice([rowFor('a1b2c3', 'ar', 'valid', 'LV-Z')]);
    const x = asSlice([rowFor('a1b2c3', 'ca', 'valid', 'C-X', '2026-06-01')]);
    const y = asSlice([rowFor('a1b2c3', 'zz', 'valid', 'ZZ-Y', '2026-06-01')], '2026-06-01');
    expect(mergeFeedRows([z, x, y])[0]?.registration).toBe('C-X');
  });

  it('serves no first_seen', () => {
    const merged = mergeFeedRows([
      asSlice([rowFor('a1b2c3', 'faa', 'valid', 'N1', '2026-06-01')]),
      asSlice([rowFor(null, 'nl-ilt', 'valid', 'PH-ABC', '2026-06-01')]),
    ]);
    expect(merged).toHaveLength(2);
    for (const row of merged) expect(row).not.toHaveProperty('first_seen');
  });

  it('carries hex-less rows from every slice into the merged feed', () => {
    const nl = [rowFor(null, 'nl-ilt', 'valid', 'PH-ABC')];
    const faa = [rowFor('a1b2c3', 'faa', 'valid', 'N1')];
    const merged = merge([faa, nl]);
    expect(merged).toHaveLength(2);
    expect(merged.find((r) => r.registration_key === 'PHABC')?.icao_hex).toBeNull();
  });

  // Two registers can issue marks that normalize alike. They are different aircraft, so neither can
  // own the key — answering with either would be wrong, and a miss is the honest result.
  it('clears a mark claimed by two different aircraft, keeping both reachable by hex', () => {
    const a = [rowFor('a1b2c3', 'cl-dgac', 'valid', 'CC-ABC')];
    const b = [rowFor('4d5e6f', 'tc-ca', 'valid', 'C-CABC')];
    const merged = merge([a, b]);
    expect(merged).toHaveLength(2);
    expect(merged.every((r) => r.registration_key === null)).toBe(true);
    expect(merged.map((r) => r.icao_hex).sort()).toEqual(['4d5e6f', 'a1b2c3']);
  });

  // Canada does this to itself: the 3-character mark ABC renders CF-ABC and the 4-character mark
  // FABC renders C-FABC, and both normalize to CFABC.
  it('clears a mark two rows of one register normalize onto', () => {
    const merged = merge([
      [rowFor('a1b2c3', 'tc-ca', 'valid', 'CF-ABC'), rowFor('4d5e6f', 'tc-ca', 'valid', 'C-FABC')],
    ]);
    expect(merged.every((r) => r.registration_key === null)).toBe(true);
  });

  // With the key cleared and no hex, nothing can select the row — storing it would grow the
  // in-memory database with rows no query can return.
  it('drops a hex-less row whose mark is ambiguous', () => {
    const merged = merge([
      [rowFor(null, 'nl-ilt', 'valid', 'PH-ABC')],
      [rowFor('a1b2c3', 'other', 'valid', 'PHABC')],
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.icao_hex).toBe('a1b2c3');
    expect(merged[0]?.registration_key).toBeNull();
  });

  it('leaves an unambiguous mark intact', () => {
    const merged = merge([
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

describe('buildFeedDb', () => {
  it('builds one queryable feed table keyed by icao_hex', () => {
    const rows = sliceRows([
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
    const rows = merge([
      sliceRows([make('1', 'a1b2c3', { country: 'US' })]),
      sliceRows([make('2', '4d5e6f', { country: 'CA', registration: 'C-2' })]),
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
    const rows = merge([
      sliceRows([make('1', null, { registration: 'PH-AAA' })]),
      sliceRows([make('2', null, { registration: 'ZK-BBB' })]),
      // Ambiguous pair: both keep their hex, both lose the mark.
      sliceRows([make('3', 'a1b2c3', { registration: 'CC-ABC' })]),
      sliceRows([make('4', '4d5e6f', { registration: 'C-CABC' })]),
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
    const rows = merge([sliceRows([make('1', null, { registration: 'PH-ABC' })])]);
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
    const [row] = sliceRows([make('1', 'a1b2c3', { registration: 'N1' })]);
    expect(() => buildFeedDb([row, { ...row, icao_hex: '4d5e6f' }])).toThrow(
      /registration_key collision/
    );
    expect(() => buildFeedDb([row, { ...row, registration_key: 'N2' }])).toThrow(
      /icao_hex collision/
    );
  });

  it('pins the producer shape marker', () => {
    // The feed's user_version is independent of db.ts's and is the contract for the consolidated
    // DB the service serves. Bump it for a column change AND for a value-domain widening on a
    // column the feed carries: a canonical enum once gained values while only db.ts was bumped,
    // leaving the feed advertising a shape version that predated the values it was serving.
    const db = Database.deserialize(buildFeedDb([]));
    try {
      expect(db.query('PRAGMA user_version').get()).toEqual({ user_version: 11 });
    } finally {
      db.close();
    }
  });
});

describe('hashFeedRows', () => {
  const rows = (): FeedRow[] => [
    ...sliceRows([make('1', 'a1b2c3')]),
    ...sliceRows([make('2', '4d5e6f', { registration: 'N2' })]),
  ];

  // hex-less rows all sort equal on hex, so without a tiebreak their order — and the hash — would
  // follow iteration order and churn a redeploy out of an unchanged feed.
  it('is order-independent when rows share a null hex', () => {
    const a = sliceRows([make('1', null, { registration: 'PH-AAA' })]);
    const b = sliceRows([make('2', null, { registration: 'ZK-BBB' })]);
    const c = sliceRows([make('3', 'a1b2c3', { registration: 'N3' })]);
    expect(hashFeedRows([...a, ...b, ...c])).toBe(hashFeedRows([...c, ...b, ...a]));
  });

  it('changes when a hex-less row is added', () => {
    const base = sliceRows([make('1', 'a1b2c3')]);
    const withHexless = [...base, ...sliceRows([make('2', null, { registration: 'PH-ABC' })])];
    expect(hashFeedRows(withHexless)).not.toBe(hashFeedRows(base));
  });

  it('is stable for the same content', () => {
    expect(hashFeedRows(rows())).toBe(hashFeedRows(rows()));
  });

  it('is independent of row order', () => {
    const [a, b] = rows();
    expect(hashFeedRows([a, b])).toBe(hashFeedRows([b, a]));
  });

  it('changes when a sort-key column changes', () => {
    const [a, b] = rows();
    const mutated: FeedRow = { ...b, registration: 'N999' };
    expect(hashFeedRows([a, mutated])).not.toBe(hashFeedRows([a, b]));
  });

  it('changes when a column outside the sort key changes', () => {
    const [a, b] = rows();
    const mutated: FeedRow = { ...b, model: 'CHANGED', seats: 99 };
    expect(hashFeedRows([a, mutated])).not.toBe(hashFeedRows([a, b]));
  });

  it('is independent of the key order within a row', () => {
    const [a, b] = rows();
    const reordered = Object.fromEntries(Object.entries(b).reverse()) as unknown as FeedRow;
    expect(hashFeedRows([a, reordered])).toBe(hashFeedRows([a, b]));
  });
});

describe('FeedSliceSchema', () => {
  const currentRows = (): SliceRow[] =>
    sliceRows([
      make('1', 'a1b2c3', {
        cancellation_reason: 'Aircraft exported',
        airworthiness_class: 'Standard',
      }),
    ]);
  const current = (): Record<string, unknown> => ({
    version: FEED_SLICE_VERSION,
    history_start: '2026-01-01',
    rows: currentRows(),
  });
  // Version 3's rows: every served column, no first_seen.
  const v3Rows = () =>
    currentRows().map((row) =>
      Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'first_seen'))
    );

  it('accepts the strict current envelope and unwraps to the slice', () => {
    expect(FeedSliceSchema.parse(current())).toEqual({
      history_start: '2026-01-01',
      rows: currentRows(),
    });
  });

  it('round-trips through serializeFeedSlice', () => {
    const slice = asSlice(currentRows());
    expect(FeedSliceSchema.parse(JSON.parse(serializeFeedSlice(slice)))).toEqual(slice);
  });

  // A version-3 slice cannot rank a cross-source collision. Rejecting drops the source to
  // "no slice", which the pipeline self-heals by regenerating it.
  it('rejects the previous envelope version', () => {
    expect(FeedSliceSchema.safeParse({ version: 3, rows: v3Rows() }).success).toBe(false);
    expect(FeedSliceSchema.safeParse({ ...current(), version: 3 }).success).toBe(false);
  });

  it('rejects a slice missing history_start or a row missing first_seen', () => {
    const { history_start: _start, ...noStart } = current();
    expect(_start).toBe('2026-01-01');
    expect(FeedSliceSchema.safeParse(noStart).success).toBe(false);
    expect(FeedSliceSchema.safeParse({ ...current(), rows: v3Rows() }).success).toBe(false);
  });

  // Ranking compares these as strings, which orders only ISO dates.
  it('rejects a history_start or first_seen that is not an ISO date', () => {
    const [row] = currentRows();
    expect(FeedSliceSchema.safeParse({ ...current(), history_start: '' }).success).toBe(false);
    expect(
      FeedSliceSchema.safeParse({ ...current(), rows: [{ ...row, first_seen: '01/06/2026' }] })
        .success
    ).toBe(false);
  });

  it('accepts an empty slice', () => {
    expect(FeedSliceSchema.safeParse({ ...current(), rows: [] }).success).toBe(true);
  });

  it('rejects scalar rows, a row missing a NOT NULL column, and a string in a numeric column', () => {
    const [row] = currentRows();
    for (const rows of [
      [1, 2, 3],
      [{ icao_hex: 'a1b2c3', first_seen: '2026-01-01' }],
      [{ ...row, year_manufactured: '1979' }],
    ])
      expect(FeedSliceSchema.safeParse({ ...current(), rows }).success).toBe(false);
  });

  it('rejects unknown versions, bare arrays and drifted rows', () => {
    const [row] = currentRows();
    expect(FeedSliceSchema.safeParse({ ...current(), version: 999 }).success).toBe(false);
    expect(FeedSliceSchema.safeParse(currentRows()).success).toBe(false);
    expect(
      FeedSliceSchema.safeParse({ ...current(), rows: [{ ...row, unexpected: 'drift' }] }).success
    ).toBe(false);
  });
});
