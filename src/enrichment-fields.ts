// One typed description of the enrichment row shape, shared by the producer (enrichment.ts, which
// writes it as SQL) and the Worker (handler.ts, which reads it back via SELECT *). Type-only with no
// runtime imports, so pulling it into the Worker bundle adds nothing. Mirrors the enrichment table
// (worker/migrations); adding a column there + in the producer's COLUMNS list surfaces here.
export interface EnrichmentFields {
  icao_hex: string;
  registration: string;
  icao_type_code: string | null;
  status: string;
  country: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  year_manufactured: number | null;
  airframe_type: string | null;
  category: string | null;
  engine_manufacturer: string | null;
  engine_model: string | null;
  engine_type: string | null;
  engine_count: number | null;
  engine_horsepower: number | null;
  engine_thrust_lbs: number | null;
  seats: number | null;
  max_passengers: number | null;
  cruise_speed_ktas: number | null;
  max_takeoff_weight_kg: number | null;
  owner_name: string | null;
  owner_kind: string | null;
  owner_state: string | null;
  owner_country: string | null;
  operator_name: string | null;
  operator_kind: string | null;
  operator_state: string | null;
  operator_country: string | null;
  source: string;
}
