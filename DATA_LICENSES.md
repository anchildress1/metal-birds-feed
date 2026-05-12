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

- **Status:** ✅ Live (phase 4) — shipped 2026-05-08
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
- **Field-coverage gaps (`null`-rather-than-invent per PRD R2.5 / R4.1):** CASA's CSV does not publish: Mode-S hex (`icao_hex`), Certificate of Airworthiness date (`airworthiness_date` — only the C of A _category_ via `CoAcata`), aircraft category enum (`category`), build certification, operating environment, engine horsepower / thrust, owner kind, operator kind, cruise speed. CASA does publish ICAO type designator (`ICAOtypedesig` → `icao_type_code`), which solves part of the FAA-side Open Question.
- **Canonical schema additions driven by CASA:** This source first surfaced an explicit `regopName` separate from `regholdname`, plus the Cape Town Convention `IDERA_Authorised_Party` field. Both were added to the canonical schema (`operator: { name, kind, state, country }`, `idera_authorised_party: string | null`) rather than dropped at the mapping config — see AGENTS.md "no silent loss of upstream information."

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

## AESA — Spanish State Aviation Safety Agency (Agencia Estatal de Seguridad Aérea)

- **Status:** 🛠️ Cleared — implementation pending (license cleared via AESA portal Legal Notice; PDF parser path needed before ingest)
- **Classification:** **Open** with attribution (verified 2026-05-10 from AESA portal Legal Notice; reclassified from Unknown)
- **Source URL:** https://www.seguridadaerea.gob.es/en/ambitos/aeronaves/registro-de-matriculas-de-aeronaves-civiles/registro-de-matriculas
- **Bulk download URL:** https://www.seguridadaerea.gob.es/sites/default/files/aeronaves_inscritas.pdf (direct PDF, 1.78 MB, 314 pages, A4; document title: "Matrículas Activas a 1 de mayo de 2026"; server `Last-Modified: 2026-05-05`; document classification stamp: "INFORMACIÓN PÚBLICA"; `Total Matrículas: 5531` per PDF footer, verified by independent grep — 5,531 unique EC- registrations, clean count). Refresh cadence: **monthly, dated 1st of month, published ~4 days later**.
- **License:** **Open with attribution.** Per the [AESA portal Legal Notice](https://www.seguridadaerea.gob.es/en/politica-de-privacidad-y-aviso-legal), verbatim (re-verified 2026-05-11): _"The total or partial reproduction of the contents published on the portal is prohibited, unless the source of origin is cited. However, the contents that are considered as open data at the Electronic Headquarters may be reproduced, in accordance with the provisions of Royal Decree 1495/2011, of October 24, on the development of Law 37/2007, on the reuse of public sector information, for the public sector."_ Functionally CC BY 4.0-equivalent: source citation is mandatory; the open-data subset layers Spain's PSI Directive implementation (Aporta framework) on top. **License-text drift note (re-verified 2026-05-11):** the original 2026-05-10 record was missing the trailing `, for the public sector` qualifier — added above. Substantive permission unchanged; addition just makes explicit that the regulation governs reuse for/within the public sector context. Adjacent section invokes Royal Decree 203/2021 (Article 12, public-sector electronic-means framework) regarding AESA's role as authoritative for "Electronic Headquarters" content integrity, veracity, and updating — additional governance context, no change to redistribution permission.
- **Update cadence:** Monthly, file dated 1st of month, server-published ~4 days later (e.g. file dated 1 May 2026, server `Last-Modified: 2026-05-05`). Predictable refresh.
- **Format note (engineering):** Bulk file is **PDF**, not CSV/XLSX. 314-page cell-layout PDF; pdftotext linearizes each cell to one line, so the parser needs to be stateful (key on `EC-` prefix to start a new record, consume next N cells as columns). Column structure: Matrícula → Fecha matric. → Fabricante → Modelo → Nº serie → Año cons. → Marca Motor → Modelo Motor → Nº mot. → Clase. Junk to filter: `Página X de 314` page numbers + ministry header + `Total Matrículas:` summary line. Encoding: UTF-8, significant Spanish diacritics (442 ñ/Ñ + 2716 accented vowels — parser must round-trip cleanly). Engine currently handles csv/ods/xlsx; PDF parsing is a new format adapter. Ingest blocked on parser, not on license. **Shared parser-path requirement with CAA Maldives** — same PDF infrastructure, different layout schemas; both unlock together.
- **Permission email:** Sent 2026-05-05 to `rmac.aesa@seguridadaerea.es`. **Reply no longer gates use** — license already cleared via the portal Legal Notice. Email stands as a courtesy / relationship gesture; not waiting on it.
- **Reply (verbatim):** _pending_

### Required attribution (verbatim, place in README Attribution section)

> Source: AESA — Agencia Estatal de Seguridad Aérea — https://www.seguridadaerea.gob.es/en/ambitos/aeronaves/registro-de-matriculas-de-aeronaves-civiles/registro-de-matriculas
>
> Reproduced with attribution per the AESA portal Legal Notice and Royal Decree 1495/2011 of October 24 (development of Law 37/2007 on the reuse of public sector information, for the public sector). Material has been changed: AESA aircraft records are normalized into metal-birds-feed's canonical schema. This attribution does not imply endorsement by AESA.

---

## ANAC Argentina — Argentine National Civil Aviation Administration (Administración Nacional de Aviación Civil)

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://geo.anac.gob.ar/afectacion
- **Bulk download URL:** TBD (search-only interface; bulk pattern unverified pending reply)
- **License:** Pending verification. Argentina has a national open-data policy via datos.gob.ar; ANAC-specific terms unverified.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-05 to `registro@anac.gob.ar`. Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## ANAC Brasil — Brazilian National Civil Aviation Agency (Agência Nacional de Aviação Civil)

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://sistemas.anac.gov.br/aeronaves/cons_rab.asp
- **Bulk download URL:** TBD (search-only interface; bulk pattern unverified pending reply)
- **License:** Pending verification. Brazilian public-sector data is generally reusable under the Lei de Acesso à Informação framework; ANAC-specific terms unverified.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-05 to `rab@anac.gov.br`. Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## DGAC France — French Directorate General of Civil Aviation (Direction Générale de l'Aviation Civile)

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** **Personal-use** (verified 2026-05-05 from explicit register-page disclaimer; reclassified from Unknown)
- **Source URL:** https://immat.aviation-civile.gouv.fr/immat/servlet/aeronef_liste.html
- **Bulk download URL:** https://immat.aviation-civile.gouv.fr/immat/servlet/static/upload/export.csv (direct CSV, no auth required, updated monthly on the 1st)
- **License:** **Personal-use only.** Per the register page (verified 2026-05-05, verbatim French): _"Les données du registre ne sont communiquées sur internet qu'à titre de simple information. Pour toute utilisation officielle, il convient de demander au fonctionnaire chargé de la tenue du registre un extrait du registre dûment signé."_ Translation: "The register data is communicated on the internet only for informational purposes. For any official use, you must request a duly signed extract of the register from the official in charge of the register." Paid extract product at https://redevances.aviation-civile.gouv.fr (€6/extract) is the channel for any non-informational use. Same structural shape as CAA NZ — informational/personal use is permitted, anything else requires explicit permission OR going through the paid extract.
- **Update cadence:** Monthly (CSV regenerated on the 1st of each month per the register page itself).
- **Permission email:** Sent 2026-05-05 to `immat@aviation-civile.gouv.fr`. Follow-up due 2026-06-04 if no reply by then. **The 30-day fallback does NOT apply** — DGAC France is Personal-use (explicit "for informational purposes only" rule), so silence is not permission. If no reply, the next step is a follow-up email, not slotting. Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_
- **PII pre-handling at source (good news for our pipeline):** Per the register page, DGAC already strips owner addresses, deregistered-aircraft owner info, and historical owner/operator/creditor data per GDPR. This means France records arrive partially PII-cleaned, reducing the engineering work for our PII drop layer. The remaining drop list (street/city/postal/care-of for current owners that DGAC does still publish) follows the standard PRD CC.4 policy.

---

## ENAC — Italian Civil Aviation Authority (Ente Nazionale per l'Aviazione Civile)

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration found despite portal hunt)
- **Source URL:** https://www.enac.gov.it/sicurezza-aerea/aeronavigabilita-iniziale/registro-aeromobili/
- **Bulk download URL:** **None published.** Recon 2026-05-10 confirmed no CSV/PDF/JSON dump anywhere on `enac.gov.it` or `dati.mit.gov.it`. The register is governed by Codice della Navigazione + Codice Civile — access is per-record via formal "visure" extracts (paid procedure under Italian Civil Code rules). A yes-reply from ENAC must clear **both** license and a bulk access channel (FTP, direct dump, FOI, or similar) before ingest is feasible.
- **License:** Pending verification. ENAC publishes other datasets on `dati.mit.gov.it` under [CC BY (Creative Commons Attribuzione)](https://dati.mit.gov.it/catalog/dataset/?organization=enac) — specifically "Imprese titolari di licenza di trasporto aereo" and "Elenco Organizzazioni Registrate per l'addestramento al volo" — but the aircraft register is **deliberately excluded**. Pattern matches Switzerland FOCA: agency publishes some open data, withholds the register specifically. [IODL 2.0](https://www.dati.gov.it/iodl/2.0/) is the Italian open-data license framework but does not apply absent an explicit ENAC declaration on the register.
- **Update cadence:** TBD (no published artifact has a refresh schedule)
- **Permission email:** Sent 2026-05-05 to `registro.aeromobili@enac.gov.it`. Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## FOCA / BAZL — Swiss Federal Office of Civil Aviation (Bundesamt für Zivilluftfahrt)

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** **Personal-use** (verified 2026-05-10 from Swiss Federal Council site-wide Terms and Conditions; reclassified from Unknown)
- **Source URL:** https://app02.bazl.admin.ch/web/bazl/en/#/lfr/search
- **Bulk download URL:** Search app supports CSV export; direct bulk endpoint unverified (the register is **not** published on `opendata.swiss` despite BAZL publishing other datasets there)
- **License:** **Personal-use only.** Per the [Swiss Federal Council Terms and Conditions](https://www.admin.ch/gov/en/start/terms-and-conditions.html) (site-wide policy covering all `*.admin.ch` domains, including `bazl.admin.ch` and `app02.bazl.admin.ch`), verbatim: _"Copyright and any other rights relating to texts, illustrations, photos or any other data available on the Federal authorities' websites are the exclusive property of the federal authorities or of any other expressly mentioned owners. Any reproduction requires the prior written consent of the copyright holder."_ The register is also governed by the [Bundesgesetz über das Luftfahrzeugbuch](https://www.fedlex.admin.ch/eli/cc/1960/1245_1301_1297/de) (Federal Act on the Aircraft Register), separate from open-data rules. BAZL deliberately publishes other datasets (noise pollution, drone zones, aerodromes) on `opendata.swiss` with explicit Open licenses while omitting the aircraft register — a choice, not an oversight.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-05 to `aircraftregistry@bazl.admin.ch`. Follow-up due 2026-06-04 if no reply by then. **The 30-day fallback does NOT apply** — FOCA is Personal-use; silence ≠ permission, must wait for affirmative reply. Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## Luftfartstilsynet — Civil Aviation Authority of Norway

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — `data.norge.no` dataset listed with **"Public access"** tag but the **License field is empty**; no explicit license declaration found, so we cannot claim NLOD without confirmation)
- **Source URL:** https://luftfartstilsynet.no/aktorer/norges-luftfartoyregister/registrerte-luftfartoy/
- **Bulk download URL:** https://data.caa.no/nlr/norgesluftfartoyregister.json (direct JSON, no auth required; verified via `data.norge.no` dataset listing 2026-05-10)
- **License:** Pending verification. `data.norge.no` tags the dataset **"Public access"** but the License field is empty. Metadata also contains a contradiction: `isAccessibleForFree: false` despite the public-access tag. Norwegian public-sector data generally falls under [NLOD (Norwegian License for Open Government Data)](https://data.norge.no/nlod/en/2.0), broadly equivalent to CC BY 4.0, but Luftfartstilsynet has not made that declaration explicit on the dataset page. Stays Unknown until reply.
- **Update cadence:** Daily at 16:00 Oslo time (per `data.norge.no` dataset metadata)
- **Permission email:** Sent 2026-05-05 to `postmottak@caa.no` (general inbox). Register-specific desk `nlr@caa.no` surfaced 2026-05-10 — preferred address for any follow-up. Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## Transportstyrelsen — Swedish Transport Agency

- **Status:** Future — permission request sent, awaiting reply (**leans Excluded** if no reply by 2026-06-04 — see below)
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration found)
- **Source URL:** https://etjanster-luftfart.transportstyrelsen.se/en-gb/sokluftfartyg
- **Bulk download URL:** **None published.** Recon 2026-05-10 confirmed the register is **search-only** (no CSV/PDF/JSON dump on `transportstyrelsen.se` and no listing on `dataportal.se` for the aircraft register). Pattern matches Italy ENAC and Iceland ICETRA: yes-reply must clear **both** license and a bulk access channel before ingest is feasible.
- **License:** Pending verification. Swedish public-sector data is bound by the EU PSI Directive baseline (reuse permitted under attribution), but Transportstyrelsen has not published an open-data declaration for the aircraft register. Unlike its Nordic neighbour Finland (Traficom publishes the equivalent register under CC BY 4.0), Sweden has not made the same declaration.
- **Update cadence:** TBD (no published artifact has a refresh schedule)
- **Permission email:** Sent 2026-05-05 to `luftfart@transportstyrelsen.se` (general aviation inbox). Register-specific desk `lfr@transportstyrelsen.se` surfaced 2026-05-10 — preferred address for any follow-up. Named register staff also surfaced for cold-call escalation: Magdalena Forssén, Christer Larsson, Fredrik Wallin (phone +46 771 503 503). Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

**Note for the eventual follow-up email (after 2026-06-04):** lead with the Finland Traficom comparable — neighbouring Nordic agency that publishes the equivalent register under CC BY 4.0 — and the EU PSI Directive baseline. Both are clean, public reference points.

---

## AFAC — Mexican Federal Civil Aviation Agency (Agencia Federal de Aviación Civil)

- **Status:** Future — permission request sent, awaiting reply (**leaning Excluded** pending AFAC confirmation)
- **Classification:** Unknown (verified 2026-05-10 — flagged as worst-case among the recon batch)
- **Source URL:** https://www.gob.mx/afac
- **Bulk download URL:** **None published.** Recon 2026-05-10 confirmed `portal-de-servicios.afac.gob.mx` is a **login-walled** user-account portal (no public read interface), and `datos.gob.mx` searches do not surface the Registro Aeronáutico Mexicano (RAM). The register is governed by the [Reglamento del Registro Aeronáutico Mexicano](http://www.ordenjuridico.gob.mx/Documentos/Federal/html/wo88684.html).
- **License:** Pending verification. Third-party sources (e.g., l2baviation) describe **per-record access at ~$10 USD per search** under the RAM Reglamento. Could not confirm on AFAC's own documentation — could be describing certified legal extracts (visure-equivalent) rather than basic public access. If AFAC reply confirms a fee-gated model, **this flips to Excluded** (same exclusion pattern as UK CAA G-INFO + Israel CAAI). Held at Unknown until primary-source confirmation.
- **Update cadence:** TBD (no published artifact has a refresh schedule)
- **Permission email:** Sent 2026-05-05 to `tramites@afac.gob.mx`. Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## Austro Control — Austria

- **Status:** Future — permission request sent, awaiting reply (**most "shovel-ready" of the unresolved Unknowns** — XLSX bulk file exists; engine handles xlsx natively)
- **Classification:** Unknown (verified 2026-05-10 — bulk file confirmed; license declaration not found)
- **Source URL:** https://www.austrocontrol.at/en/aviation_agency/aircraft/aircraft_register/overview__supplement
- **Bulk download URL:** Annual XLSX dump ("Total December 31, 2025 file (XLSX, 162 KB)" — last update January 8, 2026) plus monthly PDF supplements (e.g., `Nachtrag_2025_05_EN.pdf`, `Nachtrag_2025_09_EN.pdf`). Engine handles `xlsx` natively → if license clears, **Austria is engineering-ready with no parser work needed**. Optional ignore the PDF deltas, just re-pull the annual XLSX.
- **License:** Pending verification. Austro Control is on `data.gv.at` but **only for Spatial Data Infrastructure** (drone zones, airspace) — the aircraft register is **deliberately omitted**. Same pattern as Switzerland FOCA: agency publishes some open data with explicit licenses but withholds the register specifically. The XLSX is hosted directly on `austrocontrol.at` with no terms-of-use or imprint license tag discoverable. Note: Austro Control is a GmbH (corporate entity wholly owned by the Austrian state), not a federal ministry — corporate entities tend toward more restrictive copyright defaults.
- **Update cadence:** Annual XLSX (Jan 8 publication for prior Dec 31 snapshot) + monthly PDF supplements
- **Permission email:** Sent 2026-05-05 to `register@austrocontrol.at`. Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## BCAA / DGTA — Belgian Civil Aviation Authority

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://es.mobilit.fgov.be/aircraft-registry/main/search?lang=en
- **Bulk download URL:** TBD (search interface; bulk pattern unverified)
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-05 to `bcaa.registration@mobilit.fgov.be`. Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## CAA Taiwan — Civil Aviation Administration, MOTC R.O.C.

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.caa.gov.tw/article.aspx?a=238&lang=1
- **Bulk download URL:** TBD (avcodes notes Excel/PDF File available; access pattern unverified)
- **License:** Pending verification.
- **Update cadence:** Monthly (per avcodes notes)
- **Permission email:** Sent 2026-05-05 to `gencaa@mail.caa.gov.tw`. Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## DKPPU — Directorate of Airworthiness and Aircraft Operation, Indonesia

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://imsis-djpu.kemenhub.go.id/PortalDKPPU/
- **Bulk download URL:** Civil Aircraft Register published as PDF at the DKPPU portal (e.g. CAR2025E.pdf)
- **License:** Pending verification.
- **Update cadence:** Annual CAR publication observed
- **Permission email:** Sent 2026-05-05 to `produkaeronautika_dkuppu@dephub.go.id` (cc: `info151@dephub.go.id`). Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## JCAA — Jamaica Civil Aviation Authority

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.jcaa.gov.jm/aircraft-registry-page/
- **Bulk download URL:** TBD (no licensing information published; question included in permission request)
- **License:** Pending verification — JCAA aircraft registry page does not publish a license statement.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-05 to `info@jcaa.gov.jm` (general inbox; no register-specific desk surfaced). Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## KOCA / MOLIT — Korea Office of Civil Aviation, Republic of Korea

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://atis.koca.go.kr/ATIS/aircraft/forwardPage.do
- **Bulk download URL:** TBD (avcodes notes Excel File available; access pattern unverified)
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-05 to `lia0404@korea.kr` (general inquiries; no register-specific desk surfaced). Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## Traficom — Finnish Transport and Communications Agency

- **Status:** 🚧 License clear, **data shape blocking** — public bulk channel is identifier-stripped and not ingestable; new ask to Traficom is an identifier-bearing channel, not a license reconfirmation.
- **Classification:** **Open** — CC BY 4.0 (verified 2026-05-10 from Traficom open-data page; **confirmed by Traficom in writing 2026-05-11**). License remains cleared for any future identifier-bearing bulk channel.
- **Source URL:** https://tieto.traficom.fi/en/open-data (Traficom open-data catalog) + https://www.avoindata.fi/data/en_GB/dataset/854b277b-7472-4d0a-9a46-a8e34822a2e0 (avoindata.fi listing)
- **Bulk download URL:** https://eservices.traficom.fi/LicensesServices/Forms/AircraftRegister.aspx?download=zip (direct ZIP-CSV; ~1,330 rows; 127 kB unpacked / 123 kB packed) — **identifier-stripped, not ingestable**
- **Variable list:** https://tieto.traficom.fi/files/media/file/MuuttujaluetteloIlmaalusrekisteri.xlsx
- **License:** **CC BY 4.0** (Creative Commons Nimeä 4.0 International). Verbatim from the Traficom open-data page: _"The material been licensed under the Creative Commons Nimeä 4.0 International license — http://creativecommons.org/licenses/by/4.0/deed.en"_. Same posture as CASA Australia: attribution required. **Agency confirmation received 2026-05-11** — see Reply section below.
- **Update cadence:** Annual (single dated dump per year — material 12 Jan 2026, published 17 Feb 2026; no monthly refresh)
- **Data-shape blocker (verified 2026-05-12 by direct fetch):** The public ZIP contains a single CSV `aircraftregister.csv` with 24 columns: `Aircraft_name, Legal_Basis, Aircraft_model_category, Minimum_Crew, Maximum_Passengers, MTOM_kg, ELA1_flag, ELA2_flag, Complex_aircraft, Number_of_engines, Count_of_Propellers, ICAO, Aircraft_Construction_Year, Initial_Registration_Date, Import_Previous_country, Engine_1_Manufacturer, Engine_1, …, Engine_4_Manufacturer, Engine_4`. The file is GDPR-stripped to per-aircraft fleet stats: **no registration mark (OH-XXX), no source_id / unique ID, no Mode-S 24-bit hex, no owner, no operator, no serial number**. The canonical schema requires at minimum a unique ID and a registration; this channel carries neither. Each row corresponds to a real aircraft (1,330 rows ≈ Finnish register size), just stripped of identity. **Re-engage Traficom for an identifier-bearing bulk channel before reattempting.**
- **Format note (engineering):** Engine already handles ZIP+CSV via `format: zip` + `format: csv` (FAA pattern). The blocker is data shape, not parser path.
- **Permission email:** Sent 2026-05-05 to `kirjaamo@traficom.fi` (cc: `tietojenluovutus@traficom.fi`). **Substantive reply received 2026-05-11 from Joakim Savela, Adviser, Data Disclosure unit** — confirms Open-data terms, approves attribution text. The license clearance stands; a separate follow-up will be required to ask whether Traficom can publish an identifier-bearing bulk channel under the same CC BY 4.0 terms.
- **Reply (verbatim):** Received 2026-05-11 from Joakim Savela (preserved verbatim per AGENTS.md):

  > Hello,
  >
  > Open data can be freely used by anyone for any purpose, as long as the original source of the data is mentioned.
  >
  > The example attribution text you provided is good.
  >
  > Best regards,
  >
  > Joakim Savela
  > Adviser
  > Data Disclosure unit
  > Finnish Transport and Communications Agency Traficom

  This is the **first substantive license-confirming reply** received during the metal-birds-feed permission outreach. It confirms (a) CC BY 4.0 terms apply to the register data without any additional conditions, (b) the project's standard attribution text is acceptable to Traficom verbatim, (c) the Data Disclosure unit is the canonical contact for any future register-related correspondence. **However**, the underlying public bulk channel is GDPR-stripped per-aircraft fleet stats (no registration mark, no source_id, no Mode-S hex, no owner/operator) — verified by direct fetch 2026-05-12 — so canonical-schema ingest is impossible from this channel. The next ask of Traficom is publication of an identifier-bearing bulk channel under the same CC BY 4.0 terms, not a license reconfirmation.

### Required attribution (verbatim, place in README Attribution section)

> Source: Traficom — Finnish Transport and Communications Agency — https://tieto.traficom.fi/en/open-data
>
> Licensed under [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/). The material has been changed: Traficom aircraft records are normalized into metal-birds-feed's canonical schema. This attribution does not imply endorsement by Traficom.

---

## Trafikstyrelsen — Danish Civil Aviation and Railway Authority

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration found)
- **Source URL:** https://www.trafikstyrelsen.dk/arbejdsomraader/luftfart/ansoegninger-individuelle/flyejer/luftfartoejsregister
- **Bulk download URL:** **None published.** Recon 2026-05-10: the public register page describes only application procedures (registration, change of ownership, deletion, IDERA, rights register). A SharePoint document library exists at `selvbetjening.trafikstyrelsen.dk/civilluftfart/Dokumenter/Luftfartøjsregistret og luftfartsgodkendelser` but the URL returns empty (login-walled or affected by current outage — see operational note below). Pattern matches Italy/Iceland/Sweden: yes-reply must clear **both** license and a bulk access channel.
- **License:** Pending verification. Datavejviser.dk (Denmark's data catalog) publishes its own metadata under CC0 but that does not speak to register data licensing. No register-specific declaration discoverable.
- **Update cadence:** TBD (no published artifact has a refresh schedule)
- **Operational note (2026-05-10):** Register is **currently offline**. Trafikstyrelsen page leads with banner: _"Teknisk fejl på nationalitetsregistret. Adgangen til nationalitetsregistret er i øjeblikket utilgængelig grundet en teknisk fejl."_ ("Technical error on the nationality register. Access is currently unavailable due to a technical error.") A 2019 news archive entry shows the register has gone down before — recurring reliability concern, signal about how seriously the agency treats the artifact.
- **Permission email:** Sent 2026-05-05 to `info@trafikstyrelsen.dk` (general inbox; no register-specific desk surfaced publicly in this recon). Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

**Note for the eventual follow-up email (after 2026-06-04):** lead with the Finland Traficom comparable — neighbouring Nordic agency that publishes the equivalent register under CC BY 4.0 — and the EU PSI Directive baseline.

---

## Transpordiamet — Estonian Transport Administration

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration found)
- **Source URL:** https://transpordiamet.ee/ohusoidukite-register (Estonian-language page; English page at `transpordiamet.ee/en/vehicle-ship-airplane/aircraft-registration/aircraft-register` describes registration procedures only)
- **Bulk download URL:** **HTML table inline on the register page.** Full register (~150 entries) is rendered as an HTML table with columns: Registration mark (ES-XXX) / Aircraft type / Serial number / Owner / Operator. No CSV/XLSX/PDF download. Pattern matches Georgia GCAA — HTML scrape required.
- **License:** No declaration on the register page. **Register deliberately omitted from `andmed.eesti.ee`** (Estonia's national open-data portal). Transpordiamet publishes 5+ other datasets there (vehicles, traffic accidents, road register, public transport register, vehicle statistics) under the portal's explicit terms ("right to reuse and redistribute it for both commercial and non-commercial purposes"). The aircraft register's exclusion is a deliberate choice. Same pattern as Switzerland FOCA, Austria Austro Control, Italy ENAC.
- **Update cadence:** TBD (HTML table refresh cadence not stated on the page)
- **Permission email:** Sent 2026-05-10 to `info@transpordiamet.ee` (general inbox; no register-specific desk surfaced publicly). Email led with the Finland Traficom comparable (CC BY 4.0 on avoindata.fi) and noted that Transpordiamet already publishes other datasets on andmed.eesti.ee under open-reuse terms. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## CAA Macedonia — Civil Aviation Agency of the Republic of North Macedonia (Агенција за цивилно воздухопловство)

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration; "All Rights Reserved" boilerplate footer only)
- **Source URL:** https://www.caa.gov.mk/en/safety/airworthiness-and-aircraft-registration/ (English) + Macedonian Cyrillic equivalent at the same site
- **Bulk download URL:** Direct PDF on date-stamped path, e.g. https://www.caa.gov.mk/wp-content/uploads/2026/04/AIRCRAFT-REGISTER-20.04.2026.pdf (April 20, 2026 snapshot — fresh). Filename pattern: `AIRCRAFT-REGISTER-DD.MM.YYYY.pdf`. WordPress site.
- **License:** Pending verification. Site footer asserts _"© Copyright 2019. All Rights Reserved"_ — copyright + "All Rights Reserved" boilerplate. No explicit reuse permission declared.
- **Update cadence:** Periodic (latest version dated 2026-04-20; cadence not stated explicitly)
- **Format note (engineering):** Bulk file is **PDF**. Same blocker as other PDF sources — **eighth** use case for the PDF parser path.
- **Permission email:** v1 sent 2026-05-10 to `caa@gov.mk` **bounced** (domain `gov.mk` does not exist — typo, should have been `caa.gov.mk` subdomain). v2 sent 2026-05-10 to `info@caa.gov.mk` (correct subdomain — general Agency inbox). Phone +389 2 3 18 16 01; address Dame Gruev 1, 1000 Skopje. Plain-text body per Option A (markdown stripped at send time). Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## DAC Luxembourg — Direction de l'Aviation Civile

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** **Personal-use** (verified 2026-05-10 from explicit DAC "Aspects légaux" terms; no recon-first ambiguity)
- **Source URL:** https://dac.gouvernement.lu/fr/demarches/immatriculation-aeronefs/releve-immatriculations.html
- **Bulk download URL:** Direct PDF on date-stamped filename pattern, e.g. https://dac.gouvernement.lu/dam-assets/documents/navigabilité/releve-aeronefs/relev-aronefs-10-04-2026.pdf (361 KB; latest as of recon was 2026-04-10; page last modified 2026-04-22).
- **License:** **Personal-use only.** Per DAC's [Aspects légaux](https://dac.gouvernement.lu/fr/support/aspects-legaux.html), default rule is verbatim French: _"Sauf indication contraire, l'Etat du Grand-Duché de Luxembourg n'accorde **aucune licence ou autorisation** relative aux droits de propriété intellectuelle qu'il a sur ce site, ses éléments ou les Services."_ The text-document exception is narrow: _"l'usager est autorisé à consulter, télécharger et imprimer les documents de type texte sans demande préalable"_ — i.e., **consult, download, print** only; not redistribute, not modify. Same legal posture as France DGAC and Switzerland FOCA.
- **Update cadence:** Periodic (date-stamped filename pattern; refresh frequency not contractually committed)
- **PII pre-handling at source (good news for our pipeline):** Per the register page (verbatim French): _"Les données relatives à des personnes physiques sont considérées comme des données à caractère personnel et ne figurent pas dans l'extrait de liste pour des raisons de conformité aux dispositions RGPD."_ DAC already strips natural-person data per GDPR. Same flavor as France DGAC and Lithuania TKA.
- **Format note (engineering):** Bulk file is **PDF**, same blocker as Spain AESA. Engine handles csv/ods/xlsx; PDF parsing is a new format adapter (would be reusable for Spain).
- **Register absent from data.public.lu** (only "Tableau de tri de la DAC" — records management taxonomy — listed there, not the aircraft register). Same Switzerland/Austria pattern. Notable contrast: data.public.lu portal default is CC0 for ~90% of datasets — DAC is the outlier in withholding the register.
- **Permission email:** Sent 2026-05-10 to `nav@av.etat.lu` (Département Navigabilité; phone +352 247-74924/74900). Email cited Latvia CAA (CC0 on data.gov.lv), Lithuania TKA (CC BY 4.0 on data.gov.lt), and the data.public.lu CC0 portal default as Baltic/EU peer comparables. Follow-up due 2026-06-09 if no reply by then. **The 30-day fallback does NOT apply** — DAC is Personal-use; silence ≠ permission, must wait for affirmative reply. Template: `docs/agency-permission-request.md` (lightly customized for Personal-use posture).
- **Reply (verbatim):** _pending_

---

## Dopravný úrad — Slovak Transport Authority (NSAT — Národný supervízny orgán)

- **Status:** Future — permission request sent 2026-05-10 (license confirmation only — bulk channel and dataset already public on data.gov.sk; just asking which license applies)
- **Classification:** Unknown — strongly leaning Open (CC BY 4.0 inferred from data.gov.sk portal default, not directly verified)
- **Source URL:** https://data.gov.sk/dataset/register-lietadiel (portal listing) + https://letectvo.nsat.sk/letova-sposobilost/register-lietadiel-slovenskej-republiky/zoznam-registra/ (NSAT register page) + https://letectvo.nsat.sk/letova-sposobilost/register-lietadiel-slovenskej-republiky/ (overview)
- **Bulk download URL:** Listed on data.gov.sk dataset page (PDF format per third-party description). Dataset page is JS-rendered SPA — direct file URL not extractable from server response without browser execution. Will confirm with NSAT in their reply.
- **License:** Pending verification. data.gov.sk portal default for Slovak public-sector data is CC BY 4.0 (search filter confirms). Strongly inferred Open per portal norms but the dataset page renders client-side so direct license tag was not extractable; email asks for explicit confirmation.
- **Update cadence:** TBD (file refresh frequency not stated in surfaced metadata)
- **Format note (engineering):** Bulk file is **PDF** per third-party description. Same blocker as Spain AESA, Luxembourg DAC, Croatia CCAA, Hungary KKM — **fifth** use case for the PDF parser path. PDF parser priority continues to climb.
- **Permission email:** Sent 2026-05-10 to `register.lietadiel@nsat.sk` (register-specific desk; phone 0918 382 016). Email is short and focused on **license confirmation only** — bulk channel is already public, we are only asking which license applies. Email cited Latvia CAA (CC0 on data.gov.lv), Lithuania TKA (CC BY 4.0 on data.gov.lt), and Finland Traficom (CC BY 4.0 on avoindata.fi) as small-EU peer comparables. NSAT physical address: Letisko M.R. Štefánika, 823 05 Bratislava. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md` (heavily abbreviated for license-confirmation use case).
- **Reply (verbatim):** _pending_

---

## CAA Kyrgyzstan — State Agency for Civil Aviation of the Kyrgyz Republic (Государственное агентство гражданской авиации)

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration; copyright boilerplate footer only)
- **Source URL:** https://caa.kg/ru/reestr-grazhdanskikh-vozdushnykh-sudov-kyrgyzskoy-respubliki (Russian) + https://caa.kg/en/node/46 (English) + https://caa.kg/ky/node/46 (Kyrgyz)
- **Bulk download URL:** **HTML scrape** — register published as an inline HTML table on the page (~64 aircraft visible in main content); Drupal 10 site.
- **Schema (verified by direct fetch 2026-05-10):** № / Operator (only — no owner name) / Type of Aircraft / Registration number (EX-XXX) / Date of Registration / Serial Number / Date of Manufacture. **PII pre-stripped at source** — only operator names, no owner personal data. Compatible with PRD CC.4 PII drop policy.
- **License:** Pending verification. Site footer asserts _"Copyright © 2025 Государственное агентство гражданской авиации"_ — copyright assertion + boilerplate. No explicit reuse permission declared.
- **Update cadence:** Recent — latest update on register page is 2026-03-19 (less than 2 months stale at recon time)
- **Format note (engineering):** **HTML scrape** — fourth use case for the HTML scrape adapter (joins Estonia, Georgia GCAA, Montenegro). Pattern is a single page with an inline table, simpler than Montenegro's paginated table + per-aircraft detail pages.
- **Permission email:** Sent 2026-05-10 to `mail@caa.kg` (general Agency inbox). Phone +996 312 25 16 19; address Azhibek-Baatyra 1, Bishkek. Email cited Latvia CAA, Lithuania TKA as small-EU peer comparables (Kyrgyzstan is non-EU but similar regional norms apply). Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## AACM Macau — Civil Aviation Authority of Macao SAR (Autoridade de Aviação Civil da RAEM)

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration; no bulk channel discoverable)
- **Source URL:** https://www.aacm.gov.mo/en/industry-page/RegisteredAircraft (English) + https://www.aacm.gov.mo/pt/industry-page/RegisteredAircraft (Portuguese)
- **Bulk download URL:** **None published.** Page surfaces a list view only. No CSV/XLSX/PDF/JSON export discoverable.
- **License:** Pending verification. No explicit license declaration on the Registry pages.
- **Update cadence:** TBD
- **Format note (engineering):** Likely HTML scrape if bulk channel is not granted — joins Estonia, Georgia, Montenegro, Kyrgyzstan in the HTML-scrape bucket.
- **Permission email:** Sent 2026-05-10 to `aacm@aacm.gov.mo` (general Authority inbox; phone +853 2851 1213). Email cited Latvia CAA, Lithuania TKA as peer comparables. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## CAAT Thailand — Civil Aviation Authority of Thailand

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration)
- **Source URL:** https://www.caat.or.th/en/certificates-licenses/aircraft/guidance-material/registration-of-an-aircraft/ + https://www.caat.or.th/en/archives/52215 (legacy register link)
- **Bulk download URL:** Direct PDF on date-stamped path, e.g. https://www.caat.or.th/wp-content/uploads/2024/01/Aircraft-Registration-Information-08-Jan-2025.pdf (most recently surfaced 2025-01-08; ~16 months stale at recon time). Filename pattern: `Aircraft-Registration-Information-DD-MMM-YYYY.pdf`. WordPress site.
- **License:** Pending verification. No explicit license declaration on registry pages.
- **Update cadence:** Periodic (date-stamped snapshots; cadence appears semi-annual based on visible files but not stated explicitly). Email asks for confirmation.
- **Format note (engineering):** Bulk file is **PDF**. Same blocker as other PDF sources — joins the now-large PDF parser path use-case set.
- **Recon depth:** **Two-pass** (per AGENTS recon-first rule). Pass 1: register URL + format + dated-snapshot pattern. Pass 2: data.go.th cross-check (register not catalogued there) + dedicated international-focal-point inbox confirmed.
- **Permission email:** Sent 2026-05-10 to `inter_focalpoint@caat.or.th` (CAAT international focal point) cc `saraban@caat.or.th` (general saraban / formal correspondence). Phone +66 2 568 8800; address 333/105 Lak Si Plaza, Khamphaeng Phet 6 Rd., Bangkok 10210. Email cited Latvia CAA, Lithuania TKA as peer comparables and explicitly asked for license + refresh-cadence confirmation + structured-format upgrade + offered to coordinate publication on data.go.th. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## TKA — Transporto kompetencijų agentūra (Transport Competence Agency of Lithuania)

- **Status:** Future — permission request sent 2026-05-10 (license confirmation only — bulk channel and dataset already public on data.gov.lt; just asking which license applies)
- **Classification:** Unknown — strongly leaning Open (CC BY 4.0 inferred from data.gov.lt portal default, not directly verified)
- **Source URL:** https://data.gov.lt/datasets/2735/ (dataset page) + https://tka.lt/en/katalogas/register-of-civil-aircraft-of-the-republic-of-lithuania/ (TKA register page)
- **Bulk download URL:** **Spinta API** at https://get.data.gov.lt/datasets/gov/tka/registras/Irasas (paginated JSON via cursor; metadata at `/:ns`). Multiple formats listed on dataset page: HTML, CSV, JSON, JSONL, ASCII, RDF.
- **Schema (verified by direct API fetch 2026-05-10):** `_id`, `_revision`, `vda_id`, `duomenu_sviezumas` (data freshness), `registracijos_nr` (registration number, e.g. "LY-XXX"), `statusas` (status), `kategorija` (category), `rusis` (kind), `tipas` (type/model), `savininko_tipas` (owner **type**), `naudotojo_tipas` (operator **type**), `pagaminimas` (manufacture date), `pirma_registracija` (first registration), `paskutine_registracija` (last registration), `tsppp_galiojimas` (airworthiness validity), `baze` (base airport), `bazes_adresas` (base address), `geometrija` (geometry), `keleiviu_sk` (passenger count), `mkm` (MTOW kg), `oro_sraigtas` (propeller).
- **PII pre-handling at source (good news for our pipeline):** Schema carries only **owner type and operator type** (categorical) — no owner/operator names. PII has been pre-stripped at source. Same flavor as France DGAC's GDPR pre-stripping. Excellent fit for our PRD CC.4 PII drop policy.
- **License:** Pending verification. data.gov.lt portal default for Lithuanian public-sector data is CC BY 4.0, but the dataset page is JS-rendered (not directly fetchable) and the Spinta API envelope does not carry license metadata. Strongly inferred Open per portal norms but not directly verified — email asks for explicit confirmation.
- **Update cadence:** Continuous (per-record `duomenu_sviezumas` field; data fresh as of 2026-03-09 verified)
- **Format note (engineering):** New format adapter needed — JSON via Spinta API with cursor pagination. Engine handles csv/ods/xlsx natively; JSON would be a new path. Lighter lift than Spain's PDF problem; slightly bigger than Latvia's CSV. Bonus: all data.gov.lt datasets use the same Spinta API pattern, so wrapper would be reusable for any future Lithuanian source.
- **Permission email:** v1 sent 2026-05-10 to `joris.dumcius@tka.lt` (Joris Dumčius, listed on `lrvalstybe.lt` as head of Aircraft Section) — **bounced**: _"Your message wasn't delivered to joris.dumcius@tka.lt because the address couldn't be found, or is unable to receive mail."_ Likely stale third-party directory entry (Dumčius may have left, or the listed email was never valid). v2 sent 2026-05-10 to `info@tka.lt` (verified general inbox) cc `audrius.turauskas@tka.lt` (Patarėjas, +370 645 63674; also Cloudflare-decoded but unverified — info@ will route regardless). v2 body explicitly references the bounce and asks for forwarding to whoever currently manages the Aircraft Section. Email is short and focused on **license confirmation only** — bulk channel is already public, we are only asking which license applies. Email cited Latvia CAA as Baltic peer comparable (CC0-1.0 on data.gov.lv). Other escalation contacts on the same page: Vitalijus Krivoščenko (`vitalijus.krivoscenko@tka.lt`, +370 658 47947), Egidijus Šimkus (`egidijus.simkus@tka.lt`, +370 612 73317). Follow-up due 2026-06-09 if no reply to v2 by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md` (heavily abbreviated for license-confirmation use case).
- **Reply (verbatim):** _pending_

---

## CAA Latvia — Civilās aviācijas aģentūra (Civil Aviation Agency of Latvia)

- **Status:** ✅ Live (`sources/lv-caa.yaml` + `fixtures/lv-caa/` shipped on branch `feat/lv-caa`)
- **Classification:** **Open** — CC0-1.0 (verified 2026-05-10 from data.gov.lv; reclassified from Unknown). Same posture as Netherlands ILT.
- **Source URL:** https://data.gov.lv/dati/lv/dataset/gaisa-kugu-registrs (dataset page) + https://www.caa.gov.lv/en/aircraft-register (agency register page)
- **Bulk download URL:** https://data.gov.lv/dati/dataset/3f67abc8-f8b7-4833-a2e2-9a304df06afd/resource/dbde00e6-8616-449a-8cac-ef748c6793f3/download/output.csv (direct CSV, no auth required)
- **Bonus resource:** https://data.gov.lv/dati/dataset/3f67abc8-f8b7-4833-a2e2-9a304df06afd/resource/c550723e-4954-4057-8a7a-ed4a19f06b4b/download/output_metadata.json (sibling JSON metadata)
- **License:** **CC0-1.0** (public domain dedication, no attribution required). Verbatim license tag on the data.gov.lv dataset page: "CC0-1.0". This is even more permissive than CC BY 4.0 — same posture as Netherlands ILT. We will still cite Latvia CAA in our documentation as a courtesy.
- **Update cadence:** Monthly ("reizi mēnesī" per dataset metadata). First published 2023-09-08. **The "last updated 2025-04-29" field on the dataset page refers to the metadata record itself (description / tags / etc.), NOT the data file content.** Verified 2026-05-10 by direct CSV fetch — most recent registration in the file was 2026-04-10 (YL-MBL); the data file is freshly refreshed monthly even though the metadata-record date looks stale.
- **Format note (engineering):** Direct CSV (UTF-8, comma-delimited, CRLF, no BOM). Engine handles `csv` natively via `format: file` + `format: csv`. Schema: `Registration_Mark, Model, Construction_Year, Serial_No, Registered_on, Aircraft_Model_Category` — six columns, no owner/operator, no engine info, no Mode-S hex, no ICAO type code. Sailplane/Glider/Powered glider/Powered Sailplanes collapse to `glider` (canonical schema does not differentiate auxiliary power); `Aircraft` category maps to the generic `fixed-wing` enum value (added to `AirframeTypeSchema` alongside this source) — Latvia publishes fixed-wing as a category without disambiguating engine count, so the generic value preserves the structural signal without inventing detail the source doesn't carry.
- **Data contact:** `ivo.tukris@caa.gov.lv` (Ivo Tukris, listed as "Saziņas e-pasts datu jautājumiem" / data-questions email on the dataset page) — only relevant if data quality issues arise; not needed for license clearance.
- **Permission email:** **None needed.** License is fully explicit on the public open-data portal. No email required.
- **Reply (verbatim):** _N/A — no email sent_

### Required attribution (verbatim — courtesy, not legally required under CC-0)

> Aircraft register data published by Civilās aviācijas aģentūra (CAA Latvia) on [data.gov.lv](https://data.gov.lv/dati/lv/dataset/gaisa-kugu-registrs) under [CC0-1.0 (public domain)](https://creativecommons.org/publicdomain/zero/1.0/). Acknowledgment provided as a courtesy; not legally required under CC-0.

---

## CAA Lebanon — Civil Aviation Authority (الهيئة العامة للطيران المدني — successor to the Directorate General of Civil Aviation / DGCA)

- **Status:** Future — permission request sent 2026-05-10 (v2 to new authority domain), awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — three-pass recon; no public license declaration)
- **Source URL:** https://www.lebcaa.com/a_r.shtml (legacy DGCA domain — confirmed dead-dead per user) + https://caa.gov.lb (new authority domain, JS-rendered)
- **Bulk download URL:** None known. Legacy DGCA register was inline HTML on `lebcaa.com/a_r.shtml`. New authority's canonical register URL not yet surfaced. OD- registration prefix.
- **License:** Pending verification. No explicit license declaration on either domain.
- **Update cadence:** TBD.
- **Format note (engineering):** **HTML scrape adapter** assumed (matching legacy DGCA pattern); will revise based on reply if new authority publishes structured format.
- **Operational restructure context:** Lebanon's civil aviation regulatory authority is being restructured. Per Lebanese MPWT announcements (May 2025) and MTV Lebanon reporting (July 2025), Captain Mohammad Aziz was appointed head of a new "General Authority of Civil Aviation" (الهيئة العامة للطيران المدني) replacing/succeeding the DGCA. The old `dgca.gov.lb` domain has no working email infrastructure (MX record is a domain-connect placeholder). The new domain `caa.gov.lb` has a real working mailserver (MX → `mail.caa.gov.lb` → 192.250.227.184; SPF properly configured via `mysecurecloudhost.com`).
- **Recon depth (three-pass):**
  - **Pass 1:** Confirmed register URL on legacy `lebcaa.com`, no bulk download.
  - **Pass 2:** DGCA contact page JS-rendered; chose `info@dgca.gov.lb` as best-guess.
  - **Pass 3 (after v1 bounce):** DNS recon revealed `dgca.gov.lb` MX is a placeholder (no mailserver); searches surfaced a successor authority on `caa.gov.lb` with live mail infrastructure. v2 sent to new domain.
- **Permission email:** v1 sent 2026-05-10 to `info@dgca.gov.lb` **bounced** (server misconfigured — entire `dgca.gov.lb` domain has no working email infrastructure). v2 sent 2026-05-10 to `info@caa.gov.lb` (delivered — no bounce; counts as sent) cc ~~`contact@caa.gov.lb`~~ (bounced — hedge guess on the new authority domain was wrong; the `info@` mailbox is the only verified inbox). DNS confirmed live MX on `caa.gov.lb` via mysecurecloudhost.com. Plain-text body per Option A (markdown stripped at send time). Body explicitly asks for (1) confirmation that caa.gov.lb is the correct point of contact, (2) license terms, (3) canonical register URL, (4) any restrictions; includes wartime/crisis "suspend on request" clause. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## Közlekedési Hatóság — Hungarian Transport Authority (Légügyi Felügyeleti Hatósági Főosztály — Air Supervision Authority Department)

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration found on the document page or surrounding materials)
- **Source URL:** https://www.kozlekedesihatosag.kormany.hu/hu/dokumentum/104604 (document page; bilingual Hungarian/English)
- **Bulk download URL:** Direct PDF on hash-stamped path, e.g. https://kozlekedesihatosag.kormany.hu/documents/66238/342548/2026.05.08.+%28Friss%C3%ADt%C3%A9s%29.pdf/765eb23b-d4c4-6713-ca89-05c92024e2f3?version=278.0&t=1778240402523&download=true (May 8, 2026 snapshot; 2.8 MB; "Frissítés" = "Update"). Filename pattern: `YYYY.MM.DD.+(Frissítés).pdf` — date-stamped per release.
- **Update cadence:** **Near-daily** (business-day) — version history shows 278 versions since 2020-08-14 ≈ ~46 versions/year ≈ one update per business day. Most frequent of any agency recon'd to date.
- **License:** Pending verification. No explicit license declaration on the document page or in surrounding materials; only descriptive tags ("lajstrom", "lajstromnyilvántartás", "légijármű adatbázis"). Document is a Hungarian government publication; default copyright attaches absent a permission grant.
- **Format note (engineering):** Bulk file is **PDF** (bilingual Hungarian/English columns). Same blocker as Spain AESA, Luxembourg DAC, Croatia CCAA. PDF parser path is now justified by **four** use cases — moving up the engineering priority list.
- **Register absent from data.gov.hu** (Hungarian open-data portal does not list it).
- **PII status:** Per third-party review, the published list contains aircraft owner names and addresses — no GDPR pre-strip noted. Mapping config will need to drop owner/operator address fields per PRD CC.4 PII drop policy.
- **Permission email:** Sent 2026-05-10 to `lfhf@ekm.gov.hu` (Légügyi Felügyeleti Hatósági Főosztály — Air Supervision Authority Department) cc `caa@ekm.gov.hu` (general CAA inbox). Note: `ekm.gov.hu` domain corresponds to Építési és Közlekedési Minisztérium (Ministry of Construction and Transport, parent ministry of the Transport Authority). Email cited Latvia CAA (CC0 on data.gov.lv), Lithuania TKA (CC BY 4.0 on data.gov.lt), and Finland Traficom (CC BY 4.0 on avoindata.fi) as small-EU peer comparables. Phone +36 (1) 273-5525 / +36 (1) 373-1432; physical: 2220 Vecsés, Lincoln út 1; mailing: 1442 Budapest, Pf.: 89. Recent register-edit staff visible in PDF metadata: Csemniczky Kristóf (creator), Nyilas Tímea (last modified 2026-05-08). Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## GDCA / CAC Armenia — Civil Aviation Committee of the Republic of Armenia (formerly General Department of Civil Aviation)

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration)
- **Source URL:** http://www.aviation.am/registered_aircrafts (Armenian + English; HTTP-only) + http://www.gdca.am (legacy domain, also active)
- **Bulk download URL:** Direct PDF at `aviation.am/registered_aircrafts` (per third-party reference; latest noted update 2025-02-26 — over a year stale)
- **License:** Pending verification. No explicit license declaration found.
- **Update cadence:** Concerning — third-party reference shows last update 2025-02-26, suggesting infrequent refresh. May require email confirmation of current cadence.
- **Format note (engineering):** Bulk file is **PDF**. Tenth use case for the PDF parser path.
- **Naming note:** The agency was renamed from "General Department of Civil Aviation" (GDCA) to "Civil Aviation Committee" — both `aviation.am` and `gdca.am` domains remain active; email and correspondence may use either name.
- **Permission email:** Sent 2026-05-10 to `info@aviation.am` (primary domain) cc `info@gdca.am` (legacy domain) — neither email verified to be valid; if both bounce, retry via secretariat or named contact. Phone +374 1 028 2066. Email cited Latvia CAA, Lithuania TKA as small-EU peer comparables (Armenia is non-EU but eligible under similar regional norms). Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## CAA Bulgaria — Главна дирекция "Гражданска въздухоплавателна администрация" (Directorate General Civil Aviation Administration)

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no explicit license declaration; "All rights reserved" boilerplate footer only)
- **Source URL:** https://www.caa.bg/bg/category/300/17238 (Bulgarian) + https://www.caa.bg/en/node/17238 (English)
- **Bulk download URL:** Direct XLSX on date-stamped path, e.g. https://www.caa.bg/sites/default/files/upload/documents/2025-05/Aircraft_Register_20250430.xlsx (35.45 KB; small register). Filename pattern: `Aircraft_Register_YYYYMMDD.xlsx`.
- **Update cadence:** **Concerning — file dated 2025-04-30 was still the latest as of recon 2026-05-10**, i.e., over a year stale. Path includes `/2025-05/` folder, suggesting the file is filed by upload date. Hungary updates near-daily; Bulgaria appears to be annual at best. Will need to confirm refresh cadence in the email reply.
- **License:** Pending verification. Site footer asserts _"Главна дирекция 'Гражданска въздухоплавателна администрация' © 2005-2026 Всички права запазени"_ ("Directorate General 'Civil Aviation Administration' © 2005-2026 All rights reserved") — standard Bulgarian government boilerplate. No explicit reuse permission declared on the document page.
- **Format note (engineering):** Bulk file is **XLSX** — engine handles `xlsx` natively. **Zero parser work needed.** If license clears, this is engineering-ready (just YAML config + fixtures). Closest existing analogue: Austria Austro Control (annual XLSX).
- **Register absent from data.egov.bg** Bulgarian open-data portal listing for CAA does not surface the aircraft register specifically; portal listing exists for the agency but the register is not catalogued there.
- **Permission email:** Sent 2026-05-10 to `AIRWORTHINESS@caa.bg` (Airworthiness Department — owner of `/category/300` URL hierarchy where the register lives) cc `caa@caa.bg` (general inbox). Email cited Latvia CAA (CC0 on data.gov.lv), Lithuania TKA (CC BY 4.0 on data.gov.lt), and Finland Traficom (CC BY 4.0 on avoindata.fi) as small-EU peer comparables. Address: Sofia 1000, "Diakon Ignatiy" Str. №9; phone +359 (02) 937-1047. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## BHDCA — Bosnia and Herzegovina Directorate of Civil Aviation (Direkcija za civilno zrakoplovstvo BiH)

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration; "All rights reserved" boilerplate footer only)
- **Source URL:** http://www.bhdca.gov.ba/index.php/hr/doc/registar-civilnih-zrakoplova (Croatian) + http://www.bhdca.gov.ba/index.php/en/doc/registar-civilnih-zrakoplova (English)
- **Bulk download URL:** PDF embedded on register page, hosted at `http://www.bhdca.gov.ba/website/dokumenti/Plovidbenost/IzvodRegistar/BiHAircraftRegisterHR.pdf` (Croatian extract; English variant at `BiHAircraftRegisterENG.pdf` per third-party reference)
- **License:** Pending verification. Site footer asserts _"© 2021 BHDCA - Bosna i Hercegovina DIREKCIJA ZA CIVILNO ZRAKOPLOVSTVO. All rights reserved."_ — copyright + "all rights reserved" boilerplate. No explicit reuse permission declared on the document page.
- **Update cadence:** TBD (footer dated 2021 — site appears not actively maintained; refresh frequency unclear)
- **Format note (engineering):** Bulk file is **PDF**. Same blocker as other PDF sources — **seventh** use case for the PDF parser path.
- **Operational reliability concern (2026-05-10):** Site uses `http://` (not HTTPS) and the footer is dated 2021. Suggests the agency website is not actively maintained, which may impact response reliability. Multilingual structure (HR/EN/SR/BS) reflects BiH's three constituent peoples + English.
- **Permission email:** Sent 2026-05-10 to `bhdca@bhdca.gov.ba` (general Directorate inbox; site does not surface a register-specific direct email — register staff "Aircraft Register Official – REG" position 2-2-5 in Airworthiness Section but no direct email visible). Phone +387 51 921-222; Fax +387 51 921-520; address V kozarske brigade 18, 78000 Banja Luka. Email cited Latvia CAA, Lithuania TKA, and Finland Traficom as small-EU peer comparables. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## CAA Moldova — Autoritatea Aeronautică Civilă a Republicii Moldova

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration)
- **Source URL:** https://www.caa.md/rom/register/ (Romanian) + https://www.caa.md/en (English landing) + https://www.caa.md/registru-aerian-3-84 (legacy CMS path)
- **Bulk download URL:** Direct PDF at https://www.caa.md/modules/filemanager/files/documentum/Registrul_Aerian_al_Republicii_Moldova.pdf
- **License:** Pending verification. No explicit license declaration on the document page or in surrounding materials. Default copyright applies.
- **Update cadence:** TBD (refresh frequency not stated explicitly)
- **Format note (engineering):** Bulk file is **PDF**. Same blocker as other PDF sources — **ninth** use case for the PDF parser path.
- **Permission email:** Sent 2026-05-10 to `info@caa.gov.md` (general inbox; note domain is `caa.gov.md` while website is `caa.md` — if v1 bounces, retry via `caa.md`-domain inbox or contact form). Phone +373 22 823 500. Email cited Latvia CAA, Lithuania TKA, and Finland Traficom as small-EU peer comparables. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## MCAA Mongolia — The Civil Aviation Authority of Mongolia

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration; PDF bulk exists but stale)
- **Source URL:** https://www.mcaa.gov.mn/ (English landing) + https://mcaa.gov.mn/?p=1758 (legacy register page) + https://www.mcaa.gov.mn/t7mhit9.polynosic/?lang=en (current register section, JS-rendered)
- **Bulk download URL:** Direct PDF at https://mcaa.gov.mn/PDF/REGISTER.PDF — last surfaced version dated **2022-07-16** (~3 years stale at recon time). Email asks for refresh cadence confirmation.
- **License:** Pending verification. No explicit license declaration on registry pages. Pass 2 cross-check confirmed no data.gov.mn / opendata.gov.mn listing for MCAA aircraft data — Mongolia does not appear to have a national open-data portal that includes aviation.
- **Update cadence:** **Concerning** — only 2022-07-16 version surfaced; email explicitly asks for current cadence.
- **Format note (engineering):** Bulk file is **PDF**. Same blocker as other PDF sources — joins the now-large PDF parser path use-case set. Email asks for structured-format upgrade (CSV/XLSX/JSON) which would help downstream consumption.
- **Recon depth:** **Two-pass** (per AGENTS recon-first rule). Pass 1: register URL + format. Pass 2: open-data portal cross-check + alternate-domain check + page fetch attempts.
- **Permission email:** Sent 2026-05-10 to `info@mcaa.gov.mn` (general Authority inbox; phone +976 71282064). Email cited Latvia CAA, Lithuania TKA as peer comparables and explicitly asked for license + refresh-cadence confirmation + structured-format upgrade. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## IACM Mozambique — Instituto de Aviação Civil de Moçambique

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration; no bulk channel discoverable; no canonical public consultation URL surfaced)
- **Source URL:** https://www.iacm.gov.mz/ (institutional landing); register-specific page not surfaced during recon
- **Bulk download URL:** **None published.** No bulk file or consultation portal discoverable from public-facing IACM materials.
- **License:** Pending verification. No explicit license declaration found.
- **Update cadence:** TBD
- **Format note (engineering):** No bulk file, no consultation portal — IACM has the weakest public discoverability of any African agency recon'd so far. Yes-reply must include both license clearance AND publication channel.
- **Recon depth:** **Two-pass** (per AGENTS recon-first rule). Pass 1: register URL search returned only technical regulatory documents (MOZCATS standards), not the register itself. Pass 2: contact discovery + attempted public-page surface — no consultation URL found.
- **Permission email:** Sent 2026-05-10 to `info@iacm.gov.mz` (general inbox) cc `geral@iacm.gov.mz`. Phone +258 82 3021250; address Alameda do Aeroporto, C. Postal 227, Maputo. Email cited Latvia CAA, Lithuania TKA as peer comparables and explicitly asked for license + bulk channel + canonical public URL. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## ACG Montenegro — Agencija za civilno vazduhoplovstvo Crne Gore

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration; copyright boilerplate footer only)
- **Source URL:** https://www.caa.me/en/registri (English) + https://www.caa.me/me/registri (Montenegrin/Serbian)
- **Bulk download URL:** **HTML scrape** — register published as a paginated HTML table (~7 pages, ~70 aircraft) with per-aircraft detail pages at `/en/4o-XXX`. Searchable by manufacturer / aircraft model / operator. Drupal 7 site. Pattern matches Estonia Transpordiamet and Georgia GCAA.
- **Schema (verified by direct fetch 2026-05-10):** Registarska oznaka (Registration mark, 4O-XXX) / Redni broj u registru (Registry sequence) / Ime (Owner/Operator name — visible) / Tip (Aircraft type). Detail pages at `/en/4o-XXX` likely have additional aircraft data.
- **License:** Pending verification. Site footer asserts _"Copyright © 2016 CAA Montenegro"_ — copyright assertion + boilerplate (note dated 2016, suggesting infrequent footer updates). No explicit reuse permission declared.
- **Update cadence:** Continuous (Drupal 7 CMS — operators add/remove via admin interface; no batch refresh schedule)
- **Format note (engineering):** **HTML scrape** required — pagination + per-aircraft detail-page traversal. Pattern matches Estonia (HTML scrape) and Georgia GCAA (HTML scrape). Engine handles csv/ods/xlsx; HTML scraping is a separate format adapter (would be reusable for Estonia + Georgia + Macedonia future scrapes).
- **Permission email:** Sent 2026-05-10 to `acv@caa.me` (general Agency inbox; site does not surface a register-specific desk). Phone +382 20 625 507; address Josip Broza Tito bb, 81000 Podgorica. Email cited Latvia CAA, Lithuania TKA, and Finland Traficom as small-EU peer comparables. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## DGAC Guatemala — Dirección General de Aeronáutica Civil

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration; no bulk channel discoverable)
- **Source URL:** https://www.dgac.gob.gt/registro-aeronautico-nacional/ (description) + http://cass.dgac.gob.gt:8080/cass/servlet/consultaaeronaves (legacy Java/Tomcat consultation portal on non-standard port :8080)
- **Bulk download URL:** **None published.** Only per-aircraft consultation portal (search-only) on a legacy `:8080` URL — likely a Java application server. Pattern matches Chile DGAC, Colombia UAEAC, Dominican Republic IDAC.
- **License:** Pending verification. No explicit license declaration on the Registry pages.
- **Update cadence:** TBD (consultation portal presumably current; bulk refresh schedule not relevant absent a bulk channel)
- **Format note (engineering):** No bulk file exists. The legacy `:8080/cass/servlet/` Java endpoint suggests an older system unlikely to support a clean export channel without explicit DGAC effort.
- **Permission email:** Sent 2026-05-10 to `registro.aeronautico@dgac.gob.gt` (register-specific desk; phone +502 2321-5130). Email cited Latvia CAA, Lithuania TKA as peer comparables. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## IDAC Dominican Republic — Instituto Dominicano de Aviación Civil

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration; no bulk channel discoverable)
- **Source URL:** https://www.idac.gob.do/en/national-aircraft-regulatory-and-registry-directorate/ (description) + https://serviciosvirtualestac.idac.gob.do/ConsultaAeronaves/ (public consultation portal)
- **Bulk download URL:** **None published.** Only per-aircraft consultation portal (search-only). datos.gob.do has IDAC organization page but the aircraft register is not catalogued there. Pattern matches Chile DGAC, Colombia UAEAC, Sweden Transportstyrelsen.
- **License:** Pending verification. No explicit license declaration on the Registry pages.
- **Update cadence:** TBD (consultation portal presumably current; bulk refresh schedule not relevant absent a bulk channel)
- **Format note (engineering):** No bulk file exists. If IDAC reply confirms permission, would require establishing a new export channel via correspondence (potentially via datos.gob.do listing).
- **Domain note:** Website is on `idac.gob.do` (`.gob` — Spanish-style government TLD); email is on `idac.gov.do` (`.gov` — English-style government TLD). The `.gob.do` mail domain does NOT accept email — confirmed by v1 bounce.
- **Permission email:** v1 sent 2026-05-10 to `info@idac.gob.do` **bounced** (address couldn't be found — `.gob.do` does not host IDAC mailboxes). v2 sent 2026-05-10 to `info@idac.gov.do` cc `direccion@idac.gov.do` (both accepted) cc ~~`contacto@idac.gov.do`~~ (also bounced — CANSO directory entry stale). Two of three v2 recipients delivered, message effectively sent. Phone +1 809-221-7909; address Ave. México Esq. 30 de Marzo, Santo Domingo. Plain-text body per Option A (markdown stripped at send time). Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## DGAC Chile — Dirección General de Aeronáutica Civil

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration; no bulk channel discoverable)
- **Source URL:** https://www.dgac.gob.cl/aeronaves-2/registro-nacional-de-aeronaves/ (description) + https://servicios.dgac.gob.cl/rna-web/publico.html (public consultation portal)
- **Bulk download URL:** **None published.** Only per-aircraft consultation portal (search-only). Login-walled administrative portal at `servicios.dgac.gob.cl/rna-web/`. Pattern matches Sweden Transportstyrelsen, Italy ENAC, Iceland ICETRA — yes-reply must clear **both** license and bulk access channel.
- **License:** Pending verification. No explicit license declaration on the Registry pages. datos.gob.cl exists as Chile's open-data portal but the Registro Nacional de Aeronaves is not catalogued there (search did not surface it).
- **Update cadence:** TBD (consultation portal is presumably current; bulk refresh schedule not relevant absent a bulk channel)
- **Format note (engineering):** No bulk file exists. If DGAC reply confirms permission, would require establishing a new export channel via correspondence.
- **Permission email:** v1 (Spanish) sent 2026-05-10 to `registro.aeronaves@dgac.gob.cl` (draft `r-1087699892897272722`); **v2 (English) sent 2026-05-10 to same address per English-first strategy** (draft `r-1888376151312130960`). v1 to be deleted before sending — strategy is English-first to all agencies regardless of primary language. Phone (56 2) 24392460 / (56 2) 24392488; address Miguel Claro 1314, Providencia, Santiago. Email cited Latvia CAA, Lithuania TKA as peer comparables. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## DINACIA Uruguay — Dirección Nacional de Aviación Civil e Infraestructura Aeronáutica

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration; bulk channel reported but not directly verified)
- **Source URL:** https://www.dinacia.gub.uy/ (institutional landing); register-specific section unverified pending DINACIA reply
- **Bulk download URL:** **Reported but not verified.** Third-party reference (l2baviation) indicates DINACIA publishes the register as XLSX downloadable from the "Aeronaves" section, but direct file URL not surfaced from accessible site content. Email asks for canonical URL confirmation.
- **License:** Pending verification. No explicit license declaration on the site materials.
- **Update cadence:** TBD
- **Format note (engineering):** If reported XLSX bulk file is confirmed, format is **engine-native** (xlsx supported). No parser work needed if license + bulk URL clear together.
- **Permission email:** Sent 2026-05-10 to `dinacia@dinacia.gub.uy` (general inbox) cc `certaero@dinacia.gub.uy` (certificate submissions — likely register-adjacent). Phone +598 2604 0408; address Av. Wilson Ferreira Aldunate 5519, Montevideo. Email cited Latvia CAA, Lithuania TKA as peer comparables and explicitly asks for bulk URL confirmation. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## UZCAA Uzbekistan — State Civil Aviation Inspectorate (via parent Ministry of Transport)

