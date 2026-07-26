import { describe, it, expect } from 'bun:test';
import { hashTranslatable, TranslationCacheSchema } from '../../src/localize/cache.js';

describe('hashTranslatable', () => {
  it('is stable for the same field and text', () => {
    expect(hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA')).toBe(
      hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA')
    );
  });

  it('differs when the field differs but the text is the same', () => {
    expect(hashTranslatable('cancellation_reason', 'x')).not.toBe(
      hashTranslatable('lien_status', 'x')
    );
  });

  it('differs when the text differs but the field is the same', () => {
    expect(hashTranslatable('cancellation_reason', 'x')).not.toBe(
      hashTranslatable('cancellation_reason', 'y')
    );
  });

  it('produces a 64-character lowercase hex digest', () => {
    expect(hashTranslatable('lien_status', 'x')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('TranslationCacheSchema', () => {
  const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');

  it('accepts a well-formed hash -> text record', () => {
    expect(TranslationCacheSchema.safeParse({ [hash]: 'Aircraft exported' }).success).toBe(true);
  });

  it('accepts an empty record', () => {
    expect(TranslationCacheSchema.safeParse({}).success).toBe(true);
  });

  it('rejects a key that is not a 64-char hex hash', () => {
    expect(TranslationCacheSchema.safeParse({ 'not-a-hash': 'x' }).success).toBe(false);
  });

  it('rejects a non-string value', () => {
    expect(TranslationCacheSchema.safeParse({ [hash]: 42 }).success).toBe(false);
  });
});
