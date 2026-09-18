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

  // These three carry no agency-mandated wording, so the Required Notices pairing below says
  // nothing about them — without an exact pin they could be reworded with the suite still green.
  it.each([
    [
      'ch-foca',
      'Source data from the Federal Office of Civil Aviation (FOCA / BAZL), Switzerland — https://app02.bazl.admin.ch/web/bazl/en/; redistribution confirmed by FOCA, normalized into this project schema without implying endorsement.',
    ],
    [
      'hr-ccaa',
      'Source data from the Croatian Civil Aviation Agency (CCAA) — https://www.ccaa.hr/en/list-of-registered-aircraft-94674; publicly accessible with no specified license and treated as Private-use, normalized into this project schema without implying endorsement.',
    ],
    [
      'hu-kh',
      'Source data from the Közlekedési Hatóság (Hungarian Transport Authority), Magyarország Légijármű Lajstroma — https://www.kozlekedesihatosag.kormany.hu/hu/dokumentum/104604; publicly accessible with no specified license and treated as Private-use, normalized into this project schema without implying endorsement.',
    ],
  ])('serves the unmandated %s notice exactly', (id, expected) => {
    expect(attributionFor(id)).toBe(expected);
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
  const RECORDED = /^- ([a-zA-Z0-9_-]+): "([^"]+)"$/;

  const noticeSection = (): string => {
    const doc = readFileSync(resolve(import.meta.dirname, '..', '..', 'DATA_LICENSES.md'), 'utf8');
    const start = doc.indexOf('## Required Notices');
    return doc.slice(start, doc.indexOf('\n## ', start + 1));
  };

  // Throws rather than skips: a mandate that loses its source ID or a quote would match nothing,
  // and the remaining notices keep `required.length` nonzero, so the check below would pass while
  // that licence condition went unguarded.
  const recordedWording = (): Array<{ id: string; text: string }> =>
    noticeSection()
      .split('\n')
      .filter((line) => line.startsWith('- '))
      .map((line) => {
        const entry = RECORDED.exec(line);
        if (!entry) throw new Error(`Malformed Required Notices entry: ${line}`);
        return { id: entry[1], text: entry[2] };
      });

  it('carries every mandated notice inside the served notice', () => {
    // The source ID is part of the recorded syntax so the pairing is asserted, not just the set of
    // strings: two notices swapped between their keys would leave both consumers displaying
    // someone else's licence condition while a set-membership check still passed.
    const required = recordedWording();
    expect(required.length).toBeGreaterThan(0);
    for (const { id, text } of required) expect(`${id}: ${attributionFor(id)}`).toContain(text);
  });
});
