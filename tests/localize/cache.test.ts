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
      hashTranslatable('airworthiness_class', 'x')
    );
  });

  it('differs when the text differs but the field is the same', () => {
    expect(hashTranslatable('cancellation_reason', 'x')).not.toBe(
      hashTranslatable('cancellation_reason', 'y')
    );
  });

  it('produces a 64-character lowercase hex digest', () => {
    expect(hashTranslatable('airworthiness_class', 'x')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('TranslationCacheSchema', () => {
  const hash = hashTranslatable('cancellation_reason', 'AERONAVE EXPORTADA');

  it('accepts a current-version hash -> text envelope', () => {
    expect(
      TranslationCacheSchema.safeParse({
        version: TRANSLATION_CACHE_VERSION,
        entries: { [hash]: 'Aircraft exported' },
        failures: {},
      }).success
    ).toBe(true);
  });

  it('constructs an empty current-version envelope', () => {
    expect(emptyTranslationCache()).toEqual({
      version: TRANSLATION_CACHE_VERSION,
      entries: {},
      failures: {},
    });
    expect(TranslationCacheSchema.safeParse(emptyTranslationCache()).success).toBe(true);
  });

  // A recognized-but-obsolete generation resets to a fresh current envelope rather than failing
  // as corruption, so a version bump self-heals: the caller bills the source once and writes the
  // reset cache back, replacing the stale R2 object instead of degrading to source text forever.
  it('resets an obsolete cache generation to a fresh current envelope', () => {
    const parsed = TranslationCacheSchema.safeParse({
      version: 0,
      entries: { [hash]: 'stale' },
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual(emptyTranslationCache());
  });

  it('rejects data with no numeric version at all', () => {
    expect(TranslationCacheSchema.safeParse({ entries: {} }).success).toBe(false);
    expect(TranslationCacheSchema.safeParse([]).success).toBe(false);
    expect(TranslationCacheSchema.safeParse('not an object').success).toBe(false);
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

  // An empty translation would survive the `?? text` fallback (it is not nullish) and blank a
  // populated upstream field, leaving only *_source_text with the content.
  it.each(['', '   '])('rejects a blank translation: %p', (blank) => {
    expect(
      TranslationCacheSchema.safeParse({
        version: TRANSLATION_CACHE_VERSION,
        entries: { [hash]: blank },
      }).success
    ).toBe(false);
  });

  // `failures` shipped with version 2 and the version literal rejects everything older, so a v2
  // object missing it is malformed, not legacy. Defaulting would normalize a broken contract.
  it('rejects a current-version envelope missing failures', () => {
    expect(
      TranslationCacheSchema.safeParse({
        version: TRANSLATION_CACHE_VERSION,
        entries: {},
      }).success
    ).toBe(false);
  });
});
