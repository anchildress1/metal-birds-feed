import { describe, it, expect } from 'bun:test';
import { loadSourceConfig } from '../../src/config/loader.js';
import {
  AircraftCategorySchema,
  BuildCertificationSchema,
  EngineTypeSchema,
  OperatingEnvironmentSchema,
} from '../../src/schema.js';

// Values the live registers publish that previously fell through to `default` and nulled the
// field — 15,749 rows in one refresh. A lookup key deleted here is a silent data regression that
// no fixture catches, because these values are absent from the sampled ground-truth rows.
const CASES: Array<{
  source: string;
  field: string;
  value: string;
  expected: string | null;
}> = [
  // ardata.pdf, Builder Certification Code: 0 Type Certificated / 1 Not Type Certificated /
  // 2 Light Sport. Code 2 alone covers ~10k aircraft.
  { source: 'faa', field: 'build_certification', value: '2', expected: 'light-sport' },
  // Airworthiness Classification Code is documented as 1-9; 0 is emitted with no published meaning.
  { source: 'faa', field: 'category', value: '0', expected: null },
  // One canonical value per class. 3/6/7/8/9 previously all collapsed to `other`, which left a
  // consumer unable to distinguish a restricted-category crop-duster from a ferry permit.
  { source: 'faa', field: 'category', value: '1', expected: 'standard' },
  { source: 'faa', field: 'category', value: '2', expected: 'limited' },
  { source: 'faa', field: 'category', value: '3', expected: 'restricted' },
  { source: 'faa', field: 'category', value: '4', expected: 'experimental' },
  { source: 'faa', field: 'category', value: '5', expected: 'provisional' },
  { source: 'faa', field: 'category', value: '6', expected: 'multiple' },
  { source: 'faa', field: 'category', value: '7', expected: 'primary' },
  { source: 'faa', field: 'category', value: '8', expected: 'special-flight-permit' },
  { source: 'faa', field: 'category', value: '9', expected: 'light-sport' },

  // ANAC files airframe types in the landing-type column; br_airframe already derives them.
  { source: 'br-anac', field: 'operating_environment', value: 'HELICOPTERO', expected: null },
  { source: 'br-anac', field: 'operating_environment', value: 'GIROCOPTERO', expected: null },
  { source: 'br-anac', field: 'operating_environment', value: 'DRONE (RPAS)', expected: null },

  // Dual standard+restricted grants resolve to the restricting half.
  { source: 'br-anac', field: 'category', value: 'NORMAL/RESTRITA', expected: 'restricted' },
  { source: 'br-anac', field: 'category', value: 'ACROB./RESTRITA', expected: 'restricted' },
  { source: 'br-anac', field: 'category', value: 'NORMAL/UT./REST.', expected: 'restricted' },
  { source: 'br-anac', field: 'category', value: 'RESTRITA', expected: 'restricted' },
  { source: 'br-anac', field: 'category', value: 'NORMAL/S.ACROB.', expected: 'standard' },
  { source: 'br-anac', field: 'category', value: 'SEMI ACROBATICA', expected: 'standard' },
  { source: 'br-anac', field: 'category', value: 'UTILIDADE/S.ACROB', expected: 'standard' },
  { source: 'br-anac', field: 'category', value: 'UTIL./ACROBATICA', expected: 'standard' },
  { source: 'br-anac', field: 'category', value: 'TRANSPORTE A', expected: 'standard' },
  { source: 'br-anac', field: 'category', value: 'CLASSE ESPECIAL', expected: 'other' },
  { source: 'br-anac', field: 'category', value: 'NÃO CERTIFICADA', expected: null },
  { source: 'br-anac', field: 'category', value: 'RPAS AUTORIZADO', expected: null },

  {
    source: 'nl-ilt',
    field: 'engine.type',
    value: 'Reciprocating piston-driven Diesel engine',
    expected: 'reciprocating',
  },
  {
    source: 'nl-ilt',
    field: 'engine.type',
    value: 'Reciprocating piston radial engine',
    expected: 'reciprocating',
  },
  {
    source: 'nl-ilt',
    field: 'engine.type',
    value: 'Piston-driven shaft (rotorcraft) engine',
    expected: 'reciprocating',
  },
  {
    source: 'nl-ilt',
    field: 'engine.type',
    value: 'Turbine-driven propeller engine',
    expected: 'turbo-prop',
  },
  { source: 'nl-ilt', field: 'engine.type', value: 'Engine - not defined', expected: 'unknown' },
];

const ENUM_FOR_FIELD: Record<string, { options: readonly string[] }> = {
  build_certification: BuildCertificationSchema,
  category: AircraftCategorySchema,
  operating_environment: OperatingEnvironmentSchema,
  'engine.type': EngineTypeSchema,
};

describe('live source lookups', () => {
  for (const { source, field, value, expected } of CASES) {
    it(`${source} maps ${field} "${value}"`, () => {
      const lookup = loadSourceConfig(`sources/${source}.yaml`).mapping[field]?.lookup;
      // hasOwn, not a truthiness check: an explicit null means "recognized, no schema value" and
      // is the whole point of these entries — it must not read as a missing key.
      expect(Object.hasOwn(lookup ?? {}, value)).toBe(true);
      expect(lookup?.[value]).toBe(expected);
    });
  }

  it('resolves every mapped value to a member of its canonical enum', () => {
    const offenders = CASES.filter(
      ({ field, expected }) =>
        expected !== null && !ENUM_FOR_FIELD[field]?.options.includes(expected)
    );
    expect(offenders).toEqual([]);
  });

  // The FAA publishes a closed code list, so drift must fail the run rather than null the column.
  it('leaves faa build_certification without a default', () => {
    const mapping = loadSourceConfig('sources/faa.yaml').mapping['build_certification'];
    expect(mapping).toBeDefined();
    expect('default' in (mapping ?? {})).toBe(false);
  });
});
