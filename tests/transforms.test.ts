import { describe, it, expect } from 'bun:test';
import { applyScalar, applyArray, applyCompound } from '../src/transforms.js';

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
    it('returns empty string for blank', () => expect(applyScalar('lowercase', '   ')).toBe(''));
    it('returns empty string for empty', () => expect(applyScalar('lowercase', '')).toBe(''));
  });

  describe('int_or_null', () => {
    it('parses integer', () => expect(applyScalar('int_or_null', '1979')).toBe('1979'));
    it('returns null for empty', () => expect(applyScalar('int_or_null', '')).toBeNull());
    it('returns null for non-numeric', () => expect(applyScalar('int_or_null', 'abc')).toBeNull());
    it('returns null for a decimal', () => expect(applyScalar('int_or_null', '2.9')).toBeNull());
    it('returns null for an unsafe integer', () =>
      expect(applyScalar('int_or_null', '9007199254740992')).toBeNull());
    it('handles whitespace', () => expect(applyScalar('int_or_null', ' 42 ')).toBe('42'));
    // Number.parseInt would silently stop at the comma and return 1 — a wrong value that looks
    // plausible — instead of nulling a field parse* can't actually make sense of.
    it('returns null instead of a truncated prefix for a thousands-separated value', () =>
      expect(applyScalar('int_or_null', '1,800')).toBeNull());
    it('returns null instead of a truncated prefix for a unit-suffixed value', () =>
      expect(applyScalar('int_or_null', '180 HP')).toBeNull());
  });

  describe('float_or_null', () => {
    it('parses float', () => expect(applyScalar('float_or_null', '150')).toBe('150'));
    it('returns null for empty', () => expect(applyScalar('float_or_null', '')).toBeNull());
    it('returns null for non-numeric', () =>
      expect(applyScalar('float_or_null', 'N/A')).toBeNull());
    it('preserves decimals', () => expect(applyScalar('float_or_null', '3.14')).toBe('3.14'));
    it('returns null instead of a truncated prefix for a thousands-separated value', () =>
      expect(applyScalar('float_or_null', '1,800')).toBeNull());
  });

  describe('positive_float_or_null', () => {
    it('parses a positive value', () =>
      expect(applyScalar('positive_float_or_null', '472')).toBe('472'));
    it('preserves decimals', () =>
      expect(applyScalar('positive_float_or_null', '3.14')).toBe('3.14'));
    it('returns null for empty', () =>
      expect(applyScalar('positive_float_or_null', '')).toBeNull());
    it('returns null for non-numeric', () =>
      expect(applyScalar('positive_float_or_null', 'N/A')).toBeNull());
    // The whole point: registers stamp 0 where they mean "not recorded".
    it('returns null for zero', () =>
      expect(applyScalar('positive_float_or_null', '0')).toBeNull());
    it('returns null for a negative value', () =>
      expect(applyScalar('positive_float_or_null', '-1')).toBeNull());
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

  describe('date_yyyy_slash_or_null', () => {
    it('formats valid date', () =>
      expect(applyScalar('date_yyyy_slash_or_null', '1979/06/20')).toBe('1979-06-20'));
    it('returns null for empty', () =>
      expect(applyScalar('date_yyyy_slash_or_null', '')).toBeNull());
    it('returns null for wrong length', () =>
      expect(applyScalar('date_yyyy_slash_or_null', '1979/6/20')).toBeNull());
    it('returns null for non-digit', () =>
      expect(applyScalar('date_yyyy_slash_or_null', '1979/06/2X')).toBeNull());
    it('returns null for wrong separator', () =>
      expect(applyScalar('date_yyyy_slash_or_null', '1979-06-20')).toBeNull());
    it('returns null for rollover dates', () =>
      expect(applyScalar('date_yyyy_slash_or_null', '2023/02/31')).toBeNull());
    it('handles whitespace', () =>
      expect(applyScalar('date_yyyy_slash_or_null', ' 2023/10/15 ')).toBe('2023-10-15'));
  });

  describe('binary_to_hex_or_null', () => {
    it('converts 24-bit binary to lowercase hex', () =>
      expect(applyScalar('binary_to_hex_or_null', '110000000000000000000011')).toBe('c00003'));
    it('handles all-zero binary', () =>
      expect(applyScalar('binary_to_hex_or_null', '000000000000000000000000')).toBe('000000'));
    it('handles all-one binary', () =>
      expect(applyScalar('binary_to_hex_or_null', '111111111111111111111111')).toBe('ffffff'));
    it('returns null for empty', () => expect(applyScalar('binary_to_hex_or_null', '')).toBeNull());
    it('returns null for wrong length', () =>
      expect(applyScalar('binary_to_hex_or_null', '11000000')).toBeNull());
    it('returns null for non-binary', () =>
      expect(applyScalar('binary_to_hex_or_null', '11000000000000000000002A')).toBeNull());
    it('handles whitespace', () =>
      expect(applyScalar('binary_to_hex_or_null', ' 110000000000000000001010 ')).toBe('c0000a'));
  });

  describe('faa_n_number', () => {
    it('adds the N-prefix when FAA stores only the registration body', () =>
      expect(applyScalar('faa_n_number', '12345')).toBe('N12345'));
    it('does not duplicate an existing N-prefix', () =>
      expect(applyScalar('faa_n_number', ' N99ABC ')).toBe('N99ABC'));
    it('uppercases the registration body', () =>
      expect(applyScalar('faa_n_number', '99abc')).toBe('N99ABC'));
    it('returns null for blank', () => expect(applyScalar('faa_n_number', '   ')).toBeNull());
  });

  describe('faa_cert_class', () => {
    it('returns first char', () => expect(applyScalar('faa_cert_class', '14')).toBe('1'));
    it('returns first char for single-char cert', () =>
      expect(applyScalar('faa_cert_class', '4')).toBe('4'));
    it('returns null for empty', () => expect(applyScalar('faa_cert_class', '')).toBeNull());
    it('trims before extracting', () => expect(applyScalar('faa_cert_class', ' 11')).toBe('1'));
  });

  describe('tc_full_registration', () => {
    it('prefixes 4-char modern marks with C-', () =>
      expect(applyScalar('tc_full_registration', 'FABC')).toBe('C-FABC'));
    it('prefixes 3-char vintage marks with CF-', () =>
      expect(applyScalar('tc_full_registration', 'AAC')).toBe('CF-AAC'));
    it('uppercases the mark', () =>
      expect(applyScalar('tc_full_registration', 'fabc')).toBe('C-FABC'));
    it('trims before evaluating length', () =>
      expect(applyScalar('tc_full_registration', '  GABC  ')).toBe('C-GABC'));
    it('returns null for blank', () =>
      expect(applyScalar('tc_full_registration', '   ')).toBeNull());
    it('returns null for empty', () => expect(applyScalar('tc_full_registration', '')).toBeNull());
    it('still prefixes with C- for unexpected lengths (defensive)', () =>
      expect(applyScalar('tc_full_registration', 'AB')).toBe('C-AB'));
  });

  describe('casa_full_registration', () => {
    it('prefixes the suffix with VH-', () =>
      expect(applyScalar('casa_full_registration', '22A')).toBe('VH-22A'));
    it('uppercases lowercase input', () =>
      expect(applyScalar('casa_full_registration', '4qp')).toBe('VH-4QP'));
    it('trims surrounding whitespace', () =>
      expect(applyScalar('casa_full_registration', '  ABC  ')).toBe('VH-ABC'));
    it('returns null for empty input', () =>
      expect(applyScalar('casa_full_registration', '')).toBeNull());
    it('returns null for whitespace-only input', () =>
      expect(applyScalar('casa_full_registration', '   ')).toBeNull());
  });

  describe('casa_engine_detail_or_null', () => {
    it('returns the real engine detail when present', () =>
      expect(applyScalar('casa_engine_detail_or_null', 'LYCOMING')).toBe('LYCOMING'));
    it('trims surrounding whitespace', () =>
      expect(applyScalar('casa_engine_detail_or_null', '  IO-550-N  ')).toBe('IO-550-N'));
    it('returns null for empty input', () =>
      expect(applyScalar('casa_engine_detail_or_null', '')).toBeNull());
    it('returns null for AIRCRAFT NOT FITTED WITH ENGINE', () =>
      expect(
        applyScalar('casa_engine_detail_or_null', 'AIRCRAFT NOT FITTED WITH ENGINE')
      ).toBeNull());
    it('returns null for NOT APPLICABLE', () =>
      expect(applyScalar('casa_engine_detail_or_null', 'NOT APPLICABLE')).toBeNull());
  });

  describe('es_aesa_detail_or_null', () => {
    it('returns the real detail when present', () =>
      expect(applyScalar('es_aesa_detail_or_null', 'ROTAX')).toBe('ROTAX'));
    it('collapses internal whitespace and trims', () =>
      expect(applyScalar('es_aesa_detail_or_null', '  912  ULS  ')).toBe('912 ULS'));
    it('returns null for empty input', () =>
      expect(applyScalar('es_aesa_detail_or_null', '')).toBeNull());
    it('returns null for the wrapped NO DISPONIBLE serial sentinel', () =>
      expect(applyScalar('es_aesa_detail_or_null', 'NO\nDISPONIBLE')).toBeNull());
    it('returns null for the NO TIENE engine sentinel', () =>
      expect(applyScalar('es_aesa_detail_or_null', 'NO TIENE')).toBeNull());
    it('returns null for the DESCONOCIDO engine sentinel', () =>
      expect(applyScalar('es_aesa_detail_or_null', 'DESCONOCIDO')).toBeNull());
    it('returns null for the N/A serial sentinel', () =>
      expect(applyScalar('es_aesa_detail_or_null', 'N/A')).toBeNull());
  });

  describe('es_aesa_class_en', () => {
    it('labels a standard AVION with no certification qualifier', () =>
      expect(applyScalar('es_aesa_class_en', 'AVION')).toBe('airplane'));
    it('renders the ULM prefix as "ultralight"', () =>
      expect(applyScalar('es_aesa_class_en', 'ULM - AVION')).toBe('ultralight airplane'));
    it('renders the AFI prefix as "amateur-built"', () =>
      expect(applyScalar('es_aesa_class_en', 'AFI - AVION')).toBe('amateur-built airplane'));
    it('renders HELICOPTERO (VTOL)', () =>
      expect(applyScalar('es_aesa_class_en', 'HELICOPTERO (VTOL)')).toBe('helicopter (VTOL)'));
    it('renders GLOBO as balloon', () =>
      expect(applyScalar('es_aesa_class_en', 'GLOBO')).toBe('balloon'));
    it('renders AUTOGIRO as gyroplane', () =>
      expect(applyScalar('es_aesa_class_en', 'AUTOGIRO')).toBe('gyroplane'));
    it('combines an ULM prefix with AUTOGIRO', () =>
      expect(applyScalar('es_aesa_class_en', 'ULM - AUTOGIRO')).toBe('ultralight gyroplane'));
    it('renders AFI - PENDULAR as amateur-built weight-shift', () =>
      expect(applyScalar('es_aesa_class_en', 'AFI - PENDULAR')).toBe('amateur-built weight-shift'));
    it('renders the wrapped PLANEADOR/MOTOPLANEADOR cell', () =>
      expect(applyScalar('es_aesa_class_en', 'PLANEADOR/MOTOPL\nANEADOR')).toBe(
        'glider / motor-glider'
      ));
    it('combines an AFI prefix with the wrapped PLANEADOR cell', () =>
      expect(applyScalar('es_aesa_class_en', 'AFI -\nPLANEADOR/MOTOPL\nANEADOR')).toBe(
        'amateur-built glider / motor-glider'
      ));
    it('returns null for a blank class', () =>
      expect(applyScalar('es_aesa_class_en', '')).toBeNull());
    it('returns null for an unknown class', () =>
      expect(applyScalar('es_aesa_class_en', 'NAVE ESPACIAL')).toBeNull());
  });

  describe('date_dd_slash_or_null', () => {
    it('parses DD/MM/YYYY into ISO date', () =>
      expect(applyScalar('date_dd_slash_or_null', '15/04/2026')).toBe('2026-04-15'));
    it('parses leap-year February 29 into ISO date', () =>
      expect(applyScalar('date_dd_slash_or_null', '29/02/2024')).toBe('2024-02-29'));
    it('trims surrounding whitespace', () =>
      expect(applyScalar('date_dd_slash_or_null', '  01/01/2000  ')).toBe('2000-01-01'));
    it('returns null for empty input', () =>
      expect(applyScalar('date_dd_slash_or_null', '')).toBeNull());
    it('returns null for impossible day (32/01/2026)', () =>
      expect(applyScalar('date_dd_slash_or_null', '32/01/2026')).toBeNull());
    it('returns null for impossible month (01/13/2026)', () =>
      expect(applyScalar('date_dd_slash_or_null', '01/13/2026')).toBeNull());
    it('returns null for non-leap February 29', () =>
      expect(applyScalar('date_dd_slash_or_null', '29/02/2025')).toBeNull());
    it('returns null for ISO-style YYYY-MM-DD input', () =>
      expect(applyScalar('date_dd_slash_or_null', '2026-04-15')).toBeNull());
    it('returns null for YYYY/MM/DD (TC-style) input', () =>
      expect(applyScalar('date_dd_slash_or_null', '2026/04/15')).toBeNull());
    it('returns null for malformed gibberish', () =>
      expect(applyScalar('date_dd_slash_or_null', 'never')).toBeNull());
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

describe('applyCompound', () => {
  describe('tc_airframe', () => {
    it('maps Aeroplane + 1 engine to fixed-wing-single-engine', () =>
      expect(applyCompound('tc_airframe', ['Aeroplane', '1'])).toBe('fixed-wing-single-engine'));
    it('maps Aeroplane + 2 engines to fixed-wing-multi-engine', () =>
      expect(applyCompound('tc_airframe', ['Aeroplane', '2'])).toBe('fixed-wing-multi-engine'));
    it('maps Aeroplane + 4 engines to fixed-wing-multi-engine', () =>
      expect(applyCompound('tc_airframe', ['Aeroplane', '4'])).toBe('fixed-wing-multi-engine'));
    it('maps Helicopter to rotorcraft regardless of engine count', () =>
      expect(applyCompound('tc_airframe', ['Helicopter', '2'])).toBe('rotorcraft'));
    it('maps Glider to glider', () =>
      expect(applyCompound('tc_airframe', ['Glider', ''])).toBe('glider'));
    it('maps Balloon to balloon', () =>
      expect(applyCompound('tc_airframe', ['Balloon', ''])).toBe('balloon'));
    it('maps Gyroplane to gyroplane', () =>
      expect(applyCompound('tc_airframe', ['Gyroplane', '1'])).toBe('gyroplane'));
    it('returns null for Aeroplane with no engine count', () =>
      expect(applyCompound('tc_airframe', ['Aeroplane', ''])).toBeNull());
    it('returns null for Aeroplane with non-numeric engines', () =>
      expect(applyCompound('tc_airframe', ['Aeroplane', 'abc'])).toBeNull());
    it('returns null for Aeroplane with zero engines', () =>
      expect(applyCompound('tc_airframe', ['Aeroplane', '0'])).toBeNull());
    it('returns null for unknown category', () =>
      expect(applyCompound('tc_airframe', ['Spaceship', '1'])).toBeNull());
    it('trims category and engine count whitespace', () =>
      expect(applyCompound('tc_airframe', ['  Aeroplane  ', ' 1 '])).toBe(
        'fixed-wing-single-engine'
      ));
    it('handles missing values array entries gracefully', () =>
      expect(applyCompound('tc_airframe', [])).toBeNull());
  });

  describe('nl_ilt_airframe (compound)', () => {
    it('maps Sailplane to glider', () =>
      expect(applyCompound('nl_ilt_airframe', ['Sailplane', '-'])).toBe('glider'));
    it('maps Balloon to balloon', () =>
      expect(applyCompound('nl_ilt_airframe', ['Balloon', '-'])).toBe('balloon'));
    it('maps Rotorcraft to rotorcraft', () =>
      expect(applyCompound('nl_ilt_airframe', ['Rotorcraft', '1'])).toBe('rotorcraft'));
    it('maps Small aeroplane with one engine to fixed-wing-single-engine', () =>
      expect(applyCompound('nl_ilt_airframe', ['Small aeroplane', '1'])).toBe(
        'fixed-wing-single-engine'
      ));
    it('maps Large aeroplane with two engines to fixed-wing-multi-engine', () =>
      expect(applyCompound('nl_ilt_airframe', ['Large aeroplane', '2'])).toBe(
        'fixed-wing-multi-engine'
      ));
    it('maps MLA, MLH single-engine to fixed-wing-single-engine', () =>
      expect(applyCompound('nl_ilt_airframe', ['MLA, MLH', '1'])).toBe('fixed-wing-single-engine'));
    it('returns null for Drones (no canonical UAV enum)', () =>
      expect(applyCompound('nl_ilt_airframe', ['Drones', '4'])).toBeNull());
    it('returns null for an unknown group', () =>
      expect(applyCompound('nl_ilt_airframe', ['Spaceship', '1'])).toBeNull());
    it('returns null for an aeroplane with no engine count', () =>
      expect(applyCompound('nl_ilt_airframe', ['Small aeroplane', ''])).toBeNull());
    it('returns null for an aeroplane with non-numeric engine count', () =>
      expect(applyCompound('nl_ilt_airframe', ['Small aeroplane', '-'])).toBeNull());
    it('returns null for an aeroplane with zero engines', () =>
      expect(applyCompound('nl_ilt_airframe', ['Small aeroplane', '0'])).toBeNull());
    it('trims whitespace in group and engine count', () =>
      expect(applyCompound('nl_ilt_airframe', ['  Small aeroplane  ', ' 1 '])).toBe(
        'fixed-wing-single-engine'
      ));
    it('returns null for an empty values array', () =>
      expect(applyCompound('nl_ilt_airframe', [])).toBeNull());
  });

  describe('iso_date_only_or_null', () => {
    it('extracts the date from a full ISO datetime', () =>
      expect(applyScalar('iso_date_only_or_null', '2016-02-09T05:00:00.000Z')).toBe('2016-02-09'));
    it('accepts a bare ISO date', () =>
      expect(applyScalar('iso_date_only_or_null', '2026-04-28')).toBe('2026-04-28'));
    it('trims surrounding whitespace before parsing', () =>
      expect(applyScalar('iso_date_only_or_null', '  2020-12-31T00:00:00Z  ')).toBe('2020-12-31'));
    it('returns null for empty input', () =>
      expect(applyScalar('iso_date_only_or_null', '')).toBeNull());
    it('returns null for non-ISO text', () =>
      expect(applyScalar('iso_date_only_or_null', 'never')).toBeNull());
    it('returns null for an impossible calendar date', () =>
      expect(applyScalar('iso_date_only_or_null', '2026-02-30T00:00:00Z')).toBeNull());
    it('returns null for a date-shaped value with garbage tail', () =>
      expect(applyScalar('iso_date_only_or_null', '2020-13-40T00:00:00Z')).toBeNull());
  });

  describe('nl_ilt_registration_or_null', () => {
    it('returns the uppercased registration for a valid PH-prefixed mark', () =>
      expect(applyScalar('nl_ilt_registration_or_null', 'PH-2R4')).toBe('PH-2R4'));
    it('uppercases lowercase input', () =>
      expect(applyScalar('nl_ilt_registration_or_null', 'ph-abc')).toBe('PH-ABC'));
    it('trims surrounding whitespace', () =>
      expect(applyScalar('nl_ilt_registration_or_null', '  PH-XYZ  ')).toBe('PH-XYZ'));
    it('returns null for the ILT "Information" banner row', () =>
      expect(applyScalar('nl_ilt_registration_or_null', 'Information')).toBeNull());
    it('returns null for empty input', () =>
      expect(applyScalar('nl_ilt_registration_or_null', '')).toBeNull());
    it('returns null for a non-PH-prefixed mark (foreign reg)', () =>
      expect(applyScalar('nl_ilt_registration_or_null', 'N12345')).toBeNull());
    it('returns null for PH- alone (no body)', () =>
      expect(applyScalar('nl_ilt_registration_or_null', 'PH-')).toBeNull());
    it('returns null for PH- with non-alphanumeric body', () =>
      expect(applyScalar('nl_ilt_registration_or_null', 'PH-AB!')).toBeNull());
  });

  describe('casa_airframe (compound)', () => {
    it('maps Glider to glider', () =>
      expect(applyCompound('casa_airframe', ['Glider', ''])).toBe('glider'));
    it('maps Motor-Glider to glider (auxiliary power irrelevant in canonical schema)', () =>
      expect(applyCompound('casa_airframe', ['Motor-Glider', '1'])).toBe('glider'));
    it('maps Manned Free Balloon to balloon', () =>
      expect(applyCompound('casa_airframe', ['Manned Free Balloon', ''])).toBe('balloon'));
    it('maps Airship to blimp', () =>
      expect(applyCompound('casa_airframe', ['Airship', '1'])).toBe('blimp'));
    it('maps Rotorcraft to rotorcraft regardless of engine count', () =>
      expect(applyCompound('casa_airframe', ['Rotorcraft', '2'])).toBe('rotorcraft'));
    it('maps Power Driven Aeroplane + 1 engine to fixed-wing-single-engine', () =>
      expect(applyCompound('casa_airframe', ['Power Driven Aeroplane', '1'])).toBe(
        'fixed-wing-single-engine'
      ));
    it('maps Power Driven Aeroplane + 4 engines to fixed-wing-multi-engine', () =>
      expect(applyCompound('casa_airframe', ['Power Driven Aeroplane', '4'])).toBe(
        'fixed-wing-multi-engine'
      ));
    it('returns null for Power Driven Aeroplane with no engine count', () =>
      expect(applyCompound('casa_airframe', ['Power Driven Aeroplane', ''])).toBeNull());
    it('returns null for Power Driven Aeroplane with non-numeric engines', () =>
      expect(applyCompound('casa_airframe', ['Power Driven Aeroplane', 'abc'])).toBeNull());
    it('returns null for Power Driven Aeroplane with zero engines', () =>
      expect(applyCompound('casa_airframe', ['Power Driven Aeroplane', '0'])).toBeNull());
    it('returns null for RPA - Rotorcraft (drones not in canonical UAV enum)', () =>
      expect(applyCompound('casa_airframe', ['RPA - Rotorcraft', '1'])).toBeNull());
    it('returns null for RPA - Power Driven Aeroplane', () =>
      expect(applyCompound('casa_airframe', ['RPA - Power Driven Aeroplane', '2'])).toBeNull());
    it('returns null for unknown airframe descriptor', () =>
      expect(applyCompound('casa_airframe', ['Spaceship', '1'])).toBeNull());
    it('trims whitespace in airframe and engine count', () =>
      expect(applyCompound('casa_airframe', ['  Power Driven Aeroplane  ', ' 1 '])).toBe(
        'fixed-wing-single-engine'
      ));
    it('returns null for an empty values array', () =>
      expect(applyCompound('casa_airframe', [])).toBeNull());
  });

  describe('es_aesa_airframe', () => {
    it('maps a single-engine AVION by engine count', () =>
      expect(applyCompound('es_aesa_airframe', ['AVION', '1'])).toBe('fixed-wing-single-engine'));
    it('maps a multi-engine AVION by engine count', () =>
      expect(applyCompound('es_aesa_airframe', ['AVION', '2'])).toBe('fixed-wing-multi-engine'));
    it('strips the ULM (ultralight) prefix before typing', () =>
      expect(applyCompound('es_aesa_airframe', ['ULM - AVION', '1'])).toBe(
        'fixed-wing-single-engine'
      ));
    it('strips the AFI (amateur-built) prefix before typing', () =>
      expect(applyCompound('es_aesa_airframe', ['AFI - AVION', '2'])).toBe(
        'fixed-wing-multi-engine'
      ));
    it('maps HELICOPTERO (VTOL) to rotorcraft', () =>
      expect(applyCompound('es_aesa_airframe', ['HELICOPTERO (VTOL)', '2'])).toBe('rotorcraft'));
    it('maps GLOBO to balloon', () =>
      expect(applyCompound('es_aesa_airframe', ['GLOBO', '0'])).toBe('balloon'));
    it('maps AUTOGIRO to gyroplane', () =>
      expect(applyCompound('es_aesa_airframe', ['AUTOGIRO', '1'])).toBe('gyroplane'));
    it('maps the ULM - AUTOGIRO prefix form to gyroplane', () =>
      expect(applyCompound('es_aesa_airframe', ['ULM - AUTOGIRO', '1'])).toBe('gyroplane'));
    it('maps AFI - PENDULAR (weight-shift control) to weight-shift', () =>
      expect(applyCompound('es_aesa_airframe', ['AFI - PENDULAR', '1'])).toBe('weight-shift'));
    it('maps the wrapped PLANEADOR/MOTOPLANEADOR cell to glider', () =>
      expect(applyCompound('es_aesa_airframe', ['PLANEADOR/MOTOPL\nANEADOR', '0'])).toBe('glider'));
    it('maps the AFI-prefixed wrapped PLANEADOR cell to glider', () =>
      expect(applyCompound('es_aesa_airframe', ['AFI -\nPLANEADOR/MOTOPL\nANEADOR', '1'])).toBe(
        'glider'
      ));
    it('returns null for an AVION with a non-positive engine count', () =>
      expect(applyCompound('es_aesa_airframe', ['AVION', '0'])).toBeNull());
    it('returns null for an AVION with a blank engine count', () =>
      expect(applyCompound('es_aesa_airframe', ['AVION', ''])).toBeNull());
    it('returns null for an empty clase', () =>
      expect(applyCompound('es_aesa_airframe', ['', '1'])).toBeNull());
    it('returns null for an unknown clase', () =>
      expect(applyCompound('es_aesa_airframe', ['NAVE ESPACIAL', '1'])).toBeNull());
    it('returns null for an empty values array', () =>
      expect(applyCompound('es_aesa_airframe', [])).toBeNull());
  });
});

describe('excel_serial_year_or_null', () => {
  it('converts an Excel serial date to its 4-digit year', () =>
    expect(applyScalar('excel_serial_year_or_null', '40833')).toBe('2011'));
  it('handles a recent serial', () =>
    expect(applyScalar('excel_serial_year_or_null', '45469')).toBe('2024'));
  it('rounds a fractional serial before extracting the year', () =>
    expect(applyScalar('excel_serial_year_or_null', '42146.99')).toBe('2015'));
  it('returns null for a blank cell', () =>
    expect(applyScalar('excel_serial_year_or_null', '   ')).toBeNull());
  it('returns null for an empty string', () =>
    expect(applyScalar('excel_serial_year_or_null', '')).toBeNull());
  it('returns null for a non-numeric value', () =>
    expect(applyScalar('excel_serial_year_or_null', 'B-18001')).toBeNull());
  it('returns null for a non-positive serial', () => {
    expect(applyScalar('excel_serial_year_or_null', '0')).toBeNull();
    expect(applyScalar('excel_serial_year_or_null', '-10')).toBeNull();
  });
  it('returns null for a serial whose year falls below the 1900 floor', () =>
    expect(applyScalar('excel_serial_year_or_null', '1')).toBeNull());
  it('resolves the phantom Excel leap day (serial 60) to year 1900', () =>
    expect(applyScalar('excel_serial_year_or_null', '60')).toBe('1900'));
  it('returns null for a serial whose year exceeds the 2100 ceiling', () =>
    expect(applyScalar('excel_serial_year_or_null', '100000')).toBeNull());
});

describe('date_ddmmyyyy_or_null', () => {
  it('parses an 8-digit DDMMYYYY date', () =>
    expect(applyScalar('date_ddmmyyyy_or_null', '23092026')).toBe('2026-09-23'));
  it('parses a single-digit-day date padded to two digits', () =>
    expect(applyScalar('date_ddmmyyyy_or_null', '03072011')).toBe('2011-07-03'));
  it('trims surrounding whitespace', () =>
    expect(applyScalar('date_ddmmyyyy_or_null', ' 18082026 ')).toBe('2026-08-18'));
  it('returns null for ANAC legacy 6-digit stubs', () =>
    expect(applyScalar('date_ddmmyyyy_or_null', '300996')).toBeNull());
  it('returns null for an empty string', () =>
    expect(applyScalar('date_ddmmyyyy_or_null', '')).toBeNull());
  it('returns null for a non-numeric value', () =>
    expect(applyScalar('date_ddmmyyyy_or_null', '23/09/2026')).toBeNull());
  it('returns null for an impossible calendar date', () =>
    expect(applyScalar('date_ddmmyyyy_or_null', '32012026')).toBeNull());
});

describe('date_dmmmyy_or_null', () => {
  it('parses a D-MMM-YY date with a single-digit day', () =>
    expect(applyScalar('date_dmmmyy_or_null', '2-Dec-95')).toBe('1995-12-02'));
  it('parses a two-digit-day date', () =>
    expect(applyScalar('date_dmmmyy_or_null', '15-Jun-25')).toBe('2025-06-15'));
  it('pivots years < 50 into the 2000s', () =>
    expect(applyScalar('date_dmmmyy_or_null', '8-Aug-16')).toBe('2016-08-08'));
  it('pivots years >= 50 into the 1900s', () =>
    expect(applyScalar('date_dmmmyy_or_null', '1-Jan-99')).toBe('1999-01-01'));
  it('is case-insensitive on the month abbreviation', () =>
    expect(applyScalar('date_dmmmyy_or_null', '3-MAR-04')).toBe('2004-03-03'));
  it('trims surrounding whitespace', () =>
    expect(applyScalar('date_dmmmyy_or_null', ' 7-Jul-21 ')).toBe('2021-07-07'));
  it('returns null for an unknown month abbreviation', () =>
    expect(applyScalar('date_dmmmyy_or_null', '2-Xyz-95')).toBeNull());
  it('returns null for an impossible calendar date', () =>
    expect(applyScalar('date_dmmmyy_or_null', '31-Feb-20')).toBeNull());
  it('returns null for a full four-digit year', () =>
    expect(applyScalar('date_dmmmyy_or_null', '2-Dec-1995')).toBeNull());
  it('returns null for an empty string', () =>
    expect(applyScalar('date_dmmmyy_or_null', '')).toBeNull());
});

describe('first_line_or_null', () => {
  it('returns the first physical line of a multi-line cell', () =>
    expect(applyScalar('first_line_or_null', 'Acme Air Ltd\n10 Runway Rd\nMalé')).toBe(
      'Acme Air Ltd'
    ));
  it('trims the first line', () =>
    expect(applyScalar('first_line_or_null', '  Acme Air Ltd  \nMalé')).toBe('Acme Air Ltd'));
  it('returns a single-line value unchanged', () =>
    expect(applyScalar('first_line_or_null', 'None')).toBe('None'));
  it('returns null when the first line is blank', () =>
    expect(applyScalar('first_line_or_null', '   \nMalé')).toBeNull());
  it('returns null for an empty string', () =>
    expect(applyScalar('first_line_or_null', '')).toBeNull());
});

describe('collapse_ws_or_null', () => {
  it('flattens newlines to single spaces', () =>
    expect(applyScalar('collapse_ws_or_null', 'Viking Air (De Havilland)\nDHC-6-300')).toBe(
      'Viking Air (De Havilland) DHC-6-300'
    ));
  it('collapses runs of internal whitespace', () =>
    expect(applyScalar('collapse_ws_or_null', 'ATR  42-500')).toBe('ATR 42-500'));
  it('trims leading and trailing whitespace', () =>
    expect(applyScalar('collapse_ws_or_null', '  hi \n there ')).toBe('hi there'));
  it('returns null for a whitespace-only value', () =>
    expect(applyScalar('collapse_ws_or_null', ' \n \t ')).toBeNull());
  it('returns null for an empty string', () =>
    expect(applyScalar('collapse_ws_or_null', '')).toBeNull());
});

describe('mv_idera_party', () => {
  it('returns the party name after a "Letter No:" reference, dropping the address', () =>
    expect(
      applyScalar(
        'mv_idera_party',
        'Letter No: 201-ASD-D/MIS/2025/057\nExport Development Canada\n150 Slater Street\nOttawa, Ontario, K1A 1K3\nCanada'
      )
    ).toBe('Export Development Canada'));
  it('skips a "Letter No." (period) reference variant, keeping the party', () =>
    expect(
      applyScalar('mv_idera_party', 'Letter No. 201-ASD-D/MAA/2023/011\nAER, LLC\nFukaya, Saitama')
    ).toBe('AER, LLC'));
  it('returns the first line as the party when there is no reference prefix', () =>
    expect(applyScalar('mv_idera_party', 'AER, LLC\n3641-2 Higashikata\nJapan')).toBe('AER, LLC'));
  it('skips a parenthetical-date prefix', () =>
    expect(applyScalar('mv_idera_party', '(8 Aug 2023)\nAER, LLC\n3641-2 Higashikata')).toBe(
      'AER, LLC'
    ));
  it('returns null for a bare "None"', () =>
    expect(applyScalar('mv_idera_party', 'None')).toBeNull());
  it('returns null when only a reference follows "None"', () =>
    expect(applyScalar('mv_idera_party', 'None\nLetter No: 201-ASD-D/MAA/2023/010')).toBeNull());
  it('returns null for an empty cell', () => expect(applyScalar('mv_idera_party', '')).toBeNull());
});

describe('br_registration', () => {
  it('inserts the hyphen after the two-letter prefix', () =>
    expect(applyScalar('br_registration', 'PPACK')).toBe('PP-ACK'));
  it('handles a PR-prefixed mark', () =>
    expect(applyScalar('br_registration', 'PRAFV')).toBe('PR-AFV'));
  it('uppercases and trims before formatting', () =>
    expect(applyScalar('br_registration', '  ppjpg ')).toBe('PP-JPG'));
  it('returns null for a malformed mark (wrong length)', () =>
    expect(applyScalar('br_registration', 'PPAC')).toBeNull());
  it('returns null for an empty string', () =>
    expect(applyScalar('br_registration', '')).toBeNull());
});

describe('cl_registration', () => {
  it('restores the CC- dash on a dash-less mark', () =>
    expect(applyScalar('cl_registration', 'CCAAA')).toBe('CC-AAA'));
  it('handles an alphanumeric suffix', () =>
    expect(applyScalar('cl_registration', 'CCPH1')).toBe('CC-PH1'));
  it('uppercases and trims before formatting', () =>
    expect(applyScalar('cl_registration', '  ccadb ')).toBe('CC-ADB'));
  it('returns null for a non-CC prefix', () =>
    expect(applyScalar('cl_registration', 'PPACK')).toBeNull());
  it('returns null for a wrong-length mark', () =>
    expect(applyScalar('cl_registration', 'CCAA')).toBeNull());
  it('returns null for an empty string', () =>
    expect(applyScalar('cl_registration', '')).toBeNull());
});

describe('ee_registration', () => {
  it('collapses the spaced hyphen to canonical form', () =>
    expect(applyScalar('ee_registration', 'ES - MBA')).toBe('ES-MBA'));
  it('normalizes a numeric mark', () =>
    expect(applyScalar('ee_registration', 'ES - 1004')).toBe('ES-1004'));
  it('uppercases and strips all whitespace', () =>
    expect(applyScalar('ee_registration', '  es - say ')).toBe('ES-SAY'));
  it('returns null for a non-ES value (e.g. the metadata-row text)', () =>
    expect(applyScalar('ee_registration', '19.06.2026/updated')).toBeNull());
  it('returns null for the prefix alone with no body', () =>
    expect(applyScalar('ee_registration', 'ES-')).toBeNull());
  it('returns null for an empty string', () =>
    expect(applyScalar('ee_registration', '')).toBeNull());
});

describe('br_build_certification', () => {
  it('reads the not-certified statement as a build certification', () =>
    expect(applyScalar('br_build_certification', 'NÃO CERTIFICADA')).toBe('not-type-certificated'));
  it('is case- and whitespace-insensitive', () =>
    expect(applyScalar('br_build_certification', '  não certificada ')).toBe(
      'not-type-certificated'
    ));
  // Every other ANAC category says nothing about type certification; asserting one would invent it.
  it('returns null for a category that states nothing about type certification', () =>
    expect(applyScalar('br_build_certification', 'NORMAL')).toBeNull());
  it('returns null for an experimental category', () =>
    expect(applyScalar('br_build_certification', 'EXPERIMENTAL')).toBeNull());
  it('returns null for a blank cell', () =>
    expect(applyScalar('br_build_certification', '')).toBeNull());
});

describe('br_airframe', () => {
  it('maps a single-engine landplane (L1P) to fixed-wing-single-engine', () =>
    expect(applyScalar('br_airframe', 'L1P')).toBe('fixed-wing-single-engine'));
  it('maps a twin landplane (L2J) to fixed-wing-multi-engine', () =>
    expect(applyScalar('br_airframe', 'L2J')).toBe('fixed-wing-multi-engine'));
  it('maps an unpowered landplane (L00) to glider', () =>
    expect(applyScalar('br_airframe', 'L00')).toBe('glider'));
  it('maps a helicopter class (H1T) to rotorcraft', () =>
    expect(applyScalar('br_airframe', 'H1T')).toBe('rotorcraft'));
  it('maps an amphibian (A1P) to a fixed-wing type', () =>
    expect(applyScalar('br_airframe', 'A1P')).toBe('fixed-wing-single-engine'));
  it('maps a gyroplane class (G1P) to gyroplane', () =>
    expect(applyScalar('br_airframe', 'G1P')).toBe('gyroplane'));
  it('maps RPA to uav', () => expect(applyScalar('br_airframe', 'RPA')).toBe('uav'));
  it('is case- and whitespace-insensitive for RPA', () =>
    expect(applyScalar('br_airframe', ' rpa ')).toBe('uav'));
  it('returns null for an unknown class code', () =>
    expect(applyScalar('br_airframe', 'X9Z')).toBeNull());
  it('returns null for a non-digit engine-count character (e.g. LXP)', () =>
    expect(applyScalar('br_airframe', 'LXP')).toBeNull());
  it('returns null for an empty string', () => expect(applyScalar('br_airframe', '')).toBeNull());
});

describe('br_party_name', () => {
  const owner = '[{"NOME":"GRANO LTDA","DOCUMENTO":"52511458000109","UF":"SP"}]';
  it('extracts the first party name from the JSON array', () =>
    expect(applyScalar('br_party_name', owner)).toBe('GRANO LTDA'));
  it('returns the primary name for a co-owned aircraft', () =>
    expect(
      applyScalar(
        'br_party_name',
        '[{"NOME":"FIRST OWNER","UF":"TO"},{"NOME":"SECOND OWNER","UF":"SP"}]'
      )
    ).toBe('FIRST OWNER'));
  it('collapses the Indisponível sentinel to null', () =>
    expect(
      applyScalar('br_party_name', '[{"NOME":"Indisponível","UF":"Indisponível"}]')
    ).toBeNull());
  it('returns null for an empty cell', () => expect(applyScalar('br_party_name', '')).toBeNull());
  it('returns null for an empty JSON array', () =>
    expect(applyScalar('br_party_name', '[]')).toBeNull());
  it('returns null for malformed JSON', () =>
    expect(applyScalar('br_party_name', '[{not json')).toBeNull());
});

describe('br_party_state', () => {
  it('extracts the first party UF', () =>
    expect(applyScalar('br_party_state', '[{"NOME":"X","UF":"MG"}]')).toBe('MG'));
  it('returns null when UF is absent', () =>
    expect(applyScalar('br_party_state', '[{"NOME":"X"}]')).toBeNull());
  it('collapses the Indisponível sentinel to null', () =>
    expect(applyScalar('br_party_state', '[{"NOME":"X","UF":"Indisponível"}]')).toBeNull());
  it('merges a same-DOCUMENTO self-duplicate, keeping the meaningful UF (ANAC mark PSORO)', () =>
    expect(
      applyScalar(
        'br_party_state',
        '[{"DOCUMENTO":"07418547000150","UF":"Indisponível"},{"DOCUMENTO":"07418547000150","UF":"SP"}]'
      )
    ).toBe('SP'));
  it('returns null for an empty cell', () => expect(applyScalar('br_party_state', '')).toBeNull());
});

describe('br_party_kind', () => {
  it('derives individual from an 11-char (masked CPF) document', () =>
    expect(applyScalar('br_party_kind', '[{"NOME":"X","DOCUMENTO":"587XXXXXX00"}]')).toBe(
      'individual'
    ));
  it('derives corporation from a 14-digit CNPJ', () =>
    expect(applyScalar('br_party_kind', '[{"NOME":"X","DOCUMENTO":"52511458000109"}]')).toBe(
      'corporation'
    ));
  it('returns co-owner when more than one party is present', () =>
    expect(
      applyScalar(
        'br_party_kind',
        '[{"NOME":"A","DOCUMENTO":"11122233300"},{"NOME":"B","DOCUMENTO":"44455566600"}]'
      )
    ).toBe('co-owner'));
  it('treats a same-DOCUMENTO self-duplicate as one corporation, not co-owner (ANAC mark PSORO)', () =>
    expect(
      applyScalar(
        'br_party_kind',
        '[{"DOCUMENTO":"07418547000150","UF":"Indisponível"},{"DOCUMENTO":"07418547000150","UF":"SP"}]'
      )
    ).toBe('corporation'));
  it('returns other for a non-CPF/CNPJ document length', () =>
    expect(applyScalar('br_party_kind', '[{"NOME":"X","DOCUMENTO":"123456789012"}]')).toBe(
      'other'
    ));
  it('returns null for an empty document', () =>
    expect(applyScalar('br_party_kind', '[{"NOME":"X","DOCUMENTO":""}]')).toBeNull());
  it('returns null for the Indisponível sentinel party', () =>
    expect(
      applyScalar('br_party_kind', '[{"NOME":"Indisponível","DOCUMENTO":"Indisponível"}]')
    ).toBeNull());
  it('returns null for an empty cell', () => expect(applyScalar('br_party_kind', '')).toBeNull());
});

describe('na_or_null', () => {
  it('trims and returns value', () => expect(applyScalar('na_or_null', '  C172  ')).toBe('C172'));
  it('returns null for the N/A sentinel', () =>
    expect(applyScalar('na_or_null', 'N/A')).toBeNull());
  it('returns null for blank', () => expect(applyScalar('na_or_null', '   ')).toBeNull());
  it('returns null for empty', () => expect(applyScalar('na_or_null', '')).toBeNull());
});

describe('foca_hex_or_null', () => {
  it('lowercases a valid 24-bit hex', () =>
    expect(applyScalar('foca_hex_or_null', '4B488F')).toBe('4b488f'));
  it('passes a clean lowercase hex', () =>
    expect(applyScalar('foca_hex_or_null', '4b488f')).toBe('4b488f'));
  it('returns null for the N/A sentinel', () =>
    expect(applyScalar('foca_hex_or_null', 'N/A')).toBeNull());
  it('returns null for a wrong-length value', () =>
    expect(applyScalar('foca_hex_or_null', '4b48')).toBeNull());
  it('returns null for non-hex characters', () =>
    expect(applyScalar('foca_hex_or_null', '4b48zz')).toBeNull());
  it('returns null for empty', () => expect(applyScalar('foca_hex_or_null', '')).toBeNull());
});

describe('foca_date_array_or_null', () => {
  it('formats a [y,m,d] array to ISO with zero-padding', () =>
    expect(applyScalar('foca_date_array_or_null', '[2025,8,15]')).toBe('2025-08-15'));
  it('formats a two-digit month/day without extra padding', () =>
    expect(applyScalar('foca_date_array_or_null', '[1979,12,31]')).toBe('1979-12-31'));
  it('returns null for an impossible date', () =>
    expect(applyScalar('foca_date_array_or_null', '[2023,2,31]')).toBeNull());
  it('returns null for the wrong number of elements', () =>
    expect(applyScalar('foca_date_array_or_null', '[2025,8]')).toBeNull());
  it('returns null for non-numeric elements', () =>
    expect(applyScalar('foca_date_array_or_null', '["2025","8","15"]')).toBeNull());
  it('returns null for malformed JSON', () =>
    expect(applyScalar('foca_date_array_or_null', '[2025,8,')).toBeNull());
  it('returns null for empty', () => expect(applyScalar('foca_date_array_or_null', '')).toBeNull());
});

const OWNER = (en: string, name: string, extraLine: string, country: string): string =>
  `{"holderCategory":{"categoryNames":{"en":"${en}"}},"ownerOperator":"${name}","address":{"street":"Secret St","city":"Hidden","zipCode":"9999","extraLine":"${extraLine}","country":"${country}"}}`;

const PARTIES = (...parties: string[]): string => `[${parties.join(',')}]`;

describe('foca owner/operator transforms', () => {
  const swissOwnerOnly = PARTIES(
    OWNER('Main Owner', 'Muster AG', 'ZH', 'Switzerland'),
    OWNER('Main Operator', 'Betrieb AG', 'BE', 'Switzerland')
  );

  it('extracts the Main Owner name', () =>
    expect(applyScalar('foca_owner_name', swissOwnerOnly)).toBe('Muster AG'));
  it('extracts the Main Operator name (distinct from owner)', () =>
    expect(applyScalar('foca_operator_name', swissOwnerOnly)).toBe('Betrieb AG'));

  it('keeps a valid Swiss canton as owner state', () =>
    expect(applyScalar('foca_owner_state', swissOwnerOnly)).toBe('ZH'));
  it('keeps the operator canton independently', () =>
    expect(applyScalar('foca_operator_state', swissOwnerOnly)).toBe('BE'));

  it('drops non-canton extraLine (care-of text) rather than leaking it', () =>
    expect(
      applyScalar(
        'foca_owner_state',
        PARTIES(OWNER('Main Owner', 'X', 'c/o Hans Muster', 'Switzerland'))
      )
    ).toBeNull());
  it('drops the N/A extraLine sentinel', () =>
    expect(
      applyScalar('foca_owner_state', PARTIES(OWNER('Main Owner', 'X', 'N/A', 'Switzerland')))
    ).toBeNull());

  it('reads owner country verbatim', () =>
    expect(
      applyScalar('foca_owner_country', PARTIES(OWNER('Main Owner', 'X', 'N/A', 'Germany')))
    ).toBe('Germany'));

  it('returns co-owner when a Part Owner accompanies the Main Owner', () =>
    expect(
      applyScalar(
        'foca_owner_kind',
        PARTIES(
          OWNER('Main Owner', 'A', 'UR', 'Switzerland'),
          OWNER('Part Owner', 'B', 'UR', 'Switzerland')
        )
      )
    ).toBe('co-owner'));
  it('returns null owner kind for a single owner', () =>
    expect(applyScalar('foca_owner_kind', swissOwnerOnly)).toBeNull());
  it('returns co-owner for multiple operators', () =>
    expect(
      applyScalar(
        'foca_operator_kind',
        PARTIES(
          OWNER('Main Operator', 'A', 'ZH', 'Switzerland'),
          OWNER('Part Operator', 'B', 'GE', 'Switzerland')
        )
      )
    ).toBe('co-owner'));

  it('returns null when the role is absent', () =>
    expect(
      applyScalar('foca_owner_name', PARTIES(OWNER('Main Operator', 'OnlyOp', 'ZH', 'Switzerland')))
    ).toBeNull());
  it('returns null for an empty cell', () => expect(applyScalar('foca_owner_name', '')).toBeNull());
  it('returns null for malformed JSON', () =>
    expect(applyScalar('foca_owner_name', '[{bad')).toBeNull());
  it('returns null for valid JSON that is not an array', () =>
    expect(applyScalar('foca_owner_name', '{"holderCategory":{}}')).toBeNull());
  it('collapses an empty-string party name to null', () =>
    expect(
      applyScalar('foca_owner_name', PARTIES(OWNER('Main Owner', '', 'ZH', 'Switzerland')))
    ).toBeNull());
});

describe('date_dd_dot_or_null', () => {
  it('parses DD.MM.YYYY', () =>
    expect(applyScalar('date_dd_dot_or_null', '02.06.2005')).toBe('2005-06-02'));
  it('accepts a leap day', () =>
    expect(applyScalar('date_dd_dot_or_null', '29.02.2024')).toBe('2024-02-29'));
  it('trims surrounding whitespace', () =>
    expect(applyScalar('date_dd_dot_or_null', '  01.01.2000  ')).toBe('2000-01-01'));
  it('returns null for empty', () => expect(applyScalar('date_dd_dot_or_null', '')).toBeNull());
  it('returns null for an out-of-range day', () =>
    expect(applyScalar('date_dd_dot_or_null', '32.01.2026')).toBeNull());
  it('returns null for an out-of-range month', () =>
    expect(applyScalar('date_dd_dot_or_null', '01.13.2026')).toBeNull());
  it('rejects a non-leap Feb 29', () =>
    expect(applyScalar('date_dd_dot_or_null', '29.02.2025')).toBeNull());
  it('rejects the slash variant', () =>
    expect(applyScalar('date_dd_dot_or_null', '02/06/2005')).toBeNull());
});

const NO_HEX = (hex: string): string =>
  JSON.stringify([
    { Desimal: '4687683' },
    { Binær: '101' },
    { Oktal: '21' },
    { Heksadesimal: hex },
  ]);

describe('no_hex_or_null', () => {
  it('extracts the hexadecimal radix', () =>
    expect(applyScalar('no_hex_or_null', NO_HEX('478743'))).toBe('478743'));
  it('lowercases the hex', () =>
    expect(applyScalar('no_hex_or_null', NO_HEX('47C097'))).toBe('47c097'));
  it('zero-pads a short address', () =>
    expect(applyScalar('no_hex_or_null', NO_HEX('4bf'))).toBe('0004bf'));
  it('returns null for empty', () => expect(applyScalar('no_hex_or_null', '')).toBeNull());
  it('returns null for malformed JSON', () =>
    expect(applyScalar('no_hex_or_null', '[{bad')).toBeNull());
  it('returns null when no hexadecimal entry is present', () =>
    expect(applyScalar('no_hex_or_null', JSON.stringify([{ Desimal: '123' }]))).toBeNull());
  it('returns null for a non-hex value', () =>
    expect(applyScalar('no_hex_or_null', NO_HEX('zzzzzz'))).toBeNull());
  it('returns null for valid JSON that is not an array', () =>
    expect(applyScalar('no_hex_or_null', '{"Heksadesimal":"478743"}')).toBeNull());
});

const NO_OWNER = (
  type: string,
  navn: string,
  orgnr: string | null,
  land: string
): Record<string, string> => ({
  'Eier type': type,
  Navn: navn,
  ...(orgnr ? { Organisasjonsnummer: orgnr } : {}),
  Gateadresse: 'Somestreet 1',
  Postnummer: '0000',
  Poststed: 'Oslo',
  Land: land,
});
const NO_OWNERS = (...owners: Record<string, string>[]): string => JSON.stringify(owners);

describe('no owner transforms', () => {
  const corp = NO_OWNERS(
    NO_OWNER('Eier/Kontakt', 'Robertsen Investments AS', '926310925', 'Norge')
  );
  const person = NO_OWNERS(NO_OWNER('Eier/Kontakt', 'Taraldsen, Stian', null, 'Norge'));
  const foreign = NO_OWNERS(NO_OWNER('Eier/Kontakt', 'BE Probiotik SRL', '33951410', 'Romania'));
  const multi = NO_OWNERS(
    NO_OWNER('Eier', 'Berge, Jan Milton', null, 'Norge'),
    NO_OWNER('Eier/Kontakt', 'Granviken, Bjørn', null, 'Norge')
  );

  it('reads the Eier/Kontakt name', () =>
    expect(applyScalar('no_owner_name', corp)).toBe('Robertsen Investments AS'));
  it('falls back to the first entry when no contact is flagged', () =>
    expect(
      applyScalar('no_owner_name', NO_OWNERS(NO_OWNER('Eier', 'Solo Eier', null, 'Norge')))
    ).toBe('Solo Eier'));
  it('reads the owner country', () =>
    expect(applyScalar('no_owner_country', foreign)).toBe('Romania'));
  it('types an org-number owner as a corporation', () =>
    expect(applyScalar('no_owner_kind', corp)).toBe('corporation'));
  it('types a Norwegian owner without an org number as an individual', () =>
    expect(applyScalar('no_owner_kind', person)).toBe('individual'));
  it('does not misclassify a foreign owner whose org number is missing', () =>
    expect(
      applyScalar(
        'no_owner_kind',
        NO_OWNERS(NO_OWNER('Eier/Kontakt', 'Foreign Aviation Ltd', null, 'United Kingdom'))
      )
    ).toBeNull());
  it('types multiple owners as co-owner', () =>
    expect(applyScalar('no_owner_kind', multi)).toBe('co-owner'));
  it('reads the contact name from a multi-owner array', () =>
    expect(applyScalar('no_owner_name', multi)).toBe('Granviken, Bjørn'));
  it('returns null name/kind/country for an empty cell', () => {
    expect(applyScalar('no_owner_name', '')).toBeNull();
    expect(applyScalar('no_owner_kind', '')).toBeNull();
    expect(applyScalar('no_owner_country', '')).toBeNull();
  });
  it('returns null for malformed JSON', () =>
    expect(applyScalar('no_owner_name', '[{bad')).toBeNull());
  it('returns null for valid JSON that is not an array', () =>
    expect(applyScalar('no_owner_kind', '{"Navn":"x"}')).toBeNull());
  it('collapses a nameless owner kind to null', () =>
    expect(
      applyScalar('no_owner_kind', NO_OWNERS(NO_OWNER('Eier/Kontakt', '', null, 'Norge')))
    ).toBeNull());
});

describe('no_airworthiness_classes', () => {
  it('parses a multi-value category array', () =>
    expect(
      applyArray('no_airworthiness_classes', JSON.stringify(['Amateur Built', 'Experimental']))
    ).toEqual(['Amateur Built', 'Experimental']));
  it('parses a single-value array', () =>
    expect(applyArray('no_airworthiness_classes', JSON.stringify(['Sailplane']))).toEqual([
      'Sailplane',
    ]));
  it('trims and drops blank entries', () =>
    expect(applyArray('no_airworthiness_classes', JSON.stringify([' Normal ', '', '  ']))).toEqual([
      'Normal',
    ]));
  it('returns empty for an empty cell', () =>
    expect(applyArray('no_airworthiness_classes', '')).toEqual([]));
  it('returns empty for malformed JSON', () =>
    expect(applyArray('no_airworthiness_classes', '[{bad')).toEqual([]));
  it('returns empty for valid JSON that is not an array', () =>
    expect(applyArray('no_airworthiness_classes', '"Normal"')).toEqual([]));
});

describe('no_operator_kind', () => {
  it('types an org-number operator as a corporation', () =>
    expect(applyCompound('no_operator_kind', ['Heli Team AS', '850447772'])).toBe('corporation'));
  it('leaves an operator without an org number untyped', () =>
    expect(applyCompound('no_operator_kind', ['Ola Nordmann', ''])).toBeNull());
  it('returns null when no operator is named', () =>
    expect(applyCompound('no_operator_kind', ['', '850447772'])).toBeNull());
  it('returns null for an empty values array', () =>
    expect(applyCompound('no_operator_kind', [])).toBeNull());
});

describe('last_comma_segment_or_null', () => {
  const run = (v: string): string | null => applyScalar('last_comma_segment_or_null', v);

  it('returns the trailing country component of a postal address', () => {
    expect(run('1/34 Rosina Corlette Lane, RD 2, Blenheim 7272, New Zealand')).toBe('New Zealand');
    expect(run('Sunshine coast, Queensland 4559, Australia')).toBe('Australia');
  });

  it('returns a single segment unchanged', () => expect(run('Vanuatu')).toBe('Vanuatu'));

  it('ignores a trailing comma and surrounding whitespace', () => {
    expect(run('Beech, Alton, United Kingdom,')).toBe('United Kingdom');
    expect(run('  Alton ,  Hong Kong  ')).toBe('Hong Kong');
  });

  it('returns null for blank or comma-only input', () => {
    expect(run('')).toBeNull();
    expect(run('   ')).toBeNull();
    expect(run(', ,')).toBeNull();
  });
});

describe('hr_ccaa_registration', () => {
  it('restores the 9A- nationality prefix on a bare 3-letter mark', () =>
    expect(applyScalar('hr_ccaa_registration', 'ABC')).toBe('9A-ABC'));
  it('uppercases and trims before formatting', () =>
    expect(applyScalar('hr_ccaa_registration', '  daz ')).toBe('9A-DAZ'));
  it('returns null for a wrong-length mark', () =>
    expect(applyScalar('hr_ccaa_registration', 'AB')).toBeNull());
  it('returns null for a mark containing digits', () =>
    expect(applyScalar('hr_ccaa_registration', 'A1C')).toBeNull());
  it('returns null for an empty string', () =>
    expect(applyScalar('hr_ccaa_registration', '')).toBeNull());
});

describe('hr_ccaa_owner_country', () => {
  const run = (v: string): string | null => applyScalar('hr_ccaa_owner_country', v);

  it.each([
    ['Ireland', 'IE'],
    ['Irska', 'IE'],
    ['Republika Irska', 'IE'],
    ['Mađarska', 'HU'],
    ['Slovenija', 'SI'],
    ['Slovenia', 'SI'],
    ['Austria', 'AT'],
    ['Bermuda', 'BM'],
    ['Singapore', 'SG'],
  ])('maps the stated country %s to %s', (country, expected) =>
    expect(run(`1 Example Street, ${country}`)).toBe(expected)
  );

  it('normalizes a wrapped country name before mapping it', () =>
    expect(run('1 Example Street, Republika\nIrska')).toBe('IE'));

  it.each(['10 000 Zagreb', 'Dublin 15', ''])('drops a non-country address tail %p', (value) =>
    expect(run(`1 Example Street, ${value}`)).toBeNull()
  );
});

describe('hr_ccaa_owner_kind', () => {
  const run = (v: string): string | null => applyScalar('hr_ccaa_owner_kind', v);

  it("classifies the register's natural-person placeholder as individual", () =>
    expect(run('Fizička osoba')).toBe('individual'));
  it('classifies a "/"-joined pair of named parties as co-owner', () =>
    expect(run('Aeroklub Sinj / Fizička osoba')).toBe('co-owner'));
  it("classifies a d.o.o. suffix (Croatia's LLC-equivalent) as llc", () =>
    expect(run('Trade Air d.o.o.')).toBe('llc'));
  it('classifies a d.d. suffix (joint-stock company) as corporation', () =>
    expect(run('Geodetski zavod d.d.')).toBe('corporation'));
  it('classifies a Ltd/Limited/GmbH suffix as corporation', () => {
    expect(run('ACS Aero 4 Delta Limited')).toBe('corporation');
    expect(run('Some Leasing Ltd')).toBe('corporation');
    expect(run('Beispiel GmbH')).toBe('corporation');
  });
  it('classifies a Croatian government body as government', () => {
    expect(run('MORH Zapovjedništvo HRZ I')).toBe('government');
    expect(run('Ministrastvo unutarnjih poslova RH')).toBe('government');
    expect(run('Vlada RH')).toBe('government');
  });
  it('classifies a wrapped (newline-joined) owner cell by its still-intact suffix', () =>
    expect(run('Zračno pristanište Mali Lošinj\nd.o.o.')).toBe('llc'));
  it('returns null for whitespace-only input', () => expect(run('   ')).toBeNull());
  it('falls back to other for an association with no recognized legal-form signal', () =>
    expect(run('Aeroklub "Osijek"')).toBe('other'));
  it('returns null for blank input', () => expect(run('')).toBeNull());
});

describe('hr_ccaa_build_certification', () => {
  it('marks a homebuilt manufacturer cell as not-type-certificated', () => {
    expect(applyScalar('hr_ccaa_build_certification', 'amaterska gradnja')).toBe(
      'not-type-certificated'
    );
    expect(applyScalar('hr_ccaa_build_certification', 'amaterski građen')).toBe(
      'not-type-certificated'
    );
  });
  it('returns null for a real manufacturer name', () =>
    expect(applyScalar('hr_ccaa_build_certification', 'The Boeing Company')).toBeNull());
  it('returns null for an empty string', () =>
    expect(applyScalar('hr_ccaa_build_certification', '')).toBeNull());
});

describe('br_status', () => {
  it('reads a populated DT_CANC as cancelled regardless of situation code', () => {
    expect(applyCompound('br_status', ['19/11/2025', 'M'])).toBe('cancelled');
    expect(applyCompound('br_status', ['18/03/2020', 'M824'])).toBe('cancelled');
  });

  // The bug this exists for: reserved marks carry no DT_CANC, so a date-only status served them.
  it('maps a mark reserve to reserved', () => {
    expect(applyCompound('br_status', ['', 'R'])).toBe('reserved');
    expect(applyCompound('br_status', ['', 'R4'])).toBe('reserved');
  });

  it('maps a cancelled registration with no DT_CANC to cancelled', () =>
    expect(applyCompound('br_status', ['', 'M'])).toBe('cancelled'));

  it('keeps every normal-situation code valid', () => {
    expect(applyCompound('br_status', ['', 'N'])).toBe('valid');
    expect(applyCompound('br_status', ['', 'U'])).toBe('valid');
    expect(applyCompound('br_status', ['', 'Z'])).toBe('valid');
  });

  it('keeps an airworthiness-restricted mark valid', () => {
    expect(applyCompound('br_status', ['', 'S8'])).toBe('valid');
    expect(applyCompound('br_status', ['', 'C18'])).toBe('valid');
    expect(applyCompound('br_status', ['', 'V8'])).toBe('valid');
    expect(applyCompound('br_status', ['', 'X'])).toBe('valid');
    expect(applyCompound('br_status', ['', 'P'])).toBe('valid');
  });

  it('returns null when neither column states anything', () =>
    expect(applyCompound('br_status', ['', ''])).toBeNull());

  it('throws on an unrecognized situation code rather than defaulting to valid', () => {
    expect(() => applyCompound('br_status', ['', 'Q9'])).toThrow(/unrecognized CD_INTERDICAO/);
  });
});
