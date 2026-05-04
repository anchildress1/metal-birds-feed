import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { writeOds } from 'hucre/ods';
import { loadSourceConfig } from '../src/config/loader.js';
import { translate } from '../src/engine.js';
import type { Aircraft } from '../src/schema.js';
import type { SourceConfig } from '../src/types/config.js';

const FIXTURES = resolve(import.meta.dirname, '..', 'fixtures', 'faa');
const CONFIG_PATH = resolve(import.meta.dirname, '..', 'sources', 'faa.yaml');

function fixtureBuffer(filename: string): Buffer {
  return readFileSync(resolve(FIXTURES, 'input', filename));
}

let records: Map<string, Aircraft>;

beforeAll(async () => {
  const config = loadSourceConfig(CONFIG_PATH);
  const files = new Map([
    ['master', fixtureBuffer('MASTER.txt')],
    ['acftref', fixtureBuffer('ACFTREF.txt')],
    ['engine', fixtureBuffer('ENGINE.txt')],
  ]);
  const result = await translate(config, files);
  records = result.records;
});

describe('FAA fixture translation', () => {
  it('translates all 10 fixture rows', () => {
    expect(records.size).toBe(10);
  });

  describe('N12345 — single-engine piston, individual, valid', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = records.get('00001001')!;
    });

    it('has correct identity', () => {
      expect(r.source).toBe('faa');
      expect(r.source_id).toBe('00001001');
      expect(r.registration).toBe('N12345');
      expect(r.icao_hex).toBe('a4e294');
      expect(r.icao_type_code).toBeNull();
    });

    it('has valid status and US country', () => {
      expect(r.status).toBe('valid');
      expect(r.country).toBe('US');
    });

    it('maps aircraft attributes from ACFTREF join', () => {
      expect(r.manufacturer).toBe('CESSNA');
      expect(r.model).toBe('172');
      expect(r.serial_number).toBe('17282099');
      expect(r.year_manufactured).toBe(1979);
      expect(r.airframe_type).toBe('fixed-wing-single-engine');
    });

    it('derives category and airworthiness from CERTIFICATION field', () => {
      expect(r.category).toBe('standard');
      expect(r.airworthiness_class).toBe('1');
      expect(r.operational_classes).toEqual(['4']);
    });

    it('maps engine from join', () => {
      expect(r.engine.manufacturer).toBe('LYCOMING');
      expect(r.engine.model).toBe('O-320-H2AD');
      expect(r.engine.type).toBe('reciprocating');
      expect(r.engine.count).toBe(1);
      expect(r.engine.horsepower).toBe(150);
    });

    it('maps owner without PII', () => {
      expect(r.owner.name).toBe('JOHN DOE');
      expect(r.owner.kind).toBe('individual');
      expect(r.owner.state).toBe('KS');
      expect(r.owner.country).toBe('US');
      expect(r).not.toHaveProperty('street');
      expect(r).not.toHaveProperty('zip');
    });

    it('converts cruise speed from mph to ktas', () => {
      expect(r.cruise_speed_ktas).toBe(106);
    });

    it('parses dates to ISO format', () => {
      expect(r.certification_date).toBe('1979-06-20');
      expect(r.expiration_date).toBe('2026-10-31');
      expect(r.last_action_date).toBe('2023-10-15');
    });

    it('maps operating environment from AC-CAT', () => {
      expect(r.operating_environment).toBe('land');
    });

    it('maps build certification from ACFTREF', () => {
      expect(r.build_certification).toBe('type-certificated');
    });
  });

  describe('N67890 — large jet, corporation, valid', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = records.get('00002002')!;
    });

    it('maps turbo-fan engine type', () => expect(r.engine.type).toBe('turbo-fan'));
    it('maps multiple engines', () => expect(r.engine.count).toBe(4));
    it('maps jet thrust', () => expect(r.engine.thrust_lbs).toBe(60000));
    it('maps corporation owner kind', () => expect(r.owner.kind).toBe('corporation'));
    it('maps multi-engine airframe type', () =>
      expect(r.airframe_type).toBe('fixed-wing-multi-engine'));
    it('converts 493 mph to ktas', () => expect(r.cruise_speed_ktas).toBe(428.4));
  });

  describe('N99ABC — experimental amateur-built, co-owner', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = records.get('00003003')!;
    });

    it('maps experimental category', () => expect(r.category).toBe('experimental'));
    it('maps operational class 2 (amateur-built)', () =>
      expect(r.operational_classes).toEqual(['2']));
    it('maps not-type-certificated build cert', () =>
      expect(r.build_certification).toBe('not-type-certificated'));
    it('maps co-owner registrant type', () => expect(r.owner.kind).toBe('co-owner'));
    it('maps glider airframe (from MASTER TYPE AIRCRAFT)', () =>
      expect(r.airframe_type).toBe('glider'));
    it('maps none engine type (from MASTER TYPE ENGINE)', () => expect(r.engine.type).toBe('none'));
  });

  describe('N5678X — helicopter, partnership', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = records.get('00004004')!;
    });

    it('maps rotorcraft airframe type', () => expect(r.airframe_type).toBe('rotorcraft'));
    it('maps turbo-shaft engine type', () => expect(r.engine.type).toBe('turbo-shaft'));
    it('maps partnership owner kind', () => expect(r.owner.kind).toBe('partnership'));
  });

  describe('NGLIDE1 — glider, individual', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = records.get('00005005')!;
    });

    it('maps glider airframe', () => expect(r.airframe_type).toBe('glider'));
    it('maps no engine', () => expect(r.engine.type).toBe('none'));
    it('maps zero engine count', () => expect(r.engine.count).toBe(0));
    it('converts 54mph cruise speed to knots (46.9 ktas)', () => {
      expect(r.cruise_speed_ktas).toBe(46.9);
    });
  });

  describe('NBALL1 — balloon, government', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = records.get('00006006')!;
    });

    it('maps balloon airframe', () => expect(r.airframe_type).toBe('balloon'));
    it('maps government owner kind', () => expect(r.owner.kind).toBe('government'));
    it('returns null cruise speed for speed=0', () => expect(r.cruise_speed_ktas).toBeNull());
  });

  describe('NEXP01 — experimental, restricted status (triennial A)', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = records.get('00007007')!;
    });

    it('maps status A to restricted', () => expect(r.status).toBe('restricted'));
    it('maps experimental category', () => expect(r.category).toBe('experimental'));
  });

  describe('NFRAC1 — fractional ownership, co-owner', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = records.get('00008008')!;
    });

    it('maps co-owner registrant type', () => expect(r.owner.kind).toBe('co-owner'));
    it('has valid status', () => expect(r.status).toBe('valid'));
  });

  describe('NFORN1 — non-citizen corporation', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = records.get('00009009')!;
    });

    it('maps non-citizen-corporation owner kind', () =>
      expect(r.owner.kind).toBe('non-citizen-corporation'));
  });

  describe('NEXPD1 — expired dealer', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = records.get('00010010')!;
    });

    it('maps status D to expired', () => expect(r.status).toBe('expired'));
    it('has corporation owner', () => expect(r.owner.kind).toBe('corporation'));
  });
});

