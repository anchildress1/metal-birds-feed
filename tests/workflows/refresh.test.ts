import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// Every matrix job exports its own source as REFRESH_SOURCE, which the pipeline reads as a named
// run and exempts from the paused filter. A source paused only in resolveSources() is therefore
// still pulled by the scheduled fan-out — the daily failure the pause exists to stop. The
// enumeration is the one place that distinguishes a scheduled fleet run from a named recovery
// probe, so the filter has to live there.
const REFRESH = resolve(import.meta.dirname, '..', '..', '.github', 'workflows', 'refresh.yml');
const SOURCES = resolve(import.meta.dirname, '..', '..', 'sources');

const PAUSED_RE = /^paused:[ \t]*true[ \t]*$/m;

describe('refresh workflow source enumeration', () => {
  it('excludes paused sources from the fleet enumeration', async () => {
    const yaml = await readFile(REFRESH, 'utf8');
    // Pinned literally: the enumeration is shell, so nothing else fails if the guard is dropped.
    expect(yaml).toMatch(/grep -qE '\^paused:\[\[:space:\]\]\*true\[\[:space:\]\]\*\$'/);
  });

  it('still resolves a named dispatch verbatim, so a paused source can be probed', async () => {
    const yaml = await readFile(REFRESH, 'utf8');
    const namedBranch = yaml.slice(
      yaml.indexOf('if [ -n "$src" ]'),
      yaml.indexOf('          else')
    );
    expect(namedBranch).toContain('jq -c -n --arg s "$src"');
    // The filter belongs to the fleet branch only — applying it here would break recovery probing.
    expect(namedBranch).not.toContain('grep -qE');
  });

  // The grep is anchored at line start so a `paused` mention inside a comment cannot park a live
  // source, and matches the real flag so a paused one cannot slip through.
  it('matches the flag exactly as the source files write it', () => {
    const files = readdirSync(SOURCES).filter((f) => f.endsWith('.yaml'));
    const paused = files.filter((f) => PAUSED_RE.test(readFileSync(join(SOURCES, f), 'utf8')));
    const active = files.filter((f) => !PAUSED_RE.test(readFileSync(join(SOURCES, f), 'utf8')));

    expect(paused).toContain('lt-tka.yaml');
    expect(active.length).toBeGreaterThan(0);
    // A commented-out mention must not park a source: lt-tka's own comment block says "Paused",
    // and every active file is proof the anchor holds.
    for (const f of active) {
      expect(readFileSync(join(SOURCES, f), 'utf8')).not.toMatch(PAUSED_RE);
    }
  });
});
