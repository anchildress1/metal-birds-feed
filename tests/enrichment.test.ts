import { describe, it, expect, afterEach } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Aircraft } from '../src/schema.js';
import {
  toEnrichmentRows,
  sqlLiteral,
  buildEnrichmentSql,
  writeEnrichmentSql,
  type EnrichmentRow,
} from '../src/enrichment.js';

const make = (id: string, hex: string | null, overrides: Partial<Aircraft> = {}): Aircraft => ({
  source: 'faa',
  source_id: id,
  registration: `N${id}`,
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
  legal_owner: { name: null, kind: null, state: null, country: null },
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
  ...overrides,
});

const mapOf = (...records: Aircraft[]): Map<string, Aircraft> =>
  new Map(records.map((r) => [r.source_id, r]));

describe('toEnrichmentRows', () => {
  it('drops records without an icao_hex', () => {
    const rows = toEnrichmentRows(mapOf(make('1', 'a1b2c3'), make('2', null)));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.icao_hex).toBe('a1b2c3');
  });

  it('maps nested owner/operator/engine and descriptive fields into flat columns', () => {
    const [row] = toEnrichmentRows(
      mapOf(
        make('1', 'a1b2c3', {
          icao_type_code: 'C172',
          year_manufactured: 1998,
          seats: 4,
          category: 'standard',
          engine: {
            manufacturer: 'LYCOMING',
            model: 'O-320',
            type: 'reciprocating',
            count: 1,
            horsepower: 160,
            thrust_lbs: null,
          },
          owner: { name: 'Jane Doe', kind: 'individual', state: 'TX', country: 'US' },
          operator: { name: 'Acme Air', kind: 'corporation', state: null, country: 'US' },
          airframe_type: 'fixed-wing-single-engine',
        })
      )
    );
    expect(row).toMatchObject({
      icao_hex: 'a1b2c3',
      registration: 'N1',
      icao_type_code: 'C172',
      year_manufactured: 1998,
      seats: 4,
      category: 'standard',
      airframe_type: 'fixed-wing-single-engine',
      engine_manufacturer: 'LYCOMING',
      engine_model: 'O-320',
      engine_type: 'reciprocating',
      engine_count: 1,
      engine_horsepower: 160,
      owner_name: 'Jane Doe',
      owner_kind: 'individual',
      owner_state: 'TX',
      owner_country: 'US',
      operator_name: 'Acme Air',
      operator_kind: 'corporation',
      operator_country: 'US',
      status: 'valid',
      source: 'faa',
    });
  });

  it('returns an empty array for an empty record set', () => {
    expect(toEnrichmentRows(new Map())).toEqual([]);
  });

  it('collapses records sharing a hex to one row, dropping a cancelled shadow of a live one', () => {
    const rows = toEnrichmentRows(
      mapOf(
        make('1', 'a1b2c3', { status: 'cancelled', registration: 'OLD' }),
        make('2', 'a1b2c3', { status: 'valid', registration: 'NEW' })
      )
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ registration: 'NEW', status: 'valid' });
  });

  it('keeps the most recent record when both share a hex and neither is cancelled', () => {
    const rows = toEnrichmentRows(
      mapOf(
        make('1', 'a1b2c3', { registration: 'OLD', last_action_date: '2020-01-01' }),
        make('2', 'a1b2c3', { registration: 'NEW', last_action_date: '2024-06-01' })
      )
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.registration).toBe('NEW');
  });

  it('is import-order-independent on a hex collision', () => {
    const a = make('1', 'a1b2c3', { status: 'cancelled', registration: 'OLD' });
    const b = make('2', 'a1b2c3', { status: 'valid', registration: 'NEW' });
    const forward = toEnrichmentRows(mapOf(a, b));
    const reverse = toEnrichmentRows(mapOf(b, a));
    expect(forward).toEqual(reverse);
    expect(forward[0]?.registration).toBe('NEW');
  });
});

describe('sqlLiteral', () => {
  it('renders null as NULL', () => {
    expect(sqlLiteral(null)).toBe('NULL');
  });

  it('renders numbers unquoted', () => {
    expect(sqlLiteral(1998)).toBe('1998');
  });

  it('quotes strings', () => {
    expect(sqlLiteral('N12345')).toBe("'N12345'");
  });

  it("doubles embedded single quotes so O'Brien cannot break out of the literal", () => {
    expect(sqlLiteral("O'Brien Aviation")).toBe("'O''Brien Aviation'");
  });
});

