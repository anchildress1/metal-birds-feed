import { describe, it, expect, beforeAll, spyOn } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TextDecoder } from 'node:util';
import { writeOds } from 'hucre/ods';
import { loadSourceConfig } from '../src/config/loader.js';
import { mapRows } from '../src/engine.js';
import type { EngineStats } from '../src/engine.js';
import type { Aircraft } from '../src/schema.js';
import type { FieldMapping, SourceConfig } from '../src/types/config.js';

const FIXTURES = resolve(import.meta.dirname, '..', 'fixtures', 'faa');
const CONFIG_PATH = resolve(import.meta.dirname, '..', 'sources', 'faa.yaml');
const DUPLICATE_JOIN_CONFIG: SourceConfig = {
  id: 'synthetic-join-duplicate',
  label: 'synthetic',
  country: 'US',
  language: 'en',
  encoding: 'utf8',
  download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
  primary: 'primary',
  delimiter: ',',
  trim_all: true,
  format: 'csv',
  joins: [{ name: 'j', file: 'jf', key: 'K', on: 'ID' }],
  source_id: 'ID',
  registration: 'REG',
  mapping: {
    registration: { field: 'REG' },
    manufacturer: { field: 'j.EXTRA', transform: 'trim_or_null' },
  },
};

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
  const result = await mapRows(config, files);
  records = result.records;
});

describe('FAA fixture mapping', () => {
  it('maps all 10 fixture rows', () => {
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

    it('defaults operator and IDERA to null when source does not publish them', () => {
      expect(r.operator).toEqual({ name: null, kind: null, state: null, country: null });
      expect(r.idera_authorised_party).toBeNull();
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
let tcStats: Awaited<ReturnType<typeof mapRows>>['stats'];

beforeAll(async () => {
  const config = loadSourceConfig(TC_CONFIG_PATH);
  const files = new Map([
    ['carscurr', tcFixtureBuffer('carscurr.txt')],
    ['carsownr', tcFixtureBuffer('carsownr.txt')],
  ]);
  const result = await mapRows(config, files);
  tcRecords = result.records;
  tcStats = result.stats;
});

describe('TC-CA fixture mapping', () => {
  it('maps all 11 fixture rows', () => {
    expect(tcRecords.size).toBe(11);
  });

  it('skips the Oracle footer line as a soft skip, not a failure', () => {
    expect(tcStats.failed).toBe(0);
    expect(tcStats.skipped).toBe(1);
    expect(tcStats.ok).toBe(11);
  });

  // carsownr carries one row per registered party. Both parties have to survive the join, and the
  // owner type each row states about itself stops being true of the mark once they share it.
  it('merges the co-owners of one mark instead of taking the first row', () => {
    const r = tcRecords.get('ABU')!;
    expect(r.owner.name).toBe('Renée Dubois, Paul Harrow');
    expect(r.owner.kind).toBe('co-owner');
    expect(r.owner.state).toBe('Ontario, Alberta');
    // Both parties state CANADA; a merge must not repeat a value every row agrees on.
    expect(r.owner.country).toBe('CANADA');
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
    it('defaults operator and IDERA to null (TC does not publish)', () => {
      expect(r.operator).toEqual({ name: null, kind: null, state: null, country: null });
      expect(r.idera_authorised_party).toBeNull();
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

const CASA_FIXTURES = resolve(import.meta.dirname, '..', 'fixtures', 'au-casa');
const CASA_CONFIG_PATH = resolve(import.meta.dirname, '..', 'sources', 'au-casa.yaml');

const casaFixtureBuffer = (filename: string): Buffer =>
  readFileSync(resolve(CASA_FIXTURES, 'input', filename));

let casaRecords: Map<string, Aircraft>;
let casaStats: EngineStats;

beforeAll(async () => {
  const config = loadSourceConfig(CASA_CONFIG_PATH);
  const files = new Map([['acrftreg', casaFixtureBuffer('acrftreg.csv')]]);
  const result = await mapRows(config, files);
  casaRecords = result.records;
  casaStats = result.stats;
});

describe('CASA fixture mapping', () => {
  it('maps all 11 fixture rows with no failures', () => {
    expect(casaStats).toEqual({ total: 11, ok: 11, failed: 0, skipped: 0, duplicateSkipped: 0 });
    expect(casaRecords.size).toBe(11);
  });

  describe('22A — Cirrus SR22, single-engine piston, valid', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = casaRecords.get('22A')!;
    });

    it('prefixes Mark with VH-', () => expect(r.registration).toBe('VH-22A'));
    it('uses source_id = Mark suffix', () => expect(r.source_id).toBe('22A'));
    it('has source au-casa and country AU', () => {
      expect(r.source).toBe('au-casa');
      expect(r.country).toBe('AU');
    });
    it('maps Full Registration to valid', () => expect(r.status).toBe('valid'));
    it('maps Power Driven Aeroplane + 1 engine to fixed-wing-single-engine', () =>
      expect(r.airframe_type).toBe('fixed-wing-single-engine'));
    it('maps Piston engine to reciprocating', () => expect(r.engine.type).toBe('reciprocating'));
    it('preserves ICAO type designator', () => expect(r.icao_type_code).toBe('SR22'));
    it('parses DD/MM/YYYY date to ISO format', () => {
      expect(r.certification_date).toBe('2026-04-15');
      expect(r.last_action_date).toBe('2026-04-15');
    });
    it('leaves CASA-not-published fields null', () => {
      expect(r.icao_hex).toBeNull();
      expect(r.airworthiness_date).toBeNull();
      expect(r.cruise_speed_ktas).toBeNull();
      expect(r.engine.horsepower).toBeNull();
      expect(r.engine.thrust_lbs).toBeNull();
      expect(r.category).toBeNull();
      expect(r.build_certification).toBeNull();
      expect(r.operating_environment).toBeNull();
      expect(r.year_manufactured).toBe(2025);
    });
    it('captures owner name and drops PII (street/suburb/postcode)', () => {
      expect(r.owner.name).toBe('CIRRUS DESIGN CORPORATION');
      expect(r.owner.kind).toBeNull();
      expect(r).not.toHaveProperty('regholdadd1');
      expect(r).not.toHaveProperty('regholdSuburb');
      expect(r).not.toHaveProperty('regholdPostcode');
    });
    it('captures operator name (same as owner here) and drops PII', () => {
      expect(r.operator.name).toBe('CIRRUS DESIGN CORPORATION');
      expect(r.operator.kind).toBeNull();
      expect(r).not.toHaveProperty('regopadd1');
      expect(r).not.toHaveProperty('regopSuburb');
    });
    it('has no IDERA party set', () => expect(r.idera_authorised_party).toBeNull());
  });

  describe('22B — Robinson R22 single-engine helicopter', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = casaRecords.get('22B')!;
    });
    it('maps Rotorcraft + 1 engine to rotorcraft', () =>
      expect(r.airframe_type).toBe('rotorcraft'));
    it('maps Piston engine to reciprocating', () => expect(r.engine.type).toBe('reciprocating'));
    it('maps single engine count', () => expect(r.engine.count).toBe(1));
  });

  describe('4QP — Bell 429, twin-turboshaft helicopter', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = casaRecords.get('4QP')!;
    });
    it('maps Rotorcraft to rotorcraft regardless of engine count', () =>
      expect(r.airframe_type).toBe('rotorcraft'));
    it('maps Turboshaft to turbo-shaft', () => expect(r.engine.type).toBe('turbo-shaft'));
    it('maps twin engine count', () => expect(r.engine.count).toBe(2));
  });

  describe('8BB — glider, no engine', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = casaRecords.get('8BB')!;
    });
    it('maps Glider airframe to glider', () => expect(r.airframe_type).toBe('glider'));
    it('maps Not Applicable engine to none', () => expect(r.engine.type).toBe('none'));
    it('nulls fake no-engine detail sentinels', () => {
      expect(r.engine.manufacturer).toBeNull();
      expect(r.engine.model).toBeNull();
    });
    it('reports zero engines', () => expect(r.engine.count).toBe(0));
  });

  describe('84D — Motor-Glider', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = casaRecords.get('84D')!;
    });
    it('maps Motor-Glider airframe to glider', () => expect(r.airframe_type).toBe('glider'));
    it('still maps the auxiliary engine type', () => expect(r.engine.type).toBe('reciprocating'));
  });

  describe('83R — Manned Free Balloon', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = casaRecords.get('83R')!;
    });
    it('maps Manned Free Balloon to balloon', () => expect(r.airframe_type).toBe('balloon'));
    it('maps no-engine balloon rows to none + null details', () => {
      expect(r.engine.type).toBe('none');
      expect(r.engine.manufacturer).toBeNull();
      expect(r.engine.model).toBeNull();
    });
    it('records owner.country=AU when regholdCountry=Australia', () =>
      expect(r.owner.country).toBe('Australia'));
  });

  describe('JRW — Airship (rare; CASA register has only one)', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = casaRecords.get('JRW')!;
    });
    it('maps Airship to blimp (closest canonical enum)', () =>
      expect(r.airframe_type).toBe('blimp'));
  });

  describe('82M — RPA - Powered Lift (drone, no canonical UAV enum)', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = casaRecords.get('82M')!;
    });
    it('returns null airframe rather than inventing one', () => expect(r.airframe_type).toBeNull());
    it('still records electric engine type for RPA', () => expect(r.engine.type).toBe('electric'));
    it('keeps ICAO type code if published', () => expect(r.icao_type_code).toBe('ZZZZ'));
  });

  describe('ALR — SUSPENDED registration status', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = casaRecords.get('ALR')!;
    });
    it('maps regType=SUSPENDED to restricted status', () => expect(r.status).toBe('restricted'));
  });

  describe('86L — Bell 429 with IDERA party set (Westpac Banking)', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = casaRecords.get('86L')!;
    });
    it('captures the IDERA authorised party verbatim', () =>
      expect(r.idera_authorised_party).toBe('WESTPAC BANKING CORPORATION'));
  });

  describe('8EA — twin turbofan, foreign-country owner (Ireland)', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = casaRecords.get('8EA')!;
    });
    it('maps Power Driven Aeroplane + 2 engines to fixed-wing-multi-engine', () =>
      expect(r.airframe_type).toBe('fixed-wing-multi-engine'));
    it('maps Turbofan to turbo-fan', () => expect(r.engine.type).toBe('turbo-fan'));
    it('records foreign owner country (Ireland)', () => expect(r.owner.country).toBe('Ireland'));
  });
});

const LV_FIXTURES = resolve(import.meta.dirname, '..', 'fixtures', 'lv-caa');
const LV_CONFIG_PATH = resolve(import.meta.dirname, '..', 'sources', 'lv-caa.yaml');

const lvFixtureBuffer = (filename: string): Buffer =>
  readFileSync(resolve(LV_FIXTURES, 'input', filename));

let lvRecords: Map<string, Aircraft>;
let lvStats: EngineStats;

beforeAll(async () => {
  const config = loadSourceConfig(LV_CONFIG_PATH);
  const files = new Map([['output', lvFixtureBuffer('output.csv')]]);
  const result = await mapRows(config, files);
  lvRecords = result.records;
  lvStats = result.stats;
});

