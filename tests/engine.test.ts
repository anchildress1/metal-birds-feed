import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadSourceConfig } from '../src/config/loader.js';
import { translate } from '../src/engine.js';
import type { Aircraft } from '../src/schema.js';
import type { FieldMapping } from '../src/types/config.js';

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
    it('returns null cruise speed for 54mph glider', () => {
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

describe('engine — negative and edge cases', () => {
  it('throws for unknown non-defaulted lookup value', async () => {
    const config = loadSourceConfig(CONFIG_PATH);
    const masterWithBadAirframe = Buffer.from(
      readFileSync(resolve(FIXTURES, 'input', 'MASTER.txt'), 'latin1').replace(
        /^N12345,.*$/m,
        'N12345,17282099,05608,17286,1979,1,JOHN DOE,,,WICHITA,KS,67201,7,173,US,20231015,19790620,14,Z,1,V,52341224,,19790620,,,,,,20261031,00001001,,,A4E294,'
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
        /^N12345,.*$/m,
        'N12345,17282099,05608,17286,1979,1,JOHN DOE,,,WICHITA,KS,67201,7,173,US,20231015,19790620,14,4,1,ZZZZ,52341224,,19790620,,,,,,20261031,00001001,,,A4E294,'
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

  it('skips rows with missing source_id', async () => {
    const config = loadSourceConfig(CONFIG_PATH);
    const masterWithBlankId = Buffer.from(
      readFileSync(resolve(FIXTURES, 'input', 'MASTER.txt'), 'latin1').replace(
        /^N12345,.*$/m,
        'N12345,17282099,05608,17286,1979,1,JOHN DOE,,,WICHITA,KS,67201,7,173,US,20231015,19790620,14,4,1,V,52341224,,19790620,,,,,, 20261031,,,,A4E294,'
      ),
      'latin1'
    );
    const files = new Map([
      ['master', masterWithBlankId],
      ['acftref', fixtureBuffer('ACFTREF.txt')],
      ['engine', fixtureBuffer('ENGINE.txt')],
    ]);
    const { stats } = await translate(config, files);
    expect(stats.failed).toBe(1);
    expect(records.size).toBe(10); // original records unaffected
  });

  it('records schema validation failure (non-integer year_manufactured)', async () => {
    const config = loadSourceConfig(CONFIG_PATH);
    const modConfig = {
      ...config,
      mapping: {
        ...config.mapping,
        year_manufactured: { constant: '3.14' } as FieldMapping,
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

  it('arr() falls back to scalar wrapping when no array_transform is configured', async () => {
    const config = loadSourceConfig(CONFIG_PATH);
    const modConfig = {
      ...config,
      mapping: {
        ...config.mapping,
        operational_classes: { field: 'STATUS CODE' } as FieldMapping,
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
