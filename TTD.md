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
- [ ] Run the `lt-tka` backfill once, after the first schema-14 refresh and over the VPN: `make build`, then `BACKFILL_SOURCE=lt-tka DRY_RUN=true bun run dist/backfill-history.js` with `.env` loaded, then again without `DRY_RUN`. It replays the clean publications through the live merge, skips the double-loaded 2025-04-29 and 2025-06-10 loads, and refuses an artifact that already has closed rows.
