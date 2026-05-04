<div align="center">
<img src="https://repository-images.githubusercontent.com/1226992141/2accc14a-5128-4d70-87df-03b2a8692b62" alt="Social banner image" />

# metal-birds-feed

[![CI](https://github.com/anchildress1/metal-birds-feed/actions/workflows/ci.yml/badge.svg)](https://github.com/anchildress1/metal-birds-feed/actions/workflows/ci.yml) [![License: Polyform Shield](https://img.shields.io/badge/license-Polyform%20Shield-blue)](LICENSE) [![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=anchildress1_metal-birds-feed&metric=alert_status)](https://sonarcloud.io/project/overview?id=anchildress1_metal-birds-feed) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=anchildress1_metal-birds-feed&metric=coverage)](https://sonarcloud.io/project/overview?id=anchildress1_metal-birds-feed)

</div>

Translates national aviation registries (FAA, Transport Canada, UK CAA, GCAA) into a
single normalized JSON schema stored in Cloudflare R2 for O(1) tail-number and ICAO hex
lookups. Inspired by [metal-birds-watch](https://github.com/georgekobaidze/metal-birds-watch).

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
| Download    | Full      | FAA / TC / CAA / GCAA all ship full snapshots. No `If-Modified-Since`        |
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

Bootstrap doesn't fit GHA's 30-minute job cap, so it's run once locally — see below.

## Initial Load (Bootstrap)

The first load against an empty R2 bucket writes every record + every index, which exceeds
GHA's per-job timeout. Run it once locally; the monthly cron handles diffs forever after.

```bash
cp .env.example .env  # fill in MBF_R2_* values
make bootstrap        # auto-loads .env, runs the full pipeline with no time cap
```

Tail `logs/pipeline.log` for `event=write_progress` ticks (every 5s during writes).
Override the source via `.env`'s `REFRESH_SOURCE` value.

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

| Source           | Country        | Status                    | Bulk download                                                                                                | License                                                                                  |
| ---------------- | -------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| FAA              | United States  | ✅ Live                   | [registry.faa.gov](https://registry.faa.gov/aircraftinquiry/Search/NNumberInquiry)                           | US public domain (17 U.S.C. § 105)                                                       |
| Transport Canada | Canada         | ✅ Live                   | [wwwapps.tc.gc.ca/…/ccarcsdb.zip](https://wwwapps.tc.gc.ca/saf-sec-sur/2/ccarcs-riacc/download/ccarcsdb.zip) | [OGL-Canada](https://open.canada.ca/en/open-government-licence-canada) (attribution req) |
| UK CAA           | United Kingdom | Planned                   | [caa.co.uk/g-info](https://www.caa.co.uk/data-and-research/aircraft/g-info/)                                 | OGL-UK v3.0 (attribution req)                                                            |
| GCAA             | Georgia        | Planned (data access TBD) | [gcaa.ge](https://www.gcaa.ge)                                                                               | TBD                                                                                      |

Full attribution requirements and PII drop rules: [DATA_LICENSES.md](DATA_LICENSES.md).

---

## Adding a New Registry Source

1. Create `sources/<source-id>.yaml` following the mapping-config schema.
2. Add acceptance fixtures in `fixtures/<source-id>/`.
3. Update `DATA_LICENSES.md` with the new source's data license.

The translation engine and downloader require no changes.

## License

[Polyform Shield 1.0.0 + Supplemental Terms](LICENSE)
