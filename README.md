<div align="center">
<img src="https://repository-images.githubusercontent.com/1226992141/2accc14a-5128-4d70-87df-03b2a8692b62" alt="Social banner image" />

# metal-birds-feed

[![CI](https://github.com/anchildress1/metal-birds-feed/actions/workflows/ci.yml/badge.svg)](https://github.com/anchildress1/metal-birds-feed/actions/workflows/ci.yml) [![License: Polyform Shield + Supplemental Terms](https://img.shields.io/badge/license-Polyform%20Shield%20%2B%20Supplemental%20Terms-blue)](LICENSE) [![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=anchildress1_metal-birds-feed&metric=alert_status)](https://sonarcloud.io/project/overview?id=anchildress1_metal-birds-feed) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=anchildress1_metal-birds-feed&metric=coverage)](https://sonarcloud.io/project/overview?id=anchildress1_metal-birds-feed)

</div>

Translates national aviation registries into a normalized SQLite artifact in Cloudflare R2, and
serves fast tail-number and ICAO hex lookups from a private [feed service](#feed-service) on
Cloud Run. Inspired by [metal-birds-watch](https://github.com/georgekobaidze/metal-birds-watch).

**Distribution model:** source-available code (Polyform Shield) + private operator
artifacts. The normalized output is for Ashley's own applications only, stored in a
private R2 bucket with no hosted public read API, public download, or public query
surface. Forks self-host against their own R2 bucket and their own per-source source-use
assessment. See [PRD.md](PRD.md) §Cross-Cutting for the full model.

## How It Works

A GitHub Actions matrix runs daily — one runner per source under `sources/*.yaml`.
Sources with `cadence_days` skip early until due; sources without it run every day.
Each runner:

1. Downloads the source's full bulk export (registries don't publish deltas)
2. Translates every row into the canonical `Aircraft` schema via the source's YAML mapping
3. Computes a content hash over the full record set and compares it to the prior run's hash in `_state`
4. Rebuilds the per-source SQLite artifact and PUTs it whole — only when that hash changed

### What's full vs skipped

| Step      | Pass type      | Notes                                                                                   |
| --------- | -------------- | --------------------------------------------------------------------------------------- |
| Download  | Full           | All sources ship full snapshots; no `If-Modified-Since` semantics                       |
| Translate | Full           | All rows re-parsed and transformed every run (~10s for FAA's 312k records)              |
| Hash      | Full O(n)      | One `sha256` over the sorted record set, compared to the prior run's hash in `_state`   |
| R2 write  | All-or-nothing | The whole SQLite artifact is PUT when the hash changed; skipped entirely when unchanged |

The write is wholesale, not incremental — no per-record diffing, no manifest, no DELETEs.
Registries don't expose deltas, and R2 ops are the expensive part, so an unchanged refresh
costs zero PUTs and a changed one costs a single (tens-of-MB) PUT.

### What a typical cadence run looks like

| Phase     | Bootstrap (first run) | Steady state (cadence run)       |
| --------- | --------------------- | -------------------------------- |
| Records   | ~312k all new         | ~3–6k changed (~1–2%)            |
| R2 writes | 1 PUT (full artifact) | 0 (unchanged) or 1 PUT (changed) |

FAA's first load doesn't fit GHA's 30-minute job cap, so it's run once locally — see
below. Smaller sources (TC ~37k, NL ILT ~3k) populate cleanly inside the cap and don't
need a local bootstrap.

> [!NOTE]
> One-time billing. Bootstrapping all live sources in one pass exceeds the 1 M Class A
> operations included in Cloudflare's free tier — expect a one-time charge of roughly **~$5-10 USD**.
> Steady-state monthly diffs stay well inside the free tier (~10k ops/source/month).

## Initial Load (Bootstrap)

The first FAA load against an empty R2 bucket writes ~312k records × 3 index paths,
which exceeds GHA's per-job timeout. Run it once locally; cadence runs handle
diffs forever after.

```bash
cp .env.example .env  # fill in MBF_R2_* and GEMINI_API_KEY
make bootstrap        # auto-loads .env, runs the full pipeline with no time cap
```

Tail `logs/pipeline.log` for `event=write_progress` ticks (every 5s during writes).
Override the source via `.env`'s `REFRESH_SOURCE` value (e.g., `REFRESH_SOURCE=nl-ilt`
to populate only the Dutch register).

For sources whose initial load fits the GHA budget, skip the local bootstrap and
trigger the workflow directly:

```bash
gh workflow run refresh.yml -f source=nl-ilt   # one-off, single-source
gh workflow run refresh.yml                    # all sources, respecting per-source cadence
```

## R2 Key Structure

| Path                                        | Contents                                                                                                                                                                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `aircraft/<source>.sqlite`                  | Per-source SQLite DB. Table `aircraft`: one typed column per canonical field (`source_id` PK; `owner_*`/`operator_*`/`engine_*` flattened; `operational_classes` JSON). Indexed `icao_hex`, `registration`, `status`, `airframe_type`, `owner_country` |
| `aircraft/_state/<source>.json`             | Last run/change state + `content_hash` for cadence gating and skip-if-unchanged                                                                                                                                                                        |
| `aircraft/_feed/<source>.json`              | Per-source feed slice (hex-collapsed descriptive columns) — the pipeline merges every source's slice into the one consolidated `feed.sqlite` the [feed service](#feed-service) serves                                                                  |
| `aircraft/_feed/_deployed.json`             | Content hash of the feed last deployed to Cloud Run — the scheduled deploy redeploys only when the freshly built feed differs from it                                                                                                                  |
| `aircraft/_translation_cache/<source>.json` | Versioned free-text hash → English translation cache for Gemini delta processing                                                                                                                                                                       |

One queryable artifact per source — filter or point-lookup on any column (every canonical field is its own typed column). Rebuilt and re-uploaded whole only when the record set's content hash changes.

## Feed Service

A private, authenticated point-lookup API for an authorized consumer application, deployed to Cloud Run. It serves **one consolidated `feed.sqlite`** — every source merged into a single `feed` table indexed by `icao_hex`, so a lookup is one `WHERE icao_hex IN (...)` on one table, never a union across per-country files.

- **`POST /feed`** `{ "hexes": ["a1b2c3", …] }` → hex-keyed map of the descriptive slice (identity, airframe, engine, performance, ownership), each row carrying the source's exact `attribution` line so a consumer credits it verbatim and only when that row is displayed. ≤ 500 hexes; misses omitted.
- Gated by a bearer secret (`FEED_TOKEN`, validated present and ≥ 16 chars at startup; a UUID is the convention) and rate-limited — a private API, not a public one. Every request presents the secret.
- Runs as a **single instance**, scale-to-zero (cold starts are fine — data is near-static). The consolidated DB is baked into the image.
- Redeploys **when the consolidated feed actually changes**, not on every cron tick: the scheduled `deploy-feed` job rebuilds the DB and deploys only if it differs from what is live (tracked by `_deployed.json`). A single source's failure never blocks shipping another source's update, and an all-unchanged run does not redeploy.
- `make build-feed` rebuilds the DB from every durable per-source `_feed` slice in R2. `make deploy` runs that build first (so an ambient stale `feed.sqlite` is never deployed), then `make deploy-only` ships it. R2 stays the artifact + intermediate store — only serving runs on Cloud Run.

## Setup

```bash
# Install dependencies and hooks
make install
```

## Available Commands

| Command             | Description                                       |
| ------------------- | ------------------------------------------------- |
| `make install`      | Install dependencies and git hooks                |
| `make format`       | Format code with Prettier                         |
| `make format-check` | Check formatting (non-destructive, used in CI)    |
| `make lint`         | Run ESLint                                        |
| `make typecheck`    | TypeScript type check                             |
| `make test`         | Run unit tests with coverage                      |
| `make build`        | Compile TypeScript to `dist/`                     |
| `make bootstrap`    | One-shot local initial load (reads `.env`)        |
| `make serve`        | Run the feed service locally (`MBF_FEED_DB_PATH`) |
| `make build-feed`   | Rebuild `feed.sqlite` from every R2 feed slice    |
| `make deploy-only`  | Deploy the on-disk `feed.sqlite` to Cloud Run     |
| `make deploy`       | Rebuild and deploy the feed service to Cloud Run  |
| `make secret-scan`  | Scan for accidentally committed secrets           |
| `make clean`        | Remove build artifacts                            |

## Required GitHub Actions Configuration

### Secrets

| Secret                     | Purpose                     |
| -------------------------- | --------------------------- |
| `MBF_R2_ACCOUNT_ID`        | Cloudflare account ID       |
| `MBF_R2_ACCESS_KEY_ID`     | R2 S3-compatible access key |
| `MBF_R2_SECRET_ACCESS_KEY` | R2 S3-compatible secret key |
| `MBF_R2_BUCKET_NAME`       | Target R2 bucket name       |
| `GEMINI_API_KEY`           | Gemini translation API key  |
| `SONAR_TOKEN`              | SonarCloud analysis token   |

### Variables

| Variable                         | Purpose                                      |
| -------------------------------- | -------------------------------------------- |
| `GCP_PROJECT_ID`                 | Cloud Run project                            |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | GitHub Workload Identity Federation provider |
| `GCP_SERVICE_ACCOUNT`            | Federated Cloud Run deployer service account |
| `GEMINI_REQUESTS_PER_MINUTE`     | Project-wide Gemini RPM limit (default: 10)  |
| `GCP_RUN_REGION`                 | Cloud Run region (default `us-east1`)        |
| `GCP_RUN_SERVICE`                | Service name (default `metal-birds-feed`)    |

`FEED_TOKEN` remains a Google Secret Manager binding on the Cloud Run service. The workflow never copies the token into GitHub.

## Sources

Sources active in the private operator pipeline, ordered alphabetically by country. Source
IDs remain in backticks where a source has a checked-in or planned config. The full
source-use tracker (every country contacted, sent/reply dates, status, and known storage
or cache restrictions) lives in [DATA_LICENSES.md](DATA_LICENSES.md).

<!-- prettier-ignore-start -->
| Agency | Country | Email | Sent | Reply | Status |
| --- | --- | --- | --- | --- | --- |
| CASA — au-casa | Australia | none | n/a | open | live |
| ANAC Brasil — br-anac | Brazil | rab@anac.gov.br | 2026-05-05 | confirmed | live |
| Transport Canada — tc-ca | Canada | none | n/a | open | live |
| DGAC — cl-dgac | Chile | registro.aeronaves@dgac.gob.cl | 2026-05-10 | confirmed | live |
| Transpordiamet — ee-tram | Estonia | info@transpordiamet.ee | 2026-05-10 | confirmed | live |
| CAA Latvia — lv-caa | Latvia | ivo.tukris@caa.gov.lv | n/a | open | live |
| CAA Maldives — mv-caa | Maldives | airworthiness@caa.gov.mv | 2026-05-05 | open | live |
| ILT — nl-ilt | Netherlands | none | n/a | open | live |
| CAA NZ — nz-caa | New Zealand | info@caa.govt.nz | 2026-05-05 | pending | live |
| Luftfartstilsynet — no-caa | Norway | postmottak@caa.no | 2026-05-05 | pending | live |
| CAA Oman — om-caa (pending impl) | Oman | customerservice@caa.gov.om | 2026-05-11 | pending | cleared: no dataset |
| CAAS — sg-caas | Singapore | caas_contact_centre@caas.gov.sg | 2026-05-06 | confirmed | live |
| AESA — es-aesa | Spain | rmac.aesa@seguridadaerea.es | 2026-05-05 | open | live |
| FOCA / BAZL — ch-foca | Switzerland | aircraftregistry@bazl.admin.ch | 2026-05-05 | confirmed | live |
| CAA Taiwan — tw-caa | Taiwan | gencaa@mail.caa.gov.tw | 2026-05-05 | confirmed | live |
| CAAT Thailand | Thailand | inter_focalpoint@caat.or.th | 2026-05-10 | confirmed | cleared |
| FAA — faa | United States | none | n/a | open | live |
<!-- prettier-ignore-end -->

Full correspondence/status detail: [DATA_LICENSES.md](DATA_LICENSES.md).

---

## Attribution

Required upstream notices, kept short:

- Transport Canada: Reproduced and distributed with the permission of the Government of Canada.
- Transport Canada value-added notice: This product has been produced by or for Ashley Childress and includes data provided by the Government of Canada. The incorporation of data sourced from the Government of Canada within this product shall not be construed as constituting an endorsement by the Government of Canada of our product.
- CASA Australia: source data from the Civil Aviation Safety Authority, licensed under CC BY 4.0; normalized into this project schema without implying endorsement.
- FOCA / BAZL Switzerland: source data from the Federal Office of Civil Aviation — [bazl.admin.ch](https://app02.bazl.admin.ch/web/bazl/en/); redistribution confirmed by FOCA, normalized into this project schema without implying endorsement.
- CAA Maldives: source data from the Civil Aviation Authority of the Republic of Maldives — [caa.gov.mv](https://www.caa.gov.mv/); reproduced with the CAA's written permission, normalized into this project schema without implying endorsement. Whilst reasonable care is taken compiling the data, the CAA does not warrant it is free of error or omission.
- Source: Estonian Transport Administration (Transpordiamet) – [transpordiamet.ee/ohusoidukite-register](https://transpordiamet.ee/ohusoidukite-register); reused and redistributed with permission for non-commercial use, normalized into this project schema without implying endorsement. The data is provided without guarantees of completeness, accuracy, or uninterrupted availability.
- CAAS Singapore: source data from the Civil Aviation Authority of Singapore — [certificate-of-registration](https://www.caas.gov.sg/industry/aircraft-operators/certificate-of-registration/); publicly accessible and free to use with attribution, confirmed by CAAS, normalized into this project schema without implying endorsement.
- Data source: Agencia Estatal de Seguridad Aérea (AESA) — [seguridadaerea.gob.es](https://www.seguridadaerea.gob.es/en/ambitos/aeronaves/registro-de-matriculas-de-aeronaves-civiles/registro-de-matriculas); reusable under Real Decreto 1495/2011 (Ley 37/2007 on public-sector-information reuse), normalized into this project schema without implying endorsement.
- DGAC Chile: source data from the Dirección General de Aeronáutica Civil (DGAC) of Chile — **sole official source and copyright holder** — [dgac.gob.cl/aeronaves-2/registro-nacional-de-aeronaves](https://www.dgac.gob.cl/aeronaves-2/registro-nacional-de-aeronaves/); reused non-commercially for research and reference under Ley N° 17.336 (Chilean Intellectual Property Law), confirmed in writing by DGAC 2026-07-22, normalized into this project schema without implying endorsement.
- Norway: source data from Luftfartstilsynet (Civil Aviation Authority of Norway), Norges luftfartøyregister — [data.norge.no](https://data.norge.no/datasets/ca241ae5-fc9e-3702-bbcd-5453d2d0f06f); publicly accessible with no specified license and treated as Private-use, normalized into this project schema without implying endorsement.
- New Zealand: source data from the Civil Aviation Authority of New Zealand — [aviation.govt.nz](https://www.aviation.govt.nz/aircraft/aircraft-registration/aircraft-register-search/); the CAA is acknowledged as the source as its terms require, treated as Private-use and normalized into this project schema without implying endorsement.
- Public-domain, CC0, and open-government sources without a specific notice above are credited here as a courtesy; the full source list is tracked in [DATA_LICENSES.md](DATA_LICENSES.md).

---

## Legal Notice

- **No liability transfer.** Using, forking, or deploying this repository does not transfer liability to the maintainer. Each operator is solely responsible for their own deployment and its consequences.
- **Private output only.** The maintained deployment writes normalized artifacts only to Ashley's private R2 bucket for Ashley-operated applications. It does not publish a public API, public dataset, or public download.
- **Per-country compliance is the operator's responsibility.** This project ingests data from civil aviation authorities in multiple jurisdictions. Each imposes its own data-use, storage, caching, redistribution, and privacy obligations. Operators must independently assess and satisfy those obligations.
- **Research is informational, not legal advice.** The source-use classifications and permissions in `DATA_LICENSES.md` reflect good-faith research at a point in time. They are not legal advice and carry no guarantee of completeness, accuracy, or continued validity.
- **Upstream terms change without notice.** Agencies amend terms, withdraw permissions, or restructure publication channels. Operators are responsible for monitoring those changes.
- **No liability.** The data pipeline, its output, and the license research are provided as-is. See the `No Liability` section of the [LICENSE](LICENSE).

---

## Adding a New Registry Source

[AGENTS.md](AGENTS.md) is authoritative for the rules below; this section is a friendlier overview and stays in sync with it.

1. Classify the source-use posture under PRD CC.1 (Open / Private-use / Restrictive / Unknown). Restrictive sources are excluded.
2. For Private-use or Unknown sources, verify whether the public terms prohibit automated access, storage, caching, or private application use. Send the agency permission email (template at [docs/agency-permission-request.md](docs/agency-permission-request.md)) only when research cannot clear private caching. Record outcome in `DATA_LICENSES.md`.
3. New source onboarding touches **all five surfaces** or the source is incomplete:
   - `sources/<source-id>.yaml` — mapping config; declare `format:` (`csv` | `ods` | `xlsx` | `xls` | `json` | `pdf` | `html`) and, if the upstream URL rolls per refresh, `download.discover_url:`.
   - `fixtures/<source-id>/` — CI ground-truth records covering positive / negative / edge cases.
   - `DATA_LICENSES.md` — classification, permitted uses, attribution wording quoted exactly (not the full reply — see AGENTS.md).
   - `README.md` sources table row — alphabetical by country (`scripts/check-sources-sorted.py` enforces).
   - `README.md` `## Attribution` block — the prominent display that satisfies the upstream license (courtesy credit for CC-0/public-domain sources).
4. New scalar or compound transforms require updates in **three places** simultaneously or the loader rejects the config: enum in `src/types/config.ts`, handler in `src/transforms.ts`, allowlist in `src/config/loader.ts`.

The translation engine itself is source-agnostic and stays unchanged for new registries. The downloader and parser dispatch only grow when a source introduces a new file format or download pattern (e.g., NL ILT added the `.ods`/`.xlsx` parser path and the `discover_url` filename-rolling pattern in v3; CAA Taiwan added the legacy `.xls` parser path; au-casa added the `casa_full_registration` / `date_dd_slash_or_null` / `casa_airframe` transforms; ch-foca added the `json` parser path with a `POST` download body for the FOCA search API, plus the `foca_*` owner/operator transforms; mv-caa added the positioned-coordinate `pdf` parser path for the rotated-grid Maldives register, the `date_dmmmyy_or_null` / `first_line_or_null` / `collapse_ws_or_null` / `mv_idera_party` transforms, and the `legal_owner` canonical field; ee-tram added the `html` parser path that reads a server-rendered register table and the `ee_registration` transform; no-caa added the `date_dd_dot_or_null` / `no_hex_or_null` / `no_owner_*` / `no_operator_kind` / `no_airworthiness_classes` transforms for the Norwegian JSON feed, reusing the existing `json` parser path).

## License

[Polyform Shield 1.0.0 + Supplemental Terms](LICENSE)
