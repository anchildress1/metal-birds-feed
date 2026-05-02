import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { loadSourceConfig } from '../../src/config/loader.js';

const FAA_CONFIG = resolve(import.meta.dirname, '..', '..', 'sources', 'faa.yaml');

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
  });

  it('rejects path traversal', () => {
    expect(() => loadSourceConfig('../../../etc/passwd')).toThrow(/traversal/i);
  });

  it('throws on non-existent file', () => {
    expect(() => loadSourceConfig('sources/nonexistent.yaml')).toThrow();
  });

  it('throws on invalid config schema', async () => {
    const { writeFileSync, unlinkSync } = await import('node:fs');
    const tmp = resolve(import.meta.dirname, '..', '..', 'sources', '_test_invalid.yaml');
    writeFileSync(tmp, 'id: test\nlabel: test\n');
    try {
      expect(() => loadSourceConfig(tmp)).toThrow(/invalid source config/i);
    } finally {
      unlinkSync(tmp);
    }
  });
});