describe('CAA Latvia fixture mapping', () => {
  it('maps all 10 fixture rows with no failures', () => {
    expect(lvStats).toEqual({ total: 10, ok: 10, failed: 0, skipped: 0, duplicateSkipped: 0 });
    expect(lvRecords.size).toBe(10);
  });

  describe('YL-001 — hot-air balloon, vintage', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = lvRecords.get('YL-001')!;
    });
    it('has correct identity', () => {
      expect(r.source).toBe('lv-caa');
      expect(r.source_id).toBe('YL-001');
      expect(r.registration).toBe('YL-001');
      expect(r.country).toBe('LV');
    });
    it('maps Balloon (hot-air) to balloon', () => expect(r.airframe_type).toBe('balloon'));
    it('parses ISO datetime with +03:00 offset to YYYY-MM-DD', () =>
      expect(r.certification_date).toBe('1995-07-31'));
    it('captures Construction_Year as int', () => expect(r.year_manufactured).toBe(1991));
    it('has status=valid (Latvia register is active-only)', () => expect(r.status).toBe('valid'));
  });

  describe('YL-AAO — Aircraft with missing Construction_Year', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = lvRecords.get('YL-AAO')!;
    });
    it('maps the engine-count-ambiguous "Aircraft" category to generic fixed-wing', () =>
      expect(r.airframe_type).toBe('fixed-wing'));
    it('leaves year_manufactured null when Construction_Year is blank', () =>
      expect(r.year_manufactured).toBeNull());
    it('still preserves model + serial', () => {
      expect(r.model).toBe('BD-500-1A11');
      expect(r.serial_number).toBe('55050');
    });
  });

  describe('YL-AAS — Aircraft category with year present', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = lvRecords.get('YL-AAS')!;
    });
    it('maps to generic fixed-wing regardless of year populated', () =>
      expect(r.airframe_type).toBe('fixed-wing'));
    it('captures year', () => expect(r.year_manufactured).toBe(2019));
  });

  describe('YL-ERA — Bell 407 helicopter', () => {
    it('maps Helicopter to rotorcraft', () =>
      expect(lvRecords.get('YL-ERA')?.airframe_type).toBe('rotorcraft'));
  });

  describe('YL-MTO — gyroplane', () => {
    it('maps Gyroplane to gyroplane', () =>
      expect(lvRecords.get('YL-MTO')?.airframe_type).toBe('gyroplane'));
    it('preserves model with parenthesized year', () =>
      expect(lvRecords.get('YL-MTO')?.model).toBe('MTOsport (2017)'));
  });

  describe('YL-ASK — unpowered glider, blank year', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = lvRecords.get('YL-ASK')!;
    });
    it('maps Glider to glider', () => expect(r.airframe_type).toBe('glider'));
    it('leaves year null when Construction_Year is blank', () =>
      expect(r.year_manufactured).toBeNull());
  });

  describe('YL-DAA — sailplane', () => {
    it('maps Sailplane to glider (canonical schema does not differentiate)', () =>
      expect(lvRecords.get('YL-DAA')?.airframe_type).toBe('glider'));
  });

  describe('YL-A01 — powered glider', () => {
    it('maps Powered glider to glider', () =>
      expect(lvRecords.get('YL-A01')?.airframe_type).toBe('glider'));
  });

  describe('YL-AGA — powered sailplanes', () => {
    it('maps Powered Sailplanes to glider', () =>
      expect(lvRecords.get('YL-AGA')?.airframe_type).toBe('glider'));
  });

  describe('YL-DBG — quoted model with embedded comma and escaped double-quotes', () => {
    it('preserves the model verbatim, including embedded quotes', () =>
      expect(lvRecords.get('YL-DBG')?.model).toBe('Powered sailplane based on L-13 "BLANIK"'));
    it('keeps year and serial intact alongside quoted model', () => {
      const r = lvRecords.get('YL-DBG')!;
      expect(r.year_manufactured).toBe(1964);
      expect(r.serial_number).toBe('173001');
    });
  });

  it('every Latvia record carries country=LV and owner.country=LV with no PII or engine data', () => {
    for (const r of lvRecords.values()) {
      expect(r.country).toBe('LV');
      expect(r.owner.country).toBe('LV');
      expect(r.owner.name).toBeNull();
      expect(r.owner.kind).toBeNull();
      expect(r.owner.state).toBeNull();
      expect(r.operator).toEqual({ name: null, kind: null, state: null, country: null });
      expect(r.engine).toEqual({
        manufacturer: null,
        model: null,
        type: null,
        count: null,
        horsepower: null,
        thrust_lbs: null,
      });
      expect(r.icao_hex).toBeNull();
      expect(r.icao_type_code).toBeNull();
      expect(r.manufacturer).toBeNull();
      expect(r.airworthiness_date).toBeNull();
      expect(r.expiration_date).toBeNull();
      expect(r.last_action_date).toBeNull();
      expect(r.idera_authorised_party).toBeNull();
    }
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
    const { stats } = await mapRows(config, files);
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
    const { records: r } = await mapRows(config, files);
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
    const { stats } = await mapRows(config, files);
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
    const { stats } = await mapRows(config, files);
    expect(stats.skipped).toBe(1);
    expect(stats.failed).toBe(1);
  });

  it('fails missing source_id rows that exceed the configured skip max', async () => {
    const config = loadSourceConfig(TC_CONFIG_PATH);
    const text = new TextDecoder('latin1').decode(tcFixtureBuffer('carscurr.txt'));
    // Full-width (46 trailing empty cells = carscurr's 47 columns): stays inside the parser's
    // allowed_ragged_rows budget so this exercises the engine's missing-id max, not the parser.
    const files = new Map([
      ['carscurr', Buffer.from(`${text}11 rows selected.${','.repeat(46)}\n`, 'latin1')],
      ['carsownr', tcFixtureBuffer('carsownr.txt')],
    ]);
    const { stats } = await mapRows(config, files);
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
    const { stats } = await mapRows(modConfig, files);
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
    const { records: r } = await mapRows(config, files);
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
    const { records: r } = await mapRows(modConfig, files);
    expect(r.get('00001001')?.operational_classes).toEqual(['V']);
  });

  it('throws when the primary file is absent from the files map', async () => {
    const config = loadSourceConfig(CONFIG_PATH);
    const files = new Map([
      ['acftref', fixtureBuffer('ACFTREF.txt')],
      ['engine', fixtureBuffer('ENGINE.txt')],
    ]);
    await expect(mapRows(config, files)).rejects.toThrow(
      'Primary file "master" not found in downloaded files'
    );
  });

  it('throws when a join file is absent from the files map', async () => {
    const config = loadSourceConfig(CONFIG_PATH);
    await expect(
      mapRows(config, new Map([['master', fixtureBuffer('MASTER.txt')]]))
    ).rejects.toThrow('Join file');
  });

  it('num() returns null when the constant value is not a number', async () => {
    const config = loadSourceConfig(CONFIG_PATH);
    const modConfig = {
      ...config,
      mapping: { ...config.mapping, year_manufactured: { constant: 'not-a-number' } },
    };
    const files = new Map([
      ['master', fixtureBuffer('MASTER.txt')],
      ['acftref', fixtureBuffer('ACFTREF.txt')],
      ['engine', fixtureBuffer('ENGINE.txt')],
    ]);
    const { records: r, stats } = await mapRows(modConfig, files);
    expect(stats.failed).toBe(0);
    expect(r.get('00001001')?.year_manufactured).toBeNull();
  });

  it('resolveCompound applies lookup to the compound-transformed result', async () => {
    const config = loadSourceConfig(TC_CONFIG_PATH);
    // TC's airframe_type uses tc_airframe compound transform but no lookup.
    // Adding a lookup exercises the resolveCompound → resolveLookup path.
    const modConfig = {
      ...config,
      mapping: {
        ...config.mapping,
        airframe_type: {
          ...config.mapping['airframe_type'],
          lookup: { 'fixed-wing-single-engine': 'fixed-wing' },
        },
      },
    };
    const files = new Map([
      ['carscurr', tcFixtureBuffer('carscurr.txt')],
      ['carsownr', tcFixtureBuffer('carsownr.txt')],
    ]);
    const { records: r } = await mapRows(modConfig, files);
    // AAC: Aeroplane + 1 engine → tc_airframe → 'fixed-wing-single-engine' → lookup → 'fixed-wing'
    expect(r.get('AAC')?.airframe_type).toBe('fixed-wing');
  });

  it('resolveLookup falls through to default for a value matching an Object.prototype key', async () => {
    const config: SourceConfig = {
      id: 'synthetic-lookup',
      label: 'synthetic',
      country: 'US',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
      primary: 'primary',
      delimiter: ',',
      trim_all: true,
      format: 'csv',
      joins: [],
      source_id: 'ID',
      registration: 'REG',
      mapping: {
        registration: { field: 'REG' },
        'owner.kind': { field: 'KIND', lookup: { individual: 'individual' }, default: null },
      },
    };
    // 'valueOf' is an inherited Object.prototype member; without hasOwn the lookup returns that
    // function, owner.kind becomes a Function, and the row fails schema validation.
    const files = new Map([['primary', Buffer.from('ID,REG,KIND\n1,N1,valueOf\n', 'utf8')]]);
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});
    try {
      const { records: r, stats } = await mapRows(config, files);
      expect(stats.failed).toBe(0);
      expect(r.get('1')?.owner.kind).toBeNull();
      // An unrecognized value silently absorbed by a declared default must still be visible in
      // the run log — otherwise a source drifting to a new/unmapped code blends into "other"
      // with zero signal, the one gap this engine's other bounded-skip mechanisms don't have.
      const logged = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(logged).toContain('event=map_lookup_default');
      expect(logged).toContain('value=valueOf');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('fails the run when a declared join matches zero rows', async () => {
    const config: SourceConfig = {
      id: 'synthetic-join-miss',
      label: 'synthetic',
      country: 'US',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
      primary: 'primary',
      delimiter: ',',
      trim_all: true,
      format: 'csv',
      joins: [{ name: 'j', file: 'jf', key: 'K', on: 'ID' }],
      source_id: 'ID',
      registration: 'REG',
      mapping: { registration: { field: 'REG' } },
    };
    // Total miss = key drift (e.g. FAA renames the ACFTREF key column). All joined fields are
    // nullable, so without this guard the fleet publishes with them silently nulled.
    const files = new Map([
      ['primary', Buffer.from('ID,REG\n1,N1\n2,N2\n', 'utf8')],
      ['jf', Buffer.from('K,EXTRA\n999,foo\n', 'utf8')],
    ]);
    await expect(mapRows(config, files)).rejects.toThrow(/join "j" matched 0 of 2 rows/i);
  });

  it('accepts a join with partial hits (occasional misses are legal)', async () => {
    const config: SourceConfig = {
      id: 'synthetic-join-partial',
      label: 'synthetic',
      country: 'US',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
      primary: 'primary',
      delimiter: ',',
      trim_all: true,
      format: 'csv',
      joins: [{ name: 'j', file: 'jf', key: 'K', on: 'ID' }],
      source_id: 'ID',
      registration: 'REG',
      mapping: {
        registration: { field: 'REG' },
        manufacturer: { field: 'j.EXTRA', transform: 'trim_or_null' },
      },
    };
    const files = new Map([
      ['primary', Buffer.from('ID,REG\n1,N1\n2,N2\n', 'utf8')],
      ['jf', Buffer.from('K,EXTRA\n1,Cessna\n', 'utf8')],
    ]);
    const { records, stats } = await mapRows(config, files);
    expect(stats.failed).toBe(0);
    expect(records.get('1')?.manufacturer).toBe('Cessna');
    expect(records.get('2')?.manufacturer).toBeNull();
  });

  it('rejects conflicting rows with the same join key', async () => {
    const files = new Map([
      ['primary', Buffer.from('ID,REG\n1,N1\n', 'utf8')],
      ['jf', Buffer.from('K,EXTRA\n1,Cessna\n1,Piper\n', 'utf8')],
    ]);

    await expect(mapRows(DUPLICATE_JOIN_CONFIG, files)).rejects.toThrow(
      'Source "synthetic-join-duplicate": join "j" has conflicting duplicate key "1"'
    );
  });

  it('accepts byte-identical rows with the same join key', async () => {
    const files = new Map([
      ['primary', Buffer.from('ID,REG\n1,N1\n', 'utf8')],
      ['jf', Buffer.from('K,EXTRA\n1,Cessna\n1,Cessna\n', 'utf8')],
    ]);

    const { records, stats } = await mapRows(DUPLICATE_JOIN_CONFIG, files);
    expect(stats.failed).toBe(0);
    expect(records.get('1')?.manufacturer).toBe('Cessna');
  });

  describe('merge_duplicates on a join', () => {
    const merging = (
      merge: NonNullable<SourceConfig['joins'][number]['merge_duplicates']>
    ): SourceConfig => ({
      ...DUPLICATE_JOIN_CONFIG,
      joins: [{ name: 'j', file: 'jf', key: 'K', on: 'ID', merge_duplicates: merge }],
      mapping: {
        registration: { field: 'REG' },
        manufacturer: { field: 'j.EXTRA', transform: 'trim_or_null' },
        model: { field: 'j.KIND', transform: 'trim_or_null' },
      },
    });
    const primary = (): [string, Buffer] => ['primary', Buffer.from('ID,REG\n1,N1\n', 'utf8')];

    it('concatenates the listed columns in file order', async () => {
      const files = new Map([
        primary(),
        ['jf', Buffer.from('K,EXTRA,KIND\n1,Cessna,a\n1,Piper,a\n', 'utf8')],
      ]);
      const { records } = await mapRows(merging({ fields: ['EXTRA', 'KIND'] }), files);
      expect(records.get('1')?.manufacturer).toBe('Cessna, Piper');
    });

    it('honours a custom separator', async () => {
      const files = new Map([
        primary(),
        ['jf', Buffer.from('K,EXTRA,KIND\n1,Cessna,a\n1,Piper,a\n', 'utf8')],
      ]);
      const config = merging({ fields: ['EXTRA', 'KIND'], separator: ' Y ' });
      const { records } = await mapRows(config, files);
      expect(records.get('1')?.manufacturer).toBe('Cessna Y Piper');
    });

    // A register that agrees with itself must not produce "CANADA, CANADA", and a party leaving a
    // column blank must not punch a stray separator into the joined value.
    it('collapses repeats and skips blanks', async () => {
      const files = new Map([
        primary(),
        ['jf', Buffer.from('K,EXTRA,KIND\n1,Cessna,a\n1,,a\n1,Cessna,a\n', 'utf8')],
      ]);
      const { records } = await mapRows(merging({ fields: ['EXTRA', 'KIND'] }), files);
      expect(records.get('1')?.manufacturer).toBe('Cessna');
    });

    // Unconditional, unlike the primary's set_on_merge: the differing per-party value is exactly
    // what says the key is shared, so there is nothing to protect from being overwritten.
    it('stamps set_on_merge columns only when a key actually merged', async () => {
      const config = merging({ fields: ['EXTRA'], set_on_merge: { KIND: 'shared' } });
      const merged = await mapRows(
        config,
        new Map([
          primary(),
          ['jf', Buffer.from('K,EXTRA,KIND\n1,Cessna,solo\n1,Piper,solo\n', 'utf8')],
        ])
      );
      expect(merged.records.get('1')?.model).toBe('shared');

      const lone = await mapRows(
        config,
        new Map([primary(), ['jf', Buffer.from('K,EXTRA,KIND\n1,Cessna,solo\n', 'utf8')]])
      );
      expect(lone.records.get('1')?.model).toBe('solo');
    });

    // The set_on_merge stamp keys off distinctness scoped to merge.fields + set_on_merge targets,
    // not the whole row: a repeated identical party (same EXTRA and KIND) is a duplicate, not
    // co-ownership; a party differing only in the set_on_merge target itself (KIND) is still a real
    // second party; and a difference confined to a column this join never maps (TC's
    // STREET_NAME/MAIL_RECIPIENT/ACTIVE_FLAG, modeled here as UNMAPPED) must not manufacture one.
    it.each([
      {
        label: 'repeated identical party',
        csv: 'K,EXTRA,KIND\n1,Cessna,solo\n1,Cessna,solo\n',
        expectedModel: 'solo',
      },
      {
        label: 'rows share merge.fields but differ in the set_on_merge target',
        csv: 'K,EXTRA,KIND\n1,Cessna,solo\n1,Cessna,co\n',
        expectedModel: 'shared',
      },
      {
        label: 'difference confined to an unmapped column',
        csv: 'K,EXTRA,KIND,UNMAPPED\n1,Cessna,solo,A\n1,Cessna,solo,I\n',
        expectedModel: 'solo',
      },
    ])('set_on_merge distinctness: $label', async ({ csv, expectedModel }) => {
      const config = merging({ fields: ['EXTRA'], set_on_merge: { KIND: 'shared' } });
      const { records } = await mapRows(
        config,
        new Map([primary(), ['jf', Buffer.from(csv, 'utf8')]])
      );
      expect(records.get('1')?.model).toBe(expectedModel);
    });

    // Each field is its own deduplicated bag, not an index-parallel array — a party missing one
    // field must not punch a blank placeholder into another field's position.
    it('drops a blank independently per field rather than aligning by party position', async () => {
      const config = merging({ fields: ['EXTRA', 'KIND'] });
      const { records } = await mapRows(
        config,
        new Map([primary(), ['jf', Buffer.from('K,EXTRA,KIND\n1,Cessna,a\n1,Piper,\n', 'utf8')]])
      );
      expect(records.get('1')?.manufacturer).toBe('Cessna, Piper');
      expect(records.get('1')?.model).toBe('a');
    });

    it('leaves a single-row key untouched', async () => {
      const files = new Map([primary(), ['jf', Buffer.from('K,EXTRA,KIND\n1,Cessna,a\n', 'utf8')]]);
      const { records } = await mapRows(merging({ fields: ['EXTRA', 'KIND'] }), files);
      expect(records.get('1')?.manufacturer).toBe('Cessna');
    });
  });

  it('skips the join-hit floor when the primary has no rows', async () => {
    const config: SourceConfig = {
      id: 'synthetic-join-empty',
      label: 'synthetic',
      country: 'US',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
      primary: 'primary',
      delimiter: ',',
      trim_all: true,
      format: 'csv',
      joins: [{ name: 'j', file: 'jf', key: 'K', on: 'ID' }],
      source_id: 'ID',
      registration: 'REG',
      mapping: { registration: { field: 'REG' } },
    };
    // Zero-record refusal lives in the writer; mapping itself must not misreport an empty
    // primary as a join failure.
    const files = new Map([
      ['primary', Buffer.from('ID,REG\n', 'utf8')],
      ['jf', Buffer.from('K,EXTRA\n1,Cessna\n', 'utf8')],
    ]);
    const { records } = await mapRows(config, files);
    expect(records.size).toBe(0);
  });

  it('fails a row with a blank registration instead of publishing an empty mark', async () => {
    const config: SourceConfig = {
      id: 'synthetic-blank-reg',
      label: 'synthetic',
      country: 'US',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
      primary: 'primary',
      delimiter: ',',
      trim_all: true,
      format: 'csv',
      joins: [],
      source_id: 'ID',
      registration: 'REG',
      mapping: { registration: { field: 'REG' } },
    };
    // A renamed/broken registration mapping nulls every mark; row count and content hash both
    // stay plausible, so the schema reject is the only guard that can catch it.
    const files = new Map([['primary', Buffer.from('ID,REG\n1,\n', 'utf8')]]);
    const { records, stats } = await mapRows(config, files);
    expect(stats.failed).toBe(1);
    expect(records.size).toBe(0);
  });

  it('fails a row whose registration is only whitespace when trim is off', async () => {
    const config: SourceConfig = {
      id: 'synthetic-ws-reg',
      label: 'synthetic',
      country: 'US',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
      primary: 'primary',
      delimiter: ',',
      trim_all: false,
      format: 'csv',
      joins: [],
      source_id: 'ID',
      registration: 'REG',
      mapping: { registration: { field: 'REG' } },
    };
    const files = new Map([['primary', Buffer.from('ID,REG\n1,"   "\n', 'utf8')]]);
    const { records, stats } = await mapRows(config, files);
    expect(stats.failed).toBe(1);
    expect(records.size).toBe(0);
  });

  it('fails rows when the mapping has no registration entry at all', async () => {
    const config: SourceConfig = {
      id: 'synthetic-no-reg-mapping',
      label: 'synthetic',
      country: 'US',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
      primary: 'primary',
      delimiter: ',',
      trim_all: true,
      format: 'csv',
      joins: [],
      source_id: 'ID',
      registration: 'REG',
      mapping: { 'owner.name': { field: 'REG' } },
    };
    const files = new Map([['primary', Buffer.from('ID,REG\n1,N1\n', 'utf8')]]);
    const { records, stats } = await mapRows(config, files);
    expect(stats.failed).toBe(1);
    expect(records.size).toBe(0);
  });

  // status is the schema's one nullable canonical field: a blank cell with no lookup default must
  // stay null, not silently default to 'other' — coercing an unstated status to a concrete value
  // would invent data the register never published.
  it('leaves status null for a blank cell with no lookup default', async () => {
    const config: SourceConfig = {
      id: 'synthetic-blank-status',
      label: 'synthetic',
      country: 'US',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
      primary: 'primary',
      delimiter: ',',
      trim_all: true,
      format: 'csv',
      joins: [],
      source_id: 'ID',
      registration: 'REG',
      mapping: {
        registration: { field: 'REG' },
        status: { field: 'STATUS', lookup: { cancelled: 'cancelled', valid: 'valid' } },
      },
    };
    const files = new Map([['primary', Buffer.from('ID,REG,STATUS\n1,N1,\n', 'utf8')]]);
    const { records, stats } = await mapRows(config, files);
    expect(stats.failed).toBe(0);
    expect(records.get('1')?.status).toBeNull();
  });

  // A mapping-level default exists to absorb a genuinely unrecognized code (AU/FAA/NL/TC all
  // enumerate many but not all status values) — it must not also catch a blank cell, which states
  // nothing at all. A blank stays null regardless of the default; a stated-but-unmapped code still
  // uses it.
  it.each([
    { label: 'blank cell', status: '', expected: null },
    { label: 'unrecognized code', status: 'weird', expected: 'other' },
  ])('resolves status with a mapping default: $label', async ({ status, expected }) => {
    const config: SourceConfig = {
      id: 'synthetic-status-default',
      label: 'synthetic',
      country: 'US',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
      primary: 'primary',
      delimiter: ',',
      trim_all: true,
      format: 'csv',
      joins: [],
      source_id: 'ID',
      registration: 'REG',
      mapping: {
        registration: { field: 'REG' },
        status: {
          field: 'STATUS',
          transform: 'trim_or_null',
          lookup: { cancelled: 'cancelled', valid: 'valid' },
          default: 'other',
        },
      },
    };
    const files = new Map([['primary', Buffer.from(`ID,REG,STATUS\n1,N1,${status}\n`, 'utf8')]]);
    const { records, stats } = await mapRows(config, files);
    expect(stats.failed).toBe(0);
    expect(records.get('1')?.status).toBe(expected);
  });

  it('replaces a cancelled duplicate with a live reissue', async () => {
    const config: SourceConfig = {
      id: 'synthetic-dup-status',
      label: 'synthetic',
      country: 'US',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
      primary: 'primary',
      delimiter: ',',
      trim_all: true,
      format: 'csv',
      joins: [],
      source_id: 'ID',
      registration: 'REG',
      mapping: {
        registration: { field: 'REG' },
        status: { field: 'STATUS', lookup: { cancelled: 'cancelled', valid: 'valid' } },
      },
    };
    const files = new Map([
      ['primary', Buffer.from('ID,REG,STATUS\n1,N1,cancelled\n1,N2,valid\n', 'utf8')],
    ]);
    const { records, stats } = await mapRows(config, files);
    expect(stats.failed).toBe(0);
    expect(records.size).toBe(1);
    expect(records.get('1')?.registration).toBe('N2');
  });

  it('keeps a live record over a later cancelled duplicate (order-independent)', async () => {
    const config: SourceConfig = {
      id: 'synthetic-dup-status-reversed',
      label: 'synthetic',
      country: 'US',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
      primary: 'primary',
      delimiter: ',',
      trim_all: true,
      format: 'csv',
      joins: [],
      source_id: 'ID',
      registration: 'REG',
      mapping: {
        registration: { field: 'REG' },
        status: { field: 'STATUS', lookup: { cancelled: 'cancelled', valid: 'valid' } },
      },
    };
    // Cancelled row is later in the file, but a cancellation must never outrank a live record.
    const files = new Map([
      ['primary', Buffer.from('ID,REG,STATUS\n1,N1,valid\n1,N2,cancelled\n', 'utf8')],
    ]);
    const { records, stats } = await mapRows(config, files);
    expect(stats.failed).toBe(0);
    expect(records.size).toBe(1);
    expect(records.get('1')?.registration).toBe('N1');
  });

  it('replaces a duplicate with the row that has the more recent known date', async () => {
    const config: SourceConfig = {
      id: 'synthetic-dup-date',
      label: 'synthetic',
      country: 'US',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
      primary: 'primary',
      delimiter: ',',
      trim_all: true,
      format: 'csv',
      joins: [],
      source_id: 'ID',
      registration: 'REG',
      mapping: {
        registration: { field: 'REG' },
        certification_date: { field: 'CERT' },
        last_action_date: { field: 'ACTION' },
      },
    };
    // Each row has two known dates, so picking the "latest known date" must compare within a
    // record as well as across records. Older pair is listed second (file order can't be trusted).
    const files = new Map([
      [
        'primary',
        Buffer.from(
          'ID,REG,CERT,ACTION\n1,N1,2021-06-01,2019-01-01\n1,N2,2020-01-01,2018-01-01\n',
          'utf8'
        ),
      ],
    ]);
    const { records, stats } = await mapRows(config, files);
    expect(stats.failed).toBe(0);
    expect(records.size).toBe(1);
    expect(records.get('1')?.registration).toBe('N1');
  });

  it('replaces the incumbent when a later file row has the newer date', async () => {
    const config: SourceConfig = {
      id: 'synthetic-dup-date-replace',
      label: 'synthetic',
      country: 'US',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
      primary: 'primary',
      delimiter: ',',
      trim_all: true,
      format: 'csv',
      joins: [],
      source_id: 'ID',
      registration: 'REG',
      mapping: {
        registration: { field: 'REG' },
        last_action_date: { field: 'ACTION' },
      },
    };
    // Mirror of the test above with the newer date second in the file, so the "candidate is
    // actually newer" branch of resolveRecency (not just "candidate loses") gets exercised.
    const files = new Map([
      ['primary', Buffer.from('ID,REG,ACTION\n1,N1,2018-01-01\n1,N2,2021-06-01\n', 'utf8')],
    ]);
    const { records, stats } = await mapRows(config, files);
    expect(stats.failed).toBe(0);
    expect(records.size).toBe(1);
    expect(records.get('1')?.registration).toBe('N2');
  });

  it('keeps a live record over a cancelled duplicate even when the cancelled row is newer', async () => {
    const config: SourceConfig = {
      id: 'synthetic-dup-status-beats-date',
      label: 'synthetic',
      country: 'US',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
      primary: 'primary',
      delimiter: ',',
      trim_all: true,
      format: 'csv',
      joins: [],
      source_id: 'ID',
      registration: 'REG',
      mapping: {
        registration: { field: 'REG' },
        status: { field: 'STATUS', lookup: { cancelled: 'cancelled', valid: 'valid' } },
        last_action_date: { field: 'ACTION' },
      },
    };
    // The cancelled row has a materially newer date, but status is checked before date — a
    // cancellation must never outrank a live record regardless of recency.
    const files = new Map([
      [
        'primary',
        Buffer.from(
          'ID,REG,STATUS,ACTION\n1,N1,valid,2018-01-01\n1,N2,cancelled,2024-01-01\n',
          'utf8'
        ),
      ],
    ]);
    const { records, stats } = await mapRows(config, files);
    expect(stats.failed).toBe(0);
    expect(records.size).toBe(1);
    expect(records.get('1')?.registration).toBe('N1');
  });

  it('resolves a duplicate by date when only one row has a known date', async () => {
    const config: SourceConfig = {
      id: 'synthetic-dup-date-asymmetric',
      label: 'synthetic',
      country: 'US',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
      primary: 'primary',
      delimiter: ',',
      trim_all: true,
      format: 'csv',
      joins: [],
      source_id: 'ID',
      registration: 'REG',
      mapping: {
        registration: { field: 'REG' },
        last_action_date: { field: 'ACTION' },
      },
    };
    // Row 1 has no known date at all (blank ACTION); row 2 has one. A known date must beat an
    // absent one regardless of file order.
    const files = new Map([
      ['primary', Buffer.from('ID,REG,ACTION\n1,N1,\n1,N2,2020-01-01\n', 'utf8')],
    ]);
    const { records, stats } = await mapRows(config, files);
    expect(stats.failed).toBe(0);
    expect(records.size).toBe(1);
    expect(records.get('1')?.registration).toBe('N2');
  });

  it('skips a byte-identical duplicate row instead of failing', async () => {
    const config: SourceConfig = {
      id: 'synthetic-dup-identical',
      label: 'synthetic',
      country: 'US',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
      primary: 'primary',
      delimiter: ',',
      trim_all: true,
      format: 'csv',
      joins: [],
      source_id: 'ID',
      registration: 'REG',
      mapping: { registration: { field: 'REG' } },
    };
    const files = new Map([['primary', Buffer.from('ID,REG\n1,N1\n1,N1\n', 'utf8')]]);
    const { records, stats } = await mapRows(config, files);
    expect(stats.failed).toBe(0);
    expect(stats.skipped).toBe(1);
    expect(records.size).toBe(1);
    expect(records.get('1')?.registration).toBe('N1');
  });

  // A null status is unknown, not evidence the record is live — it must not automatically outrank
  // an explicitly cancelled duplicate the way two concretely-known, disagreeing statuses would.
  it('does not let a null-status duplicate automatically outrank an explicitly cancelled one', async () => {
    const config: SourceConfig = {
      id: 'synthetic-dup-status-null',
      label: 'synthetic',
      country: 'US',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
      primary: 'primary',
      delimiter: ',',
      trim_all: true,
      format: 'csv',
      joins: [],
      source_id: 'ID',
      registration: 'REG',
      mapping: {
        registration: { field: 'REG' },
        status: { field: 'STATUS', lookup: { cancelled: 'cancelled', valid: 'valid' } },
      },
    };
    // REG differs, so the two records genuinely disagree; STATUS is blank (-> null) on the second
    // row. With no date signal and neither a strict superset of the other, this must fail as an
    // ambiguous collision — not silently let the unknown-status row replace the cancelled one.
    const files = new Map([
      ['primary', Buffer.from('ID,REG,STATUS\n1,N1,cancelled\n1,N2,\n', 'utf8')],
    ]);
    const { records, stats, retryable } = await mapRows(config, files);
    expect(stats.failed).toBe(1);
    expect(records.get('1')?.registration).toBe('N1');
    // A fresh download can resolve this on its own (a later publish may add the missing status or
    // date signal) — not a config bug, so the caller should retry rather than fail immediately.
    expect(retryable).toBe(true);
  });

  it('fails a duplicate source_id with no distinguishing signal', async () => {
    const config: SourceConfig = {
      id: 'synthetic-dup-unmapped',
      label: 'synthetic',
      country: 'US',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
      primary: 'primary',
      delimiter: ',',
      trim_all: true,
      format: 'csv',
      joins: [],
      source_id: 'ID',
      registration: 'REG',
      mapping: { registration: { field: 'REG' } },
    };
    // REG differs, so the canonical records genuinely disagree. With no status or date signal to
    // tell them apart, this isn't a reissue — it's an ambiguous id collision, and guessing via
    // file order would silently drop upstream data. It must fail, not guess.
    const files = new Map([['primary', Buffer.from('ID,REG\n1,N1\n1,N2\n', 'utf8')]]);
    const { records, stats, retryable } = await mapRows(config, files);
    expect(stats.failed).toBe(1);
    // The first row still succeeded before the second one collided with it.
    expect(records.size).toBe(1);
    expect(retryable).toBe(true);
  });

  it('is not retryable when an ambiguous duplicate is mixed with a deterministic failure', async () => {
    const config: SourceConfig = {
      id: 'synthetic-dup-mixed',
      label: 'synthetic',
      country: 'US',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
      primary: 'primary',
      delimiter: ',',
      trim_all: true,
      format: 'csv',
      joins: [],
      source_id: 'ID',
      registration: 'REG',
      mapping: { registration: { field: 'REG' } },
    };
    // Row 3 has no ID at all — a deterministic, config-level failure — alongside the same
    // ambiguous id=1 collision as above. One retryable failure plus one that isn't must not retry:
    // a fresh download can't fix the missing-id row, so retrying would only burn a download.
    const files = new Map([['primary', Buffer.from('ID,REG\n1,N1\n1,N2\n,N3\n', 'utf8')]]);
    const { stats, retryable } = await mapRows(config, files);
    expect(stats.failed).toBe(2);
    expect(retryable).toBe(false);
  });

  it('replaces a duplicate with the more complete record when status and dates tie', async () => {
    const config: SourceConfig = {
      id: 'synthetic-dup-completeness',
      label: 'synthetic',
      country: 'US',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
      primary: 'primary',
      delimiter: ',',
      trim_all: true,
      format: 'csv',
      joins: [],
      source_id: 'ID',
      registration: 'REG',
      mapping: { registration: { field: 'REG' }, 'owner.state': { field: 'ST' } },
    };
    // Same mark, same (absent) status and dates — the only signal is completeness. Mirrors ANAC's
    // PSORO: one row leaves owner.state undisclosed, the other populates it. The richer row must win
    // rather than the collision failing. Sparse row first so the "candidate is richer" branch runs.
    const files = new Map([['primary', Buffer.from('ID,REG,ST\n1,N1,\n1,N1,CA\n', 'utf8')]]);
    const { records, stats } = await mapRows(config, files);
    expect(stats.failed).toBe(0);
    expect(records.size).toBe(1);
    expect(records.get('1')?.owner.state).toBe('CA');
  });

  // One shape for every compound-status case; only the lookup/default overrides differ.
  const compoundStatusConfig = (id: string, statusExtras: Partial<FieldMapping>): SourceConfig => ({
    id,
    label: 'synthetic',
    country: 'BR',
    language: 'en',
    encoding: 'utf8',
    download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
    primary: 'primary',
    delimiter: ',',
    trim_all: true,
    format: 'csv',
    joins: [],
    source_id: 'ID',
    registration: 'REG',
    mapping: {
      registration: { field: 'REG' },
      status: {
        fields: ['DT_CANC', 'CD_INTERDICAO'],
        compound_transform: 'br_status',
        ...statusExtras,
      },
    },
  });

  // The contract that separates resolveStatusCompound from resolveCompound: a compound status
  // transform returning null means the register stated nothing, so `default` must not fire. On
  // status alone, null carries feed-exclusion meaning no published code could express.
  it('keeps a null compound status null rather than falling to default', async () => {
    // Both source columns blank — br_status returns null, and `default: 'other'` must not apply.
    const files = new Map([
      ['primary', Buffer.from('ID,REG,DT_CANC,CD_INTERDICAO\n1,PPAAA,,\n', 'utf8')],
    ]);
    const { records, stats } = await mapRows(
      compoundStatusConfig('synthetic-compound-status-null', { default: 'other' }),
      files
    );
    expect(stats.failed).toBe(0);
    expect(records.get('1')?.status).toBeNull();
  });

  // The lookup branch: a compound transform's output is still subject to the mapping's own lookup,
  // so a register whose vocabulary differs from the canonical enum can route through both.
  it('runs a compound status result through the mapping lookup', async () => {
    const files = new Map([
      ['primary', Buffer.from('ID,REG,DT_CANC,CD_INTERDICAO\n1,PPAAA,,R\n', 'utf8')],
    ]);
    const { records } = await mapRows(
      compoundStatusConfig('synthetic-compound-status-lookup', {
        lookup: { reserved: 'other' },
      }),
      files
    );
    expect(records.get('1')?.status).toBe('other');
  });

  // An unmatched lookup value is the only place `default` legitimately fires on a compound status:
  // the register stated something, the mapping just does not recognize it yet.
  it('falls a compound status to default when the lookup does not match', async () => {
    const files = new Map([
      ['primary', Buffer.from('ID,REG,DT_CANC,CD_INTERDICAO\n1,PPAAA,,R\n', 'utf8')],
    ]);
    const { records } = await mapRows(
      compoundStatusConfig('synthetic-compound-status-lookup-default', {
        lookup: { cancelled: 'cancelled' },
        default: 'other',
      }),
      files
    );
    expect(records.get('1')?.status).toBe('other');
  });

  // Same mapping, non-blank cell: the transform's value wins and `default` still stays out of it.
  it('uses the compound status value when the register does state one', async () => {
    const files = new Map([
      ['primary', Buffer.from('ID,REG,DT_CANC,CD_INTERDICAO\n1,PPAAA,,R\n', 'utf8')],
    ]);
    const { records } = await mapRows(
      compoundStatusConfig('synthetic-compound-status-value', { default: 'other' }),
      files
    );
    expect(records.get('1')?.status).toBe('reserved');
  });

  it('keeps the more complete incumbent over a sparser duplicate (order-independent)', async () => {
    const config: SourceConfig = {
      id: 'synthetic-dup-completeness-reverse',
      label: 'synthetic',
      country: 'US',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
      primary: 'primary',
      delimiter: ',',
      trim_all: true,
      format: 'csv',
      joins: [],
      source_id: 'ID',
      registration: 'REG',
      mapping: { registration: { field: 'REG' }, 'owner.state': { field: 'ST' } },
    };
    // Richer row first: the sparser candidate must not overwrite it. Completeness resolution is
    // independent of file order, exactly like the status and date tiebreaks above it.
    const files = new Map([['primary', Buffer.from('ID,REG,ST\n1,N1,CA\n1,N1,\n', 'utf8')]]);
    const { records, stats } = await mapRows(config, files);
    expect(stats.failed).toBe(0);
    expect(records.size).toBe(1);
    expect(records.get('1')?.owner.state).toBe('CA');
  });

  it.each([
    {
      label: 'richer conflicting row first',
      rows: '1,N1,Alice,CA\n1,N1,Bob,\n',
      owner: 'Alice',
    },
    {
      label: 'richer conflicting row second',
      rows: '1,N1,Bob,\n1,N1,Alice,CA\n',
      owner: 'Bob',
    },
  ])('fails unequal-completeness duplicates with conflicting values: $label', async (input) => {
    const config: SourceConfig = {
      id: 'synthetic-dup-completeness-conflict',
      label: 'synthetic',
      country: 'US',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
      primary: 'primary',
      delimiter: ',',
      trim_all: true,
      format: 'csv',
      joins: [],
      source_id: 'ID',
      registration: 'REG',
      mapping: {
        registration: { field: 'REG' },
        'owner.name': { field: 'NAME' },
        'owner.state': { field: 'ST' },
      },
    };
    const files = new Map([['primary', Buffer.from(`ID,REG,NAME,ST\n${input.rows}`, 'utf8')]]);

    const { records, stats } = await mapRows(config, files);

    expect(stats.failed).toBe(1);
    expect(stats.duplicateSkipped).toBe(0);
    expect(records.size).toBe(1);
    expect(records.get('1')?.owner.name).toBe(input.owner);
  });

  it('skips a duplicate whose canonical record matches despite differing raw fields', async () => {
    const config: SourceConfig = {
      id: 'synthetic-dup-canonical-match',
      label: 'synthetic',
      country: 'US',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
      primary: 'primary',
      delimiter: ',',
      trim_all: true,
      format: 'csv',
      joins: [],
      source_id: 'ID',
      registration: 'REG',
      mapping: { registration: { field: 'REG' } },
    };
    // EXTRA is not mapped, so both rows produce identical canonical records even though the raw
    // rows differ (mirrors ANAC's RAB: a nested field the mapping never reads changes between
    // publishes). The raw-row exact-dup check misses this since EXTRA differs; the canonical
    // check must catch it instead of falling through to a spurious "no distinguishing signal"
    // failure — there is nothing ambiguous about two rows that map to the same output.
    const files = new Map([['primary', Buffer.from('ID,REG,EXTRA\n1,N1,a\n1,N1,b\n', 'utf8')]]);
    const { records, stats } = await mapRows(config, files);
    expect(stats.failed).toBe(0);
    expect(stats.skipped).toBe(1);
    expect(records.size).toBe(1);
    expect(records.get('1')?.registration).toBe('N1');
  });

  it('does not let duplicate skips consume the missing-source_id budget', async () => {
    const config: SourceConfig = {
      id: 'synthetic-dup-budget',
      label: 'synthetic',
      country: 'US',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.zip', format: 'zip', entries: { primary: 'p.csv' } },
      primary: 'primary',
      delimiter: ',',
      trim_all: true,
      format: 'csv',
      joins: [],
      source_id: 'ID',
      registration: 'REG',
      allowed_missing_source_id_rows: { max: 1, field: 'KIND', pattern: '^banner$' },
      mapping: { registration: { field: 'REG' } },
    };
    // Row 2 is an exact duplicate (skipped); row 3 is the single allowed missing-id banner row.
    // The duplicate skip must not eat the missing-id budget, so the banner row is still allowed.
    const files = new Map([
      ['primary', Buffer.from('ID,REG,KIND\n1,N1,x\n1,N1,x\n,N3,banner\n', 'utf8')],
    ]);
    const { records, stats } = await mapRows(config, files);
    expect(stats.failed).toBe(0);
    expect(stats.skipped).toBe(2); // 1 duplicate + 1 missing-id
    expect(records.size).toBe(1);
  });
});