const TC_FIXTURES = resolve(import.meta.dirname, '..', 'fixtures', 'tc-ca');
const TC_CONFIG_PATH = resolve(import.meta.dirname, '..', 'sources', 'tc-ca.yaml');

const tcFixtureBuffer = (filename: string): Buffer =>
  readFileSync(resolve(TC_FIXTURES, 'input', filename));

let tcRecords: Map<string, Aircraft>;
let tcStats: Awaited<ReturnType<typeof translate>>['stats'];

beforeAll(async () => {
  const config = loadSourceConfig(TC_CONFIG_PATH);
  const files = new Map([
    ['carscurr', tcFixtureBuffer('carscurr.txt')],
    ['carsownr', tcFixtureBuffer('carsownr.txt')],
  ]);
  const result = await translate(config, files);
  tcRecords = result.records;
  tcStats = result.stats;
});

describe('TC-CA fixture translation', () => {
  it('translates all 10 fixture rows', () => {
    expect(tcRecords.size).toBe(10);
  });

  it('skips the Oracle footer line as a soft skip, not a failure', () => {
    expect(tcStats.failed).toBe(0);
    expect(tcStats.skipped).toBe(1);
    expect(tcStats.ok).toBe(10);
  });

  describe('AAC — vintage 3-char piston single, individual, valid', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = tcRecords.get('AAC')!;
    });

    it('uses CF- prefix for 3-char vintage marks', () => expect(r.registration).toBe('CF-AAC'));
    it('converts 24-bit binary Mode S to lowercase hex', () => expect(r.icao_hex).toBe('c00001'));
    it('has CA country', () => expect(r.country).toBe('CA'));
    it('maps Registered status to valid', () => expect(r.status).toBe('valid'));
    it('maps Aeroplane + 1 engine to fixed-wing-single-engine', () =>
      expect(r.airframe_type).toBe('fixed-wing-single-engine'));
    it('maps Piston engine category to reciprocating', () =>
      expect(r.engine.type).toBe('reciprocating'));
    it('parses YYYY/MM/DD dates to ISO format', () => {
      expect(r.certification_date).toBe('1993-05-03');
      expect(r.airworthiness_date).toBe('1993-05-03');
      expect(r.last_action_date).toBe('2002-05-17');
    });
    it('maps Individual owner kind', () => expect(r.owner.kind).toBe('individual'));
    it('drops PII (no street, postal, city)', () => {
      expect(r).not.toHaveProperty('street');
      expect(r).not.toHaveProperty('postal_code');
      expect(r.owner).not.toHaveProperty('street');
      expect(r.owner).not.toHaveProperty('postal_code');
      expect(r.owner).not.toHaveProperty('city');
    });
    it('leaves FAA-only fields null', () => {
      expect(r.icao_type_code).toBeNull();
      expect(r.category).toBeNull();
      expect(r.build_certification).toBeNull();
      expect(r.operating_environment).toBeNull();
      expect(r.year_manufactured).toBeNull();
      expect(r.cruise_speed_ktas).toBeNull();
      expect(r.engine.horsepower).toBeNull();
      expect(r.engine.thrust_lbs).toBeNull();
      expect(r.engine.model).toBeNull();
    });
    it('returns empty array for operational_classes', () =>
      expect(r.operational_classes).toEqual([]));
  });

  describe('FABC — modern 4-char piston single', () => {
    it('uses C- prefix for 4-char modern marks', () =>
      expect(tcRecords.get('FABC')?.registration).toBe('C-FABC'));
  });

  describe('GMUL — multi-engine turboprop, Entity owner', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = tcRecords.get('GMUL')!;
    });

    it('maps Aeroplane + 2 engines to fixed-wing-multi-engine', () =>
      expect(r.airframe_type).toBe('fixed-wing-multi-engine'));
    it('maps Turbo Prop engine category', () => expect(r.engine.type).toBe('turbo-prop'));
    it('maps engine count 2', () => expect(r.engine.count).toBe(2));
    it('maps Entity owner to other (TC does not distinguish corp from partnership)', () =>
      expect(r.owner.kind).toBe('other'));
  });

  describe('GHEL — helicopter (rotorcraft), turbo-shaft', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = tcRecords.get('GHEL')!;
    });
    it('maps Helicopter category to rotorcraft', () => expect(r.airframe_type).toBe('rotorcraft'));
    it('maps Turbo Shaft engine', () => expect(r.engine.type).toBe('turbo-shaft'));
  });

  describe('GLID — glider, no engine', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = tcRecords.get('GLID')!;
    });
    it('maps Glider category to glider airframe', () => expect(r.airframe_type).toBe('glider'));
    it('returns null engine type when ENGINE_CATEGORY_E is empty', () =>
      expect(r.engine.type).toBeNull());
    it('maps engine count 0', () => expect(r.engine.count).toBe(0));
  });

  describe('FBAL — balloon', () => {
    it('maps Balloon category to balloon airframe', () =>
      expect(tcRecords.get('FBAL')?.airframe_type).toBe('balloon'));
  });

  describe('FGYR — gyroplane', () => {
    it('maps Gyroplane category to gyroplane airframe', () =>
      expect(tcRecords.get('FGYR')?.airframe_type).toBe('gyroplane'));
  });

  describe('FCAN — cancelled status', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = tcRecords.get('FCAN')!;
    });
    it('maps Registration Cancelled to cancelled status', () => expect(r.status).toBe('cancelled'));
    it('preserves expiration_date when present', () =>
      expect(r.expiration_date).toBe('2018-12-31'));
  });

  describe('FEXP — expired status, Entity', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = tcRecords.get('FEXP')!;
    });
    it('maps Registration Expired to expired status', () => expect(r.status).toBe('expired'));
    it('maps Entity owner to other', () => expect(r.owner.kind).toBe('other'));
  });

  describe('FUTF — French accent in owner name (latin1 round-trip)', () => {
    it('decodes latin1 owner name to unicode', () =>
      expect(tcRecords.get('FUTF')?.owner.name).toBe('Hervé Côté'));
  });
});