- **Status:** Future — permission request sent 2026-05-11 via parent Ministry of Transport; awaiting reply
- **Classification:** Unknown — leans Open given Uzbekistan's explicit open-data legal framework (verified 2026-05-11 via Uzbekistan VPN user browsing of gov.uz pages)
- **Source URL:** https://gov.uz/en/mintrans (Ministry of Transport) + uzcaa.uz (UZCAA — TLS handshake fails from US sandbox; likely TLS-config issue rather than geo-block based on user-reported reachability from Uzbekistan)
- **Bulk download URL:** TBD — UK- prefix; per WebSearch the page uzcaa.uz/en/registries exists but direct fetch unsuccessful from sandbox.
- **License:** **Pending verification — leans Open.** Uzbekistan has an explicit published open-data legal framework documented on gov.uz: (a) Law of the Republic of Uzbekistan No. 400-I (24 April 1997) "On Guarantees and Freedom of Access to Information"; (b) Resolution of the President No. PQ-4273 (4 September 2019) "On additional measures to ensure the openness and transparency of state administration"; (c) Resolution of the Cabinet of Ministers No. 808 (23 December 2020) "On measures to further develop the field of open data in the Republic of Uzbekistan" + the CONCEPT for the development of the open-data field 2021–2025. Permission email cites this framework directly and asks whether the aircraft register qualifies as an open dataset under it.
- **Update cadence:** TBD
- **Contact-discovery note:** UZCAA's own site (uzcaa.uz) returns TLS handshake failure from the US sandbox. Per user verification via Uzbekistan VPN 2026-05-11: the canonical Ministry of Transport contact published on gov.uz is `info@mintrans.uz`, with Minister Mahkamov Ilhom Rustamovich as the head of the parent ministry. Email routed via parent Ministry with explicit forward request to UZCAA (same pattern as Morocco DGAC routing via DCCsiteweb@transport.gov.ma).
- **Permission email:** Sent 2026-05-11 to `info@mintrans.uz` addressed to Minister Mahkamov Ilhom Rustamovich. Body cites Uzbekistan open-data legal framework (Law 400-I, Resolution PQ-4273, Resolution 808 + CONCEPT 2021-2025) and Law O'RQ-547 (2 July 2019) "On Personal Data" for the PII handling commitment. Asks Ministry to forward to UZCAA / State Civil Aviation Inspectorate if Ministry is not the appropriate desk. Plain-text body per Option A; closing greeting in Uzbek ("Hurmat bilan"). Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## UAEAC Colombia — Unidad Administrativa Especial de Aeronáutica Civil

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration; no bulk channel discoverable)
- **Source URL:** https://www.aerocivil.gov.co/autoridad_aeronautica/publicaciones/3704/registro-de-aeronaves/ (description) + https://www.aerocivil.gov.co/consulta-en-linea/consulta-de-matriculas-de-aeronaves (public consultation portal)
- **Bulk download URL:** **None published.** Only per-aircraft consultation portal (search-only). Pattern matches Chile DGAC, Sweden Transportstyrelsen, Italy ENAC — yes-reply must clear **both** license and bulk access channel.
- **License:** Pending verification. No explicit license declaration on the Registry pages. datos.gov.co listing search confirmed: only Aerocivil procurement (SECOP) datasets are surfaced; aircraft register absent.
- **Update cadence:** TBD (consultation portal presumably current; bulk refresh schedule not relevant absent a bulk channel)
- **Format note (engineering):** No bulk file exists. If UAEAC reply confirms permission, would require establishing a new export channel via correspondence.
- **Permission email:** Sent 2026-05-10 to `atencionalciudadano@aerocivil.gov.co` (Citizen Attention; site does not surface a register-specific desk publicly). Phone +57 (601) 425 1000; address Avenida El Dorado 103-15, Bogotá. Email cited Latvia CAA, Lithuania TKA as peer comparables. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## ANAC Togo — Agence Nationale de l'Aviation Civile du Togo

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration; no bulk channel discoverable)
- **Source URL:** https://www.anac-togo.tg/espace-professionnel/aeronefs/consultation-du-registre-dimmatriculation/ (consultation portal) + https://www.anac-togo.tg/ (institutional landing)
- **Bulk download URL:** **None published.** Consultation portal is search-only; documents page at `anac-togo.tg/documents-a-telecharger/` exists but does not surface the register PDF.
- **License:** Pending verification. No explicit license declaration on the Registry pages.
- **Update cadence:** **Concerning** — third-party references cite last-updated date of 2022-07-16 (~3 years stale at recon time). Email asks for confirmation.
- **Format note (engineering):** No bulk file. If ANAC reply confirms permission, would require establishing a new export channel via correspondence.
- **Recon depth:** **Two-pass** (per AGENTS recon-first rule). Pass 1: register URL + format. Pass 2: open-data portal cross-check (Geodata Togo + Togo Open Data for Africa — neither lists aviation) + contact discovery + page-fetch attempts.
- **Permission email:** Sent 2026-05-10 to `anac@anac-togo.tg` (general inbox) cc `secretariat@anac-togo.tg`. Phone +228 22263740; address B.P. 2699 Lomé. Email cited Latvia CAA, Lithuania TKA as peer comparables and explicitly asked for license + bulk channel + refresh cadence. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## AAC Albania — Autoriteti i Aviacionit Civil të Shqipërisë (Albanian Civil Aviation Authority)

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration; ZA- prefix; small register)
- **Source URL:** https://www.aac.gov.al/ (institutional landing; register-specific page not surfaced via static fetch)
- **Bulk download URL:** None known. Static-fetch did not surface a register page or bulk download.
- **License:** Pending verification.
- **Domain note:** Web domain is `aac.gov.al` (routes through central Albanian gov mail). Email domain per ATC Network contact field is `acaa.gov.al` (dedicated M365 mail infra, distinct from web domain). DNS confirms both domains live with separate mail handling.
- **Permission email:** v1 to `info@aac.gov.al` superseded before send (pattern guess; would have routed via central `mail.gov.al` relay). v2 sent 2026-05-10 to `info@acaa.gov.al` (verified via ATC Network mailto link; M365 MX confirmed via DNS dig — `acaa-gov-al.mail.protection.outlook.com`). Plain-text body per Option A. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## HCAA Greece — Hellenic Civil Aviation Authority (Υπηρεσία Πολιτικής Αεροπορίας)