describe('engine — spreadsheet dispatch (parsePrimary)', () => {
  const buildOdsConfig = (): SourceConfig => ({
    id: 'synthetic-ods',
    label: 'Synthetic ODS source for dispatch test',
    country: 'NL',
    language: 'en',
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

    const { records, stats } = await mapRows(config, files);

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

  it('skips the ILT-style banner row via source_id_transform + allowed_missing_source_id_rows', async () => {
    const buf = Buffer.from(
      await writeOds({
        sheets: [
          {
            name: 'Sheet1',
            rows: [
              ['ID', 'REG', 'MFR', 'MODEL', 'OWNER'],
              ['1', 'Information', 'Banner row', 'Banner row', 'Banner row'],
              ['200', 'PH-OK', 'CESSNA', '152', 'Real Owner'],
            ],
          },
        ],
      })
    );
    const config: SourceConfig = {
      ...buildOdsConfig(),
      source_id: 'REG',
      source_id_transform: 'nl_ilt_registration_or_null',
      allowed_missing_source_id_rows: { max: 1, field: 'REG', pattern: '^Information$' },
    };
    const files = new Map([['register', buf]]);

    const { records, stats } = await mapRows(config, files);

    expect(stats.skipped).toBe(1);
    expect(stats.failed).toBe(0);
    expect(records.size).toBe(1);
    expect(records.get('PH-OK')?.registration).toBe('PH-OK');
  });

  describe('NL ILT fixture mapping', () => {
    const NL_CONFIG_PATH = resolve(import.meta.dirname, '..', 'sources', 'nl-ilt.yaml');
    const NL_FIXTURE = resolve(
      import.meta.dirname,
      '..',
      'fixtures',
      'nl-ilt',
      'input',
      'luchtvaartuigregister.ods'
    );

    let nlRecords: Map<string, Aircraft>;
    let nlStats: EngineStats;

    beforeAll(async () => {
      const config = loadSourceConfig(NL_CONFIG_PATH);
      const buf = readFileSync(NL_FIXTURE);
      const result = await mapRows(config, new Map([['register', buf]]));
      nlRecords = result.records;
      nlStats = result.stats;
    });

    it('skips the "Information" banner row and maps 8 aircraft', () => {
      expect(nlStats).toEqual({ total: 9, ok: 8, failed: 0, skipped: 1, duplicateSkipped: 0 });
      expect(nlRecords.size).toBe(8);
    });

    it('PH-ABA — Reims FR182, single-engine piston, valid', () => {
      const r = nlRecords.get('PH-ABA')!;
      expect(r.source_id).toBe('PH-ABA');
      expect(r.registration).toBe('PH-ABA');
      expect(r.icao_hex).toBe('4863df');
      expect(r.icao_type_code).toBe('C82R');
      expect(r.status).toBe('valid');
      expect(r.country).toBe('NL');
      expect(r.manufacturer).toBe('Reims Aviation S.A.');
      expect(r.model).toBe('FR182');
      expect(r.serial_number).toBe('FR18200052');
      expect(r.year_manufactured).toBe(1980);
      expect(r.airframe_type).toBe('fixed-wing-single-engine');
      expect(r.engine.manufacturer).toBe('AVCO Corporation, Lycoming Division');
      expect(r.engine.model).toBe('O-540-J3C5D');
      expect(r.engine.type).toBe('reciprocating');
      expect(r.engine.count).toBe(1);
      expect(r.airworthiness_class).toBe('ARC 15C');
      expect(r.certification_date).toBe('2021-05-27');
      expect(r.airworthiness_date).toBe('2025-05-23');
      expect(r.expiration_date).toBe('2026-05-26');
      expect(r.last_action_date).toBe('2022-04-22');
      expect(r.operator).toEqual({ name: null, kind: null, state: null, country: null });
      expect(r.idera_authorised_party).toBeNull();
    });

    it('PH-AKA — Airbus A330, two turbofans, large aeroplane', () => {
      const r = nlRecords.get('PH-AKA')!;
      expect(r.icao_hex).toBe('484f71');
      expect(r.icao_type_code).toBe('A333');
      expect(r.airframe_type).toBe('fixed-wing-multi-engine');
      expect(r.engine.type).toBe('turbo-fan');
      expect(r.engine.count).toBe(2);
      expect(r.year_manufactured).toBe(2012);
    });

    it('PH-80 — Sailplane mapped to glider with no engine', () => {
      const r = nlRecords.get('PH-80')!;
      expect(r.airframe_type).toBe('glider');
      expect(r.engine.type).toBeNull();
      expect(r.engine.count).toBeNull();
      expect(r.engine.manufacturer).toBeNull();
      expect(r.icao_type_code).toBe('GLID');
      // Latin-1 quotes and accents survive UTF-8 round-trip from .ods.
      expect(r.model).toBe('Go 3 "Minimoa"');
    });

    it('PH-AAA — Cameron balloon, no engine', () => {
      const r = nlRecords.get('PH-AAA')!;
      expect(r.airframe_type).toBe('balloon');
      expect(r.icao_type_code).toBe('BALL');
      expect(r.engine.count).toBeNull();
    });

    it('PH-1DA — DJI Mavic 3 drone, airframe_type null (no UAV in canonical schema)', () => {
      const r = nlRecords.get('PH-1DA')!;
      expect(r.airframe_type).toBeNull();
      expect(r.engine.type).toBe('electric');
      expect(r.engine.count).toBe(4);
      expect(r.icao_type_code).toBe('VFHC');
    });

    it('PH-AAI — Airbus AS 350 helicopter, turbo-shaft', () => {
      const r = nlRecords.get('PH-AAI')!;
      expect(r.airframe_type).toBe('rotorcraft');
      expect(r.engine.type).toBe('turbo-shaft');
      expect(r.engine.count).toBe(1);
      expect(r.icao_type_code).toBe('AS50');
    });

    it('PH-2OP — deregistered drone, status cancelled with all dates null', () => {
      const r = nlRecords.get('PH-2OP')!;
      expect(r.status).toBe('cancelled');
      expect(r.icao_hex).toBeNull();
      expect(r.icao_type_code).toBeNull();
      expect(r.year_manufactured).toBeNull();
      expect(r.certification_date).toBeNull();
      expect(r.airworthiness_date).toBeNull();
      expect(r.expiration_date).toBeNull();
    });

    it('every NL ILT record carries country=NL and owner.country=NL with no PII', () => {
      for (const r of nlRecords.values()) {
        expect(r.country).toBe('NL');
        expect(r.owner.country).toBe('NL');
        expect(r.owner.name).toBeNull();
        expect(r.owner.kind).toBeNull();
        expect(r.owner.state).toBeNull();
      }
    });
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

    const { records } = await mapRows(config, files);

    expect(records.size).toBe(1);
    expect(records.get('200')?.registration).toBe('PH-OK');
    expect(records.has('999')).toBe(false);
  });
});

const TW_FIXTURES = resolve(import.meta.dirname, '..', 'fixtures', 'tw-caa');
const TW_CONFIG_PATH = resolve(import.meta.dirname, '..', 'sources', 'tw-caa.yaml');

const twFixtureBuffer = (filename: string): Buffer =>
  readFileSync(resolve(TW_FIXTURES, 'input', filename));

describe('CAA Taiwan fixture mapping (binary .xls)', () => {
  let twRecords: Map<string, Aircraft>;
  let twStats: EngineStats;

  beforeAll(async () => {
    const config = loadSourceConfig(TW_CONFIG_PATH);
    const files = new Map([['register', twFixtureBuffer('register.xls')]]);
    const result = await mapRows(config, files);
    twRecords = result.records;
    twStats = result.stats;
  });
  it('maps 6 aircraft and skips the 6 subtotal/total rows', () => {
    expect(twStats).toEqual({ total: 12, ok: 6, failed: 0, skipped: 6, duplicateSkipped: 0 });
    expect(twRecords.size).toBe(6);
  });

  describe('B-00101 — first aircraft, CAA-operated', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = twRecords.get('B-00101')!;
    });
    it('has correct identity', () => {
      expect(r.source).toBe('tw-caa');
      expect(r.source_id).toBe('B-00101');
      expect(r.registration).toBe('B-00101');
      expect(r.country).toBe('TW');
    });
    it('has status=valid (register is a current-fleet snapshot)', () =>
      expect(r.status).toBe('valid'));
    it('carries the full free-text model string', () => expect(r.model).toBe('HBC BEECH 350'));
    it('leaves manufacturer null (not separable from model)', () =>
      expect(r.manufacturer).toBeNull());
    it('extracts year_manufactured from the Excel serial date', () =>
      expect(r.year_manufactured).toBe(2011));
    it('maps 航空公司 to operator with country=TW and leaves owner null', () => {
      expect(r.operator.name).toBe('民航局');
      expect(r.operator.country).toBe('TW');
      expect(r.owner).toEqual({ name: null, kind: null, state: null, country: null });
    });
  });

  describe('B-18001 / B-18002 — China Airlines 777s', () => {
    it('maps both to the same operator with their own manufacture years', () => {
      expect(twRecords.get('B-18001')?.operator.name).toBe('中華航空');
      expect(twRecords.get('B-18001')?.year_manufactured).toBe(2015);
      expect(twRecords.get('B-18002')?.year_manufactured).toBe(2015);
    });
  });

  describe('B-16701 — EVA Air 777', () => {
    it('maps operator and year', () => {
      expect(twRecords.get('B-16701')?.operator.name).toBe('長榮航空');
      expect(twRecords.get('B-16701')?.year_manufactured).toBe(2012);
    });
  });

  describe('B-58201 — aircraft with a blank manufacture date', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = twRecords.get('B-58201')!;
    });
    it('leaves year_manufactured null when 出廠日期 is blank', () =>
      expect(r.year_manufactured).toBeNull());
    it('still records operator and model', () => {
      expect(r.operator.name).toBe('星宇航空');
      expect(r.model).toBe('A321neo');
    });
  });

  describe('B-94520 — recent balloon', () => {
    it('extracts the manufacture year from the serial', () =>
      expect(twRecords.get('B-94520')?.year_manufactured).toBe(2024));
  });

  it('does not leak subtotal (小計) or grand-total (總計) rows as records', () => {
    expect(twRecords.has('小計')).toBe(false);
    expect(twRecords.has('總計')).toBe(false);
    expect(twRecords.has('')).toBe(false);
  });

  it('every Taiwan record carries country=TW, operator.country=TW, null owner, and no engine data', () => {
    for (const r of twRecords.values()) {
      expect(r.country).toBe('TW');
      expect(r.operator.country).toBe('TW');
      expect(r.owner).toEqual({ name: null, kind: null, state: null, country: null });
      expect(r.engine).toEqual({
        manufacturer: null,
        model: null,
        type: null,
        count: null,
        horsepower: null,
        thrust_lbs: null,
      });
    }
  });
});

