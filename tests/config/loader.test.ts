import { describe, it, expect } from 'vitest';
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
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_dl_discover_lonely.yaml');
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
});
