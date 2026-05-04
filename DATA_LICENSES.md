# Data Licenses

Per-source license, classification, and permission status for every registry handled by `metal-birds-feed`. Update this file whenever a new source is added or its license posture changes.

License classification (per PRD CC.1):

- **Open** — public domain, OGL, CC BY (no NC). No usage restriction beyond attribution.
- **Personal-use** — CC BY-NC, "personal use only" terms. Operator-private R2 only; operator deployment must remain non-commercial (PRD CC.3).
- **Restrictive** — paid, single-PC, no-redistribute, or active denial. Excluded from the project.
- **Unknown** — pending license research and/or permission-email reply. Not slotted.

Permission protocol (per PRD CC.2): Personal-use and Unknown sources require an email to the agency before slotting. Reply preserved verbatim below. If no reply within 30 calendar days from the send date, the source proceeds on the public-record argument and any later removal request is honored.

---

## FAA — US Federal Aviation Administration

- **Status:** ✅ Live (v1)
- **Classification:** Open
- **Source URL:** https://registry.faa.gov/aircraftinquiry/Search/NNumberInquiry
- **Bulk download:** Monthly ZIP (MASTER.txt, ACFTREF.txt, ENGINE.txt)
- **License:** US Government work — public domain (17 U.S.C. § 105)
- **Attribution:** Not legally required. Credited here as a courtesy.
- **Update cadence:** Monthly
- **Permission email:** N/A (Open)

---

## Transport Canada (TC-CA)

- **Status:** ✅ Live (v2)
- **Classification:** Open
- **Bulk download URL:** https://wwwapps.tc.gc.ca/saf-sec-sur/2/ccarcs-riacc/download/ccarcsdb.zip
- **Search interface:** https://wwwapps.tc.gc.ca/saf-sec-sur/2/ccarcs-riacc/RchSimp.aspx
- **Bulk archive:** ZIP containing `carscurr.txt` (current marks + aircraft), `carsownr.txt` (owners, joined by mark), and `carslayout.txt` (column layout). ASCII (latin1), comma-separated, double-quote delimited. No header row.
- **License:** Open Government Licence — Canada (https://open.canada.ca/en/open-government-licence-canada)
- **Attribution required:** Yes. Per OGL-Canada: include the OGL notice and acknowledge the Government of Canada as the source.
- **Update cadence:** Monthly (file `Last-Modified` typically the 1st of the month).
- **Permission email:** N/A (Open)
- **PII dropped at ingest:** street1/street2/city/postal-code/care-of fields in `carsownr.txt` are not mapped or stored. Owner records expose name, kind, province (state-equivalent), and country only.
- **Field-coverage gaps vs. canonical schema:** these stay null for TC records — `category`, `build_certification`, `operating_environment`, `icao_type_code`, `year_manufactured`, `cruise_speed_ktas`, `engine.model`, `engine.horsepower`, `engine.thrust_lbs`. `airframe_type` is null for `Aeroplane` rows that lack a usable `NUMBER_OF_ENGINES` value.

---

## ILT — Netherlands Human Environment and Transport Inspectorate

- **Status:** Planned (v3) — no permission email needed
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

---

## CAA NZ — Civil Aviation Authority of New Zealand

- **Status:** Planned (v3) — pending CC.2 permission email
- **Classification:** Personal-use
- **Source URL:** https://www.aviation.govt.nz/aircraft/aircraft-registration/aircraft-register-search/
- **Bulk download URL:** https://www.aviation.govt.nz/assets/aircraft/aircraft-register/Aircraft-Register-for-website-.csv
- **License:** All rights reserved with personal-use exception. Per https://www.aviation.govt.nz/about-us/website-information/copyright/: "the information available on or through this website is protected by copyright"; personal reproduction permitted with attribution; commercial / redistribution / derived datasets require written permission to info@caa.govt.nz. CAA NZ has not adopted NZGOAL for site content.
- **Attribution required:** Yes. "Source: Civil Aviation Authority of New Zealand — https://www.aviation.govt.nz/aircraft/aircraft-registration/aircraft-register-search/"
- **Update cadence:** Per file date stamps; effectively continuous-to-weekly.
- **Permission email:** Not yet sent. Recipient: info@caa.govt.nz. Template: `docs/agency-permission-request.md`. Send-date and 30-day expiry to be recorded here once sent.
- **Reply (verbatim):** _pending_

---

## CASA — Civil Aviation Safety Authority of Australia

- **Status:** Planned (Future R4.1) — pending CC.2 permission email
- **Classification:** Personal-use
- **Source URL:** https://www.casa.gov.au/aircraft/aircraft-registration/data-files-registered-aircraft
- **Bulk download URL:** https://services.casa.gov.au/CSV/acrftreg.csv (also `acrftreg.zip`)
- **License:** Creative Commons Attribution — Non-Commercial 4.0 International (CC BY-NC 4.0). Per https://www.casa.gov.au/about-us/about-website/copyright. Non-commercial restriction is litigation-prone in derived-data contexts; redistribution under operator-private R2 to a non-commercial consumer is the assumed safe position.
- **Attribution required:** Yes. "Source: Civil Aviation Safety Authority — https://www.casa.gov.au/aircraft/aircraft-registration/data-files-registered-aircraft"
- **Update cadence:** Per file date stamps (typically daily refresh).
- **Permission email:** Not yet sent. Recipient: TBD (likely the contact form on casa.gov.au; will be recorded here on send). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## IAA — Irish Aviation Authority

- **Status:** Planned (Future R4.2) — pending CC.1 license classification
- **Classification:** Unknown
- **Source URL:** https://www.iaa.ie/general-aviation/aircraft-registration-leasing/current-aircraft-register-and-monthly-changes/current-aircraft-register-and-monthly-changes-details-page
- **Bulk download URL:** Monthly XLSX, URL pattern not yet captured.
- **License:** Pending verification. EU PSI directive likely applies; specific IAA terms unverified.
- **Update cadence:** Monthly.
- **Permission email:** Not yet sent.
- **Reply (verbatim):** _pending_

---

## GCAA — Georgian Civil Aviation Agency

- **Status:** Planned (v4) — blocked on R3.1 data-source acquisition research
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
