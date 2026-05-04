# metal-birds-feed — Product Spec (v1)

**Status:** Draft
**Owner:** Ashley (anchildress1)
**Last updated:** 2026-05-03
**Consumes by:** Personal forked deployment of [metal-birds-watch](https://github.com/georgekobaidze/metal-birds-watch)

---

## Problem Statement

`metal-birds-watch` displays live ADS-B traffic but has no way to enrich a tail number or ICAO hex code with anything beyond what the ADS-B feed alone provides. Existing enrichment APIs (Aviation Edge, OpenSky's commercial tier, etc.) are paid, rate-limited, or both. Free national aviation registries (FAA, Transport Canada, UK CAA, GCAA, EU member states) publish data of varying quality and accessibility — some clean monthly bulk CSVs, some web search interfaces, some PDF dumps — each with a different schema, file format, code convention, and update cadence. Painful to consume directly.

`metal-birds-feed` solves this by translating each national registry into a single normalized JSON schema, stored as static objects in Cloudflare R2 (free tier), keyed for O(1) lookup by registration ID and ICAO hex. One translation engine, many config-driven source mappings.

---

## Goals

1. **FAA registry, fully translated, in R2.** Every field FAA exposes in MASTER + ACFTREF + ENGINE, normalized into the canonical schema. ~300k US-registered aircraft queryable by registration ID or ICAO hex. _(v1)_
2. **Transport Canada registry, same shape.** ~37k Canadian aircraft, same canonical schema, no consumer-side code changes. Proves the engine generalizes — the second source is a config file, not a code change. _(v2)_
3. **UK CAA registry.** Single national registry, G-prefix, ~20k aircraft. Structurally similar to FAA/Canada (clean bulk download), but tests our engine against a third independent schema dialect. _(v3)_
4. **Georgia (country) registry, GCAA.** 4L prefix, small fleet (~hundreds of aircraft). Sentimental priority — operator's site lives there. First source where we may not have a clean bulk download; doubles as the proving ground for the long tail of registries that publish data inconveniently. _(v4)_

EU member-state registries (Germany LBA, France DGAC, Italy ENAC, etc.) are explicitly **post-v4 / future**, not part of the top goals. EASA does not maintain an aircraft registry, so there is no single "EU" source — only 27 national ones, added incrementally if/when there is reason to.

Stretch goal across all phases: the translation engine itself stays generic. Adding a new country = writing a config file and a small parser, never modifying the engine.

---

## Non-Goals

1. **Aircraft photos.** No registry provides them, scraping the ones that do (JetPhotos, PlaneSpotters) violates their terms. Schema has no `photo_url` field in v1. Hook reserved for future.
2. **Live flight data.** This is a static enrichment layer, not an ADS-B feed. `metal-birds-watch` stays the source of live position data; `metal-birds-feed` only answers "what is N12345 / hex A1B2C3?"
3. **Owner mailing addresses.** FAA publishes full street/city/ZIP for ~300k registrants in their bulk dump. Republishing trivially-queryable PII at scale creates GDPR exposure, doxxing risk, and Cloudflare TOS issues. Schema keeps owner name, kind, state, and registrant country only. (See Open Questions if this changes.)
4. **A queryable API or search.** R2 is object storage. Lookups are by exact key (`/aircraft/by-id/faa:N12345.json`). No full-text search, no filtering, no list endpoints. If a consumer needs that, they build it.
5. **Real-time refresh.** FAA publishes monthly. Transport Canada publishes monthly. National EU registries vary. The pipeline syncs at registry cadence, not on demand.
6. **Account-management airframes (corporate jet ownership tracing across LLC shells).** Out of scope; this is a registry mirror, not an investigative tool.
7. **Schema versioning / migration tooling.** v1 is a snapshot. If the schema changes, R2 gets rewritten from source on the next refresh. Acceptable because there is no `raw` blob to migrate independently.

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

- As a forker building a different consumer (a different flight tracker, a research tool), I want to read R2 directly without going through metal-birds-watch so that the feed is reusable.
- As a contributor adding a new country, I want a documented mapping-config schema and a test fixture pattern so that I can submit a PR without reverse-engineering the engine.

---

## Requirements

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

**R0.7 Diff-write strategy.** Refresh job computes the diff between the new translated batch and the existing R2 state before writing. Only objects with changed content get PUT; unchanged objects are skipped. Stale objects (records that disappeared from the source) get DELETE'd. Rationale: a full FAA refresh produces ~900k R2 Class A ops (300k records × 3 index paths), within free tier but tight. Real monthly delta is <5%, so diffed writes are ~45k ops — comfortable headroom for adding Canada, UK, and EU sources without paying for ops.

Implementation: list current `aircraft/by-id/<source>/` objects, fetch each (or maintain a manifest object listing content hashes per record), compare to newly translated records, emit only changes. A manifest file (`aircraft/_manifest/<source>.json` mapping `source_id → content_hash`) is the cheap option — one read, one write, instead of N reads.

**R0.8 Dependabot configuration.** `.github/dependabot.yml` enabled for npm + GHA dependencies on a weekly cadence. Serves two purposes: (1) keep dependencies current without manual triage, (2) generate enough repo activity to prevent GHA from auto-disabling scheduled workflows. Auto-merge enabled for patch-level updates that pass CI; manual review for minor/major.

**R0.9 Acceptance fixture.** A hand-curated set of ~10 FAA records covering edge cases (single-engine piston, twin turboprop, jet, helicopter, glider, balloon, experimental kit-built, fractional ownership, non-citizen corp, expired registration). Expected canonical output is committed. CI runs the engine against fixtures on every PR.

**R0.10 R2 access model.** R2 bucket is **private** (no public URL). Operator's own consumers (`metal-birds-watch` on Cloudflare Pages) read via R2 binding inside the same Cloudflare account — direct, no proxy, no rate limit. Third-party consumers either (a) hit the rate-limited public read API (R1.3) or (b) fork the repo, point a GHA workflow at their own R2 bucket, and read whatever they want from it.

This is the deliberate trade: operator's costs stay $0 regardless of external interest, and anyone who needs unthrottled access has a self-serve path that doesn't involve operator infrastructure.

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

**R1.3 Rate-limited public read API.** Cloudflare Workers endpoint that proxies reads from the private R2 bucket for third-party consumers. Default rate limit: 100 req/min/IP, configurable. Returns 429 on overage with `Retry-After` header. Documented in repo README. Operator's own consumers (`metal-birds-watch` via R2 binding) bypass entirely — only external traffic hits the rate limiter.

Sized for v2 because v1 has no external readers yet (operator-only). Once the bucket has Canada too, third parties might show up — that's when the rate limiter matters.

**Acceptance for v2:** A consumer querying `aircraft/by-id/tc-ca/<id>.json` gets a record with the same TypeScript shape as FAA, with appropriate nulls. Public read API responds within rate limit and returns 429 above it.

### Could-Have (P2) — UK CAA, v3

**R2.1 UK CAA source config.** New file `sources/uk-caa.yaml`. Single national registry, G-prefix, ~20k aircraft. UK CAA publishes a downloadable register (CSV/Excel via their G-INFO portal). No engine changes. Same canonical schema.

**R2.2 UK field-coverage parity.** Document fields UK CAA does not provide. Same null-rather-than-invent rule.

**R2.3 Post-Brexit licensing note.** UK data is Open Government Licence. Add UK attribution to `DATA_LICENSES.md`.

**Acceptance for v3:** A consumer querying `aircraft/by-id/uk-caa/<id>.json` gets a record with the same TypeScript shape as FAA and Canada.

### Could-Have (P3) — Georgia (GCAA), v4

**R3.1 Data source acquisition (research milestone, blocking R3.2).** Investigate whether GCAA (gcaa.ge) publishes a downloadable aircraft register. If yes, document the URL, format, update cadence, and licensing. If no, decide: (a) scrape the public web search interface, (b) request data via FOIA-equivalent, (c) hand-curate, or (d) drop Georgia and pick a different v4. Time-box this research to 1 week. Do not start R3.2 until R3.1 has a yes-or-no answer.

**R3.2 Georgia GCAA source config.** New file `sources/ge-gcaa.yaml`. Adapter shape depends on R3.1's outcome — if bulk download, mirror the FAA/Canada/UK pattern; if scraping, build a small scraper that respects rate limits and robots.txt and feeds the same translation engine.

**R3.3 Cyrillic / Georgian script handling.** GCAA records may include owner names in Mkhedruli (Georgian script) or Cyrillic. Schema is already Unicode-clean (TypeScript `string`), but verify R2 stores and serves UTF-8 cleanly end-to-end with non-Latin owner names. Add a fixture record covering this.

**Acceptance for v4:** A consumer querying `aircraft/by-id/ge-gcaa/<id>.json` gets a valid record. Owner names in Georgian script render correctly through the read API.

### Future Considerations (post-v4)

**R4.1 EU member-state source configs.** One config per country (`sources/de-lba.yaml`, `sources/fr-dgac.yaml`, etc.). Prioritize by fleet size. Coverage is incremental, not exhaustive — add a country when there is a reason to.

**R4.2 Photo-URL hook.** Schema gains a nullable `photo_url` field. Engine can be configured to populate it from a separate source (Wikimedia Commons API at minimum, since it is actually free and legally clean). Defaults to null.

**R4.3 Schema migration tooling.** When the canonical schema changes in a non-backward-compatible way, a migration script regenerates all existing R2 records from the cached source dumps without re-downloading.

**R4.4 Sibling project: NTSB accident-history feed.** Same translation-engine pattern, different source. Out of scope for `metal-birds-feed` itself, but the engine should be reusable.

---

## Success Metrics

### Leading indicators (visible within days of each milestone)

- **Translation success rate:** ≥99% of source rows produce a valid canonical record. Failed rows are logged with row number, source field, and reason.
- **Schema validation pass rate:** 100% of written R2 objects validate against the TypeScript schema at runtime.
- **Lookup hit rate from `metal-birds-watch`:** % of ADS-B blips with US-registered hex codes that successfully resolve to a `metal-birds-feed` record. Target: ≥95% for FAA-registered traffic post-v1.

### Lagging indicators (months)

- **New-country onboarding effort:** Hours to add a new source config, measured from "starting to read the source's docs" to "fixtures pass." Target: ≤8 hours for a country with a clean bulk-download CSV.
- **Refresh reliability:** Monthly refresh succeeds without manual intervention. Target: ≥11 of 12 months.
- **Reuse:** At least one consumer outside `metal-birds-watch` (a fork, a personal project, a friend's tool) reads from R2. Loose target — proves the feed is genuinely reusable, not just a private subroutine.

### Explicitly not a metric

R2 storage cost. The whole point is that this fits in the free tier. If FAA + TC + UK + GCAA push past 10 GB, something is wrong with the implementation, not a sign of growth to celebrate.

---

## Open Questions

**ICAO type-code source (data, non-blocking).** FAA stores manufacturer + model strings but not always the ICAO type designator (e.g., `B738`). Mapping requires a separate ICAO type-code lookup table (~12k entries, available from ICAO Doc 8643 or community-maintained CSVs). Decision: bundle a lookup table in the repo, or skip `icao_type_code` for FAA records?

**FAA UNIQUE ID vs. N-number for `source_id` (engineering, leaning UNIQUE ID).** N-numbers are reissued; UNIQUE ID is permanent per registration. Spec currently assumes UNIQUE ID. Confirm before R0.5 wires the R2 paths.

**Georgia GCAA data accessibility (data, blocking R3.2 only — does not block v1, v2, or v3).** Does GCAA publish a bulk-downloadable aircraft register? If not, what's actually available — scrapeable web search, PDFs, FOIA-equivalent request, nothing? R3.1 is the time-boxed research to answer this. Outcome shapes whether v4 is "another easy config" or "build a scraper."

**License (legal, non-blocking).** Repo license decision (MIT? Apache 2.0?). Source data licenses (FAA = US gov, public domain; TC-CA = Open Government Licence; UK CAA = OGL; GCAA = unknown, R3.1 should determine; EU member states vary). Worth a `DATA_LICENSES.md` documenting per-source attribution requirements.

---

## Timeline Considerations

No hard external deadlines. This is a personal project gating a personal site. Sanity-preservation is an explicit constraint.

Suggested phasing:

- **v1 — FAA only:** target completion when FAA is end-to-end working and `metal-birds-watch` can read from R2 via R2 binding. No deadline.
- **v2 — Transport Canada + public read API:** delta from v1 is small (one config file, one downloader, fixtures, one Workers endpoint). Start when v1 has run cleanly through at least one monthly refresh.
- **v3 — UK CAA:** start when v2 is stable. Should be straightforward — clean bulk download, English schema, similar shape to FAA/Canada.
- **v4 — Georgia (GCAA):** start when v3 is stable. Begins with R3.1 research milestone before any code. Schedule slips if data isn't accessible — that's the deal you accept by sentimental-prioritizing this over EU member states with known data sources.
- **Future** — EU member states, photo-URL hook, schema migration tooling, NTSB sibling project. No commitment, added when motivated.

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
