import { describe, it, expect, beforeAll } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TextDecoder } from 'node:util';
import { writeOds } from 'hucre/ods';
import { loadSourceConfig } from '../src/config/loader.js';
import { translate } from '../src/engine.js';
import type { EngineStats } from '../src/engine.js';
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
  const result = await translate(config, files);
  casaRecords = result.records;
  casaStats = result.stats;
});

describe('CASA fixture translation', () => {
  it('translates all 11 fixture rows with no failures', () => {
    expect(casaStats).toEqual({ total: 11, ok: 11, failed: 0, skipped: 0 });
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
  const result = await translate(config, files);
  lvRecords = result.records;
  lvStats = result.stats;
});

describe('CAA Latvia fixture translation', () => {
  it('translates all 10 fixture rows with no failures', () => {
    expect(lvStats).toEqual({ total: 10, ok: 10, failed: 0, skipped: 0 });
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

  it('throws when the primary file is absent from the files map', async () => {
    const config = loadSourceConfig(CONFIG_PATH);
    const files = new Map([
      ['acftref', fixtureBuffer('ACFTREF.txt')],
      ['engine', fixtureBuffer('ENGINE.txt')],
    ]);
    await expect(translate(config, files)).rejects.toThrow(
      'Primary file "master" not found in downloaded files'
    );
  });

  it('throws when a join file is absent from the files map', async () => {
    const config = loadSourceConfig(CONFIG_PATH);
    await expect(
      translate(config, new Map([['master', fixtureBuffer('MASTER.txt')]]))
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
    const { records: r, stats } = await translate(modConfig, files);
    expect(stats.failed).toBe(0);
    expect(r.get('00001001')?.year_manufactured).toBeNull();
  });

  it('resolveCompound applies lookup to the compound-transformed result', async () => {
    const config = loadSourceConfig(TC_CONFIG_PATH);
    // TC's airframe_type uses tc_airframe compound transform but no lookup.
    // Adding a lookup exercises the resolveCompound → resolveLookup path (engine.ts line 206).
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
    const { records: r } = await translate(modConfig, files);
    // AAC: Aeroplane + 1 engine → tc_airframe → 'fixed-wing-single-engine' → lookup → 'fixed-wing'
    expect(r.get('AAC')?.airframe_type).toBe('fixed-wing');
  });

  it('resolveLookup falls through to default for a value matching an Object.prototype key', async () => {
    const config: SourceConfig = {
      id: 'synthetic-lookup',
      label: 'synthetic',
      country: 'US',
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
    const { records: r, stats } = await translate(config, files);
    expect(stats.failed).toBe(0);
    expect(r.get('1')?.owner.kind).toBeNull();
  });

  it('counts a duplicate source_id as a failed row instead of silently overwriting', async () => {
    const config: SourceConfig = {
      id: 'synthetic-dup',
      label: 'synthetic',
      country: 'US',
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
    const files = new Map([['primary', Buffer.from('ID,REG\n1,N1\n1,N2\n', 'utf8')]]);
    const { records, stats } = await translate(config, files);
    expect(stats.failed).toBe(1);
    expect(records.size).toBe(1);
    expect(records.get('1')?.registration).toBe('N1'); // first occurrence wins
  });

  it('skips a byte-identical duplicate row instead of failing', async () => {
    const config: SourceConfig = {
      id: 'synthetic-dup-identical',
      label: 'synthetic',
      country: 'US',
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
    const { records, stats } = await translate(config, files);
    expect(stats.failed).toBe(0);
    expect(stats.skipped).toBe(1);
    expect(records.size).toBe(1);
    expect(records.get('1')?.registration).toBe('N1');
  });

  it('fails a duplicate source_id that differs only in an unmapped column', async () => {
    const config: SourceConfig = {
      id: 'synthetic-dup-unmapped',
      label: 'synthetic',
      country: 'US',
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
    // EXTRA is not mapped, so both rows produce identical canonical records. The raw-row compare
    // still catches the upstream difference and fails rather than silently dropping it.
    const files = new Map([['primary', Buffer.from('ID,REG,EXTRA\n1,N1,a\n1,N1,b\n', 'utf8')]]);
    const { records, stats } = await translate(config, files);
    expect(stats.failed).toBe(1);
    expect(records.size).toBe(1);
  });

  it('does not let duplicate skips consume the missing-source_id budget', async () => {
    const config: SourceConfig = {
      id: 'synthetic-dup-budget',
      label: 'synthetic',
      country: 'US',
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
    const { records, stats } = await translate(config, files);
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

    const { records, stats } = await translate(config, files);

    expect(stats.skipped).toBe(1);
    expect(stats.failed).toBe(0);
    expect(records.size).toBe(1);
    expect(records.get('PH-OK')?.registration).toBe('PH-OK');
  });

  describe('NL ILT fixture translation', () => {
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
    let nlStats: { total: number; ok: number; failed: number; skipped: number };

    beforeAll(async () => {
      const config = loadSourceConfig(NL_CONFIG_PATH);
      const buf = readFileSync(NL_FIXTURE);
      const result = await translate(config, new Map([['register', buf]]));
      nlRecords = result.records;
      nlStats = result.stats;
    });

    it('skips the "Information" banner row and translates 8 aircraft', () => {
      expect(nlStats).toEqual({ total: 9, ok: 8, failed: 0, skipped: 1 });
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

    const { records } = await translate(config, files);

    expect(records.size).toBe(1);
    expect(records.get('200')?.registration).toBe('PH-OK');
    expect(records.has('999')).toBe(false);
  });
});

const TW_FIXTURES = resolve(import.meta.dirname, '..', 'fixtures', 'tw-caa');
const TW_CONFIG_PATH = resolve(import.meta.dirname, '..', 'sources', 'tw-caa.yaml');

const twFixtureBuffer = (filename: string): Buffer =>
  readFileSync(resolve(TW_FIXTURES, 'input', filename));

describe('CAA Taiwan fixture translation (binary .xls)', () => {
  let twRecords: Map<string, Aircraft>;
  let twStats: EngineStats;

  beforeAll(async () => {
    const config = loadSourceConfig(TW_CONFIG_PATH);
    const files = new Map([['register', twFixtureBuffer('register.xls')]]);
    const result = await translate(config, files);
    twRecords = result.records;
    twStats = result.stats;
  });
  it('translates 6 aircraft and skips the 6 subtotal/total rows', () => {
    expect(twStats).toEqual({ total: 12, ok: 6, failed: 0, skipped: 6 });
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
  const result = await translate(config, files);
  brRecords = result.records;
  brStats = result.stats;
});

describe('BR-ANAC fixture translation', () => {
  it('translates all 9 fixture rows with no failures (banner row skipped)', () => {
    expect(brStats).toEqual({ total: 9, ok: 9, failed: 0, skipped: 0 });
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
    it('leaves airframe_type null (no canonical UAV enum)', () =>
      expect(r.airframe_type).toBeNull());
    it('maps DRONE to engine type other', () => expect(r.engine.type).toBe('other'));
  });

  describe('PPASW — single turboprop, restricted category', () => {
    let r: Aircraft;
    beforeAll(() => {
      r = brRecords.get('PPASW')!;
    });
    it('maps MOTOR TURBOHELICE to turbo-prop', () => expect(r.engine.type).toBe('turbo-prop'));
    it('maps RESTRITA to the limited category', () => expect(r.category).toBe('limited'));
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

describe('CH-FOCA fixture translation', () => {
  let chRecords: Map<string, Aircraft>;
  let chStats: EngineStats;

  beforeAll(async () => {
    const config: SourceConfig = loadSourceConfig(CH_CONFIG_PATH);
    const buf = readFileSync(resolve(CH_FIXTURES, 'input', 'lfr.json'));
    const result = await translate(config, new Map([['aircraft', buf]]));
    chRecords = result.records;
    chStats = result.stats;
  });

  it('translates every fixture record', () => {
    expect(chStats).toEqual({ total: 11, ok: 11, failed: 0, skipped: 0 });
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

describe('CAA Maldives fixture translation (PDF)', () => {
  const MV_CONFIG = resolve(import.meta.dirname, '..', 'sources', 'mv-caa.yaml');
  const MV_PDF = resolve(import.meta.dirname, '..', 'fixtures', 'mv-caa', 'input', 'register.pdf');
  let mvRecords: Map<string, Aircraft>;

  beforeAll(async () => {
    const config = loadSourceConfig(MV_CONFIG);
    const result = await translate(config, new Map([['register', readFileSync(MV_PDF)]]));
    mvRecords = result.records;
  });

  it('translates all 138 register rows with no failures', () => {
    expect(mvRecords.size).toBe(138);
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
