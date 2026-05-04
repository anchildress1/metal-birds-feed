import type {
  ScalarTransformName,
  ArrayTransformName,
  CompoundTransformName,
} from './types/config.js';

const KNOTS_PER_MPH = 0.868976;
const ICAO_MODE_S_BITS = 24;

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

const validateAndFormatYMD = (y: string, m: string, d: string): string | null => {
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

const dateYyyymmddOrNull = (value: string): string | null => {
  const v = value.trim();
  if (v.length !== 8 || !/^\d{8}$/.test(v)) return null;
  return validateAndFormatYMD(v.slice(0, 4), v.slice(4, 6), v.slice(6, 8));
};

const dateYyyySlashOrNull = (value: string): string | null => {
  const v = value.trim();
  if (v.length !== 10 || !/^\d{4}\/\d{2}\/\d{2}$/.test(v)) return null;
  return validateAndFormatYMD(v.slice(0, 4), v.slice(5, 7), v.slice(8, 10));
};

const mphToKtasOrNull = (value: string): string | null => {
  const v = value.trim();
  if (v.length === 0) return null;
  const n = Number.parseFloat(v);
  if (Number.isNaN(n) || n <= 0) return null;
  return String(Math.round(n * KNOTS_PER_MPH * 10) / 10);
};

const binaryToHexOrNull = (value: string): string | null => {
  const v = value.trim();
  if (v.length !== ICAO_MODE_S_BITS || !/^[01]+$/.test(v)) return null;
  let hex = '';
  for (let i = 0; i < ICAO_MODE_S_BITS; i += 4) {
    hex += Number.parseInt(v.slice(i, i + 4), 2).toString(16);
  }
  return hex;
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

const tcFullRegistration = (value: string): string | null => {
  const v = value.trim().toUpperCase();
  if (v.length === 0) return null;
  // 3-char marks are pre-1973 vintage, displayed as CF-XXX.
  // 4-char marks are modern, displayed as C-XXXX.
  return v.length === 3 ? `CF-${v}` : `C-${v}`;
};

const SCALAR_HANDLERS: Record<ScalarTransformName, (value: string) => string | null> = {
  trim,
  trim_or_null: trimOrNull,
  lowercase,
  uppercase,
  int_or_null: intOrNull,
  float_or_null: floatOrNull,
  date_yyyymmdd_or_null: dateYyyymmddOrNull,
  date_yyyy_slash_or_null: dateYyyySlashOrNull,
  mph_to_ktas_or_null: mphToKtasOrNull,
  binary_to_hex_or_null: binaryToHexOrNull,
  faa_n_number: faaNNumber,
  faa_cert_class: faaCertClass,
  tc_full_registration: tcFullRegistration,
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

const tcAirframe = (values: string[]): string | null => {
  const category = values[0]?.trim() ?? '';
  if (category === 'Helicopter') return 'rotorcraft';
  if (category === 'Glider') return 'glider';
  if (category === 'Balloon') return 'balloon';
  if (category === 'Gyroplane') return 'gyroplane';
  if (category !== 'Aeroplane') return null;
  const engineCount = Number.parseInt(values[1]?.trim() ?? '', 10);
  if (Number.isNaN(engineCount) || engineCount < 1) return null;
  return engineCount === 1 ? 'fixed-wing-single-engine' : 'fixed-wing-multi-engine';
};

const COMPOUND_HANDLERS: Record<CompoundTransformName, (values: string[]) => string | null> = {
  tc_airframe: tcAirframe,
};

export const applyCompound = (name: CompoundTransformName, values: string[]): string | null =>
  COMPOUND_HANDLERS[name](values);