describe('buildEnrichmentSql', () => {
  const rowsFor = (n: number): EnrichmentRow[] =>
    Array.from({ length: n }, (_, i) => ({
      icao_hex: i.toString(16).padStart(6, '0'),
      registration: `N${i}`,
      icao_type_code: 'C172',
      status: 'valid',
      country: 'US',
      manufacturer: 'CESSNA',
      model: '172',
      serial_number: null,
      year_manufactured: 1998,
      airframe_type: null,
      category: null,
      engine_manufacturer: null,
      engine_model: null,
      engine_type: null,
      engine_count: 1,
      engine_horsepower: 160,
      engine_thrust_lbs: null,
      seats: 4,
      max_passengers: 3,
      cruise_speed_ktas: 122,
      max_takeoff_weight_kg: null,
      owner_name: null,
      owner_kind: null,
      owner_state: null,
      owner_country: null,
      operator_name: null,
      operator_kind: null,
      operator_state: null,
      operator_country: null,
      source: 'faa',
    }));

  it('leads with a source-scoped DELETE', () => {
    const sql = buildEnrichmentSql('faa', rowsFor(1));
    expect(sql.startsWith("DELETE FROM enrichment WHERE source = 'faa';")).toBe(true);
  });

  it('emits INSERT with every column', () => {
    const sql = buildEnrichmentSql('faa', rowsFor(1));
    expect(sql).toContain(
      'INSERT INTO enrichment (icao_hex, registration, icao_type_code, status, country, manufacturer, model, serial_number, year_manufactured, airframe_type, category, engine_manufacturer, engine_model, engine_type, engine_count, engine_horsepower, engine_thrust_lbs, seats, max_passengers, cruise_speed_ktas, max_takeoff_weight_kg, owner_name, owner_kind, owner_state, owner_country, operator_name, operator_kind, operator_state, operator_country, source) VALUES'
    );
  });

  it('renders numeric columns bare (unquoted)', () => {
    const sql = buildEnrichmentSql('faa', rowsFor(1));
    expect(sql).toContain('1998'); // year_manufactured
    expect(sql).not.toContain("'1998'");
  });

  it('guards the upsert so a cancelled row cannot overwrite a live one', () => {
    const sql = buildEnrichmentSql('faa', rowsFor(1));
    expect(sql).toContain('ON CONFLICT(icao_hex) DO UPDATE SET');
    expect(sql).toContain(
      "WHERE excluded.status <> 'cancelled' OR enrichment.status = 'cancelled'"
    );
  });

  it('chunks rows past the batch size into multiple INSERT statements', () => {
    const sql = buildEnrichmentSql('faa', rowsFor(501));
    const inserts = sql.match(/INSERT INTO enrichment/g) ?? [];
    expect(inserts).toHaveLength(2);
  });

  it('escapes values inside the emitted rows', () => {
    const rows = rowsFor(1);
    rows[0].owner_name = "O'Brien";
    const sql = buildEnrichmentSql('faa', rows);
    expect(sql).toContain("'O''Brien'");
  });

  it('emits only the DELETE when there are no rows', () => {
    const sql = buildEnrichmentSql('faa', []);
    expect(sql).toContain('DELETE FROM enrichment');
    expect(sql).not.toContain('INSERT');
  });
});

describe('writeEnrichmentSql', () => {
  const created: string[] = [];
  const prior = process.env['MBF_ENRICH_SQL_DIR'];

  afterEach(async () => {
    if (prior === undefined) delete process.env['MBF_ENRICH_SQL_DIR'];
    else process.env['MBF_ENRICH_SQL_DIR'] = prior;
    await Promise.all(created.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  });

  it('is a no-op when MBF_ENRICH_SQL_DIR is unset', async () => {
    delete process.env['MBF_ENRICH_SQL_DIR'];
    await writeEnrichmentSql('faa', mapOf(make('1', 'a1b2c3')));
    // No throw, nothing to assert beyond completion — the guard returns before any fs work.
  });

  it('writes <source>.sql when the dir is set', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mbf-enrich-'));
    created.push(dir);
    process.env['MBF_ENRICH_SQL_DIR'] = dir;
    await writeEnrichmentSql('faa', mapOf(make('1', 'a1b2c3'), make('2', null)));
    const sql = await readFile(join(dir, 'faa.sql'), 'utf8');
    expect(sql).toContain("DELETE FROM enrichment WHERE source = 'faa';");
    expect(sql).toContain("'a1b2c3'");
  });

  it('logs and does not throw when the target dir cannot be created', async () => {
    // Point at a path whose parent is a file, so mkdir fails — the best-effort guard must swallow it.
    const dir = await mkdtemp(join(tmpdir(), 'mbf-enrich-'));
    created.push(dir);
    const filePath = join(dir, 'blocker');
    await writeEnrichmentSql('faa', mapOf(make('1', 'a1b2c3'))); // warm the dir
    process.env['MBF_ENRICH_SQL_DIR'] = join(filePath, 'nested');
    await writeFile(filePath, 'x');
    await writeEnrichmentSql('faa', mapOf(make('1', 'a1b2c3')));
  });
});
