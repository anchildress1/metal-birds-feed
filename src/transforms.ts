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

// CASA (and the broader Commonwealth-English convention) writes dates as DD/MM/YYYY.
// Distinct transform from `date_yyyy_slash_or_null` to preserve unambiguous parsing —
// "01/02/2026" is February 1 here, January 2 in the YYYY-leading variant if reordered.
const dateDdSlashOrNull = (value: string): string | null => {
  const v = value.trim();
  if (v.length !== 10 || !/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return null;
  return validateAndFormatYMD(v.slice(6, 10), v.slice(3, 5), v.slice(0, 2));
};

// Accepts an ISO 8601 date or datetime string and returns just the YYYY-MM-DD date
// portion. Anything malformed returns null. NL ILT publishes dates as full ISO datetimes
// in TZ-shifted form (e.g., "2016-02-09T05:00:00.000Z" for a 2016-02-09 record); this
// transform extracts the calendar date and discards the time/zone so canonical records
// store dates as plain ISO date strings, matching FAA and TC.
const isoDateOnlyOrNull = (value: string): string | null => {
  const v = value.trim();
  if (v.length === 0) return null;
  const head = v.length >= 10 ? v.slice(0, 10) : v;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(head)) return null;
  return validateAndFormatYMD(head.slice(0, 4), head.slice(5, 7), head.slice(8, 10));
};

// Excel serial date epoch. Excel day 0 is 1899-12-30 (not 1899-12-31) because Excel
// treats 1900 as a leap year; anchoring two days early makes every serial for a date
// on/after 1900-03-01 resolve correctly, which covers all aircraft manufacture dates.
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

// Converts an Excel serial date (as published in the CAA Taiwan .xls manufacture-date
// column) to a 4-digit year. The canonical schema stores only year_manufactured, so the
// day/month are intentionally not preserved. Returns null for blank/non-numeric cells or
// years outside a sane 1900–2100 window.
const excelSerialYearOrNull = (value: string): string | null => {
  const v = value.trim();
  if (v.length === 0) return null;
  const serial = Number(v);
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const year = new Date(EXCEL_EPOCH_UTC + Math.round(serial) * MS_PER_DAY).getUTCFullYear();
  return year >= 1900 && year <= 2100 ? String(year) : null;
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

// Returns the ILT registration only when it looks like a real Dutch civil registration
// (PH-prefixed, case-insensitive). Returns null for anything else, including the
// "Information" banner ILT places in the first data row of the .ods export, partial /
// malformed marks, and empty cells. The engine treats null source_id as a row-skip
// candidate, so combining this with `allowed_missing_source_id_rows` cleanly bounds
// the banner row without dropping legitimate records.
const nlIltRegistrationOrNull = (value: string): string | null => {
  const v = value.trim().toUpperCase();
  if (v.length === 0) return null;
  if (!/^PH-[A-Z0-9]+$/.test(v)) return null;
  return v;
};

// CASA's `Mark` column carries only the suffix (e.g., "22A"); the canonical
// registration prepends "VH-" to form the standard Australian display registration.
const casaFullRegistration = (value: string): string | null => {
  const v = value.trim().toUpperCase();
  if (v.length === 0) return null;
  return `VH-${v}`;
};

// CASA uses literal sentinel strings for uninstalled engines instead of leaving the
// cells blank. Collapse those to null so gliders/balloons don't surface fake engine
// manufacturer/model text in the canonical record.
const casaEngineDetailOrNull = (value: string): string | null => {
  const v = value.trim();
  if (v.length === 0 || v === 'AIRCRAFT NOT FITTED WITH ENGINE' || v === 'NOT APPLICABLE') {
    return null;
  }
  return v;
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
  date_dd_slash_or_null: dateDdSlashOrNull,
  iso_date_only_or_null: isoDateOnlyOrNull,
  excel_serial_year_or_null: excelSerialYearOrNull,
  mph_to_ktas_or_null: mphToKtasOrNull,
  binary_to_hex_or_null: binaryToHexOrNull,
  faa_n_number: faaNNumber,
  faa_cert_class: faaCertClass,
  tc_full_registration: tcFullRegistration,
  nl_ilt_registration_or_null: nlIltRegistrationOrNull,
  casa_full_registration: casaFullRegistration,
  casa_engine_detail_or_null: casaEngineDetailOrNull,
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

// Maps NL ILT's `Group` + `Engines` columns to a canonical `airframe_type`.
//
// - Sailplane / Balloon / Rotorcraft / Drones map directly (Drones → null because the
//   canonical schema lacks a UAV enum; the engine produces a record without an airframe
//   classification rather than inventing one).
// - Small / Large aeroplane and MLA, MLH disambiguate single- vs multi-engine via the
//   Engines column. Engines holds an integer for powered records and "-" (or empty) for
//   sailplanes / balloons / drones, so the transform returns null when the count is not
//   a positive integer.
// - Anything else returns null. The translation engine surfaces null airframe_type in
//   the canonical record without failing the row.
const nlIltAirframe = (values: string[]): string | null => {
  const group = values[0]?.trim() ?? '';
  const enginesRaw = values[1]?.trim() ?? '';

  if (group === 'Sailplane') return 'glider';
  if (group === 'Balloon') return 'balloon';
  if (group === 'Rotorcraft') return 'rotorcraft';
  if (group === 'Drones') return null;

  if (group === 'Small aeroplane' || group === 'Large aeroplane' || group === 'MLA, MLH') {
    const n = Number.parseInt(enginesRaw, 10);
    if (Number.isNaN(n) || n < 1) return null;
    return n === 1 ? 'fixed-wing-single-engine' : 'fixed-wing-multi-engine';
  }

  return null;
};

// Maps CASA's `Airframe` + `engnum` columns to a canonical `airframe_type`.
//
// - Glider / Motor-Glider → glider (motor-glider is structurally a glider with auxiliary
//   power; canonical schema does not differentiate).
// - Manned Free Balloon → balloon; Airship → blimp (closest enum match).
// - Rotorcraft → rotorcraft.
// - Power Driven Aeroplane disambiguates single- vs multi-engine via engnum; non-numeric
//   or zero engnum returns null rather than guessing.
// - "RPA - *" rows describe Remotely Piloted Aircraft (drones); canonical schema lacks a
//   UAV enum so the engine emits the record without an airframe classification rather
//   than inventing one.
const casaAirframe = (values: string[]): string | null => {
  const airframe = values[0]?.trim() ?? '';
  const engnumRaw = values[1]?.trim() ?? '';

  if (airframe === 'Glider' || airframe === 'Motor-Glider') return 'glider';
  if (airframe === 'Manned Free Balloon') return 'balloon';
  if (airframe === 'Airship') return 'blimp';
  if (airframe === 'Rotorcraft') return 'rotorcraft';
  if (airframe === 'Power Driven Aeroplane') {
    const n = Number.parseInt(engnumRaw, 10);
    if (Number.isNaN(n) || n < 1) return null;
    return n === 1 ? 'fixed-wing-single-engine' : 'fixed-wing-multi-engine';
  }
  return null;
};

const COMPOUND_HANDLERS: Record<CompoundTransformName, (values: string[]) => string | null> = {
  tc_airframe: tcAirframe,
  nl_ilt_airframe: nlIltAirframe,
  casa_airframe: casaAirframe,
};

export const applyCompound = (name: CompoundTransformName, values: string[]): string | null =>
  COMPOUND_HANDLERS[name](values);
