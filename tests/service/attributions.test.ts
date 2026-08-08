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
  // are the half that matters. Any notice recorded there verbatim must be what the consumer sees.
  // DATA_LICENSES.md records fixed wording in three forms, and only one of them was checked. AESA's
  // required citation and NZ's required credit are conditions of those licences — losing either from
  // the served string is a licence breach, not a cosmetic drift — and both were entirely unguarded.
  // `Served verbatim` is the whole notice; the other two are substrings the notice must carry.
  const RECORDED =
    /(Served verbatim|Required citation, verbatim|Required credit, verbatim) \(([a-zA-Z0-9_-]+)\): "([^"]+)"/g;

  const recordedWording = (): Array<{ label: string; id: string; text: string }> => {
    const doc = readFileSync(resolve(import.meta.dirname, '..', '..', 'DATA_LICENSES.md'), 'utf8');
    const section = doc.slice(doc.indexOf('## Required Notices'), doc.indexOf('## Update cadence'));
    return [...section.matchAll(RECORDED)].map((m) => ({ label: m[1], id: m[2], text: m[3] }));
  };

  it('serves every verbatim-recorded notice exactly as DATA_LICENSES.md records it', () => {
    // The source ID is part of the recorded syntax so the pairing is asserted, not just the set of
    // strings: two notices swapped between their NOTICES keys would leave both consumers displaying
    // someone else's licence condition while a set-membership check still passed.
    const whole = recordedWording().filter((r) => r.label === 'Served verbatim');
    expect(whole.length).toBeGreaterThan(0);
    expect(whole.map(({ id }) => attributionFor(id))).toEqual(whole.map(({ text }) => text));
  });

  it('carries every required citation and credit inside the served notice', () => {
    const required = recordedWording().filter((r) => r.label !== 'Served verbatim');
    expect(required.length).toBeGreaterThan(0);
    for (const { id, text, label } of required) {
      expect(`${id}: ${attributionFor(id)}`).toContain(text);
      expect(label).toMatch(/^Required (citation|credit), verbatim$/);
    }
  });

  // The README credit block claims to reproduce what the service serves. An unenforced claim of
  // exactness is how the paraphrased copies got there in the first place.
  //
  // The expected IDs are pinned rather than derived from the block: comparing the block against
  // itself passes just as happily with a credit deleted, which is the regression this guards. Every
  // source without mandated wording belongs here, so a new open source must be credited too.
  const CREDITED_IDS = ['faa', 'lv-caa', 'nl-ilt'];

  it('serves the README source credits exactly as written', () => {
    const doc = readFileSync(resolve(import.meta.dirname, '..', '..', 'README.md'), 'utf8');
    const block = doc.slice(
      doc.indexOf('Additional source credits'),
      doc.indexOf('Correspondence, po')
    );
    const credited = [...block.matchAll(/^- \*\*.+?\*\* \(`([a-zA-Z0-9_-]+)`\) — (.+)$/gm)].map(
      (m) => [m[1], m[2]] as const
    );
    expect(credited.map(([id]) => id).sort()).toEqual([...CREDITED_IDS].sort());
    expect(credited.map(([id]) => [id, attributionFor(id)] as const)).toEqual(credited);
  });

  // A notice recorded without its source ID silently drops out of the pairing check above.
  it('records a source ID against every verbatim notice', () => {
    const doc = readFileSync(resolve(import.meta.dirname, '..', '..', 'DATA_LICENSES.md'), 'utf8');
    const section = doc.slice(doc.indexOf('## Required Notices'), doc.indexOf('## Update cadence'));
    const unbound = [
      ...section.matchAll(
        /(?:Served verbatim|Required citation, verbatim|Required credit, verbatim)(?: \(([^)]+)\))?:/g
      ),
    ]
      .filter((m) => m[1] === undefined)
      .map((m) => m[0]);
    expect(unbound).toEqual([]);
  });
});
