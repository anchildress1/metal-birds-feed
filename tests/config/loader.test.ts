import { describe, it, expect } from 'bun:test';
import { resolve } from 'node:path';
import { writeFileSync, unlinkSync } from 'node:fs';
import { loadSourceConfig } from '../../src/config/loader.js';

const FAA_CONFIG = resolve(import.meta.dirname, '..', '..', 'sources', 'faa.yaml');
const TC_CONFIG = resolve(import.meta.dirname, '..', '..', 'sources', 'tc-ca.yaml');

describe('loadSourceConfig', () => {
  it('loads valid FAA config', () => {
    const config = loadSourceConfig(FAA_CONFIG);
    expect(config.id).toBe('faa');
    expect(config.country).toBe('US');
    expect(config.encoding).toBe('latin1');
    expect(config.primary).toBe('master');
    expect(config.source_id).toBe('UNIQUE ID');
    expect(config.joins).toHaveLength(2);
    expect(config.joins[0]?.name).toBe('acft');
    expect(config.joins[1]?.name).toBe('eng');
    expect(config.download.headers?.['User-Agent']).toBeDefined();
  });

  it('rejects path traversal', () => {
    expect(() => loadSourceConfig('../../../etc/passwd')).toThrow(/traversal/i);
  });

  it('rejects absolute path outside sandbox', () => {
    expect(() => loadSourceConfig('/etc/passwd')).toThrow(/sandbox/i);
  });

  it('throws on non-existent file', () => {
    expect(() => loadSourceConfig('sources/nonexistent.yaml')).toThrow();
  });

  it('throws on invalid config schema', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_invalid.yaml');
    writeFileSync(tmp, 'id: test\nlabel: test\n');
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('loads valid TC-CA config with compound transforms and explicit columns', () => {
    const config = loadSourceConfig(TC_CONFIG);
    expect(config.id).toBe('tc-ca');
    expect(config.country).toBe('CA');
    expect(config.encoding).toBe('latin1');
    expect(config.columns?.carscurr).toHaveLength(47);
    expect(config.columns?.carsownr).toHaveLength(20);
    expect(config.allowed_missing_source_id_rows).toEqual({
      max: 1,
      field: 'MARK',
      pattern: '^\\d+ rows selected\\.$',
    });
    expect(config.allowed_ragged_rows).toEqual({ carscurr: 1, carsownr: 1 });
    expect(config.mapping['airframe_type']).toMatchObject({
      compound_transform: 'tc_airframe',
      fields: ['AIRCRAFT_CATEGORY_E', 'NUMBER_OF_ENGINES'],
    });
  });

  it('rejects compound_transform without fields', () => {
    const tmp = resolve(
      import.meta.dirname,
      '..',
      '..',
      'sources',
      '_test_compound_no_fields.yaml'
    );
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CA\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { compound_transform: tc_airframe }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/compound_transform requires fields/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects fields without compound_transform', () => {
    const tmp = resolve(
      import.meta.dirname,
      '..',
      '..',
      'sources',
      '_test_fields_no_compound.yaml'
    );
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CA\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { fields: ['A', 'B'] }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/compound_transform requires fields/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('defaults format to csv when omitted', () => {
    const config = loadSourceConfig(FAA_CONFIG);
    expect(config.format).toBe('csv');
    expect(config.sheet).toBeUndefined();
  });

  it('accepts format: ods with optional sheet selector (numeric)', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_format_ods_idx.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { register: register.ods }\nprimary: register\ndelimiter: ','\nformat: ods\nsheet: 0\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      const config = loadSourceConfig(tmp);
      expect(config.format).toBe('ods');
      expect(config.sheet).toBe(0);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('accepts format: xlsx with named sheet selector', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_format_xlsx_named.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: IE\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { register: register.xlsx }\nprimary: register\ndelimiter: ','\nformat: xlsx\nsheet: Register\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      const config = loadSourceConfig(tmp);
      expect(config.format).toBe('xlsx');
      expect(config.sheet).toBe('Register');
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects an unknown format value', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_bad_format.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nformat: pdf\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects a negative sheet index', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_neg_sheet.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.ods }\nprimary: f\ndelimiter: ','\nformat: ods\nsheet: -1\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('accepts download.format: file with a single-alias entries map', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_dl_file.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nencoding: utf8\ndownload:\n  url: https://example.com/x.ods\n  format: file\n  entries: { register: '.' }\nprimary: register\ndelimiter: ','\nformat: ods\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      const config = loadSourceConfig(tmp);
      expect(config.download.format).toBe('file');
      expect(Object.keys(config.download.entries)).toEqual(['register']);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects download.format: file when entries has more than one alias', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_dl_file_multi.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nencoding: utf8\ndownload:\n  url: https://example.com/x.ods\n  format: file\n  entries:\n    a: a.ods\n    b: b.ods\nprimary: a\ndelimiter: ','\nformat: ods\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/exactly one alias.*format.*file/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects two aliases mapping to the same archive path', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_dup_path.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries:\n    a: same.txt\n    b: same.txt\nprimary: a\ndelimiter: ','\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/paths must be unique/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects a primary that does not match a download.entries alias', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_bad_primary.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { register: register.csv }\nprimary: REGISTER.CSV\ndelimiter: ','\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/primary and joins\[\].file must match/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects a joins[].file that does not match a download.entries alias', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_bad_join_file.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CA\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { primary: p.txt, side: s.txt }\nprimary: primary\ndelimiter: ','\njoins:\n  - name: side\n    file: SIDE\n    key: K\n    on: K\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/primary and joins\[\].file must match/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects a columns key that does not match primary or a joins[].file value', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_bad_columns_key.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { register: register.csv }\nprimary: register\ndelimiter: ','\ncolumns:\n  regsiter: [REG]\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: REG }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/must match primary or a joins\[\]\.file value/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects a ragged budget on a non-csv primary', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_ragged_non_csv.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { register: register.ods }\nprimary: register\ndelimiter: ','\nformat: ods\nallowed_ragged_rows: { register: 1 }\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(
        /allowed_ragged_rows\[primary\] only applies to format/i
      );
    } finally {
      unlinkSync(tmp);
    }
  });

  // buildJoinMaps parses joins as CSV regardless of the primary's format, so the budget is live.
  it('accepts a ragged budget on a join of a non-csv-primary source', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_ragged_join.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { register: register.ods, extra: extra.csv }\nprimary: register\ndelimiter: ','\nformat: ods\nallowed_ragged_rows: { extra: 1 }\njoins:\n  - name: ex\n    file: extra\n    on: ID\n    key: ID\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(loadSourceConfig(tmp).allowed_ragged_rows).toEqual({ extra: 1 });
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects a ragged budget keyed to an unknown file alias', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_ragged_bad_key.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CA\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { register: r.csv }\nprimary: register\ndelimiter: ','\nallowed_ragged_rows: { nope: 1 }\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/must match primary or a joins\[\]\.file value/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects duplicate joins[].name values', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_dup_join_names.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CA\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { primary: p.txt, a: a.txt, b: b.txt }\nprimary: primary\ndelimiter: ','\njoins:\n  - name: side\n    file: a\n    key: K\n    on: K\n  - name: side\n    file: b\n    key: K\n    on: K\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/joins\[\].name values must be unique/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects an unknown top-level key instead of silently discarding it', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_unknown_key.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nskiprows: 1\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects an unknown key nested under download', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_unknown_dl_key.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\n  discover_patern: 'x'\nprimary: f\ndelimiter: ','\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects an unknown key inside a mapping entry', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_unknown_map_key.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID, transfrom: trim_or_null }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects constant combined with transform (silent precedence)', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_const_transform.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n  status: { constant: valid, transform: trim_or_null }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects field combined with constant (exactly one mapping kind)', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_field_constant.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID, constant: X }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects transform combined with array_transform', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_two_transforms.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID, transform: trim_or_null, array_transform: br_operational_classes }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects duplicate names within a columns array', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_dup_columns.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\ncolumns:\n  f: [REG, REG]\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: REG }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects a negative allowed_ragged_rows', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_neg_ragged.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nallowed_ragged_rows: -1\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  const pdfYaml = (anchorlessLine: string): string =>
    `id: t\nlabel: t\ncountry: MV\nencoding: utf8\ndownload:\n  url: https://example.com/x.pdf\n  format: file\n  entries: { register: '.' }\nprimary: register\ndelimiter: ','\nformat: pdf\npdf:\n  field_axis: y\n  anchor_pattern: '^8Q-[A-Z]{3}$'\n${anchorlessLine}  column_pos: [100, 50]\ncolumns:\n  register: [value, mark]\nsource_id: mark\nregistration: mark\nmapping:\n  registration: { field: mark }\n`;

  it('accepts pdf.allowed_anchorless_pages', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_pdf_anchorless.yaml');
    writeFileSync(tmp, pdfYaml('  allowed_anchorless_pages: 1\n'));
    try {
      const config = loadSourceConfig(tmp);
      expect(config.pdf?.allowed_anchorless_pages).toBe(1);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('defaults pdf.allowed_anchorless_pages to undefined when omitted', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_pdf_no_anchorless.yaml');
    writeFileSync(tmp, pdfYaml(''));
    try {
      expect(loadSourceConfig(tmp).pdf?.allowed_anchorless_pages).toBeUndefined();
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects a negative pdf.allowed_anchorless_pages', () => {
    const tmp = resolve(
      import.meta.dirname,
      '..',
      '..',
      'sources',
      '_test_pdf_neg_anchorless.yaml'
    );
    writeFileSync(tmp, pdfYaml('  allowed_anchorless_pages: -1\n'));
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects a non-integer pdf.allowed_anchorless_pages', () => {
    const tmp = resolve(
      import.meta.dirname,
      '..',
      '..',
      'sources',
      '_test_pdf_frac_anchorless.yaml'
    );
    writeFileSync(tmp, pdfYaml('  allowed_anchorless_pages: 1.5\n'));
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('accepts discover_url + discover_pattern when set together', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_dl_discover.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nencoding: utf8\ndownload:\n  url: https://example.com/fallback.ods\n  format: file\n  entries: { register: '.' }\n  discover_url: https://example.com/index\n  discover_pattern: 'href="([^"]+\\.ods)"'\nprimary: register\ndelimiter: ','\nformat: ods\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      const config = loadSourceConfig(tmp);
      expect(config.download.discover_url).toBe('https://example.com/index');
      expect(config.download.discover_pattern).toBe('href="([^"]+\\.ods)"');
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects discover_url without discover_pattern', () => {
    const tmp = resolve(
      import.meta.dirname,
      '..',
      '..',
      'sources',
      '_test_dl_discover_lonely.yaml'
    );
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nencoding: utf8\ndownload:\n  url: https://example.com/x.ods\n  format: file\n  entries: { register: '.' }\n  discover_url: https://example.com/index\nprimary: register\ndelimiter: ','\nformat: ods\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/discover_url.*discover_pattern.*together/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects discover_pattern that is not a valid regex', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_dl_discover_badre.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nencoding: utf8\ndownload:\n  url: https://example.com/x.ods\n  format: file\n  entries: { register: '.' }\n  discover_url: https://example.com/index\n  discover_pattern: '['\nprimary: register\ndelimiter: ','\nformat: ods\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/discover_pattern.*valid regular expression/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects invalid allowed missing source_id row regex', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_bad_regex.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CA\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nallowed_missing_source_id_rows:\n  max: 1\n  field: FOOTER\n  pattern: '['\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/valid regular expression/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('accepts a record_count.pattern with exactly one capture group', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_record_count_ok.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CA\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nrecord_count:\n  pattern: 'Total: (\\d+)'\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      const config = loadSourceConfig(tmp);
      expect(config.record_count?.pattern).toBe('Total: (\\d+)');
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects record_count.pattern that is not a valid regex', () => {
    const tmp = resolve(
      import.meta.dirname,
      '..',
      '..',
      'sources',
      '_test_record_count_badre.yaml'
    );
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CA\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nrecord_count:\n  pattern: '['\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(
        /record_count\.pattern.*valid regular expression/i
      );
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects record_count.pattern with no capture group', () => {
    const tmp = resolve(
      import.meta.dirname,
      '..',
      '..',
      'sources',
      '_test_record_count_nogroup.yaml'
    );
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CA\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nrecord_count:\n  pattern: 'Total: \\d+'\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(
        /record_count\.pattern.*exactly one capture group/i
      );
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects record_count.pattern with more than one capture group', () => {
    const tmp = resolve(
      import.meta.dirname,
      '..',
      '..',
      'sources',
      '_test_record_count_twogroups.yaml'
    );
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CA\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nrecord_count:\n  pattern: '(Total): (\\d+)'\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(
        /record_count\.pattern.*exactly one capture group/i
      );
    } finally {
      unlinkSync(tmp);
    }
  });
});

describe('loadSourceConfig — JSON + POST sources', () => {
  const CH_CONFIG = resolve(import.meta.dirname, '..', '..', 'sources', 'ch-foca.yaml');

  it('loads the FOCA config with format json and a POST download', () => {
    const config = loadSourceConfig(CH_CONFIG);
    expect(config.format).toBe('json');
    expect(config.record_path).toBe('');
    expect(config.download.method).toBe('POST');
    expect(config.download.body).toBeDefined();
    expect(config.source_id).toBe('lfrId');
  });

  it('defaults download.method to GET when omitted', () => {
    const config = loadSourceConfig(FAA_CONFIG);
    expect(config.download.method).toBe('GET');
  });

  it('rejects download.body without method POST', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_body_no_post.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CH\nencoding: utf8\ndownload:\n  url: https://example.com/x\n  format: file\n  body: { q: 1 }\n  entries: { aircraft: '.' }\nprimary: aircraft\ndelimiter: ','\nformat: json\nsource_id: lfrId\nregistration: registration\nmapping:\n  registration: { field: registration }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/body is only valid with method POST/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('accepts a json source whose response is itself the record array', () => {
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_json_post.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CH\nencoding: utf8\ndownload:\n  url: https://example.com/x\n  format: file\n  method: POST\n  body: { q: 1 }\n  entries: { aircraft: '.' }\nprimary: aircraft\ndelimiter: ','\nformat: json\nrecord_path: data.items\nsource_id: lfrId\nregistration: registration\nmapping:\n  registration: { field: registration }\n`
    );
    try {
      const config = loadSourceConfig(tmp);
      expect(config.record_path).toBe('data.items');
      expect(config.download.method).toBe('POST');
    } finally {
      unlinkSync(tmp);
    }
  });
});