- **Status:** Future — permission request sent 2026-05-10 (v2 with structured subject per HCAA routing rules), awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration; SX- prefix)
- **Source URL:** https://hcaa.gov.gr/en (current authority site) + http://www.ypa.gr/en/flight-safety/aircraft-register/ (legacy register page)
- **Bulk download URL:** TBD — DAAR (Flight Standards Directorate, Department of Airworthiness and Aircraft Register) maintains the register. data.gov.gr cross-check pending.
- **License:** Pending verification. EU PSI Directive may apply.
- **Routing note (user-provided):** `info@hcaa.gov.gr` is the routing inbox for Flight Standards Directorate (A2). Subject line follows a strict format: `[Part of Regulation] — [Document Type] — [Carrier or Name]`. Closest fit for an aircraft-register licensing request is Part-21 + Certificate Issuance.
- **Permission email:** v1 (unstructured subject) superseded before send. v2 sent 2026-05-10 to `info@hcaa.gov.gr` with structured subject `Part-21 — Certificate Issuance — Ashley CHILDRESS` per HCAA routing rules. Body opens with a note acknowledging the menu-fit is imperfect (this is a policy/redistribution question, not an actual Certificate Issuance) and asks for forwarding if needed. Plain-text body per Option A. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## ULC Poland — Urząd Lotnictwa Cywilnego (Polish Civil Aviation Authority)

