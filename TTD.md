- [x] Add `STREAM_THRESHOLD_BYTES = 256 * 1024 * 1024` constant to `src/downloader.ts` (export for testability)
- [x] Add `extractZipStream()` to `src/downloader.ts` using `unzipper.Parse` pipe
- [x] Add dispatch logic in `download()` — stream when `Content-Length` ≥ threshold or absent, buffer otherwise
- [x] Log download mode selection (`buffer` vs `stream`) with content length
- [x] Add stream path tests to `tests/downloader.test.ts` (below threshold, at threshold, absent `Content-Length`, unwanted entries autodrained, missing entry throws)
- [x] **After the 1.0.0 release PR merges:** drop `"release-as": "1.0.0"` from `release-please-config.json`. The option is sticky — release-please keeps recomputing 1.0.0, the release PR tries to re-create an existing tag, `release_created` stays falsy and the deploy job is skipped, so releases stop working with nothing red to show for it.

## Discovered sources — implementation queue, easiest first

- [ ] Jamaica JCAA — HTML table, `https://jcaa.gov.jm/aircraft-registry-page`; only source here with Mode S hex
- [ ] Fiji CAAF — HTML table, `https://www.caaf.org.fj/aircraft-register-search/`; MSN/series columns misaligned on some rows
- [ ] Sri Lanka CAASL — PDF, `https://www.caa.lk/en/downloads/sl-aircraft-register`; dated filenames need `discover_url`; marks carry stray spaces
- [ ] Papua New Guinea CASA — PDF, `https://casapng.gov.pg/safety-regulatory/airworthiness/Aircraft-Registers/`; no serial/status
- [ ] Trinidad & Tobago TTCAA — PDF, `https://caa.gov.tt/wp-content/uploads/2024/10/2024-OCTOBER-14-AIRCRAFT-ON-TTCAA-REGISTER.pdf`; dated 2024-10, look for a fresher file first
- [ ] Macao AACM — HTML, 22 rows, `https://www.aacm.gov.mo/zh-hant/industry-page/RegisteredAircraft`; site terms forbid modifying content, decide before onboarding
- [ ] Uruguay URSEC — ODS, partial (radio-permit aircraft only), call-sign keyed; terms link 404
- [ ] Tanzania TCAA — needs crawler: 34 list pages + per-record detail, `https://tcaa.go.tz/aircraft-documents`
- [ ] Belize BDCA — register page 404'd on fetch; re-check in a browser

## Second-pass recon

- [ ] Asia: shallow first pass, no bulk register found. Retry with local-language search + browser for India (eGCA), Korea, Indonesia, Philippines (FOI list), Malaysia, Vietnam, Pakistan, Bangladesh, Nepal
- [ ] Uzbekistan UZCAA — `https://gov.uz/en/uzcaa/sections/reestrlar` "Registers" section unopened

## Discovered sources — Europe (same sweep)

- [ ] Luxembourg DAC — PDF, ODC-BY (stated), monthly; `https://data.public.lu/en/datasets/releve-luxembourgeois-des-immatriculations`; PII already excluded upstream
- [ ] Moldova CAA — PDF, CC BY-SA 4.0 site-wide (ShareAlike: check effect on derived artifact); `https://www.caa.md/index.php/ro/aeronave-inmatriculate-rm`
- [ ] Bulgaria CAA — xlsx (~400 rows, serial, no owner/status), dated filenames need `discover_url`; `https://www.caa.bg/bg/category/300/17238`
- [ ] Cyprus DCA — PDF, half-yearly, Lotus Notes URL changes each edition; has owner/operator, MTOW, C of A
- [ ] Slovakia Dopravný úrad — PDF, owner includes natural persons; `https://letectvo.nsat.sk/letova-sposobilost/register-lietadiel-slovenskej-republiky/zoznam-registra/`
- [ ] Montenegro ACG — HTML table, 6 pages, deregistered filter; `https://caa.me/me/registri`
- [ ] Ukraine SAAU — likely `https://avia.gov.ua/register_of_aircraft.xls` (daily, from a search snippet only); 403 on WebFetch, retest with a real client
- [ ] Ireland IAA, Malta CAD — 403 on WebFetch; retest with a real client
- [ ] Albania AAC — page says a "last revision" file sits under publications and forms; locate it

## History in the per-source artifact

- [x] Columns `first_seen`, `removed_on`, `missing_since` (all nullable but `first_seen`); `DB_SCHEMA_VERSION` 14; PK `(source_id, first_seen)`; partial unique index on `source_id WHERE removed_on IS NULL`
- [x] Merge step: present → keep `first_seen`, clear `missing_since`; first miss → stamp `missing_since`, stay live; second consecutive miss → `removed_on = missing_since`; returns after close with the same `source_id` → reopen, keep `first_seen`
- [x] Reuse on mark-keyed sources: same `source_id` back with a different non-null `serial_number` → close the old row, open a new one
- [x] Writer reads the prior artifact; unreadable or no migration path → fail that source closed, never reset history; closed rows must be a superset of the prior closed rows
- [x] Only fetched runs count toward a miss: cadence skips and failed runs neither close nor clear
- [x] Migrations for closed rows: additive bump copies by column name with nulls; non-additive bump ships an explicit migration in the same commit
- [x] Feed slice takes live rows only; `FEED_SLICE_VERSION` stays put
- [x] `AGENTS.md`: rewrite the no-compat, no-older-shape and never-migrate rules to except closed rows; `PRD.md` non-goal 7 (schema versioning / migration tooling) changes
- [x] Run the `lt-tka` backfill once, after the first schema-14 refresh and over the VPN: `make build`, then `BACKFILL_SOURCE=lt-tka DRY_RUN=true bun run dist/backfill-history.js` with `.env` loaded, then again without `DRY_RUN`. It replays the clean publications through the live merge, skips the double-loaded 2025-04-29 and 2025-06-10 loads, and refuses an artifact that already has closed rows.

