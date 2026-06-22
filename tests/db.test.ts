import { describe, it, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { buildSqlite, hashRecords } from '../src/db.js';
import type { Aircraft } from '../src/schema.js';

const make = (id: string, hex: string | null, reg: string): Aircraft => ({
  source: 'faa',
  source_id: id,
  registration: reg,
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
  operating_environment: null,
  operational_classes: [],
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
  lien_status: null,
  interdiction_code: null,
});

// Every field set to a DISTINCT non-null sentinel so a column/value mis-map (e.g. owner_country
// bound to operator.country) fails — same-typed columns would otherwise pass an undetected swap.
const populated: Aircraft = {
  source: 'ch-foca',
  source_id: '1367606',
  registration: 'HB-1000',
  icao_hex: '4b488f',
  icao_type_code: 'GLID',
  status: 'valid',
  country: 'CH',
  manufacturer: 'LET, A.S.',
  model: 'L 33 SÓLO',
  serial_number: '960404',
  year_manufactured: 1996,
  airframe_type: 'glider',
  category: 'standard',
  build_certification: 'type-certificated',
  airworthiness_class: 'Utility',
  operating_environment: 'land',
  operational_classes: ['day', 'vfr', 'night'],
  engine: {
    manufacturer: 'ROTAX',
    model: '912',
    type: 'reciprocating',
    count: 1,
    horsepower: 80,
    thrust_lbs: 5000,
  },
  owner: { name: 'Beispiel, Anna', kind: 'co-owner', state: 'SO', country: 'Switzerland' },
  operator: { name: 'Betrieb AG', kind: 'corporation', state: 'BE', country: 'Germany' },
  idera_authorised_party: 'IDERA Bank AG',
  certification_date: '2025-08-15',
  airworthiness_date: '2024-01-02',
  expiration_date: '2030-06-30',
  last_action_date: '2023-11-11',
  cruise_speed_ktas: 95.5,
  max_takeoff_weight_kg: 340,
  seats: 4,
  max_passengers: 9,
  min_crew: 2,
  airworthiness_review_date: '2027-04-23',
  cancellation_reason: 'owner request',
  lien_status: 'none',
  interdiction_code: 'INT-9',
};

const records = new Map([
  ['00002', make('00002', 'dead00', 'N2')],
  ['00001', make('00001', 'a4e294', 'N1')],
  ['00003', make('00003', null, 'N3')],
]);

const onePopulated = (): Map<string, Aircraft> => new Map([[populated.source_id, populated]]);
const populatedRow = (): Record<string, unknown> =>
  Database.deserialize(buildSqlite(onePopulated()))
    .query('SELECT * FROM aircraft WHERE source_id = ?')
    .get('1367606') as Record<string, unknown>;

describe('buildSqlite', () => {
  it('supports point lookups by hex, registration, and source_id', () => {
    const db = Database.deserialize(buildSqlite(records));

    const byHex = db
      .query('SELECT source_id, registration FROM aircraft WHERE icao_hex = ?')
      .get('a4e294') as { source_id: string; registration: string };
    expect(byHex.source_id).toBe('00001');
    expect(byHex.registration).toBe('N1');

    const byReg = db.query('SELECT source_id FROM aircraft WHERE registration = ?').get('N3') as {
      source_id: string;
    };
    expect(byReg.source_id).toBe('00003');

    const byId = db.query('SELECT registration FROM aircraft WHERE source_id = ?').get('00002') as {
      registration: string;
    };
    expect(byId.registration).toBe('N2');

    const count = db.query('SELECT COUNT(*) AS n FROM aircraft').get() as { n: number };
    expect(count.n).toBe(3);
  });

  it('maps every canonical field to its own column with the right value', () => {
    const row = populatedRow();
    // Distinct sentinels above mean any column/value swap surfaces as a failure here.
    expect(row).toMatchObject({
      source: 'ch-foca',
      source_id: '1367606',
      registration: 'HB-1000',
      icao_hex: '4b488f',
      icao_type_code: 'GLID',
      status: 'valid',
      country: 'CH',
      manufacturer: 'LET, A.S.',
      model: 'L 33 SÓLO',
      serial_number: '960404',
      year_manufactured: 1996,
      airframe_type: 'glider',
      category: 'standard',
      build_certification: 'type-certificated',
      airworthiness_class: 'Utility',
      operating_environment: 'land',
      engine_manufacturer: 'ROTAX',
      engine_model: '912',
      engine_type: 'reciprocating',
      engine_count: 1,
      engine_horsepower: 80,
      engine_thrust_lbs: 5000,
      owner_name: 'Beispiel, Anna',
      owner_kind: 'co-owner',
      owner_state: 'SO',
      owner_country: 'Switzerland',
      operator_name: 'Betrieb AG',
      operator_kind: 'corporation',
      operator_state: 'BE',
      operator_country: 'Germany',
      idera_authorised_party: 'IDERA Bank AG',
      certification_date: '2025-08-15',
      airworthiness_date: '2024-01-02',
      expiration_date: '2030-06-30',
      last_action_date: '2023-11-11',
      cruise_speed_ktas: 95.5,
      max_takeoff_weight_kg: 340,
      seats: 4,
      max_passengers: 9,
      min_crew: 2,
      airworthiness_review_date: '2027-04-23',
      cancellation_reason: 'owner request',
      lien_status: 'none',
      interdiction_code: 'INT-9',
    });
  });

  it('stores numeric columns as numbers, not strings', () => {
    const row = populatedRow();
    for (const col of [
      'year_manufactured',
      'engine_count',
      'engine_horsepower',
      'engine_thrust_lbs',
      'cruise_speed_ktas',
      'max_takeoff_weight_kg',
      'seats',
      'max_passengers',
      'min_crew',
    ]) {
      expect(typeof row[col]).toBe('number');
    }
  });

  it('round-trips operational_classes as a JSON array column', () => {
    const row = populatedRow();
    expect(JSON.parse(row.operational_classes as string)).toEqual(['day', 'vfr', 'night']);
  });

  it('preserves null optional fields', () => {
    const db = Database.deserialize(buildSqlite(records));
    const row = db
      .query(
        'SELECT icao_hex, manufacturer, owner_name, engine_count FROM aircraft WHERE source_id = ?'
      )
      .get('00003') as Record<string, unknown>;
    expect(row.icao_hex).toBeNull();
    expect(row.owner_name).toBeNull();
    expect(row.engine_count).toBeNull();
    expect(row.manufacturer).toBe('CESSNA');
  });

  it('builds a valid empty artifact for a zero-record source', () => {
    const db = Database.deserialize(buildSqlite(new Map()));
    const count = db.query('SELECT COUNT(*) AS n FROM aircraft').get() as { n: number };
    expect(count.n).toBe(0);
    const version = db.query('PRAGMA user_version').get() as { user_version: number };
    expect(version.user_version).toBe(2);
  });

  it('indexes the common filter columns and stamps the schema version', () => {
    const db = Database.deserialize(buildSqlite(records));
    const indexes = db.query("SELECT name FROM sqlite_master WHERE type = 'index'").all() as {
      name: string;
    }[];
    const names = indexes.map((i) => i.name);
    for (const idx of [
      'idx_icao_hex',
      'idx_registration',
      'idx_status',
      'idx_airframe_type',
      'idx_owner_country',
    ]) {
      expect(names).toContain(idx);
    }

    const version = db.query('PRAGMA user_version').get() as { user_version: number };
    expect(version.user_version).toBe(2);
  });
});

describe('hashRecords', () => {
  it('is stable regardless of Map insertion order', () => {
    const reordered = new Map([
      ['00003', make('00003', null, 'N3')],
      ['00001', make('00001', 'a4e294', 'N1')],
      ['00002', make('00002', 'dead00', 'N2')],
    ]);
    expect(hashRecords(records)).toBe(hashRecords(reordered));
  });

  it('changes when a record changes', () => {
    const changed = new Map(records);
    changed.set('00001', make('00001', 'a4e294', 'N1-CHANGED'));
    expect(hashRecords(changed)).not.toBe(hashRecords(records));
  });
});
