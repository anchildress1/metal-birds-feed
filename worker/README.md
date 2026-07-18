# Enrichment Worker 🛩️

Private point-lookup endpoint that turns an OpenSky `icao24` hex into aircraft details
(registration, type, owner) for [metal-birds-watch](../../metal-birds-watch). Single consumer,
bearer-token gated, no bulk or query surface — it answers "what is this hex the user already sees,"
never "hand over the dataset."

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
    "airframe_type": "fixed_wing",
    "manufacturer": "CESSNA",
    "model": "172S",
    "owner_name": "…",
    "owner_country": "US",
    "operator_name": null,
    "status": "valid"
  }
}
```

Hexes with no match are simply absent from the map. Errors: `401` (bad/missing token), `400`
(malformed body/hex), `404`/`405` (wrong path/method).

`metal-birds-watch` calls this **server-side** from its backend, so the raw response never reaches a
browser and no CORS is exposed.

## Data flow

```
refresh pipeline (src/enrichment.ts)          this Worker
  MBF_ENRICH_SQL_DIR=… bun run pipeline   →   POST /enrich  →  D1 (enrichment table)
        emits <source>.sql                        env.DB.prepare(…).bind(…hexes)
              │
              └─ wrangler d1 execute --file  ──────────────┘
```

The pipeline emits one `<source>.sql` dump per changed source (a `DELETE … WHERE source=` plus
chunked `INSERT OR REPLACE`). `wrangler d1 execute --file` loads it — the intended D1 bulk path, so
no per-row HTTP and no bound-parameter ceiling. R2 remains the source of truth; D1 is a derived,
rebuildable cache.

## First-time setup

```bash
cd worker
bun install                                    # pulls wrangler + workers-types
bunx wrangler d1 create mbf-enrichment         # copy the database_id into wrangler.toml
bunx wrangler secret put ENRICH_TOKEN          # same value goes into watch's backend env
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
