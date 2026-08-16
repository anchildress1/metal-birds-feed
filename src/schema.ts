import { z } from 'zod';

export const OwnerKindSchema = z.enum([
  'individual',
  'partnership',
  'corporation',
  'co-owner',
  'government',
  'llc',
  'non-citizen-corporation',
  'non-citizen-co-owner',
  'other',
]);

export const AircraftStatusSchema = z.enum([
  'valid',
  'invalid',
  'expired',
  'cancelled',
  'restricted',
  // A mark held against a future registration, with no airframe behind it yet. Distinct from every
  // other value here, which describe an aircraft's standing: this one says there is no aircraft.
  // It needs its own value because `other` reaches the served feed, and TKA Lithuania fills a
  // reserved row's type column with the intended model — so `other` answered a tail-number lookup
  // with a plausible aircraft that does not exist. `toFeedRows` excludes it for that reason.
  'reserved',
  'other',
]);

export const AirframeTypeSchema = z.enum([
  'glider',
  'balloon',
  'blimp',
  'fixed-wing',
  'fixed-wing-single-engine',
  'fixed-wing-multi-engine',
  'rotorcraft',
  'weight-shift',
  'powered-parachute',
  'gyroplane',
  'hybrid-lift',
  // Unmanned is strictly a different axis from the structural values above — a drone is itself a
  // rotorcraft or a fixed-wing — but the registers that publish it say only "RPA" and give no
  // structure to place it on that axis. Recording what the register states beats nulling the field
  // and losing the one fact it does give.
  'uav',
  'other',
]);

export const EngineTypeSchema = z.enum([
  'none',
  'reciprocating',
  'turbo-prop',
  'turbo-shaft',
  'turbo-jet',
  'turbo-fan',
  'ramjet',
  '2-cycle',
  '4-cycle',
  'unknown',
  'electric',
  'rotary',
  'other',
]);

// Mirrors the airworthiness certificate classes registers actually issue. Restricted, primary,
// multiple, special-flight-permit, and light-sport are distinct classes with distinct operating
// consequences, not shades of `other` — collapsing them leaves a consumer unable to tell a
// crop-duster from a ferry permit. `other` stays for classes outside this set.
export const AircraftCategorySchema = z.enum([
  'standard',
  'limited',
  'restricted',
  'experimental',
  'provisional',
  'primary',
  'multiple',
  'special-flight-permit',
  'light-sport',
  'other',
]);

// Light Sport is a third builder-certification state, not a flavour of the other two: the FAA
// publishes it as its own code (ardata.pdf, Builder Certification Code 2) for ~10k aircraft.
export const BuildCertificationSchema = z.enum([
  'type-certificated',
  'not-type-certificated',
  'light-sport',
]);

export const OperatingEnvironmentSchema = z.enum(['land', 'sea', 'amphibian']);

export const OwnerSchema = z.object({
  name: z.string().nullable(),
  kind: OwnerKindSchema.nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
});
export type Owner = z.infer<typeof OwnerSchema>;

export const OperatorSchema = OwnerSchema;

// Legal owner = the title-holder / financier party, distinct from the registered owner and the
// operator. Some registers (e.g. CAA Maldives) publish all three; modelling it avoids collapsing a
// lessor into the operator slot.
export const LegalOwnerSchema = OwnerSchema;

// Date transforms emit YYYY-MM-DD or null; constrain the schema to match.
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO YYYY-MM-DD date')
  .nullable();

export const EngineSchema = z.object({
  manufacturer: z.string().nullable(),
  model: z.string().nullable(),
  type: EngineTypeSchema.nullable(),
  count: z.number().int().nonnegative().nullable(),
  horsepower: z.number().nonnegative().nullable(),
  thrust_lbs: z.number().nonnegative().nullable(),
});
export type Engine = z.infer<typeof EngineSchema>;

