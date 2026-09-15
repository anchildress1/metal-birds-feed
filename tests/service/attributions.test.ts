import { describe, it, expect } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
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

  // DATA_LICENSES.md is the authority for mandated wording (AGENTS.md), but nothing checked that
  // the served string still matches it — the two could drift silently, and the licence conditions
  // are the half that matters. Every recorded mandate is a substring the served notice must carry;
  // losing one (AESA's citation, NZ's credit) is a licence breach, not a cosmetic drift.
  const RECORDED = /^- ([a-zA-Z0-9_-]+): "([^"]+)"$/gm;

  const noticeSection = (): string => {
    const doc = readFileSync(resolve(import.meta.dirname, '..', '..', 'DATA_LICENSES.md'), 'utf8');
    const start = doc.indexOf('## Required Notices');
    return doc.slice(start, doc.indexOf('\n## ', start + 1));
  };

  const recordedWording = (): Array<{ id: string; text: string }> =>
    [...noticeSection().matchAll(RECORDED)].map((m) => ({ id: m[1], text: m[2] }));

  it('carries every mandated notice inside the served notice', () => {
    // The source ID is part of the recorded syntax so the pairing is asserted, not just the set of
    // strings: two notices swapped between their keys would leave both consumers displaying
    // someone else's licence condition while a set-membership check still passed.
    const required = recordedWording();
    expect(required.length).toBeGreaterThan(0);
    for (const { id, text } of required) expect(`${id}: ${attributionFor(id)}`).toContain(text);
  });
});
