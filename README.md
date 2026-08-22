<div align="center">
<img src="https://repository-images.githubusercontent.com/1226992141/2accc14a-5128-4d70-87df-03b2a8692b62" alt="Social banner image" />

# metal-birds-feed

[![CI](https://github.com/anchildress1/metal-birds-feed/actions/workflows/ci.yml/badge.svg)](https://github.com/anchildress1/metal-birds-feed/actions/workflows/ci.yml) [![License: Polyform Shield + Supplemental Terms](https://img.shields.io/badge/license-Polyform%20Shield%20%2B%20Supplemental%20Terms-blue)](LICENSE)

[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=anchildress1_metal-birds-feed&metric=alert_status)](https://sonarcloud.io/project/overview?id=anchildress1_metal-birds-feed) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=anchildress1_metal-birds-feed&metric=coverage)](https://sonarcloud.io/project/overview?id=anchildress1_metal-birds-feed) <!-- prettier-ignore-start --><!--START_SECTION:rai-badge-->![AI attribution](https://img.shields.io/badge/AI%20attribution-73%25%20since%202026--05-C03070?style=flat)<!--END_SECTION:rai-badge--><!-- prettier-ignore-end -->

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

FAA's first load doesn't fit the 30-minute `timeout-minutes` this repo sets on the refresh
job (`refresh.yml`), so it's run once locally — see below. That ceiling is ours, not
GitHub's: hosted runners allow 6 hours per job, so raising it is an option if a cold FAA
load in CI is ever worth the runner minutes. Smaller sources (TC ~37k, NL ILT ~3k) populate
cleanly inside it and don't need a local bootstrap.

> [!NOTE]
> R2 billing. The operator's first data load incurred approximately **$6.50 USD** in R2 charges.
> That is an observed bill, not a guaranteed quote or a claim about which billing dimension caused
> it. Check current R2 pricing and your account usage before pulling data.

## Initial Load (Bootstrap)

The first FAA load translates ~315k records and PUTs the whole artifact, which exceeds the
refresh job's 30-minute `timeout-minutes`. Run it once locally; cadence runs handle diffs
forever after.

```bash
cp .env.example .env  # fill in MBF_R2_* and GEMINI_API_KEY
make refresh          # auto-loads .env, runs the full pipeline with no time cap
```

Tail `logs/pipeline.log` for `event=pipeline_complete` per source and `event=feed_published`
at the end. Override the source via `.env`'s `REFRESH_SOURCE` value (e.g.,
`REFRESH_SOURCE=nl-ilt` to populate only the Dutch register).

For sources whose initial load fits that timeout, skip the local bootstrap and
trigger the workflow directly:

```bash
gh workflow run refresh.yml -f source=nl-ilt   # one-off, single-source
gh workflow run refresh.yml                    # all sources, respecting per-source cadence
```

## R2 Key Structure

| Path                                        | Contents                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `aircraft/<source>.sqlite`                  | Per-source SQLite DB. Table `aircraft`: one typed column per canonical field (`source_id` PK; `owner_*`/`operator_*`/`engine_*` flattened; `operational_classes` JSON, with an untranslated `operational_classes_source_text` JSON twin). Indexed `icao_hex`, `registration`, `status`, `airframe_type`, `owner_country` |
| `aircraft/_state/<source>.json`             | Last run/change state + `content_hash` for cadence gating and skip-if-unchanged                                                                                                                                                                                                                                          |
| `aircraft/_feed/<source>.json`              | Versioned per-source feed slice (descriptive columns, collapsed on hex where the register publishes one and on the normalized mark where it does not) — the pipeline merges every source's slice into the one consolidated `feed.sqlite` the [feed service](#feed-service) serves                                        |
| `aircraft/_feed/_deployed.json`             | Content hash of the feed last deployed to Cloud Run — the scheduled deploy redeploys only when the freshly built feed differs from it                                                                                                                                                                                    |
| `aircraft/_translation_cache/<source>.json` | Versioned free-text hash → English text, for Gemini delta translation of the four English-primary fields (see AGENTS.md)                                                                                                                                                                                                 |

One queryable artifact per source — filter or point-lookup on any column (every canonical field is its own typed column). Rebuilt and re-uploaded whole only when the record set's content hash changes.

## Feed Service

A private, authenticated point-lookup API for an authorized consumer application, deployed to Cloud Run. It serves **one consolidated `feed.sqlite`** — every source merged into a single `feed` table carrying two unique keys, `icao_hex` and the normalized `registration_key`, so a lookup is one `WHERE <key> IN (...)` on one table, never a union across per-country files. Both columns are nullable; SQLite does not treat NULLs as equal, so a row missing one key still holds the other.

- **`POST /feed`** `{ "hexes": ["a1b2c3", …] }` → hex-keyed map of the descriptive slice (identity, airframe, engine, performance, ownership), each row carrying the source's exact `attribution` line so a consumer credits it verbatim and only when that row is displayed. Case is normalized — `A004B3` and `a004b3` reach the same row, and the map key is always the lowercase form. ≤ 500 hexes; misses omitted.
- **`POST /feed/registration`** `{ "registrations": ["C-FABC", …] }` → same payload keyed by the normalized registration, plus `icao_hex` (the caller keyed by something else, so the hex is new information). Punctuation and case are normalized on both sides — `C-FABC`, `c fabc`, and `CFABC` all reach the same row. ≤ 500 marks; misses omitted.

  Why both: `icao_hex` is what an ADS-B blip carries, but only 6 of 15 sources publish one at all, and just 5 publish one for every row — 51,981 of 413,000 records have none. Registration is required and present in every source, so hex-less records enter the feed keyed on the mark alone and `icao_hex` comes back null for them. Cancelled registrations are excluded from the feed so a reissued mark cannot make the key ambiguous. Where two aircraft still normalize to one mark (Canada renders the 3-character mark `ABC` as `CF-ABC` and the 4-character mark `FABC` as `C-FABC`), neither owns the key: it is cleared, so the lookup misses rather than answering with the wrong aircraft.

- Gated by a bearer secret (`FEED_TOKEN`, validated present and ≥ 16 chars at startup; a UUID is the convention) and rate-limited — a private API, not a public one. Every request presents the secret.
- Runs as a **single instance**, scale-to-zero (cold starts are fine — data is near-static). The consolidated DB is baked into the image.
- One deploy job (`.github/workflows/deploy.yml`), reached two ways. A merged Release Please PR deploys the released commit unconditionally — verifying `package.json` matches the tag first — because a version bump ships even when the data is unchanged. The daily refresh calls the same job, which redeploys only when the rebuilt DB differs from what is live (tracked by `_deployed.json`), so a register change reaches production the day it lands and a quiet day costs nothing. Ordinary merges never deploy. A single source's failure never blocks shipping another's update. Both paths assemble from existing R2 slices rather than re-pulling the registers, so a release that adds a source or changes the slice format needs a refresh to run first — otherwise the assembly fails closed rather than shipping a partial feed. For a rollback or a retry, run `make deploy` locally — same R2 slices, same path.
- `make build-feed` refreshes every source and then rebuilds the DB from the per-source `_feed` slices in R2 (`make assemble-feed` skips the refresh and only assembles — that is what CI calls, since its refresh matrix has already written the slices). `make deploy` assembles first (so an ambient stale `feed.sqlite` is never deployed) then ships it — it does not re-pull upstream, so run `make refresh` beforehand if the deploy should carry new register data. R2 stays the artifact + intermediate store — only serving runs on Cloud Run.

### Running the Feed Service Locally

Assembly reads the slices out of R2, so the four `MBF_R2_*` values must already be exported or
present in `.env` — `make assemble-feed` aborts naming the missing one otherwise. Serving needs
neither: it only opens the local file.

```bash
cp .env.example .env                   # fill in MBF_R2_ACCOUNT_ID / ACCESS_KEY_ID / SECRET_ACCESS_KEY / BUCKET_NAME
make assemble-feed                     # pulls every source's _feed slice from R2, writes feed.sqlite
                                       # (`make build-feed` re-pulls every configured register first)
export FEED_TOKEN=$(uuidgen)           # ≥16 chars required; a UUID is the convention
export MBF_FEED_DB_PATH=./feed.sqlite  # defaults to the service root if unset
make serve                             # starts on PORT (default 8080)
```

Call it with the bearer token from a single batched request — up to 500 hexes per call:

```bash
curl -s http://localhost:8080/feed \
  -H "Authorization: Bearer $FEED_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"hexes": ["a1b2c3", "d4e5f6"]}'
```

Misses are omitted from the response map rather than returned as nulls. `FEED_TOKEN` in
production is a Google Secret Manager binding on the Cloud Run service — never place the real
value in `.env` or any committed file.

## Setup

```bash
# Install dependencies and hooks
make install
```

**Setting up a self-hosted copy and not a developer?** Two guides cover the whole path — accounts,
credentials, first pull, local feed service — without assuming you read TypeScript:

- [docs/getting-started.md](docs/getting-started.md) — do it yourself, command by command
- [docs/getting-started-with-ai.md](docs/getting-started-with-ai.md) — have Claude Code or Codex
  drive it, via the setup skill in `.agents/skills/setup-metal-birds-feed/`

Either way, the registry clearances in [DATA_LICENSES.md](DATA_LICENSES.md) are Ashley's and several
are granted by name — a fork owes its own per-source assessment before pulling anything.

## Available Commands

| Command              | Description                                         |
| -------------------- | --------------------------------------------------- |
| `make help`          | List the commands below (default target)            |
| `make install`       | Install dependencies and git hooks                  |
| `make format`        | Format code with Prettier                           |
| `make format-check`  | Check formatting (non-destructive, used in CI)      |
| `make lint`          | Run ESLint                                          |
| `make typecheck`     | TypeScript type check                               |
| `make test`          | Run unit tests with coverage                        |
| `make check`         | format-check + lint + typecheck + test (CI gate)    |
| `make build`         | Compile TypeScript to `dist/`                       |
| `make refresh`       | Pull every source (reads `.env`)                    |
| `make serve`         | Run the feed service locally (`MBF_FEED_DB_PATH`)   |
| `make assemble-feed` | Build `feed.sqlite` from the R2 slices (no refresh) |
| `make build-feed`    | Refresh every source, then assemble `feed.sqlite`   |
| `make deploy-only`   | Deploy the on-disk `feed.sqlite` to Cloud Run       |
| `make deploy`        | Rebuild and deploy the feed service to Cloud Run    |
| `make secret-scan`   | Scan for accidentally committed secrets             |
| `make clean`         | Remove build artifacts                              |

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

`GCP_SERVICE_ACCOUNT` also needs `roles/artifactregistry.repoAdmin` for the post-deploy Artifact Registry cleanup policy to take effect — without it, deploys still succeed but skip pruning old `cloud-run-source-deploy` images:

```bash
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$GCP_SERVICE_ACCOUNT" \
  --role="roles/artifactregistry.repoAdmin"
```

## Sources

Sources active in the private operator pipeline, ordered alphabetically by country. ID is
the `sources/<id>.yaml` config stem. Sources that are cleared but not yet contributing rows
— and every source still in triage — are tracked in
[DATA_LICENSES.md](DATA_LICENSES.md) and
[docs/source-onboarding-checklist.md](docs/source-onboarding-checklist.md), not here.

<!-- prettier-ignore-start -->
| ID | Agency | Country | Status |
| --- | --- | --- | --- |
| `au-casa` | CASA | Australia | ✅ Live |
| `br-anac` | ANAC Brasil | Brazil | ✅ Live |
| `tc-ca` | Transport Canada | Canada | ✅ Live |
| `cl-dgac` | DGAC | Chile | ✅ Live |
| `hr-ccaa` | CCAA | Croatia | ✅ Live |
| `ee-tram` | Transpordiamet | Estonia | ✅ Live |
| `lv-caa` | CAA Latvia | Latvia | ✅ Live |
| `lt-tka` | TKA | Lithuania | ✅ Live |
| `mv-caa` | CAA Maldives | Maldives | ✅ Live |
| `nl-ilt` | ILT | Netherlands | ✅ Live |
| `nz-caa` | CAA NZ | New Zealand | ✅ Live |
| `no-caa` | Luftfartstilsynet | Norway | ✅ Live |
| `sg-caas` | CAAS | Singapore | ✅ Live |
| `es-aesa` | AESA | Spain | ✅ Live |
| `ch-foca` | FOCA / BAZL | Switzerland | ✅ Live |
| `tw-caa` | CAA Taiwan | Taiwan | ✅ Live |
| `faa` | FAA | United States | ✅ Live |
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
- Croatia: source data from the Croatian Civil Aviation Agency (CCAA) — [ccaa.hr](https://www.ccaa.hr/en/list-of-registered-aircraft-94674); publicly accessible with no specified license and treated as Private-use, normalized into this project schema without implying endorsement.
- New Zealand: source data from the Civil Aviation Authority of New Zealand — [aviation.govt.nz](https://www.aviation.govt.nz/aircraft/aircraft-registration/aircraft-register-search/); the CAA is acknowledged as the source as its terms require, treated as Private-use and normalized into this project schema without implying endorsement.
- **CAA Taiwan** (`tw-caa`): Source: Civil Aviation Administration, MOTC R.O.C. — [caa.gov.tw](https://www.caa.gov.tw/article.aspx?a=4499&lang=1). Licensed under the Open Government Data License, v1.0. Wording supplied by CAA and used verbatim; redistribution is permitted only for a non-commercial, source-available project.
- **ANAC Brazil** (`br-anac`): Source: Agência Nacional de Aviação Civil (ANAC), Brazil — [sistemas.anac.gov.br](https://sistemas.anac.gov.br/dadosabertos/Aeronaves/RAB/). Open data requiring no prior authorization, but proper citation of the source is mandatory.
- **TKA Lithuania** (`lt-tka`): Transporto kompetencijų agentūra (Transport Competence Agency), Lithuania — Civilinių orlaivių registro duomenys, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); retrieved from [data.gov.lt](https://data.gov.lt). Attribution, licence identification, and indication of changes are licence conditions; changes were made by normalization into this project schema, without implying endorsement.

Additional source credits — each line is the exact string `attributionFor()` serves with those rows. Registers whose own terms mandate particular wording are credited in the required-notice list above instead; that wording is recorded in [DATA_LICENSES.md](DATA_LICENSES.md) and is what the service returns.

- **FAA United States** (`faa`) — Source: Federal Aviation Administration (FAA), United States — public-domain civil aircraft registry, normalized into this project schema without implying endorsement.
- **CAA Latvia** (`lv-caa`) — Source: Civil Aviation Agency of Latvia (CAA Latvia) — open aviation registry, normalized into this project schema without implying endorsement.
- **ILT Netherlands** (`nl-ilt`) — Source: Human Environment and Transport Inspectorate (ILT), Netherlands — open aviation registry, normalized into this project schema without implying endorsement.

Correspondence, posture, and storage terms for every source are tracked in [DATA_LICENSES.md](DATA_LICENSES.md).

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

1. **Pick the source ID.** No generator script — it's `<iso-country-code>-<agency-abbrev>`, lowercase, hyphenated (e.g. `nl-ilt`, `br-anac`, `nz-caa`). Two checked-in IDs predate the rule and are not templates for new ones: `faa` is bare (globally unambiguous) and `tc-ca` is agency-first (the rule would give `ca-tc`). This slug is the shared identifier across every surface below — a filename stem for the config and fixtures, a row or map key everywhere else — so decide it first — renaming later means touching all seven.
2. Classify the source-use posture under PRD CC.1 (Open / Private-use / Restrictive / Unknown). Restrictive sources are excluded.
3. For Private-use or Unknown sources, verify whether the public terms prohibit automated access, storage, caching, or private application use. Send the agency permission email (template at [docs/agency-permission-request.md](docs/agency-permission-request.md)) only when research cannot clear private caching. Record outcome in `DATA_LICENSES.md`.
4. New source onboarding touches **all seven surfaces** or the source is incomplete:
   - `sources/<source-id>.yaml` — mapping config; declare `format:` (`csv` | `ods` | `xlsx` | `xls` | `json` | `pdf` | `html`) and, if the upstream URL rolls per refresh, `download.discover_url:`.
   - `fixtures/<source-id>/` — CI ground-truth records covering positive / negative / edge cases.
   - `DATA_LICENSES.md` — classification, permitted uses, attribution wording quoted exactly (not the full reply — see AGENTS.md).
   - `README.md` sources table row — alphabetical by country (`scripts/check-sources-sorted.py` enforces).
   - `README.md` `## Attribution` block — the prominent display that satisfies the upstream license (courtesy credit for CC-0/public-domain sources).
   - `src/service/attributions.ts` `NOTICES[<source-id>]` — the exact wording served in the feed API's `attribution` field; a missing entry silently falls back to a generic slug credit.
   - `docs/source-onboarding-checklist.md` `✅ Done` row — keeps the triage snapshot from losing a shipped source.
5. New scalar, array, or compound transforms require updates in **two places** simultaneously or the loader rejects the config: the name array in `src/types/config.ts` and the handler map in `src/transforms.ts`. `src/config/loader.ts` validates off those same arrays, so it needs no edit.

The translation engine itself is source-agnostic and stays unchanged for new registries. The downloader and parser dispatch only grow when a source introduces a new file format or download pattern (e.g., NL ILT added the `.ods`/`.xlsx` parser path and the `discover_url` filename-rolling pattern in v3; CAA Taiwan added the legacy `.xls` parser path; au-casa added the `casa_full_registration` / `date_dd_slash_or_null` / `casa_airframe` transforms; ch-foca added the `json` parser path with a `POST` download body for the FOCA search API, plus the `foca_*` owner/operator transforms; mv-caa added the positioned-coordinate `pdf` parser path for the rotated-grid Maldives register, the `date_dmmmyy_or_null` / `first_line_or_null` / `collapse_ws_or_null` / `mv_idera_party` transforms, and the `legal_owner` canonical field; ee-tram added the `html` parser path that reads a server-rendered register table and the `ee_registration` transform; no-caa added the `date_dd_dot_or_null` / `no_hex_or_null` / `no_owner_*` / `no_operator_kind` / `no_airworthiness_classes` transforms for the Norwegian JSON feed, reusing the existing `json` parser path; hr-ccaa added the `hr_ccaa_registration` / `hr_ccaa_owner_kind` / `hr_ccaa_build_certification` transforms, reusing the existing positioned-coordinate `pdf` parser path from AESA Spain).

## Author

**Ashley Childress**

[![dev.to](https://img.shields.io/badge/dev.to-0A0A0A?logo=devdotto&logoColor=fff&style=for-the-badge)](https://dev.to/anchildress1) [![LinkedIn](https://img.shields.io/badge/linkedin-%230077B5.svg?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/anchildress1/) [![X](https://img.shields.io/badge/X-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/anchildress1) [![BuyMeACoffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/anchildress1)

---

## License

[Polyform Shield 1.0.0 + Supplemental Terms](LICENSE)