describe('engine — negative and edge cases', () => {
  it('throws for unknown non-defaulted lookup value', async () => {
    const config = loadSourceConfig(CONFIG_PATH);
    const masterWithBadAirframe = Buffer.from(
      readFileSync(resolve(FIXTURES, 'input', 'MASTER.txt'), 'latin1').replace(
        /^12345,.*$/m,
        '12345,17282099,05608,17286,1979,1,JOHN DOE,,,WICHITA,KS,67201,7,173,US,20231015,19790620,14,Z,1,V,52341224,,19790620,,,,,,20261031,00001001,,,A4E294,'
      ),
      'latin1'
    );
    const files = new Map([
      ['master', masterWithBadAirframe],
      ['acftref', fixtureBuffer('ACFTREF.txt')],
      ['engine', fixtureBuffer('ENGINE.txt')],
    ]);
    const { stats } = await translate(config, files);
    expect(stats.failed).toBeGreaterThan(0);
  });

  it('defaults unknown status codes to other', async () => {
    const config = loadSourceConfig(CONFIG_PATH);
    const masterWithUnknownStatus = Buffer.from(
      readFileSync(resolve(FIXTURES, 'input', 'MASTER.txt'), 'latin1').replace(
        /^12345,.*$/m,
        '12345,17282099,05608,17286,1979,1,JOHN DOE,,,WICHITA,KS,67201,7,173,US,20231015,19790620,14,4,1,ZZZZ,52341224,,19790620,,,,,,20261031,00001001,,,A4E294,'
      ),
      'latin1'
    );
    const files = new Map([
      ['master', masterWithUnknownStatus],
      ['acftref', fixtureBuffer('ACFTREF.txt')],
      ['engine', fixtureBuffer('ENGINE.txt')],
    ]);
    const { records: r } = await translate(config, files);
    expect(r.get('00001001')?.status).toBe('other');
  });

  it('fails rows with missing source_id unless the source config allows them', async () => {
    const config = loadSourceConfig(CONFIG_PATH);
    const masterWithBlankId = Buffer.from(
      readFileSync(resolve(FIXTURES, 'input', 'MASTER.txt'), 'latin1').replace(
        /^12345,.*$/m,
        '12345,17282099,05608,17286,1979,1,JOHN DOE,,,WICHITA,KS,67201,7,173,US,20231015,19790620,14,4,1,V,52341224,,19790620,,,,,, 20261031,,,,A4E294,'
      ),
      'latin1'
    );
    const files = new Map([
      ['master', masterWithBlankId],
      ['acftref', fixtureBuffer('ACFTREF.txt')],
      ['engine', fixtureBuffer('ENGINE.txt')],
    ]);
    const { stats } = await translate(config, files);
    expect(stats.skipped).toBe(0);
    expect(stats.failed).toBe(1);
    expect(records.size).toBe(10); // original records unaffected
  });

  it('fails missing source_id rows that do not match the configured skip pattern', async () => {
    const config = loadSourceConfig(TC_CONFIG_PATH);
    const text = new TextDecoder('latin1').decode(tcFixtureBuffer('carscurr.txt'));
    const munged = text.replace(/,"AAC"$/m, ',""');
    const files = new Map([
      ['carscurr', Buffer.from(munged, 'latin1')],
      ['carsownr', tcFixtureBuffer('carsownr.txt')],
    ]);
    const { stats } = await translate(config, files);
    expect(stats.skipped).toBe(1);
    expect(stats.failed).toBe(1);
  });

  it('fails missing source_id rows that exceed the configured skip max', async () => {
    const config = loadSourceConfig(TC_CONFIG_PATH);
    const text = new TextDecoder('latin1').decode(tcFixtureBuffer('carscurr.txt'));
    const files = new Map([
      ['carscurr', Buffer.from(`${text}11 rows selected.\n`, 'latin1')],
      ['carsownr', tcFixtureBuffer('carsownr.txt')],
    ]);
    const { stats } = await translate(config, files);
    expect(stats.skipped).toBe(1);
    expect(stats.failed).toBe(1);
  });

  it('records schema validation failure (non-integer year_manufactured)', async () => {
    const config = loadSourceConfig(CONFIG_PATH);
    const modConfig = {
      ...config,
      mapping: {
        ...config.mapping,
        year_manufactured: { constant: '3.14' },
      },
    };
    const files = new Map([
      ['master', fixtureBuffer('MASTER.txt')],
      ['acftref', fixtureBuffer('ACFTREF.txt')],
      ['engine', fixtureBuffer('ENGINE.txt')],
    ]);
    const { stats } = await translate(modConfig, files);
    expect(stats.failed).toBeGreaterThan(0);
  });

  it('returns null for a compound_transform whose result is null (no default)', async () => {
    const config = loadSourceConfig(TC_CONFIG_PATH);
    const carscurrWithUnknownCategory = tcFixtureBuffer('carscurr.txt');
    // Replace AAC's category 'Aeroplane' with an unknown value 'Spaceship'
    const text = new TextDecoder('latin1').decode(carscurrWithUnknownCategory);
    const munged = text.replace(/"Aeroplane","","","Lycoming"/, '"Spaceship","","","Lycoming"');
    const buf = Buffer.from(munged, 'latin1');
    const files = new Map([
      ['carscurr', buf],
      ['carsownr', tcFixtureBuffer('carsownr.txt')],
    ]);
    const { records: r } = await translate(config, files);
    // AAC mangled to Spaceship still uses MARK="AAC" so its source_id resolves.
    // Compound returns null → airframe_type is null in canonical output.
    expect(r.get('AAC')?.airframe_type).toBeNull();
  });

  it('arr() falls back to scalar wrapping when no array_transform is configured', async () => {
    const config = loadSourceConfig(CONFIG_PATH);
    const modConfig = {
      ...config,
      mapping: {
        ...config.mapping,
        operational_classes: { field: 'STATUS CODE' },
      },
    };
    const files = new Map([
      ['master', fixtureBuffer('MASTER.txt')],
      ['acftref', fixtureBuffer('ACFTREF.txt')],
      ['engine', fixtureBuffer('ENGINE.txt')],
    ]);
    const { records: r } = await translate(modConfig, files);
    expect(r.get('00001001')?.operational_classes).toEqual(['V']);
  });
});

