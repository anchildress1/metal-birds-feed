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

// A fully populated record to verify every column maps, including nested objects and the array.
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
  operational_classes: ['day', 'vfr'],
  engine: {
    manufacturer: 'ROTAX',
    model: '912',
    type: 'reciprocating',
    count: 1,
    horsepower: 80,
    thrust_lbs: null,
  },
  owner: { name: 'Beispiel, Anna', kind: 'co-owner', state: 'SO', country: 'Switzerland' },
  operator: { name: 'Betrieb AG', kind: null, state: 'BE', country: 'Switzerland' },
  idera_authorised_party: null,
  certification_date: '2025-08-15',
  airworthiness_date: null,
  expiration_date: null,
  last_action_date: null,
  cruise_speed_ktas: 95.5,
  max_takeoff_weight_kg: 340,
  seats: 1,
  max_passengers: 0,
  min_crew: 1,
  airworthiness_review_date: '2027-04-23',
  cancellation_reason: null,
  lien_status: null,
  interdiction_code: null,
};

const records = new Map([
  ['00002', make('00002', 'dead00', 'N2')],
  ['00001', make('00001', 'a4e294', 'N1')],
  ['00003', make('00003', null, 'N3')],
]);

const onePopulated = (): Map<string, Aircraft> => new Map([[populated.source_id, populated]]);

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

  it('stores every canonical scalar field as its own column', () => {
    const db = Database.deserialize(buildSqlite(onePopulated()));
    const row = db.query('SELECT * FROM aircraft WHERE source_id = ?').get('1367606') as Record<
      string,
      unknown
    >;

    expect(row.source).toBe('ch-foca');
    expect(row.registration).toBe('HB-1000');
    expect(row.icao_hex).toBe('4b488f');
    expect(row.icao_type_code).toBe('GLID');
    expect(row.status).toBe('valid');
    expect(row.airframe_type).toBe('glider');
    expect(row.manufacturer).toBe('LET, A.S.');
    expect(row.model).toBe('L 33 SÓLO');
    expect(row.serial_number).toBe('960404');
    expect(row.certification_date).toBe('2025-08-15');
    expect(row.airworthiness_review_date).toBe('2027-04-23');
  });

  it('flattens nested owner / operator / engine objects into columns', () => {
    const db = Database.deserialize(buildSqlite(onePopulated()));
    const row = db.query('SELECT * FROM aircraft WHERE source_id = ?').get('1367606') as Record<
      string,
      unknown
    >;

    expect(row.owner_name).toBe('Beispiel, Anna');
    expect(row.owner_kind).toBe('co-owner');
    expect(row.owner_state).toBe('SO');
    expect(row.owner_country).toBe('Switzerland');
    expect(row.operator_name).toBe('Betrieb AG');
    expect(row.operator_kind).toBeNull();
    expect(row.engine_manufacturer).toBe('ROTAX');
    expect(row.engine_count).toBe(1);
    expect(row.engine_thrust_lbs).toBeNull();
  });

  it('stores numeric columns as numbers, not strings', () => {
    const db = Database.deserialize(buildSqlite(onePopulated()));
    const row = db
      .query(
        'SELECT year_manufactured, seats, min_crew, max_passengers, cruise_speed_ktas, max_takeoff_weight_kg FROM aircraft WHERE source_id = ?'
      )
      .get('1367606') as Record<string, unknown>;

    expect(row.year_manufactured).toBe(1996);
    expect(row.seats).toBe(1);
    expect(row.min_crew).toBe(1);
    expect(row.max_passengers).toBe(0);
    expect(row.cruise_speed_ktas).toBe(95.5);
    expect(row.max_takeoff_weight_kg).toBe(340);
    expect(typeof row.year_manufactured).toBe('number');
  });

  it('round-trips operational_classes as a JSON array column', () => {
    const db = Database.deserialize(buildSqlite(onePopulated()));
    const row = db
      .query('SELECT operational_classes FROM aircraft WHERE source_id = ?')
      .get('1367606') as { operational_classes: string };
    expect(JSON.parse(row.operational_classes)).toEqual(['day', 'vfr']);
  });

  it('preserves a null icao_hex', () => {
    const db = Database.deserialize(buildSqlite(records));
    const row = db.query('SELECT icao_hex FROM aircraft WHERE source_id = ?').get('00003') as {
      icao_hex: string | null;
    };
    expect(row.icao_hex).toBeNull();
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
