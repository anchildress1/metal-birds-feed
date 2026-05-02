# metal-birds-feed

<!-- Banner image: add one at docs/banner.png and uncomment below -->
<!-- ![Banner](./docs/banner.png) -->

[![CI](https://github.com/anchildress1/metal-birds-feed/actions/workflows/ci.yml/badge.svg)](https://github.com/anchildress1/metal-birds-feed/actions/workflows/ci.yml)
[![License: Polyform Shield](https://img.shields.io/badge/license-Polyform%20Shield-blue)](LICENSE)
[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=anchildress1_metal-birds-feed&metric=alert_status)](https://sonarcloud.io/project/overview?id=anchildress1_metal-birds-feed)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=anchildress1_metal-birds-feed&metric=coverage)](https://sonarcloud.io/project/overview?id=anchildress1_metal-birds-feed)

Translates national aviation registries (FAA, Transport Canada, UK CAA, GCAA) into a
single normalized JSON schema stored in Cloudflare R2 for O(1) tail-number and ICAO hex
lookups. Consumed by [metalbirdswatch.pilotronica.com](https://metalbirdswatch.pilotronica.com).

## How It Works

1. A GitHub Actions scheduled workflow runs on the 1st of every month.
2. It downloads the latest bulk registry export from each configured source.
3. The translation engine reads a YAML source config and normalizes raw rows into the
   canonical `Aircraft` schema.
4. A diff-write strategy compares the new batch against a per-source manifest in R2.
   Only changed or new objects are PUT; stale records are DELETE'd.
5. Lookups are keyed as static JSON objects — no query layer, no API, just R2.

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

## Adding a New Registry Source

1. Create `sources/<source-id>.yaml` following the mapping-config schema.
2. Add acceptance fixtures in `fixtures/<source-id>/`.
3. Update `DATA_LICENSES.md` with the new source's data license.

The translation engine and downloader require no changes.

## License

[Polyform Shield 1.0.0](LICENSE)