- **Status:** Future — permission request sent 2026-05-10 (v2 to register-relevant department), awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration; SP- prefix)
- **Source URL:** https://ulc.gov.pl/technika-lotnicza/rejestr-cywilnych-statkow-powietrznych (Rejestr Cywilnych Statków Powietrznych) + https://bip.ulc.gov.pl/rejestry (BIP ULC — Public Information Bulletin)
- **Bulk download URL:** TBD — dane.gov.pl cross-check pending.
- **License:** Pending verification. EU PSI Directive + Polish public-information access law may apply (BIP listing is a legal-mandate disclosure venue).
- **Permission email:** v1 to `kancelaria@ulc.gov.pl` (Chancellery, standard PL gov pattern) superseded before send. v2 sent 2026-05-10 to `ltt@ulc.gov.pl` (Department of Airworthiness; Director Marcin Perkowski, Deputy Director Justyna Iglewska; phone 22 520 73 36, fax 22 520 73 73 — user-provided from ULC site). Plain-text body per Option A. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## ANAC Portugal — Autoridade Nacional da Aviação Civil

- **Status:** Future — permission request submitted via webform 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration; CS- prefix)
- **Source URL:** https://www.anac.pt/vPT/Generico/Aeronaves/RegistoAeronauticoNacional/Paginas/RegistoAeronauticoNacional.aspx (RAN — Registo Aeronáutico Nacional)
- **Bulk download URL:** None published. Per-record certified information available on request via RAN.
- **License:** Pending verification. EU PSI Directive may apply.
- **Contact channel note:** ANAC's official contact page is **webform-only** — verified that no public email exists for the agency. Routing options on the form include "Direção Jurídica" (Legal Direction) and "Direção de Aeronavegabilidade" (Airworthiness Direction). v1 draft to pattern-guessed `geral@anac.pt` was superseded before send and the body re-submitted via the webform.
- **Permission email:** Submitted 2026-05-10 via webform at https://www.anac.pt/VPT/FOOTER/Paginas/Contactenos.aspx (route: Direção Jurídica or Direção de Aeronavegabilidade). Plain-text body per Option A. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## DGAC Bolivia — Dirección General de Aeronáutica Civil del Estado Plurinacional de Bolivia

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown — leans Open ("Registro Público de Aeronaves" framing is a positive signal); CP- prefix
- **Source URL:** https://www.dgac.gob.bo/registro-publico-de-aeronaves/
- **Bulk download URL:** TBD — page exists but format not surfaced via static fetch
- **License:** Pending verification. No explicit license declaration. The "público" (public) framing on the register name leans toward open access.
- **Permission email:** Sent 2026-05-10 to `dgacbol@dgac.gob.bo` cc `contacto@dgac.gob.bo` (both verified via DGAC site with phone/address). Phone +591-2-2444450; address Av. Arce No 2631, Edificio Multicine Piso 9, La Paz. Plain-text body per Option A. Follow-up due 2026-06-09. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## DGAC Costa Rica — Dirección General de Aviación Civil

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown — TI- prefix
- **Source URL:** https://sub.dgac.go.cr/aeronautica_/registro-aeronautico/
- **Bulk download URL:** TBD — register page exists, format not surfaced via static fetch
- **License:** Pending verification. No license declaration on register page.
- **Contact channel note:** Official ventanilla única (single window) inbox per DGAC contact page — designated as the canonical channel for all procedures and documentation. Email address was Cloudflare-obfuscated in the contact page HTML; decoded via standard CF XOR pattern.
- **Permission email:** Sent 2026-05-10 to `ventanillaunica@dgac.go.cr` (Cloudflare-decoded). Phone (506) 2242-8000; address La Uruca, San José. Plain-text body per Option A. Body asks for forward to Registro Aeronáutico desk if not the right route. Follow-up due 2026-06-09. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## DGAC Ecuador — Dirección General de Aviación Civil

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown — open-data portal presence is a positive signal; HC- prefix
- **Source URL:** https://www.aviacioncivil.gob.ec/registro-aeronautico/ (Registro Aeronáutico) + https://datosabiertos.gob.ec/organization/dgac (DGAC org page on Ecuador open-data portal)
- **Bulk download URL:** TBD — register page exists; DGAC publishes other datasets on datosabiertos.gob.ec but the aircraft register itself is not yet on the portal.
- **License:** Pending verification. Open-data portal presence is a positive signal — body explicitly asks whether the aircraft register would be a candidate for datosabiertos.gob.ec publication.
- **Permission email:** Sent 2026-05-10 to `oswaldo.veloz@aviacioncivil.gob.ec` (Registro Aeronáutico desk — verified via search citing role + email). Phone +593 2 2947400 ext. 4841; address Buenos Aires OE1-53 y Av. 10 de Agosto, Quito. Plain-text body per Option A. Follow-up due 2026-06-09. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## AAC El Salvador — Autoridad de Aviación Civil de El Salvador

- **Status:** Future — v1 to `jsalguero@aac.gob.sv` bounced 2026-05-11 (Salguero no longer on AAC roster — agency reorganized); v2 sent 2026-05-11 to verified register chief; awaiting reply
- **Classification:** Unknown — YS- prefix; Registro de Aviación Civil Salvadoreño (RAS)
- **Source URL:** https://www.aac.gob.sv/registro-aeronautico/
- **Bulk download URL:** TBD — register page exists, format not surfaced via static fetch
- **License:** Pending verification. No license declaration surfaced. El Salvador has an open-government framework on transparencia.gob.sv — body asks about potential tie-in.
- **Contact-discovery note:** Original recon (2026-05-10) addressed Jesús Salguero from a then-current AAC funcionarios page. He has since been replaced; mailbox does not exist on the current AAC server (Google Workspace MX, strict mailbox validation). Re-probed AAC funcionarios page 2026-05-11 with Cloudflare-decoded emails (page uses CF email obfuscation; only 2 of 37 emails were visible in raw hrefs — the rest required decoding). Current register-relevant contacts: **Licda. Carolina Canizalez, Jefe del Registro de Aviación Civil Salvadoreño** (rarevalo@aac.gob.sv, phone +503 2565-4413 — note name/email-prefix mismatch indicates recent handover, but mailbox is in use per page listing); **Lic. Homero Morales, Director Ejecutivo** (hmorales@aac.gob.sv, phone 2565-4406). Other potentially relevant: TMA Miguel Chorro, Jefe de Estándares de Vuelo - Aeronavegabilidad (mchorro@); Ing. Renato Neira, Jefe de Departamento de Ingeniería Aeronáutica (rneira@); P.A. Jaime Palomares, Subdirector de Seguridad de Vuelo (jpalomares@); TMA Adrián Martínez, Jefe de Certificaciones (amartinez@). Current Presidente del CDAC is Ing. Jorge Puquirre (jpuquirre@).
- **Permission email:** v1 to `jsalguero@aac.gob.sv` bounced 2026-05-11 (Salguero off roster). v2 sent 2026-05-11 to `rarevalo@aac.gob.sv` (Canizalez, Jefe RAS) cc `hmorales@aac.gob.sv` (Morales, Director Ejecutivo). Phone (registro desk) +503 2565-4413; address Km 9 1/2 carretera Panamericana, Ilopango. Plain-text body per Option A. Body explicitly acknowledges the v1 bounce and notes the current routing. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** v1 bounce NDR received 2026-05-11 (preserved verbatim per AGENTS.md): _"Your message wasn't delivered to jsalguero@aac.gob.sv because the address couldn't be found, or is unable to receive mail."_ Substantive reply on v2 still pending.

---

## AHAC Honduras — Agencia Hondureña de Aeronáutica Civil

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown — HR- prefix; Departamento de Registro Aeronáutico Nacional (RAN) under Decreto No. 55-2004 (Ley de Aeronáutica Civil)
- **Source URL:** https://www.ahac.gob.hn/RAN
- **Bulk download URL:** TBD — register page exists, format not surfaced via static fetch
- **License:** Pending verification. No license declaration surfaced.
- **Permission email:** Sent 2026-05-10 to `secretariaadministrativa@ahac.gob.hn` cc `licencias@ahac.gob.hn` (both verified via AHAC site as dept mailboxes). Plain-text body per Option A. Body cites Decreto 55-2004 and asks for forward to RAN dept if not the right route. Follow-up due 2026-06-09. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## INAC Nicaragua — Instituto Nicaragüense de Aeronáutica Civil

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown — YN- prefix
- **Source URL:** https://www.inac.gob.ni/
- **Bulk download URL:** TBD — institutional landing; no register-specific page surfaced via static fetch
- **License:** Pending verification. No license declaration surfaced. INAC is an autonomous technical entity under the Ley General de Aeronáutica Civil (Law 595, October 2006).
- **Permission email:** Sent 2026-05-10 to `info@inac.gob.ni` (verified via INAC contact page). Phone (505) 2276-8580 / 2233-2907; address KM 11.5 Carretera Norte, Managua. Plain-text body per Option A. Body asks for forward to register dept if not the right route. Follow-up due 2026-06-09. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## AAC Panama — Autoridad de Aeronáutica Civil de Panamá

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown — HP- prefix; Sistema Nacional de Registro Aeronáutico (SNRA) hosts the Registro Aeronáutico Civil de Panamá (R.A.C.P.)
- **Source URL:** https://sigob.aeronautica.gob.pa/snra/subtipo/2 (R.A.C.P. search portal within the SNRA)
- **Bulk download URL:** TBD — search portal pattern; AAC has organization page on `datosabiertos.gob.pa` (open-data portal presence is a positive signal).
- **License:** Pending verification. No license declaration surfaced.
- **Permission email:** Sent 2026-05-10 to `Rafael.barcenas@aeronautica.gob.pa` cc `paola.aparicio@aeronautica.gob.pa` (named officials verified via ATC Network with phone/address). Phone +507 520-1555; address Albrook, Calle Héctor Conte Bermúdez Edificio 646, Panamá 5. Plain-text body per Option A. Body asks whether the R.A.C.P. could be eligible for publication on `datosabiertos.gob.pa`. Follow-up due 2026-06-09. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## DINAC Paraguay — Dirección Nacional de Aeronáutica Civil

- **Status:** Future — permission request sent 2026-05-10; routing acknowledgment received 2026-05-11 from Registro Aeronáutico Nacional (RAN) desk; substantive license reply still pending
- **Classification:** Unknown — ZP- prefix; Registro Aeronáutico Nacional (RAN) governed by DINAC R-47
- **Source URL:** https://www.dinac.gov.py/
- **Bulk download URL:** TBD — institutional landing; format not surfaced via static fetch. DINAC R-47 PDF available at https://www.dinac.gov.py/Seguridad_Operacional/docs/DINAC_R47_APROBADA_04_10_2021.pdf
- **License:** Pending verification. No license declaration surfaced.
- **Internal routing confirmed (2026-05-11):** DINAC Secretaría General forwarded the request internally to the RAN desk. **Nieves Bobadilla**, Registro Aeronáutico Nacional (RAN), Dirección Nacional de Aeronáutica Civil, acknowledged receipt directly with CC to anchildress1@gmail.com. Direct register-desk contact established. For any follow-up before the 30-day mark, route via Ms. Bobadilla at RAN rather than re-emailing Secretaría General.
- **Permission email:** Sent 2026-05-10 to `sec_gral@dinac.gov.py` (External Document Reception per DINAC site — designated formal correspondence channel). Phone +595 21 211 366 / +595 21 212530. Plain-text body per Option A. Body cites DINAC R-47 and asks for forward to RAN desk if not the right route — routing was performed exactly as requested. Follow-up due 2026-06-09 if no substantive reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** Internal forwarding chain received 2026-05-11 (preserved verbatim per AGENTS.md):

  > Buen día
  >
  > Recibido
  >
  > Nieves Bobadilla.
  >
  > Registro Aeronáutico Nacional
  > (RAN)
  > Dirección Nacional de Aeronáutica Civil
  > República del Paraguay
  >
  > De: Secretaría General Enviado: lunes, 11 de mayo de 2026 8:15:52 Para: ran Cc: anchildress1@gmail.com Asunto: RV: Permission to redistribute the Paraguayan Civil Aircraft Register with attribution
  >
  > Eikuaauka og̃uahéva (Guaraní)
  > Favor acusar recibo (Spanish)
  >
  > Maitei rorýmante (Guaraní)
  > Saludos cordiales (Spanish)
  >
  > Secretaría General
  > Dirección Nacional de Aeronáutica Civil - DINAC
  > Teléfono: +595 21 212530
  > Dirección: Mariscal López esquina 22 de setiembre
  > Ministerio De Defensa Nacional - Piso 2°

  Literal English translation: "Good morning. Received. Nieves Bobadilla. Registro Aeronáutico Nacional (RAN), Dirección Nacional de Aeronáutica Civil, Republic of Paraguay." Forwarding chain: "From: Secretaría General. Sent: Monday, May 11, 2026 8:15:52. To: ran. Cc: anchildress1@gmail.com. Subject: RV: Permission to redistribute the Paraguayan Civil Aircraft Register with attribution." Bilingual Guaraní/Spanish footer: "Please acknowledge receipt. / Cordial greetings. Secretaría General, DINAC. Phone: +595 21 212530. Address: Mariscal López corner 22 de setiembre, Ministry of National Defence, 2nd floor."

  This is a routing acknowledgment, not a substantive license reply. It confirms (a) email delivery, (b) DINAC's Secretaría General routed the request to the correct desk (RAN) exactly as the body requested, (c) Nieves Bobadilla at RAN has the file. Posture remains Unknown; 30-day public-record fallback clock continues from 2026-05-10. Substantive reply on license + bulk-file format still pending.

---

## DGAC Peru — Dirección General de Aeronáutica Civil (Ministerio de Transportes y Comunicaciones)

- **Status:** Future — permission request sent 2026-05-10 to pmarin@ (assumed delivered) cc ncarhuay@ (bounced 2026-05-11); awaiting substantive reply
- **Classification:** Unknown — OB- prefix; under MTC umbrella
- **Source URL:** https://portal.mtc.gob.pe/transportes/aeronautica_civil/ (DGAC public-facing page within MTC portal)
- **Bulk download URL:** TBD — search-only consultation pattern; datos.gob.pe cross-check pending. SIVLAM (sivlam.mtc.gob.pe) is for pilot-license queries, not aircraft register.
- **License:** Pending verification. No license declaration surfaced.
- **Permission email:** Sent 2026-05-10 to `pmarin@mtc.gob.pe` cc ~~`ncarhuay@mtc.gob.pe`~~ (DGAC officials originally sourced via ATC Network with named addresses). Phone +511 6157800 ext. 1173; address Zorritos Nº 1203, Lima 1. Plain-text body per Option A. Body asks for forward to Dirección de Certificaciones y Autorizaciones or Registro Aeronáutico if not the right desk. CC `ncarhuay@mtc.gob.pe` bounced 2026-05-11 ("address couldn't be found, or is unable to receive mail"); drop from any follow-up. Primary `pmarin@mtc.gob.pe` not in bounce — assumed delivered. Follow-up due 2026-06-09 if no substantive reply. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** Bounce NDR received 2026-05-11 (preserved verbatim per AGENTS.md): _"Your message wasn't delivered to ncarhuay@mtc.gob.pe because the address couldn't be found, or is unable to receive mail."_ Substantive reply pending; CC dead but primary remains in flight.

---

## CAA Slovenia — Javna agencija za civilno letalstvo Republike Slovenije (Civil Aviation Agency of Slovenia)

- **Status:** Future — permission request sent 2026-05-10 (v2 to register-specific desk), awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration; S5- prefix)
- **Source URL:** https://www.caa.si/register-zrakoplovov.html (register page in Slovenian) + https://register.caa.si/ (eCAA public consultation portal)
- **Bulk download URL:** TBD — podatki.gov.si cross-check pending.
- **License:** Pending verification. EU PSI Directive may apply.
- **Permission email:** v1 to generic `info@caa.si` superseded before send. v2 sent 2026-05-10 to `matej.dolinar@caa.si` (Matej Dolinar, Airworthiness Division / Sektor za plovnost — verified via search snippet; phone 01 244 66 34) cc `info@caa.si` (general). Body cites Latvia CAA (CC0 on data.gov.lv), Lithuania TKA (CC BY 4.0 on data.gov.lt Spinta API), and Finland Traficom (CC BY 4.0 on avoindata.fi) as Baltic+Nordic peer comparables. Plain-text body per Option A. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## AAC Cabo Verde — Agência de Aviação Civil de Cabo Verde

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration; no bulk channel discoverable)
- **Source URL:** https://www.aac.cv/artigos/registo-aeronautico (current path) + https://www.aac.cv/aeronaves-aac/registo-de-aeronaves.html (legacy path noted by third-party)
- **Bulk download URL:** **None published.** Web-page list only; no CSV/XLSX/PDF/JSON export discoverable.
- **License:** Pending verification. No explicit license declaration on registry pages. Cabo Verde does not appear to have a national open-data portal (no `dados.gov.cv` discoverable for aviation data).
- **Update cadence:** TBD
- **Format note (engineering):** No bulk file. Likely HTML scrape if AAC reply confirms permission without offering structured data.
- **Recon depth:** **Two-pass** (per AGENTS recon-first rule). Pass 1: register URL + format. Pass 2: open-data portal cross-check (no `dados.gov.cv` aviation portal) + contact discovery.
- **Permission email:** Sent 2026-05-10 to `info@aac.cv` (general AAC inbox; phone +238 260 34 30; address Achada Grande Frente, Praia CP371). Email cited Latvia CAA, Lithuania TKA as peer comparables and asked for license + bulk channel. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## OFNAC Haiti — Office National de l'Aviation Civile

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration; no bulk channel; no general or registry-specific email surfaced publicly)
- **Source URL:** https://ofnac.gouv.ht/ (institutional landing) + https://registreimm.net/aircraftSearchingView (consultation portal — separate domain, hosted by/for OFNAC)
- **Bulk download URL:** **None published.** Consultation portal is search-only; no CSV/XLSX/PDF/JSON export.
- **License:** Pending verification. No explicit license declaration on registry pages.
- **Update cadence:** Third-party reference cites 2026-04-16 (recent at recon time) — register appears actively maintained despite domestic context.
- **Format note (engineering):** No bulk file. Yes-reply must include both license and bulk channel.
- **Operational context:** Haiti has been experiencing prolonged political instability and security challenges; response timelines may be impacted. Email acknowledges this and offers to suspend on request.
- **Contact discoverability:** **Unusual** — OFNAC contact page lists only phones (+509 29102224, +509 29102226), fax (BP 1346), and physical address (11, Boulevard Toussaint Louverture). **No general inbox email published on the OFNAC site.** Only `division.ais@ofnac.gouv.ht` (Aeronautical Information Division) surfaced from third-party documents. Email asks for the correct correspondence channel.
- **Recon depth:** **Two-pass** (per AGENTS recon-first rule). Pass 1: register URL + format. Pass 2: contact page fetch (no email visible) + targeted email search to surface `division.ais@`.
- **Permission email:** Sent 2026-05-10 to `division.ais@ofnac.gouv.ht` (Aeronautical Information Division — only confirmed OFNAC email; body asks them to forward to register-responsible office). Email cited Latvia CAA, Lithuania TKA as peer comparables and explicitly asked for license + bulk channel + correct correspondence channel. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## CCAA — Croatian Civil Aviation Agency (Hrvatska agencija za civilno zrakoplovstvo)

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration found; explicit copyright notice only)
- **Source URL:** https://www.ccaa.hr/en/list-of-registered-aircraft-94674 (English) + https://www.ccaa.hr/popis-registriranih-zrakoplova-64123 (Croatian)
- **Bulk download URL:** Direct PDF on hash-stamped path, e.g. https://www.ccaa.hr/file/2714b6440e95696d4822bbfcc5ada5086ac7 (April 1, 2026 snapshot; ~250 aircraft across 26 pages). Updated **first day of each month** per the publishing page.
- **Schema (verified by direct PDF fetch 2026-05-10):** Registration mark (LZ-XXX) / Registry sequence number / Manufacturer / Aircraft type / Serial number / Owner / Address.
- **PII pre-handling at source (partial):** Private individuals' names are masked as **"Fizička osoba"** (Natural person) but **company names AND addresses are fully visible**. GDPR-compliant baseline — natural persons protected, legal entities not (legal-entity data is not GDPR-protected). Compatible with our PRD CC.4 PII drop policy; we'd still drop addresses at mapping per project rules.
- **License:** Pending verification. CCAA's page footer asserts _"Copyright © 2019 - 2026 Croatian Civil Aviation Agency"_ — explicit copyright assertion. Page also carries a publishing disclaimer (verbatim English): _"Agency does not guarantee the completeness and accuracy of data in the table after it is published on the Agency's website. Since data is subject to everyday changes, the users are instructed to address the Agency and check the precise data in the manually kept main book of the Croatian Register of Civil Aircraft."_ This is an **accuracy disclaimer**, not a redistribution restriction. Default copyright applies absent a permission grant. Same pattern as Switzerland FOCA, Austria Austro Control, Italy ENAC, Estonia Transpordiamet, Czech Republic CAA — agency publishes data on its own site without an open-data declaration.
- **Update cadence:** Monthly (first day of each month per publishing page)
- **Format note (engineering):** Bulk file is **PDF**, same blocker as Spain AESA + Luxembourg DAC. Engine handles csv/ods/xlsx; PDF parsing is a new format adapter (would be third use-case for that work).
- **Register absent from data.gov.hr** (Croatian open-data portal does not list it).
- **Permission email:** Sent 2026-05-10 to `registar@ccaa.hr` (registry-specific desk; surfaced from CCAA Aircraft Registry contacts page). Email cited Latvia CAA (CC0 on data.gov.lv) and Lithuania TKA (CC BY 4.0 on data.gov.lt) as Baltic peer comparables. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## CAA CR — Civil Aviation Authority of the Czech Republic (Úřad pro civilní letectví)

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration found)
- **Source URL:** https://lr.caa.gov.cz/letecky-rejstrik?lang=en (English UI available)
- **Bulk download URL:** **None published.** The register interface is a JS-rendered SPA (Angular/React) with search-only frontend; no CSV/XLSX/PDF/JSON download discoverable from the public-facing page. Pattern matches Switzerland FOCA, Austria Austro Control, Italy ENAC, Estonia Transpordiamet.
- **License:** No declaration on the register page. **Register absent from data.gov.cz** (Czech national open-data catalog) — site-search returned zero results for "letecký" / "aircraft" datasets from the Civil Aviation Authority. **Notable leverage point:** Czech Republic enacted a 2024 law mandating that "public registries, registers, lists and records maintained by law" be progressively published as open data on data.gov.cz. The aircraft register fits this category but is not yet listed — either compliance gap, awaiting implementation, or claimed exemption. This is a citable legal basis for the request, stronger than peer-comparable.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-10 to `dousova@caa.cz` (Jana Doušová, register department head; cc `podatelna@caa.gov.cz` for formal record). Email led with the Czech 2024 open-data law citation as primary leverage and the Finland Traficom comparable as peer example. Other named register staff for escalation: Milada Jechová (`jechova@caa.cz`), Jana Pospíšilová (`pospisilova@caa.cz`); reception phone +420 225 421 111. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## CAAM — Civil Aviation Authority of Malaysia

