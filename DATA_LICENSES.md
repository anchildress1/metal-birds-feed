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
- **Classification:** **Open** with attribution (verified 2026-05-09 from AESA portal Legal Notice; reclassified from Unknown)
- **Source URL:** https://www.seguridadaerea.gob.es/en/ambitos/aeronaves/registro-de-matriculas-de-aeronaves-civiles/registro-de-matriculas
- **Bulk download URL:** https://www.seguridadaerea.gob.es/sites/default/files/aeronaves_inscritas.pdf (direct PDF, "list of aircraft registered in Spain on 1 May 2026, updated periodically")
- **License:** **Open with attribution.** Per the [AESA portal Legal Notice](https://www.seguridadaerea.gob.es/en/politica-de-privacidad-y-aviso-legal), verbatim: _"The total or partial reproduction of the contents published on the portal is prohibited, unless the source of origin is cited. However, the contents that are considered as open data at the Electronic Headquarters may be reproduced, in accordance with the provisions of Royal Decree 1495/2011, of October 24, on the development of Law 37/2007, on the reuse of public sector information."_ Functionally CC BY 4.0-equivalent: source citation is mandatory; the open-data subset layers Spain's PSI Directive implementation (Aporta framework) on top.
- **Update cadence:** Periodic (last update 2026-05-01 noted on register page; cadence appears monthly but not contractually committed)
- **Format note (engineering):** Bulk file is **PDF**, not CSV/XLSX. Engine currently handles csv/ods/xlsx; PDF parsing is a new format adapter. Ingest blocked on parser, not on license.
- **Permission email:** Sent 2026-05-05 to `rmac.aesa@seguridadaerea.es`. **Reply no longer gates use** — license already cleared via the portal Legal Notice. Email stands as a courtesy / relationship gesture; not waiting on it.
- **Reply (verbatim):** _pending_

### Required attribution (verbatim, place in README Attribution section)

> Source: AESA — Agencia Estatal de Seguridad Aérea — https://www.seguridadaerea.gob.es/en/ambitos/aeronaves/registro-de-matriculas-de-aeronaves-civiles/registro-de-matriculas
>
> Reproduced with attribution per the AESA portal Legal Notice and Royal Decree 1495/2011 of October 24 (development of Law 37/2007 on the reuse of public sector information). Material has been changed: AESA aircraft records are normalized into metal-birds-feed's canonical schema. This attribution does not imply endorsement by AESA.

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
- **Classification:** Unknown (verified 2026-05-09 — no public license declaration found despite portal hunt)
- **Source URL:** https://www.enac.gov.it/sicurezza-aerea/aeronavigabilita-iniziale/registro-aeromobili/
- **Bulk download URL:** **None published.** Recon 2026-05-09 confirmed no CSV/PDF/JSON dump anywhere on `enac.gov.it` or `dati.mit.gov.it`. The register is governed by Codice della Navigazione + Codice Civile — access is per-record via formal "visure" extracts (paid procedure under Italian Civil Code rules). A yes-reply from ENAC must clear **both** license and a bulk access channel (FTP, direct dump, FOI, or similar) before ingest is feasible.
- **License:** Pending verification. ENAC publishes other datasets on `dati.mit.gov.it` under [CC BY (Creative Commons Attribuzione)](https://dati.mit.gov.it/catalog/dataset/?organization=enac) — specifically "Imprese titolari di licenza di trasporto aereo" and "Elenco Organizzazioni Registrate per l'addestramento al volo" — but the aircraft register is **deliberately excluded**. Pattern matches Switzerland FOCA: agency publishes some open data, withholds the register specifically. [IODL 2.0](https://www.dati.gov.it/iodl/2.0/) is the Italian open-data license framework but does not apply absent an explicit ENAC declaration on the register.
- **Update cadence:** TBD (no published artifact has a refresh schedule)
- **Permission email:** Sent 2026-05-05 to `registro.aeromobili@enac.gov.it`. Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## FOCA / BAZL — Swiss Federal Office of Civil Aviation (Bundesamt für Zivilluftfahrt)

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** **Personal-use** (verified 2026-05-09 from Swiss Federal Council site-wide Terms and Conditions; reclassified from Unknown)
- **Source URL:** https://app02.bazl.admin.ch/web/bazl/en/#/lfr/search
- **Bulk download URL:** Search app supports CSV export; direct bulk endpoint unverified (the register is **not** published on `opendata.swiss` despite BAZL publishing other datasets there)
- **License:** **Personal-use only.** Per the [Swiss Federal Council Terms and Conditions](https://www.admin.ch/gov/en/start/terms-and-conditions.html) (site-wide policy covering all `*.admin.ch` domains, including `bazl.admin.ch` and `app02.bazl.admin.ch`), verbatim: _"Copyright and any other rights relating to texts, illustrations, photos or any other data available on the Federal authorities' websites are the exclusive property of the federal authorities or of any other expressly mentioned owners. Any reproduction requires the prior written consent of the copyright holder."_ The register is also governed by the [Bundesgesetz über das Luftfahrzeugbuch](https://www.fedlex.admin.ch/eli/cc/1960/1245_1301_1297/de) (Federal Act on the Aircraft Register), separate from open-data rules. BAZL deliberately publishes other datasets (noise pollution, drone zones, aerodromes) on `opendata.swiss` with explicit Open licenses while omitting the aircraft register — a choice, not an oversight.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-05 to `aircraftregistry@bazl.admin.ch`. Follow-up due 2026-06-04 if no reply by then. **The 30-day fallback does NOT apply** — FOCA is Personal-use; silence ≠ permission, must wait for affirmative reply. Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## Luftfartstilsynet — Civil Aviation Authority of Norway

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown (verified 2026-05-09 — `data.norge.no` dataset listed with **"Public access"** tag but the **License field is empty**; no explicit license declaration found, so we cannot claim NLOD without confirmation)
- **Source URL:** https://luftfartstilsynet.no/aktorer/norges-luftfartoyregister/registrerte-luftfartoy/
- **Bulk download URL:** https://data.caa.no/nlr/norgesluftfartoyregister.json (direct JSON, no auth required; verified via `data.norge.no` dataset listing 2026-05-09)
- **License:** Pending verification. `data.norge.no` tags the dataset **"Public access"** but the License field is empty. Metadata also contains a contradiction: `isAccessibleForFree: false` despite the public-access tag. Norwegian public-sector data generally falls under [NLOD (Norwegian License for Open Government Data)](https://data.norge.no/nlod/en/2.0), broadly equivalent to CC BY 4.0, but Luftfartstilsynet has not made that declaration explicit on the dataset page. Stays Unknown until reply.
- **Update cadence:** Daily at 16:00 Oslo time (per `data.norge.no` dataset metadata)
- **Permission email:** Sent 2026-05-05 to `postmottak@caa.no` (general inbox). Register-specific desk `nlr@caa.no` surfaced 2026-05-09 — preferred address for any follow-up. Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## Transportstyrelsen — Swedish Transport Agency

- **Status:** Future — permission request sent, awaiting reply (**leans Excluded** if no reply by 2026-06-04 — see below)
- **Classification:** Unknown (verified 2026-05-09 — no public license declaration found)
- **Source URL:** https://etjanster-luftfart.transportstyrelsen.se/en-gb/sokluftfartyg
- **Bulk download URL:** **None published.** Recon 2026-05-09 confirmed the register is **search-only** (no CSV/PDF/JSON dump on `transportstyrelsen.se` and no listing on `dataportal.se` for the aircraft register). Pattern matches Italy ENAC and Iceland ICETRA: yes-reply must clear **both** license and a bulk access channel before ingest is feasible.
- **License:** Pending verification. Swedish public-sector data is bound by the EU PSI Directive baseline (reuse permitted under attribution), but Transportstyrelsen has not published an open-data declaration for the aircraft register. Unlike its Nordic neighbour Finland (Traficom publishes the equivalent register under CC BY 4.0), Sweden has not made the same declaration.
- **Update cadence:** TBD (no published artifact has a refresh schedule)
- **Permission email:** Sent 2026-05-05 to `luftfart@transportstyrelsen.se` (general aviation inbox). Register-specific desk `lfr@transportstyrelsen.se` surfaced 2026-05-09 — preferred address for any follow-up. Named register staff also surfaced for cold-call escalation: Magdalena Forssén, Christer Larsson, Fredrik Wallin (phone +46 771 503 503). Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

**Note for the eventual follow-up email (after 2026-06-04):** lead with the Finland Traficom comparable — neighbouring Nordic agency that publishes the equivalent register under CC BY 4.0 — and the EU PSI Directive baseline. Both are clean, public reference points.

---

## AFAC — Mexican Federal Civil Aviation Agency (Agencia Federal de Aviación Civil)

- **Status:** Future — permission request sent, awaiting reply (**leaning Excluded** pending AFAC confirmation)
- **Classification:** Unknown (verified 2026-05-09 — flagged as worst-case among the recon batch)
- **Source URL:** https://www.gob.mx/afac
- **Bulk download URL:** **None published.** Recon 2026-05-09 confirmed `portal-de-servicios.afac.gob.mx` is a **login-walled** user-account portal (no public read interface), and `datos.gob.mx` searches do not surface the Registro Aeronáutico Mexicano (RAM). The register is governed by the [Reglamento del Registro Aeronáutico Mexicano](http://www.ordenjuridico.gob.mx/Documentos/Federal/html/wo88684.html).
- **License:** Pending verification. Third-party sources (e.g., l2baviation) describe **per-record access at ~$10 USD per search** under the RAM Reglamento. Could not confirm on AFAC's own documentation — could be describing certified legal extracts (visure-equivalent) rather than basic public access. If AFAC reply confirms a fee-gated model, **this flips to Excluded** (same exclusion pattern as UK CAA G-INFO + Israel CAAI). Held at Unknown until primary-source confirmation.
- **Update cadence:** TBD (no published artifact has a refresh schedule)
- **Permission email:** Sent 2026-05-05 to `tramites@afac.gob.mx`. Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

---

## Austro Control — Austria

- **Status:** Future — permission request sent, awaiting reply (**most "shovel-ready" of the unresolved Unknowns** — XLSX bulk file exists; engine handles xlsx natively)
- **Classification:** Unknown (verified 2026-05-09 — bulk file confirmed; license declaration not found)
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

- **Status:** 🛠️ Cleared — implementation pending (license cleared via Traficom open-data page; ZIP-CSV unpack wrapper needed before ingest)
- **Classification:** **Open** — CC BY 4.0 (verified 2026-05-09 from Traficom open-data page; reclassified from Unknown)
- **Source URL:** https://tieto.traficom.fi/en/open-data (Traficom open-data catalog) + https://www.avoindata.fi/data/en_GB/dataset/854b277b-7472-4d0a-9a46-a8e34822a2e0 (avoindata.fi listing)
- **Bulk download URL:** https://eservices.traficom.fi/LicensesServices/Forms/AircraftRegister.aspx?download=zip (direct ZIP-CSV; ~1,331 rows; 127 kB unpacked / 123 kB packed)
- **Variable list:** https://tieto.traficom.fi/files/media/file/MuuttujaluetteloIlmaalusrekisteri.xlsx
- **License:** **CC BY 4.0** (Creative Commons Nimeä 4.0 International). Verbatim from the Traficom open-data page: _"The material been licensed under the Creative Commons Nimeä 4.0 International license — http://creativecommons.org/licenses/by/4.0/deed.en"_. Same posture as CASA Australia: attribution required.
- **Update cadence:** Annual (single dated dump per year — material 12 Jan 2026, published 17 Feb 2026; no monthly refresh)
- **Format note (engineering):** Bulk file is **ZIP-packed CSV**. Engine handles `csv` natively; needs a thin "unzip-then-parse" wrapper. Bonus: same pattern used for Finnish vehicles, vessels, and rolling-stock open data — wrapper is reusable for any future Finnish source.
- **Permission email:** Sent 2026-05-05 to `kirjaamo@traficom.fi` (cc: `tietojenluovutus@traficom.fi`). **Reply no longer gates use** — license already cleared via the Traficom open-data page. Email stands as a courtesy / relationship gesture; not waiting on it.
- **Reply (verbatim):** _pending_

### Required attribution (verbatim, place in README Attribution section)

> Source: Traficom — Finnish Transport and Communications Agency — https://tieto.traficom.fi/en/open-data
>
> Licensed under [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/). The material has been changed: Traficom aircraft records are normalized into metal-birds-feed's canonical schema. This attribution does not imply endorsement by Traficom.

---

## Trafikstyrelsen — Danish Civil Aviation and Railway Authority

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown (verified 2026-05-09 — no public license declaration found)
- **Source URL:** https://www.trafikstyrelsen.dk/arbejdsomraader/luftfart/ansoegninger-individuelle/flyejer/luftfartoejsregister
- **Bulk download URL:** **None published.** Recon 2026-05-09: the public register page describes only application procedures (registration, change of ownership, deletion, IDERA, rights register). A SharePoint document library exists at `selvbetjening.trafikstyrelsen.dk/civilluftfart/Dokumenter/Luftfartøjsregistret og luftfartsgodkendelser` but the URL returns empty (login-walled or affected by current outage — see operational note below). Pattern matches Italy/Iceland/Sweden: yes-reply must clear **both** license and a bulk access channel.
- **License:** Pending verification. Datavejviser.dk (Denmark's data catalog) publishes its own metadata under CC0 but that does not speak to register data licensing. No register-specific declaration discoverable.
- **Update cadence:** TBD (no published artifact has a refresh schedule)
- **Operational note (2026-05-09):** Register is **currently offline**. Trafikstyrelsen page leads with banner: _"Teknisk fejl på nationalitetsregistret. Adgangen til nationalitetsregistret er i øjeblikket utilgængelig grundet en teknisk fejl."_ ("Technical error on the nationality register. Access is currently unavailable due to a technical error.") A 2019 news archive entry shows the register has gone down before — recurring reliability concern, signal about how seriously the agency treats the artifact.
- **Permission email:** Sent 2026-05-05 to `info@trafikstyrelsen.dk` (general inbox; no register-specific desk surfaced publicly in this recon). Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_

**Note for the eventual follow-up email (after 2026-06-04):** lead with the Finland Traficom comparable — neighbouring Nordic agency that publishes the equivalent register under CC BY 4.0 — and the EU PSI Directive baseline.

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

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.caa.gov.mv/operations/registration-of-aircraft-and-mortgages
- **Bulk download URL:** TBD (PDF download per avcodes)
- **License:** Pending verification.
- **Update cadence:** TBD
- **Permission email:** Sent 2026-05-05 to `airworthiness@caa.gov.mv` (Airworthiness desk). Follow-up due 2026-06-04 if no reply by then. **Public-record fallback applies after follow-up** (Unknown classification per PRD CC.2). Template: `docs/agency-permission-request.md`.
- **Reply (verbatim):** _pending_
- **Note on naming:** Referred to as "CAA Maldives" in this project to distinguish from the Civil Aviation Authority of Malaysia (also "CAAM") — same acronym, different agencies.

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
- **Classification:** Unknown (verified 2026-05-09 — no public license declaration found despite portal hunt)
- **Source URL:** https://island.is/en/aircraft-registry
- **Bulk download URL:** **None published.** Recon 2026-05-09 confirmed the register page is **search-only** (by TF- number or owner name); `icetra.is/aviation/aircraft/register` redirects to the same island.is search interface. Iceland has no obvious central open-data catalog (no `data.gov.is` discoverable) and the aircraft register is not surfaced anywhere as a downloadable artifact. Pattern matches Italy ENAC: yes-reply must clear **both** license and a bulk access channel before ingest is feasible.
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

## CAAS — Civil Aviation Authority of Singapore

- **Status:** Future — permission request submitted, awaiting reply
- **Classification:** Personal-use (with explicit "with written permission" carveout — same shape as CAA NZ)
- **Source URL:** https://www.caas.gov.sg/operations-safety/aircraft/certificate-of-registration
- **License (verbatim from CAAS Terms of Use, "Restrictions on Access and Use" section):**

  > You shall not modify, reformat, copy, reproduce, display, distribute, publish, transmit, post, upload, licence, create derivative works from, hyperlink, store in any information retrieval system, transfer in any manner, or sell any of the material on this website without CAAS' written permission. This means, among other things, that you must not insert a hyperlink to this CAAS Website on any other website or "mirror" on your own Website, the home page or other pages of or materials in this or any CAAS Website or their respective links.
  >
  > You may not use any "deep-link", "page scrape", "robot", "spider" or other automatic device, program, algorithm or other methods or processes, to access, acquire, copy or monitor any portion of this CAAS Website, or in any way alter, reproduce or circumvent or attempt to alter, reproduce or circumvent the navigational structure or presentation of this CAAS Website or its Contents, or to obtain or attempt to obtain any materials, document or information not intentionally made available by CAAS through this CAAS Website.
  >
  > You may download one copy of the material on this CAAS Website, but only on a single computer, and only for your own personal and non-commercial use, and provided that it bears the relevant copyright, trademark and/or other proprietary notices located on this CAAS Website.

- **Why Personal-use rather than Excluded:** The "without CAAS' written permission" phrasing throughout the redistribution clause is an explicit carveout — CAAS can grant permission. The data itself is published freely on caas.gov.sg (unlike UK G-INFO, which is a paid product with no public version). This matches the **Personal-use** pattern from PRD CC.1: "personal use only without permission; written permission required for anything else." Same shape as CAA NZ. Permission ask is the path forward.
- **Permission request:** Submitted 2026-05-05 via the CAAS webform at https://www.caas.gov.sg/who-we-are/contact-us. Form selections: **Category** = Safety Regulations & Approvals, **Sub-Category** = Aircraft Airworthiness and Registration. CAAS publishes a 3–15 business-day response SLA; expected reply by 2026-05-26. Reply will arrive at `anchildress1@gmail.com`. **The 30-day fallback does not apply** — Personal-use sources require an affirmative reply (silence ≠ permission).
- **Reply (verbatim):** _pending_
- **Action if denied:** drop Singapore from the project. The terms are too restrictive to proceed without explicit permission.
- **Note on the no-automated-access clause:** the form submission explicitly requested both (a) redistribution permission, and (b) a sanctioned mechanism for periodic programmatic access (since the no-scraping clause is separate from the no-redistribute clause).
