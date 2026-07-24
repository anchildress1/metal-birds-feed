import { describe, it, expect } from 'bun:test';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { attributionFor } from '../../src/service/attributions.js';
import { loadSourceConfig } from '../../src/config/loader.js';

describe('attributionFor', () => {
  it('returns the exact required Chile notice (DGAC sole official source + copyright holder)', () => {
    expect(attributionFor('cl-dgac')).toBe(
      'Source data from the Dirección General de Aeronáutica Civil (DGAC) of Chile — the sole official source and copyright holder of the information — https://www.dgac.gob.cl/aeronaves-2/registro-nacional-de-aeronaves/; reused non-commercially for research and reference under Ley N° 17.336, normalized into this project schema without implying endorsement.'
    );
  });

  // Guard against onboarding a source without wiring its runtime notice: every source in sources/
  // must have a specific NOTICES entry, never the generic slug fallback the consumer would display.
  it('maps every onboarded source to a specific notice, never the generic fallback', () => {
    const dir = resolve(import.meta.dirname, '..', '..', 'sources');
    const ids = readdirSync(dir)
      .filter((f) => f.endsWith('.yaml'))
      .map((f) => loadSourceConfig(`sources/${f}`).id);
    const usingFallback = ids.filter(
      (id) =>
        attributionFor(id) ===
        `Source: ${id} aviation registry, normalized into this project schema without implying endorsement.`
    );
    expect(usingFallback).toEqual([]);
  });
  it('returns the exact required notice for a mandated source', () => {
    expect(attributionFor('tc-ca')).toBe(
      'Reproduced and distributed with the permission of the Government of Canada. This product has been produced by or for Ashley Childress and includes data provided by the Government of Canada. The incorporation of data sourced from the Government of Canada within this product shall not be construed as constituting an endorsement by the Government of Canada of our product.'
    );
  });

  it('credits an open source that has no mandated notice', () => {
    expect(attributionFor('faa')).toContain('Federal Aviation Administration (FAA)');
  });

  it('returns the source-specific Norway attribution', () => {
    expect(attributionFor('no-caa')).toBe(
      'Source data from Luftfartstilsynet (Civil Aviation Authority of Norway), Norges luftfartøyregister — https://data.norge.no/datasets/ca241ae5-fc9e-3702-bbcd-5453d2d0f06f; publicly accessible with no specified license and treated as Private-use, normalized into this project schema without implying endorsement.'
    );
  });

  it('never returns an empty credit for an unmapped source', () => {
    const line = attributionFor('zz-new');
    expect(line.length).toBeGreaterThan(0);
    expect(line).toContain('zz-new');
  });
});