- **Status:** Future — permission request submitted via webform 2026-05-05, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.caam.gov.my/
- **Bulk download URL:** TBD (pending CAAM reply confirming canonical URL)
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission request:** Submitted 2026-05-05 via the CAAM general enquiry webform at https://www.caam.gov.my/contact-us/. Trimmed body (~1,700 chars) to fit form character limit. Reply will arrive at `anchildress1@gmail.com`. Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template basis: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## CAASL — Civil Aviation Authority of Sri Lanka

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.caa.lk/en/downloads/sl-aircraft-register
- **Bulk download URL:** TBD (PDF download link present on register page; format unverified)
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-05 to `daw@caa.lk` (Mr. Mahilal Dushyantha Ratnayake, Director — Aircraft Registration and Airworthiness; cc: `scaiaras@caa.lk`, Senior Civil Aviation Inspector — Aircraft Registration and Airworthiness Standards). Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## CASA PNG — Civil Aviation Safety Authority of Papua New Guinea

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://casapng.gov.pg/safety-regulatory/airworthiness/Aircraft-Registers/
- **Bulk download URL:** TBD (PDF format per avcodes; access pattern unverified)
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-05 to `info@casapng.gov.pg` (general inbox; no register-specific desk surfaced publicly). Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_
- **Note on naming:** The agency is referred to as "CASA PNG" throughout this project and in correspondence, to distinguish it from the Civil Aviation Safety Authority of **Australia** (also "CASA"), which is a separate Live source.

---

## DCA Cyprus — Department of Civil Aviation, Ministry of Communications and Works

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.mcw.gov.cy/mcw/dca/dca.nsf/DMLregister_en/DMLregister_en?OpenDocument
- **Bulk download URL:** TBD (Lotus Notes / Domino backend; access pattern requires `?OpenDocument` query)
- **License:** Pending verification (EU PSI Directive principles likely apply in principle).
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-05 to `director@dca.mcw.gov.cy` (DCA Director's institutional inbox). Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## DGCA — Directorate General of Civil Aviation, India

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.dgca.gov.in/
- **Bulk download URL:** TBD (avcodes notes PDF download; canonical URL pending DGCA reply — question included in permission request)
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-05 to `rkanand.dgca@nic.in` and `mdevula.dgca@nic.in` (Mr. R. K. Anand and Mr. M. Devula, both DDGs of the Airworthiness Directorate; equal-rank, addressed jointly to allow internal routing). Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## BCAA — Bahamas Civil Aviation Authority

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://caabahamas.com/registers/
- **Bulk download URL:** TBD (PDF format per avcodes)
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-05 to `atl@caabahamas.com`. Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## BDCA — Belize Department of Civil Aviation

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.civilaviation.gov.bz/index.php/bdca-civil-aircraft-register
- **Bulk download URL:** TBD (PDF / web page list per avcodes)
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-05 to `director@civilaviation.gov.bz` (Director's institutional inbox). Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## CAA Maldives — Maldives Civil Aviation Authority

- **Status:** 🛠️ Cleared — implementation pending (license confirmed by agency 2026-05-11; PDF parser path needed before ingest — same engineering blocker as AESA Spain)
- **Classification:** **Open with attribution + error disclaimer** (reclassified from Unknown 2026-05-11 after substantive reply from Director Airworthiness)
- **Source URL:** https://www.caa.gov.mv/operations/registration-of-aircraft-and-mortgages
- **Bulk download URL:** https://caa.gov.mv/attachments/0Jy9EQclEAaFIxUenyNFxRtphFFSJDK77mj18haV.pdf (direct PDF link from register page; ~70 KB; 8-page register with per-tail entries; 8Q- prefix; page footer disclaimer repeated on each page)
- **License:** **Open with attribution and mandatory error-statement disclaimer.** Confirmed verbatim in writing by Mr. Abdulla Mohamed, Director Airworthiness, Maldives Civil Aviation Authority, on 2026-05-11. Three conditions extracted from the reply: (1) use of the register is **actively encouraged** — machine-friendly format welcomed; (2) attribution "would be nice"; (3) error/accuracy statement equivalent to the one on CAA's published register **must be included**. Functionally same posture as CASA Australia / Traficom Finland CC BY 4.0 with an added Maldives-specific disclaimer requirement.
- **Mandatory error statement (verbatim from CAA Maldives register footer):**

  > Note: Whilst reasonable care is taken compiling the above data, the CAA does not warrant the data is free of error or omission.

  This statement appears on every page of the published register PDF and must be reproduced verbatim in any operator-deployed surface that displays Maldives data.

- **Update cadence:** TBD (page footer "3/26/2026, Page 8 of 8" suggests the register version checked is dated 2026-03-26; refresh cadence unconfirmed but appears to be on-demand / occasional rather than scheduled).
- **Format note (engineering):** Bulk file is **PDF** (same blocker as AESA Spain). The PDF parser path is now required to be in place before either Spain or Maldives can be ingested. PDF structure is per-tail entries with a repeated footer disclaimer that should be parsed as metadata, not as a record row.
- **Permission email:** Sent 2026-05-05 to `airworthiness@caa.gov.mv` (Airworthiness desk — verified correct routing in practice since the reply came from the Director Airworthiness). **Reply no longer gates use** — license confirmed. Thank-you reply being drafted 2026-05-11; not waiting on it.
- **Reply (verbatim):** Received 2026-05-11 from Abdulla Mohamed, Director Airworthiness, Maldives Civil Aviation Authority (preserved verbatim per AGENTS.md):

  > Dear Ashley,
  >
  > 1. Use of register - we actually encourage the use of the register, and a more machine friendly format would be welcome by our users.
  > 2. Attribution - would be nice.
  > 3. Conditions, procedures etc - We feel it would be important to include a statement on errors similar to the one on our register.
  >
  > We thank you for your efforts to improve civil aviation in general.
  >
  > Regards,
  > Abdulla Mohamed Director Airworthiness Maldives Civil Aviation Authority

  This is the **second substantive license-confirming reply** received during the metal-birds-feed permission outreach (Finland Traficom was first, also 2026-05-11). It confirms (a) the CAA Maldives actively encourages redistribution of the register in a machine-friendly format, (b) attribution is welcomed, (c) the no-warranty disclaimer must be replicated alongside any redistributed data. Director Airworthiness is the canonical contact for any future register-related correspondence.

- **Note on naming:** Referred to as "CAA Maldives" in this project to distinguish from the Civil Aviation Authority of Malaysia (also "CAAM") — same acronym, different agencies.

### Required attribution (verbatim, place in README Attribution section)

> Source: Maldives Civil Aviation Authority — https://www.caa.gov.mv/operations/registration-of-aircraft-and-mortgages
>
> Redistributed with permission granted by Mr. Abdulla Mohamed (Director Airworthiness, CAA Maldives) in correspondence dated 2026-05-11. Per CAA Maldives required notice:
>
> > Note: Whilst reasonable care is taken compiling the above data, the CAA does not warrant the data is free of error or omission.
>
> The material has been changed: CAA Maldives aircraft records are normalized into metal-birds-feed's canonical schema. This attribution does not imply endorsement by CAA Maldives.

---

## CAAB — Civil Aviation Authority of Botswana

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.caab.co.bw/caab-content.php?cid=299
- **Bulk download URL:** TBD (PDF download per avcodes)
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-05 to `caab@caab.co.bw`. Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## CAAF — Civil Aviation Authority of Fiji

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.caaf.org.fj/aircraft-register-search/
- **Bulk download URL:** TBD (search-only interface per avcodes)
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-05 to `info@caaf.org.fj`. Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## CAD Malta — Civil Aviation Directorate, Transport Malta

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.transport.gov.mt/aviation/aircraft-flight-standards/registration-of-aircraft-2663
- **Bulk download URL:** TBD (PDF download per avcodes)
- **License:** Pending verification (EU PSI Directive principles likely apply).
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-05 to `civil.aviation@transport.gov.mt`. Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## CARC — Civil Aviation Regulatory Commission, Jordan

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.carc.jo/en/content/344-jordanian-registered-aircraft
- **Bulk download URL:** TBD (web page list per avcodes)
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-05 to `info@carc.gov.jo` (cc: `Bilal.Nazzal@CARC.GOV.JO` — register-related contact). Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## CASAS — Civil Aviation Safety Authority Suriname

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.casas.sr/registry/
- **Bulk download URL:** TBD (searchable database per avcodes)
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-05 to `casasinfo@casas.sr` — decoded from Cloudflare email obfuscation in the casas.sr footer (`__cf_email__` span, XOR key 0x77). Unusual prefix; if it bounces, the decode is suspect and we should re-verify. Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## ECAA — Ethiopian Civil Aviation Authority

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.ecaa.gov.et/home/aircraft-registered-by-the-authority-and-operational-today/
- **Bulk download URL:** TBD (PDF download per avcodes)
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-05 to `caa.airnav@ethionet.et` (Aircraft Registration & Airworthiness Certification Directorate). ECAA contact emails use the legacy `@ethionet.et` domain rather than `@ecaa.gov.et`. Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## ICETRA — Icelandic Transport Authority (Samgöngustofa)

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration found despite portal hunt)
- **Source URL:** https://island.is/en/aircraft-registry
- **Bulk download URL:** **None published.** Recon 2026-05-10 confirmed the register page is **search-only** (by TF- number or owner name); `icetra.is/aviation/aircraft/register` redirects to the same island.is search interface. Iceland has no obvious central open-data catalog (no `data.gov.is` discoverable) and the aircraft register is not surfaced anywhere as a downloadable artifact. Pattern matches Italy ENAC: yes-reply must clear **both** license and a bulk access channel before ingest is feasible.
- **License:** Pending verification. island.is general policy is GDPR/privacy-focused — no aircraft-register-specific license declaration found. Nordic open-data norms generally permissive (Norway uses NLOD, Denmark uses CC BY) but Iceland-specific terms not declared anywhere we could find.
- **Update cadence:** TBD (no published artifact has a refresh schedule)
- **Permission email:** Sent 2026-05-05 to `samgongustofa@samgongustofa.is`. Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## PCAA — Pakistan Civil Aviation Authority

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://apps.caapakistan.com.pk:412/Aircraft/rptArcftRegisterOut.aspx
- **Bulk download URL:** TBD (PDF/Excel download per avcodes)
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-05 to `umair.sufyan@caapakistan.com.pk` (named individual; no register-specific desk surfaced in research). If person has moved roles or is out of office, email may sit unanswered — worth a follow-up if no response. Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## SCAA — Seychelles Civil Aviation Authority

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.scaa.sc/index.php/regulatory/e-registers/aircraft-civil-register
- **Bulk download URL:** TBD (PDF download per avcodes)
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-05 to `secretariat@scaa.sc`. Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## Tajikistan Civil Aviation Agency — Agentii Aviatsiyai Grazhdanii Nazdi Hukumati Chumhurii Tochikiston

- **Status:** Future — permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11 via Tajikistan VPN user browsing)
- **Source URL:** https://caa.tj/ + https://caa.tj/sitemap (site in Tajik Cyrillic — Агентии Авиатсияи Граждании Назди Ҳукумати Ҷумҳурии Тоҷикистон)
- **Bulk download URL:** TBD — EY- prefix
- **License:** Pending verification.
- **Update cadence:** TBD
- **Contact-discovery note:** Site was previously deferred "needs headless verify" because the prior recon report claimed caa.tj redirected to an e-gov SPA shell. User browsing from Tajikistan VPN 2026-05-11 surfaced `info@caa.tj` as a verified live mailto: on the canonical caa.tj/sitemap page — undeferred and routed directly. Sitemap references the Agency Director's office at /tg/direktori-agentii-aviatsiyai-grazhdanii-nazdi-khukumati-chumkhurii-tochikiston.
- **Permission email:** Sent 2026-05-11 to `info@caa.tj`. EY- prefix. Plain-text body per Option A. Body asks for forward to the Director's office or the aircraft registration team if info@ is not the appropriate desk. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## TCAA — Tanzania Civil Aviation Authority

