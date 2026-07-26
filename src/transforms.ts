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

// Trims and collapses the "N/A" placeholder (and blanks) to null. Several registers — FOCA among
// them — write "N/A" into optional text cells instead of leaving them empty.
const naOrNull = (value: string): string | null => {
  const v = value.trim();
  return v.length > 0 && v !== 'N/A' ? v : null;
};

const lowercase = (value: string): string => value.trim().toLowerCase();

const uppercase = (value: string): string => value.trim().toUpperCase();

// Number(), not parseInt/parseFloat: parse* silently accept a numeric prefix and ignore the rest
// ("1,800" -> 1, "180 HP" -> 180), which would corrupt a thousands-separated or unit-suffixed
// upstream cell into a plausible-looking but wrong value instead of nulling it.
const intOrNull = (value: string): string | null => {
  const v = value.trim();
  if (v.length === 0) return null;
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.trunc(n)) : null;
};

const floatOrNull = (value: string): string | null => {
  const v = value.trim();
  if (v.length === 0) return null;
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : null;
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

// 8-digit DDMMYYYY — distinct from date_yyyymmdd_or_null, which reads the same digits as YYYYMMDD.
const dateDdmmyyyyOrNull = (value: string): string | null => {
  const v = value.trim();
  if (!/^\d{8}$/.test(v)) return null;
  return validateAndFormatYMD(v.slice(4, 8), v.slice(2, 4), v.slice(0, 2));
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

const MONTH_ABBR: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

// `D-MMM-YY` (e.g. "2-Dec-95", "15-Jun-25") — the CAA Maldives register date style. Two-digit years
// pivot at 50: 00–49 → 2000s, 50–99 → 1900s, which covers every aircraft registration date in use.
const dateDmmmyyOrNull = (value: string): string | null => {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const month = MONTH_ABBR[m[2].toLowerCase()];
  if (!month) return null;
  const yy = Number(m[3]);
  const year = String(yy < 50 ? 2000 + yy : 1900 + yy);
  return validateAndFormatYMD(year, month, m[1].padStart(2, '0'));
};

// First physical line of a multi-line cell (positioned-PDF extraction joins wrapped lines with
// "\n"), e.g. the name line of an owner/mortgagee address block. Blank → null.
const firstLineOrNull = (value: string): string | null => trimOrNull(value.split('\n')[0] ?? '');

// Collapses internal newlines/runs of whitespace to single spaces and trims; blank → null. Flattens
// a wrapped multi-line cell (manufacturer/model) into one line, preserving all tokens.
const collapseWsOrNull = (value: string): string | null => {
  const v = value.replace(/\s+/g, ' ').trim();
  return v.length > 0 ? v : null;
};

// CAA Maldives IDERA cell → just the authorised-party name. The cell is a multi-line block:
// optional "None" / "Letter No: …" reference / parenthetical-date prefix, then the party name, then
// its postal address. Only the party name is kept; the address block that follows is PII and dropped
// at the boundary, never reaching the artifact. Returns null when no party line is present (e.g.
// "None"). A multi-line party name keeps only its first line — acceptable; the party stays identifiable.
const mvIderaParty = (value: string): string | null => {
  const lines = value
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const party = lines.find((l) => l !== 'None' && !/^Letter No\b/i.test(l) && !/^\(.*\)$/.test(l));
  return party ?? null;
};

// Excel day 0 is 1899-12-30 rather than 1899-12-31 to absorb the phantom leap day
// (Excel serial 60 = Feb 29, 1900, which never existed). Anchoring two days before
// 1900-01-01 makes all serials >= 61 (1900-03-01+) resolve correctly, which covers
// all aircraft manufacture dates.
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

// Converts an Excel serial date to a 4-digit year. The canonical schema stores only
// year_manufactured, so day/month are intentionally not preserved. Returns null for
// blank/non-numeric cells or years outside the sane 1900–2100 window.
const excelSerialYearOrNull = (value: string): string | null => {
  const v = value.trim();
  if (v.length === 0) return null;
  const serial = Number(v);
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const year = new Date(EXCEL_EPOCH_UTC + Math.trunc(serial) * MS_PER_DAY).getUTCFullYear();
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

// AESA writes sentinels for absent values instead of leaving cells blank: "NO DISPONIBLE" / "N/A"
// (serial), "NO TIENE" (no engine), "DESCONOCIDO" (engine model unknown). Positioned-PDF extraction
// wraps "NO DISPONIBLE" across two lines, so whitespace is collapsed before the sentinel test. Real
// values pass through collapsed and case-preserved.
const ES_AESA_SENTINELS = new Set(['NO DISPONIBLE', 'N/A', 'NO TIENE', 'DESCONOCIDO']);
const esAesaDetailOrNull = (value: string): string | null => {
  const v = value.replace(/\s+/g, ' ').trim();
  if (v.length === 0 || ES_AESA_SENTINELS.has(v.toUpperCase())) return null;
  return v;
};

// Renders AESA's Spanish `Clase` as an English label, preserving the certification tier the enum
// `airframe_type` flattens away: the optional "ULM - " (ultralight) / "AFI - " (amateur-built)
// prefix becomes an English qualifier, its absence meaning a standard type-certificated aircraft.
// The physical type is translated from the base word (the wrapped PLANEADOR/MOTOPLANEADOR cell
// collapses first). Unknown/blank → null.
const esAesaClassEn = (value: string): string | null => {
  const raw = value.replace(/\s+/g, ' ').trim().toUpperCase();
  if (raw.length === 0) return null;
  let prefix = '';
  if (/^ULM\s*-\s*/.test(raw)) prefix = 'ultralight';
  else if (/^AFI\s*-\s*/.test(raw)) prefix = 'amateur-built';
  const base = raw.replace(/^(?:ULM|AFI)\s*-\s*/, '');
  let type: string | null = null;
  if (base.startsWith('HELICOPTERO')) type = 'helicopter (VTOL)';
  else if (base.startsWith('GLOBO')) type = 'balloon';
  else if (base.startsWith('PLANEADOR')) type = 'glider / motor-glider';
  else if (base.startsWith('AUTOGIRO')) type = 'gyroplane';
  else if (base.startsWith('PENDULAR')) type = 'weight-shift';
  else if (base.startsWith('AVION')) type = 'airplane';
  if (type === null) return null;
  return prefix ? `${prefix} ${type}` : type;
};

// Estonia publishes marks spaced around the hyphen ("ES - MBA", "ES - 1004"); collapse to the
// canonical hyphenated form ("ES-MBA"). Null for any non-ES- value: as the source_id transform with
// no allowed-missing policy, that makes an unexpected non-mark row fail the run rather than mint a
// bogus id.
const eeRegistration = (value: string): string | null => {
  const v = value.replace(/\s+/g, '').toUpperCase();
  return /^ES-[A-Z0-9]+$/.test(v) ? v : null;
};

// Restores the hyphen in a dash-stripped mark (PPACK -> PP-ACK); null if not the 2+3 shape.
const brRegistration = (value: string): string | null => {
  const v = value.trim().toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{3}$/.test(v)) return null;
  return `${v.slice(0, 2)}-${v.slice(2)}`;
};

// Chile's register stores the dash-less mark (CCAAA); restore the CC- prefix (CC-AAA). null if not
// the CC + 3 shape, which fails the row loudly rather than publishing a malformed registration.
const clRegistration = (value: string): string | null => {
  const v = value.trim().toUpperCase();
  return /^CC[A-Z0-9]{3}$/.test(v) ? `CC-${v.slice(2)}` : null;
};

// Class code (type letter + engine-count digit, e.g. L1P/H2T/L00) -> airframe_type. Digit 0 is
// unpowered (glider); RPA/unknown -> null (no canonical UAV enum).
const brAirframe = (value: string): string | null => {
  const v = value.trim().toUpperCase();
  if (v.length < 2 || v === 'RPA') return null;
  const kind = v[0];
  if (kind === 'H') return 'rotorcraft';
  if (kind === 'G') return 'gyroplane';
  if (kind === 'B') return 'balloon';
  if (kind === 'L' || kind === 'A' || kind === 'S') {
    const digit = v[1];
    if (!/^\d$/.test(digit)) return null;
    if (digit === '0') return 'glider';
    return digit === '1' ? 'fixed-wing-single-engine' : 'fixed-wing-multi-engine';
  }
  return null;
};

// No status column upstream; a populated cancellation date is the cancellation signal.
const brStatus = (value: string): string => (value.trim().length > 0 ? 'cancelled' : 'valid');

// "Indisponível" is the undisclosed-party sentinel -> null.
const BR_UNDISCLOSED = 'Indisponível';

const brFieldMeaningful = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().length > 0 && value.trim() !== BR_UNDISCLOSED;

// ANAC's RAB sometimes lists the same legal party (same DOCUMENTO) twice within one array and
// splits its detail across the copies — one carries the UF, the other leaves it "Indisponível".
// That is a self-duplicate, not co-ownership: collapse same-DOCUMENTO entries into one, taking the
// meaningful value per field, so party count reflects distinct parties and no populated value is
// stranded on a sibling copy (mark PSORO's two rows differed only because of this). Entries with no
// DOCUMENTO can't be matched, so they stay distinct.
const dedupeParties = (parties: Record<string, string>[]): Record<string, string>[] => {
  const byDoc = new Map<string, Record<string, string>>();
  const order: string[] = [];
  parties.forEach((party, index) => {
    const doc = (party.DOCUMENTO ?? '').trim();
    // Doc-less entries key on a per-index sentinel so they never merge. `anon-` can't collide with a
    // real DOCUMENTO (CPF/CNPJ are digit/masked strings, never letter-prefixed).
    const key = doc.length > 0 ? doc : `anon-${index}`;
    const existing = byDoc.get(key);
    if (existing === undefined) {
      byDoc.set(key, { ...party });
      order.push(key);
      return;
    }
    for (const [field, value] of Object.entries(party))
      if (!brFieldMeaningful(existing[field]) && brFieldMeaningful(value)) existing[field] = value;
  });
  return order.map((key) => byDoc.get(key) as Record<string, string>);
};

// owner/operator are JSON arrays packed into one CSV cell, sharing the {NOME, DOCUMENTO, UF}
// shape — so these transforms serve both columns.
const parseBrParties = (value: string): Record<string, string>[] | null => {
  const v = value.trim();
  if (v.length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(v);
    return Array.isArray(parsed) ? dedupeParties(parsed as Record<string, string>[]) : null;
  } catch {
    return null;
  }
};

const brPartyName = (value: string): string | null => {
  const name = parseBrParties(value)?.[0]?.NOME?.trim();
  return name && name !== BR_UNDISCLOSED ? name : null;
};

const brPartyState = (value: string): string | null => {
  const uf = parseBrParties(value)?.[0]?.UF?.trim();
  return uf && uf.length > 0 && uf !== BR_UNDISCLOSED ? uf : null;
};

// kind from DOCUMENTO length, not digits: CPFs arrive pre-masked (e.g. "587XXXXXX00"), so 11 =
// CPF (individual), 14 = CNPJ (corporation), >1 party = co-owner. The id is read for length
// only, never stored (PII).
const brPartyKind = (value: string): string | null => {
  const parties = parseBrParties(value);
  if (!parties || parties.length === 0) return null;
  if (parties.length > 1) return 'co-owner';
  if (parties[0]?.NOME?.trim() === BR_UNDISCLOSED) return null;
  const doc = String(parties[0]?.DOCUMENTO ?? '').trim();
  if (doc.length === 0) return null;
  if (doc.length === 14) return 'corporation';
  if (doc.length === 11) return 'individual';
  return 'other';
};

// FOCA's register API returns hex as a lowercase 24-bit Mode-S code, or "N/A" when none is
// assigned (e.g. reservations). Normalize and drop anything that is not a real 6-digit hex.
const focaHexOrNull = (value: string): string | null => {
  const v = value.trim().toLowerCase();
  return /^[0-9a-f]{6}$/.test(v) ? v : null;
};

// FOCA publishes dates as a [year, month, day] JSON array (serialized to a string by the JSON
// flattener). Reformat to canonical YYYY-MM-DD; null on anything malformed or empty.
const focaDateArrayOrNull = (value: string): string | null => {
  const v = value.trim();
  if (v.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(v);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length !== 3) return null;
  // Array.isArray narrows `unknown` to `any[]` (a lib.es5.d.ts quirk, not `unknown[]`) — this cast
  // re-narrows to `unknown[]` so the destructure below can't silently propagate `any`.
  const ymd = parsed as unknown[];
  const y = ymd[0];
  const m = ymd[1];
  const d = ymd[2];
  if (typeof y !== 'number' || typeof m !== 'number' || typeof d !== 'number') return null;
  return validateAndFormatYMD(String(y), String(m).padStart(2, '0'), String(d).padStart(2, '0'));
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const SWISS_CANTONS = new Set([
  'ZH',
  'BE',
  'LU',
  'UR',
  'SZ',
  'OW',
  'NW',
  'GL',
  'ZG',
  'FR',
  'SO',
  'BS',
  'BL',
  'SH',
  'AR',
  'AI',
  'SG',
  'GR',
  'AG',
  'TG',
  'TI',
  'VD',
  'VS',
  'NE',
  'GE',
  'JU',
]);

interface FocaParty {
  role: string;
  name: string;
  state: string;
  country: string;
}

// `ownerOperators` is the per-aircraft party array (Main/Part Owner + Main/Part Operator), packed
// into one cell as a JSON string by the flattener. Address street/city/postal are deliberately not
// read — only name, canton, and country survive (PII rule). extraLine is a free-text "additional
// line" that sometimes holds the canton and sometimes a care-of name, so state keeps it only when
// it is a real Swiss canton abbreviation, never the care-of text.
const parseFocaParties = (value: string): FocaParty[] => {
  const v = value.trim();
  if (v.length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(v);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((entry) => {
    const o = asRecord(entry);
    const en = asRecord(asRecord(o.holderCategory).categoryNames).en;
    const addr = asRecord(o.address);
    const extraLine = typeof addr.extraLine === 'string' ? addr.extraLine.trim() : '';
    return {
      role: typeof en === 'string' ? en : '',
      name: typeof o.ownerOperator === 'string' ? o.ownerOperator.trim() : '',
      state: SWISS_CANTONS.has(extraLine) ? extraLine : '',
      country: typeof addr.country === 'string' ? addr.country.trim() : '',
    };
  });
};

const focaMainParty = (value: string, role: string): FocaParty | null =>
  parseFocaParties(value).find((p) => p.role === role) ?? null;

// Multiple owners/operators (a Main plus one or more Part parties) collapse to a single canonical
// owner/operator; co-owner records the multiplicity the schema cannot otherwise represent. Entity
// type (individual/corporation) is not published, so a single party yields null rather than a guess.
const focaPartyKind = (value: string, mainRole: string, partRole: string): string | null => {
  const count = parseFocaParties(value).filter(
    (p) => p.role === mainRole || p.role === partRole
  ).length;
  return count > 1 ? 'co-owner' : null;
};

const focaOwnerName = (value: string): string | null =>
  focaMainParty(value, 'Main Owner')?.name || null;

const focaOwnerState = (value: string): string | null =>
  focaMainParty(value, 'Main Owner')?.state || null;

const focaOwnerCountry = (value: string): string | null =>
  focaMainParty(value, 'Main Owner')?.country || null;

const focaOwnerKind = (value: string): string | null =>
  focaPartyKind(value, 'Main Owner', 'Part Owner');

const focaOperatorName = (value: string): string | null =>
  focaMainParty(value, 'Main Operator')?.name || null;

const focaOperatorState = (value: string): string | null =>
  focaMainParty(value, 'Main Operator')?.state || null;

const focaOperatorCountry = (value: string): string | null =>
  focaMainParty(value, 'Main Operator')?.country || null;

const focaOperatorKind = (value: string): string | null =>
  focaPartyKind(value, 'Main Operator', 'Part Operator');

// European dot-separated date DD.MM.YYYY (Norway's Registreringsdato style). Distinct from the
// slash variants so "02.06.2005" is unambiguously 2 June, never 6 February.
const dateDdDotOrNull = (value: string): string | null => {
  const v = value.trim();
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(v)) return null;
  return validateAndFormatYMD(v.slice(6, 10), v.slice(3, 5), v.slice(0, 2));
};

// Norway's `ICAO 24-bits adresse` is an array of single-key radix objects
// ([{Desimal},{Binær},{Oktal},{Heksadesimal}]), JSON-stringified by the flattener. Pull the
// hexadecimal representation, zero-pad to the canonical 6 digits (a small address drops leading
// zeros upstream), and drop anything that is not a real 24-bit hex.
const noHexOrNull = (value: string): string | null => {
  const v = value.trim();
  if (v.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(v);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const entry = (parsed as unknown[]).map(asRecord).find((o) => typeof o.Heksadesimal === 'string');
  const hex =
    typeof entry?.Heksadesimal === 'string' ? entry.Heksadesimal.trim().toLowerCase() : '';
  // Guard before padStart: an empty/absent hex would pad to "000000" and pass the format check.
  if (hex.length === 0) return null;
  const padded = hex.padStart(6, '0');
  return /^[0-9a-f]{6}$/.test(padded) ? padded : null;
};

interface NoOwner {
  type: string;
  name: string;
  orgnr: string;
  country: string;
}

// `Eier(e)` is the per-aircraft owner array, JSON-stringified by the flattener. Street/postal/city
// (Gateadresse/Postnummer/Poststed) are deliberately never read — only name, org-number (for kind),
// and country survive the PII rule.
const parseNoOwners = (value: string): NoOwner[] => {
  const v = value.trim();
  if (v.length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(v);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return (parsed as unknown[]).map((entry) => {
    const o = asRecord(entry);
    return {
      type: typeof o['Eier type'] === 'string' ? o['Eier type'] : '',
      name: typeof o.Navn === 'string' ? o.Navn.trim() : '',
      orgnr: typeof o.Organisasjonsnummer === 'string' ? o.Organisasjonsnummer.trim() : '',
      country: typeof o.Land === 'string' ? o.Land.trim() : '',
    };
  });
};

// The register marks the contact copy as "Eier/Kontakt"; that entry carries the canonical
// owner name and country. Falls back to the first entry when no contact is flagged.
const noPrimaryOwner = (owners: NoOwner[]): NoOwner | null =>
  owners.find((o) => o.type === 'Eier/Kontakt') ?? owners[0] ?? null;

const noOwnerName = (value: string): string | null =>
  noPrimaryOwner(parseNoOwners(value))?.name || null;

const noOwnerCountry = (value: string): string | null =>
  noPrimaryOwner(parseNoOwners(value))?.country || null;

// Multiple owner entries record co-ownership the schema cannot otherwise express. A Norwegian
// organisasjonsnummer positively identifies an organisation (corporation). Without one, a Norwegian
// party is a natural person (individual); a foreign party stays null — a non-Norwegian organisation
// simply has no organisasjonsnummer to show, so absence there proves nothing.
const NO_DOMESTIC_COUNTRY = 'Norge';
const noOwnerKind = (value: string): string | null => {
  const owners = parseNoOwners(value);
  if (owners.length === 0) return null;
  if (owners.length > 1) return 'co-owner';
  const primary = owners[0];
  if (!primary.name) return null;
  if (primary.orgnr.length > 0) return 'corporation';
  return primary.country === NO_DOMESTIC_COUNTRY ? 'individual' : null;
};

const SCALAR_HANDLERS: Record<ScalarTransformName, (value: string) => string | null> = {
  trim,
  trim_or_null: trimOrNull,
  na_or_null: naOrNull,
  lowercase,
  uppercase,
  int_or_null: intOrNull,
  float_or_null: floatOrNull,
  date_yyyymmdd_or_null: dateYyyymmddOrNull,
  date_yyyy_slash_or_null: dateYyyySlashOrNull,
  date_dd_slash_or_null: dateDdSlashOrNull,
  date_ddmmyyyy_or_null: dateDdmmyyyyOrNull,
  date_dmmmyy_or_null: dateDmmmyyOrNull,
  iso_date_only_or_null: isoDateOnlyOrNull,
  first_line_or_null: firstLineOrNull,
  collapse_ws_or_null: collapseWsOrNull,
  mv_idera_party: mvIderaParty,
  excel_serial_year_or_null: excelSerialYearOrNull,
  mph_to_ktas_or_null: mphToKtasOrNull,
  binary_to_hex_or_null: binaryToHexOrNull,
  faa_n_number: faaNNumber,
  faa_cert_class: faaCertClass,
  tc_full_registration: tcFullRegistration,
  nl_ilt_registration_or_null: nlIltRegistrationOrNull,
  casa_full_registration: casaFullRegistration,
  casa_engine_detail_or_null: casaEngineDetailOrNull,
  br_registration: brRegistration,
  ee_registration: eeRegistration,
  br_airframe: brAirframe,
  br_status: brStatus,
  br_party_name: brPartyName,
  br_party_state: brPartyState,
  br_party_kind: brPartyKind,
  es_aesa_detail_or_null: esAesaDetailOrNull,
  es_aesa_class_en: esAesaClassEn,
  foca_hex_or_null: focaHexOrNull,
  foca_date_array_or_null: focaDateArrayOrNull,
  foca_owner_name: focaOwnerName,
  foca_owner_state: focaOwnerState,
  foca_owner_kind: focaOwnerKind,
  foca_owner_country: focaOwnerCountry,
  foca_operator_name: focaOperatorName,
  foca_operator_state: focaOperatorState,
  foca_operator_kind: focaOperatorKind,
  foca_operator_country: focaOperatorCountry,
  date_dd_dot_or_null: dateDdDotOrNull,
  no_hex_or_null: noHexOrNull,
  no_owner_name: noOwnerName,
  no_owner_country: noOwnerCountry,
  no_owner_kind: noOwnerKind,
  cl_registration: clRegistration,
};

export const applyScalar = (name: ScalarTransformName, value: string): string | null =>
  SCALAR_HANDLERS[name](value);

const faaCertOps = (value: string): string[] => {
  const v = value.trim();
  return v.length > 1 ? v.slice(1).split('') : [];
};

// Norway's `Luftdyktighetskategori` is an array of airworthiness categories
// (["Amateur Built","Experimental"]), JSON-stringified by the flattener. Preserve each category —
// the schema's single-valued airworthiness_class would drop all but one.
const noAirworthinessClasses = (value: string): string[] => {
  const v = value.trim();
  if (v.length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(v);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return (parsed as unknown[])
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
};

const ARRAY_HANDLERS: Record<ArrayTransformName, (value: string) => string[]> = {
  faa_cert_ops: faaCertOps,
  no_airworthiness_classes: noAirworthinessClasses,
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

// Maps AESA's `Clase` + engine-count columns to a canonical `airframe_type`. Clase carries an
// optional certification prefix ("ULM - " ultralight, "AFI - " amateur-built) on the physical type;
// the prefix is stripped for typing (it is preserved verbatim in airworthiness_class) and the base
// word drives the enum:
// - HELICOPTERO (VTOL) → rotorcraft; GLOBO → balloon; AUTOGIRO → gyroplane; PENDULAR → weight-shift.
// - PLANEADOR/MOTOPLANEADOR → glider (a motor-glider is structurally a glider; the wrapped-cell
//   newline is collapsed first).
// - AVION disambiguates single- vs multi-engine via the engine-count column; a non-positive count
//   (blank/0) returns null rather than guessing. Anything unrecognized → null.
const esAesaAirframe = (values: string[]): string | null => {
  const raw = (values[0] ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
  if (raw.length === 0) return null;
  const base = raw.replace(/^(?:ULM|AFI)\s*-\s*/, '');
  if (base.startsWith('HELICOPTERO')) return 'rotorcraft';
  if (base.startsWith('GLOBO')) return 'balloon';
  if (base.startsWith('PLANEADOR')) return 'glider';
  if (base.startsWith('AUTOGIRO')) return 'gyroplane';
  if (base.startsWith('PENDULAR')) return 'weight-shift';
  if (base.startsWith('AVION')) {
    const n = Number.parseInt((values[1] ?? '').trim(), 10);
    if (Number.isNaN(n) || n < 1) return null;
    return n === 1 ? 'fixed-wing-single-engine' : 'fixed-wing-multi-engine';
  }
  return null;
};

// Norway's operator (`Operatør`) types as a corporation only with positive org-number evidence.
// Empty operator name → null (most aircraft list no distinct operator); a named operator without
// an org number stays unknown because the source does not prove it is a natural person.
const noOperatorKind = (values: string[]): string | null => {
  const name = (values[0] ?? '').trim();
  if (name.length === 0) return null;
  return (values[1] ?? '').trim().length > 0 ? 'corporation' : null;
};

const COMPOUND_HANDLERS: Record<CompoundTransformName, (values: string[]) => string | null> = {
  tc_airframe: tcAirframe,
  nl_ilt_airframe: nlIltAirframe,
  casa_airframe: casaAirframe,
  es_aesa_airframe: esAesaAirframe,
  no_operator_kind: noOperatorKind,
};

export const applyCompound = (name: CompoundTransformName, values: string[]): string | null =>
  COMPOUND_HANDLERS[name](values);
