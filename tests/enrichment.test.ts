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

  it('maps nested owner/operator names into flat columns', () => {
    const [row] = toEnrichmentRows(
      mapOf(
        make('1', 'a1b2c3', {
          owner: { name: 'Jane Doe', kind: null, state: null, country: 'US' },
          operator: { name: 'Acme Air', kind: null, state: null, country: null },
          airframe_type: 'fixed-wing-single-engine',
        })
      )
    );
    expect(row).toMatchObject({
      icao_hex: 'a1b2c3',
      registration: 'N1',
      owner_name: 'Jane Doe',
      owner_country: 'US',
      operator_name: 'Acme Air',
      airframe_type: 'fixed-wing-single-engine',
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
      airframe_type: null,
      manufacturer: 'CESSNA',
      model: '172',
      owner_name: null,
      owner_country: null,
      operator_name: null,
      status: 'valid',
      source: 'faa',
    }));

  it('leads with a source-scoped DELETE', () => {
    const sql = buildEnrichmentSql('faa', rowsFor(1));
    expect(sql.startsWith("DELETE FROM enrichment WHERE source = 'faa';")).toBe(true);
  });

  it('emits INSERT with every column', () => {
    const sql = buildEnrichmentSql('faa', rowsFor(1));
    expect(sql).toContain(
      'INSERT INTO enrichment (icao_hex, registration, airframe_type, manufacturer, model, owner_name, owner_country, operator_name, status, source) VALUES'
    );
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
