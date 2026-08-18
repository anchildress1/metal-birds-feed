import { describe, it, expect } from 'bun:test';
import { resolve } from 'node:path';
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { loadSourceConfig } from '../../src/config/loader.js';

const FAA_CONFIG = resolve(import.meta.dirname, '..', '..', 'sources', 'faa.yaml');
const TC_CONFIG = resolve(import.meta.dirname, '..', '..', 'sources', 'tc-ca.yaml');
const NZ_CONFIG = resolve(import.meta.dirname, '..', '..', 'sources', 'nz-caa.yaml');

// Throwaway configs stay out of sources/: `resolveAllSources()` and the runtime-attribution guard
// both enumerate that directory, so one file left behind by an interrupted run becomes a phantom
// source for the pipeline and every later test run. Still inside the repo root the loader sandboxes to.
const TMP_CONFIG_DIR = resolve(import.meta.dirname, '..', '..', '.tmp-test-configs');
const tmpConfig = (name: string): string => {
  mkdirSync(TMP_CONFIG_DIR, { recursive: true });
  return resolve(TMP_CONFIG_DIR, name);
};

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
    const tmp = tmpConfig('_test_invalid.yaml');
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
    const tmp = tmpConfig('_test_compound_no_fields.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CA\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { compound_transform: tc_airframe }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/compound_transform requires fields/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects fields without compound_transform', () => {
    const tmp = tmpConfig('_test_fields_no_compound.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CA\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { fields: ['A', 'B'] }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/compound_transform requires fields/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('loads cl-dgac config with a merge_duplicates policy', () => {
    const config = loadSourceConfig(
      resolve(import.meta.dirname, '..', '..', 'sources', 'cl-dgac.yaml')
    );
    expect(config.merge_duplicates).toEqual({
      fields: ['operator.name'],
      separator: ' Y ',
      set_on_merge: { 'operator.kind': 'co-owner' },
    });
  });

  it('rejects merge_duplicates with an empty fields array', () => {
    const tmp = tmpConfig('_test_merge_empty.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CL\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nsource_id: ID\nregistration: ID\nmerge_duplicates:\n  fields: []\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  // A typo'd path is written into the record, stripped by re-validation, and leaves the intended
  // field unset with no diagnostic — the load must reject it instead.
  it('rejects merge_duplicates paths outside the canonical schema', () => {
    const tmp = tmpConfig('_test_merge_path.yaml');
    const base = `id: t\nlabel: t\ncountry: CL\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nsource_id: ID\nregistration: ID\n`;
    const mapping = `mapping:\n  registration: { field: ID }\n`;
    try {
      writeFileSync(tmp, `${base}merge_duplicates:\n  fields: ['operator.nme']\n${mapping}`);
      expect(() => loadSourceConfig(tmp)).toThrow(/operator\.nme.*not a canonical schema path/i);

      writeFileSync(
        tmp,
        `${base}merge_duplicates:\n  fields: ['operator.name']\n  set_on_merge:\n    operator.knd: co-owner\n${mapping}`
      );
      expect(() => loadSourceConfig(tmp)).toThrow(/operator\.knd.*not a canonical schema path/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  // Stamping runs after concatenation, so a path in both lists loses every concatenated party to
  // the stamp while the run still reports success — the exact silent loss merge_duplicates exists
  // to prevent.
  it('rejects a merge_duplicates path declared in both fields and set_on_merge', () => {
    const tmp = tmpConfig('_test_merge_overlap.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CL\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nsource_id: ID\nregistration: ID\nmerge_duplicates:\n  fields: ['owner.name']\n  set_on_merge:\n    owner.name: STAMPED\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/both fields and set_on_merge/i);
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
    const tmp = tmpConfig('_test_format_ods_idx.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { register: register.ods }\nprimary: register\ndelimiter: ','\nformat: ods\nsheet: 0\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
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
    const tmp = tmpConfig('_test_format_xlsx_named.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: IE\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { register: register.xlsx }\nprimary: register\ndelimiter: ','\nformat: xlsx\nsheet: Register\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
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
    const tmp = tmpConfig('_test_bad_format.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nformat: pdf\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects a negative sheet index', () => {
    const tmp = tmpConfig('_test_neg_sheet.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.ods }\nprimary: f\ndelimiter: ','\nformat: ods\nsheet: -1\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('accepts download.format: file with a single-alias entries map', () => {
    const tmp = tmpConfig('_test_dl_file.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.ods\n  format: file\n  entries: { register: '.' }\nprimary: register\ndelimiter: ','\nformat: ods\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
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
    const tmp = tmpConfig('_test_dl_file_multi.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.ods\n  format: file\n  entries:\n    a: a.ods\n    b: b.ods\nprimary: a\ndelimiter: ','\nformat: ods\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/exactly one alias.*format.*file/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects two aliases mapping to the same archive path', () => {
    const tmp = tmpConfig('_test_dup_path.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries:\n    a: same.txt\n    b: same.txt\nprimary: a\ndelimiter: ','\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/paths must be unique/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects a primary that does not match a download.entries alias', () => {
    const tmp = tmpConfig('_test_bad_primary.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { register: register.csv }\nprimary: REGISTER.CSV\ndelimiter: ','\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/primary and joins\[\].file must match/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects a joins[].file that does not match a download.entries alias', () => {
    const tmp = tmpConfig('_test_bad_join_file.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CA\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { primary: p.txt, side: s.txt }\nprimary: primary\ndelimiter: ','\njoins:\n  - name: side\n    file: SIDE\n    key: K\n    on: K\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/primary and joins\[\].file must match/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  // A merging join silently takes row one's value for any column it does not name, so a mapped
  // column left off the list would quietly report the first party's data for all of them.
  it("rejects a mapped join column missing from that join's merge_duplicates", () => {
    const tmp = tmpConfig('_test_join_merge_uncovered.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CA\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { primary: p.txt, side: s.txt }\nprimary: primary\ndelimiter: ','\njoins:\n  - name: side\n    file: side\n    key: K\n    on: K\n    merge_duplicates:\n      fields: [NAME]\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n  owner.name: { field: 'side.NAME' }\n  owner.state: { field: 'side.PROV' }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/merge_duplicates fields or set_on_merge/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('accepts a mapped join column covered by set_on_merge', () => {
    const tmp = tmpConfig('_test_join_merge_covered.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CA\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { primary: p.txt, side: s.txt }\nprimary: primary\ndelimiter: ','\njoins:\n  - name: side\n    file: side\n    key: K\n    on: K\n    merge_duplicates:\n      fields: [NAME]\n      set_on_merge:\n        PROV: shared\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n  owner.name: { field: 'side.NAME' }\n  owner.state: { field: 'side.PROV' }\n`
    );
    try {
      expect(loadSourceConfig(tmp).joins[0]?.merge_duplicates?.fields).toEqual(['NAME']);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects a columns key that does not match primary or a joins[].file value', () => {
    const tmp = tmpConfig('_test_bad_columns_key.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { register: register.csv }\nprimary: register\ndelimiter: ','\ncolumns:\n  regsiter: [REG]\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: REG }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/must match primary or a joins\[\]\.file value/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects a ragged budget on a non-csv primary', () => {
    const tmp = tmpConfig('_test_ragged_non_csv.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { register: register.ods }\nprimary: register\ndelimiter: ','\nformat: ods\nallowed_ragged_rows: { register: 1 }\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
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
    const tmp = tmpConfig('_test_ragged_join.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { register: register.ods, extra: extra.csv }\nprimary: register\ndelimiter: ','\nformat: ods\nallowed_ragged_rows: { extra: 1 }\njoins:\n  - name: ex\n    file: extra\n    on: ID\n    key: ID\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(loadSourceConfig(tmp).allowed_ragged_rows).toEqual({ extra: 1 });
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects a ragged budget keyed to an unknown file alias', () => {
    const tmp = tmpConfig('_test_ragged_bad_key.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CA\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { register: r.csv }\nprimary: register\ndelimiter: ','\nallowed_ragged_rows: { nope: 1 }\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/must match primary or a joins\[\]\.file value/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects duplicate joins[].name values', () => {
    const tmp = tmpConfig('_test_dup_join_names.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CA\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { primary: p.txt, a: a.txt, b: b.txt }\nprimary: primary\ndelimiter: ','\njoins:\n  - name: side\n    file: a\n    key: K\n    on: K\n  - name: side\n    file: b\n    key: K\n    on: K\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/joins\[\].name values must be unique/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects an unknown top-level key instead of silently discarding it', () => {
    const tmp = tmpConfig('_test_unknown_key.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nskiprows: 1\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects an unknown key nested under download', () => {
    const tmp = tmpConfig('_test_unknown_dl_key.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\n  discover_patern: 'x'\nprimary: f\ndelimiter: ','\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects an unknown key inside a mapping entry', () => {
    const tmp = tmpConfig('_test_unknown_map_key.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID, transfrom: trim_or_null }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects constant combined with transform (silent precedence)', () => {
    const tmp = tmpConfig('_test_const_transform.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n  status: { constant: valid, transform: trim_or_null }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects field combined with constant (exactly one mapping kind)', () => {
    const tmp = tmpConfig('_test_field_constant.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID, constant: X }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects transform combined with array_transform', () => {
    const tmp = tmpConfig('_test_two_transforms.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID, transform: trim_or_null, array_transform: br_operational_classes }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects duplicate names within a columns array', () => {
    const tmp = tmpConfig('_test_dup_columns.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\ncolumns:\n  f: [REG, REG]\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: REG }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects a negative allowed_ragged_rows', () => {
    const tmp = tmpConfig('_test_neg_ragged.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nallowed_ragged_rows: -1\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  const pdfYaml = (anchorlessLine: string): string =>
    `id: t\nlabel: t\ncountry: MV\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.pdf\n  format: file\n  entries: { register: '.' }\nprimary: register\ndelimiter: ','\nformat: pdf\npdf:\n  field_axis: y\n  anchor_pattern: '^8Q-[A-Z]{3}$'\n${anchorlessLine}  column_pos: [100, 50]\ncolumns:\n  register: [value, mark]\nsource_id: mark\nregistration: mark\nmapping:\n  registration: { field: mark }\n`;

  it('accepts pdf.allowed_anchorless_pages', () => {
    const tmp = tmpConfig('_test_pdf_anchorless.yaml');
    writeFileSync(tmp, pdfYaml('  allowed_anchorless_pages: 1\n'));
    try {
      const config = loadSourceConfig(tmp);
      expect(config.pdf?.allowed_anchorless_pages).toBe(1);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('defaults pdf.allowed_anchorless_pages to undefined when omitted', () => {
    const tmp = tmpConfig('_test_pdf_no_anchorless.yaml');
    writeFileSync(tmp, pdfYaml(''));
    try {
      expect(loadSourceConfig(tmp).pdf?.allowed_anchorless_pages).toBeUndefined();
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects a negative pdf.allowed_anchorless_pages', () => {
    const tmp = tmpConfig('_test_pdf_neg_anchorless.yaml');
    writeFileSync(tmp, pdfYaml('  allowed_anchorless_pages: -1\n'));
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects a non-integer pdf.allowed_anchorless_pages', () => {
    const tmp = tmpConfig('_test_pdf_frac_anchorless.yaml');
    writeFileSync(tmp, pdfYaml('  allowed_anchorless_pages: 1.5\n'));
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('accepts discover_url + discover_pattern when set together', () => {
    const tmp = tmpConfig('_test_dl_discover.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/fallback.ods\n  format: file\n  entries: { register: '.' }\n  discover_url: https://example.com/index\n  discover_pattern: 'href="([^"]+\\.ods)"'\nprimary: register\ndelimiter: ','\nformat: ods\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      const config = loadSourceConfig(tmp);
      expect(config.download.discover_url).toBe('https://example.com/index');
      expect(config.download.discover_pattern).toBe('href="([^"]+\\.ods)"');
    } finally {
      unlinkSync(tmp);
    }
  });

  const languageConfig = (language: string): string =>
    `id: t\nlabel: t\ncountry: NZ\nlanguage: ${language}\nencoding: utf8\ndownload:\n  url: https://example.com/register.csv\n  format: file\n  entries: { register: register.csv }\nprimary: register\ndelimiter: ','\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`;

  const withLanguageConfig = <T>(language: string, assert: (path: string) => T): T => {
    const tmp = tmpConfig('_test_language.yaml');
    writeFileSync(tmp, languageConfig(language));
    try {
      return assert(tmp);
    } finally {
      unlinkSync(tmp);
    }
  };

  it.each(['en', 'es', 'pt', 'no', 'et', 'aa'])(
    'accepts the assigned ISO 639-1 code %s',
    (code) => {
      withLanguageConfig(code, (path) => expect(loadSourceConfig(path).language).toBe(code));
    }
  );

  // `em` is the load-bearing case: a well-formed typo for `en` that passes a shape-only check,
  // then misses the exact `language === 'en'` gate and ships curated English to be reworded.
  it.each(['em', 'xx', 'zz', 'qq'])('rejects the unassigned two-letter code %s', (code) => {
    withLanguageConfig(code, (path) =>
      expect(() => loadSourceConfig(path)).toThrow(/assigned ISO 639-1 code/i)
    );
  });

  it.each(['EN', 'eng', 'e', 'e1'])('rejects the malformed language value %s', (code) => {
    withLanguageConfig(code, (path) =>
      expect(() => loadSourceConfig(path)).toThrow(/language must be/i)
    );
  });

  it('rejects a mapping key that is not a canonical schema path', () => {
    const tmp = tmpConfig('_test_mapping_key.yaml');
    // A one-character slip in a `_source_text` companion is the case that matters: engine.ts
    // mirrors the primary field when the key is absent, so this would silently store the
    // English transform output as the untranslated original.
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: ES\nlanguage: es\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n  airworthiness_class_source_txt: { field: CLASE }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/not a canonical schema path/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('accepts the canonical _source_text companion keys', () => {
    const config = loadSourceConfig(
      resolve(import.meta.dirname, '..', '..', 'sources', 'es-aesa.yaml')
    );
    expect(config.mapping['airworthiness_class_source_text']).toBeDefined();
  });

  it('accepts prime_url when every cookie-bearing request shares its origin', () => {
    const config = loadSourceConfig(NZ_CONFIG);

    expect(config.download.prime_url).toBe('https://www.aviation.govt.nz/');
    expect(new URL(config.download.url).origin).toBe('https://www.aviation.govt.nz');
  });

  it.each([
    {
      label: 'download URL',
      url: 'https://downloads.example.net/register.csv',
      discovery: '',
    },
    {
      label: 'discovery URL',
      url: 'https://example.com/register.csv',
      discovery:
        '  discover_url: https://discovery.example.net/index\n  discover_pattern: \'href=\\"([^\\"]+\\.csv)\\"\'\n',
    },
  ])('rejects prime_url with a cross-origin $label', ({ url, discovery }) => {
    const tmp = tmpConfig('_test_prime_origin.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NZ\nencoding: utf8\ndownload:\n  prime_url: https://example.com/\n  url: ${url}\n  format: file\n  entries: { register: register.csv }\n${discovery}primary: register\ndelimiter: ','\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/prime_url must share an origin/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects discover_url without discover_pattern', () => {
    const tmp = tmpConfig('_test_dl_discover_lonely.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.ods\n  format: file\n  entries: { register: '.' }\n  discover_url: https://example.com/index\nprimary: register\ndelimiter: ','\nformat: ods\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/discover_url.*discover_pattern.*together/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects discover_pattern that is not a valid regex', () => {
    const tmp = tmpConfig('_test_dl_discover_badre.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: NL\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.ods\n  format: file\n  entries: { register: '.' }\n  discover_url: https://example.com/index\n  discover_pattern: '['\nprimary: register\ndelimiter: ','\nformat: ods\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/discover_pattern.*valid regular expression/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects invalid allowed missing source_id row regex', () => {
    const tmp = tmpConfig('_test_bad_regex.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CA\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nallowed_missing_source_id_rows:\n  max: 1\n  field: FOOTER\n  pattern: '['\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/valid regular expression/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('accepts a record_count.pattern with exactly one capture group', () => {
    const tmp = tmpConfig('_test_record_count_ok.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CA\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nrecord_count:\n  pattern: 'Total: (\\d+)'\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
    );
    try {
      const config = loadSourceConfig(tmp);
      expect(config.record_count?.pattern).toBe('Total: (\\d+)');
    } finally {
      unlinkSync(tmp);
    }
  });

  it('rejects record_count.pattern that is not a valid regex', () => {
    const tmp = tmpConfig('_test_record_count_badre.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CA\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nrecord_count:\n  pattern: '['\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
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
    const tmp = tmpConfig('_test_record_count_nogroup.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CA\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nrecord_count:\n  pattern: 'Total: \\d+'\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
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
    const tmp = tmpConfig('_test_record_count_twogroups.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CA\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x.zip\n  format: zip\n  entries: { f: f.txt }\nprimary: f\ndelimiter: ','\nrecord_count:\n  pattern: '(Total): (\\d+)'\nsource_id: ID\nregistration: ID\nmapping:\n  registration: { field: ID }\n`
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
    const tmp = tmpConfig('_test_body_no_post.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CH\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x\n  format: file\n  body: { q: 1 }\n  entries: { aircraft: '.' }\nprimary: aircraft\ndelimiter: ','\nformat: json\nsource_id: lfrId\nregistration: registration\nmapping:\n  registration: { field: registration }\n`
    );
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/body is only valid with method POST/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('accepts a json source whose response is itself the record array', () => {
    const tmp = tmpConfig('_test_json_post.yaml');
    writeFileSync(
      tmp,
      `id: t\nlabel: t\ncountry: CH\nlanguage: en\nencoding: utf8\ndownload:\n  url: https://example.com/x\n  format: file\n  method: POST\n  body: { q: 1 }\n  entries: { aircraft: '.' }\nprimary: aircraft\ndelimiter: ','\nformat: json\nrecord_path: data.items\nsource_id: lfrId\nregistration: registration\nmapping:\n  registration: { field: registration }\n`
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
