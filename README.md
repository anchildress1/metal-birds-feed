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

### What a typical cadence run looks like

| Phase     | Bootstrap (first run) | Steady state (cadence run) |
| --------- | --------------------- | -------------------------- |
| Records   | ~312k all new         | ~3–6k changed (~1–2%)      |
| R2 ops    | ~600k+                | ~10k                       |
| Wall time | ~99 min               | ~2 min                     |

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

| Path                            | Contents                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `aircraft/<source>.sqlite`      | Per-source SQLite DB. Table `aircraft`: `source_id` PK, indexed `icao_hex`/`registration`, record JSON |
| `aircraft/_state/<source>.json` | Last run/change state + `content_hash` for cadence gating and skip-if-unchanged                        |

One queryable artifact per source — point lookup by `icao_hex` or `registration`, full canonical record in the `record` column. Rebuilt and re-uploaded only when the record set's content hash changes.

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

Rows are ordered alphabetically by country. Source IDs remain in backticks where a source has a checked-in or planned config.

<!-- prettier-ignore-start -->
| Agency | Country | Email | Sent | Reply | Status |
| --- | --- | --- | --- | --- | --- |
| ACAA | Afghanistan | none | n/a | none | excluded: sanctions |
| AAC Albania | Albania | info@aac.gov.al | 2026-05-10 | pending | sent |
| ANAC Algeria | Algeria | contact@anac.dz | 2026-05-11 | pending | sent |
| n/a | Andorra | none | n/a | none | excluded: no register |
| ANAC Angola | Angola | sec.anac.ao@gmail.com | 2026-05-11 | pending | sent |
| ANAC Argentina | Argentina | registro@anac.gob.ar | 2026-05-05 | pending | sent |
| CAC Armenia | Armenia | info@aviation.am | 2026-05-10 | pending | sent |
| DCA Aruba | Aruba | none | n/a | none | excluded: commercial |
| CASA — au-casa | Australia | none | n/a | open | live |
| Austro Control | Austria | register@austrocontrol.at | 2026-05-05 | denied | excluded: denied |
| BCAA | Bahamas | atl@caabahamas.com | 2026-05-05 | pending | sent |
| CAA Bahrain | Bahrain | aerolicensing@mtt.gov.bh | 2026-05-11 | pending | sent: leans excluded |
| CAAB Bangladesh | Bangladesh | mahmud.pr@caab.gov.bd | 2026-05-11 | pending | sent |
| Aviation Dept of Min. Transport | Belarus | none | n/a | none | excluded: sanctions |
| BCAA / DGTA | Belgium | bcaa.registration@mobilit.fgov.be | 2026-05-05 | pending | sent |
| BDCA | Belize | director@civilaviation.gov.bz | 2026-05-05 | pending | sent |
| ANAC Bénin | Benin | secretariatanacbenin@gmail.com | 2026-05-11 | pending | sent |
| BCAA Bhutan | Bhutan | airworthiness@bcaa.gov.bt | 2026-05-11 | pending | sent |
| DGAC Bolivia | Bolivia | dgacbol@dgac.gob.bo | 2026-05-10 | pending | sent |
| BHDCA | Bosnia & Herzegovina | bhdca@bhdca.gov.ba | 2026-05-10 | pending | sent |
| CAAB | Botswana | caab@caab.co.bw | 2026-05-05 | pending | sent |
| ANAC Brasil — br-anac | Brazil | rab@anac.gov.br | 2026-05-05 | confirmed | live |
| CAA Bulgaria | Bulgaria | AIRWORTHINESS@caa.bg | 2026-05-10 | pending | sent |
| ANAC Burkina | Burkina Faso | info@anacburkina.org | 2026-05-11 | pending | sent |
| AAC Cabo Verde | Cabo Verde | info@aac.cv | 2026-05-10 | pending | sent: no bulk |
| SSCA Cambodia | Cambodia | admin-info@ssca.gov.kh | 2026-05-11 | pending | sent: leans excluded |
| CCAA Cameroon | Cameroon | contact@ccaa.aero | 2026-05-11 | pending | sent |
| Transport Canada — tc-ca | Canada | none | n/a | open | live |
| CAA Cayman Islands | Cayman Islands | none | n/a | none | excluded: commercial |
| DGAC Chile | Chile | registro.aeronaves@dgac.gob.cl | 2026-05-10 | pending | sent: no bulk |
| CAAC | China | none | n/a | none | excluded |
| UAEAC Colombia | Colombia | atencionalciudadano@aerocivil.gov.co | 2026-05-10 | denied | excluded: denied |
| Ministry of Transport | Cook Islands | mot.information@cookislands.gov.ck | 2026-05-11 | pending | sent |
| DGAC Costa Rica | Costa Rica | ventanillaunica@dgac.go.cr | 2026-05-10 | pending | sent |
| ANAC CI Côte d'Ivoire | Côte d'Ivoire | info@anac.ci | 2026-05-11 | pending | sent |
| CCAA | Croatia | registar@ccaa.hr | 2026-05-10 | pending | sent |
| IACC | Cuba | none | n/a | none | excluded: sanctions |
| DCA Cyprus | Cyprus | director@dca.mcw.gov.cy | 2026-05-05 | pending | sent |
| CAA CR | Czech Republic | dousova@caa.cz | 2026-05-10 | pending | sent |
| AAC RDC | Democratic Republic of the Congo | info@aacrdc.org | 2026-05-11 | pending | sent |
| Trafikstyrelsen | Denmark | info@trafikstyrelsen.dk | 2026-05-05 | pending | sent: no bulk |
| IDAC Dominican Republic | Dominican Republic | info@idac.gob.do | 2026-05-10 | open | sent: no bulk |
| ECCAA (regional) | Eastern Caribbean (OECS) | contact@eccaa.aero | 2026-05-11 | pending | sent |
| DGAC Ecuador | Ecuador | oswaldo.veloz@aviacioncivil.gob.ec | 2026-05-10 | pending | sent |
| ECAA | Egypt | none | n/a | none | excluded |
| AAC El Salvador | El Salvador | jsalguero@aac.gob.sv | 2026-05-11 | pending | sent |
| n/a | Eritrea | none | n/a | none | excluded |
| Transpordiamet — ee-ta (pending impl) | Estonia | info@transpordiamet.ee | n/a | open | cleared |
| ESWACAA | Eswatini | info@eswacaa.co.sz | 2026-05-11 | pending | sent |
| ECAA | Ethiopia | caa.airnav@ethionet.et | 2026-05-05 | pending | sent |
| CAAF | Fiji | info@caaf.org.fj | 2026-05-05 | pending | sent |
| Traficom — fi-traficom (blocked: identifier-stripped bulk) | Finland | kirjaamo@traficom.fi | n/a | confirmed | blocked: ids |
| DGAC France | France | immat@aviation-civile.gouv.fr | 2026-05-05 | pending | sent |
| GCAA | Georgia | office@gcaa.ge | 2026-05-05 | pending | sent |
| LBA | Germany | none | n/a | none | excluded |
| GCAA Ghana | Ghana | none | n/a | none | excluded |
| HCAA Greece | Greece | info@hcaa.gov.gr | 2026-05-10 | pending | sent |
| DGAC Guatemala | Guatemala | registro.aeronautico@dgac.gob.gt | 2026-05-10 | pending | sent: no bulk |
| 2-REG | Guernsey | none | n/a | none | excluded: commercial |
| GCAA Guyana | Guyana | aisguyana@gcaa-gy.org | 2026-05-11 | pending | sent |
| OFNAC Haiti | Haiti | division.ais@ofnac.gouv.ht | 2026-05-10 | pending | sent: no bulk |
| AHAC Honduras | Honduras | secretariaadministrativa@ahac.gob.hn | 2026-05-10 | pending | sent |
| CAD HK | Hong Kong | enquiry@cad.gov.hk | 2026-05-11 | open | cleared |
| Közlekedési Hatóság | Hungary | lfhf@ekm.gov.hu | 2026-05-10 | pending | sent |
| ICETRA | Iceland | samgongustofa@samgongustofa.is | 2026-05-05 | pending | sent: no bulk |
| DGCA | India | rkanand.dgca@nic.in | 2026-05-05 | pending | sent |
| DKPPU | Indonesia | produkaeronautika_dkuppu@dephub.go.id | 2026-05-05 | pending | sent |
| CAO.IR | Iran | none | n/a | none | excluded: sanctions |
| ICAA | Iraq | none | n/a | none | excluded: conflict |
| IAA | Ireland | registration@iaa.ie | 2026-05-05 | pending | sent |
| IOM Aircraft Registry | Isle of Man | none | n/a | none | excluded: commercial |
| CAAI | Israel | none | n/a | none | excluded |
| ENAC | Italy | registro.aeromobili@enac.gov.it | 2026-05-05 | pending | sent: no bulk |
| JCAA | Jamaica | info@jcaa.gov.jm | 2026-05-05 | pending | sent |
| JCAB | Japan | none | n/a | none | excluded |
| Jersey Aircraft Registry | Jersey | none | n/a | none | excluded: commercial |
| CARC | Jordan | info@carc.gov.jo | 2026-05-05 | pending | sent |
| Aviation Administration of Kazakhstan | Kazakhstan | frontoffice@caa.gov.kz | 2026-05-11 | pending | sent |
| KCAA | Kenya | none | n/a | none | no bulk |
| KOCA / MOLIT | Korea | lia0404@korea.kr | 2026-05-05 | pending | sent |
| CAA Kosovo (AAC) | Kosovo | infocaa@caa-ks.org | 2026-05-11 | pending | sent |
| DGCA Kuwait | Kuwait | president@dgca.gov.kw | 2026-05-11 | pending | sent |
| CAA Kyrgyzstan | Kyrgyzstan | mail@caa.kg | 2026-05-10 | pending | sent |
| DCAL Laos | Laos | info@dcal.gov.la | 2026-05-11 | pending | sent |
| CAA Latvia — lv-caa | Latvia | ivo.tukris@caa.gov.lv | n/a | open | live |
| CAA Lebanon | Lebanon | info@dgca.gov.lb | 2026-05-10 | open | live |
| LCAA | Liberia | liberiacaa@lcaa.gov.lr | 2026-05-11 | pending | sent |
| LCAA | Libya | none | n/a | none | excluded: sanctions |
| n/a | Liechtenstein | none | n/a | confirmed | excluded |
| TKA | Lithuania | joris.dumcius@tka.lt | 2026-05-10 | pending | sent |
| DAC | Luxembourg | nav@av.etat.lu | 2026-05-10 | pending | sent |
| AACM Macao | Macao (SAR) | aacm@aacm.gov.mo | 2026-05-10 | pending | sent |
| CAA Macedonia | Macedonia (North) | caa@gov.mk | 2026-05-10 | pending | sent |
| ACM Madagascar | Madagascar | acm@acm.mg | 2026-05-11 | pending | sent |
| CAAM | Malaysia | none | n/a | none | not contacted |
| CAA Maldives — mv-caa (pending impl) | Maldives | airworthiness@caa.gov.mv | 2026-05-05 | open | cleared: parser |
| CAD Malta | Malta | civil.aviation@transport.gov.mt | 2026-05-05 | pending | sent |
| ANAC Mauritanie | Mauritania | anac@anac.mr | 2026-05-11 | pending | sent |
| DCA Mauritius | Mauritius | civil-aviation@govmu.org | 2026-05-11 | denied | excluded: denied |
| AFAC | Mexico | tramites@afac.gob.mx | 2026-05-05 | pending | excluded |
| n/a | Micronesia (FSM) | none | n/a | none | excluded: no register |
| CAA Moldova | Moldova | info@caa.gov.md | 2026-05-10 | pending | sent |
| n/a | Monaco | none | n/a | none | excluded |
| MCAA Mongolia | Mongolia | info@mcaa.gov.mn | 2026-05-10 | pending | sent |
| ACG Montenegro | Montenegro | acv@caa.me | 2026-05-10 | pending | sent |
| DGAC Morocco | Morocco | DCCsiteweb@transport.gov.ma | 2026-05-11 | pending | sent |
| IACM Mozambique | Mozambique | info@iacm.gov.mz | 2026-05-10 | pending | sent: no bulk |
| DCA Myanmar | Myanmar | none | n/a | none | excluded: sanctions |
| n/a | Nauru | none | n/a | none | excluded: no register |
| CAAN Nepal | Nepal | dgca@caanepal.gov.np | 2026-05-11 | pending | sent |
| ILT — nl-ilt | Netherlands | none | n/a | open | live |
| CAA NZ — nz-caa (planned) | New Zealand | info@caa.govt.nz | 2026-05-05 | pending | sent |
| INAC Nicaragua | Nicaragua | info@inac.gob.ni | 2026-05-10 | pending | sent |
| ANAC Niger | Niger | none | n/a | none | excluded: sanctions |
| NCAA Nigeria | Nigeria | info@ncaa.gov.ng | 2026-05-11 | pending | sent |
| n/a | Niue | none | n/a | none | excluded |
| GACA DPRK | North Korea | none | n/a | none | excluded: sanctions |
| Luftfartstilsynet | Norway | postmottak@caa.no | 2026-05-05 | pending | sent |
| CAA Oman — om-caa (pending impl) | Oman | customerservice@caa.gov.om | 2026-05-11 | open | cleared: no dataset |
| PASO (regional) | Pacific Island states (PASO) | info@paso.aero | 2026-05-11 | pending | sent |
| PCAA | Pakistan | umair.sufyan@caapakistan.com.pk | 2026-05-05 | pending | sent |
| Bureau of Aviation Palau | Palau | none | n/a | none | excluded: no register |
| AAC Panama | Panama | Rafael.barcenas@aeronautica.gob.pa | 2026-05-10 | pending | sent |
| CASA PNG | Papua New Guinea | info@casapng.gov.pg | 2026-05-05 | pending | sent |
| DINAC Paraguay | Paraguay | sec_gral@dinac.gov.py | 2026-05-10 | pending | sent |
| DGAC Peru | Peru | pmarin@mtc.gob.pe | 2026-05-10 | pending | sent |
| CAAP Philippines | Philippines | awociddiv@caap.gov.ph | 2026-05-11 | pending | sent |
| ULC Poland | Poland | kancelaria@ulc.gov.pl | 2026-05-10 | pending | sent |
| ANAC Portugal | Portugal | none | n/a | none | not contacted |
| QCAA Qatar | Qatar | pr@caa.gov.qa | 2026-05-11 | pending | sent |
| AACR | Romania | none | n/a | none | no bulk |
| Rosaviatsia | Russia | none | n/a | none | excluded: sanctions |
| RCAA | Rwanda | none | n/a | none | excluded |
| n/a (Ministry of Works, Transport and Infrastructure) | Samoa | none | n/a | none | excluded: no register |
| INAC | São Tomé and Príncipe | inac@cstome.net | 2026-05-11 | pending | sent |
| GACA Saudi Arabia | Saudi Arabia | 1929@gaca.gov.sa | 2026-05-11 | pending | sent |
| ANACIM Senegal | Senegal | anacim@anacim.sn | 2026-05-11 | pending | sent |
| CAD Serbia | Serbia | dgca@cad.gov.rs | 2026-05-10 | pending | sent |
| SCAA | Seychelles | secretariat@scaa.sc | 2026-05-05 | pending | sent |
| SLCAA | Sierra Leone | info@slcaa.gov.sl | 2026-05-11 | pending | sent |
| CAAS — sg-caas (pending impl) | Singapore | none | n/a | confirmed | cleared |
| Dopravný úrad | Slovakia | register.lietadiel@nsat.sk | 2026-05-10 | pending | sent |
| CAA Slovenia | Slovenia | info@caa.si | 2026-05-10 | pending | sent |
| SACAA South Africa | South Africa | clientcare@caa.co.za | 2026-05-11 | pending | sent: leans excluded |
| SSCAA | South Sudan | support@sscaa.gov.ss | 2026-05-11 | pending | sent |
| AESA — es-aesa (pending impl) | Spain | rmac.aesa@seguridadaerea.es | 2026-05-05 | open | cleared |
| CAASL | Sri Lanka | daw@caa.lk | 2026-05-05 | pending | sent |
| CAA Sudan | Sudan | none | n/a | none | excluded: conflict |
| CASAS | Suriname | casasinfo@casas.sr | 2026-05-05 | pending | sent |
| Transportstyrelsen | Sweden | none | n/a | denied | excluded: denied |
| FOCA / BAZL — ch-foca | Switzerland | aircraftregistry@bazl.admin.ch | 2026-05-05 | confirmed | live |
| SyCAA | Syria | none | n/a | none | excluded: sanctions |
| CAA Taiwan — tw-caa | Taiwan | gencaa@mail.caa.gov.tw | 2026-05-05 | confirmed | live |
| Tajikistan CAA | Tajikistan | info@caa.tj | 2026-05-11 | open | live |
| TCAA | Tanzania | tcaa@tcaa.go.tz | 2026-05-05 | pending | sent |
| CAAT Thailand | Thailand | inter_focalpoint@caat.or.th | 2026-05-10 | confirmed | cleared |
| ANATL | Timor-Leste | none | n/a | none | excluded: no register |
| ANAC Togo | Togo | anac@anac-togo.tg | 2026-05-10 | pending | sent: no bulk |
| n/a | Tonga | none | n/a | none | excluded: no register |
| TTCAA | Trinidad & Tobago | ttcaa@caa.gov.tt | 2026-05-05 | pending | sent |
| DGAC Tunisia | Tunisia | nidhal.souilmi@transport.state.tn | 2026-05-11 | pending | sent |
| SHGM | Türkiye | none | n/a | denied | excluded: denied |
| State Service for Civil Aviation | Turkmenistan | info-office@caa.gov.tm | 2026-05-11 | pending | sent |
| TCI CAA | Turks & Caicos | none | n/a | none | excluded: commercial |
| n/a | Tuvalu | none | n/a | none | excluded: no register |
| UCAA Uganda | Uganda | aviation@caa.co.ug | 2026-05-11 | pending | sent |
| SAAU | Ukraine | vdz@avia.gov.ua | 2026-05-10 | pending | sent |
| GCAA UAE | United Arab Emirates | customercare@gcaa.gov.ae | 2026-05-11 | pending | sent |
| UK CAA | United Kingdom | none | n/a | none | excluded: restrictive |
| FAA — faa | United States | none | n/a | open | live |
| DINACIA Uruguay | Uruguay | dinacia@dinacia.gub.uy | 2026-05-10 | pending | sent |
| UZCAA Uzbekistan | Uzbekistan | info@mintrans.uz | 2026-05-11 | pending | sent |
| n/a | Vatican | none | n/a | none | excluded: no register |
| INAC | Venezuela | none | n/a | none | excluded: sanctions |
| CAAV Vietnam | Vietnam | dunguv@caa.gov.vn | 2026-05-11 | pending | sent |
| CAMA | Yemen | none | n/a | none | excluded: conflict |
| ZCAA Zambia | Zambia | derrick.luembe@caa.co.zm | 2026-05-11 | pending | sent |
| CAAZ Zimbabwe | Zimbabwe | licencing@caaz.co.zw | 2026-05-11 | pending | sent |
<!-- prettier-ignore-end -->

