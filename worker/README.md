# Enrichment Worker 🛩️

Private, authenticated point-lookup endpoint that turns an OpenSky `icao24` hex into aircraft
details (registration, type, owner). Single consumer, gated by a UUID bearer secret, no bulk
or query surface — it answers "what is this hex the user already sees," never "hand over the dataset."
It is a private API, not a public one: every request must present the secret.

## Contract

```
POST /enrich
Authorization: Bearer <ENRICH_TOKEN>
Content-Type: application/json

{ "hexes": ["a1b2c3", "4d5e6f"] }        // ≤ 500, each ^[0-9a-f]{6}$
```

```json
{
  "a1b2c3": {
    "registration": "N12345",
    "icao_type_code": "C172",
    "status": "valid",
    "country": "US",
    "manufacturer": "CESSNA",
    "model": "172S",
    "serial_number": "172S1234",
    "year_manufactured": 2004,
    "airframe_type": "fixed-wing-single-engine",
    "category": "standard",
    "engine_manufacturer": "LYCOMING",
    "engine_model": "IO-360",
    "engine_type": "reciprocating",
    "engine_count": 1,
    "engine_horsepower": 180,
    "engine_thrust_lbs": null,
    "seats": 4,
    "max_passengers": 3,
    "cruise_speed_ktas": 124,
    "max_takeoff_weight_kg": 1157,
    "owner_name": "…",
    "owner_kind": "individual",
    "owner_state": "TX",
    "owner_country": "US",
    "operator_name": null,
    "operator_kind": null,
    "operator_state": null,
    "operator_country": null,
    "source": "faa"
  }
}
```

The value is the descriptive aircraft slice: identity, airframe, engine, performance, and ownership.
It excludes registry-admin bookkeeping the canonical record still carries (certification/
airworthiness dates, legal_owner, lien/interdiction codes, operational classes) — none of that
describes the aircraft to a spotter. Photos are not in the feed; a consumer sources those elsewhere.
Hexes with no match are simply absent from the map. Errors: `401` (bad/missing token), `429`
(rate limit — 120 req / 60s, shared across the single consumer), `400` (malformed body/hex),
`404`/`405` (wrong path/method). Auth is checked before routing, so an unauthenticated caller can't
map the route surface. The `RATE_LIMITER` binding is declared in `wrangler.toml` and deploys with
the Worker — no separate setup.

The consumer application calls this **server-side** from its backend, so the raw response never
reaches a browser and no CORS is exposed.

## Data flow

```
refresh pipeline (src/enrichment.ts)          this Worker
  MBF_ENRICH_SQL_DIR=… bun run pipeline   →   POST /enrich  →  D1 (enrichment table)
        emits <source>.sql                        env.DB.prepare(…).bind(…hexes)
              │
              └─ wrangler d1 execute --file  ──────────────┘
```

The pipeline emits one `<source>.sql` dump on every non-dry run (a `DELETE … WHERE source=` plus a
chunked guarded upsert). Emitting unconditionally — not only when the artifact changed — is what
makes the first D1 load work against already-current R2 sources and lets a failed emit self-heal on
the next run. `wrangler d1 execute --file` loads it — the intended D1 bulk path, so no per-row HTTP
and no bound-parameter ceiling. R2 remains the source of truth; D1 is a derived, rebuildable cache.

Records sharing an `icao_hex` collapse to one row: within a source the winner is chosen at emit
time (a cancelled record never shadows a live one, then most-recent date); across sources the upsert
is guarded so a cancelled row can't overwrite a live one regardless of import order.

## First-time setup

```bash
cd worker
bun install                                    # pulls wrangler + workers-types
bunx wrangler d1 create mbf-enrichment         # copy the database_id into wrangler.toml
bunx wrangler secret put ENRICH_TOKEN          # paste a UUID (uuidgen); same value into consumer env
cd .. && make worker-migrate                   # create the enrichment table (idempotent)
make deploy                                     # or let CI do it (below)
```

For CI, set the repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, and commit the
real `database_id` into `wrangler.toml` (an identifier, not a secret).

## Loading data

```bash
# in the feed repo, produce dumps for one source (or all)
MBF_ENRICH_SQL_DIR=./enrich-sql REFRESH_SOURCE=faa bun run src/pipeline.ts

# import each dump into D1
wrangler d1 execute mbf-enrichment --remote --file=../enrich-sql/faa.sql
```

## Deploy

- **CI**: `.github/workflows/deploy-worker.yml` runs `wrangler deploy` on push to `main` when
  `worker/**` or `src/worker/**` changes (also `workflow_dispatch`). Migration is deliberately not
  in the deploy path — deploy is idempotent, table creation is not.
- **Local**: `make deploy` (mirrors the workflow). One-time table setup: `make worker-migrate`.

## Data-load is not automated

Emitting dumps and importing them into D1 stays manual — no `refresh.yml` change ships here. To
automate later: a refresh step runs the pipeline with `MBF_ENRICH_SQL_DIR` set, then
`wrangler d1 execute --file` for each emitted dump, using a scoped Cloudflare API token.