## Test-quality review (done; 17 mutations killed in a throwaway worktree)

### Pass for the wrong reason

- [x] `tests/localize/cache.test.ts:87,96,107` omit `failures`, so they fail on the missing field, not the key regex / non-empty rule
- [x] `tests/config/loader.test.ts:507` negative `allowed_ragged_rows` uses a scalar; negativity never reached
- [x] `tests/config/loader.test.ts:227` unknown-format test uses `pdf` (valid); use `docx`, add a "pdf requires pdf block" test
- [x] `tests/config/loader.test.ts:455-518` ~10 rejections assert only `/invalid source config/`; `constant + transform` trips two refines
- [x] `tests/engine.test.ts:722,805` assert `failed > 0`; pin counts and the log message
- [x] `tests/transforms.test.ts:153` enshrines `'AB'` → `'C-AB'` (invented data); make `tcFullRegistration` reject lengths other than 3 or 4

### Missing negatives in security paths

- [x] path sandbox sibling-prefix (`${ROOT}-evil/x.yaml`): `loader.test.ts:33`, `service/config.test.ts:60`
- [x] nothing asserts 401/404/405 do not spend the rate-limit budget (`handler.test.ts`)
- [x] `parseRegistrations`: 501 cap, non-string element, `[]`
- [x] real `isGeminiAuthError` untested; `localize.test.ts:19` tests a copy defined in the mock

### Tautological / duplicate

- [x] delete: `handler.test.ts:284`, `feed.test.ts:558` + `:406`, `backfill.test.ts:160`, `manual-drop.test.ts:216`, `localize.test.ts:432` + `:553`, `engine.test.ts:3644`, `downloader.test.ts:168` + `:462`
- [x] delete parser duplicates: `:231`, `:487`, `:210`, `:889`, `:901`, `:1385`
- [x] rewrite: `handler.test.ts:218` (function vs itself), `transforms.test.ts:1164` (recomputes impl regex), `pipeline.test.ts:638` (asserts mock return)
- [x] retitle: `engine.test.ts:3976`, `writer.test.ts:838` + `:1355`, `cadence.test.ts:115`, `transforms.test.ts:1278`

### Coupled to live config, not behavior

- [x] `downloader.test.ts:605,632,670` load real `mv-caa` / `sg-caas` / `hu-kh` YAML
- [x] `loader.test.ts` lines 20-31, 55-72, 131-140, 191, 680, 811-826, 904 pin live `sources/*.yaml` values
- [x] `pipeline.test.ts:904` hard-codes `lt-tka`
- [x] `engine.test.ts:4389` pins `allowed_missing_source_id_rows.max === 3`

### Missing cases worth adding

- [x] `iso_year_or_null`, `foca_operator_country`: no tests
- [x] `isArtifactCaughtUp`: `<=` boundary, null header, null state, schema mismatch
- [x] new `tests/registration.test.ts`, `tests/recency.test.ts`
- [x] `schema.ts`: enum rejection, `status` null / `reserved`, `.int()` rules, `CANONICAL_PATHS`
- [x] PDF loader guards: duplicate `field_axis`, all-null `column_pos`, length mismatch, `anchor_field` not in columns
- [x] `retry.ts`: backoff doubling, `baseDelayMs: 0`, no sleep / onRetry on non-retryable
- [x] `downloader.ts`: prime failure, cross-origin cookie, POST + cookie, 429 / 408 / 403, threshold - 1
- [x] `gemini-client`: `onChunkTranslated` contract, persistent 503 exhausting retries
- [x] `mapSnapshots`: join path, empty file, `record_count` against mapped
- [x] `pipeline.ts`: `escapeCell`, `GITHUB_STEP_SUMMARY`, `allowPrune=true`, `resolveFeedOutputPath('.')`
- [x] `requireEnv`, `readPositiveIntegerEnv('')`, `errorMessage` non-Error

### Isolation

- [x] `pipeline.test.ts:157-223` snapshot and restore `process.env`; scrub `GITHUB_STEP_SUMMARY`
- [x] `pipeline.test.ts:1350` restore `process.exit` in `try/finally`

### Decisions

- `int_or_null` keeps accepting a negative: the schema rejects it loudly, and nulling would hide corrupt upstream data
- `tests/service/handler.test.ts` and the `loader.test.ts` smoke test are the only tests that read live `sources/*.yaml`