Full correspondence/status detail: [DATA_LICENSES.md](DATA_LICENSES.md).

---

## Attribution

Required upstream notices, kept short:

- Transport Canada: Reproduced and distributed with the permission of the Government of Canada.
- Transport Canada value-added notice: This product has been produced by or for Ashley Childress and includes data provided by the Government of Canada. The incorporation of data sourced from the Government of Canada within this product shall not be construed as constituting an endorsement by the Government of Canada of our product.
- CASA Australia: source data from the Civil Aviation Safety Authority, licensed under CC BY 4.0; normalized into this project schema without implying endorsement.
- FOCA / BAZL Switzerland: source data from the Federal Office of Civil Aviation — [bazl.admin.ch](https://app02.bazl.admin.ch/web/bazl/en/); redistribution confirmed by FOCA, normalized into this project schema without implying endorsement.
- Public-domain / CC0 sources: credited as courtesy in [DATA_LICENSES.md](DATA_LICENSES.md).

---

## Legal Notice

- **No liability transfer.** Using, forking, or deploying this repository does not transfer liability to the maintainer. Each operator is solely responsible for their own deployment and its consequences.
- **Per-country compliance is the operator's responsibility.** This project ingests data from civil aviation authorities in multiple jurisdictions. Each imposes its own data-use, redistribution, and privacy obligations. Operators must independently assess and satisfy those obligations.
- **Research is informational, not legal advice.** The license classifications and permissions in `DATA_LICENSES.md` and `docs/license-matrix.md` reflect good-faith research at a point in time. They are not legal advice and carry no guarantee of completeness, accuracy, or continued validity.
- **Upstream terms change without notice.** Agencies amend terms, withdraw permissions, or restructure publication channels. Operators are responsible for monitoring those changes.
- **No warranty.** The data pipeline, its output, and the license research are provided as-is. See the `No Warranty` section of the [LICENSE](LICENSE).

---

## Adding a New Registry Source

[AGENTS.md](AGENTS.md) is authoritative for the rules below; this section is a friendlier overview and stays in sync with it.

1. Classify the license under PRD CC.1 (Open / Personal-use / Restrictive / Unknown). Restrictive sources are excluded.
2. For Personal-use or Unknown sources, send the agency permission email (template at [docs/agency-permission-request.md](docs/agency-permission-request.md)). The 30-day public-record fallback applies to Unknown only — Personal-use needs an affirmative reply (silence ≠ permission). Record outcome in `DATA_LICENSES.md`.
3. New source onboarding touches **all six surfaces** or the source is incomplete:
   - `sources/<source-id>.yaml` — mapping config; declare `format:` (`csv` | `ods` | `xlsx` | `xls`) and, if the upstream URL rolls per refresh, `download.discover_url:`.
   - `fixtures/<source-id>/` — CI ground-truth records covering positive / negative / edge cases.
   - `DATA_LICENSES.md` — classification, permitted uses, attribution wording, reply text (verbatim).
   - `README.md` sources table row — alphabetical by country (`scripts/check-sources-sorted.py` enforces).
   - `README.md` `## Attribution` block — the prominent display that satisfies the upstream license (courtesy credit for CC-0/public-domain sources).
   - `docs/license-matrix.md` summary row — same alphabetical order.
4. New scalar or compound transforms require updates in **three places** simultaneously or the loader rejects the config: enum in `src/types/config.ts`, handler in `src/transforms.ts`, allowlist in `src/config/loader.ts`.

The translation engine itself is source-agnostic and stays unchanged for new registries. The downloader and parser dispatch only grow when a source introduces a new file format or download pattern (e.g., NL ILT added the `.ods`/`.xlsx` parser path and the `discover_url` filename-rolling pattern in v3; CAA Taiwan added the legacy `.xls` parser path; au-casa added the `casa_full_registration` / `date_dd_slash_or_null` / `casa_airframe` transforms; ch-foca added the `json` parser path with a `POST` download body for the FOCA search API, plus the `foca_*` owner/operator transforms).

## License

[Polyform Shield 1.0.0 + Supplemental Terms](LICENSE)
