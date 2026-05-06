<div align="center">
<img src="https://repository-images.githubusercontent.com/1226992141/2accc14a-5128-4d70-87df-03b2a8692b62" alt="Social banner image" />

# metal-birds-feed

[![CI](https://github.com/anchildress1/metal-birds-feed/actions/workflows/ci.yml/badge.svg)](https://github.com/anchildress1/metal-birds-feed/actions/workflows/ci.yml) [![License: Polyform Shield + Supplemental Terms](https://img.shields.io/badge/license-Polyform%20Shield%20%2B%20Supplemental%20Terms-blue)](LICENSE) [![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=anchildress1_metal-birds-feed&metric=alert_status)](https://sonarcloud.io/project/overview?id=anchildress1_metal-birds-feed) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=anchildress1_metal-birds-feed&metric=coverage)](https://sonarcloud.io/project/overview?id=anchildress1_metal-birds-feed)

</div>

Translates national aviation registries (FAA, Transport Canada, NL ILT, and additional
sources) into a single normalized JSON schema stored in Cloudflare R2 for O(1)
tail-number and ICAO hex lookups. Inspired by
[metal-birds-watch](https://github.com/georgekobaidze/metal-birds-watch).

**Distribution model:** source-available code (Polyform Shield) + operator-private R2.
No hosted public read API. Forks self-host against their own R2 bucket and their own
per-source license assessment. See [PRD.md](PRD.md) §Cross-Cutting for the full model.

## How It Works

A GitHub Actions matrix runs on the 1st of every month — one runner per source under
`sources/*.yaml`. Each runner:

1. Downloads the source's full bulk export (registries don't publish deltas)
2. Translates every row into the canonical `Aircraft` schema via the source's YAML mapping
3. Computes a content-hash diff against the per-source manifest in R2
4. Writes only what actually changed; lookups stay as static JSON objects in R2

### What's full vs delta

| Step        | Pass type | Notes                                                                        |
| ----------- | --------- | ---------------------------------------------------------------------------- |
| Download    | Full      | All sources ship full snapshots; no `If-Modified-Since` semantics            |
| Translate   | Full      | All rows re-parsed and transformed every run (~10s for FAA's 312k records)   |
| Hash + diff | Full O(n) | Every record's `sha256` content hash is compared against the stored manifest |
| R2 writes   | **Delta** | Only changed records get PUT; removed records get DELETE; unchanged skipped  |

The delta lives entirely in the write step. This is by design: registries don't expose
incremental APIs, but R2 ops are the expensive part — so we pay for the cheap full-passes
to avoid paying for the expensive redundant writes.

### What a typical monthly run looks like

| Phase     | Bootstrap (first run) | Steady state (monthly cron) |
| --------- | --------------------- | --------------------------- |
| Records   | ~312k all new         | ~3–6k changed (~1–2%)       |
| R2 ops    | ~600k+                | ~10k                        |
| Wall time | ~99 min               | ~2 min                      |

FAA's first load doesn't fit GHA's 30-minute job cap, so it's run once locally — see
below. Smaller sources (TC ~37k, NL ILT ~3k) populate cleanly inside the cap and don't
need a local bootstrap.

## Initial Load (Bootstrap)

The first FAA load against an empty R2 bucket writes ~312k records × 3 index paths,
which exceeds GHA's per-job timeout. Run it once locally; the monthly cron handles
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
gh workflow run refresh.yml                    # all sources (next monthly cron equivalent)
```

## R2 Key Structure

| Path                                  | Contents                             |
| ------------------------------------- | ------------------------------------ |
| `aircraft/by-id/<source>/<id>.json`   | Canonical aircraft record            |
| `aircraft/by-icao-hex/<hex>.json`     | `{"refs": ["source:id", ...]}`       |
| `aircraft/by-registration/<reg>.json` | `{"refs": ["source:id", ...]}`       |
| `aircraft/_manifest/<source>.json`    | Content-hash manifest for diff-write |

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

The "Source" column lists the display name and, in backticks, the source ID — that
ID is the `sources/<id>.yaml` filename and the value to set in `.env`'s `REFRESH_SOURCE`
to populate that source alone. Rows are ordered alphabetically by country.

| Source                                  | Country        | Status                                                                                                                                  | Bulk download                                                                                                                                                                                      | License (CC.1)                                                                                                                                                 |
| --------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ANAC Argentina — `ar-anac` _(future)_   | Argentina      | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                    | [geo.anac.gob.ar](https://geo.anac.gob.ar/afectacion)                                                                                                                                              | Unknown                                                                                                                                                        |
| CASA — `au-casa` _(future)_             | Australia      | Future — no email needed (Open)                                                                                                         | [services.casa.gov.au/CSV/acrftreg.csv](https://services.casa.gov.au/CSV/acrftreg.csv)                                                                                                             | Open — CC BY 4.0 (both bulk + lookup, attribution req)                                                                                                         |
| ANAC Brasil — `br-anac` _(future)_      | Brazil         | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                    | [sistemas.anac.gov.br](https://sistemas.anac.gov.br/aeronaves/cons_rab.asp)                                                                                                                        | Unknown                                                                                                                                                        |
| Transport Canada — `tc-ca`              | Canada         | ✅ Live                                                                                                                                 | [wwwapps.tc.gc.ca/…/ccarcsdb.zip](https://wwwapps.tc.gc.ca/saf-sec-sur/2/ccarcs-riacc/download/ccarcsdb.zip)                                                                                       | Open (with conditions) — Government of Canada Open Data Licence Agreement for Unrestricted Use of Canada's Data (click-wrap; verbatim notices + indemnity req) |
| DGAC France — `fr-dgac` _(future)_      | France         | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                    | [immat.aviation-civile.gouv.fr](https://immat.aviation-civile.gouv.fr/immat/servlet/aeronef_liste.html)                                                                                            | Unknown                                                                                                                                                        |
| GCAA — `ge-gcaa` _(planned)_            | Georgia        | Planned (phase 4) — data access TBD                                                                                                     | [gcaa.ge](https://www.gcaa.ge)                                                                                                                                                                     | Unknown — pending R3.1 research                                                                                                                                |
| IAA — `ie-iaa` _(future)_               | Ireland        | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies); reuses NL spreadsheet parser path | [iaa.ie register page](https://www.iaa.ie/general-aviation/aircraft-registration-leasing/current-aircraft-register-and-monthly-changes/current-aircraft-register-and-monthly-changes-details-page) | Unknown                                                                                                                                                        |
| ENAC — `it-enac` _(future)_             | Italy          | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                    | [enac.gov.it](https://www.enac.gov.it/sicurezza-aerea/aeronavigabilita-iniziale/registro-aeromobili/)                                                                                              | Unknown                                                                                                                                                        |
| ILT — `nl-ilt`                          | Netherlands    | ✅ Live (phase 3, NL track)                                                                                                             | [ilent.nl register data files](https://www.ilent.nl/documenten/lijsten/luchtvaart/databestanden/luchtvaartregister-data) (.ods, date-stamped filename, resolved via `discover_url`)                | Open — CC-0 (public domain) per [data.overheid.nl](https://data.overheid.nl/dataset/luchtvaartuigregister)                                                     |
| CAA NZ — `nz-caa` _(planned)_           | New Zealand    | Planned (phase 3) — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, no fallback applies)                      | [aviation.govt.nz/…/Aircraft-Register-for-website-.csv](https://www.aviation.govt.nz/assets/aircraft/aircraft-register/Aircraft-Register-for-website-.csv)                                         | Personal-use — all rights reserved + personal-use exception (attribution req)                                                                                  |
| Luftfartstilsynet — `no-caa` _(future)_ | Norway         | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                    | [luftfartstilsynet.no](https://luftfartstilsynet.no/aktorer/norges-luftfartoyregister/registrerte-luftfartoy/)                                                                                     | Unknown                                                                                                                                                        |
| AESA — `es-aesa` _(future)_             | Spain          | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                    | [seguridadaerea.gob.es](https://www.seguridadaerea.gob.es/en/ambitos/aeronaves/registro-de-matriculas-de-aeronaves-civiles/registro-de-matriculas)                                                 | Unknown                                                                                                                                                        |
| Transportstyrelsen — `se-ts` _(future)_ | Sweden         | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                    | [transportstyrelsen.se](https://etjanster-luftfart.transportstyrelsen.se/en-gb/sokluftfartyg)                                                                                                      | Unknown                                                                                                                                                        |
| FOCA — `ch-foca` _(future)_             | Switzerland    | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                    | [bazl.admin.ch](https://app02.bazl.admin.ch/web/bazl/en/)                                                                                                                                          | Unknown                                                                                                                                                        |
| UK CAA                                  | United Kingdom | ❌ Excluded — Restrictive license                                                                                                       | [caa.co.uk/g-info](https://www.caa.co.uk/aircraft-register/g-info/)                                                                                                                                | Restrictive — paid + single-PC + no-redistribute                                                                                                               |
| FAA — `faa`                             | United States  | ✅ Live                                                                                                                                 | [registry.faa.gov](https://registry.faa.gov/aircraftinquiry/Search/NNumberInquiry)                                                                                                                 | Open — US public domain (17 U.S.C. § 105)                                                                                                                      |

Full attribution requirements, permission-email status, and PII drop rules: [DATA_LICENSES.md](DATA_LICENSES.md).

---

## Attribution

metal-birds-feed normalizes data published by national civil aviation authorities. The notices below are the verbatim attributions required by each upstream license and constitute the project's compliance with those requirements. This README is the prominent location at which the project displays them.

### Transport Canada

> Reproduced and distributed with the permission of the Government of Canada.

> This product has been produced by or for Ashley Childress and includes data provided by the Government of Canada. The incorporation of data sourced from the Government of Canada within this product shall not be construed as constituting an endorsement by the Government of Canada of our product.

(Required by sections §4.1 and §4.2 of the [Government of Canada Open Data Licence Agreement for Unrestricted Use of Canada's Data](https://wwwapps.tc.gc.ca/Saf-Sec-Sur/2/CCARCS-RIACC/DDZip.aspx).)

### Civil Aviation Safety Authority (CASA, Australia)

Source: Civil Aviation Safety Authority — https://www.casa.gov.au/aircraft/aircraft-registration/data-files-registered-aircraft

Licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). The material has been changed: CASA aircraft records are normalized into metal-birds-feed's canonical schema. This attribution does not imply endorsement by CASA.

### Inspectie Leefomgeving en Transport (ILT, Netherlands)

Aircraft register data published by ILT under [CC-0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) per [data.overheid.nl](https://data.overheid.nl/dataset/luchtvaartuigregister). Acknowledgment provided as a courtesy; not legally required under CC-0.

### Federal Aviation Administration (FAA, United States)

Aircraft Registry data published by the FAA at [registry.faa.gov](https://registry.faa.gov/aircraftinquiry/). US Government work in the public domain (17 U.S.C. § 105). Acknowledgment provided as a courtesy; not legally required.

---

## Adding a New Registry Source

1. Classify the license under PRD CC.1 (Open / Personal-use / Restrictive / Unknown). Restrictive sources are excluded.
2. For Personal-use or Unknown sources, send the agency permission email (template at [docs/agency-permission-request.md](docs/agency-permission-request.md)). Wait for reply or 30-day timeout. Record outcome in `DATA_LICENSES.md`.
3. Create `sources/<source-id>.yaml` following the mapping-config schema. Declare `format:` (`csv` | `ods` | `xlsx`) and, if the upstream URL changes per refresh, `download.discover_url:`.
4. Add acceptance fixtures in `fixtures/<source-id>/`.
5. Update `DATA_LICENSES.md` with classification, permitted uses, and reply (verbatim if any).

The translation engine requires no changes. The downloader and parser dispatch are extended only when a source introduces a new file format or download pattern (e.g., NL ILT added the `.ods`/`.xlsx` parser path and the `discover_url` filename-rolling pattern in v3).

## License

[Polyform Shield 1.0.0 + Supplemental Terms](LICENSE)
