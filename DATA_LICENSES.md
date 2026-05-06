# Data Licenses

Per-source license, classification, and permission status for every registry handled by `metal-birds-feed`. Update this file whenever a new source is added or its license posture changes.

---

## metal-birds-feed itself

- **Project:** metal-birds-feed
- **Maintainer:** Ashley Childress (anchildress1@gmail.com)
- **Repository:** https://github.com/anchildress1/metal-birds-feed
- **Source license:** Polyform Shield 1.0.0 + Supplemental Terms — see [`LICENSE`](LICENSE) at repo root.
- **Distribution model:** source-available code; operator-private R2; no public read API.
- **Operator deployment posture:** non-commercial. The project as a whole inherits the most restrictive condition across all bundled sources, and several upstream sources (e.g. CAA NZ Personal-use) forbid commercial redistribution without separate written permission.

### What a fork must do

If you fork metal-birds-feed and run it against your own R2 bucket:

1. Comply with Polyform Shield 1.0.0 + Supplemental Terms for the source code itself.
2. Re-verify each upstream source's license at the time of your run. Government policies change; the verified-on dates in the entries below are snapshots, not guarantees.
3. Independently comply with every upstream source's attribution, conditions, and restrictions. Click-wrap acceptances (e.g. Transport Canada's Open Data Licence Agreement) are between **your** operator and the source — they are not delegated through metal-birds-feed.
4. Keep operator-private R2 for any source classified as Personal-use or otherwise non-commercial, or separately re-license that source for whatever your deployment requires.
5. Do not strip attribution from this `DATA_LICENSES.md` (or your fork's equivalent of it).
6. Do not deploy commercially without separately re-licensing each upstream source under terms that permit commercial use. Several sources documented below explicitly forbid that without a fresh written permission from the issuing agency.

### Attribution to metal-birds-feed (for downstream consumers)

Downstream applications that consume the normalized data should include the following attribution wherever the data is exposed or surfaced:

> Aircraft register data normalized by metal-birds-feed (https://github.com/anchildress1/metal-birds-feed). Per-source attribution preserved in metal-birds-feed's `DATA_LICENSES.md`.

This attribution does **not** relieve the downstream of complying with each upstream source's own attribution and license requirements (Transport Canada's verbatim §4.1 / §4.2 notices, CASA's CC BY 4.0 conditions, etc.). Those flow through.

---

## Upstream source licenses

License classification (per PRD CC.1):

- **Open** — public domain, OGL, CC BY (no NC). No usage restriction beyond attribution.
- **Personal-use** — CC BY-NC, "personal use only" terms. Operator-private R2 only; operator deployment must remain non-commercial (PRD CC.3).
- **Restrictive** — paid, single-PC, no-redistribute, or active denial. Excluded from the project.
- **Unknown** — pending license research and/or permission-email reply. Not slotted.

Permission protocol (per PRD CC.2): Personal-use and Unknown sources require an email to the agency before slotting. Reply preserved verbatim below.

The 30-day silence fallback only applies to **Unknown** classifications, where there is no explicit license statement on the source's website and the public-record argument (aviation registration is statutorily public under ICAO Annex 7 and equivalent national law) carries weight. After 30 days of no reply, an Unknown source proceeds with prominent attribution and a documented date-of-decision; any later removal request is honored.

The 30-day fallback does **not** apply to **Personal-use** sources, where the agency has made an explicit license claim that excludes redistribution. Silence from a Personal-use source is not implicit permission — the agency has already said no by default. Personal-use sources cannot be slotted without an affirmative reply. If no reply arrives, the next step is a follow-up email at 30 days, then either further patience or dropping the source.

---

## FAA — US Federal Aviation Administration

- **Status:** ✅ Live (phase 1)
- **Classification:** Open
- **Source URL:** https://registry.faa.gov/aircraftinquiry/
- **Bulk download URL:** https://www.faa.gov/licenses_certificates/aircraft_certification/aircraft_registry/releasable_aircraft_download/ (Releasable Aircraft Database page; links to the monthly ZIP)
- **Bulk archive:** ZIP containing MASTER.txt (currently registered aircraft — N-number, owner, MFR/MDL codes, dates, MODE S HEX, status), ACFTREF.txt (manufacturer/model reference, joined via MFR-MDL-CODE), ENGINE.txt (engine reference, joined via ENG-MFR-MDL), and DEREG.txt (deregistered aircraft history). Fixed-width text files, ASCII.
- **License:** US Federal Government work — public domain under [17 U.S.C. § 105](https://www.law.cornell.edu/uscode/text/17/105). No copyright vests in works of the US Government, so the data is freely reproducible, distributable, modifiable, and commercially usable without permission or restriction.
- **Attribution required:** Not legally required. metal-birds-feed credits the FAA as a courtesy in the project README's Attribution section and here in `DATA_LICENSES.md`. Forks may do likewise but are not obligated.
- **Update cadence:** Monthly. The FAA publishes a fresh ZIP roughly the first week of each month.
- **Permission email:** N/A (public domain).
- **Reply (verbatim):** N/A
- **PII dropped at ingest:** street1, street2, city, postal-code, county, region (FAA region code), and care-of fields in MASTER.txt are not mapped or stored. Owner records expose `name`, `kind` (TYPE REGISTRANT decoded), `state` (STATE), and `country` only. Owner residential address is intentionally excluded even though the FAA publishes it as part of the public registry record — see PRD's PII section and AGENTS.md.
- **`source_id` mapping:** FAA's UNIQUE ID column is used as `source_id`, not the N-NUMBER. N-numbers can be reissued to different aircraft over time; UNIQUE ID is the durable per-record identifier.
- **Field-coverage gaps vs. canonical schema:** FAA has the most complete coverage of any source — all canonical fields are populated where the FAA record provides them. Some legacy or kit-built records have null `engine_type`, `year_manufactured`, or `seats`; null is preserved (never invented).

---

## Transport Canada (TC-CA)

- **Status:** ✅ Live (phase 2)
- **Classification:** Open (with conditions — see below)
- **Bulk download URL:** https://wwwapps.tc.gc.ca/saf-sec-sur/2/ccarcs-riacc/download/ccarcsdb.zip
- **Search interface:** https://wwwapps.tc.gc.ca/saf-sec-sur/2/ccarcs-riacc/RchSimp.aspx
- **Bulk archive:** ZIP containing `carscurr.txt` (current marks + aircraft), `carsownr.txt` (owners, joined by mark), and `carslayout.txt` (column layout). ASCII (latin1), comma-separated, double-quote delimited. No header row.
- **License:** Government of Canada Open Data Licence Agreement for Unrestricted Use of Canada's Data. Click-wrap: by downloading or otherwise using the data, the operator acknowledges acceptance. License URL: https://wwwapps.tc.gc.ca/Saf-Sec-Sur/2/CCARCS-RIACC/DDZip.aspx
- **License posture:** Royalty-free, non-exclusive, worldwide, non-assignable licence to use, reproduce, extract, modify, translate, further develop, distribute, manufacture Value-Added Products, and sublicence those rights. Substantively Open — the conditions below are procedural.
- **Conditions to comply with:**
  - **Reproduction notice (verbatim, per §4.1):** _"Reproduced and distributed with the permission of the Government of Canada."_ Include on all reproductions of the data.
  - **Value-Added Product notice (verbatim, per §4.2):** _"This product has been produced by or for Ashley Childress and includes data provided by the Government of Canada. The incorporation of data sourced from the Government of Canada within this product shall not be construed as constituting an endorsement by the Government of Canada of our product."_ Required because metal-birds-feed's normalized canonical records constitute a Value-Added Product under §1.6.
  - **No insignia in promotion (§4.3):** Do not use the name, crest, logos, flags, insignia, or domain names of Canada in any promotion or advertisement of the project or its outputs. No annotations implying endorsement.
  - **Privacy / no-identity-merge clause (§3.1.d, second part):** Do not merge or link Transport Canada data with any other product or database for the purpose of identifying an individual, family, household, organization, or business. The PII drop at ingest (see below) directly addresses this; do not relax it without a license re-read.
  - **No reverse-engineering (§3.1.d, first part):** Do not disassemble, decompile (except for software-compatibility recompilation), or reverse-engineer the data. Trivial for a CSV but called out for completeness.
  - **Infringement notice (§5.1):** If the operator becomes aware of third-party infringement of the data, notify Canada and cooperate with enforcement; do not litigate independently.
  - **No exclusive-arrangement claim (§5.2):** Do not represent metal-birds-feed as having an exclusive distribution arrangement with Canada or as having privileged access.
  - **No reputational harm (§5.3):** Do not use the data in any way that, in Canada's opinion, brings disrepute or prejudice to Canada.
  - **Warranty / liability (§§6.1–6.3):** Canada provides the data as-is with no warranty as to accuracy, completeness, or fitness for purpose. The operator has no recourse against Canada for any loss arising from use. The operator indemnifies Canada and its ministers, employees, and agents from claims arising from the operator's use of the data.
  - **Termination (§7.2):** Rights under §3 terminate automatically upon any breach of the agreement.
  - **Governing law (§8.1):** Province of Ontario and federal laws of Canada.
- **Attribution implementation in the project:** Notices §4.1 and §4.2 are reproduced verbatim in this `DATA_LICENSES.md` entry, which is shipped with every fork of the source. Forks self-host their own R2 against their own license assessment per the project's distribution model — they are bound by the same click-wrap acceptance when they download from Transport Canada.
- **Update cadence:** Monthly (file `Last-Modified` typically the 1st of the month).
- **Permission email:** N/A (Open with conditions; license accepted by click-wrap on download).
- **PII dropped at ingest:** `street1`, `street2`, `city`, `postal-code`, and `care-of` fields in `carsownr.txt` are not mapped or stored. Owner records expose `name`, `kind`, `province` (state-equivalent), and `country` only. This satisfies §3.1.d's no-identity-merge clause by ensuring the canonical record cannot be joined against external person-identifying datasets at the address level.
- **Field-coverage gaps vs. canonical schema:** these stay null for TC records — `category`, `build_certification`, `operating_environment`, `icao_type_code`, `year_manufactured`, `cruise_speed_ktas`, `engine.model`, `engine.horsepower`, `engine.thrust_lbs`. `airframe_type` is null for `Aeroplane` rows that lack a usable `NUMBER_OF_ENGINES` value.

---

## ILT — Netherlands Human Environment and Transport Inspectorate

- **Status:** ✅ Live (phase 3, NL track) — no permission email needed
- **Classification:** Open
- **Source URL:** https://www.ilent.nl/documenten/lijsten/luchtvaart/databestanden/luchtvaartregister-data
- **Open-data listing:** https://data.overheid.nl/dataset/luchtvaartuigregister
- **Bulk download URL:** Date-stamped filename on `ilent.nl` (e.g. `https://www.ilent.nl/site/binaries/site-content/collections/documents/lijsten/luchtvaart/databestanden/luchtvaartregister-data/luchtvaartuigregister-ilt-datas2-2026-04-28.ods`). The filename rolls each refresh; the downloader resolves it via `download.discover_url:` per PRD R2.7.
- **Format:** OpenDocument Spreadsheet (`.ods`), ~1.23 MB. Engine reads via the spreadsheet parser path (PRD R2.6).
- **License:** **CC-0 1.0 Universal (public domain)** per data.overheid.nl. The page disclaimer "Aan deze gegevens kunnen geen rechten worden ontleend" ("no rights can be derived from this data") is a quality-of-data disclaimer, not a license restriction — CC-0 stands.
- **Attribution required:** Not legally required under CC-0. Credited here as a courtesy.
- **Update cadence:** Per file date stamp; effectively continuous-to-monthly. ILT does not publish a fixed schedule.
- **Permission email:** N/A (Open). The CC-0 license predates any project-specific request.
- **Reply (verbatim):** N/A
- **Note on transition:** Aviation certification services moved from Kiwa Register to CAA NL on 2025-06-01. Register publication remains with ILT. If publication moves to caanl.nl in the future, this entry's URLs need re-verification but the CC-0 classification should carry over.
- **PII dropped at ingest:** ILT does not publish owner identity in the bulk register (privacy policy). Owner `name`, `kind`, and `state` are all null in canonical records; `country` is the constant `NL` since this is the Dutch register. No PII appears in the source so no drop is required at the mapping layer.
- **Field-coverage gaps vs. canonical schema:** these stay null for ILT records — `category`, `build_certification`, `operating_environment`, `cruise_speed_ktas`, `engine.horsepower`, `engine.thrust_lbs`. `operational_classes` is always an empty array. `airframe_type` is null for the `Drones` group (canonical schema does not have a UAV enum) and for any record where the `Group` value is unrecognized or the engine count is missing for an aeroplane / MLA.
- **Sheet structure quirks:** the bulk file contains 20 sheets; only the first sheet (`CivilACRegisterNether<DATE>`) holds aircraft data. The first data row in that sheet is an "Information" banner, not a record — the source config skips it via `nl_ilt_registration_or_null` + `allowed_missing_source_id_rows`. Headers in the file are annotated with bracket-suffix metadata; the source config supplies clean column names via `columns:` and discards the file's own header row via `skip_rows: 1`.

---

## CAA NZ — Civil Aviation Authority of New Zealand

- **Status:** Planned (phase 3, NZ track) — permission request sent, awaiting reply
- **Classification:** Personal-use
- **Source URL:** https://www.aviation.govt.nz/aircraft/aircraft-registration/aircraft-register-search/
- **Bulk download URL:** https://www.aviation.govt.nz/assets/aircraft/aircraft-register/Aircraft-Register-for-website-.csv
- **License:** All rights reserved with personal-use exception. Per https://www.aviation.govt.nz/about-us/website-information/copyright/: "the information available on or through this website is protected by copyright"; personal reproduction permitted with attribution; commercial / redistribution / derived datasets require written permission to info@caa.govt.nz. CAA NZ has not adopted NZGOAL for site content.
- **Attribution required:** Yes. "Source: Civil Aviation Authority of New Zealand — https://www.aviation.govt.nz/aircraft/aircraft-registration/aircraft-register-search/"
- **Update cadence:** Per file date stamps; effectively continuous-to-weekly.
- **Permission email:** Sent 2026-05-05 to `info@caa.govt.nz` (cc: `aircraftregistrar@caa.govt.nz`). Follow-up due 2026-06-04 if no reply by then. **The 30-day fallback does not apply** — CAA NZ is Personal-use (explicit "must ask" rule), so silence is not permission. If no reply, the next step is a follow-up email, not slotting. Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## CASA — Civil Aviation Safety Authority of Australia

- **Status:** Planned (Future R4.1) — no email needed (Open)
- **Classification:** Open
- **Source URL:** https://www.casa.gov.au/aircraft/aircraft-registration/data-files-registered-aircraft
- **Bulk download URL:** https://services.casa.gov.au/CSV/acrftreg.csv (also `acrftreg.zip`)
- **Lookup / search interface:** https://www.casa.gov.au/search-centre/aircraft-register
- **License (both surfaces):** Creative Commons Attribution 4.0 International (CC BY 4.0). Per https://www.casa.gov.au/about-us/about-website/copyright (verified 2026-05-05): _"We own all the material we produce. With the exceptions noted below, we provide all material on this website under a Creative Commons Attribution 4.0 International Licence. This licence (the CC BY 4.0 Licence) allows you to share and adapt content for any purpose."_ Both the bulk CSV download (served at services.casa.gov.au, but linked from and described on casa.gov.au) and the search interface inherit this default — neither page carries an opt-out notice.
- **Excluded material (not applicable to register data):** Commonwealth Coat of Arms, CASA logo, third-party content, and "material specifically noted as not being licensed under the CC BY 4.0 licence." The aircraft register data files page carries no such opt-out notice.
- **Note on the CC BY-NC variant:** Some specific CASA publications (flight crew licensing manuals, certain technical guides distributed as standalone PDFs) carry CC BY-NC 4.0 in their document footers. This does **not** extend to the aircraft register data files; the register surfaces inherit the website-default CC BY 4.0. Do not conflate the two surfaces — the publication-level CC BY-NC is per-document, not site-wide.
- **Attribution required:** Yes. Per CC BY 4.0: "Source: Civil Aviation Safety Authority — https://www.casa.gov.au/aircraft/aircraft-registration/data-files-registered-aircraft", with a link to the CC BY 4.0 license at https://creativecommons.org/licenses/by/4.0/, and an indication that the material has been changed (the engine normalizes it; do not phrase attribution as endorsement).
- **Update cadence:** Per file date stamps (typically daily refresh).
- **Permission email:** N/A (Open).
- **Reply (verbatim):** N/A
- **Reclassification note (2026-05-05):** Previously classified Personal-use (CC BY-NC 4.0) on a cautious reading of the casa.gov.au copyright page. Re-research differentiating bulk vs. lookup surfaces confirms both are CC BY 4.0 — the BY-NC variant exists only on certain unrelated CASA PDFs (training manuals, etc.) where it is declared per-document. Reclassified to Open.

---

## IAA — Irish Aviation Authority

- **Status:** Planned (Future R4.2) — permission request sent, awaiting reply (license classification will be determined by reply or 30-day fallback)
- **Classification:** Unknown
- **Source URL:** https://www.iaa.ie/general-aviation/aircraft-registration-leasing/current-aircraft-register-and-monthly-changes/current-aircraft-register-and-monthly-changes-details-page
- **Bulk download URL:** Monthly XLSX served via the MySRS portal (https://iaa.mysrs.ie) since October 2025. URL pattern not yet captured (portal sign-up required).
- **License:** Pending verification. No public license statement on iaa.ie; MySRS Terms and Conditions are behind portal sign-up. EU PSI directive likely applies in principle; specific IAA terms unverified.
- **Update cadence:** Monthly.
- **Permission email:** Sent 2026-05-05 to `registration@iaa.ie`. Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** if still no reply — IAA is Unknown classification (no public license statement on iaa.ie; MySRS T&Cs unreviewable from outside) per PRD CC.2. Email asks specifically about (a) redistribution permission, (b) MySRS bulk-download policy, (c) authorized programmatic-access mechanism, and (d) preferred attribution text. Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## GCAA — Georgian Civil Aviation Agency

- **Status:** Planned (phase 4) — blocked on R3.1 data-source acquisition research
- **Classification:** Unknown
- **Source URL:** https://www.gcaa.ge (data accessibility TBD)
- **License:** Unknown — to be determined during R3.1 research milestone.
- **Update cadence:** Unknown.
- **Permission email:** Not yet sent. Recipient (when ready): office@gcaa.ge. Send the Georgian translation of `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## UK CAA — Excluded

- **Status:** ❌ Excluded (Future / Blocked)
- **Classification:** Restrictive
- **Source URL:** https://www.caa.co.uk/aircraft-register/g-info/
- **License:** Proprietary CAA copyright + database right. Bulk product (G-INFO, MS Excel) is paid (£450 single issue, £745/yr quarterly, £1,745/yr monthly) under a single-PC license that explicitly forbids copying, distribution, sale, or hire without written CAA consent. Per https://www.caa.co.uk/Aircraft-register/G-INFO/G-INFO-Forms-and-Fees/.
- **Why excluded:** The single-PC clause is incompatible with R2 storage even for purely operator-private use. The no-redistribution clause is incompatible with source-available code that another fork might run. Under PRD CC.1 (Restrictive), no usable deployment shape exists.
- **Revisit condition:** CAA changes the licensing terms — for example, if G-INFO is re-released under OGL-UK or any redistributable license.
