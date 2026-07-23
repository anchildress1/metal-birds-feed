import { describe, it, expect } from 'bun:test';
import { attributionFor } from '../../src/service/attributions.js';

describe('attributionFor', () => {
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
