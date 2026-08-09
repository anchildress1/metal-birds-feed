import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

const root = join(import.meta.dir, '..');
const readJson = async (file: string): Promise<unknown> =>
  JSON.parse(await readFile(join(root, file), 'utf8'));

const ConfigSchema = z.looseObject({
  packages: z.looseObject({
    '.': z.looseObject({ 'release-as': z.string().optional() }),
  }),
});

describe('release-please configuration', () => {
  // `release-as` pins the next release to a literal version and keeps pinning it. Once the pinned
  // version has shipped, the manifest already reads it, so every later run recomputes the same
  // number, the release PR tries to re-create an existing tag, `release_created` stays falsy and
  // the deploy job is skipped — releases stop working with nothing red to show for it. A checklist
  // item does not catch that; this does, the moment the pinned version lands in package.json.
  it('drops release-as once the pinned version has shipped', async () => {
    const config = ConfigSchema.parse(await readJson('release-please-config.json'));
    const releaseAs = config.packages['.']['release-as'];
    if (releaseAs === undefined) return;

    const { version } = z
      .looseObject({ version: z.string() })
      .parse(await readJson('package.json'));

    expect(
      version,
      `release-please-config.json still pins "release-as": "${releaseAs}" while package.json is already at ${version}. That version has shipped — delete the release-as key so conventional commits drive the next bump.`
    ).not.toBe(releaseAs);
  });

  // The manifest is what release-please compares against; a pin below it can never produce a
  // release at all, which fails the same silent way.
  it('never pins a release-as at or below the released manifest version', async () => {
    const config = ConfigSchema.parse(await readJson('release-please-config.json'));
    const releaseAs = config.packages['.']['release-as'];
    if (releaseAs === undefined) return;

    const manifest = z
      .looseObject({ '.': z.string() })
      .parse(await readJson('.release-please-manifest.json'));
    const parse = (v: string): number[] => v.split('.').map(Number);
    const [pin, released] = [parse(releaseAs), parse(manifest['.'])];

    expect(
      pin.some((part, i) => part > (released[i] ?? 0)) ||
        pin.findIndex((part, i) => part !== (released[i] ?? 0)) === -1,
      `release-as ${releaseAs} is not ahead of the released manifest version ${manifest['.']}`
    ).toBe(true);
    expect(pin).not.toEqual(released);
  });
});
