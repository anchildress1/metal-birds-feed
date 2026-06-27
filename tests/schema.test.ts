import { describe, it, expect } from 'bun:test';
import { AircraftSchema, type Aircraft } from '../src/schema.js';

const base: Aircraft = {
  source: 'faa',
  source_id: '00001001',
  registration: 'N12345',
  icao_hex: 'a4e294',
  icao_type_code: null,
  status: 'valid',
  country: 'US',
  manufacturer: 'CESSNA',
  model: '172',
  serial_number: '12345',
  year_manufactured: 1979,
  airframe_type: 'fixed-wing-single-engine',
  category: 'standard',
  build_certification: 'type-certificated',
  airworthiness_class: '1',
  operating_environment: 'land',
  operational_classes: ['4'],
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
  certification_date: '1979-06-20',
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
};

describe('AircraftSchema', () => {
  it('accepts a clean record', () => {
    expect(AircraftSchema.safeParse(base).success).toBe(true);
  });

  it('accepts a hyphenated international registration', () => {
    expect(AircraftSchema.safeParse({ ...base, registration: 'VH-ABC' }).success).toBe(true);
  });

  it('accepts a null icao_hex', () => {
    expect(AircraftSchema.safeParse({ ...base, icao_hex: null }).success).toBe(true);
  });

  for (const field of [
    'certification_date',
    'airworthiness_date',
    'expiration_date',
    'last_action_date',
    'airworthiness_review_date',
  ] as const) {
    it(`accepts a null and an ISO date for ${field}`, () => {
      expect(AircraftSchema.safeParse({ ...base, [field]: null }).success).toBe(true);
      expect(AircraftSchema.safeParse({ ...base, [field]: '2026-01-31' }).success).toBe(true);
    });

    for (const bad of ['2026', '01/31/2026', '2026-1-3', 'not-a-date']) {
      it(`rejects ${field} value ${JSON.stringify(bad)}`, () => {
        expect(AircraftSchema.safeParse({ ...base, [field]: bad }).success).toBe(false);
      });
    }
  }

  it('accepts a registration containing a slash (no longer an R2 key segment)', () => {
    expect(AircraftSchema.safeParse({ ...base, registration: 'A/B' }).success).toBe(true);
  });
});
