import { describe, it, expect } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { attributionFor } from '../../src/service/attributions.js';
import { loadSourceConfig } from '../../src/config/loader.js';

describe('attributionFor', () => {
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
  it('never returns an empty credit for an unmapped source', () => {
    const line = attributionFor('zz-new');
    expect(line.length).toBeGreaterThan(0);
    expect(line).toContain('zz-new');
  });

  // DATA_LICENSES.md is the authority for mandated wording (AGENTS.md), but nothing checked that
  // the served string still matches it — the two could drift silently, and the licence conditions
  // are the half that matters. Every recorded mandate is a substring the served notice must carry;
  // losing one (Canada's notices, Taiwan's credit) is a licence breach, not a cosmetic drift.
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
