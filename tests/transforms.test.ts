import { describe, it, expect } from 'vitest';
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

  describe('uppercase', () => {
    it('uppercases and trims', () => expect(applyScalar('uppercase', ' hello ')).toBe('HELLO'));
    it('returns empty string for blank', () => expect(applyScalar('uppercase', '   ')).toBe(''));
    it('returns empty string for empty', () => expect(applyScalar('uppercase', '')).toBe(''));
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
  it('returns null for RPA (drones not in canonical UAV enum)', () =>
    expect(applyScalar('br_airframe', 'RPA')).toBeNull());
  it('returns null for an unknown class code', () =>
    expect(applyScalar('br_airframe', 'X9Z')).toBeNull());
  it('returns null for an empty string', () => expect(applyScalar('br_airframe', '')).toBeNull());
});

describe('br_status', () => {
  it('returns cancelled when a cancellation date is present', () =>
    expect(applyScalar('br_status', '19/11/2025')).toBe('cancelled'));
  it('returns valid for an empty cancellation date', () =>
    expect(applyScalar('br_status', '')).toBe('valid'));
  it('returns valid for a whitespace-only cancellation date', () =>
    expect(applyScalar('br_status', '   ')).toBe('valid'));
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