const BR_FIXTURES = resolve(import.meta.dirname, '..', 'fixtures', 'br-anac');
const BR_CONFIG_PATH = resolve(import.meta.dirname, '..', 'sources', 'br-anac.yaml');

function brBuffer(filename: string): Buffer {
  return readFileSync(resolve(BR_FIXTURES, 'input', filename));
}

let brRecords: Map<string, Aircraft>;
let brStats: EngineStats;

beforeAll(async () => {
  const config = loadSourceConfig(BR_CONFIG_PATH);
  const files = new Map([['aircraft', brBuffer('dados_aeronaves.csv')]]);
  const result = await mapRows(config, files);
  brRecords = result.records;
  brStats = result.stats;
});

describe('BR-ANAC fixture mapping', () => {
  it('maps all 9 fixture rows with no failures (banner row skipped)', () => {
    expect(brStats).toEqual({ total: 9, ok: 9, failed: 0, skipped: 0, duplicateSkipped: 0 });
    expect(brRecords.size).toBe(9);
  });

  describe('PPJPG — single-engine piston, individual owner, valid', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = brRecords.get('PPJPG')!;
    });
    it('hyphenates the registration mark', () => expect(r.registration).toBe('PP-JPG'));
    it('uses the bare mark as source_id', () => expect(r.source_id).toBe('PPJPG'));
    it('is valid (no cancellation date)', () => expect(r.status).toBe('valid'));
    it('classifies a landplane single as fixed-wing-single-engine', () =>
      expect(r.airframe_type).toBe('fixed-wing-single-engine'));
    it('maps MOTOR CONVENCIONAL to reciprocating', () =>
      expect(r.engine.type).toBe('reciprocating'));
    it('derives individual from a masked CPF', () => {
      expect(r.owner.kind).toBe('individual');
      expect(r.owner.name).toBe('JONAS GONCALVES');
      expect(r.owner.state).toBe('MT');
      expect(r.owner.country).toBe('BR');
    });
    it('parses the DT_MATRICULA ISO datetime to a plain date', () =>
      expect(r.certification_date).toBe('2012-03-29'));
    it('parses the DDMMYYYY airworthiness validity into expiration_date', () =>
      expect(r.expiration_date).toBe('2026-08-18'));
  });

  describe('PPACP — twin turbofan, corporate owner, transport category', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = brRecords.get('PPACP')!;
    });
    it('classifies a twin landplane as fixed-wing-multi-engine', () =>
      expect(r.airframe_type).toBe('fixed-wing-multi-engine'));
    it('maps MOTOR JATO/TURBOFAN to turbo-fan', () => expect(r.engine.type).toBe('turbo-fan'));
    it('maps TRANSPORTE to the standard category', () => expect(r.category).toBe('standard'));
    it('derives corporation from a 14-digit CNPJ', () => expect(r.owner.kind).toBe('corporation'));
  });

  describe('PPADZ — cancelled registration', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = brRecords.get('PPADZ')!;
    });
    it('is cancelled when DT_CANC is present', () => expect(r.status).toBe('cancelled'));
    it('records the cancellation date as last_action_date', () =>
      expect(r.last_action_date).toBe('2025-11-19'));
    it('captures weight and capacity into the extended schema fields', () => {
      expect(r.max_takeoff_weight_kg).toBe(46992);
      expect(r.seats).toBe(20);
      expect(r.max_passengers).toBe(16);
      expect(r.min_crew).toBe(2);
    });
    it('preserves cancellation reason, lien status, and CVA review date', () => {
      expect(r.cancellation_reason).toBe('AERONAVE EXPORTADA');
      expect(r.lien_status).toBe('MATRICULA CANCELADA');
      expect(r.airworthiness_review_date).toBe('2026-02-18');
    });
    // br-anac declares no *_source_text mapping, so each companion mirrors its primary. This record
    // carries all three populated — a mirror regressing to null passes trivially against null ones.
    it('mirrors each primary into *_source_text when the config declares no override', () => {
      expect(r.cancellation_reason_source_text).toBe('AERONAVE EXPORTADA');
      expect(r.lien_status_source_text).toBe('MATRICULA CANCELADA');
      expect(r.operational_classes_source_text).toEqual(['PRIVADA']);
    });
  });

  describe('PPJCR — three-way co-ownership', () => {
    it('flags the owner kind as co-owner', () =>
      expect(brRecords.get('PPJCR')?.owner.kind).toBe('co-owner'));
    it('keeps the primary owner name', () =>
      expect(brRecords.get('PPJCR')?.owner.name).toBe('SERGIO MURILO LEANDRO COSTA'));
  });

  describe('PPAPA — helicopter, undisclosed operator', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = brRecords.get('PPAPA')!;
    });
    it('classifies a helicopter class as rotorcraft', () =>
      expect(r.airframe_type).toBe('rotorcraft'));
    it('maps MOTOR TURBOEIXO to turbo-shaft', () => expect(r.engine.type).toBe('turbo-shaft'));
    it('records the owner but nulls the Indisponível operator entirely', () => {
      expect(r.owner.name).toBe('HBR AVIACAO S.A');
      expect(r.operator).toEqual({ name: null, kind: null, state: null, country: 'BR' });
    });
    it('leaves dates and unpublished capacity fields null', () => {
      expect(r.certification_date).toBeNull();
      expect(r.expiration_date).toBeNull();
      expect(r.seats).toBeNull();
      expect(r.min_crew).toBeNull();
    });
  });

  describe('PPFAL — unpowered (glider), cancelled', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = brRecords.get('PPFAL')!;
    });
    it('classifies an unpowered landplane (L00) as glider', () =>
      expect(r.airframe_type).toBe('glider'));
    it('maps SEM MOTOR to engine type none', () => expect(r.engine.type).toBe('none'));
    it('rejects the malformed 6-digit validity date', () => expect(r.expiration_date).toBeNull());
    it('distinguishes owner from operator', () => {
      expect(r.owner.name).toBe('GOVERNO FEDERAL ANAC');
      expect(r.operator.name).toBe('AEROCLUBE DE RIBEIRAO PRETO');
    });
  });

  describe('PRAFV — drone (RPA)', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = brRecords.get('PRAFV')!;
    });
    it('maps the RPA class to the uav airframe type', () => expect(r.airframe_type).toBe('uav'));
    it('maps DRONE to engine type other', () => expect(r.engine.type).toBe('other'));
  });

  describe('PPASW — single turboprop, restricted category', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = brRecords.get('PPASW')!;
    });
    it('maps MOTOR TURBOHELICE to turbo-prop', () => expect(r.engine.type).toBe('turbo-prop'));
    it('maps RESTRITA to the restricted category', () => expect(r.category).toBe('restricted'));
  });

  describe('PPACK — UTF-8 accented owner name round-trip', () => {
    it('preserves Brazilian Portuguese diacritics', () =>
      expect(brRecords.get('PPACK')?.owner.name).toBe('HANGAR ONE SERVIÇOS AERONÁUTICOS LTDA.'));
  });

  describe('PPACK — interdiction code is preserved, never folded into status', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = brRecords.get('PPACK')!;
    });
    it('preserves the raw interdiction code verbatim', () =>
      expect(r.interdiction_code).toBe('C8'));
    it('keeps status valid: an interdiction code on a lien-free active aircraft is not restricted', () => {
      expect(r.lien_status).toBe('NENHUM GRAVAME REGISTRADO');
      expect(r.status).toBe('valid');
    });
  });

  describe('CD_INTERDICAO drives status where DT_CANC cannot', () => {
    it('maps a reserved mark to reserved, not valid', () => {
      expect(brRecords.get('PPAPA')?.status).toBe('reserved');
      expect(brRecords.get('PRAFV')?.status).toBe('reserved');
    });
    it('keeps a normal-situation mark valid', () => {
      expect(brRecords.get('PPJPG')?.status).toBe('valid');
    });
    it('keeps a CofA-suspended/cancelled mark valid — the registration is still live', () => {
      expect(brRecords.get('PPACK')?.status).toBe('valid');
    });
    it('still reads a populated DT_CANC as cancelled', () => {
      expect(brRecords.get('PPADZ')?.status).toBe('cancelled');
      expect(brRecords.get('PPFAL')?.status).toBe('cancelled');
    });
  });

  it('every Brazil record carries country=BR and no Mode-S hex', () => {
    for (const r of brRecords.values()) {
      expect(r.country).toBe('BR');
      expect(r.owner.country).toBe('BR');
      expect(r.icao_hex).toBeNull();
    }
  });
});

