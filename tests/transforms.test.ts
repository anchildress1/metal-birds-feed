import { describe, it, expect } from 'vitest';
import { applyScalar, applyArray } from '../src/transforms.js';

describe('applyScalar', () => {
  describe('trim', () => {
    it('strips whitespace', () => expect(applyScalar('trim', '  hello  ')).toBe('hello'));
    it('returns empty string for blank', () => expect(applyScalar('trim', '   ')).toBe(''));
  });

  describe('trim_or_null', () => {
    it('trims and returns value', () => expect(applyScalar('trim_or_null', ' hi ')).toBe('hi'));
    it('returns null for blank', () => expect(applyScalar('trim_or_null', '   ')).toBeNull());
    it('returns null for empty', () => expect(applyScalar('trim_or_null', '')).toBeNull());
  });

  describe('lowercase', () => {
    it('lowercases and trims', () => expect(applyScalar('lowercase', ' A4E294 ')).toBe('a4e294'));
  });

  describe('uppercase', () => {
    it('uppercases and trims', () => expect(applyScalar('uppercase', ' hello ')).toBe('HELLO'));
  });

  describe('int_or_null', () => {
    it('parses integer', () => expect(applyScalar('int_or_null', '1979')).toBe('1979'));
    it('returns null for empty', () => expect(applyScalar('int_or_null', '')).toBeNull());
    it('returns null for non-numeric', () => expect(applyScalar('int_or_null', 'abc')).toBeNull());
    it('truncates decimal', () => expect(applyScalar('int_or_null', '2.9')).toBe('2'));
    it('handles whitespace', () => expect(applyScalar('int_or_null', ' 42 ')).toBe('42'));
  });

  describe('float_or_null', () => {
    it('parses float', () => expect(applyScalar('float_or_null', '150')).toBe('150'));
    it('returns null for empty', () => expect(applyScalar('float_or_null', '')).toBeNull());
    it('returns null for non-numeric', () =>
      expect(applyScalar('float_or_null', 'N/A')).toBeNull());
    it('preserves decimals', () => expect(applyScalar('float_or_null', '3.14')).toBe('3.14'));
  });

  describe('date_yyyymmdd_or_null', () => {
    it('formats valid date', () =>
      expect(applyScalar('date_yyyymmdd_or_null', '19790620')).toBe('1979-06-20'));
    it('returns null for empty', () => expect(applyScalar('date_yyyymmdd_or_null', '')).toBeNull());
    it('returns null for wrong length', () =>
      expect(applyScalar('date_yyyymmdd_or_null', '1979062')).toBeNull());
    it('returns null for non-digit', () =>
      expect(applyScalar('date_yyyymmdd_or_null', '1979062X')).toBeNull());
    it('returns null for rollover dates', () =>
      expect(applyScalar('date_yyyymmdd_or_null', '20230231')).toBeNull());
    it('handles whitespace', () =>
      expect(applyScalar('date_yyyymmdd_or_null', ' 20231015 ')).toBe('2023-10-15'));
  });

  describe('mph_to_ktas_or_null', () => {
    it('converts mph to knots', () =>
      expect(applyScalar('mph_to_ktas_or_null', '122')).toBe('106'));
    it('returns null for zero speed', () =>
      expect(applyScalar('mph_to_ktas_or_null', '0')).toBeNull());
    it('returns null for empty', () => expect(applyScalar('mph_to_ktas_or_null', '')).toBeNull());
    it('returns null for negative', () =>
      expect(applyScalar('mph_to_ktas_or_null', '-10')).toBeNull());
    it('rounds to one decimal', () =>
      expect(applyScalar('mph_to_ktas_or_null', '82')).toBe('71.3'));
  });

  describe('faa_cert_class', () => {
    it('returns first char', () => expect(applyScalar('faa_cert_class', '14')).toBe('1'));
    it('returns first char for single-char cert', () =>
      expect(applyScalar('faa_cert_class', '4')).toBe('4'));
    it('returns null for empty', () => expect(applyScalar('faa_cert_class', '')).toBeNull());
    it('trims before extracting', () => expect(applyScalar('faa_cert_class', ' 11')).toBe('1'));
  });
});

describe('applyArray', () => {
  describe('faa_cert_ops', () => {
    it('returns remaining chars as array', () =>
      expect(applyArray('faa_cert_ops', '14')).toEqual(['4']));
    it('returns multiple chars', () =>
      expect(applyArray('faa_cert_ops', '123')).toEqual(['2', '3']));
    it('returns empty for single-char cert', () =>
      expect(applyArray('faa_cert_ops', '1')).toEqual([]));
    it('returns empty for empty cert', () => expect(applyArray('faa_cert_ops', '')).toEqual([]));
  });
});
