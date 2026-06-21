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

const records = new Map([
  ['00002', make('00002', 'dead00', 'N2')],
  ['00001', make('00001', 'a4e294', 'N1')],
  ['00003', make('00003', null, 'N3')],
]);

describe('buildSqlite', () => {
  it('produces a queryable SQLite artifact with point lookups by hex and registration', () => {
    const db = Database.deserialize(buildSqlite(records));

    const byHex = db
      .query('SELECT source_id, record FROM aircraft WHERE icao_hex = ?')
      .get('a4e294') as {
      source_id: string;
      record: string;
    };
    expect(byHex.source_id).toBe('00001');
    expect((JSON.parse(byHex.record) as Aircraft).registration).toBe('N1');

    const byReg = db.query('SELECT source_id FROM aircraft WHERE registration = ?').get('N3') as {
      source_id: string;
    };
    expect(byReg.source_id).toBe('00003');

    const count = db.query('SELECT COUNT(*) AS n FROM aircraft').get() as { n: number };
    expect(count.n).toBe(3);
  });

  it('preserves a null icao_hex', () => {
    const db = Database.deserialize(buildSqlite(records));
    const row = db.query('SELECT icao_hex FROM aircraft WHERE source_id = ?').get('00003') as {
      icao_hex: string | null;
    };
    expect(row.icao_hex).toBeNull();
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