- **Status:** Future — permission request sent (v2 after v1 bounce), awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.tcaa.go.tz/page?p=Aircraft+Registration
- **Bulk download URL:** TBD (web page list per avcodes)
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** **v1 sent 2026-05-05 to `airworthinessinspectors@tcaa.go.tz` (cc: `info@tcaa.go.tz`) — both BOUNCED.** Third-party directory (rocketreach.co) listing was stale. **v2 sent 2026-05-05 to `tcaa@tcaa.go.tz`** (canonical TCAA general inbox). v2 body includes an explicit note that the previous send bounced, so the agency understands it is a re-send rather than a duplicate, and explicitly invites internal routing to whichever desk handles register-redistribution requests. Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`. If v2 also bounces, the next move is the contact form at https://www.tcaa.go.tz/feedback/contacts.
- **Reply (verbatim):** _pending_

---

## TTCAA — Trinidad and Tobago Civil Aviation Authority

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://caa.gov.tt/aircraft-on-ttcaa-register/
- **Bulk download URL:** TBD (searchable database per avcodes)
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-05 to `ttcaa@caa.gov.tt`. Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## GCAA — Georgian Civil Aviation Agency

- **Status:** Future (phase 4) — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://gcaa.ge/civil-aircraft-register/
- **Bulk download URL:** None — register published as HTML table only (~63 aircraft, 6 columns: Owner / Make-Model / Registration / Reg date / Serial / Year built). Owner names include parenthetical English transliterations alongside Mkhedruli script. Trivially scrapeable.
- **License:** Pending verification. No license statement on the register page; OGP member, proactive disclosure under Georgia's General Administrative Code ch. 3 supports the public-record argument.
- **Update cadence:** Unknown (no clear publication schedule on the page).
- **Permission email:** Sent 2026-05-05 to `office@gcaa.ge` in English (per the project-wide English-first strategy decided 2026-05-05). Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_
- **Implementation notes (when v4 begins):** Mode S hex codes are not in the GCAA register; require backfill from a community source (Mictronics database recommended). Schema additions for sparse / non-Latin sources already documented in PRD R3.5 (`owner.name_native`, `icao_hex_source`).

---

## ANAC Algeria — Autorité Nationale de l'Aviation Civile

- **Status:** Future — v2 permission request sent 2026-05-11 (Personal-use classification, awaiting reply)
- **Classification:** Personal-use (verified verbatim 2026-05-11 from Politique d'utilisation Section 6)
- **Source URL:** https://www.anac.dz/en/home/
- **Bulk download URL:** TBD — data.gov.dz cross-check pending
- **License surface:** https://www.anac.dz/wp-content/uploads/2025/01/Politique-dutilisation-du-site-web-de-lANAC-25122024.pdf (Politique d'utilisation du site web de l'ANAC, dated 25/12/2024)
- **License (verbatim French, Section 6):** _"L'utilisateur ne peut utiliser ce site qu'à des fins licites, personnelles et non commerciales."_ (English: "The user may only use this site for lawful, personal, and non-commercial purposes.")
- **Additional note on Section 4:** Politique forbids removing attribution / IP notices from exports — implies that exports under personal use are permitted with attribution.
- **Update cadence:** TBD
- **Permission email:** v2 sent 2026-05-11 to `contact@anac.dz` after Personal-use posture was confirmed verbatim from the PDF policy. v1 superseded before send. Plain-text body per Option A. 7T- prefix. Follow-up due 2026-06-10 if no reply by then. **The 30-day fallback does NOT apply** — Personal-use is an explicit license claim that excludes redistribution; silence ≠ permission. Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## CAA Bahrain — Civil Aviation Affairs (Ministry of Transportation and Telecommunications)

- **Status:** Future — permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown — leans Excluded (verified 2026-05-11)
- **Source URL:** https://www.mtt.gov.bh/civil-aviation
- **Bulk download URL:** None known. Register access is appointment-only viewing per Article 48 of Civil Aviation Law 14/2013.
- **License (verbatim — Article 48 mapping):** Register is _"available in the Aeronautical Licensing Directorate... made available to the public to view, under prior appointment on any business days & hours"_ — same structural pattern as Germany LBA (statutorily non-public), Japan JCAB (consultation-only with no-copy restriction), Israel CAAI (per-aircraft).
- **Why leans Excluded:** Appointment-only viewing with no bulk channel and no copy mechanism is structurally incompatible with redistribution. Will revisit classification once CAA Bahrain replies — if they confirm "no bulk channel exists," moves to Excluded.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-11 to `aerolicensing@mtt.gov.bh` (Aeronautical Licensing Directorate; verified via Article 48 mapping to the relevant directorate). A9C- prefix. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2, pending reclassification on reply).
- **Reply (verbatim):** _pending_

---

## DGCA Kuwait — Directorate General of Civil Aviation

- **Status:** Future — v2 permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://www.dgca.gov.kw/CivilAviationSafety (Aviation Safety Department) + https://kas2.dgca.gov.kw/kasd/wp-content/uploads/2022/03/Reg-Cir-2020-20-NPA-2019-17-KCASR-7-Online.pdf (KCASR 7 — Kuwait Civil Aviation Safety Regulation 7, aircraft registration)
- **Bulk download URL:** TBD — KCASR 7 governs the aircraft register; bulk format not yet surfaced.
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** v2 sent 2026-05-11 to `president@dgca.gov.kw` cc `info@dgca.gov.kw` — Shaikh Eng. Humoud Mubarak H. J. Al-Sabah, President of Civil Aviation (user-provided named contact). v1 to general info@dgca.gov.kw was superseded before send in favor of the named-contact routing. 9K- prefix. Phone +965 24310400 / 24719847. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## DGAC Morocco — Direction Générale de l'Aviation Civile (under Ministère du Transport et de la Logistique)

- **Status:** Future — v2 permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://transport.gov.ma/fr/secteurs/aviation-civile (DGAC migrated to parent ministry site per Décret 2-21-968 du 25 joumada I 1443 / 30 décembre 2021)
- **Bulk download URL:** TBD — former `aviationcivile.gov.ma` subdomain decommissioning (TLS handshake aborts, server returns 0 bytes; recheck weekly). Migration to parent ministry not yet fully complete — /fr/secteurs/aviation-civile/procedures-et-formulaires still contains "Lorem ipsum" placeholder content.
- **License:** Pending verification.
- **Update cadence:** TBD
- **Migration context:** DGAC moved to the parent ministry site per Décret 2-21-968 (25 joumada I 1443 / 30 décembre 2021). Direction de l'Aéronautique Civile is the register-relevant sub-Directorate under the new ministerial structure.
- **Permission email:** v2 sent 2026-05-11 to `DCCsiteweb@transport.gov.ma` (Ministry webmaster; verified live via /fr/contactez-nous on 2026-05-11 via Moroccan VPN — the parent ministry contact page surfaced this address after the DGAC subdomain went dark). v1 (old draft to dead aviationcivile.gov.ma webform) was deleted before send. Body asks for forward to Direction de l'Aéronautique Civile (register-relevant sub-Directorate per Decree 2-21-968). CN- prefix. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## CAA Oman — Civil Aviation Authority of Oman (formerly PACA — Public Authority for Civil Aviation)

- **Status:** 🛠️ Cleared — implementation pending (license cleared via Oman Open Data Use License; awaiting CAA reply on dataset publication or license-extension scope)
- **Classification:** **Open** — CC BY 4.0-compatible per published declaration (verified verbatim 2026-05-11)
- **Source URL:** https://www.caa.gov.om/en/opendata-5/opendata (Open Data portal — currently publishes only airport-traffic statistics 2010-2024 in XLSX/CSV/PDF; per-tail aircraft register is **not yet published**)
- **Bulk download URL:** None published for the per-tail aircraft register. Open Data portal publishes only airport-traffic statistics.
- **License surface:** https://www.caa.gov.om/upload/files/%D8%B1%D8%AE%D8%B5%D8%A9%20%D8%A7%D8%B3%D8%AA%D8%AE%D8%AF%D8%A7%D9%85%20%D8%A7%D9%84%D8%A8%D9%8A%D8%A7%D9%86%D8%A7%D8%AA%20%D8%A7%D9%84%D9%85%D9%81%D8%AA%D9%88%D8%AD%D8%A9%281%29.pdf — "Oman Open Data Use License" (رخصة استخدام البيانات المفتوحة). The footer marketing name on the portal is "Open Government License - Oman" but this PDF is the actual legal instrument.
- **License (verbatim Arabic, Clause 6.2):** _"تتوافق الرخصة مع رخصة المشاع الإبداعي 'CREATIVE COMMONS' (CC BY 4.0) الإصدار الرابع"_ (English: "This license is compatible with the Creative Commons CC BY 4.0 license, version four.")
- **License (verbatim Arabic, Clause 2 summary):** Clause 2 grants the right to **commercial AND non-commercial use, copy, download, publish, distribute, and merge** the open data.
- **License (Clause 4 exclusions):** personal data, government emblems, IP-protected content, identity documents, classified data.
- **Why Open (same tier as AESA Spain, CASA Australia, Traficom Finland, Latvia, Netherlands ILT):** License is cleared via published declaration — no agency reply needed for license use. Same pattern as CASA CC BY 4.0 and AESA Open with attribution.
- **Implementation status:** Register dataset is **not yet published** on the portal — ingest is blocked on dataset availability, not on license clearance.
- **Update cadence:** Per portal refresh cadence (airport-traffic data updated 2010-2024 range; register dataset cadence TBD pending publication).
- **Permission email:** Sent 2026-05-11 to `customerservice@caa.gov.om` (Customer Service Department). Phone +968 24354436 / 24354437 / 24354433 / 24354435. A4O- prefix. **Email function:** courtesy + dataset publication request (license already cleared via published declaration). Body acknowledges the license verbatim and asks (1) publish register as open dataset on the portal OR (2) confirm CC BY 4.0-compatible license extends to register data ingested from other CAA public surfaces. **Reply does not gate license use** — license already cleared via published declaration. Reply will determine whether the register dataset is published on the portal directly or whether the same terms extend to register data ingested from other public CAA surfaces.
- **Reply (verbatim):** _pending_

---

## QCAA — Qatar Civil Aviation Authority

- **Status:** Future — permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://www.caa.gov.qa/en + https://www.caa.gov.qa/en/aeronautical-information-management (Aeronautical Information Management department)
- **Bulk download URL:** TBD — register-specific dataset not surfaced.
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-11 to `pr@caa.gov.qa`. A7- prefix. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## GACA — General Authority of Civil Aviation, Saudi Arabia

- **Status:** Future — v3 permission/dataset-publication request sent 2026-05-11, awaiting reply
- **Classification:** **Conditional Open** (verified verbatim 2026-05-11; reclassified from Personal-use)
- **Source URL:** https://gaca.gov.sa/en/Open-Data + https://gaca.gov.sa/en/open-data/open-data-library (Open Data Library — currently publishes only KSA Airports Traffic 2010-2024 in PDF/XLSX/CSV; per-tail aircraft register is **not yet published** on the Open Data Library)
- **License surface:** https://gaca.gov.sa/en/open-data-policy (GACA Data Usage Policy and Disclaimer)
- **License (verbatim from live policy, verified 2026-05-11):** _"Open data refers to a set of information available without technical, financial, or legal restrictions that individuals can benefit from and use as needed."_
- **Terms of Reuse (verbatim, Data Usage Policy):** source attribution required (with link to gaca.gov.sa); use restrictions (no political purposes, no unlawful/criminal activities, no racist/incitement use, nothing contrary to KSA customs/traditions). **No non-commercial bar, no redistribution bar.** Functionally CC BY-like with use-conduct guardrails.
- **Reclassification note (2026-05-11):** Previously misclassified as **Personal-use** on a cautious reading of the phrase _"use it at their own personal responsibility"_ — which is a liability disclaimer, not a commercial-use bar. Re-research of the live Data Usage Policy on 2026-05-11 (via Saudi VPN) surfaced the verbatim "Open data refers to a set of information available without technical, financial, or legal restrictions" phrase, which is functionally CC BY-like. Reclassified to Conditional Open.
- **Library inventory note:** The Open Data Library currently publishes only **KSA Airports Traffic 2010-2024** (PDF/XLSX/CSV) — the per-tail aircraft register itself is not on the portal. v3 email asks for dataset publication. Pattern matches Oman CAA.
- **Update cadence:** Library refresh cadence appears annual (Airports Traffic covers 2010-2024 in single file); register dataset cadence TBD pending publication.
- **Permission email history:** v1 (`r-5748368082994260425`, unverified `airworthinessInspector@`) and v2 (`r6367671060463685780`, Personal-use framing) both superseded. v3 sent 2026-05-11 to `1929@gaca.gov.sa` — dataset-publication request format (same shape as Oman v2) — body acknowledges the Conditional Open framework verbatim and asks (1) publish register as open dataset on the Open Data Library OR (2) confirm the Data Usage Policy extends to register data ingested from other GACA public surfaces.
- **Permission email (current — v3):** Sent 2026-05-11 to `1929@gaca.gov.sa` (verified live via mailto: on /helping-and-support/contact-us on 2026-05-11 via Saudi VPN; was previously a guess from cached Wayback). HZ- prefix. Phone +966 11 525 3333 (intl) + 1929 (local short code). Follow-up due 2026-06-10 if no substantive reply by then. **Public-record fallback applies after follow-up** (Conditional Open is Unknown-equivalent for the register specifically since the register isn't published on the portal yet; 30-day fallback applies — was previously No-fallback under wrong Personal-use classification, now revised). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** Auto-acknowledgment received 2026-05-11 from GACA Beneficiary Care Center (preserved verbatim per AGENTS.md):

  > Dear Beneficiary,
  >
  > Thank you for contacting Beneficiary Care Center
  >
  > For better assistance, we hope that you provide us with the following information:
  > ( name\ Id number\Phone Number )
  >
  > Your opinion makes a big difference! 💬✨
  > A quick rating from you helps us improve our services and serve you better in the future.
  > To share your feedback,
  > Please click here.
  > Your opinion matters together we grow.
  >
  > Best Regards,
  > GACA

  Interpretation: generic citizen-services intake-form auto-prompt asking for Saudi-citizen-style identification (name / ID / phone). Our request is about register redistribution, not citizen service or complaint — the Beneficiary Care Center is the wrong queue. Treat as **non-substantive auto-acknowledgment** (same posture as the DRC AAC RDC clearance-portal auto-redirect). 30-day fallback clock continues from 2026-05-11. A brief follow-up reply may be useful to (a) provide the form fields they expect (name + phone; flag international requester / no Saudi ID), (b) restate the request type, and (c) explicitly ask for routing to the Open Data team or Aircraft Registration / Airworthiness department. Substantive reply on v3 still pending.

---

## DGAC Tunisia — Direction Générale de l'Aviation Civile (under Ministère du Transport)

- **Status:** Future — v2 permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://www.transport.tn/fr/aviation/article (Transport Aérien section) + https://www.transport.tn/fr/aviation/reglement (Lois et Règlements). Old path `/fr/aviation/` now returns 404 — site reorganized.
- **Bulk download URL:** TBD — data.gov.tn cross-check pending.
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** v2 sent 2026-05-11 to `nidhal.souilmi@transport.state.tn` cc `boc@transport.state.tn` — Nidhal Souilmi, Directeur Général de l'Aviation Civile (named contact verified live via /fr/aviation/contact on 2026-05-11 via Tunisian VPN). v1 to unverified `be.dgac@mt.gov.tn` superseded. TS- prefix. Phone 71906563 / Fax 71906571. Address 17 Rue Khaireddine Pacha, Tunis. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## GCAA — General Civil Aviation Authority of the United Arab Emirates

- **Status:** Future — v2 permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://www.gcaa.gov.ae/ + https://www.gcaa.gov.ae/en/Departments/AS/Pages/Airworthiness.aspx (Airworthiness Department) + https://www.gcaa.gov.ae/en/services/aircraft-registration (Aircraft Registration service)
- **Open data portal:** https://opendata.fcsc.gov.ae/@general-authority-civil-aviation (FCSC Open Data portal — currently publishes "Accepted Aircraft Models" type approvals, NOT the per-tail register)
- **Bulk download URL:** TBD — per-tail register not yet on FCSC portal.
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** v2 sent 2026-05-11 to `customercare@gcaa.gov.ae` — direct email after VPN-based verification surfaced this address (verified live via /en/contact-us on 2026-05-11 via UAE VPN). Previously misclassified as webform-only; v1 webform copy-paste draft superseded. Body asks for forward to Airworthiness Department or Aircraft Registration team if customercare@ is wrong inbox. A6- prefix. Phone +971 800 4466 / WhatsApp +971 4 777 1777 / 171 local short. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## ANAC Angola — Autoridade Nacional da Aviação Civil de Angola (formerly INAVIC)

- **Status:** Future — v1 to fabricated domain bounced 2026-05-11 (anac.co.ao is NXDOMAIN — does not exist); v2 sent 2026-05-11 to verified canonical `anac@anac.ao`; awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://anac.ao/ (current canonical) + https://inavic.gov.ao/ (legacy site, still up, still publishes stale `.co.ao` addresses — agency hasn't updated their own contact page)
- **Bulk download URL:** TBD
- **License:** Pending verification.
- **Update cadence:** TBD
- **Contact-discovery note:** Original 2026-05-11 send (v1) went to `anac@anac.co.ao` cc `reclamacoes@anac.co.ao` — both addresses on the `.co.ao` TLD, which is NXDOMAIN. The subagent pulled these from inavic.gov.ao/contactos (legacy INAVIC contact page), where the agency itself still publishes the stale addresses. v1 bounced entirely. Verified canonical domain is `.ao` (not `.co.ao`); contacto page at https://anac.ao/ao/contactos publishes `anac@anac.ao` + `sec.anac.ao@gmail.com` (unusual gmail fallback for a gov agency, but officially published). Phone: +244 921 320 429 / +244 921 320 442. Address: Aeroporto Internacional Dr. António Agostinho Neto, Estrada Nacional 230, Km 40, Icolo e Bengo, Angola.
- **Permission email:** v1 to `anac@anac.co.ao` cc `reclamacoes@anac.co.ao` bounced 2026-05-11 (NXDOMAIN). v2 sent 2026-05-11 to `anac@anac.ao` cc `sec.anac.ao@gmail.com` (both verified on anac.ao/ao/contactos). D2- prefix. Plain-text body per Option A. v2 body explicitly acknowledges the v1 bounce and notes the legacy inavic.gov.ao contact-page contact-info inaccuracy. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** v1 bounce NDR received 2026-05-11 (preserved verbatim per AGENTS.md): _"Your message wasn't delivered to reclamacoes@anac.co.ao because the domain anac.co.ao couldn't be found. Check for typos or unnecessary spaces and try again."_ (Same NDR shape implied for `anac@anac.co.ao` since the entire domain is NXDOMAIN.)

  **v2 auto-redirect received 2026-05-11** from `anac@anac.ao` (preserved verbatim per AGENTS.md):

  > Dear Sirs,
  >
  > We would like to inform you that our email address has changed and this contact is no longer active. Please forward your message to the new address: sec.anac.ao@gmail.com
  >
  > We appreciate your understanding and apologize for any inconvenience caused.
  >
  > With best regards,
  > Office of Support to the Board of Directors.

  Interpretation: the v2 send hit `anac@anac.ao` (now defunct) and CC'd `sec.anac.ao@gmail.com` (which the auto-redirect confirms IS the current canonical address). So our v2 already reached the right destination via the CC. No further redirect-send needed; `sec.anac.ao@gmail.com` is the verified-by-agency-auto-reply canonical address going forward. The agency's own `anac.ao` website still publishes the now-defunct `anac@anac.ao` as primary — anac.ao/ao/contactos page needs updating on their end. Substantive reply on the redistribution question still pending; clock continues from 2026-05-11.

---

## CCAA — Cameroon Civil Aviation Authority

- **Status:** Future — permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://www.ccaa.aero/index.php/en/
- **Bulk download URL:** TBD — third-party Aeroflight publishes a TJ- register in zipped .txt suggesting bulk format exists somewhere, but no canonical CCAA-hosted file found.
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-11 to `contact@ccaa.aero` (general inbox). TJ- prefix. Body asks for bulk-file location. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## ANAC CI — Autorité Nationale de l'Aviation Civile de Côte d'Ivoire

- **Status:** Future — permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://www.anac.ci/
- **Bulk download URL:** TBD
- **License:** Pending verification.
- **Contact channel note:** SPA — /contact returns 404. Emails extracted from JS bundle with 'Contact / Contacts utiles / Directeur Général' context.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-11 to `info@anac.ci` cc `dpo@anac.ci` (verified emails extracted from JS bundle with 'Contact / Contacts utiles / Directeur Général' context). Phone +225 27 21 58 69 00. TU- prefix. DPO contact included for awareness of PII handling. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## AAC RDC — Autorité de l'Aviation Civile de la République Démocratique du Congo

- **Status:** Future — permission request sent 2026-05-11; automated reply received 2026-05-11 (off-topic — overflight/landing clearance portal redirect); awaiting substantive human reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://www.aacrdc.org/
- **Operational subdomain:** https://clearance.aacrdc.org/ (online portal for overflight and landing clearance requests, per circular AAC/100/DG/TMJ/KMF/007/2025 dated 2025-08-29; not register-relevant but confirms the agency is operationally active and modernizing)
- **Bulk download URL:** TBD — AAC RDC nav lists 'Registre des aéronefs 9S' + 'Registre des aéronefs étrangers' but link destinations are empty; register publication anticipated but not wired.
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-11 to `info@aacrdc.org` (general inbox). 9Q- prefix. Body asks for confirmation that the register pages will be wired. Plain-text body per Option A. Follow-up due 2026-06-10 if no substantive reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** Automated reply received 2026-05-11 (preserved verbatim per AGENTS.md):

  > Important Information
  >
  > We would like to inform you that all overflight and/or landing requests must now be submitted online through our portal: https://clearance.aacrdc.org . This is in accordance with circular note No. AAC/100/DG/TMJ/KMF/007/2025 dated August 29, 2025.
  >
  > Flights not affected by this provision:
  >
  > - State aircraft
  > - Diplomatic flights
  > - MEDEVAC flights
  > - MONUSCO flights
  > - Scheduled flights
  > - Exit authorizations

  This is an automated keyword-triggered reply (likely picked up "request" or "permission" in the body) that redirects all clearance-related inbound mail to the new portal. It does NOT address the register-redistribution question we asked. Treating as non-responsive — the 30-day public-record fallback clock continues from 2026-05-11. Follow-up still due 2026-06-10 if no human reply by then.

---

## ACM — Aviation Civile de Madagascar

- **Status:** Future — permission request sent 2026-05-11 to `acm@acm.mg` (delivered); CC `communications@acm.mg` bounced (mailbox does not exist); substantive reply still pending
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** http://www.acm.mg/
- **Bulk download URL:** TBD — DSEA (Direction de la Sécurité et de l'Utilisation des Aéronefs) maintains the register.
- **License:** Pending verification.
- **Update cadence:** TBD
- **Operational note:** **SSL cert chain at acm.mg is broken** — operator-side fix required before any ingest pipeline can fetch from acm.mg over HTTPS. Recheck periodically.
- **Permission email:** Sent 2026-05-11 to `acm@acm.mg` (delivered). CC `communications@acm.mg` bounced — that mailbox is published on the ACM homepage HTML but no actual mailbox exists behind it (verified by NDR from postmaster@acm.mg: `550 5.1.10 RESOLVER.ADR.RecipientNotFound; Recipient not found by SMTP address lookup`, originating from ACMWEB.ACM.MG Microsoft Exchange server). Drop `communications@acm.mg` from any future correspondence. Phone +261 20 22 22 438. 5R- prefix. DG family name RAKOTO appointed per Décret 2023-155 du 15/02/2023. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** Bounce NDR received 2026-05-11 from `postmaster@acm.mg` (preserved verbatim per AGENTS.md):

  > Échec de la remise pour ces destinataires ou groupes :
  > communications@acm.mg
  > Nous n'avons pas trouvé l'adresse de courrier que vous avez entrée. Vérifiez l'adresse de courrier du destinataire et essayez de renvoyer le message. Si le problème persiste, contactez l'administrateur de votre courrier.
  > Informations de diagnostic pour les administrateurs :
  > Serveur de génération : ACMWEB.ACM.MG
  > communications@acm.mg
  > Remote Server returned '550 5.1.10 RESOLVER.ADR.RecipientNotFound; Recipient not found by SMTP address lookup'

  Bounce affects ONLY the CC. Primary `acm@acm.mg` is not in the failed-recipients list and is assumed delivered.

---

## DCA Mauritius — Department of Civil Aviation

- **Status:** Future — permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://civil-aviation.govmu.org/
- **Bulk download URL:** TBD — main register publicity TBD. **Mortgage register is publicly available** per Civil Aviation Regulations 2007 — statutory carve-out is a positive signal.
- **License:** Pending verification.
- **Update cadence:** TBD
- **Mortgage-register note:** Body asks about both the main register and the statutorily-public mortgage register under Civil Aviation Regulations 2007 (the public mortgage register is a strong civil-law carve-out signal).
- **Permission email:** Sent 2026-05-11 to `civil-aviation@govmu.org` (Department of Civil Aviation). Address: SSR International Airport, Plaisance, Plaine Magnien. Phone (230) 603-2000, Fax (230) 637-3164. 3B- prefix. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## NCAA — Nigerian Civil Aviation Authority

- **Status:** Future — permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://ncaa.gov.ng/
- **Bulk download URL:** TBD
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-11 to `info@ncaa.gov.ng`. 5N- prefix. Strong directorate structure visible on site; body forwards to Airworthiness Standards Directorate. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## ANACIM — Agence Nationale de l'Aviation Civile et de la Météorologie (Senegal)

- **Status:** Future — permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://www.anacim.sn/
- **Bulk download URL:** TBD
- **License:** Pending verification.
- **Domain note:** Legacy `anacs.sn` DNS dead — drop from any reference. ANACIM = former ANACS merged with meteorology agency in 2011.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-11 to `anacim@anacim.sn` (verified on homepage with 'Contact / Directeur Général' context). Phone +221 33 865 60 00, Fax +221 33 820 04 03. 6V- prefix. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## SACAA — South African Civil Aviation Authority

- **Status:** Future — permission request sent 2026-05-11; automated case-acknowledgment received 2026-05-11 (case ref 120146, 3-business-day SLA); substantive reply pending
- **Classification:** Unknown — leans Excluded (verified 2026-05-11; restrictive TOU + PAIA framework)
- **Source URL:** https://www.caa.co.za/
- **Bulk download URL:** TBD — SACAR (South African Civil Aircraft Register) exists; public access pattern TBD.
- **License:** Pending verification.
- **PAIA note:** Restrictive TOU + Promotion of Access to Information Act (PAIA) framework — yes-reply must confirm whether the register is available via PAIA request or in bulk. **Leans Excluded** if reply confirms PAIA-only access (PAIA grants one-off copies under conditions, not ongoing redistribution rights — same pattern as Israel CAAI FOI / Japan JCAB consultation).
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-11 to `clientcare@caa.co.za`. Phone +27 11 545 1000. ZS- prefix. Aircraft Inspection and Registration Section within Airworthiness Department named on /industry-information/airworthiness/ but no individual officer surfaced. Body forwards to Registration Section. Plain-text body per Option A. Follow-up due 2026-06-10 if no substantive reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2; pending reclassification on reply — if PAIA-only, moves to Excluded).
- **Reply (verbatim):** Automated case-acknowledgment received 2026-05-11 from SACAA Contact Centre (preserved verbatim per AGENTS.md):

  > Dear Client,
  >
  > We have opened a case for your enquiry. One of our Officers will respond to you within the next 3 business days.
  >
  > Should you need to follow up on this case, please contact us with this reference 120146.
  >
  > Kindly note that this is an automated response to acknowledge receipt of your enquiry.
  >
  > Regards
  > SACAA Contact Centre
  > 0860 267 435

  Case reference: **120146**. Expected substantive response window: 3 business days (≈ 2026-05-14 / 2026-05-15). For follow-up: cite case 120146; phone 0860 267 435. Posture unchanged pending substantive reply.

---

## UCAA — Uganda Civil Aviation Authority

- **Status:** Future — permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://caa.go.ug/
- **Bulk download URL:** TBD — UCAA publishes Advisory Circular CAA-AC-AWS001 describing registration procedure but the corresponding register listing itself not surfaced.
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-11 to `aviation@caa.co.ug`. 5X- prefix. Body asks for the register file. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## CAAZ — Civil Aviation Authority of Zimbabwe

- **Status:** Future — permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://www.caaz.co.zw/
- **Bulk download URL:** TBD
- **License:** Pending verification.
- **Named-contacts note:** DG: George Mashababe; Director Flight Safety & Standards: Mavis Musakasa — most senior named contacts surfaced in Africa batch. Body routes through topical operational inbox; multiple specific inboxes available for follow-up.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-11 to `licencing@caaz.co.zw` cc `airworthiness@caaz.co.zw` cc `pr@caaz.co.zw`. Z- prefix. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## GCAA Ghana — Ghana Civil Aviation Authority — Excluded

- **Status:** ❌ Excluded (verified 2026-05-11)
- **Classification:** Excluded — password-walled electronic access; no public register surface
- **Source URL:** https://www.gcaa.com.gh/web/
- **License:** Register is electronic but **password-only access** per GCAA Flight Standards Part 4; no public register surface.
- **Why excluded:** Same exclusion pattern as Germany LBA — register is structurally non-public. A permission email is not meaningful for a password-walled regulatory system that is not designed for bulk redistribution.
- **Acronym collision note:** **Acronym collision with Georgia GCAA** — Georgia GCAA is in flight in this project as `ge-gcaa`, do not conflate. 9G- prefix.
- **Revisit condition:** GCAA Ghana publishes the register under an explicit open license, or restructures access to provide a bulk channel.

---

## KCAA — Kenya Civil Aviation Authority — Excluded

- **Status:** ❌ Excluded (verified 2026-05-11)
- **Classification:** Excluded — per-aircraft register extract on formal request + fee; no bulk channel exists
- **Source URL:** https://kcaa.or.ke/
- **License:** Per-aircraft register extract on formal request + fee; no bulk channel exists.
- **Why excluded:** Same exclusion pattern as Israel CAAI + Romania AACR + Japan JCAB + UK G-INFO — fee-gated per-record access with no bulk-redistribution channel. Under PRD CC.1 (Restrictive), no usable deployment shape exists for a non-commercial source-available project. 5Y- prefix.
- **Revisit condition:** KCAA establishes a bulk-redistribution channel or publishes the register under an open license on a Kenyan open-data portal.

---

## RCAA — Rwanda Civil Aviation Authority — Excluded

- **Status:** ❌ Excluded (verified 2026-05-11)
- **Classification:** Excluded — register "maintained on premises" per RCAR Part 2; no public bulk channel
- **Source URL:** https://www.caa.gov.rw/
- **License:** Register "maintained on premises" per RCAR Part 2 — phrasing indicates on-site consultation only.
- **Why excluded:** Same exclusion pattern as Japan JCAB / Bahrain BCAA (appointment-only) — on-premises consultation framework structurally incompatible with redistribution. 9XR- prefix.
- **Revisit condition:** RCAA publishes the register under an explicit open license or establishes a bulk-redistribution channel.

---

## ZCAA — Zambia Civil Aviation Authority

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.caa.co.zm/
- **Bulk download URL:** TBD (Laravel + Vue SPA; register file not surfaced from any public page or JS bundle)
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-11 to `derrick.luembe@caa.co.zm` (cc: `info@caa.co.zm`). Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Contact-discovery note:** ZCAA's website is a Laravel + Vue SPA that surfaces no public contact email on /contact-us, /about-us, /publications, or in its JS bundle. DG name (Derrick Luembe) and email format (`firstname.lastname@caa.co.zm`) were reconstructed from third-party business directories (Rocketreach, ZoomInfo, ATC Network) on 2026-05-11. MX records (`caa-co-zm.mail.protection.outlook.com`) confirm M365 routing is live. The permission-email body explicitly discloses this reconstruction so the recipient can correct the routing if needed. 9J- prefix.
- **Reply (verbatim):** _pending_

---

## CAAB Bangladesh — Civil Aviation Authority of Bangladesh

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://caab.portal.gov.bd/
- **Bulk download URL:** TBD
- **License:** Pending verification.
- **Update cadence:** TBD
- **Operational note:** **caab.gov.bd direct hosts a self-signed cert** — operator-side workaround required for production ingest. The canonical portal at `caab.portal.gov.bd` is fine; the direct `caab.gov.bd` domain (referenced from internal pages like `new.caab.gov.bd/contactof.html`) presents a self-signed certificate and will fail strict TLS verification. Recheck periodically.
- **Acronym-collision note:** **Acronym collision with Bosnia BHDCA + Botswana CAAB** — Bosnia BHDCA is in flight in this project as `ba-bhdca`, Botswana CAAB is in flight as `bw-caab`. Do not conflate. S2- prefix (Bangladesh).
- **Permission email:** Sent 2026-05-11 to `mahmud.pr@caab.gov.bd` cc `apmctg@caab.gov.bd` (verified mailto: on new.caab.gov.bd/contactof.html). Chairman: Air Vice Marshal Md Mostafa Mahmood Siddiq, BSP, GUP, ndc, afwc, acsc, psc — appointed 03/07/2025, verified via chairmanf.html. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## BCAA Bhutan — Bhutan Civil Aviation Authority

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://bcaa.gov.bt/
- **Bulk download URL:** TBD
- **License:** Pending verification.
- **Update cadence:** TBD
- **Register-size note:** Very small register (~5 aircraft total). Low priority by fleet volume, but trivially small — ingest planning impact is negligible once the license clears.
- **Permission email:** Sent 2026-05-11 to `airworthiness@bcaa.gov.bt` cc `bcaa@bcaa.gov.bt`. 7 leadership emails verified mailto: on /contact/: airworthiness@, bcaa@, anad@, fsd@, ops@, pel@, drone@. DG Mr. Kinley Wangchuk, promoted 2026-01-12 per BCAA announcement. A5- prefix. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## SSCA Cambodia — State Secretariat of Civil Aviation

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** http://www.civilaviation.gov.kh/en/
- **Bulk download URL:** TBD
- **License:** Pending verification — leans Excluded if register fee confirmed.
- **Update cadence:** TBD
- **Fee-signal note:** SSCA has a "Regulatory Fees and Charge" menu item on the site — this is a fee signal but not register-specific. The email body explicitly asks whether register access is fee-gated; a yes-reply confirming a fee model would reclassify SSCA toward Excluded (same pattern as Israel CAAI, Romania AACR, Japan JCAB, UK G-INFO).
- **Permission email:** Sent 2026-05-11 to `admin-info@ssca.gov.kh` cc `ssca-int@ssca.gov.kh` (both verified on /en/about-ssca). XU- prefix. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). **Leans Excluded** if reply confirms fee model. Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## DCAL Laos — Department of Civil Aviation, Lao PDR

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.dcal.gov.la/
- **Bulk download URL:** TBD — canonical DCAL-hosted bulk file not surfaced.
- **License:** Pending verification.
- **Update cadence:** TBD
- **Third-party note:** Third-party Air-Britain hosts an RDPL- register PDF — the existence of a third-party-published PDF suggests a bulk format exists upstream, but the canonical DCAL-hosted source has not been surfaced. The permission-email body explicitly asks DCAL for the canonical source URL. No Lao national open-data portal — `data.la` and `data.opendevelopmentlaos.net` both DNS-fail.
- **Permission email:** Sent 2026-05-11 to `info@dcal.gov.la` cc `laodca@laotel.com`. info@ verified mailto: on homepage. RDPL- prefix (5-char, unusual). Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## CAAN Nepal — Civil Aviation Authority of Nepal

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://caanepal.gov.np/
- **Bulk download URL:** TBD — Flight Safety Standards Department maintains the register.
- **License:** Pending verification.
- **Update cadence:** TBD
- **Open-data-portal note:** `data.nepal.gov.np` DNS-fails — no national open-data portal surfaced.
- **Permission email:** Sent 2026-05-11 to `dgca@caanepal.gov.np` (verified mailto: on homepage). DG Mr. Deo Chandra Lal Karn — named on site; also DG Aviation Services Mr. Prem Nath Thakur, DG Corporate Mr. Binod Prasad Neupane, DG Aviation Safety & Security Reg Mr. Bikram Raj Gautam. `gyanendra.bhul@caanepal.gov.np` also verified secondary contact. 9N- prefix. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## CAAP Philippines — Civil Aviation Authority of the Philippines

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.caap.gov.ph/
- **Bulk download URL:** TBD — `data.gov.ph` is live and searchable but no aircraft-register dataset surfaced.
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-11 to `awociddiv@caap.gov.ph` cc `fod@caap.gov.ph`. 5 division emails verified mailto: on /contact-us: awociddiv@, fod@, maosec@, opcen@, rpassec@. RP- prefix with sub-letters: RP-C civilian, RP-R restricted, RP-G government, RP-U unmanned. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## CAAV Vietnam — Civil Aviation Authority of Vietnam (Cục Hàng không Việt Nam)

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://caa.gov.vn/
- **Bulk download URL:** TBD
- **License:** Pending verification — no national open-data portal (`data.gov.vn` DNS-fails).
- **Update cadence:** TBD
- **Operational note:** **english.caa.gov.vn returns SSL handshake error — broken regardless of geography.** Use the Vietnamese-language `caa.gov.vn` as the canonical source. Operator-side workaround not required for `caa.gov.vn`; the English subdomain is simply unusable.
- **Contact-discovery note:** v1 recon error — an earlier subagent misidentified the site as a SPA and fabricated `fssd@caa.gov.vn` from third-party directories; the v1 draft was deleted before send. The v2 (sent) email is addressed to `dunguv@caa.gov.vn`, sourced from a verified `mailto:` link on `/lanh-dao-cuc-hang-khong-viet-nam.htm` (the agency's leadership page). The page also surfaces verified emails for the three Deputy DGs: Đỗ Hồng Cẩm `camdh@`, Hồ Minh Tấn `hmtan@`, Đào Xuân Hoạch `hoachdx@` — available for follow-up if `dunguv@` does not reply.
- **Permission email:** Sent 2026-05-11 to `dunguv@caa.gov.vn`. DG Cục trưởng Uông Việt Dũng. VN- prefix. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## AACR — Romanian Civil Aeronautical Authority (Autoritatea Aeronautică Civilă Română) — Excluded

- **Status:** ❌ Excluded (verified 2026-05-10)
- **Classification:** Restrictive — fee-gated per-record access, no bulk channel
- **Source URL:** https://www.caa.ro/en/pages/inmatricularea-aeronavelor (CAPTCHA-walled to bots)
- **License:** Per AACR's own published procedures (verified manually 2026-05-10 by passing the CAPTCHA), section VIII: _"Based on the provisions of art. 6.7 of the RACR IA as well as the provisions of other specific normative acts, the interested persons may request the AACR to be provided with information regarding the civil aircraft registered in the RUIAC. When submitting the application, the applicant will pay the **tariff charged by AACR in such situations (45 euro / aircraft + VAT)**, the proof of payment of the tariff being attached to the application submitted to the AACR Registry."_ (Last update: 11/03/2021, 10:38:53.)
- **Why excluded:** Per-record fee of €45 + VAT (~€55.80 with Romanian standard VAT). Romania has ~150–200 RYR-prefixed aircraft; estimated full bulk-pull cost ~€11,000–€14,000. No discounted bulk channel exists. Same exclusion criteria as **UK CAA G-INFO** (paid single-PC product) and **Israel CAAI** (per-aircraft fee + FOI for bulk). Under PRD CC.1 (Restrictive), no usable deployment shape exists for a non-commercial source-available project.
- **Revisit condition:** AACR changes the access model — for example, if the RUIAC is added to data.gov.ro under an open license, or if a free bulk-export channel becomes available.

---

## CAD Serbia — Civil Aviation Directorate of the Republic of Serbia (Direktorat civilnog vazduhoplovstva Republike Srbije)

- **Status:** Future — permission request sent 2026-05-10, awaiting reply
- **Classification:** Unknown (verified 2026-05-10 — no public license declaration found)
- **Source URL:** https://cad.gov.rs/strana/20841/Аccess-to-the-electronic-aircraft-registry (English) + https://cad.gov.rs/lat/strana/20841/registar-vazduhoplova (Serbian Latin)
- **Bulk download URL:** Direct PDF on path `https://cad.gov.rs/upload/plovidbenost/Registar%20vazduhoplova.pdf` (latest snapshot; historical date-stamped versions at `/upload/plovidbenost/YYYY/Registar%20vazduhoplova/Registar-DD.MM.YYYY.pdf`)
- **License:** Pending verification. No explicit license declaration on the document page or in surrounding materials. Site footer asserts _"Copyright © Civil Aviation Directorate of the Republic of Serbia 2004-2026"_. Default copyright applies absent a permission grant.
- **Update cadence:** Periodic (date-stamped versions visible across multiple years)
- **Format note (engineering):** Bulk file is **PDF**. Same blocker as Spain AESA, Luxembourg DAC, Croatia CCAA, Hungary KKM, Slovakia NSAT — **sixth** use case for the PDF parser path.
- **Permission email:** Sent 2026-05-10 to `dgca@cad.gov.rs` (general Directorate inbox; site does not surface a register-specific desk). Phone +381 11 292 70 00; address Skadarska 23, 11000 Belgrade. Email cited Latvia CAA, Lithuania TKA, and Finland Traficom as small-EU peer comparables. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## SAAU — State Aviation Administration of Ukraine (Державна авіаційна служба України)