export const AircraftSchema = z.object({
  source: z.string(),
  source_id: z.string(),
  // Non-blank enforced here so a broken/renamed registration mapping fails each row loudly
  // instead of publishing a fleet of blank marks (row-count and hash guards can't see that).
  // \S also rejects whitespace-only values from padded columns in sources without trim_all.
  registration: z.string().regex(/\S/, 'registration must not be blank'),
  // Consumers index and join on this; a mixed-case or malformed value breaks every lookup
  // silently, so the canonical form (6 lowercase hex chars) is enforced at validation.
  icao_hex: z
    .string()
    .regex(/^[0-9a-f]{6}$/, 'icao_hex must be 6 lowercase hex characters')
    .nullable(),
  icao_type_code: z.string().nullable(),
  status: AircraftStatusSchema,
  country: z.string(),
  manufacturer: z.string().nullable(),
  model: z.string().nullable(),
  serial_number: z.string().nullable(),
  year_manufactured: z.number().int().nonnegative().nullable(),
  airframe_type: AirframeTypeSchema.nullable(),
  category: AircraftCategorySchema.nullable(),
  build_certification: BuildCertificationSchema.nullable(),
  // English-primary. An untranslated value survives here rather than nulling: a translation miss
  // leaves the pre-translation text in place.
  airworthiness_class: z.string().nullable(),
  // Untranslated original — the provenance a licence requiring the source meaning not be distorted
  // relies on (e.g. AESA Spain). Never read back by the pipeline; write-once at parse time.
  airworthiness_class_source_text: z.string().nullable(),
  operating_environment: OperatingEnvironmentSchema.nullable(),
  operational_classes: z.array(z.string()),
  operational_classes_source_text: z.array(z.string()),
  engine: EngineSchema,
  // One undifferentiated string, not a maker/model pair like `engine`: registers publish the
  // propeller as free text with no consistent boundary — TKA Lithuania alone emits "Woodcomp SR 200"
  // (no separator), "Neuform, CR3-V-R2H" (maker, model), "HARTZELL PROPELLER INC., HC-C2YR-IBFP,
  // CH42724B" (maker, model, serial), and makers whose own names contain the comma
  // (AB "Sportinė aviacija", LAK P4-90). Any split rule would invent a structure the register does
  // not state. Never a translation candidate, for the same reason as idera_authorised_party: it is
  // part numbers and proper nouns, which a translator mangles rather than renders.
  propeller: z.string().nullable(),
  owner: OwnerSchema,
  operator: OperatorSchema,
  legal_owner: LegalOwnerSchema,
  idera_authorised_party: z.string().nullable(),
  certification_date: isoDate,
  airworthiness_date: isoDate,
  expiration_date: isoDate,
  last_action_date: isoDate,
  cruise_speed_ktas: z.number().nonnegative().nullable(),
  max_takeoff_weight_kg: z.number().nonnegative().nullable(),
  seats: z.number().int().nonnegative().nullable(),
  max_passengers: z.number().int().nonnegative().nullable(),
  min_crew: z.number().int().nonnegative().nullable(),
  airworthiness_review_date: isoDate,
  cancellation_reason: z.string().nullable(),
  cancellation_reason_source_text: z.string().nullable(),
  lien_status: z.string().nullable(),
  lien_status_source_text: z.string().nullable(),
  // Authoritative restriction code, preserved verbatim — its legend is registry-specific and
  // not published in machine-readable form, so consumers decode it against their own table.
  interdiction_code: z.string().nullable(),
});
export type Aircraft = z.infer<typeof AircraftSchema>;

// Dotted leaf paths of the canonical record, derived from the schema so a field rename can't leave
// a stale hand-written allowlist behind. Config-declared paths (merge_duplicates) validate against
// this at load: an unlisted path would be written into the record, stripped by `safeParse`, and
// vanish with no diagnostic — a typo'd stamp (`operator.knd`) leaving the real field unset.
export const CANONICAL_PATHS: ReadonlySet<string> = new Set(
  Object.entries(AircraftSchema.shape).flatMap(([key, value]) =>
    value instanceof z.ZodObject ? Object.keys(value.shape).map((sub) => `${key}.${sub}`) : [key]
  )
);
