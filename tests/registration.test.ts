import { describe, expect, it } from 'bun:test';
import { REGISTRATION_KEY_RE, registrationKey } from '../src/registration.js';

describe('registrationKey', () => {
  it.each([
    ['', ''],
    ['- /.', ''],
    ['ly ax1', 'LYAX1'],
    ['LY ÅBC', 'LYBC'],
  ])('normalizes %p to %p', (input, expected) => {
    expect(registrationKey(input)).toBe(expected);
  });

  it('is idempotent', () => {
    const once = registrationKey('vh-xyz');
    expect(registrationKey(once)).toBe(once);
  });
});

describe('REGISTRATION_KEY_RE', () => {
  it.each(['AB', 'N12345', 'ABCDEFGHIJ'])('accepts %p', (key) => {
    expect(REGISTRATION_KEY_RE.test(key)).toBe(true);
  });

  it.each(['A', 'ABCDEFGHIJK', 'ab', 'ABC-1', ''])('rejects %p', (key) => {
    expect(REGISTRATION_KEY_RE.test(key)).toBe(false);
  });

  it('accepts everything registrationKey can emit at a valid length', () => {
    expect(REGISTRATION_KEY_RE.test(registrationKey('C-FABC'))).toBe(true);
  });
});
