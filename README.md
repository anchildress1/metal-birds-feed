<div align="center">
<img src="https://repository-images.githubusercontent.com/1226992141/2accc14a-5128-4d70-87df-03b2a8692b62" alt="Social banner image" />

# metal-birds-feed

[![CI](https://github.com/anchildress1/metal-birds-feed/actions/workflows/ci.yml/badge.svg)](https://github.com/anchildress1/metal-birds-feed/actions/workflows/ci.yml) [![License: Polyform Shield + Supplemental Terms](https://img.shields.io/badge/license-Polyform%20Shield%20%2B%20Supplemental%20Terms-blue)](LICENSE) [![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=anchildress1_metal-birds-feed&metric=alert_status)](https://sonarcloud.io/project/overview?id=anchildress1_metal-birds-feed) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=anchildress1_metal-birds-feed&metric=coverage)](https://sonarcloud.io/project/overview?id=anchildress1_metal-birds-feed)

</div>

Translates national aviation registries (FAA, Transport Canada, NL ILT, CASA Australia,
and additional sources) into a single normalized JSON schema stored in Cloudflare R2 for
O(1) tail-number and ICAO hex lookups. Inspired by
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

| Source                                         | Country           | Status                                                                                                                                        | Bulk download                                                                                                                                                                                      | License (CC.1)                                                                                                                                                 |
| ---------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ANAC Argentina — `ar-anac` _(future)_          | Argentina         | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [geo.anac.gob.ar](https://geo.anac.gob.ar/afectacion)                                                                                                                                              | Unknown                                                                                                                                                        |
| CASA — `au-casa`                               | Australia         | ✅ Live                                                                                                                                       | [services.casa.gov.au/CSV/acrftreg.csv](https://services.casa.gov.au/CSV/acrftreg.csv)                                                                                                             | Open — CC BY 4.0 (both bulk + lookup, attribution req)                                                                                                         |
| Austro Control — `at-austrocontrol` _(future)_ | Austria           | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [austrocontrol.at](https://www.austrocontrol.at/en/aviation_agency/aircraft/aircraft_register/search_online)                                                                                       | Unknown                                                                                                                                                        |
| BCAA — `bs-bcaa` _(future)_                    | Bahamas           | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [caabahamas.com/registers](https://caabahamas.com/registers/)                                                                                                                                      | Unknown                                                                                                                                                        |
| BCAA / DGTA — `be-dgta` _(future)_             | Belgium           | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [es.mobilit.fgov.be](https://es.mobilit.fgov.be/aircraft-registry/main/search?lang=en)                                                                                                             | Unknown                                                                                                                                                        |
| BDCA — `bz-bdca` _(future)_                    | Belize            | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [civilaviation.gov.bz](https://www.civilaviation.gov.bz/index.php/bdca-civil-aircraft-register)                                                                                                    | Unknown                                                                                                                                                        |
| CAAB — `bw-caab` _(future)_                    | Botswana          | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [caab.co.bw](https://www.caab.co.bw/caab-content.php?cid=299)                                                                                                                                      | Unknown                                                                                                                                                        |
| ANAC Brasil — `br-anac` _(future)_             | Brazil            | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [sistemas.anac.gov.br](https://sistemas.anac.gov.br/aeronaves/cons_rab.asp)                                                                                                                        | Unknown                                                                                                                                                        |
| Transport Canada — `tc-ca`                     | Canada            | ✅ Live                                                                                                                                       | [wwwapps.tc.gc.ca/…/ccarcsdb.zip](https://wwwapps.tc.gc.ca/saf-sec-sur/2/ccarcs-riacc/download/ccarcsdb.zip)                                                                                       | Open (with conditions) — Government of Canada Open Data Licence Agreement for Unrestricted Use of Canada's Data (click-wrap; verbatim notices + indemnity req) |
| CAA Cayman Islands                             | Cayman Islands    | ❌ Excluded — commercial offshore registry                                                                                                    | [caacayman.com](https://www.caacayman.com)                                                                                                                                                         | Excluded — paid commercial offshore registry                                                                                                                   |
| CAAC                                           | China             | ❌ Excluded — IE-only register page + geopolitical exposure                                                                                   | [219.143.231.89](http://219.143.231.89/shs/ccarretrieval.do?flag=1)                                                                                                                                | Excluded — register page only works in deprecated Internet Explorer; license unverifiable                                                                      |
| DCA Cyprus — `cy-dca` _(future)_               | Cyprus            | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [mcw.gov.cy register](https://www.mcw.gov.cy/mcw/dca/dca.nsf/DMLregister_en/DMLregister_en?OpenDocument)                                                                                           | Unknown                                                                                                                                                        |
| Trafikstyrelsen — `dk-ts` _(future)_           | Denmark           | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [trafikstyrelsen.dk](https://selvbetjening.trafikstyrelsen.dk/civilluftfart/Dokumenter/Forms/AllItems.aspx)                                                                                        | Unknown                                                                                                                                                        |
| ECAA — `et-ecaa` _(future)_                    | Ethiopia          | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [ecaa.gov.et](https://www.ecaa.gov.et/home/aircraft-registered-by-the-authority-and-operational-today/)                                                                                            | Unknown                                                                                                                                                        |
| CAAF — `fj-caaf` _(future)_                    | Fiji              | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [caaf.org.fj](https://www.caaf.org.fj/aircraft-register-search/)                                                                                                                                   | Unknown                                                                                                                                                        |
| Traficom — `fi-traficom` _(future)_            | Finland           | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [trafi.fi](https://asiointi.trafi.fi/en/henkiloasiakkaat/ilmailu/tarkista-ilma-aluksen-tiedot)                                                                                                     | Unknown                                                                                                                                                        |
| DGAC France — `fr-dgac` _(future)_             | France            | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, **no fallback applies** — Personal-use, silence ≠ permission) | [export.csv (monthly)](https://immat.aviation-civile.gouv.fr/immat/servlet/static/upload/export.csv); [search interface](https://immat.aviation-civile.gouv.fr/immat/servlet/aeronef_liste.html) | Personal-use — register page explicitly says "for informational purposes only"; paid extract channel for official use; GDPR pre-strips PII at source           |
| GCAA — `ge-gcaa` _(future)_                    | Georgia           | Future (phase 4) — permission request sent 2026-05-05 in English (awaiting reply; follow-up 2026-06-04, fallback applies)                     | [gcaa.ge register](https://gcaa.ge/civil-aircraft-register/) (HTML table, ~63 aircraft)                                                                                                            | Unknown                                                                                                                                                        |
| LBA                                            | Germany           | ❌ Excluded — register statutorily non-public                                                                                                 | [lba.de aircraft registration](https://www.lba.de/EN/Airworthiness/AircraftRegistration/AircraftRegistration_node.html)                                                                            | Excluded — Luftfahrzeugrolle is non-public under German data protection law; data only released per-record on legal claim                                      |
| 2-REG                                          | Guernsey          | ❌ Excluded — commercial offshore registry                                                                                                    | [2-reg.com](https://www.2-reg.com/legislation/register)                                                                                                                                            | Excluded — paid commercial offshore registry                                                                                                                   |
| ICETRA — `is-icetra` _(future)_                | Iceland           | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [island.is](https://island.is/en/aircraft-registry)                                                                                                                                                | Unknown                                                                                                                                                        |
| DGCA — `in-dgca` _(future)_                    | India             | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [dgca.gov.in](https://www.dgca.gov.in/)                                                                                                                                                            | Unknown                                                                                                                                                        |
| DKPPU — `id-dkppu` _(future)_                  | Indonesia         | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [imsis-djpu.kemenhub.go.id](https://imsis-djpu.kemenhub.go.id/PortalDKPPU/)                                                                                                                        | Unknown                                                                                                                                                        |
| IAA — `ie-iaa` _(future)_                      | Ireland           | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies); reuses NL spreadsheet parser path       | [iaa.ie register page](https://www.iaa.ie/general-aviation/aircraft-registration-leasing/current-aircraft-register-and-monthly-changes/current-aircraft-register-and-monthly-changes-details-page) | Unknown                                                                                                                                                        |
| IOM Aircraft Registry                          | Isle of Man       | ❌ Excluded — commercial offshore registry                                                                                                    | [iomaircraftregistry.com](https://ardis.iomaircraftregistry.com/register/search)                                                                                                                   | Excluded — paid commercial offshore registry                                                                                                                   |
| CAAI                                           | Israel            | ❌ Excluded — fee-gated per-aircraft + FOI-only bulk path                                                                                     | [gov.il aircraft register](https://www.gov.il/en/service/browse-aircraft-register)                                                                                                                 | Excluded — per-aircraft fee + registrar consent; bulk requires Freedom of Information request (Law 5758-1998); no redistribution channel                       |
| ENAC — `it-enac` _(future)_                    | Italy             | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [enac.gov.it](https://www.enac.gov.it/sicurezza-aerea/aeronavigabilita-iniziale/registro-aeromobili/)                                                                                              | Unknown                                                                                                                                                        |
| JCAA — `jm-jcaa` _(future)_                    | Jamaica           | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [jcaa.gov.jm](https://www.jcaa.gov.jm/aircraft-registry-page/)                                                                                                                                     | Unknown                                                                                                                                                        |
| Jersey Aircraft Registry                       | Jersey            | ❌ Excluded — commercial offshore registry                                                                                                    | [gov.je](https://www.gov.je/travel/maritimeaviation/civilaviation/pages/jerseyaircraftregistry.aspx)                                                                                               | Excluded — paid commercial offshore registry                                                                                                                   |
| CARC — `jo-carc` _(future)_                    | Jordan            | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [carc.jo register](https://www.carc.jo/en/content/344-jordanian-registered-aircraft)                                                                                                               | Unknown                                                                                                                                                        |
| KOCA / MOLIT — `kr-koca` _(future)_            | Korea             | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [atis.koca.go.kr](https://atis.koca.go.kr/ATIS/aircraft/forwardPage.do)                                                                                                                            | Unknown                                                                                                                                                        |
| CAAM — `my-caam` _(future)_                    | Malaysia          | Future — permission request submitted via webform 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                         | [caam.gov.my](https://www.caam.gov.my/)                                                                                                                                                            | Unknown                                                                                                                                                        |
| CAA Maldives — `mv-caa` _(future)_             | Maldives          | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [caa.gov.mv](https://www.caa.gov.mv/operations/registration-of-aircraft-and-mortgages)                                                                                                             | Unknown                                                                                                                                                        |
| CAD Malta — `mt-cad` _(future)_                | Malta             | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [transport.gov.mt](https://www.transport.gov.mt/aviation/aircraft-flight-standards/registration-of-aircraft-2663)                                                                                  | Unknown                                                                                                                                                        |
| AFAC — `mx-afac` _(future)_                    | Mexico            | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [gob.mx/afac](https://www.gob.mx/afac)                                                                                                                                                             | Unknown                                                                                                                                                        |
| ILT — `nl-ilt`                                 | Netherlands       | ✅ Live (phase 3, NL track)                                                                                                                   | [ilent.nl register data files](https://www.ilent.nl/documenten/lijsten/luchtvaart/databestanden/luchtvaartregister-data) (.ods, date-stamped filename, resolved via `discover_url`)                | Open — CC-0 (public domain) per [data.overheid.nl](https://data.overheid.nl/dataset/luchtvaartuigregister)                                                     |
| CAA NZ — `nz-caa` _(planned)_                  | New Zealand       | Planned (phase 3) — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, no fallback applies)                            | [aviation.govt.nz/…/Aircraft-Register-for-website-.csv](https://www.aviation.govt.nz/assets/aircraft/aircraft-register/Aircraft-Register-for-website-.csv)                                         | Personal-use — all rights reserved + personal-use exception (attribution req)                                                                                  |
| Luftfartstilsynet — `no-caa` _(future)_        | Norway            | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [luftfartstilsynet.no](https://luftfartstilsynet.no/aktorer/norges-luftfartoyregister/registrerte-luftfartoy/)                                                                                     | Unknown                                                                                                                                                        |
| PCAA — `pk-pcaa` _(future)_                    | Pakistan          | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [apps.caapakistan.com.pk:412](https://apps.caapakistan.com.pk:412/Aircraft/rptArcftRegisterOut.aspx)                                                                                               | Unknown                                                                                                                                                        |
| CASA PNG — `pg-casa` _(future)_                | Papua New Guinea  | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [casapng.gov.pg register](https://casapng.gov.pg/safety-regulatory/airworthiness/Aircraft-Registers/)                                                                                              | Unknown                                                                                                                                                        |
| Rosaviatsia                                    | Russia            | ❌ Excluded — sanctions exposure                                                                                                              | [favt.gov.ru](https://favt.gov.ru/opendata/7714549744-gosreestrgvs/)                                                                                                                               | Excluded — US-person OFAC compliance risk; revisit if sanctions ease                                                                                           |
| SCAA — `sc-scaa` _(future)_                    | Seychelles        | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [scaa.sc](https://www.scaa.sc/index.php/regulatory/e-registers/aircraft-civil-register)                                                                                                            | Unknown                                                                                                                                                        |
| CAAS — `sg-caas` _(future)_                    | Singapore         | Future — permission request submitted via webform 2026-05-05 (3–15 business-day SLA; expected reply by 2026-05-26, no fallback applies)       | [caas.gov.sg register](https://www.caas.gov.sg/operations-safety/aircraft/certificate-of-registration)                                                                                             | Personal-use — verbatim CAAS Terms of Use restrict redistribution + automated access without written permission                                                |
| AESA — `es-aesa` _(future)_                    | Spain             | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [seguridadaerea.gob.es](https://www.seguridadaerea.gob.es/en/ambitos/aeronaves/registro-de-matriculas-de-aeronaves-civiles/registro-de-matriculas)                                                 | Unknown                                                                                                                                                        |
| CAASL — `lk-caasl` _(future)_                  | Sri Lanka         | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [caa.lk register](https://www.caa.lk/en/downloads/sl-aircraft-register)                                                                                                                            | Unknown                                                                                                                                                        |
| CASAS — `sr-casas` _(future)_                  | Suriname          | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [casas.sr](https://www.casas.sr/registry/)                                                                                                                                                         | Unknown                                                                                                                                                        |
| Transportstyrelsen — `se-ts` _(future)_        | Sweden            | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [transportstyrelsen.se](https://etjanster-luftfart.transportstyrelsen.se/en-gb/sokluftfartyg)                                                                                                      | Unknown                                                                                                                                                        |
| FOCA — `ch-foca` _(future)_                    | Switzerland       | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [bazl.admin.ch](https://app02.bazl.admin.ch/web/bazl/en/)                                                                                                                                          | Unknown                                                                                                                                                        |
| CAA Taiwan — `tw-caa` _(future)_               | Taiwan            | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [caa.gov.tw](https://www.caa.gov.tw/article.aspx?a=238&lang=1)                                                                                                                                     | Unknown                                                                                                                                                        |
| TCAA — `tz-tcaa` _(future)_                    | Tanzania          | Future — permission request sent 2026-05-05 (v2 to `tcaa@tcaa.go.tz` after v1 bounce; awaiting reply; follow-up 2026-06-04, fallback applies) | [tcaa.go.tz](https://www.tcaa.go.tz/page?p=Aircraft+Registration)                                                                                                                                  | Unknown                                                                                                                                                        |
| TTCAA — `tt-ttcaa` _(future)_                  | Trinidad & Tobago | Future — permission request sent 2026-05-05 (awaiting reply; follow-up 2026-06-04, fallback applies)                                          | [caa.gov.tt](https://caa.gov.tt/aircraft-on-ttcaa-register/)                                                                                                                                       | Unknown                                                                                                                                                        |
| TCI CAA                                        | Turks & Caicos    | ❌ Excluded — commercial offshore registry                                                                                                    | [tcicaa.tc](https://tcicaa.tc)                                                                                                                                                                     | Excluded — paid commercial offshore registry                                                                                                                   |
| UK CAA                                         | United Kingdom    | ❌ Excluded — Restrictive license                                                                                                             | [caa.co.uk/g-info](https://www.caa.co.uk/aircraft-register/g-info/)                                                                                                                                | Restrictive — paid + single-PC + no-redistribute                                                                                                               |
| FAA — `faa`                                    | United States     | ✅ Live                                                                                                                                       | [registry.faa.gov](https://registry.faa.gov/aircraftinquiry/Search/NNumberInquiry)                                                                                                                 | Open — US public domain (17 U.S.C. § 105)                                                                                                                      |

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

[AGENTS.md](AGENTS.md) is authoritative for the rules below; this section is a friendlier overview and stays in sync with it.

1. Classify the license under PRD CC.1 (Open / Personal-use / Restrictive / Unknown). Restrictive sources are excluded.
2. For Personal-use or Unknown sources, send the agency permission email (template at [docs/agency-permission-request.md](docs/agency-permission-request.md)). The 30-day public-record fallback applies to Unknown only — Personal-use needs an affirmative reply (silence ≠ permission). Record outcome in `DATA_LICENSES.md`.
3. New source onboarding touches **all five surfaces** or the source is incomplete:
   - `sources/<source-id>.yaml` — mapping config; declare `format:` (`csv` | `ods` | `xlsx`) and, if the upstream URL rolls per refresh, `download.discover_url:`.
   - `fixtures/<source-id>/` — CI ground-truth records covering positive / negative / edge cases.
   - `DATA_LICENSES.md` — classification, permitted uses, attribution wording, reply text (verbatim).
   - `README.md` sources table row — alphabetical by country (`scripts/check-sources-sorted.py` enforces).
   - `docs/license-matrix.md` summary row — same alphabetical order.
4. New scalar or compound transforms require updates in **three places** simultaneously or the loader rejects the config: enum in `src/types/config.ts`, handler in `src/transforms.ts`, allowlist in `src/config/loader.ts`.

The translation engine itself is source-agnostic and stays unchanged for new registries. The downloader and parser dispatch only grow when a source introduces a new file format or download pattern (e.g., NL ILT added the `.ods`/`.xlsx` parser path and the `discover_url` filename-rolling pattern in v3; au-casa added the `casa_full_registration` / `date_dd_slash_or_null` / `casa_airframe` transforms).

## License

[Polyform Shield 1.0.0 + Supplemental Terms](LICENSE)