const CH_FIXTURES = resolve(import.meta.dirname, '..', 'fixtures', 'ch-foca');
const CH_CONFIG_PATH = resolve(import.meta.dirname, '..', 'sources', 'ch-foca.yaml');

describe('CH-FOCA fixture mapping', () => {
  let chRecords: Map<string, Aircraft>;
  let chStats: EngineStats;

  beforeAll(async () => {
    const config: SourceConfig = loadSourceConfig(CH_CONFIG_PATH);
    const buf = readFileSync(resolve(CH_FIXTURES, 'input', 'lfr.json'));
    const result = await mapRows(config, new Map([['aircraft', buf]]));
    chRecords = result.records;
    chStats = result.stats;
  });

  it('maps every fixture record', () => {
    expect(chStats).toEqual({ total: 11, ok: 11, failed: 0, skipped: 0, duplicateSkipped: 0 });
  });

  describe('HB-1000 — glider, individual, Swiss canton', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = chRecords.get('1000001')!;
    });

    it('keys on the permanent lfrId, not the registration', () => {
      expect(r.source).toBe('ch-foca');
      expect(r.source_id).toBe('1000001');
      expect(r.registration).toBe('HB-1000');
    });

    it('reads the Mode-S hex and ICAO type code', () => {
      expect(r.icao_hex).toBe('4b488f');
      expect(r.icao_type_code).toBe('GLID');
    });

    it('maps glider airframe and valid status', () => {
      expect(r.airframe_type).toBe('glider');
      expect(r.status).toBe('valid');
      expect(r.country).toBe('CH');
    });

    it('preserves UTF-8 model and dates from [y,m,d] arrays', () => {
      expect(r.model).toBe('L 33 SÓLO');
      expect(r.certification_date).toBe('2025-08-15');
      expect(r.airworthiness_review_date).toBe('2027-04-23');
    });

    it('maps owner with canton state and no street/PII', () => {
      expect(r.owner).toEqual({
        name: 'Beispiel, Anna',
        kind: null,
        state: 'SO',
        country: 'Switzerland',
      });
      expect(r).not.toHaveProperty('street');
      expect(r).not.toHaveProperty('city');
    });

    it('reads MTOM in kilograms, minimum crew, and MOPSC passenger capacity', () => {
      expect(r.max_takeoff_weight_kg).toBe(340);
      expect(r.min_crew).toBe(1);
      expect(r.max_passengers).toBe(0);
    });
  });

  describe('HB-HEL — helicopter with distinct owner and operator', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = chRecords.get('1000003')!;
    });

    it('maps rotorcraft', () => expect(r.airframe_type).toBe('rotorcraft'));
    it('nulls max_passengers when MOPSC is absent', () => expect(r.max_passengers).toBeNull());
    it('separates owner from operator', () => {
      expect(r.owner.name).toBe('Helikopter GmbH');
      expect(r.owner.state).toBe('GR');
      expect(r.operator.name).toBe('Lufttransport AG');
      expect(r.operator.state).toBe('BE');
    });
  });

  describe('HB-BAL — balloon with N/A sentinels', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = chRecords.get('1000004')!;
    });

    it('maps balloon', () => expect(r.airframe_type).toBe('balloon'));
    it('nulls the N/A serial number', () => expect(r.serial_number).toBeNull());
    it('nulls a null airworthiness expiry', () => expect(r.airworthiness_review_date).toBeNull());
    it('nulls the non-canton (N/A) owner state', () => expect(r.owner.state).toBeNull());
  });

  describe('HB-PGL — powered glider, care-of address line', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = chRecords.get('1000005')!;
    });

    it('maps powered glider to glider', () => expect(r.airframe_type).toBe('glider'));
    it('drops a care-of extraLine instead of leaking it as state', () =>
      expect(r.owner.state).toBeNull());
  });

  describe('HB-EXP — homebuilt aeroplane, co-owned', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = chRecords.get('1000006')!;
    });

    it('maps homebuilt airplane to fixed-wing', () => expect(r.airframe_type).toBe('fixed-wing'));
    it('flags co-owner when a Part Owner is present', () => expect(r.owner.kind).toBe('co-owner'));
    it('keeps a single operator as null kind', () => expect(r.operator.kind).toBeNull());
  });

  describe('HB-GYR — gyrocopter, foreign owner', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = chRecords.get('1000008')!;
    });

    it('maps ultralight gyrocopter to gyroplane', () => expect(r.airframe_type).toBe('gyroplane'));
    it('reads the foreign owner country verbatim with null canton', () => {
      expect(r.owner.country).toBe('Germany');
      expect(r.owner.state).toBeNull();
    });
  });

  describe('HB-TRK — trike, no Mode-S or ICAO type', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = chRecords.get('1000009')!;
    });

    it('maps trike to weight-shift', () => expect(r.airframe_type).toBe('weight-shift'));
    it('nulls the N/A hex and ICAO code', () => {
      expect(r.icao_hex).toBeNull();
      expect(r.icao_type_code).toBeNull();
    });
  });

  describe('HB-CO2 — aeroplane with multiple operators (co-owner kind)', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = chRecords.get('1000010')!;
    });

    it('flags co-owner kind on the operator when a Part Operator exists', () =>
      expect(r.operator.kind).toBe('co-owner'));
    it('keeps a single owner as null kind', () => expect(r.owner.kind).toBeNull());
    it('maps MOPSC to max_passengers', () => expect(r.max_passengers).toBe(150));
  });

  describe('HB-SHP — airship maps to blimp', () => {
    it('maps hot-air airship to blimp', () =>
      expect(chRecords.get('1000007')!.airframe_type).toBe('blimp'));
  });

  describe('HB-UNK — unknown category', () => {
    it('leaves airframe_type null for an unmapped category id', () =>
      expect(chRecords.get('1000011')!.airframe_type).toBeNull());
  });
});

describe('CAA Maldives fixture mapping (PDF)', () => {
  const MV_CONFIG = resolve(import.meta.dirname, '..', 'sources', 'mv-caa.yaml');
  const MV_PDF = resolve(import.meta.dirname, '..', 'fixtures', 'mv-caa', 'input', 'register.pdf');
  let mvRecords: Map<string, Aircraft>;

  beforeAll(async () => {
    const config = loadSourceConfig(MV_CONFIG);
    const result = await mapRows(config, new Map([['register', readFileSync(MV_PDF)]]));
    mvRecords = result.records;
  });

  it('maps all 137 register rows with no failures', () => {
    expect(mvRecords.size).toBe(137);
  });

  it('keys records on the certificate number, not the reissued mark', () => {
    expect(mvRecords.has('CR-121')).toBe(true);
    expect(mvRecords.get('CR-121')!.registration).toBe('8Q-OEQ');
  });

  describe('CR-337 — ATR 42-500, registrant + foreign lessor', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = mvRecords.get('CR-337')!;
    });

    it('maps the combined manufacturer/model cell to model', () =>
      expect(r.model).toBe('Avions de Transport Regional, ATR 42-500'));
    it('maps the registrant to owner with constant MV country', () => {
      expect(r.owner.name).toBe('Island Aviation Services Limited');
      expect(r.owner.country).toBe('MV');
    });
    it('maps the legal owner (lessor) to legal_owner', () =>
      expect(r.legal_owner.name).toBe('Abelo Capital FL 1 Limited'));
    it('leaves the operator slot null (registrant is the operator)', () =>
      expect(r.operator).toEqual({ name: null, kind: null, state: null, country: null }));
    it('parses the D-MMM-YY dates', () => {
      expect(r.certification_date).toBe('2025-06-02');
      expect(r.last_action_date).toBe('2025-06-15');
    });
    it('maps MTOW and year as numbers', () => {
      expect(r.max_takeoff_weight_kg).toBe(18600);
      expect(r.year_manufactured).toBe(2025);
    });
    it('keeps the IDERA authorised-party name and drops its address (PII)', () => {
      expect(r.idera_authorised_party).toBe('Export Development Canada');
      expect(r.idera_authorised_party).not.toContain('Slater Street');
    });
    it('drops owner/legal-owner address PII (no street/postal keys)', () =>
      expect(Object.keys(r)).not.toContain('owner_street'));
  });

  it('marks the current-fleet register as valid', () =>
    expect([...mvRecords.values()].every((r) => r.status === 'valid')).toBe(true));
});

describe('AESA Spain fixture mapping (PDF)', () => {
  const ES_CONFIG = resolve(import.meta.dirname, '..', 'sources', 'es-aesa.yaml');
  const ES_PDF = resolve(import.meta.dirname, '..', 'fixtures', 'es-aesa', 'input', 'register.pdf');
  let esRecords: Map<string, Aircraft>;
  let esStats: EngineStats;

  beforeAll(async () => {
    const config = loadSourceConfig(ES_CONFIG);
    const result = await mapRows(config, new Map([['register', readFileSync(ES_PDF)]]));
    esRecords = result.records;
    esStats = result.stats;
  });

  it('maps all 90 fixture rows with no failures', () => {
    expect(esStats).toEqual({ total: 90, ok: 90, failed: 0, skipped: 0, duplicateSkipped: 0 });
    expect(esRecords.size).toBe(90);
  });

  it('keys records on the EC-XXX mark and stamps source/country', () => {
    const r = esRecords.get('EC-AAP')!;
    expect(r.source).toBe('es-aesa');
    expect(r.source_id).toBe('EC-AAP');
    expect(r.registration).toBe('EC-AAP');
    expect(r.country).toBe('ES');
  });

  describe('EC-AAP — a type-certificated single-engine aeroplane', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = esRecords.get('EC-AAP')!;
    });
    it('splits manufacturer and model into their own fields', () => {
      expect(r.manufacturer).toBe('PIPER AIRCRAFT CORPORATION');
      expect(r.model).toBe('L-14');
    });
    it('types it single-engine via the engine count and labels the class in English', () => {
      expect(r.airframe_type).toBe('fixed-wing-single-engine');
      expect(r.airworthiness_class).toBe('airplane');
    });
    // es_aesa_class_en renders English at parse time, so the mirrored default would store English
    // in source_text and lose the Spanish original AESA's licence requires be recoverable. The
    // explicit airworthiness_class_source_text mapping must win over the mirror.
    it('keeps the raw Spanish class, the explicit source_text mapping beating the mirror', () => {
      expect(r.airworthiness_class_source_text).toBe('AVION');
      expect(r.airworthiness_class_source_text).not.toBe(r.airworthiness_class);
    });
    it('maps the engine detail and count', () => {
      expect(r.engine.manufacturer).toBe('LYCOMING');
      expect(r.engine.model).toBe('O-290-C');
      expect(r.engine.count).toBe(1);
    });
    it('parses the DD/MM/YYYY registration date and year', () => {
      expect(r.certification_date).toBe('1952-04-02');
      expect(r.year_manufactured).toBe(1945);
    });
  });

  it('nulls the wrapped NO DISPONIBLE serial sentinel and labels the ULM tier in English', () => {
    const r = esRecords.get('EC-AB8')!;
    expect(r.serial_number).toBeNull();
    expect(r.airworthiness_class).toBe('ultralight airplane');
    expect(r.airframe_type).toBe('fixed-wing-single-engine');
  });

  it('types a GLOBO as a balloon with no engine (NO TIENE → null, count 0)', () => {
    const r = esRecords.get('EC-DYI')!;
    expect(r.airframe_type).toBe('balloon');
    expect(r.airworthiness_class).toBe('balloon');
    expect(r.engine.manufacturer).toBeNull();
    expect(r.engine.model).toBeNull();
    expect(r.engine.count).toBe(0);
  });

  it('types HELICOPTERO (VTOL) as rotorcraft', () =>
    expect(esRecords.get('EC-DUY')!.airframe_type).toBe('rotorcraft'));

  it('flattens the wrapped PLANEADOR/MOTOPLANEADOR cell to glider with an English label', () => {
    const r = esRecords.get('EC-BHR')!;
    expect(r.airframe_type).toBe('glider');
    expect(r.airworthiness_class).toBe('glider / motor-glider');
  });

  it('types a multi-engine aeroplane via the engine count', () =>
    expect(esRecords.get('EC-DXJ')!.airframe_type).toBe('fixed-wing-multi-engine'));

  it('keeps the amateur-built (AFI) builder name in manufacturer (a bare name is not dropped PII)', () => {
    const r = esRecords.get('EC-XAR')!;
    expect(r.airworthiness_class).toBe('amateur-built airplane');
    expect(r.manufacturer).not.toBeNull();
    expect(r.model).toBe('Storm Century 04');
  });

  it('marks the active-only register as valid', () =>
    expect([...esRecords.values()].every((r) => r.status === 'valid')).toBe(true));

  it('publishes no party data (the register carries no owner/operator, so no PII)', () => {
    const nullParty = { name: null, kind: null, state: null, country: null };
    for (const r of esRecords.values()) {
      expect(r.owner).toEqual(nullParty);
      expect(r.operator).toEqual(nullParty);
      expect(r.legal_owner).toEqual(nullParty);
    }
  });
});

describe('CCAA Croatia fixture mapping (PDF)', () => {
  const HR_CONFIG = resolve(import.meta.dirname, '..', 'sources', 'hr-ccaa.yaml');
  const HR_PDF = resolve(import.meta.dirname, '..', 'fixtures', 'hr-ccaa', 'input', 'register.pdf');
  let hrRecords: Map<string, Aircraft>;
  let hrStats: EngineStats;

  beforeAll(async () => {
    const config = loadSourceConfig(HR_CONFIG);
    const result = await mapRows(config, new Map([['register', readFileSync(HR_PDF)]]));
    hrRecords = result.records;
    hrStats = result.stats;
  });

  // The fixture's two real pages carry 33 real aircraft. `pdf.anchor_field: mark` keeps a wrapped
  // owner-cell continuation line that happens to read "PZO" from ever being mistaken for its own
  // anchor, so there is no false-positive row to skip (see the MORH test below for what that line
  // actually belongs to).
  it('maps all 33 real rows with no failures', () => {
    expect(hrStats).toEqual({ total: 33, ok: 33, failed: 0, skipped: 0, duplicateSkipped: 0 });
    expect(hrRecords.size).toBe(33);
  });

  it('keys records on the bare mark, restores the 9A- prefix in registration', () => {
    const r = hrRecords.get('BTI')!;
    expect(r.source).toBe('hr-ccaa');
    expect(r.source_id).toBe('BTI');
    expect(r.registration).toBe('9A-BTI');
    expect(r.country).toBe('HR');
  });

  it('classifies a d.o.o. owner as llc and a d.d. owner as corporation', () => {
    expect(hrRecords.get('BTI')!.owner.kind).toBe('llc');
    expect(hrRecords.get('BKA')!.owner.kind).toBe('corporation');
  });

  it('falls back to other for an association with no recognized legal-form signal', () =>
    expect(hrRecords.get('BFT')!.owner.kind).toBe('other'));

  // Before `anchor_field` this wrapped VLASNIK continuation line ("PZO") was itself mistaken for a
  // record anchor and discarded, truncating the owner name mid-phrase. It now joins its real row.
  it('keeps a wrapped MORH government owner name whole and drops its street address (PII)', () => {
    const r = hrRecords.get('DAZ')!;
    expect(r.owner.name).toBe('MORH Zapovjedništvo HRZ I PZO');
    expect(r.owner.kind).toBe('government');
    expect(r.owner.state).toBeNull();
    expect(r.owner.country).toBeNull();
    expect(JSON.stringify(r)).not.toContain('Maksimirska');
  });

  it('reads the trailing country component of a foreign lessor address, dropping the street', () => {
    const ber = hrRecords.get('BER')!;
    expect(ber.owner.name).toBe('ACS Aero 4 Delta Limited');
    expect(ber.owner.kind).toBe('corporation');
    expect(ber.owner.country).toBe('IE');
    expect(ber.owner.state).toBeNull();

    const atr = hrRecords.get('ATR')!;
    expect(atr.owner.country).toBe('SG');
  });

  it('nulls owner.country for an ordinary domestic address instead of assuming the register country', () => {
    const r = hrRecords.get('BTI')!;
    expect(r.owner.country).toBeNull();
    expect(r.owner.country).not.toBe('HR');
  });

  it('keeps a final wrapped foreign country line without taking the page footer', () => {
    const r = hrRecords.get('DER')!;
    expect(r.owner.name).toBe('G&K avio servis d.o.o.');
    expect(r.owner.country).toBe('SI');
    expect(JSON.stringify(r)).not.toContain('Stranica');
  });

  it("keeps the register's own natural-person placeholder verbatim as owner.name", () => {
    const r = hrRecords.get('BOS')!;
    expect(r.owner.name).toBe('Fizička osoba');
    expect(r.owner.kind).toBe('individual');
  });

  it('marks a homebuilt (amaterska gradnja) manufacturer as not-type-certificated', () => {
    const r = hrRecords.get('DAW')!;
    expect(r.manufacturer).toBe('amaterska gradnja');
    expect(r.build_certification).toBe('not-type-certificated');
  });

  it('leaves build_certification null for a normal manufacturer', () =>
    expect(hrRecords.get('BTI')!.build_certification).toBeNull());

  it('publishes no operator or legal_owner data (the register has one party column only)', () => {
    const nullParty = { name: null, kind: null, state: null, country: null };
    for (const r of hrRecords.values()) {
      expect(r.operator).toEqual(nullParty);
      expect(r.legal_owner).toEqual(nullParty);
    }
  });

  it('marks the current-publication register as valid', () =>
    expect([...hrRecords.values()].every((r) => r.status === 'valid')).toBe(true));
});

