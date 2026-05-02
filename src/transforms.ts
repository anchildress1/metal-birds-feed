import type { ScalarTransformName, ArrayTransformName } from './types/config.js';

const KNOTS_PER_MPH = 0.868976;

const trim = (value: string): string => value.trim();

const trimOrNull = (value: string): string | null => {
  const v = value.trim();
  return v.length > 0 ? v : null;
};

const lowercase = (value: string): string => value.trim().toLowerCase();

const uppercase = (value: string): string => value.trim().toUpperCase();

const intOrNull = (value: string): string | null => {
  const v = value.trim();
  if (v.length === 0) return null;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? null : String(n);
};

const floatOrNull = (value: string): string | null => {
  const v = value.trim();
  if (v.length === 0) return null;
  const n = Number.parseFloat(v);
  return Number.isNaN(n) ? null : String(n);
};

const dateYyyymmddOrNull = (value: string): string | null => {
  const v = value.trim();
  if (v.length !== 8 || !/^\d{8}$/.test(v)) return null;
  const y = v.slice(0, 4);
  const m = v.slice(4, 6);
  const d = v.slice(6, 8);
  const date = new Date(`${y}-${m}-${d}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() + 1 !== Number(m) ||
    date.getUTCDate() !== Number(d)
  ) {
    return null;
  }
  return `${y}-${m}-${d}`;
};

const mphToKtasOrNull = (value: string): string | null => {
  const v = value.trim();
  if (v.length === 0) return null;
  const n = Number.parseFloat(v);
  if (Number.isNaN(n) || n <= 0) return null;
  return String(Math.round(n * KNOTS_PER_MPH * 10) / 10);
};

const faaNNumber = (value: string): string | null => {
  const v = value.trim().toUpperCase();
  if (v.length === 0) return null;
  return v.startsWith('N') ? v : `N${v}`;
};

const faaCertClass = (value: string): string | null => {
  const v = value.trim();
  return v.length > 0 ? v[0] : null;
};

const SCALAR_HANDLERS: Record<ScalarTransformName, (value: string) => string | null> = {
  trim,
  trim_or_null: trimOrNull,
  lowercase,
  uppercase,
  int_or_null: intOrNull,
  float_or_null: floatOrNull,
  date_yyyymmdd_or_null: dateYyyymmddOrNull,
  mph_to_ktas_or_null: mphToKtasOrNull,
  faa_n_number: faaNNumber,
  faa_cert_class: faaCertClass,
};

export const applyScalar = (name: ScalarTransformName, value: string): string | null =>
  SCALAR_HANDLERS[name](value);

const faaCertOps = (value: string): string[] => {
  const v = value.trim();
  return v.length > 1 ? v.slice(1).split('') : [];
};

const ARRAY_HANDLERS: Record<ArrayTransformName, (value: string) => string[]> = {
  faa_cert_ops: faaCertOps,
};

export const applyArray = (name: ArrayTransformName, value: string): string[] =>
  ARRAY_HANDLERS[name](value);
