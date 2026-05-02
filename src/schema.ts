// Canonical aircraft schema — single source of truth (R0.1).
// All registry sources normalize into this shape.

export type OwnerKind =
  | 'individual'
  | 'partnership'
  | 'corporation'
  | 'co-owner'
  | 'government'
  | 'llc'
  | 'non-citizen-corporation'
  | 'non-citizen-co-owner'
  | 'other';

export type AircraftStatus = 'valid' | 'invalid' | 'expired' | 'cancelled' | 'other';

export type AirframeType =
  | 'glider'
  | 'balloon'
  | 'blimp'
  | 'fixed-wing-single-engine'
  | 'fixed-wing-multi-engine'
  | 'rotorcraft'
  | 'weight-shift'
  | 'powered-parachute'
  | 'gyroplane'
  | 'hybrid-lift'
  | 'other';

export type EngineType =
  | 'none'
  | 'reciprocating'
  | 'turbo-prop'
  | 'turbo-shaft'
  | 'turbo-jet'
  | 'turbo-fan'
  | 'ramjet'
  | '2-cycle'
  | '4-cycle'
  | 'unknown'
  | 'electric'
  | 'rotary'
  | 'other';

export type AircraftCategory = 'standard' | 'limited' | 'experimental' | 'provisional' | 'other';

export type BuildCertification = 'type-certificated' | 'not-type-certificated';

export interface Owner {
  name: string | null;
  kind: OwnerKind | null;
  state: string | null;
  country: string | null;
}

export interface Engine {
  manufacturer: string | null;
  model: string | null;
  type: EngineType | null;
  count: number | null;
  horsepower: number | null;
  thrust_lbs: number | null;
}

export interface Aircraft {
  source: string;
  source_id: string;
  registration: string;
  icao_hex: string | null;
  icao_type_code: string | null;
  status: AircraftStatus;
  country: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  year_manufactured: number | null;
  airframe_type: AirframeType | null;
  category: AircraftCategory | null;
  build_certification: BuildCertification | null;
  airworthiness_class: string | null;
  operational_classes: string[];
  engine: Engine;
  owner: Owner;
  certification_date: string | null;
  airworthiness_date: string | null;
  expiration_date: string | null;
  last_action_date: string | null;
  cruise_speed_ktas: number | null;
}