const EE_FIXTURES = resolve(import.meta.dirname, '..', 'fixtures', 'ee-tram');
const EE_CONFIG_PATH = resolve(import.meta.dirname, '..', 'sources', 'ee-tram.yaml');

const eeFixtureBuffer = (filename: string): Buffer =>
  readFileSync(resolve(EE_FIXTURES, 'input', filename));

let eeRecords: Map<string, Aircraft>;
let eeStats: EngineStats;

beforeAll(async () => {
  const config = loadSourceConfig(EE_CONFIG_PATH);
  const files = new Map([['register', eeFixtureBuffer('register.html')]]);
  const result = await mapRows(config, files);
  eeRecords = result.records;
  eeStats = result.stats;
});

describe('Transpordiamet Estonia (HTML) fixture mapping', () => {
  it('maps all 10 fixture aircraft with no failures', () => {
    expect(eeStats).toEqual({ total: 10, ok: 10, failed: 0, skipped: 0, duplicateSkipped: 0 });
    expect(eeRecords.size).toBe(10);
  });

  describe('ES-MBA — airline jet with a foreign trust owner', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = eeRecords.get('ES-MBA')!;
    });
    it('normalizes the spaced mark for id and registration', () => {
      expect(r.source).toBe('ee-tram');
      expect(r.source_id).toBe('ES-MBA');
      expect(r.registration).toBe('ES-MBA');
      expect(r.country).toBe('EE');
    });
    it('keeps the make+model string in model with manufacturer null', () => {
      expect(r.model).toBe('Airbus A320');
      expect(r.manufacturer).toBeNull();
    });
    it('captures owner and operator separately', () => {
      expect(r.owner.name).toBe('Wilmington Trust SP Services (Dublin) Limited');
      expect(r.operator.name).toBe('Marabu Airlines OÜ');
    });
    it('leaves owner.country null (foreign lessor, not the registration country)', () =>
      expect(r.owner.country).toBeNull());
    it('marks the register as valid (active-only listing)', () => expect(r.status).toBe('valid'));
  });

  describe('ES-MBB — comma in the owner name', () => {
    it('preserves the full owner string verbatim', () =>
      expect(eeRecords.get('ES-MBB')?.owner.name).toBe(
        'Bank of Utah, not in its individual capacity but solely as owner trustee'
      ));
  });

  describe('ES-ANS — private owner ("eraisik")', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = eeRecords.get('ES-ANS')!;
    });
    it("keeps the source's own privacy redaction verbatim", () =>
      expect(r.owner.name).toBe('eraisik'));
    it('still carries a distinct operator', () => expect(r.operator.name).toBe('VLR OÜ'));
  });

  describe('ES-ECG — alphanumeric serial', () => {
    it('keeps a non-numeric serial intact', () =>
      expect(eeRecords.get('ES-ECG')?.serial_number).toBe('F172-0873'));
  });

  describe('ES-1004 — numeric mark, sailplane, spaced serial', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = eeRecords.get('ES-1004')!;
    });
    it('normalizes a numeric mark', () => expect(r.registration).toBe('ES-1004'));
    it('keeps the bilingual category type as model', () =>
      expect(r.model).toBe('purilennuk/sailplane'));
    it('preserves the spaced alphanumeric serial', () => expect(r.serial_number).toBe('B - 1454'));
  });

  it('every Estonia record has country=EE, status=valid, and no engine/PII-address data', () => {
    for (const r of eeRecords.values()) {
      expect(r.country).toBe('EE');
      expect(r.status).toBe('valid');
      expect(r.registration).toMatch(/^ES-[A-Z0-9]+$/);
      expect(r.engine).toEqual({
        manufacturer: null,
        model: null,
        type: null,
        count: null,
        horsepower: null,
        thrust_lbs: null,
      });
      expect(Object.keys(r)).not.toContain('owner_street');
    }
  });
});

// Builds an ee-tram-shaped HTML table (9 columns, metadata + header preamble) with a stated total
// and a set of marks, to exercise the record_count guard independently of the ground-truth fixture.
const eeTable = (statedTotal: number, marks: string[]): Buffer => {
  const cell = (v: string): string => `<td>${v || '&nbsp;'}</td>`;
  const row = (cells: string[]): string => `<tr>${cells.map(cell).join('')}</tr>`;
  const meta = row([
    '',
    '19.06.2026/updated',
    '',
    '',
    '',
    'Kokku õhusõidukeid /total',
    String(statedTotal),
    '',
    '',
  ]);
  const header = row(['', 'mark', '', '', 'type', 'serial', 'owner', 'operator', '']);
  const data = marks.map((m) =>
    row(['', m, '', '', 'Cessna 172', '123', 'Owner OÜ', 'Owner OÜ', ''])
  );
  return Buffer.from(`<table>${meta}${header}${data.join('')}</table>`, 'utf8');
};

describe('record_count guard (ee-tram)', () => {
  const config = loadSourceConfig(EE_CONFIG_PATH);

  it('passes when the mapped count equals the published total', async () => {
    const { records } = await mapRows(
      config,
      new Map([['register', eeTable(2, ['ES - AAA', 'ES - AAB'])]])
    );
    expect(records.size).toBe(2);
  });

  it('fails loudly when a row is missing vs the published total', async () => {
    await expect(
      mapRows(config, new Map([['register', eeTable(3, ['ES - AAA', 'ES - AAB'])]]))
    ).rejects.toThrow(/mapped 2 records but the source publishes 3/);
  });

  it('fails loudly when the published total cannot be found', async () => {
    const noTotal = eeTable(2, ['ES - AAA', 'ES - AAB'])
      .toString('utf8')
      .replace(/Kokku[^<]*/, 'x');
    await expect(
      mapRows(config, new Map([['register', Buffer.from(noTotal, 'utf8')]]))
    ).rejects.toThrow(/pattern matched no count/);
  });

  it('skips the count check when a row already failed, leaving that failure for pipeline.ts to report', async () => {
    // 'NOT-A-MARK' fails ee_registration (no ES- prefix), so this row is a row-level failure —
    // independent of and prior to the record_count guard, which pipeline.ts's own
    // `stats.failed > 0` abort path is responsible for surfacing.
    const { stats } = await mapRows(
      config,
      new Map([['register', eeTable(2, ['ES - AAA', 'NOT-A-MARK'])]])
    );
    expect(stats).toEqual({ total: 2, ok: 1, failed: 1, skipped: 0, duplicateSkipped: 0 });
  });
});

// lt-tka counts against the parsed rows, not the mapped records: its published total covers
// the accumulated history that latest_snapshot_by then filters down to one publication.
describe('record_count against a separately published total (lt-tka)', () => {
  const config = loadSourceConfig(resolve(import.meta.dirname, '..', 'sources', 'lt-tka.yaml'));
  const register = (): Buffer =>
    readFileSync(resolve(import.meta.dirname, '..', 'fixtures', 'lt-tka', 'input', 'register.csv'));
  const files = (): Map<string, Buffer> => new Map([['register', register()]]);

  it('counts the parsed rows, not the smaller mapped set', async () => {
    const { records, stats } = await mapRows(config, files(), '{"_data":[{"count()":13}]}');
    expect(stats.total).toBe(11);
    expect(records.size).toBe(11);
  });

  it('fails loudly when the download is short of the published total', async () => {
    await expect(mapRows(config, files(), '{"_data":[{"count()":14}]}')).rejects.toThrow(
      /parsed 13 records but the source publishes 14/
    );
  });

  it('names the endpoint when the published total cannot be found there', async () => {
    await expect(mapRows(config, files(), '{"_data":[]}')).rejects.toThrow(
      /pattern matched no count in https:\/\/get\.data\.gov\.lt/
    );
  });
});

const SG_FIXTURES = resolve(import.meta.dirname, '..', 'fixtures', 'sg-caas');
const SG_CONFIG_PATH = resolve(import.meta.dirname, '..', 'sources', 'sg-caas.yaml');

const sgFixtureBuffer = (filename: string): Buffer =>
  readFileSync(resolve(SG_FIXTURES, 'input', filename));

let sgRecords: Map<string, Aircraft>;
let sgStats: EngineStats;

beforeAll(async () => {
  const config = loadSourceConfig(SG_CONFIG_PATH);
  const result = await mapRows(config, new Map([['register', sgFixtureBuffer('register.xlsx')]]));
  sgRecords = result.records;
  sgStats = result.stats;
});

describe('CAAS Singapore fixture mapping', () => {
  it('maps all 10 fixture rows with no failures', () => {
    expect(sgStats).toEqual({ total: 10, ok: 10, failed: 0, skipped: 0, duplicateSkipped: 0 });
    expect(sgRecords.size).toBe(10);
  });

  describe('9V-BLL — Cessna 172S trainer, operator published', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = sgRecords.get('9V-BLL')!;
    });

    it('has correct identity (registration is the source_id)', () => {
      expect(r.source).toBe('sg-caas');
      expect(r.source_id).toBe('9V-BLL');
      expect(r.registration).toBe('9V-BLL');
      expect(r.country).toBe('SG');
    });
    it('has status=valid (register is a current-fleet snapshot)', () =>
      expect(r.status).toBe('valid'));
    it('maps manufacturer, model and serial', () => {
      expect(r.manufacturer).toBe('Cessna');
      expect(r.model).toBe('172S');
      expect(r.serial_number).toBe('172S12746');
    });
    it('maps engine make and model', () => {
      expect(r.engine.manufacturer).toBe('Lycoming');
      expect(r.engine.model).toBe('IO-360-L2A');
    });
    it('maps the operator (not owner) with SG country', () => {
      expect(r.operator.name).toBe('Aviation Hub Pte Ltd');
      expect(r.operator.country).toBe('SG');
    });
    it('leaves owner null — CAAS publishes operator only, no owner PII', () => {
      expect(r.owner).toEqual({ name: null, kind: null, state: null, country: null });
    });
    it('leaves CAAS-not-published fields null', () => {
      expect(r.icao_hex).toBeNull();
      expect(r.icao_type_code).toBeNull();
      expect(r.airframe_type).toBeNull();
      expect(r.year_manufactured).toBeNull();
      expect(r.engine.type).toBeNull();
      expect(r.engine.count).toBeNull();
      expect(r.category).toBeNull();
      expect(r.certification_date).toBeNull();
      expect(r.legal_owner).toEqual({ name: null, kind: null, state: null, country: null });
      expect(r.idera_authorised_party).toBeNull();
    });
  });

  describe('9V-BOQ — model and engine strings that embed the manufacturer', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = sgRecords.get('9V-BOQ')!;
    });
    // CAAS free-texts the model; some rows prefix the make. There is no reliable separator, so the
    // string is preserved verbatim rather than guessing where the make ends and the model begins.
    it('preserves the make-prefixed model verbatim', () => expect(r.model).toBe('CESSNA 172N'));
    it('preserves the make-prefixed engine model verbatim', () =>
      expect(r.engine.model).toBe('Lycoming O-320-H'));
  });

  describe('9V-YFC — Diamond DA40, dotted serial number', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = sgRecords.get('9V-YFC')!;
    });
    it('keeps the dotted serial as a string (no numeric coercion)', () =>
      expect(r.serial_number).toBe('40.1072'));
    it('maps a fifth manufacturer (Diamond) and its operator', () => {
      expect(r.manufacturer).toBe('Diamond');
      expect(r.operator.name).toBe('Singapore Youth Flying Club');
    });
  });

  describe('9V-THA — Embraer, punctuation in operator/manufacturer/engine make', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = sgRecords.get('9V-THA')!;
    });
    it('preserves punctuation verbatim across fields', () => {
      expect(r.operator.name).toBe('Scoot Pte. Ltd.');
      expect(r.manufacturer).toBe('Embraer S.A.');
      expect(r.engine.manufacturer).toBe('Pratt & Whitney');
      expect(r.model).toBe('ERJ 190-300');
    });
  });

  describe('9V-SKM — Airbus A380 widebody', () => {
    it('maps the A380 model and Rolls-Royce engine', () => {
      const r = sgRecords.get('9V-SKM')!;
      expect(r.model).toBe('A380-841');
      expect(r.engine.model).toBe('RB211-TRENT 970');
    });
  });

  it('every SG record carries country=SG, operator.country=SG, and no owner or PII fields', () => {
    for (const r of sgRecords.values()) {
      expect(r.source).toBe('sg-caas');
      expect(r.registration.startsWith('9V-')).toBe(true);
      expect(r.country).toBe('SG');
      expect(r.status).toBe('valid');
      expect(r.operator.country).toBe('SG');
      expect(r.operator.name).not.toBeNull();
      expect(r.owner).toEqual({ name: null, kind: null, state: null, country: null });
      expect(r.legal_owner).toEqual({ name: null, kind: null, state: null, country: null });
      expect(r.icao_hex).toBeNull();
      expect(r).not.toHaveProperty('street');
      expect(r).not.toHaveProperty('postal_code');
    }
  });
});

const NO_FIXTURES = resolve(import.meta.dirname, '..', 'fixtures', 'no-caa');
const NO_CONFIG_PATH = resolve(import.meta.dirname, '..', 'sources', 'no-caa.yaml');

describe('NO-CAA fixture mapping', () => {
  let noRecords: Map<string, Aircraft>;
  let noStats: EngineStats;

  beforeAll(async () => {
    const config: SourceConfig = loadSourceConfig(NO_CONFIG_PATH);
    const buf = readFileSync(resolve(NO_FIXTURES, 'input', 'nlr.json'));
    const result = await mapRows(config, new Map([['aircraft', buf]]));
    noRecords = result.records;
    noStats = result.stats;
  });

  it('maps every fixture record', () => {
    expect(noStats).toEqual({ total: 7, ok: 7, failed: 0, skipped: 0, duplicateSkipped: 0 });
  });

  it('drops owner address and registration-date PII from the output records', () => {
    // The fixture input carries these public-register fields; the engine must not surface any of
    // them (field names or distinctive street values) in the canonical record.
    const prohibited = [
      'Gateadresse',
      'Postnummer',
      'Poststed',
      'Eier siden',
      'Strandengveien',
      'Fugleviklunden',
    ];
    for (const r of noRecords.values()) {
      const json = JSON.stringify(r);
      for (const token of prohibited) expect(json).not.toContain(token);
      expect(Object.keys(r.owner).sort()).toEqual(['country', 'kind', 'name', 'state']);
      expect(Object.keys(r.operator).sort()).toEqual(['country', 'kind', 'name', 'state']);
    }
  });

  describe('LN-ABA — amateur-built fixed-wing, co-ownership', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = noRecords.get('LN-ABA')!;
    });

    it('keys on the registration mark', () => {
      expect(r.source).toBe('no-caa');
      expect(r.source_id).toBe('LN-ABA');
      expect(r.registration).toBe('LN-ABA');
    });
    it('extracts the hexadecimal ICAO address', () => expect(r.icao_hex).toBe('478743'));
    it('maps Fly to fixed-wing with a constant valid status', () => {
      expect(r.airframe_type).toBe('fixed-wing');
      expect(r.status).toBe('valid');
      expect(r.country).toBe('NO');
    });
    it('parses the dot date and kilogram MTOM', () => {
      expect(r.certification_date).toBe('2005-06-02');
      expect(r.max_takeoff_weight_kg).toBe(726);
      expect(r.model).toBe('RV-6');
    });
    it('preserves every airworthiness category in operational_classes', () =>
      expect(r.operational_classes).toEqual(['Amateur Built', 'Experimental']));
    it('records co-ownership and drops street/PII', () => {
      expect(r.owner.kind).toBe('co-owner');
      expect(r.owner.country).toBe('Norge');
      expect(r.owner.state).toBeNull();
      expect(r).not.toHaveProperty('street');
      expect(r).not.toHaveProperty('postal_code');
    });
  });

  describe('LN-ABE — org-number owner types as corporation', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = noRecords.get('LN-ABE')!;
    });
    it('types the org-number owner as a corporation', () => {
      expect(r.owner.name).toBe('Robertsen Investments AS');
      expect(r.owner.kind).toBe('corporation');
    });
    it('leaves operator empty when the feed lists none', () =>
      expect(r.operator).toEqual({ name: null, kind: null, state: null, country: null }));
  });

  describe('LN-OAB — helicopter with a distinct operator', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = noRecords.get('LN-OAB')!;
    });
    it('maps Helikopter to rotorcraft', () => expect(r.airframe_type).toBe('rotorcraft'));
    it('populates the operator name and kind', () => {
      expect(r.operator.name).toBe('Heli Team AS');
      expect(r.operator.kind).toBe('corporation');
    });
  });

  describe('LN-CAD — balloon airframe', () => {
    it('maps Ballong to balloon', () =>
      expect(noRecords.get('LN-CAD')!.airframe_type).toBe('balloon'));
  });

  describe('LN-GAB — glider airframe', () => {
    it('maps Seilfly to glider', () =>
      expect(noRecords.get('LN-GAB')!.airframe_type).toBe('glider'));
  });

  describe('LN-ADA — foreign owner country preserved verbatim', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = noRecords.get('LN-ADA')!;
    });
    it('keeps the non-Norwegian owner country', () => {
      expect(r.owner.name).toBe('BE Probiotik SRL');
      expect(r.owner.country).toBe('Romania');
      expect(r.owner.kind).toBe('corporation');
    });
  });

  describe('LN-ABC — Norwegian owner without an org number', () => {
    it('types a domestic no-org-number owner as an individual', () =>
      expect(noRecords.get('LN-ABC')!.owner.kind).toBe('individual'));
  });

  it('every NO record carries country=NO, valid status, and a 6-hex icao_hex', () => {
    for (const r of noRecords.values()) {
      expect(r.source).toBe('no-caa');
      expect(r.registration.startsWith('LN-')).toBe(true);
      expect(r.country).toBe('NO');
      expect(r.status).toBe('valid');
      expect(r.icao_hex).toMatch(/^[0-9a-f]{6}$/);
      expect(r.icao_type_code).toBeNull();
      expect(r).not.toHaveProperty('street');
    }
  });
});

