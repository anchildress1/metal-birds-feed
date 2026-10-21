import { describe, it, expect } from 'bun:test';
import { AircraftSchema, CANONICAL_PATHS, type Aircraft } from '../src/schema.js';

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
  year_manufactured_range: null,
  airframe_type: 'fixed-wing-single-engine',
  category: 'standard',
  build_certification: 'type-certificated',
  airworthiness_class: '1',
  airworthiness_class_source_text: '1',
  operating_environment: 'land',
  operational_classes: ['4'],
  operational_classes_source_text: ['4'],
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
  cancellation_reason_source_text: null,
  lien_status: null,
  lien_status_source_text: null,
  interdiction_code: null,
  status_source_text: null,
  emergency_transponder: null,
  remarks: null,
};

describe('AircraftSchema', () => {
  it('accepts a clean record', () => {
    expect(AircraftSchema.safeParse(base).success).toBe(true);
  });

  it('accepts a hyphenated international registration', () => {
    expect(AircraftSchema.safeParse({ ...base, registration: 'VH-ABC' }).success).toBe(true);
  });

  it('rejects an empty registration', () => {
    expect(AircraftSchema.safeParse({ ...base, registration: '' }).success).toBe(false);
  });

  it('rejects a whitespace-only registration', () => {
    expect(AircraftSchema.safeParse({ ...base, registration: '   ' }).success).toBe(false);
  });

  it('rejects a null registration', () => {
    expect(AircraftSchema.safeParse({ ...base, registration: null }).success).toBe(false);
  });

  it('rejects a non-hex icao_hex', () => {
    expect(AircraftSchema.safeParse({ ...base, icao_hex: 'NOTHEX' }).success).toBe(false);
  });

  it('rejects an uppercase icao_hex (canonical form is lowercase)', () => {
    expect(AircraftSchema.safeParse({ ...base, icao_hex: 'A4E294' }).success).toBe(false);
  });

  it('rejects an icao_hex that is not exactly 6 chars', () => {
    expect(AircraftSchema.safeParse({ ...base, icao_hex: 'a4e29' }).success).toBe(false);
    expect(AircraftSchema.safeParse({ ...base, icao_hex: 'a4e2941' }).success).toBe(false);
  });

  it('accepts a null icao_hex', () => {
    expect(AircraftSchema.safeParse({ ...base, icao_hex: null }).success).toBe(true);
  });

  for (const field of [
    'year_manufactured',
    'cruise_speed_ktas',
    'max_takeoff_weight_kg',
    'seats',
    'max_passengers',
    'min_crew',
  ] as const) {
    it(`rejects a negative ${field}`, () => {
      expect(AircraftSchema.safeParse({ ...base, [field]: -1 }).success).toBe(false);
    });

    it(`accepts zero for ${field}`, () => {
      expect(AircraftSchema.safeParse({ ...base, [field]: 0 }).success).toBe(true);
    });
  }

  for (const field of ['count', 'horsepower', 'thrust_lbs'] as const) {
    it(`rejects a negative engine.${field}`, () => {
      expect(
        AircraftSchema.safeParse({ ...base, engine: { ...base.engine, [field]: -1 } }).success
      ).toBe(false);
    });

    it(`accepts zero for engine.${field}`, () => {
      expect(
        AircraftSchema.safeParse({ ...base, engine: { ...base.engine, [field]: 0 } }).success
      ).toBe(true);
    });
  }

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

  it.each([null, 'reserved'] as const)('accepts status %p', (status) => {
    expect(AircraftSchema.safeParse({ ...base, status }).success).toBe(true);
  });

  const withEngineType = (type: string) => ({ ...base, engine: { ...base.engine, type } });
  const withParty = (kind: string) => ({ ...base, owner: { ...base.owner, kind } });
  it.each([
    ['status', { ...base, status: 'bogus' }],
    ['airframe_type', { ...base, airframe_type: 'bogus' }],
    ['category', { ...base, category: 'bogus' }],
    ['build_certification', { ...base, build_certification: 'bogus' }],
    ['operating_environment', { ...base, operating_environment: 'bogus' }],
    ['engine.type', withEngineType('bogus')],
    ['owner.kind', withParty('bogus')],
  ])('rejects a value outside the %s enum', (_field, record) => {
    expect(AircraftSchema.safeParse(record).success).toBe(false);
  });

  it.each([
    ['year_manufactured', { ...base, year_manufactured: 1979.5 }],
    ['seats', { ...base, seats: 1.5 }],
    ['max_passengers', { ...base, max_passengers: 3.2 }],
    ['min_crew', { ...base, min_crew: 0.5 }],
    ['engine.count', { ...base, engine: { ...base.engine, count: 1.5 } }],
  ])('rejects a fractional %s', (_field, record) => {
    expect(AircraftSchema.safeParse(record).success).toBe(false);
  });

  it.each([
    ['cruise_speed_ktas', { ...base, cruise_speed_ktas: 118.5 }],
    ['max_takeoff_weight_kg', { ...base, max_takeoff_weight_kg: 1043.5 }],
    ['engine.horsepower', { ...base, engine: { ...base.engine, horsepower: 180.5 } }],
  ])('accepts a fractional %s', (_field, record) => {
    expect(AircraftSchema.safeParse(record).success).toBe(true);
  });

  it.each(Object.keys(base) as (keyof Aircraft)[])('rejects a record missing %s', (field) => {
    const rest = Object.fromEntries(Object.entries(base).filter(([key]) => key !== field));
    expect(AircraftSchema.safeParse(rest).success).toBe(false);
  });
});

describe('CANONICAL_PATHS', () => {
  it('lists nested leaf paths and scalar fields', () => {
    for (const path of ['owner.name', 'engine.type', 'registration', 'operational_classes'])
      expect(CANONICAL_PATHS.has(path)).toBe(true);
  });

  it('omits the bare parent objects and array indexes', () => {
    for (const path of ['owner', 'engine', 'operational_classes.0', 'owner.knd'])
      expect(CANONICAL_PATHS.has(path)).toBe(false);
  });
});

describe('ISO date fields', () => {
  it.each(['2026-13-45', '2026-02-30', '2026-00-10', '2026-04-31'])(
    'rejects the impossible calendar date %s',
    (value) => {
      expect(AircraftSchema.safeParse({ ...base, certification_date: value }).success).toBe(false);
    }
  );

  it.each(['2026-02-28', '2024-02-29', '2026-12-31'])('accepts the real date %s', (value) => {
    expect(AircraftSchema.safeParse({ ...base, certification_date: value }).success).toBe(true);
  });

  it('rejects a leap day in a non-leap year', () => {
    expect(AircraftSchema.safeParse({ ...base, certification_date: '2025-02-29' }).success).toBe(
      false
    );
  });
});
