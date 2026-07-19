// One typed description of the feed row shape, shared by the producer (feed.ts, which
// builds it) and the service (handler.ts, which reads it back via SELECT *). Type-only with no
// runtime imports, so it stays a shared shape without coupling the service to the pipeline. Mirrors
// the feed table built in feed.ts; adding a column there + in the producer's COLUMNS list surfaces
// here.
export interface FeedRow {
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