describe('engine — spreadsheet dispatch (parsePrimary)', () => {
  const buildOdsConfig = (): SourceConfig => ({
    id: 'synthetic-ods',
    label: 'Synthetic ODS source for dispatch test',
    country: 'NL',
    encoding: 'utf8',
    download: {
      url: 'https://example.com/x.ods',
      format: 'zip',
      entries: { register: 'register.ods' },
    },
    primary: 'register',
    delimiter: ',',
    trim_all: true,
    format: 'ods',
    joins: [],
    source_id: 'ID',
    registration: 'REG',
    mapping: {
      registration: { field: 'REG' },
      icao_hex: { constant: null },
      icao_type_code: { constant: null },
      status: { constant: 'valid' },
      country: { constant: 'NL' },
      manufacturer: { field: 'MFR' },
      model: { field: 'MODEL' },
      serial_number: { constant: null },
      year_manufactured: { constant: null },
      airframe_type: { constant: null },
      category: { constant: null },
      build_certification: { constant: null },
      airworthiness_class: { constant: null },
      operating_environment: { constant: null },
      'engine.manufacturer': { constant: null },
      'engine.model': { constant: null },
      'engine.type': { constant: null },
      'engine.count': { constant: null },
      'engine.horsepower': { constant: null },
      'engine.thrust_lbs': { constant: null },
      'owner.name': { field: 'OWNER' },
      'owner.kind': { constant: null },
      'owner.state': { constant: null },
      'owner.country': { constant: null },
      certification_date: { constant: null },
      airworthiness_date: { constant: null },
      expiration_date: { constant: null },
      last_action_date: { constant: null },
      cruise_speed_ktas: { constant: null },
    },
  });

  it('routes format: ods through parseSpreadsheet and produces canonical records', async () => {
    const buf = Buffer.from(
      await writeOds({
        sheets: [
          {
            name: 'Sheet1',
            rows: [
              ['ID', 'REG', 'MFR', 'MODEL', 'OWNER'],
              ['101', 'PH-ABC', 'CESSNA', '172', 'KLM Vliegclub'],
              ['102', 'PH-XYZ', 'PIPER', 'PA28', 'KLM Vliegclub'],
            ],
          },
        ],
      })
    );
    const config = buildOdsConfig();
    const files = new Map([['register', buf]]);

    const { records, stats } = await translate(config, files);

    expect(stats.total).toBe(2);
    expect(stats.failed).toBe(0);
    expect(records.size).toBe(2);
    const r = records.get('101');
    expect(r?.source).toBe('synthetic-ods');
    expect(r?.registration).toBe('PH-ABC');
    expect(r?.manufacturer).toBe('CESSNA');
    expect(r?.owner.name).toBe('KLM Vliegclub');
    expect(r?.country).toBe('NL');
  });

  it('selects a non-default sheet when sheet selector is set', async () => {
    const buf = Buffer.from(
      await writeOds({
        sheets: [
          {
            name: 'Ignore',
            rows: [
              ['ID', 'REG', 'MFR', 'MODEL', 'OWNER'],
              ['999', 'PH-ZZZ', 'NOPE', 'NOPE', 'NOPE'],
            ],
          },
          {
            name: 'Register',
            rows: [
              ['ID', 'REG', 'MFR', 'MODEL', 'OWNER'],
              ['200', 'PH-OK', 'CESSNA', '152', 'Real Owner'],
            ],
          },
        ],
      })
    );
    const config: SourceConfig = { ...buildOdsConfig(), sheet: 'Register' };
    const files = new Map([['register', buf]]);

    const { records } = await translate(config, files);

    expect(records.size).toBe(1);
    expect(records.get('200')?.registration).toBe('PH-OK');
    expect(records.has('999')).toBe(false);
  });
});