const CL_FIXTURES = resolve(import.meta.dirname, '..', 'fixtures', 'cl-dgac');
const CL_CONFIG_PATH = resolve(import.meta.dirname, '..', 'sources', 'cl-dgac.yaml');

describe('DGAC Chile fixture mapping', () => {
  let clRecords: Map<string, Aircraft>;
  let clStats: EngineStats;

  beforeAll(async () => {
    const config: SourceConfig = loadSourceConfig(CL_CONFIG_PATH);
    const buf = readFileSync(resolve(CL_FIXTURES, 'input', 'register.xlsx'));
    const result = await mapRows(config, new Map([['register', buf]]));
    clRecords = result.records;
    clStats = result.stats;
  });

  // 11 rows: 8 distinct tails, 3 co-owner rows for CCADB collapse to one, 1 byte-identical CCDUP
  // row is skipped.
  it('collapses co-owner and byte-identical rows to 8 records', () => {
    expect(clStats).toEqual({ total: 11, ok: 8, failed: 0, skipped: 1, duplicateSkipped: 1 });
    expect(clRecords.size).toBe(8);
  });

  describe('CCAAA — single-operator helicopter, commercial use', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = clRecords.get('CCAAA')!;
    });
    it('keys on the raw mark and restores the CC- dash for registration', () => {
      expect(r.source).toBe('cl-dgac');
      expect(r.source_id).toBe('CCAAA');
      expect(r.registration).toBe('CC-AAA');
      expect(r.country).toBe('CL');
    });
    // The lookup renders English at parse time, so without the explicit source_text mapping the
    // Spanish cell is gone — the same provenance loss es-aesa's class transform would cause.
    it('keeps the Spanish USO AERONAVE alongside the canonical English token', () => {
      expect(r.operational_classes).toEqual(['commercial']);
      expect(r.operational_classes_source_text).toEqual(['COMERCIAL']);
    });
    it('maps HELICOPTERO to rotorcraft with a constant valid status', () => {
      expect(r.airframe_type).toBe('rotorcraft');
      expect(r.status).toBe('valid');
    });
    it('records commercial use as an operational class', () =>
      expect(r.operational_classes).toEqual(['commercial']));
    it('maps the operator (not owner) with CL country and no co-owner flag', () => {
      expect(r.operator.name).toBe('PUBLICITARIA PUBLI G SPA');
      expect(r.operator.country).toBe('CL');
      expect(r.operator.kind).toBeNull();
    });
    it('leaves owner and legal_owner null — register publishes operator only', () => {
      expect(r.owner).toEqual({ name: null, kind: null, state: null, country: null });
      expect(r.legal_owner).toEqual({ name: null, kind: null, state: null, country: null });
    });
    it('leaves register-not-published fields null', () => {
      expect(r.icao_hex).toBeNull();
      expect(r.serial_number).toBeNull();
      expect(r.year_manufactured).toBeNull();
      expect(r.engine.manufacturer).toBeNull();
      expect(r.certification_date).toBeNull();
    });
  });

  describe('CCADB — co-owner tail merged into one record', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = clRecords.get('CCADB')!;
    });
    it('joins every party name with the register Y conjunction', () =>
      expect(r.operator.name).toBe(
        'ANDES RENTAL SPA Y INVERSIONES GHC LIMITADA Y URRUTIA, MARIA ELEONORA'
      ));
    it('stamps operator.kind co-owner on the merge', () =>
      expect(r.operator.kind).toBe('co-owner'));
    it('keeps the shared identity fields intact', () => {
      expect(r.registration).toBe('CC-ADB');
      expect(r.manufacturer).toBe('CESSNA');
      expect(r.model).toBe('525');
      expect(r.airframe_type).toBe('fixed-wing');
    });
  });

  it('maps every TIPO DE AERONAVE value to its airframe type', () => {
    expect(clRecords.get('CCAAC')!.airframe_type).toBe('fixed-wing');
    expect(clRecords.get('CCAAE')!.airframe_type).toBe('glider');
    expect(clRecords.get('CCGLO')!.airframe_type).toBe('balloon');
    expect(clRecords.get('CCGYR')!.airframe_type).toBe('gyroplane');
    expect(clRecords.get('CCDIR')!.airframe_type).toBe('blimp');
  });

  it('maps PRIVADO to a private operational class', () =>
    expect(clRecords.get('CCAAC')!.operational_classes).toEqual(['private']));

  it('every CL record carries country=CL, valid status, a CC- registration, and no owner/hex/PII', () => {
    for (const r of clRecords.values()) {
      expect(r.source).toBe('cl-dgac');
      expect(r.registration.startsWith('CC-')).toBe(true);
      expect(r.country).toBe('CL');
      expect(r.status).toBe('valid');
      expect(r.operator.country).toBe('CL');
      expect(r.owner).toEqual({ name: null, kind: null, state: null, country: null });
      expect(r.legal_owner).toEqual({ name: null, kind: null, state: null, country: null });
      expect(r.icao_hex).toBeNull();
      expect(r).not.toHaveProperty('street');
      expect(r).not.toHaveProperty('postal_code');
    }
  });
});

describe('engine — merge_duplicates edge cases', () => {
  const buildMergeConfig = (setOnMerge: Record<string, string | null>): SourceConfig => ({
    id: 'synthetic-merge',
    label: 'Synthetic merge_duplicates source',
    country: 'CL',
    language: 'en',
    encoding: 'utf8',
    download: { url: 'https://example.com/x.ods', format: 'zip', entries: { register: 'r.ods' } },
    primary: 'register',
    delimiter: ',',
    trim_all: true,
    format: 'ods',
    joins: [],
    source_id: 'ID',
    registration: 'REG',
    merge_duplicates: { fields: ['owner.name'], separator: ' Y ', set_on_merge: setOnMerge },
    mapping: {
      registration: { field: 'REG' },
      status: { constant: 'valid' },
      country: { constant: 'CL' },
      'owner.name': { field: 'OWNER', transform: 'trim_or_null' },
    },
  });

  const odsBuffer = (rows: string[][]): Promise<Buffer> =>
    writeOds({ sheets: [{ name: 'Sheet1', rows }] }).then((b) => Buffer.from(b));

  // Covers the branch where the incumbent's merge field is empty and the incoming value fills it,
  // rather than being concatenated onto an existing string.
  it('fills an empty incumbent field from a later row instead of concatenating', async () => {
    const buf = await odsBuffer([
      ['ID', 'REG', 'OWNER'],
      ['1', 'CC-AAA', ''],
      ['1', 'CC-AAA', 'LATE ADDITION SPA'],
    ]);
    const { records, stats } = await mapRows(
      buildMergeConfig({ 'owner.kind': 'co-owner' }),
      new Map([['register', buf]])
    );
    expect(stats.failed).toBe(0);
    expect(records.get('1')!.owner.name).toBe('LATE ADDITION SPA');
    expect(records.get('1')!.owner.kind).toBe('co-owner');
  });

  // Covers the re-validation guard: a set_on_merge value that violates the schema fails the merged
  // row loudly instead of publishing an invalid record.
  it('fails the row when set_on_merge produces a schema-invalid value', async () => {
    const buf = await odsBuffer([
      ['ID', 'REG', 'OWNER'],
      ['1', 'CC-AAA', 'FIRST PARTY'],
      ['1', 'CC-AAA', 'SECOND PARTY'],
    ]);
    const { records, stats, retryable } = await mapRows(
      buildMergeConfig({ 'owner.kind': 'not-a-real-kind' }),
      new Map([['register', buf]])
    );
    expect(stats.failed).toBe(1);
    expect(records.get('1')!.owner.name).toBe('FIRST PARTY');
    // A schema-invalid merge is deterministic on these same bytes — a fresh download can't fix it,
    // so the caller must not retry.
    expect(retryable).toBe(false);
  });

  // The leaf must be a real own property of Object.prototype. With a made-up leaf the final
  // `Object.hasOwn(node, leaf)` throws on its own, so the test passes even with the parent
  // own-property guard deleted — it would assert nothing. `toString` exists, so reaching
  // Object.prototype means the assignment lands and the process is genuinely polluted.
  //
  // Note which guard this pins: the parent `Object.hasOwn` check, not the null/non-object/array
  // check beside it. Object.prototype is a plain non-null object, so the type guard waves
  // `__proto__` straight through. The own-property check is the only barrier here.
  it('rejects a prototype-chain merge path when the loader boundary is bypassed', async () => {
    const buf = await odsBuffer([
      ['ID', 'REG', 'OWNER'],
      ['1', 'CC-AAA', 'FIRST PARTY'],
      ['1', 'CC-AAA', 'SECOND PARTY'],
    ]);
    const descriptor = Object.getOwnPropertyDescriptor(Object.prototype, 'toString')!;
    try {
      const { records, stats } = await mapRows(
        buildMergeConfig({ 'owner.__proto__.toString': 'PWNED' }),
        new Map([['register', buf]])
      );
      expect(stats.failed).toBe(1);
      expect(records.get('1')!.owner.name).toBe('FIRST PARTY');
      // Compare descriptors rather than reading the method: `expect(Object.prototype.toString)`
      // trips @typescript-eslint/unbound-method. Pollution shows up as a changed `value` — the
      // other attributes survive, since assigning to an existing writable data property leaves
      // its descriptor flags alone.
      expect(Object.getOwnPropertyDescriptor(Object.prototype, 'toString')).toEqual(descriptor);
    } finally {
      // defineProperty rather than assignment: assignment would restore the function value but
      // silently no-op if a future guard change ever left the property non-writable, and this
      // must not leave a polluted prototype behind for the rest of the process.
      Object.defineProperty(Object.prototype, 'toString', descriptor);
    }
  });

  it('rejects a merge path that descends into an array when the loader boundary is bypassed', async () => {
    const config = buildMergeConfig({ 'operational_classes.0': 'commercial' });
    config.mapping.operational_classes = { field: 'CLASS' };
    const buf = await odsBuffer([
      ['ID', 'REG', 'OWNER', 'CLASS'],
      ['1', 'CC-AAA', 'FIRST PARTY', 'private'],
      ['1', 'CC-AAA', 'SECOND PARTY', 'private'],
    ]);
    const { records, stats } = await mapRows(config, new Map([['register', buf]]));
    expect(stats.failed).toBe(1);
    expect(records.get('1')!.operational_classes).toEqual(['private']);
  });

  // A non-string merge field is a misconfiguration: merge can only concatenate strings, so the row
  // fails loudly rather than silently dropping the candidate's differing value.
  it('fails the row when a declared merge field is not a string', async () => {
    const config: SourceConfig = {
      id: 'synthetic-merge-num',
      label: 'Synthetic numeric merge field',
      country: 'CL',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.ods', format: 'zip', entries: { register: 'r.ods' } },
      primary: 'register',
      delimiter: ',',
      trim_all: true,
      format: 'ods',
      joins: [],
      source_id: 'ID',
      registration: 'REG',
      merge_duplicates: { fields: ['year_manufactured'] },
      mapping: {
        registration: { field: 'REG' },
        status: { constant: 'valid' },
        country: { constant: 'CL' },
        year_manufactured: { field: 'YEAR', transform: 'int_or_null' },
      },
    };
    const buf = await odsBuffer([
      ['ID', 'REG', 'YEAR'],
      ['1', 'CC-AAA', '2000'],
      ['1', 'CC-AAA', '2001'],
    ]);
    const { stats } = await mapRows(config, new Map([['register', buf]]));
    expect(stats.failed).toBe(1);
  });

  // set_on_merge must not silently overwrite real, conflicting upstream data. A candidate carrying a
  // different value at a stamped path is a genuine collision — it fails loud and leaves the incumbent
  // untouched instead of clobbering it with the stamp.
  it('does not overwrite conflicting upstream data at a set_on_merge path', async () => {
    const config: SourceConfig = {
      id: 'synthetic-merge-clobber',
      label: 'Synthetic set_on_merge clobber guard',
      country: 'CL',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.ods', format: 'zip', entries: { register: 'r.ods' } },
      primary: 'register',
      delimiter: ',',
      trim_all: true,
      format: 'ods',
      joins: [],
      source_id: 'ID',
      registration: 'REG',
      merge_duplicates: {
        fields: ['owner.name'],
        separator: ' Y ',
        set_on_merge: { 'owner.country': 'CL' },
      },
      mapping: {
        registration: { field: 'REG' },
        status: { constant: 'valid' },
        country: { constant: 'CL' },
        'owner.name': { field: 'OWNER', transform: 'trim_or_null' },
        'owner.country': { field: 'OWNERCC', transform: 'trim_or_null' },
      },
    };
    const buf = await odsBuffer([
      ['ID', 'REG', 'OWNER', 'OWNERCC'],
      ['1', 'CC-AAA', 'FIRST PARTY', 'CL'],
      ['1', 'CC-AAA', 'SECOND PARTY', 'AR'],
    ]);
    const { records, stats } = await mapRows(config, new Map([['register', buf]]));
    expect(stats.failed).toBe(1);
    expect(records.get('1')!.owner.name).toBe('FIRST PARTY');
    expect(records.get('1')!.owner.country).toBe('CL');
  });

  // Mirror of the case above with the rows reversed: the conflicting value sits on the incumbent and
  // the candidate is empty. The stamp writes over the incumbent, so guarding only the candidate
  // would let file order decide whether 'AR' survives — it must fail here too.
  it('does not overwrite conflicting incumbent data at a set_on_merge path', async () => {
    const config: SourceConfig = {
      id: 'synthetic-merge-incumbent-clobber',
      label: 'Synthetic set_on_merge incumbent clobber guard',
      country: 'CL',
      language: 'en',
      encoding: 'utf8',
      download: { url: 'https://example.com/x.ods', format: 'zip', entries: { register: 'r.ods' } },
      primary: 'register',
      delimiter: ',',
      trim_all: true,
      format: 'ods',
      joins: [],
      source_id: 'ID',
      registration: 'REG',
      merge_duplicates: {
        fields: ['owner.name'],
        separator: ' Y ',
        set_on_merge: { 'owner.country': 'CL' },
      },
      mapping: {
        registration: { field: 'REG' },
        status: { constant: 'valid' },
        country: { constant: 'CL' },
        'owner.name': { field: 'OWNER', transform: 'trim_or_null' },
        'owner.country': { field: 'OWNERCC', transform: 'trim_or_null' },
      },
    };
    const buf = await odsBuffer([
      ['ID', 'REG', 'OWNER', 'OWNERCC'],
      ['1', 'CC-AAA', 'FIRST PARTY', 'AR'],
      ['1', 'CC-AAA', 'SECOND PARTY', ''],
    ]);
    const { records, stats } = await mapRows(config, new Map([['register', buf]]));
    expect(stats.failed).toBe(1);
    expect(records.get('1')!.owner.country).toBe('AR');
  });
});

const NZ_FIXTURES = resolve(import.meta.dirname, '..', 'fixtures', 'nz-caa');
const NZ_CONFIG_PATH = resolve(import.meta.dirname, '..', 'sources', 'nz-caa.yaml');

const nzFixtureBuffer = (filename: string): Buffer =>
  readFileSync(resolve(NZ_FIXTURES, 'input', filename));

let nzRecords: Map<string, Aircraft>;
let nzStats: EngineStats;

beforeAll(async () => {
  const config = loadSourceConfig(NZ_CONFIG_PATH);
  const files = new Map([['register', nzFixtureBuffer('register.csv')]]);
  const result = await mapRows(config, files);
  nzRecords = result.records;
  nzStats = result.stats;
});

