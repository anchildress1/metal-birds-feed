import { describe, it, expect } from 'bun:test';
import {
  emptyTranslationCache,
  hashTranslatable,
  TRANSLATION_CACHE_VERSION,
  TranslationCacheSchema,
} from '../../src/localize/cache.js';

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

  it('accepts a current-version hash -> text envelope', () => {
    expect(
      TranslationCacheSchema.safeParse({
        version: TRANSLATION_CACHE_VERSION,
        entries: { [hash]: 'Aircraft exported' },
      }).success
    ).toBe(true);
  });

  it('constructs an empty current-version envelope', () => {
    expect(emptyTranslationCache()).toEqual({
      version: TRANSLATION_CACHE_VERSION,
      entries: {},
    });
    expect(TranslationCacheSchema.safeParse(emptyTranslationCache()).success).toBe(true);
  });

  it('rejects an obsolete cache generation', () => {
    expect(
      TranslationCacheSchema.safeParse({ version: 0, entries: { [hash]: 'stale' } }).success
    ).toBe(false);
  });

  it('rejects a key that is not a 64-char hex hash', () => {
    expect(
      TranslationCacheSchema.safeParse({
        version: TRANSLATION_CACHE_VERSION,
        entries: { 'not-a-hash': 'x' },
      }).success
    ).toBe(false);
  });

  it('rejects a non-string value', () => {
    expect(
      TranslationCacheSchema.safeParse({
        version: TRANSLATION_CACHE_VERSION,
        entries: { [hash]: 42 },
      }).success
    ).toBe(false);
  });
});
