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
export type OwnerKind = z.infer<typeof OwnerKindSchema>;

export const AircraftStatusSchema = z.enum([
  'valid',
  'invalid',
  'expired',
  'cancelled',
  'restricted',
  'other',
]);
export type AircraftStatus = z.infer<typeof AircraftStatusSchema>;

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
  'other',
]);
export type AirframeType = z.infer<typeof AirframeTypeSchema>;

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
export type EngineType = z.infer<typeof EngineTypeSchema>;

export const AircraftCategorySchema = z.enum([
  'standard',
  'limited',
  'experimental',
  'provisional',
  'other',
]);
export type AircraftCategory = z.infer<typeof AircraftCategorySchema>;

export const BuildCertificationSchema = z.enum(['type-certificated', 'not-type-certificated']);
export type BuildCertification = z.infer<typeof BuildCertificationSchema>;

export const OperatingEnvironmentSchema = z.enum(['land', 'sea', 'amphibian']);
export type OperatingEnvironment = z.infer<typeof OperatingEnvironmentSchema>;

export const OwnerSchema = z.object({
  name: z.string().nullable(),
  kind: OwnerKindSchema.nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
});
export type Owner = z.infer<typeof OwnerSchema>;

export const OperatorSchema = OwnerSchema;

// Date transforms emit YYYY-MM-DD or null; constrain the schema to match.
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO YYYY-MM-DD date')
  .nullable();

export const EngineSchema = z.object({
  manufacturer: z.string().nullable(),
  model: z.string().nullable(),
  type: EngineTypeSchema.nullable(),
  count: z.number().int().nullable(),
  horsepower: z.number().nullable(),
  thrust_lbs: z.number().nullable(),
});
export type Engine = z.infer<typeof EngineSchema>;

export const AircraftSchema = z.object({
  source: z.string(),
  source_id: z.string(),
  registration: z.string(),
  icao_hex: z.string().nullable(),
  icao_type_code: z.string().nullable(),
  status: AircraftStatusSchema,
  country: z.string(),
  manufacturer: z.string().nullable(),
  model: z.string().nullable(),
  serial_number: z.string().nullable(),
  year_manufactured: z.number().int().nullable(),
  airframe_type: AirframeTypeSchema.nullable(),
  category: AircraftCategorySchema.nullable(),
  build_certification: BuildCertificationSchema.nullable(),
  airworthiness_class: z.string().nullable(),
  operating_environment: OperatingEnvironmentSchema.nullable(),
  operational_classes: z.array(z.string()),
  engine: EngineSchema,
  owner: OwnerSchema,
  operator: OperatorSchema,
  idera_authorised_party: z.string().nullable(),
  certification_date: isoDate,
  airworthiness_date: isoDate,
  expiration_date: isoDate,
  last_action_date: isoDate,
  cruise_speed_ktas: z.number().nullable(),
  max_takeoff_weight_kg: z.number().nullable(),
  seats: z.number().int().nullable(),
  max_passengers: z.number().int().nullable(),
  min_crew: z.number().int().nullable(),
  airworthiness_review_date: isoDate,
  cancellation_reason: z.string().nullable(),
  lien_status: z.string().nullable(),
  // Authoritative restriction code, preserved verbatim — its legend is registry-specific and
  // not published in machine-readable form, so consumers decode it against their own table.
  interdiction_code: z.string().nullable(),
});
export type Aircraft = z.infer<typeof AircraftSchema>;
