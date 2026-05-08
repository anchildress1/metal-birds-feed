# metal-birds-feed — Product Spec (v1)

**Status:** Draft
**Owner:** Ashley (anchildress1)
**Last updated:** 2026-05-04 (Netherlands ILT slotted into v3, spreadsheet parser path codified)
**Consumes by:** Personal forked deployment of [metal-birds-watch](https://github.com/georgekobaidze/metal-birds-watch)

---

## Problem Statement

`metal-birds-watch` displays live ADS-B traffic but has no way to enrich a tail number or ICAO hex code with anything beyond what the ADS-B feed alone provides. Existing enrichment APIs (Aviation Edge, OpenSky's commercial tier, etc.) are paid, rate-limited, or both. National aviation registries (FAA, Transport Canada, CAA NZ, GCAA, CASA, EU member states, UK CAA, etc.) publish data of varying quality, accessibility, and licensing — some clean monthly bulk CSVs under open licenses, some web search interfaces, some PDF dumps, some paid Excel under restrictive single-PC licenses. Painful to consume directly.

`metal-birds-feed` solves this by translating each national registry into a single normalized JSON schema, stored as static objects in Cloudflare R2 (free tier), keyed for O(1) lookup by registration ID and ICAO hex. One translation engine, many config-driven source mappings.

---

## Goals

1. **FAA registry, fully translated, in R2.** Every field FAA exposes in MASTER + ACFTREF + ENGINE, normalized into the canonical schema. ~300k US-registered aircraft queryable by registration ID or ICAO hex. _(v1)_
2. **Transport Canada registry, same shape.** ~37k Canadian aircraft, same canonical schema, no consumer-side code changes. Proves the engine generalizes — the second source is a config file, not a code change. _(v2)_
3. **Third-registry milestone — two parallel sources.** _(v3)_
   - **Netherlands ILT** (PH-prefix, ~7k aircraft). CC-0 (public domain) per data.overheid.nl. **No CC.2 permission email needed** — ships independently of any agency reply. Published as OpenDocument Spreadsheet (.ods), filename includes a date stamp that requires a small discovery step. Adds the spreadsheet parser path to the engine (R2.6), which also unblocks IAA Ireland later.
   - **CAA NZ** (ZK-prefix, ~5k aircraft). CSV at a stable URL. License is "personal use" (CC.1 Personal-use) — operator-private R2 only, CC.3 applies. CC.2 permission email gates slotting; ships when reply lands or 30-day timeout passes.

   v3 is "complete" when both ship. NL is the no-gate path that drives the parser-extension work; NZ is the email-gated path that runs in parallel. This milestone tests the engine against two independent schema dialects, two file formats, and the cross-cutting permission protocol in one phase.

4. **Georgia (country) registry, GCAA.** 4L prefix, small fleet (~hundreds of aircraft). Sentimental priority — operator's site lives there. First source where we may not have a clean bulk download; doubles as the proving ground for the long tail of registries that publish data inconveniently. _(v4)_

UK CAA is **excluded** for the foreseeable future (see Future Considerations → Blocked). G-INFO is paid + single-PC + non-redistributable, structurally incompatible with this project's deployment model.

Australia (CASA), Ireland (IAA), and other EU member-state registries are explicitly **post-v4 / future**. Each requires per-source CC.1 license classification and CC.2 permission protocol before slotting. EASA does not maintain an aircraft registry, so there is no single "EU" source — only national ones, added incrementally.

Stretch goal across all phases: the translation engine itself stays generic. Adding a new country = writing a config file (and, when the source format requires it, registering a parser path) — never modifying the engine's translation logic.

---

## Non-Goals

1. **Aircraft photos.** No registry provides them, scraping the ones that do (JetPhotos, PlaneSpotters) violates their terms. Schema has no `photo_url` field in v1. Hook reserved for future.
2. **Live flight data.** This is a static enrichment layer, not an ADS-B feed. `metal-birds-watch` stays the source of live position data; `metal-birds-feed` only answers "what is N12345 / hex A1B2C3?"
3. **Owner mailing addresses.** FAA publishes full street/city/ZIP for ~300k registrants in their bulk dump. Republishing trivially-queryable PII at scale creates GDPR exposure, doxxing risk, and Cloudflare TOS issues. Schema keeps owner name, kind, state, and registrant country only. (See Open Questions if this changes.)
4. **A queryable API or search.** R2 is object storage. Lookups are by exact key (`/aircraft/by-id/faa:N12345.json`). No full-text search, no filtering, no list endpoints. If a consumer needs that, they build it.
5. **Real-time refresh.** FAA publishes monthly. Transport Canada publishes monthly. National EU registries vary. The pipeline syncs at registry cadence, not on demand.
6. **Account-management airframes (corporate jet ownership tracing across LLC shells).** Out of scope; this is a registry mirror, not an investigative tool.
7. **Schema versioning / migration tooling.** v1 is a snapshot. If the schema changes, R2 gets rewritten from source on the next refresh. Acceptable because there is no `raw` blob to migrate independently.
8. **Hosted public read API.** No public read endpoint. Distribution is operator-private R2 binding only. Forks self-host. (See CC.4.) An earlier draft included a rate-limited Workers proxy for third parties; it was dropped because most national registers publish data under restrictive licenses that forbid public redistribution.
9. **Commercial operator deployment.** The operator's `metal-birds-feed` deployment must remain non-commercial — ads, sponsorship, monetization, or sale on `metal-birds-watch` invalidates CC BY-NC and "personal-use" source licenses, requiring those sources to be removed. (See CC.3.)

---

## User Stories

**Consumer: `metal-birds-watch` runtime**

- As the metal-birds-watch backend, I want to look up an aircraft by its ICAO hex code so that I can enrich a live ADS-B blip with manufacturer, model, owner, and airframe type.
- As the metal-birds-watch backend, I want to look up an aircraft by its registration (N-number, C-prefix, G-prefix) so that I can resolve user-entered tail numbers without already knowing the hex.
- As the metal-birds-watch backend, I want a stable JSON shape across all source countries so that I do not branch enrichment logic per registry.

**Operator: Ashley**

- As the operator, I want to add a new national registry by writing a config file (no engine changes) so that growing geographic coverage is bounded effort.
- As the operator, I want monthly refreshes to run unattended so that I do not have to babysit the pipeline.
- As the operator, I want clear logs when a source row fails to translate so that I can fix the mapping config and re-run.

**Future: forks / contributors**

- As a forker building a different consumer (a different flight tracker, a research tool), I want to fork the engine, point it at my own R2 bucket, and run my own pipeline so that the feed is reusable on my infrastructure under my own per-source license assessment.
- As a contributor adding a new country, I want a documented mapping-config schema and a test fixture pattern so that I can submit a PR without reverse-engineering the engine.

---

## Requirements

### Cross-Cutting (CC) — applies to every source

**CC.1 License classification.** Each source license is recorded in `DATA_LICENSES.md` under one of:

- **Open** — public domain, OGL, CC BY (no NC). No usage restriction beyond attribution. Eligible for any deployment model the project might adopt later.
- **Personal-use** — CC BY-NC, "personal use only" terms. Operator-private R2 only; operator deployment must satisfy CC.3.
- **Restrictive** — paid, single-PC, no-redistribute, or active denial. **Excluded from the project entirely.**
- **Unknown** — pending license research and/or permission-email reply. Source is not slotted into a phase until classification resolves.

**CC.2 Permission protocol.** For Personal-use and Unknown sources, send the agency permission email (template at `docs/agency-permission-request.md`) before slotting. Reply preserved verbatim in `DATA_LICENSES.md`. If no reply within 30 calendar days from the send date, the source proceeds on the public-record argument: the data is already public on the agency's site, this project republishes the same information with attribution, and any later removal request is honored promptly.

**CC.3 Non-commercial operator deployment.** The operator deployment of `metal-birds-feed` (read by `metal-birds-watch`) must remain non-commercial for the lifetime of any Personal-use source it ingests. Ads, sponsorship, monetization, or sale on the consumer site invalidates CC BY-NC and "personal-use" licenses, requiring those sources to be removed before any commercial change.

**CC.4 No public read API.** Distribution model is operator-private R2 binding only — `metal-birds-watch` reads R2 directly inside the same Cloudflare account. There is no hosted public read endpoint. Source-available code (Polyform Shield) lets third parties fork and self-host against their own R2 buckets and their own per-source license assessments.

### Must-Have (P0) — FAA, v1

**R0.1 Canonical schema implemented as TypeScript types.** Single source of truth (`src/schema.ts`). Exported. Used by both engine and consumers. Schema as locked in chat (registration, icao_hex, status, country, aircraft, engine, certificate, owner — minus PII).

**R0.2 FAA bulk downloader.** Pulls the monthly Aircraft Registry ZIP from `https://registry.faa.gov`, extracts MASTER.txt + ACFTREF.txt + ENGINE.txt. Idempotent — re-running with the same dump produces the same R2 state.

**R0.3 FAA mapping config.** Declarative YAML (`sources/faa.yaml`) that maps FAA columns to canonical fields, including:

- Field renames
- Code → enum lookups (TYPE REGISTRANT 1–9 → `owner.kind`; STATUS CODE → `status`; TYPE AIRCRAFT → `airframe_type`; TYPE ENGINE → `engine.type`; AC-CAT → `category`; BUILD-CERT-IND → `build_certification`)
- Unit conversions (mph → knots for cruise speed)
- Date parsing (YYYYMMDD → ISO date)
- Cross-table joins (MASTER.MFR_MDL_CODE → ACFTREF; MASTER.ENG_MFR_MDL → ENGINE)
- CERTIFICATION packed-string parser (first char → `airworthiness_class`; remaining → `operational_classes` array)

**R0.4 Translation engine.** Reads a source config + raw rows, emits canonical records. Source-agnostic. Errors on unknown enum values rather than silently dropping.

**R0.5 R2 writer.** Writes:

- `aircraft/by-id/faa/<UNIQUE_ID>.json` — canonical record
- `aircraft/by-icao-hex/<HEX>.json` — `{"refs": ["faa:<UNIQUE_ID>", ...]}` lookup
- `aircraft/by-registration/<REG>.json` — `{"refs": ["faa:<UNIQUE_ID>", ...]}` lookup

Lookup objects are arrays because the same hex / registration can legitimately point to multiple historical records over time. Consumers filter by `status === "valid"` for current.

**R0.6 Refresh orchestration.** GitHub Actions scheduled workflow fires monthly (1st of the month, ~6:00 UTC). Workflow downloads, translates, diffs, writes to R2 via Cloudflare API token stored in GHA secrets. On failure, leaves the previous R2 state untouched and logs the error. Manual `workflow_dispatch` trigger also available for ad-hoc runs.

Why GHA over Workers Cron Triggers: the FAA refresh needs ~5 minutes of CPU and a few hundred MB of RAM to download, parse, join, and translate. Workers free-tier crons cap at 10ms CPU per invocation; running this in Workers requires the $5/month paid plan. GHA gives a full Linux runner (2 vCPU, 7 GB RAM, 6-hour timeout) for free on public repos, well under quota on private. Egress to R2 is free either way.

GHA disables scheduled workflows after 60 days of repo inactivity. Mitigated by Dependabot PR activity (see R0.9), and operator will manually re-enable + refresh if it ever lapses.

**R0.7 Diff-write strategy.** Refresh job computes the diff between the new translated batch and the existing R2 state before writing. Only objects with changed content get PUT; unchanged objects are skipped. Stale objects (records that disappeared from the source) get DELETE'd. Rationale: a full FAA refresh produces ~900k R2 Class A ops (300k records × 3 index paths), within free tier but tight. Real monthly delta is <5%, so diffed writes are ~45k ops — comfortable headroom for adding Canada, NZ, and additional registries without paying for ops.

Implementation: list current `aircraft/by-id/<source>/` objects, fetch each (or maintain a manifest object listing content hashes per record), compare to newly translated records, emit only changes. A manifest file (`aircraft/_manifest/<source>.json` mapping `source_id → content_hash`) is the cheap option — one read, one write, instead of N reads.

**R0.8 Dependabot configuration.** `.github/dependabot.yml` enabled for npm + GHA dependencies on a weekly cadence. Serves two purposes: (1) keep dependencies current without manual triage, (2) generate enough repo activity to prevent GHA from auto-disabling scheduled workflows. Auto-merge enabled for patch-level updates that pass CI; manual review for minor/major.

**R0.9 Acceptance fixture.** A hand-curated set of ~10 FAA records covering edge cases (single-engine piston, twin turboprop, jet, helicopter, glider, balloon, experimental kit-built, fractional ownership, non-citizen corp, expired registration). Expected canonical output is committed. CI runs the engine against fixtures on every PR.

**R0.10 R2 access model.** R2 bucket is **private** (no public URL). Operator's own consumers (`metal-birds-watch` on Cloudflare Pages) read via R2 binding inside the same Cloudflare account — direct, no proxy, no rate limit. Third-party consumers fork the repo, point a GHA workflow at their own R2 bucket, and read from there under their own per-source license assessment. There is no hosted public read endpoint (see CC.4).

This is the deliberate trade: operator's costs stay $0 regardless of external interest, and anyone who needs access has a self-serve path that does not involve operator infrastructure.

**Acceptance criteria for FAA milestone:**

- Given a fresh R2 bucket and the latest FAA monthly dump
- When the GHA refresh workflow runs to completion
- Then `aircraft/by-id/faa/*.json` count is within 1% of the FAA MASTER row count (allowing for parse failures, which are logged)
- And every record validates against the TypeScript schema at runtime
- And `aircraft/by-icao-hex/*` exists for every record where `icao_hex !== null`
- And `aircraft/by-registration/*` exists for every record

### Should-Have (P1) — Transport Canada, v2

**R1.1 Transport Canada source config.** New file `sources/tc-ca.yaml`. No engine changes. Same canonical schema.

**R1.2 TC field-coverage parity.** Document any canonical fields TC does not provide (likely cruise speed, possibly engine details). Those fields stay null. No fallback or invented values.

**Acceptance for v2:** A consumer querying `aircraft/by-id/tc-ca/<id>.json` gets a record with the same TypeScript shape as FAA, with appropriate nulls.

### Could-Have (P2) — Third-registry milestone, v3

v3 ships two parallel sources: **Netherlands ILT** (no-email, ships first, drives the spreadsheet parser path) and **CAA NZ** (email-gated, ships when reply lands or 30-day timeout passes). Both must be in R2 before v3 is "complete."

#### CAA NZ track (email-gated)

**R2.1 NZ CAA source config.** New file `sources/nz-caa.yaml`. Single national registry, ZK-prefix, ~5k aircraft. CAA NZ publishes the full register as a CSV at a stable URL (https://www.aviation.govt.nz/assets/aircraft/aircraft-register/Aircraft-Register-for-website-.csv). No engine changes. Same canonical schema.

**R2.2 NZ field-coverage parity.** Document fields CAA NZ does not provide. Null-rather-than-invent rule unchanged.

**R2.3 NZ permission protocol.** Per CC.2, send the agency permission email (template at `docs/agency-permission-request.md`) to info@caa.govt.nz before slotting. Reply preserved verbatim in `DATA_LICENSES.md`. If no reply within 30 calendar days, source proceeds on the public-record argument. CAA NZ classifies as **Personal-use** under CC.1, so CC.3 (non-commercial operator deployment) applies.

**Acceptance (NZ CAA track):** A consumer querying `aircraft/by-id/nz-caa/<id>.json` gets a record with the same TypeScript shape as FAA and Canada. CAA NZ permission email sent and either honored or 30-day-timed-out, status recorded in `DATA_LICENSES.md`.

#### Netherlands ILT track (no-email path)

**R2.4 NL ILT source config.** New file `sources/nl-ilt.yaml`. Single national registry, PH-prefix, ~7k aircraft. ILT publishes the full register as an OpenDocument Spreadsheet (.ods) at a date-stamped URL on `ilent.nl`. Same canonical schema. License: **CC-0 (public domain)** per data.overheid.nl, classified Open under CC.1 — no CC.2 permission email needed.

**R2.5 NL field-coverage parity.** Document fields ILT does not provide. Null-rather-than-invent rule unchanged.

**R2.6 Spreadsheet parser path (engine extension).** ILT publishes `.ods`; IAA Ireland (Future R4.2) publishes `.xlsx`. Engine grows a pluggable parser layer keyed off `format:` in the source YAML — `csv` (existing), `ods`, `xlsx`. Implementation uses a single library that handles both ODS and XLSX (SheetJS / `xlsx` package is the current candidate; final selection happens at code time per the standing "verify latest LTS recommendation before adding a dependency" rule). The engine's row-translation logic stays format-agnostic — only the parser dispatch is new.

**R2.7 Filename discovery (NL-specific).** ILT's bulk download URL embeds the file's publication date (e.g. `luchtvaartuigregister-ilt-datas2-2026-04-28.ods`), which changes every refresh. Downloader gains a small "discovery" step for sources that declare `download.discover_url:` — fetch the index page, regex out the latest data-file URL, then download. NL is the first source to use this; future sources with the same pattern reuse it.

**Acceptance (NL ILT track):** A consumer querying `aircraft/by-id/nl-ilt/<id>.json` gets a record with the same TypeScript shape as FAA, TC, and CAA NZ. The spreadsheet parser path round-trips an ILT fixture without changes to `src/engine.ts`'s translation logic.

### Could-Have (P3) — Georgia (GCAA), v4

**R3.1 Data source acquisition (research milestone, blocking R3.2).** Investigate whether GCAA (gcaa.ge) publishes a downloadable aircraft register. If yes, document the URL, format, update cadence, and licensing. If no, decide: (a) scrape the public web search interface, (b) request data via FOIA-equivalent, (c) hand-curate, or (d) drop Georgia and pick a different v4. Time-box this research to 1 week. Do not start R3.2 until R3.1 has a yes-or-no answer.

**R3.2 Georgia GCAA source config.** New file `sources/ge-gcaa.yaml`. Adapter shape depends on R3.1's outcome — if bulk download, mirror the FAA/Canada/NZ pattern; if scraping, build a small scraper that respects rate limits and robots.txt and feeds the same translation engine.

**R3.3 Cyrillic / Georgian script handling.** GCAA records may include owner names in Mkhedruli (Georgian script) or Cyrillic. Schema is already Unicode-clean (TypeScript `string`), but verify R2 stores and serves UTF-8 cleanly end-to-end with non-Latin owner names. Add a fixture record covering this.

**Acceptance for v4:** A consumer querying `aircraft/by-id/ge-gcaa/<id>.json` gets a valid record. Owner names in Georgian script round-trip through R2 storage and the operator R2-binding read path without mojibake.

### Future Considerations (post-v4)

#### Roadmap — additional registries

Each new registry is gated on CC.1 license classification + CC.2 permission protocol if needed. None of these are committed; they slot in incrementally if/when there is reason to.

**R4.1 Australia (CASA).** New file `sources/au-casa.yaml`. ~15k aircraft, VH-prefix, monthly CSV at `https://services.casa.gov.au/CSV/acrftreg.csv`. License: CC BY-NC 4.0 (Personal-use under CC.1). Requires CC.2 permission email; if 30-day timeout passes, proceed on public-record argument.

**R4.2 Ireland (IAA).** New file `sources/ie-iaa.yaml`. ~1.4k aircraft, EI-prefix, monthly XLSX. The XLSX parser path is shared with NL ILT (added in R2.6 during v3), so IAA's engine work is just config + fixtures. License classification pending (CC.1) and CC.2 permission email if needed.

**R4.3 EU member-state registries.** One config per country (`sources/de-lba.yaml`, `sources/fr-dgac.yaml`, `sources/ch-bazl.yaml`, Nordics, etc.). Prioritize by license clarity, not fleet size — Open sources first.

#### Engine extensions

**R4.4 Photo-URL hook.** Schema gains a nullable `photo_url` field. Engine can be configured to populate it from a separate source (Wikimedia Commons API at minimum, since it is actually free and legally clean). Defaults to null.

**R4.5 Schema migration tooling.** When the canonical schema changes in a non-backward-compatible way, a migration script regenerates all existing R2 records from the cached source dumps without re-downloading.

**R4.6 Sibling project: NTSB accident-history feed.** Same translation-engine pattern, different source. Out of scope for `metal-birds-feed` itself, but the engine should be reusable.

#### Blocked

**UK CAA.** G-INFO is published only as a paid product (£1,745/yr monthly subscription, £450 single issue) under a single-PC license that explicitly forbids copying, distribution, sale, or hire without written CAA consent. The single-PC clause is incompatible with R2 storage even for purely operator-private use; the no-redistribution clause is incompatible with source-available code that another fork might run. Excluded under CC.1 (Restrictive). Revisit only if CAA changes the licensing terms.

**Public read API (revival).** If at some future point every slotted source has migrated to an Open license under CC.1, a rate-limited public read endpoint (Cloudflare Workers, ~100 req/min/IP) could be reintroduced. Until then, CC.4 stands.

---

## Success Metrics

### Leading indicators (visible within days of each milestone)

- **Translation success rate:** ≥99% of source rows produce a valid canonical record. Failed rows are logged with row number, source field, and reason.
- **Schema validation pass rate:** 100% of written R2 objects validate against the TypeScript schema at runtime.
- **Lookup hit rate from `metal-birds-watch`:** % of ADS-B blips with US-registered hex codes that successfully resolve to a `metal-birds-feed` record. Target: ≥95% for FAA-registered traffic post-v1.

### Lagging indicators (months)

- **New-country onboarding effort:** Hours to add a new source config, measured from "starting to read the source's docs" to "fixtures pass." Target: ≤8 hours for a country with a clean bulk-download CSV.
- **Refresh reliability:** Monthly refresh succeeds without manual intervention. Target: ≥11 of 12 months.
- **Reuse:** At least one fork outside `metal-birds-watch` self-hosts the engine against its own R2 bucket. Loose target — proves the engine is genuinely reusable, not just a private subroutine.

### Explicitly not a metric

R2 storage cost. The whole point is that this fits in the free tier. If FAA + TC + UK + GCAA push past 10 GB, something is wrong with the implementation, not a sign of growth to celebrate.

---

## Open Questions

**ICAO type-code source (data, non-blocking).** FAA stores manufacturer + model strings but not always the ICAO type designator (e.g., `B738`). Mapping requires a separate ICAO type-code lookup table (~12k entries, available from ICAO Doc 8643 or community-maintained CSVs). Decision: bundle a lookup table in the repo, or skip `icao_type_code` for FAA records?

**FAA UNIQUE ID vs. N-number for `source_id` (engineering, leaning UNIQUE ID).** N-numbers are reissued; UNIQUE ID is permanent per registration. Spec currently assumes UNIQUE ID. Confirm before R0.5 wires the R2 paths.

**Georgia GCAA data accessibility (data, blocking R3.2 only — does not block v1, v2, or v3).** Does GCAA publish a bulk-downloadable aircraft register? If not, what's actually available — scrapeable web search, PDFs, FOIA-equivalent request, nothing? R3.1 is the time-boxed research to answer this. Outcome shapes whether v4 is "another easy config" or "build a scraper."

**Per-source license terms (legal, settled framework).** Code license: Polyform Shield 1.0.0 (source-available, no commercial use by competitors). Source data licenses are per-source under CC.1: FAA = Open (US public domain); TC-CA = Open (OGL-Canada, attribution); CAA NZ = Personal-use (CC.2 email pending); CASA AU = Personal-use (CC.2 email pending); UK CAA = Restrictive, excluded. Per-source attribution and permission status tracked in `DATA_LICENSES.md`.

---

## Timeline Considerations

No hard external deadlines. This is a personal project gating a personal site. Sanity-preservation is an explicit constraint.

Suggested phasing:

- **v1 — FAA only:** target completion when FAA is end-to-end working and `metal-birds-watch` can read from R2 via R2 binding. No deadline.
- **v2 — Transport Canada:** delta from v1 is small (one config file, one downloader, fixtures). Start when v1 has run cleanly through at least one monthly refresh.
- **v3 — Third-registry milestone (NL ILT + CAA NZ):** start when v2 is stable. Two parallel tracks: NL ILT (no email, ships first; the spreadsheet parser path is the new engine work) and CAA NZ (CC.2 email gates slot, 30-day clock starts on send). NL ships independently of any agency reply; NZ ships when its email resolves or times out. v3 closes when both are in R2.
- **v4 — Georgia (GCAA):** start when v3 is stable. Begins with R3.1 research milestone before any code. Schedule slips if data isn't accessible — that's the deal you accept by sentimental-prioritizing this over EU member states with known data sources.
- **Future** — Australia (CASA), Ireland (IAA), EU member states, photo-URL hook, schema migration tooling, NTSB sibling project. No commitment, added when motivated. Each new registry begins with CC.1 + CC.2.

Dependencies:

- ICAO type-code lookup decision (Open Questions) blocks complete FAA enrichment but not v1 ship.
- R3.1 (Georgia data acquisition research) gates all of v4 but is independent of v1/v2/v3.

---

## Appendix: Non-Goals That Will Be Asked About

These come up every time someone hears "free aviation data API." Documented so the answer is the spec, not a re-litigation:

- **Operator / airline data:** Not in registry data. Out of scope.
- **Flight schedules:** Not registry data. Out of scope.
- **Historical positions / track logs:** That is what ADS-B archives are for. Out of scope.
- **Aircraft for sale / market data:** Out of scope.
- **Maintenance / accident history:** NTSB has a separate database. Out of scope for v1; could be a separate sibling project.
