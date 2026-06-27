<div align="center">
<img src="https://repository-images.githubusercontent.com/1226992141/2accc14a-5128-4d70-87df-03b2a8692b62" alt="Social banner image" />

# metal-birds-feed

[![CI](https://github.com/anchildress1/metal-birds-feed/actions/workflows/ci.yml/badge.svg)](https://github.com/anchildress1/metal-birds-feed/actions/workflows/ci.yml) [![License: Polyform Shield + Supplemental Terms](https://img.shields.io/badge/license-Polyform%20Shield%20%2B%20Supplemental%20Terms-blue)](LICENSE) [![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=anchildress1_metal-birds-feed&metric=alert_status)](https://sonarcloud.io/project/overview?id=anchildress1_metal-birds-feed) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=anchildress1_metal-birds-feed&metric=coverage)](https://sonarcloud.io/project/overview?id=anchildress1_metal-birds-feed)

</div>

Translates national aviation registries into a normalized JSON schema in Cloudflare R2 for
O(1) tail-number and ICAO hex lookups. Inspired by
[metal-birds-watch](https://github.com/georgekobaidze/metal-birds-watch).

**Distribution model:** source-available code (Polyform Shield) + operator-private R2.
No hosted public read API. Forks self-host against their own R2 bucket and their own
per-source license assessment. See [PRD.md](PRD.md) §Cross-Cutting for the full model.

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
cp .env.example .env  # fill in MBF_R2_* values
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

| Path                            | Contents                                                                                                                                                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `aircraft/<source>.sqlite`      | Per-source SQLite DB. Table `aircraft`: one typed column per canonical field (`source_id` PK; `owner_*`/`operator_*`/`engine_*` flattened; `operational_classes` JSON). Indexed `icao_hex`, `registration`, `status`, `airframe_type`, `owner_country` |
| `aircraft/_state/<source>.json` | Last run/change state + `content_hash` for cadence gating and skip-if-unchanged                                                                                                                                                                        |

One queryable artifact per source — filter or point-lookup on any column (every canonical field is its own typed column). Rebuilt and re-uploaded whole only when the record set's content hash changes.

## Setup

```bash
# Install dependencies and hooks
make install
```

## Available Commands

| Command             | Description                                    |
| ------------------- | ---------------------------------------------- |
| `make install`      | Install dependencies and git hooks             |
| `make format`       | Format code with Prettier                      |
| `make format-check` | Check formatting (non-destructive, used in CI) |
| `make lint`         | Run ESLint                                     |
| `make typecheck`    | TypeScript type check                          |
| `make test`         | Run unit tests with coverage                   |
| `make build`        | Compile TypeScript to `dist/`                  |
| `make bootstrap`    | One-shot local initial load (reads `.env`)     |
| `make secret-scan`  | Scan for accidentally committed secrets        |
| `make clean`        | Remove build artifacts                         |

## Required Secrets (GitHub Actions)

| Secret                     | Purpose                     |
| -------------------------- | --------------------------- |
| `MBF_R2_ACCOUNT_ID`        | Cloudflare account ID       |
| `MBF_R2_ACCESS_KEY_ID`     | R2 S3-compatible access key |
| `MBF_R2_SECRET_ACCESS_KEY` | R2 S3-compatible secret key |
| `MBF_R2_BUCKET_NAME`       | Target R2 bucket name       |
| `SONAR_TOKEN`              | SonarCloud analysis token   |

## Sources

Live and license-cleared sources only, ordered alphabetically by country. Source IDs remain in backticks where a source has a checked-in or planned config. The full agency-correspondence tracker (every country contacted, sent/reply dates, status) lives in [DATA_LICENSES.md](DATA_LICENSES.md).

<!-- prettier-ignore-start -->
| Agency | Country | Email | Sent | Reply | Status |
| --- | --- | --- | --- | --- | --- |
| CASA — au-casa | Australia | none | n/a | open | live |
| ANAC Brasil — br-anac | Brazil | rab@anac.gov.br | 2026-05-05 | confirmed | live |
| Transport Canada — tc-ca | Canada | none | n/a | open | live |
| Transpordiamet — ee-ta (pending impl) | Estonia | info@transpordiamet.ee | n/a | open | cleared |
| CAD HK | Hong Kong | enquiry@cad.gov.hk | 2026-05-11 | open | cleared |
| CAA Latvia — lv-caa | Latvia | ivo.tukris@caa.gov.lv | n/a | open | live |
| CAA Lebanon | Lebanon | info@dgca.gov.lb | 2026-05-10 | open | live |
| CAA Maldives — mv-caa | Maldives | airworthiness@caa.gov.mv | 2026-05-05 | open | live |
| ILT — nl-ilt | Netherlands | none | n/a | open | live |
| CAA Oman — om-caa (pending impl) | Oman | customerservice@caa.gov.om | 2026-05-11 | open | cleared: no dataset |
| CAAS — sg-caas (pending impl) | Singapore | none | n/a | confirmed | cleared |
| FOCA / BAZL — ch-foca | Switzerland | aircraftregistry@bazl.admin.ch | 2026-05-05 | confirmed | live |
| CAA Taiwan — tw-caa | Taiwan | gencaa@mail.caa.gov.tw | 2026-05-05 | confirmed | live |
| Tajikistan CAA | Tajikistan | info@caa.tj | 2026-05-11 | open | live |
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
- Public-domain / CC0 sources: credited as courtesy in [DATA_LICENSES.md](DATA_LICENSES.md).

---

## Legal Notice

- **No liability transfer.** Using, forking, or deploying this repository does not transfer liability to the maintainer. Each operator is solely responsible for their own deployment and its consequences.
- **Per-country compliance is the operator's responsibility.** This project ingests data from civil aviation authorities in multiple jurisdictions. Each imposes its own data-use, redistribution, and privacy obligations. Operators must independently assess and satisfy those obligations.
- **Research is informational, not legal advice.** The license classifications and permissions in `DATA_LICENSES.md` reflect good-faith research at a point in time. They are not legal advice and carry no guarantee of completeness, accuracy, or continued validity.
- **Upstream terms change without notice.** Agencies amend terms, withdraw permissions, or restructure publication channels. Operators are responsible for monitoring those changes.
- **No warranty.** The data pipeline, its output, and the license research are provided as-is. See the `No Warranty` section of the [LICENSE](LICENSE).

---

## Adding a New Registry Source

[AGENTS.md](AGENTS.md) is authoritative for the rules below; this section is a friendlier overview and stays in sync with it.

1. Classify the license under PRD CC.1 (Open / Personal-use / Restrictive / Unknown). Restrictive sources are excluded.
2. For Personal-use or Unknown sources, send the agency permission email (template at [docs/agency-permission-request.md](docs/agency-permission-request.md)). The 30-day public-record fallback applies to Unknown only — Personal-use needs an affirmative reply (silence ≠ permission). Record outcome in `DATA_LICENSES.md`.
3. New source onboarding touches **all five surfaces** or the source is incomplete:
   - `sources/<source-id>.yaml` — mapping config; declare `format:` (`csv` | `ods` | `xlsx` | `xls`) and, if the upstream URL rolls per refresh, `download.discover_url:`.
   - `fixtures/<source-id>/` — CI ground-truth records covering positive / negative / edge cases.
   - `DATA_LICENSES.md` — classification, permitted uses, attribution wording, reply text (verbatim).
   - `README.md` sources table row — alphabetical by country (`scripts/check-sources-sorted.py` enforces).
   - `README.md` `## Attribution` block — the prominent display that satisfies the upstream license (courtesy credit for CC-0/public-domain sources).
4. New scalar or compound transforms require updates in **three places** simultaneously or the loader rejects the config: enum in `src/types/config.ts`, handler in `src/transforms.ts`, allowlist in `src/config/loader.ts`.

The translation engine itself is source-agnostic and stays unchanged for new registries. The downloader and parser dispatch only grow when a source introduces a new file format or download pattern (e.g., NL ILT added the `.ods`/`.xlsx` parser path and the `discover_url` filename-rolling pattern in v3; CAA Taiwan added the legacy `.xls` parser path; au-casa added the `casa_full_registration` / `date_dd_slash_or_null` / `casa_airframe` transforms; ch-foca added the `json` parser path with a `POST` download body for the FOCA search API, plus the `foca_*` owner/operator transforms; mv-caa added the positioned-coordinate `pdf` parser path for the rotated-grid Maldives register, the `date_dmmmyy_or_null` / `first_line_or_null` / `collapse_ws_or_null` / `mv_idera_party` transforms, and the `legal_owner` canonical field).

## License

[Polyform Shield 1.0.0 + Supplemental Terms](LICENSE)