describe('CAA NZ fixture mapping', () => {
  it('maps all 13 fixture rows with no failures', () => {
    expect(nzStats).toEqual({ total: 13, ok: 13, failed: 0, skipped: 0, duplicateSkipped: 0 });
    expect(nzRecords.size).toBe(13);
  });

  describe('ZK-AAC — Cessna, corporate owner', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = nzRecords.get('ZK-AAC')!;
    });
    it('has correct identity', () => {
      expect(r.source).toBe('nz-caa');
      expect(r.source_id).toBe('ZK-AAC');
      expect(r.registration).toBe('ZK-AAC');
      expect(r.country).toBe('NZ');
    });
    it('lowercases the uppercase Mode S hex to canonical form', () => {
      expect(r.icao_hex).toBe('c81e56');
    });
    it('parses the DD/MM/YYYY registration date as an unambiguous ISO date', () =>
      expect(r.certification_date).toBe('2011-06-01'));
    it('captures MCTOW as a number', () => expect(r.max_takeoff_weight_kg).toBe(598));
    it('keeps manufacturer, model and serial distinct', () => {
      expect(r.manufacturer).toBe('Cessna Aircraft Company');
      expect(r.model).toBe('162');
      expect(r.serial_number).toBe('16200060');
    });
    it('has status=valid (NZ register is an active-fleet snapshot)', () =>
      expect(r.status).toBe('valid'));
  });

  describe('Model Category → airframe_type lookup', () => {
    const cases: [string, NonNullable<Aircraft['airframe_type']>][] = [
      ['ZK-AAC', 'fixed-wing'],
      ['ZK-BFC', 'fixed-wing'],
      ['ZK-HAA', 'rotorcraft'],
      ['ZK-HIV', 'rotorcraft'],
      ['ZK-GAJ', 'glider'],
      ['ZK-GMR', 'glider'],
      ['ZK-GDC', 'glider'],
      ['ZK-CBU', 'balloon'],
      ['ZK-DJW', 'gyroplane'],
    ];
    for (const [mark, expected] of cases) {
      it(`maps ${mark} to ${expected}`, () =>
        expect(nzRecords.get(mark)?.airframe_type).toBe(expected));
    }

    it('maps both microlight classes to other rather than asserting a wing type', () => {
      expect(nzRecords.get('ZK-EII')?.airframe_type).toBe('other');
      expect(nzRecords.get('ZK-AJW')?.airframe_type).toBe('other');
    });
  });

  describe('ZK-GMR — individually owned amateur-built glider', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = nzRecords.get('ZK-GMR')!;
    });
    it('retains the owner name (a bare name is allowed PII)', () =>
      expect(r.owner.name).toBe('JANE DOE'));
    it('parses a 1981 date without windowing the century', () =>
      expect(r.certification_date).toBe('1981-10-27'));
    it('preserves a serial containing a slash', () => expect(r.serial_number).toBe('AACA/445'));
  });

  it('keeps only the country component of Owner Address, never the postal detail', () => {
    for (const r of nzRecords.values()) {
      expect(r.owner.state).toBeNull();
      const blob = JSON.stringify(r);
      for (const fragment of ['Example Street', 'Example Road', 'Testville', 'Queensland', '4559'])
        expect(blob).not.toContain(fragment);
    }
  });

  it('reads owner.country from the address rather than assuming the register country', () => {
    expect(nzRecords.get('ZK-AAC')?.owner.country).toBe('NZ');
    // A constant NZ would have written a false country for this Australian owner.
    expect(nzRecords.get('ZK-EXC')?.owner.country).toBe('AU');
  });

  // 146 live rows withhold the address and name the owner "Private Owner" verbatim — the register
  // never blanks the name itself, so country is the only field an absent address can cost.
  it('nulls owner.country when the address is withheld, keeping the name the register publishes', () => {
    expect(nzRecords.get('ZK-ALY')?.owner).toEqual({
      name: 'Private Owner',
      kind: null,
      state: null,
      country: null,
    });
  });

  it('every record carries a canonical 6-lowercase-hex address inside the NZ block', () => {
    for (const r of nzRecords.values()) {
      expect(r.icao_hex).toMatch(/^[0-9a-f]{6}$/);
      const v = Number.parseInt(r.icao_hex!, 16);
      expect(v).toBeGreaterThanOrEqual(0xc80000);
      expect(v).toBeLessThanOrEqual(0xc87fff);
    }
  });

  it('publishes no operator or engine data, which NZ does not carry', () => {
    for (const r of nzRecords.values()) {
      expect(r.operator).toEqual({ name: null, kind: null, state: null, country: null });
      expect(r.engine).toEqual({
        manufacturer: null,
        model: null,
        type: null,
        count: null,
        horsepower: null,
        thrust_lbs: null,
      });
      expect(r.owner.kind).toBeNull();
      expect(r.year_manufactured).toBeNull();
    }
  });

  describe('Model Category → build_certification', () => {
    it('marks the amateur-built and microlight categories not-type-certificated', () => {
      for (const mark of ['ZK-BFC', 'ZK-HIV', 'ZK-GMR', 'ZK-EII', 'ZK-AJW']) {
        expect(nzRecords.get(mark)?.build_certification).toBe('not-type-certificated');
      }
    });

    it('leaves the remaining categories null via an explicit null lookup value, not a default', () => {
      for (const mark of ['ZK-AAC', 'ZK-HAA', 'ZK-GAJ', 'ZK-GDC', 'ZK-CBU', 'ZK-DJW']) {
        expect(nzRecords.get(mark)?.build_certification).toBeNull();
      }
    });
  });

  it('fails loudly on an unrecognized Model Category instead of nulling the airframe', async () => {
    const config = loadSourceConfig(NZ_CONFIG_PATH);
    const header = nzFixtureBuffer('register.csv').toString('utf8').split('\n')[0];
    const drifted = `${header}\nSeaplane (Amphibian),ZK-ZZZ,01/06/2011,Maker,Model,1,600,Owner Limited,"1 Example Street, Testville 1234, New Zealand",C81E57,0,\n`;
    const { stats } = await mapRows(config, new Map([['register', Buffer.from(drifted, 'utf8')]]));
    expect(stats.failed).toBe(1);
    expect(stats.ok).toBe(0);
  });
});

describe('unmatched lookup reporting', () => {
  const config = {
    id: 'synthetic-lookup',
    label: 't',
    country: 'US',
    language: 'en',
    encoding: 'utf8' as const,
    download: { url: 'https://example.com/x.zip', format: 'zip' as const, entries: { f: 'f.txt' } },
    primary: 'f',
    delimiter: ',',
    trim_all: false,
    format: 'csv' as const,
    joins: [],
    source_id: 'ID',
    registration: 'REG',
    mapping: {
      registration: { field: 'REG' },
      status: { constant: 'valid' },
      country: { constant: 'US' },
      airframe_type: { field: 'KIND', lookup: { Known: 'glider' }, default: null },
    },
  };

  // 55,611 identical lines came out of one FAA run before this: the value is a property of the
  // register, so the row count is the only thing repetition adds — and it buried the errors.
  it('reports one line per distinct unmatched value, carrying the row count', async () => {
    const rows = ['ID,REG,KIND', '1,N1,Mystery', '2,N2,Mystery', '3,N3,Mystery', '4,N4,Other'];
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});
    try {
      await mapRows(config, new Map([['f', Buffer.from(rows.join('\n'))]]));
      const lines = logSpy.mock.calls
        .map((c) => String(c[0]))
        .filter((l) => l.includes('map_lookup_default'));
      expect(lines).toHaveLength(2);
      expect(lines.some((l) => l.includes('value=Mystery') && l.includes('rows=3'))).toBe(true);
      expect(lines.some((l) => l.includes('value=Other') && l.includes('rows=1'))).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('does not carry counts from one source into the next', async () => {
    const rows = ['ID,REG,KIND', '1,N1,Mystery'];
    const buf = new Map([['f', Buffer.from(rows.join('\n'))]]);
    await mapRows(config, buf);
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});
    try {
      await mapRows(config, buf);
      const line = logSpy.mock.calls
        .map((c) => String(c[0]))
        .find((l) => l.includes('map_lookup_default'));
      expect(line).toContain('rows=1');
    } finally {
      logSpy.mockRestore();
    }
  });

  // The refresh matrix runs sources concurrently in one process. A single shared accumulator let
  // either run's entry clear the other's counts and report values under the wrong source id.
  it('keeps the counts of concurrently mapped sources apart', async () => {
    const a = { ...config, id: 'src-a' };
    const b = { ...config, id: 'src-b' };
    const bufA = new Map([['f', Buffer.from(['ID,REG,KIND', '1,N1,Alpha'].join('\n'))]]);
    const bufB = new Map([
      ['f', Buffer.from(['ID,REG,KIND', '1,N1,Beta', '2,N2,Beta'].join('\n'))],
    ]);
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});
    try {
      await Promise.all([mapRows(a, bufA), mapRows(b, bufB)]);
      const lines = logSpy.mock.calls
        .map((c) => String(c[0]))
        .filter((l) => l.includes('map_lookup_default'));
      expect(lines.some((l) => l.includes('source=src-a') && l.includes('value=Alpha'))).toBe(true);
      expect(
        lines.some(
          (l) => l.includes('source=src-b') && l.includes('value=Beta') && l.includes('rows=2')
        )
      ).toBe(true);
      expect(lines.some((l) => l.includes('source=src-a') && l.includes('value=Beta'))).toBe(false);
    } finally {
      logSpy.mockRestore();
    }
  });

  // A record-count mismatch is upstream drift, and the unrecognized values are the evidence for
  // it. Throwing before the flush withheld them from exactly the run that needed them.
  it('reports unmatched values even when the record-count guard throws', async () => {
    const counted = {
      ...config,
      id: 'src-counted',
      // Matched against the decoded primary, so the published total can sit in a normal cell.
      record_count: { pattern: 'TOTAL=(\\d+)' },
    } as typeof config;
    const rows = ['ID,REG,KIND,NOTE', '1,N1,Mystery,TOTAL=99'];
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});
    try {
      await expect(
        mapRows(counted, new Map([['f', Buffer.from(rows.join('\n'))]]))
      ).rejects.toThrow(/publishes 99/);
      const lines = logSpy.mock.calls
        .map((c) => String(c[0]))
        .filter((l) => l.includes('map_lookup_default'));
      expect(lines.some((l) => l.includes('value=Mystery'))).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });
});

describe('latest_snapshot_by', () => {
  const config: SourceConfig = {
    id: 'synthetic-snapshot',
    label: 't',
    country: 'US',
    language: 'en',
    encoding: 'utf8' as const,
    download: { url: 'https://example.com/x.zip', format: 'zip' as const, entries: { f: 'f.txt' } },
    primary: 'f',
    delimiter: ',',
    trim_all: false,
    format: 'csv' as const,
    joins: [],
    source_id: 'ID',
    registration: 'REG',
    latest_snapshot_by: 'PUB',
    mapping: {
      registration: { field: 'REG' },
      status: { field: 'ST', lookup: { A: 'valid', C: 'cancelled' } },
      country: { constant: 'US' },
    },
  };
  const parse = async (rows: string[], cfg: SourceConfig = config) =>
    mapRows(cfg, new Map([['f', Buffer.from(rows.join('\n'))]]));

  // The reason this exists: an accumulating register keeps a row per publication, so the same mark
  // appears cancelled in the newest and active in an older one. Keeping both serves the stale row.
  it('keeps only the newest publication, so a superseded row cannot survive', async () => {
    const { records, stats } = await parse([
      'ID,REG,ST,PUB',
      '1,N1,A,2025-04-29',
      '2,N1,C,2026-03-09',
      '3,N2,A,2026-03-09',
    ]);
    expect(stats.total).toBe(2);
    expect([...records.values()].map((r) => r.registration).sort()).toEqual(['N1', 'N2']);
    expect(records.get('2')?.status).toBe('cancelled');
    expect(records.get('1')).toBeUndefined();
  });

  it('leaves rows untouched when no snapshot column is declared', async () => {
    const { stats } = await parse(['ID,REG,ST,PUB', '1,N1,A,2025-04-29', '2,N2,A,2026-03-09'], {
      ...config,
      latest_snapshot_by: undefined,
    });
    expect(stats.total).toBe(2);
  });

  // An upstream rename would otherwise drop every row and map zero records — a far quieter
  // failure than refusing to run.
  it('throws when the column holds no value on any row', async () => {
    await expect(parse(['ID,REG,ST,PUB', '1,N1,A,', '2,N2,A,'])).rejects.toThrow(
      /latest_snapshot_by column "PUB" is empty on all 2 rows/
    );
  });

  it('reports what it dropped', async () => {
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});
    try {
      await parse(['ID,REG,ST,PUB', '1,N1,A,2025-04-29', '2,N2,A,2026-03-09']);
      const line = logSpy.mock.calls
        .map((c) => String(c[0]))
        .find((l) => l.includes('map_snapshot_filtered'));
      expect(line).toContain('snapshot=2026-03-09');
      expect(line).toContain('kept=1');
      expect(line).toContain('dropped=1');
    } finally {
      logSpy.mockRestore();
    }
  });
});

describe('TKA Lithuania fixture mapping', () => {
  let r: Map<string, Aircraft>;
  let s: EngineStats;

  beforeAll(async () => {
    const config = loadSourceConfig(resolve(import.meta.dirname, '..', 'sources', 'lt-tka.yaml'));
    const buf = readFileSync(
      resolve(import.meta.dirname, '..', 'fixtures', 'lt-tka', 'input', 'register.csv')
    );
    // Real shape of the `?count()` endpoint, carrying the fixture's own row count. The guard is
    // against the parsed rows, so this is all 13 — both publications, before the snapshot filter.
    const published = readFileSync(
      resolve(import.meta.dirname, '..', 'fixtures', 'lt-tka', 'input', 'count.json'),
      'utf8'
    );
    const out = await mapRows(config, new Map([['register', buf]]), published);
    r = out.records;
    s = out.stats;
  });

  // data.gov.lt keeps every prior publication in the same table; only the newest may be mapped.
  it('drops the superseded publications', () => {
    expect(s.total).toBe(11);
    expect(s.ok).toBe(11);
    expect(s.failed).toBe(0);
    expect([...r.values()].some((a) => a.registration === 'LY SAO')).toBe(false);
  });

  it('keeps both rows of a mark duplicated inside one publication', () => {
    expect([...r.values()].filter((a) => a.registration === 'LY AXX')).toHaveLength(2);
  });

  // TKA fills `tipas` on a reserved row with the intended model, so `other` would have served this
  // mark as a real aircraft. It stays in the artifact; toFeedRows is what keeps it off the feed.
  it('maps a reserved mark to reserved, not other', () => {
    const reserved = [...r.values()].find((a) => a.registration === 'LY JVD')!;
    expect(reserved.status).toBe('reserved');
    expect(reserved.model).toBe('JAK-42');
  });

  it('reads the mark verbatim, space and all', () => {
    expect([...r.values()].every((a) => /^LY [A-Z]{3}$/.test(a.registration))).toBe(true);
  });

  // "NĖRA" is the register saying the aircraft has no base, not naming an aerodrome.
  it('keeps a named home base and nulls the register-stated absence', () => {
    const based = [...r.values()].find((a) => a.registration === 'LY BRR')!;
    expect(based.home_base).toBe('BARYSIAI');
    const unbased = [...r.values()].find((a) => a.registration === 'LY AXX')!;
    expect(unbased.home_base).toBeNull();
  });

  // TKA stamps 0 rather than blanking the cell; passing it through asserts a mass it never measured.
  it('nulls a zero takeoff mass but keeps a zero passenger count', () => {
    const zeroMass = [...r.values()].find((a) => a.registration === 'LY JVD')!;
    expect(zeroMass.max_takeoff_weight_kg).toBeNull();
    const measured = [...r.values()].find((a) => a.registration === 'LY OCQ')!;
    expect(measured.max_takeoff_weight_kg).toBe(638);
    expect(measured.max_passengers).toBe(0);
  });

  it('publishes no Mode S address', () => {
    expect([...r.values()].every((a) => a.icao_hex === null)).toBe(true);
  });

  it('carries no owner or operator name, only the party kind', () => {
    expect([...r.values()].every((a) => a.owner.name === null && a.operator.name === null)).toBe(
      true
    );
    expect([...r.values()].some((a) => a.owner.kind !== null)).toBe(true);
  });

  it('maps airframe kinds, including the seaplane environment', () => {
    const seaplane = [...r.values()].find((a) => a.registration === 'LY YYL')!;
    expect(seaplane.airframe_type).toBe('fixed-wing');
    expect(seaplane.operating_environment).toBe('sea');
    expect([...r.values()].find((a) => a.registration === 'LY GSC')!.airframe_type).toBe('glider');
    expect([...r.values()].find((a) => a.registration === 'LY OCQ')!.airframe_type).toBe('balloon');
    expect([...r.values()].find((a) => a.registration === 'LY KKE')!.airframe_type).toBe(
      'gyroplane'
    );
  });

  it('keeps the propeller string verbatim rather than splitting it', () => {
    const withProp = [...r.values()].find((a) => a.propeller !== null)!;
    expect(withProp.propeller).toContain(',');
  });

  it('takes the year out of the full manufacture date', () => {
    expect([...r.values()].some((a) => a.year_manufactured !== null)).toBe(true);
    expect(
      [...r.values()].every((a) => a.year_manufactured === null || a.year_manufactured > 1900)
    ).toBe(true);
  });
});