- **Status:** Future — permission request sent 2026-05-10 (license confirmation only — bulk channel and dataset already public on data.gov.ua; just asking which license applies)
- **Classification:** Unknown — strongly leaning Open (CC BY 4.0 inferred from data.gov.ua portal default, not directly verified)
- **Source URL:** https://data.gov.ua/dataset/08a647a0-7829-46ab-aa50-5afb7146a7a8 (open-data portal listing) + https://avia.gov.ua/state-civil-aircraft-register-of-ukraine/ (SAAU register page) + https://avia.gov.ua/reyestr-tsivilnih-povitryanih-suden-ukrayini/ (Ukrainian-language landing)
- **Bulk download URL:** Excel file linked from SAAU register page (`avia.gov.ua/register_of_aircraft.xls` per third-party reference; URL needs verification at ingest time). Dataset on data.gov.ua updates **daily with automatic refresh**.
- **License:** Pending verification. data.gov.ua portal default for Ukrainian public-sector data is CC BY 4.0 (Ukrainian government open-data norms). Strongly inferred Open per portal norms but the dataset page renders client-side so direct license tag was not extractable; email asks for explicit confirmation.
- **Update cadence:** Daily auto-update on data.gov.ua per dataset description
- **Format note (engineering):** Bulk file is **Excel (.xls/.xlsx)**. Engine handles `xlsx` natively; if it's the older `.xls` format the parser may need a small adjustment, but lighter than the PDF parser path. Pattern matches Austria Austro Control, Bulgaria CAA.
- **Wartime operational context (verified 2026-05-10):** Russia's invasion of Ukraine (since February 2022) is ongoing as of recon date. Engagement with Ukraine is **fully permitted** — Ukraine is a US ally; sanctions apply to Russia, not Ukraine. However: response times may be impacted; some aircraft data is operationally sensitive. Email explicitly offers to suspend ingest on operational-security request at any time.
- **Permission email:** Sent 2026-05-10 to `vdz@avia.gov.ua` (Відділ документообігу та контролю / Documentation and Control Department; phone +380 44 351 55 80). Email is short and focused on **license confirmation only** — bulk channel is already public, we are only asking which license applies. Email cited Latvia CAA (CC0 on data.gov.lv), Lithuania TKA (CC BY 4.0 on data.gov.lt), and Finland Traficom (CC BY 4.0 on avoindata.fi) as small-EU peer comparables. Acknowledged wartime context and offered to suspend on request. Follow-up due 2026-06-09 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md` (heavily abbreviated for license-confirmation use case + wartime acknowledgment).
- **Reply (verbatim):** _pending_

---

## UK CAA — Excluded

- **Status:** ❌ Excluded (Future / Blocked)
- **Classification:** Restrictive
- **Source URL:** https://www.caa.co.uk/aircraft-register/g-info/
- **License:** Proprietary CAA copyright + database right. Bulk product (G-INFO, MS Excel) is paid (£450 single issue, £745/yr quarterly, £1,745/yr monthly) under a single-PC license that explicitly forbids copying, distribution, sale, or hire without written CAA consent. Per https://www.caa.co.uk/Aircraft-register/G-INFO/G-INFO-Forms-and-Fees/.
- **Why excluded:** The single-PC clause is incompatible with R2 storage even for purely operator-private use. The no-redistribution clause is incompatible with source-available code that another fork might run. Under PRD CC.1 (Restrictive), no usable deployment shape exists.
- **Revisit condition:** CAA changes the licensing terms — for example, if G-INFO is re-released under OGL-UK or any redistributable license.

---

## Rosaviatsia — Federal Air Transport Agency of Russia — Excluded

- **Status:** ❌ Excluded
- **Classification:** Excluded (sanctions exposure)
- **Source URL:** https://favt.gov.ru/opendata/7714549744-gosreestrgvs/
- **License:** Likely Russian government open-data terms; not verified due to exclusion.
- **Why excluded:** As a US-person operator, engaging with Russian state agencies — even for non-commercial permission requests — carries OFAC compliance risk under post-2014 and post-2022 sanctions. Sectoral and general-license restrictions can implicate Russian state entities even when not directly listed by name. OFAC violations are civil-strict-liability — "I didn't know" is not a defense. The cost-benefit for a hobby project (~7,000 RA-prefixed aircraft) does not justify the legal-review effort required to confirm safe engagement.
- **Revisit condition:** US/Russia sanctions situation eases materially. Re-evaluate annually.

---

## CAAC — Civil Aviation Administration of China — Excluded

- **Status:** ❌ Excluded
- **Classification:** Excluded (technical access blocked + geopolitical exposure)
- **Source URL:** http://219.143.231.89/shs/ccarretrieval.do?flag=1
- **License:** Unverified — cannot reach the page from a modern browser.
- **Why excluded:** The CAAC's register page is built for Microsoft Internet Explorer, which Microsoft formally retired in June 2022. Modern browsers (Chrome, Firefox, Safari, Edge) cannot render the page or its underlying ActiveX-style components. Verification is blocked at step zero — we cannot confirm the schema, license, or bulk-download mechanism without an IE-compatible runtime. Layered on top: China's regulatory and political posture toward US-based open-data projects creates geopolitical exposure that compounds the technical blocker.
- **Revisit condition:** CAAC moves the register to a non-IE platform, or a clearly-licensed community mirror appears, or US-China data policy materially changes. Re-evaluate annually.

---

## Commercial offshore registries — Excluded (group)

These are commercial registration services for foreign aircraft owners. They make money from registration fees ($1,000s–$10,000s per aircraft) for privacy / tax / operational structures, not from publishing data. Their registers are typically PDF or paid-search products with terms forbidding bulk redistribution. The cost-benefit of pursuing them does not work for a non-commercial project.

| Country / Territory | Agency                             | Register URL                                                                               | Aircraft prefix |
| ------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------ | --------------- |
| Cayman Islands      | CAA Cayman Islands                 | https://www.caacayman.com                                                                  | VP-C            |
| Isle of Man         | IOM Aircraft Registry              | https://ardis.iomaircraftregistry.com/register/search                                      | M-              |
| Guernsey            | 2-REG (Guernsey Aircraft Registry) | https://www.2-reg.com/legislation/register                                                 | 2-              |
| Jersey              | Jersey Aircraft Registry           | https://www.gov.je/travel/maritimeaviation/civilaviation/pages/jerseyaircraftregistry.aspx | ZJ-             |
| Turks & Caicos      | TCI Civil Aviation Authority       | https://tcicaa.tc                                                                          | VQ-T            |

**Status:** ❌ Excluded as a class.
**Classification:** Excluded (commercial / paid-SaaS registry pattern).
**Why excluded:** Permission requests are wasted effort — the expected response is "no" or "yes for [significant fee]." Even if granted, redistribution under operator-private R2 doesn't fit their commercial model and could trigger renegotiation later.
**Revisit condition:** A specific registry restructures into an open-data publisher (unlikely given their business model), or a free community mirror appears with verifiable license. Re-evaluate any individual entry at most annually.

**Also fits this pattern but not currently tracked** (would require separate research; not on avcodes list): **Bermuda (VP-B, BCAA)**, **Aruba (P4-, DCA Aruba)**, **San Marino (T7-, CAA San Marino)**. Same exclusion reasoning applies.

---

## Germany — Luftfahrt-Bundesamt (LBA) — Excluded

- **Status:** ❌ Excluded
- **Classification:** Excluded (statutorily non-public register)
- **Source URL:** https://www.lba.de/EN/Airworthiness/AircraftRegistration/AircraftRegistration_node.html
- **License:** Not applicable — the German Luftfahrzeugrolle (aircraft register) is statutorily non-public under German data protection law. Per the LBA's own site: _"The Luftfahrzeugrolle of the Federal Republic of Germany is a non-public register that is neither published nor freely accessible for data protection reasons. The entries in the Aircraft Register are generally not open to the public to be searched; however, data recorded in the Aircraft Register may be requested if that person provides prima facie evidence that it needs such information for the enforcement of a private claim."_
- **Why excluded:** This is not a "permission could unlock the data" scenario. The LBA is statutorily prohibited from publishing the register at all, and only releases data on a per-record basis to parties who can demonstrate a legal claim. There is no "yes" they could meaningfully grant for bulk redistribution. Sending a permission email would only confirm what their site already states.
- **Contact (for reference, not for permission ask):** RefT4@lba.de (Department T4)
- **Revisit condition:** German aviation register reclassified as public under future amendments to the Luftverkehrsgesetz or German data-protection law.

---

## Japan — JCAB (Japan Civil Aviation Bureau, MLIT 航空局) — Excluded

- **Status:** ❌ Excluded
- **Classification:** Excluded (fee-gated per-aircraft access; no bulk channel; explicit refusal-of-bulk clause)
- **Source URL:** https://www.mlit.go.jp/koku/koku_tk1_000035.html (航空機登録原簿の謄本交付・閲覧請求 — Aircraft Registration Ledger Certificate Issuance / Consultation Request)
- **Companion pages:** https://www.mlit.go.jp/koku/koku_tk1_000040.html (情報公開 — what they DO publish: aggregate counts only)
- **License:** No bulk redistribution channel. MLIT publishes only **aggregate count statistics** (monthly/yearly XLSX of registered-aircraft counts by category/type) on the public 情報公開 page. The per-tail-number register (航空機登録原簿) is access-controlled:
  > 航空機登録原簿謄本交付・閲覧ともに１通につき９７０円の手数料がかかります。
  > (Both certificate issuance and consultation of the aircraft registration ledger require a ¥970 fee per record.)
  >
  > 大量の閲覧請求はお受けできない場合がありますので、事前にお問合せください。
  > (Large-volume viewing requests may not be accepted; please inquire in advance.)
  >
  > コピーを取ることはできませんが、その場で写真撮影をすることはできます。
  > (You cannot take copies, but you may photograph on the spot.)
- **Recon depth (two-pass):**
  - **Pass 1:** MLIT 統計・データ + 情報公開 pages confirmed the public surface is aggregate counts only (XLSX files like `001985680.xlsx` for 2026 February). No per-tail bulk download.
  - **Pass 2:** Aircraft registration ledger consultation page confirmed ¥970-per-record fee, explicit refusal clause for bulk requests, no-copy restriction (photography only). Cross-checked data.go.jp and e-Gov data portal — the per-tail register is not catalogued under either. Third-party databases (JA Search, FlyTeam) maintain their own scraped versions, which speaks to the register being non-redistributable through official channels.
- **Why excluded:** Three concurrent blockers — (1) ¥970-per-record fee (~$6 USD; ~$19,000 USD for ~3,000 JA-prefixed aircraft), (2) explicit "we may decline bulk requests" clause built into the procedure, (3) physical-only viewing with no-copy restriction (photography only on-site) — a regulatory framework that structurally cannot accommodate bulk redistribution. Same exclusion pattern as Germany LBA (statutorily non-public), Israel CAAI (fee + FOI-only), Romania AACR (€45/aircraft), UK G-INFO (paid + no-redistribute). A permission email is pointless — MLIT cannot grant what the procedure forbids them from providing in bulk form.
- **Contact (for reference, not for permission ask):** 国土交通省航空局総務課航空機登録担当官 (MLIT Civil Aviation Bureau General Affairs Division, Aircraft Registration Officer), phone +81-3-5253-8111 (extension 48146). No email surfaced. Postal: 〒100-8918 東京都千代田区霞ヶ関2-1-3.
- **Revisit condition:** MLIT publishes the per-tail register on data.go.jp or e-Gov data portal under an explicit open license (CC BY, CC0, JGL — Japan Government License); or Japan amends 航空法 (Civil Aeronautics Act) Article 8-2 to provide a bulk-redistribution channel. Re-evaluate annually.

---

## Israel — CAAI (Civil Aviation Authority of Israel) — Excluded

- **Status:** ❌ Excluded
- **Classification:** Excluded (fee-gated per-aircraft access; no bulk-redistribution channel)
- **Source URL:** https://www.gov.il/en/service/browse-aircraft-register (current canonical browser; the older `data.gov.il/dataset/aircraft_data_il/resource/bc00ed41-75d0-4d0f-9eca-3cd0a2c332cc` was last updated 2022-07-16 and is now deprecated)
- **License:** No bulk redistribution channel. The CAAI register browser at gov.il states verbatim:
  > "Each request is for one aircraft and requires a separate fee."
  >
  > "For requests that are not for a specific aircraft, you must contact the Freedom of Information Commissioner at the Ministry of Transportation to act in accordance with the Freedom of Information Law, 5758-1998."
  >
  > "[E]veryone is permitted, with the consent of the registrar, to review the aircraft registration register in Israel."
- **Why excluded:** Three concurrent blockers — (1) per-aircraft fee + registrar consent for individual lookups, (2) bulk access only via FOI request, which grants one-off copies under conditions and does not confer redistribution rights, (3) no public bulk publication on data.gov.il in any current form. Same structural pattern as Germany LBA: the agency cannot grant what its statutory framework doesn't permit it to publish openly. An FOI request for redistribution rights would be a heavy ask with significant pushback and is not justified for a hobby project's ~600 4X-prefixed aircraft.
- **Revisit condition:** Israel publishes the register on data.gov.il (or successor portal) under an explicit open license (CC BY, CC0, or equivalent). Re-evaluate annually.

---

## Egypt — ECAA (Egyptian Civil Aviation Authority) — Excluded

- **Status:** ❌ Excluded (verified 2026-05-11)
- **Classification:** Excluded (redistribution gating under national civil-aviation statutory framework; verbatim citation pending)
- **Source URL:** https://www.civilaviation.gov.eg/
- **License:** Law 93/2003 (Egyptian Civil Aviation Law) framework was reviewed in prior triage; redistribution gating noted. **Pending verbatim statutory citation — flag for re-verification before any ingest.**
- **Why excluded:** Statutory framework under Law 93/2003 gates redistribution; same structural exclusion family as Germany LBA, Israel CAAI, Japan JCAB, Romania AACR — agency cannot grant what its statute does not permit. Verbatim citation not captured in the prior triage pass; do not change classification without it.
- **Note:** SU- prefix. Same acronym collision as Ethiopia ECAA (the Ethiopian Civil Aviation Authority is a separate entity that has been emailed 2026-05-05 and sits in **In flight** — do not conflate).
- **Revisit condition:** Egypt amends Law 93/2003 to provide an open-data / bulk-redistribution channel for the aircraft register, or ECAA publishes the register under an explicit open license on a national open-data portal. Re-evaluate annually. **A verbatim statutory citation must be captured before any reclassification.**

---

## CAAS — Civil Aviation Authority of Singapore

- **Status:** 🛠️ Cleared — implementation pending (license cleared by CAAS substantive reply 2026-05-11 — overrides site-wide Terms-of-Use restriction; register is publicly accessible and free to be used; ingest format engineering remaining)
- **Classification:** **Open with attribution** (reclassified from Personal-use 2026-05-11 after CAAS substantive reply explicitly confirmed register as "publicly accessible and free to be used")
- **Source URL:** https://www.caas.gov.sg/operations-safety/aircraft/certificate-of-registration
- **License (substantive reply from CAAS, 2026-05-11, preserved verbatim per AGENTS.md):**

  > Dear Ashley,
  >
  > Thank you for your enquiry.
  >
  > We are pleased to inform you that the Singapore Civil Aircraft Register is publicly accessible and free to be used. We would appreciate if you could attribute the source to CAAS, with a link to the register page at https://www.caas.gov.sg/operations-safety/aircraft/certificate-of-registration, so that users can always refer to CAAS for the most accurate and up-to-date information.
  >
  > Thank you.
  >
  > Yours sincerely,
  > CHAI Kwan Kua
  > for CAAS Quality Service Manager

  This is the **third substantive license-confirming reply** received during the metal-birds-feed permission outreach (Finland Traficom #1, Maldives CAA #2, Singapore CAAS #3 — all 2026-05-11). The reply explicitly grants Open-with-attribution use of the register, with the simple attribution + link condition. It **overrides** the previously-recorded restrictive site-wide Terms-of-Use clause (preserved below for context — the agency has confirmed the register is a carve-out).

- **Previously-recorded restrictive ToU (preserved for context — superseded 2026-05-11 by agency reply above):**

  > You shall not modify, reformat, copy, reproduce, display, distribute, publish, transmit, post, upload, licence, create derivative works from, hyperlink, store in any information retrieval system, transfer in any manner, or sell any of the material on this website without CAAS' written permission. […]
  >
  > You may not use any "deep-link", "page scrape", "robot", "spider" or other automatic device, program, algorithm or other methods or processes, to access, acquire, copy or monitor any portion of this CAAS Website […]
  >
  > You may download one copy of the material on this CAAS Website, but only on a single computer, and only for your own personal and non-commercial use […]

  Above ToU is general-site copyright/anti-scrape boilerplate. The agency's 2026-05-11 reply confirms it does not gate redistribution of the register specifically.

- **Permission request:** Submitted 2026-05-05 via the CAAS webform at https://www.caas.gov.sg/who-we-are/contact-us. Form selections: **Category** = Safety Regulations & Approvals, **Sub-Category** = Aircraft Airworthiness and Registration. CAAS publishes a 3–15 business-day response SLA; **affirmative reply received 2026-05-11 from CHAI Kwan Kua, for CAAS Quality Service Manager** — within SLA. Reply preserved verbatim above. Email path validated.
- **Reply (verbatim):** See License section above — full reply preserved.
- **Required attribution:** Link to https://www.caas.gov.sg/operations-safety/aircraft/certificate-of-registration with attribution to CAAS, per the agency's reply.
- **Thank-you reply:** Drafted 2026-05-11 (treated as sent per project rule). Best to send via Gmail Reply on the original thread to preserve threading + ensure correct sender routing — the CHAI_Kwan_Kua@caas.gov.sg address used in the draft is a guessed format pattern, not verified; Gmail Reply uses the actual reply-to header.
- **Format note (engineering):** Register format still TBD per the published page (search interface). With license cleared, engineering can investigate scraping the register page directly or asking CAAS whether a bulk format exists.

### Required attribution (verbatim, place in README Attribution section)

> Source: Civil Aviation Authority of Singapore (CAAS) — https://www.caas.gov.sg/operations-safety/aircraft/certificate-of-registration
>
> Redistributed with permission granted by CHAI Kwan Kua (for CAAS Quality Service Manager) in correspondence dated 2026-05-11. Per CAAS: the Singapore Civil Aircraft Register is publicly accessible and free to be used; attribution to CAAS with a link to the register page is requested so users can refer to CAAS for the most accurate and up-to-date information.
>
> The material has been changed: CAAS aircraft records are normalized into metal-birds-feed's canonical schema. This attribution does not imply endorsement by CAAS.

---

## ANAC Bénin — Agence Nationale de l'Aviation Civile du Bénin

- **Status:** Future — v1 to anac@anac.bj bounced 2026-05-11 (mailbox not found); v2 sent 2026-05-11 to alternate-domain Gmail address; awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://anac.bj/
- **Bulk download URL:** TBD
- **License:** Pending verification.
- **Update cadence:** TBD
- **Contact-discovery note:** Original v1 to `anac@anac.bj` bounced 2026-05-11 ("address couldn't be found, or is unable to receive mail"). The entire `anac.bj` mail domain appears to have routing issues — same routing concern applies to CC `anacaero@anac.bj` even though only the primary was in the NDR. Public references (Globenin / Mali Pages) document multiple alternate addresses: `secretariatanacbenin@gmail.com` (Gmail fallback), `secretariatanacbenin@yahoo.fr` (Yahoo fallback), `anacaero@leland.bj` (alternate domain on `leland.bj`). v2 routed via Gmail address with alternate-domain CC to maximize delivery probability. DG: Prudencio Behanzin. TY- prefix.
- **Permission email:** v1 to `anac@anac.bj` cc `anacaero@anac.bj` bounced 2026-05-11 (anac.bj mail routing). v2 sent 2026-05-11 to `secretariatanacbenin@gmail.com` cc `anacaero@leland.bj`. Plain-text body per Option A. v2 body explicitly acknowledges the v1 bounce and contact-discovery situation. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** v1 bounce NDR received 2026-05-11 (preserved verbatim per AGENTS.md): _"Your message wasn't delivered to anac@anac.bj because the address couldn't be found, or is unable to receive mail."_

  **v2 CC bounce NDR received 2026-05-11** (preserved verbatim per AGENTS.md): _"Your message wasn't delivered to anacaero@leland.bj because the domain leland.bj couldn't be found. Check for typos or unnecessary spaces and try again."_

  **Both `.bj` mail domains we attempted (anac.bj and leland.bj) are dead.** The primary `secretariatanacbenin@gmail.com` (Gmail) is not in any NDR — assumed delivered. **No third send planned per project rule** (don't redraft when one of the addressees delivered). Drop both `leland.bj` and `anac.bj` from any future Benin correspondence — both are NXDOMAIN-level dead. The only verified working channel is the Gmail address. Substantive reply on v2 still pending.

---

## ANAC Burkina — Agence Nationale de l'Aviation Civile du Burkina Faso

- **Status:** Future — permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://anac.bf/
- **Bulk download URL:** TBD
- **License:** Pending verification.
- **Update cadence:** TBD
- **Contact-discovery note:** Alternate domain `anacburkina.org` (not `.bf`) used for the contact email. Verified live on /contact/.
- **Permission email:** Sent 2026-05-11 to `info@anacburkina.org` (verified live on /contact/). XT- prefix. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## Ministry of Transport — Cook Islands

- **Status:** Future — permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://www.transport.gov.ck/
- **Bulk download URL:** TBD
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-11 to `mot.information@cookislands.gov.ck` (verified live on /contact-2/). E5- prefix. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## ECCAA — Eastern Caribbean Civil Aviation Authority (regional)

- **Status:** Future — permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://www.eccaa.aero/
- **Bulk download URL:** TBD
- **License:** Pending verification.
- **Update cadence:** TBD
- **Regional body note:** ECCAA is the Eastern Caribbean Civil Aviation Authority — a regional body covering 7 OECS member states: Antigua V2-, Anguilla VP-A, Dominica J7-, Grenada J3-, St Kitts V4-, St Lucia J6-, St Vincent J8-.
- **Contact-discovery note:** Contact email `contact@eccaa.aero` was surfaced via WebSearch + CAPA confirmation; not displayed on the landing page. Permission-email body explicitly discloses the contact-discovery source so the recipient can correct routing if needed.
- **Permission email:** Sent 2026-05-11 to `contact@eccaa.aero`. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## ESWACAA — Eswatini Civil Aviation Authority

- **Status:** Future — permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://www.eswacaa.co.sz/
- **Bulk download URL:** TBD
- **License:** Pending verification.
- **Update cadence:** TBD
- **Domain note:** Correct domain is `eswacaa.co.sz` — NOT `swazicaa.co.sz` as referenced in some older sources. The country renamed from Swaziland to Eswatini in 2018; ensure any internal references use the current domain.
- **Named-contacts note:** DG: Ms. Andile Mtetwa-Amaeshi.
- **Permission email:** Sent 2026-05-11 to `info@eswacaa.co.sz` (verified live on /get-in-touch/). 3DC- prefix. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## GCAA — Guyana Civil Aviation Authority

- **Status:** Future — v1 to aisguyana@gcaa-gy.org returned mailbox-full bounce 2026-05-11 (552 5.2.2 Quota exceeded); v2 sent 2026-05-11 to aig@gcaa-gy.org alternate inbox; awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://www.gcaa-gy.org/
- **Bulk download URL:** TBD
- **License:** Pending verification.
- **Update cadence:** TBD
- **Site-access note:** Site root WAF-blocked to curl from the US sandbox (403 from openresty/1.25.3.1; sandbox User-Agent rejected). User-verified the contact page in browser 2026-05-11: **the GCAA contact page (https://www.gcaa-gy.org/contact-us.html) publishes only one Guyana email — `aisguyana@gcaa-gy.org` — for Aeronautical Information Management Services.** No DG-specific or register-specific inbox is surfaced on the verified live page.
- **Named-contacts note:** DG: Lt. Col. (Retd) Egbert Field A.A. (referenced on /director-generals-message.html — also WAF-blocked from sandbox, not directly verified).
- **Permission email:** v1 sent 2026-05-11 to `aisguyana@gcaa-gy.org` — bounced same day with "552 5.2.2 <aisguyana@gcaa-gy.org> Quota exceeded (mailbox for user is full)". v2 sent 2026-05-11 to `aig@gcaa-gy.org` (Aircraft Accident Investigation inbox surfaced via WebSearch references to a different GCAA page that was not user-browser-verified — this is a fallback guess, not a confirmed published address). 8R- prefix. v2 body explicitly acknowledges both the v1 quota-exceeded bounce and that aig@ is not the register desk; asks for forwarding to the correct inbox. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.

  **No third send planned.** If aig@ v2 bounces or sits silent past the follow-up date, Guyana moves to deferred state ("single canonical inbox quota-full at agency; no alternate verified") rather than chasing further pattern-guessed addresses. Mailbox-full is operational on the agency side — the right next attempt (if needed) is a retry to `aisguyana@gcaa-gy.org` after the agency clears the quota, not another invented alternate.

- **Reply (verbatim):** v1 bounce NDR received 2026-05-11 (preserved verbatim per AGENTS.md): _"<aisguyana@gcaa-gy.org>: host 127.0.0.2[127.0.0.2] said: 552 5.2.2 <aisguyana@gcaa-gy.org> Quota exceeded (mailbox for user is full) (in reply to end of DATA command)"_. Mailbox exists but is full — distinct from RecipientNotFound. Substantive reply on v2 still pending.

---

## CAD HK — Civil Aviation Department, Hong Kong SAR

- **Status:** Future — permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://www.cad.gov.hk/english/planereg.html
- **Bulk download URL:** TBD
- **License:** Pending verification.
- **Update cadence:** TBD
- **Statutory framework note:** Hong Kong CAP 486 (Personal Data (Privacy) Ordinance, PDPO) governs PII handling for any per-tail register data. Aircraft registration procedure governed by Air Navigation (Hong Kong) Order 1995 (form DCA99). The permission-email body references both for clarity.
- **Permission email:** Sent 2026-05-11 to `enquiry@cad.gov.hk` (verified live mailto: on /english/enquiries_and_complaints.html). B-H/B-K/B-L prefix. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## Aviation Administration of Kazakhstan

- **Status:** Future — permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://caa.gov.kz/
- **Bulk download URL:** TBD
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-11 to `frontoffice@caa.gov.kz` (verified live mailto: on homepage). UP- prefix. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## CAA Kosovo (AAC) — Civil Aviation Authority of the Republic of Kosovo

- **Status:** Future — permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://caa.rks-gov.net/
- **Bulk download URL:** TBD
- **License:** Pending verification.
- **Update cadence:** TBD
- **Contact-discovery note:** 5 emails verified live on /en/kontakti: `infocaa@caa-ks.org`, `gat@caa-ks.org`, `drones@caa-ks.org`, `flight.approval@rks-gov.net`, `khaia@rks-gov.net`. Permission email routes primary + first cc; remaining mailboxes available for follow-up.
- **Permission email:** Sent 2026-05-11 to `infocaa@caa-ks.org` cc `gat@caa-ks.org`. Z6- prefix. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## LCAA — Liberia Civil Aviation Authority

- **Status:** Future — permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://lcaa.gov.lr/
- **Bulk download URL:** TBD
- **License:** Pending verification.
- **Update cadence:** TBD
- **Address note:** P.O. Box 68, Harbel, Margibi County.
- **Permission email:** Sent 2026-05-11 to `liberiacaa@lcaa.gov.lr` (WebSearch-confirmed via CAPA). A8- prefix. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## ANAC Mauritanie — Agence Nationale de l'Aviation Civile de Mauritanie

- **Status:** Future — permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://www.anac.mr/
- **Bulk download URL:** TBD
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-11 to `anac@anac.mr` cc `survol.dta@anac.mr` (both verified in homepage HTML). 5T- prefix. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## PASO — Pacific Aviation Safety Office (regional)

- **Status:** Future — permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://paso.aero/
- **Bulk download URL:** N/A — PASO is the regional safety regulator, NOT the per-state aircraft register registrar.
- **License:** Pending verification.
- **Update cadence:** TBD
- **Regional body note:** PASO provides safety oversight to 12 Pacific Island member states: Solomon Islands H4-, Vanuatu YJ-, Samoa 5W-, Tonga A3-, Kiribati T3-, Nauru C2-, Palau T8A-, Tuvalu T2-, Cook Islands E5-, Niue E6-, Marshall Islands V7-, FSM V6-. Aircraft registers themselves are maintained by each member state's national CAA where one exists.
- **Contact-discovery note:** `info@paso.aero` is verified live. The permission-email body explicitly asks PASO to forward the request to the per-state CAA contacts since PASO itself does not maintain aircraft registers.
- **Permission email:** Sent 2026-05-11 to `info@paso.aero`. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## INAC — Instituto Nacional de Aviação Civil de São Tomé e Príncipe

- **Status:** Future — permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://www.inac.st/
- **Bulk download URL:** TBD
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-11 to `inac@cstome.net` (verified live mailto:). S9- prefix. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## SLCAA — Sierra Leone Civil Aviation Authority

- **Status:** Future — permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://slcaa.gov.sl/
- **Bulk download URL:** TBD
- **License:** Pending verification.
- **Update cadence:** TBD
- **Named-contacts note:** DG: Madam Musayeroh Barrie.
- **Permission email:** Sent 2026-05-11 to `info@slcaa.gov.sl` (WebSearch-confirmed). 9L- prefix. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## SSCAA — South Sudan Civil Aviation Authority

- **Status:** Future — permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://sscaa.gov.ss/
- **Bulk download URL:** TBD
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-11 to `support@sscaa.gov.ss` (verified live mailto:). Z8- prefix. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## SHGM — Sivil Havacılık Genel Müdürlüğü (Türkiye)

- **Status:** Future — permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://web.shgm.gov.tr/
- **Bulk download URL:** TBD
- **License:** Pending verification.
- **Update cadence:** TBD
- **Statutory framework note:** Turkey's KVKK (Kişisel Verilerin Korunması Kanunu — Personal Data Protection Law) governs PII handling for any per-tail register data. Permission-email body references it for clarity.
- **Named-contacts note:** Yetkili (Authorized officer): Bülent Göral, Sicil Müdürlüğü (Registry Department), verified on /tr/hava-araci-islemleri/2205-tescil-islemleri. DG Civil Aviation: Prof. Dr. Kemal Yüksek. Phone: +90 312 203 60 00.
- **Permission email:** Sent 2026-05-11 to `bulent.goral@shgm.gov.tr` (verified live on /tr/hava-araci-islemleri/2205-tescil-islemleri). TC- prefix. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## State Service for Civil Aviation — Turkmenistan

- **Status:** Future — permission request sent 2026-05-11, awaiting reply
- **Classification:** Unknown (verified 2026-05-11)
- **Source URL:** https://caa.gov.tm/
- **Bulk download URL:** TBD
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-11 to `info-office@caa.gov.tm` (verified live). EZ- prefix. Plain-text body per Option A. Follow-up due 2026-06-10 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## Sanctions / conflict-affected — Excluded (group, sanctions audit 2026-05-11)

Each entry below has a sanctions / active-conflict exclusion rationale and a documented revisit condition. The sanctions audit was completed 2026-05-11 — Afghanistan ACAA and Niger ANAC are newly added in this audit; the remaining entries reflect prior batch triage consolidated here.

| Country     | Agency                          | Prefix | Rationale                                                             | Revisit condition                               |
| ----------- | ------------------------------- | ------ | --------------------------------------------------------------------- | ----------------------------------------------- |
| Afghanistan | ACAA                            | YA-    | Taliban-era authority; OFAC restrictions; no contact (new 2026-05-11) | Sanctions framework changes                     |
| Belarus     | Aviation Dept of Min. Transport | EW-    | OFAC/EU sanctions exposure                                            | US/Belarus sanctions ease                       |
| Cuba        | IACC                            | CU-    | OFAC blanket sanctions; do not contact                                | US/Cuba sanctions ease                          |
| Iran        | CAO.IR                          | EP-    | OFAC blanket sanctions; geo-block on cao.ir                           | US/Iran sanctions ease                          |
| Iraq        | ICAA                            | YI-    | Conflict-recovery posture                                             | Stable governance + bulk channel surfaced       |
| Libya       | LCAA                            | 5A-    | Sectoral sanctions + fragmented governance                            | Unified governance + sanctions ease             |
| Myanmar     | DCA Myanmar                     | XY-    | Post-coup OFAC exposure; junta posture; active conflict               | Political transition + sanctions ease           |
| Niger       | ANAC Niger                      | 5U-    | 2023 coup; sanctions-watch posture (new 2026-05-11)                   | Government stabilization + sanctions clarity    |
| North Korea | GACA DPRK                       | P-     | OFAC blanket; do not contact                                          | US/DPRK sanctions ease (effectively never)      |
| Sudan       | CAA Sudan                       | ST-    | Active civil war; aviation infrastructure non-functioning             | Conflict ends + aviation infrastructure returns |
| Syria       | SyCAA                           | YK-    | OFAC blanket sanctions                                                | US/Syria sanctions ease                         |
| Venezuela   | INAC                            | YV-    | OFAC sectoral sanctions                                               | Sectoral aviation carve-out review              |
| Yemen       | CAMA                            | 7O-    | Active conflict; aviation infrastructure non-functioning              | Conflict ends + aviation infrastructure returns |

**Why excluded as a class:** OFAC violations are civil-strict-liability for US-person operators. Engaging with sanctioned-state agencies — even for non-commercial permission requests — carries compliance risk that does not justify the cost-benefit for a hobby project. Active-conflict entries are excluded because the aviation infrastructure is not functioning enough to produce a maintainable register feed; revisit when the situation stabilizes.

---

## No-agency / no-own-register — Excluded (group, 2026-05-11)

Microstates and small jurisdictions without a dedicated civil aviation register authority. These are not sanctions-affected; they simply do not maintain a separate aircraft register that can be ingested.

| Country          | Prefix | Reason                                                                                                                             |
| ---------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Andorra          | n/a    | Landlocked microstate; no civil aviation register; aviation activity falls under FR/ES airspace.                                   |
| Eritrea          | n/a    | No public web presence found for Eritrea Civil Aviation Authority (aviation.gov.er unreachable). Revisit if web presence restored. |
| Liechtenstein    | HB-    | No own register; civil aviation operates under Switzerland HB- prefix via FOCA/BAZL (already excluded as Personal-use).            |
| Micronesia (FSM) | V6-    | No dedicated CAA web presence verified; likely under PASO arrangement.                                                             |
| Monaco           | 3A-    | No own register; aviation under DGAC France 3A- (DGAC France already in flight).                                                   |
| Nauru            | C2-    | No dedicated CAA; aircraft activity covered under PASO.                                                                            |
| Niue             | E6-    | New Zealand-associated state; no separate register found.                                                                          |
| Palau            | T8A-   | Aviation under Bureau of Aviation Palau / Ministry of Public Infrastructure; no separate public register found. PASO arrangement.  |
| Samoa            | 5W-    | Ministry of Works, Transport and Infrastructure handles aviation but no separate register page found. PASO arrangement.            |
| Timor-Leste      | n/a    | ANATL is air-navigation-service only; no separate civil aircraft register authority confirmed.                                     |
| Tonga            | A3-    | No dedicated CAA web presence; PASO arrangement.                                                                                   |
| Tuvalu           | T2-    | No dedicated CAA; PASO arrangement.                                                                                                |
| Vatican          | HV-    | HV- prefix historic; no civil aviation activity.                                                                                   |

**Why excluded as a class:** No registrar = no register to ingest. For PASO-arrangement entries, the PASO permission request (sent 2026-05-11) explicitly asks for forwarding to any per-state CAA that does maintain a separate register.

---

## DCA Aruba / Registry of Aruba — Excluded (commercial offshore, reconfirmed 2026-05-11)

- **Status:** ❌ Excluded (verified 2026-05-11; same exclusion family as Cayman / Isle of Man / Guernsey / Jersey / Turks & Caicos)
- **Classification:** Excluded (commercial / paid-SaaS offshore registry pattern)
- **Source URL:** https://www.theregistryofaruba.com/ + https://www.p4registry.com/
- **License:** Paid SaaS-style MTOW-based commercial offshore registry; 24-48h registration product.
- **Why excluded:** Not in business of bulk redistribution; same structural exclusion as the other commercial offshore registries already grouped above. P4- prefix.
- **Revisit condition:** Aruba restructures DCA into an open-data publisher (unlikely given the business model) or a free community mirror appears with verifiable license. Re-evaluate annually.
- **Note:** Previously listed in the "Also fits this pattern but not currently tracked" trailer alongside Bermuda and San Marino — now explicitly excluded with its own entry as of 2026-05-11. Bermuda (VP-B, BCAA) and San Marino (T7-, CAA San Marino) remain in that trailer for future research if ever needed.
