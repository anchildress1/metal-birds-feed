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
6. Do not deploy commercially without separately re-licensing each upstream source under terms that permit commercial use.

### Attribution to metal-birds-feed (for downstream consumers)

Downstream applications that consume the normalized data should include the following attribution wherever the data is exposed or surfaced:

> Aircraft register data normalized by metal-birds-feed (https://github.com/anchildress1/metal-birds-feed). Per-source attribution preserved in metal-birds-feed's `DATA_LICENSES.md`.

This attribution does **not** relieve the downstream of complying with each upstream source's own attribution and license requirements. Those flow through.

---

## Upstream source licenses

License classification (per PRD CC.1):

- **Open** — public domain, OGL, CC BY (no NC). No usage restriction beyond attribution.
- **Personal-use** — CC BY-NC, "personal use only" terms. Operator-private R2 only; operator deployment must remain non-commercial (PRD CC.3).
- **Restrictive** — paid, single-PC, no-redistribute, or active denial. Excluded from the project.
- **Unknown** — pending license research and/or permission-email reply. Not slotted.

Permission protocol (per PRD CC.2): Personal-use and Unknown sources require an email to the agency before slotting. Reply preserved verbatim below.

The 30-day silence fallback only applies to **Unknown** classifications, where there is no explicit license statement on the source's website and the public-record argument (aviation registration is statutorily public under ICAO Annex 7 and equivalent national law) carries weight. After 30 days of no reply, an Unknown source proceeds with prominent attribution and a documented date-of-decision; any later removal request is honored.

The 30-day fallback does **not** apply to **Personal-use** sources, where the agency has made an explicit license claim that excludes redistribution. Silence from a Personal-use source is not implicit permission. Personal-use sources cannot be slotted without an affirmative reply.

---

## Live sources

### FAA — US Federal Aviation Administration

- **Status:** ✅ Live (phase 1)
- **Classification:** Open
- **Source URL:** https://registry.faa.gov/aircraftinquiry/
- **Bulk download URL:** https://www.faa.gov/licenses_certificates/aircraft_certification/aircraft_registry/releasable_aircraft_download/
- **Bulk archive:** ZIP containing MASTER.txt (currently registered aircraft), ACFTREF.txt (manufacturer/model reference), ENGINE.txt (engine reference), and DEREG.txt (deregistered history). Fixed-width ASCII.
- **License:** US Federal Government work — public domain under [17 U.S.C. § 105](https://www.law.cornell.edu/uscode/text/17/105). No copyright vests in works of the US Government.
- **Attribution required:** Not legally required. Credited as a courtesy in README.
- **Update cadence:** Monthly (first week of each month).
- **PII dropped at ingest:** street1, street2, city, postal-code, county, region, and care-of fields are not mapped. Owner records expose `name`, `kind`, `state`, and `country` only.
- **`source_id` mapping:** FAA UNIQUE ID is used as `source_id`, not N-NUMBER. N-numbers can be reissued; UNIQUE ID is the durable per-record identifier.

---

### Transport Canada (TC-CA)

- **Status:** ✅ Live (phase 2)
- **Classification:** Open (with conditions — see below)
- **Bulk download URL:** https://wwwapps.tc.gc.ca/saf-sec-sur/2/ccarcs-riacc/download/ccarcsdb.zip
- **Search interface:** https://wwwapps.tc.gc.ca/saf-sec-sur/2/ccarcs-riacc/RchSimp.aspx
- **License:** Government of Canada Open Data Licence Agreement for Unrestricted Use of Canada's Data. Click-wrap accepted on download. License URL: https://wwwapps.tc.gc.ca/Saf-Sec-Sur/2/CCARCS-RIACC/DDZip.aspx
- **License posture:** Royalty-free, non-exclusive, worldwide, non-assignable licence to use, reproduce, extract, modify, translate, distribute, manufacture Value-Added Products, and sublicence.
- **Update cadence:** Monthly (file `Last-Modified` typically the 1st of the month).
- **PII dropped at ingest:** `street1`, `street2`, `city`, `postal-code`, and `care-of` fields are not mapped. Owner records expose `name`, `kind`, `province`, and `country` only. Satisfies §3.1.d no-identity-merge clause.

#### Conditions to comply with (verbatim, per licence agreement)

- **Reproduction notice (§4.1):** _"Reproduced and distributed with the permission of the Government of Canada."_ Include on all reproductions of the data.
- **Value-Added Product notice (§4.2):** _"This product has been produced by or for Ashley Childress and includes data provided by the Government of Canada. The incorporation of data sourced from the Government of Canada within this product shall not be construed as constituting an endorsement by the Government of Canada of our product."_
- **No insignia in promotion (§4.3):** Do not use the name, crest, logos, flags, insignia, or domain names of Canada in any promotion or advertisement.
- **No identity-merge (§3.1.d, second part):** Do not merge or link Transport Canada data with any other product or database for the purpose of identifying an individual, family, household, organization, or business.
- **No reverse-engineering (§3.1.d, first part):** Do not disassemble, decompile, or reverse-engineer the data.
- **Infringement notice (§5.1):** If aware of third-party infringement, notify Canada and cooperate with enforcement.
- **No exclusive-arrangement claim (§5.2):** Do not represent metal-birds-feed as having exclusive distribution or privileged access.
- **No reputational harm (§5.3):** Do not use the data in any way that, in Canada's opinion, brings disrepute or prejudice to Canada.
- **Warranty / liability (§§6.1–6.3):** Canada provides data as-is with no warranty. Operator indemnifies Canada and its ministers, employees, and agents from claims arising from the operator's use.
- **Termination (§7.2):** Rights terminate automatically on any breach.
- **Governing law (§8.1):** Province of Ontario and federal laws of Canada.

---

### ILT — Netherlands Human Environment and Transport Inspectorate

- **Status:** ✅ Live (phase 3, NL track)
- **Classification:** Open
- **Source URL:** https://www.ilent.nl/documenten/lijsten/luchtvaart/databestanden/luchtvaartregister-data
- **Open-data listing:** https://data.overheid.nl/dataset/luchtvaartuigregister
- **Bulk download URL:** Date-stamped filename on `ilent.nl` (resolved via `download.discover_url` per PRD R2.7).
- **Format:** OpenDocument Spreadsheet (`.ods`).
- **License:** CC-0 1.0 Universal (public domain) per data.overheid.nl. The page disclaimer "no rights can be derived from this data" is a quality-of-data disclaimer, not a license restriction.
- **Attribution required:** Not legally required under CC-0. Credited as a courtesy.
- **Update cadence:** Continuous-to-monthly (no fixed schedule).
- **PII dropped at ingest:** ILT does not publish owner identity in the bulk register. Owner fields are null; no drop required at the mapping layer.

---

### CASA — Civil Aviation Safety Authority of Australia

- **Status:** ✅ Live (phase 4) — shipped 2026-05-08
- **Classification:** Open
- **Source URL:** https://www.casa.gov.au/aircraft/aircraft-registration/data-files-registered-aircraft
- **Bulk download URL:** https://services.casa.gov.au/CSV/acrftreg.csv
- **License:** Creative Commons Attribution 4.0 International (CC BY 4.0). Per https://www.casa.gov.au/about-us/about-website/copyright (verified 2026-05-05): _"We own all the material we produce. With the exceptions noted below, we provide all material on this website under a Creative Commons Attribution 4.0 International Licence."_ Both bulk CSV and search interface inherit this default; neither carries an opt-out notice.
- **Attribution required:** Yes. "Source: Civil Aviation Safety Authority — https://www.casa.gov.au/aircraft/aircraft-registration/data-files-registered-aircraft", with link to CC BY 4.0, and indication the material has been changed.
- **Update cadence:** Per file date stamps (typically daily refresh).
- **Field-coverage gaps (`null`):** `icao_hex`, `airworthiness_date`, `category`, `build_certification`, `operating_environment`, `engine.horsepower`, `engine.thrust_lbs`, `owner.kind`, `operator.kind`, `cruise_speed_ktas`. CASA does publish `icao_type_code`.

---

### CAA Latvia — Civilās aviācijas aģentūra

- **Status:** ✅ Live (`sources/lv-caa.yaml` + `fixtures/lv-caa/`)
- **Classification:** Open — CC0-1.0
- **Source URL:** https://data.gov.lv/dati/lv/dataset/gaisa-kugu-registrs
- **Bulk download URL:** https://data.gov.lv/dati/dataset/3f67abc8-f8b7-4833-a2e2-9a304df06afd/resource/dbde00e6-8616-449a-8cac-ef748c6793f3/download/output.csv
- **License:** CC0-1.0 (public domain dedication, no attribution required). Verbatim license tag: "CC0-1.0" on the data.gov.lv dataset page.
- **Attribution required:** Not legally required. Credited as a courtesy.
- **Update cadence:** Monthly ("reizi mēnesī" per dataset metadata).

#### Required attribution (courtesy — not legally required under CC-0)

> Aircraft register data published by Civilās aviācijas aģentūra (CAA Latvia) on [data.gov.lv](https://data.gov.lv/dati/lv/dataset/gaisa-kugu-registrs) under [CC0-1.0 (public domain)](https://creativecommons.org/publicdomain/zero/1.0/). Acknowledgment provided as a courtesy; not legally required under CC-0.

---

### CAA Taiwan — Civil Aviation Administration, MOTC R.O.C.

- **Status:** ✅ Live (`sources/tw-caa.yaml` + `fixtures/tw-caa/`)
- **Classification:** Open — Open Government Data License v1.0
- **Source URL:** https://www.caa.gov.tw/article.aspx?a=238&lang=1
- **Bulk download URL:** Monthly `.xls` per ROC-year index page; `discover_url` + `discover_pattern` capture the newest file ID via regex (file ID rolls non-sequentially; new year-page opens each ROC year — see `sources/tw-caa.yaml` ANNUAL BUMP comment).
- **License:** [Open Government Data License v1.0](https://data.gov.tw/license). Cleared 2026-05-15 by Nicholas Liaw (Flight Standards Division, CAA MOTC R.O.C.) via bilateral grant scoped to non-commercial source-available project. Attribution text provided verbatim. Three project commitments confirmed: (1) link back to the register page, (2) regular monthly refresh, (3) removal-on-request honored immediately.
- **Attribution required:** Yes. See attribution block below.
- **Update cadence:** Monthly.
- **Field-coverage gaps (`null`):** `icao_hex`, `icao_type_code`, `serial_number`, `manufacturer`, `airframe_type`, `category`, `build_certification`, `airworthiness_class`, `operating_environment`, `operational_classes`, `engine.*`, `owner.*`, `idera_authorised_party`, `certification_date`, `airworthiness_date`, `expiration_date`, `last_action_date`, `cruise_speed_ktas`. Full manufacture date is reduced to `year_manufactured` (4-digit year via `excel_serial_year_or_null`).

#### Required attribution

> Source: Civil Aviation Administration, MOTC R.O.C. — [caa.gov.tw](http://caa.gov.tw/). Licensed under the Open Government Data License, v1.0.
>
> [OGDL v1.0 full text](https://data.gov.tw/license). Register page: https://www.caa.gov.tw/article.aspx?a=238&lang=1.
>
> The material has been changed: CAA Taiwan aircraft records are normalized into metal-birds-feed's canonical schema. This attribution does not imply endorsement by CAA Taiwan.

---

## Cleared — awaiting implementation

### AESA — Spanish State Aviation Safety Agency

- **Status:** 🛠️ Cleared — implementation pending (PDF parser path needed)
- **Classification:** Open with attribution (verified 2026-05-10 from AESA portal Legal Notice)
- **Source URL:** https://www.seguridadaerea.gob.es/en/ambitos/aeronaves/registro-de-matriculas-de-aeronaves-civiles/registro-de-matriculas
- **Bulk download URL:** https://www.seguridadaerea.gob.es/sites/default/files/aeronaves_inscritas.pdf (direct PDF; refreshed monthly, dated 1st of month, published ~4 days later)
- **License:** Per the [AESA portal Legal Notice](https://www.seguridadaerea.gob.es/en/politica-de-privacidad-y-aviso-legal) (verified 2026-05-11): _"The total or partial reproduction of the contents published on the portal is prohibited, unless the source of origin is cited. However, the contents that are considered as open data at the Electronic Headquarters may be reproduced, in accordance with the provisions of Royal Decree 1495/2011, of October 24, on the development of Law 37/2007, on the reuse of public sector information, for the public sector."_ Functionally CC BY 4.0-equivalent under Spain's PSI Directive implementation (Aporta framework).
- **Format note:** PDF — ingest blocked on PDF parser path, not on license.

#### Required attribution

> Source: AESA — Agencia Estatal de Seguridad Aérea — https://www.seguridadaerea.gob.es/en/ambitos/aeronaves/registro-de-matriculas-de-aeronaves-civiles/registro-de-matriculas
>
> Reproduced with attribution per the AESA portal Legal Notice and Royal Decree 1495/2011 of October 24 (development of Law 37/2007 on the reuse of public sector information, for the public sector). Material has been changed: AESA aircraft records are normalized into metal-birds-feed's canonical schema. This attribution does not imply endorsement by AESA.

---

### ANAC Brasil — Brazilian National Civil Aviation Agency

- **Status:** ✅ Live (`sources/br-anac.yaml` + `fixtures/br-anac/`)
- **Classification:** Open with attribution (confirmed 2026-05-11 by ANAC Brasil — Brazilian Aeronautical Registry Technical Branch, Department of Airworthiness)
- **Source URL:** https://sistemas.anac.gov.br/aeronaves/cons_rab.asp
- **Bulk download URL:** https://sistemas.anac.gov.br/dadosabertos/Aeronaves/RAB/dados_aeronaves.csv (native CSV, ~22.7 MB, updated daily)
- **License:** Open data. Per ANAC Brasil reply (2026-05-11): _"this is open data, and no prior authorization is required for its use. However, proper citation of the source is mandatory."_
- **Attribution required:** Yes — source citation mandatory (see below).
- **Update cadence:** Daily (`cadence_days: 1`).
- **PII:** ANAC embeds owner/operator tax ids (CPF pre-masked upstream, e.g. `587XXXXXX00`). The id is dropped; only `owner.kind`/`operator.kind` are derived from its length.

#### Required attribution

> Source: ANAC Brasil — Agência Nacional de Aviação Civil — https://sistemas.anac.gov.br/dadosabertos/Aeronaves/RAB/
>
> Open data published by ANAC Brasil. Per ANAC Brasil correspondence dated 2026-05-11: this is open data, no prior authorization is required for its use, and proper citation of the source is mandatory. Field descriptions and metadata: https://www.gov.br/anac/pt-br/acesso-a-informacao/dados-abertos.
>
> The material has been changed: ANAC Brasil aircraft records are normalized into metal-birds-feed's canonical schema. This attribution does not imply endorsement by ANAC Brasil.

---

### Traficom — Finnish Transport and Communications Agency

- **Status:** 🚧 License clear, **data shape blocking** — public bulk channel is identifier-stripped and not ingestable; awaiting Traficom reply on identifier-bearing channel
- **Classification:** Open — CC BY 4.0 (confirmed in writing 2026-05-11)
- **Source URL:** https://tieto.traficom.fi/en/open-data
- **Bulk download URL:** https://eservices.traficom.fi/LicensesServices/Forms/AircraftRegister.aspx?download=zip (direct ZIP-CSV — **identifier-stripped; not ingestable**)
- **License:** CC BY 4.0. Verbatim from Traficom open-data page: _"The material been licensed under the Creative Commons Nimeä 4.0 International license — http://creativecommons.org/licenses/by/4.0/deed.en"_. Confirmed by Traficom in writing 2026-05-11: _"Open data can be freely used by anyone for any purpose, as long as the original source of the data is mentioned."_
- **Data-shape blocker:** The public ZIP-CSV is GDPR-stripped to per-aircraft fleet stats — no registration mark, no source_id, no Mode-S hex, no owner/operator. Canonical-schema ingest requires an identifier-bearing channel. Follow-up sent to Traficom 2026-05-11 asking for such a channel.
- **Update cadence:** Annual (one dated dump per year).

#### Required attribution

> Source: Traficom — Finnish Transport and Communications Agency — https://tieto.traficom.fi/en/open-data
>
> Licensed under [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/). The material has been changed: Traficom aircraft records are normalized into metal-birds-feed's canonical schema. This attribution does not imply endorsement by Traficom.

---

### Transpordiamet — Estonian Transport Administration

- **Status:** ✅ Cleared (confirmed 2026-05-13 by Ivo Tolga, Head of Airworthiness Department — ref `13.5-6/26/8138-2`)
- **Classification:** Personal-use — non-commercial reuse and redistribution permitted with attribution
- **Source URL:** https://transpordiamet.ee/ohusoidukite-register
- **Bulk download URL:** HTML table inline on register page (~150 entries). HTML scrape required.
- **License:** Non-commercial reuse and redistribution with attribution, granted in writing 2026-05-13. Three explicit conditions from the reply:
  1. The data is provided as publicly available information **without guarantees** regarding completeness, accuracy, or uninterrupted availability.
  2. **Users of the data remain responsible** for their own use and processing of the information.
  3. Transpordiamet **may change the structure, availability, or content** of the published register in the future.
- **Attribution text (use verbatim, including the en-dash):** `Source: Estonian Transport Administration (Transpordiamet) – https://transpordiamet.ee/ohusoidukite-register`
- **Update cadence:** Not stated. Transpordiamet explicitly reserves the right to change structure/availability/content.

---

### CAA Maldives — Maldives Civil Aviation Authority

- **Status:** 🛠️ Cleared — implementation pending (PDF parser path needed)
- **Classification:** Open with attribution + mandatory error disclaimer (confirmed 2026-05-11 by Abdulla Mohamed, Director Airworthiness)
- **Source URL:** https://www.caa.gov.mv/operations/registration-of-aircraft-and-mortgages
- **Bulk download URL:** https://caa.gov.mv/attachments/0Jy9EQclEAaFIxUenyNFxRtphFFSJDK77mj18haV.pdf (direct PDF; opaque hash filename; refreshed irregularly)
- **License:** Open with attribution. CAA Maldives encourages use of the register and welcomes machine-friendly format. Attribution is requested. **Mandatory error statement (verbatim from CAA Maldives register footer — must be reproduced in any surface displaying Maldives data):**

  > Note: Whilst reasonable care is taken compiling the above data, the CAA does not warrant the data is free of error or omission.

- **Format note:** PDF — ingest blocked on PDF parser path (shared with AESA Spain).

#### Required attribution

> Source: Maldives Civil Aviation Authority — https://www.caa.gov.mv/operations/registration-of-aircraft-and-mortgages
>
> Redistributed with permission granted by Abdulla Mohamed (Director Airworthiness, CAA Maldives) in correspondence dated 2026-05-11. Per CAA Maldives required notice:
>
> > Note: Whilst reasonable care is taken compiling the above data, the CAA does not warrant the data is free of error or omission.
>
> The material has been changed: CAA Maldives aircraft records are normalized into metal-birds-feed's canonical schema. This attribution does not imply endorsement by CAA Maldives.

---

### CAA Oman — Civil Aviation Authority of Oman

- **Status:** 🛠️ Cleared — implementation pending (register dataset not yet published on portal)
- **Classification:** Open — CC BY 4.0-compatible per published declaration (verified 2026-05-11)
- **Source URL:** https://www.caa.gov.om/en/opendata-5/opendata (Open Data portal — airport traffic only; per-tail register **not yet published**)
- **License surface:** https://www.caa.gov.om/upload/files/%D8%B1%D8%AE%D8%B5%D8%A9%20%D8%A7%D8%B3%D8%AA%D8%AE%D8%AF%D8%A7%D9%85%20%D8%A7%D9%84%D8%A8%D9%8A%D8%A7%D9%86%D8%A7%D8%AA%20%D8%A7%D9%84%D9%85%D9%81%D8%AA%D9%88%D8%AD%D8%A9%281%29.pdf
- **License (verbatim Arabic, Clause 6.2):** _"تتوافق الرخصة مع رخصة المشاع الإبداعي 'CREATIVE COMMONS' (CC BY 4.0) الإصدار الرابع"_ (English: "This license is compatible with the Creative Commons CC BY 4.0 license, version four.")
- **License (Clause 2 summary):** Grants the right to commercial AND non-commercial use, copy, download, publish, distribute, and merge the open data.
- **License (Clause 4 exclusions):** personal data, government emblems, IP-protected content, identity documents, classified data.
- **Implementation status:** Register dataset not yet published on the portal — ingest blocked on dataset availability, not on license clearance.

---

### CAAS — Civil Aviation Authority of Singapore

- **Status:** 🛠️ Cleared — implementation pending (format engineering remaining)
- **Classification:** Open with attribution (confirmed 2026-05-11 by CHAI Kwan Kua, for CAAS Quality Service Manager)
- **Source URL:** https://www.caas.gov.sg/operations-safety/aircraft/certificate-of-registration
- **License:** Per CAAS reply (2026-05-11): _"We are pleased to inform you that the Singapore Civil Aircraft Register is publicly accessible and free to be used. We would appreciate if you could attribute the source to CAAS, with a link to the register page at https://www.caas.gov.sg/operations-safety/aircraft/certificate-of-registration, so that users can always refer to CAAS for the most accurate and up-to-date information."_ This overrides the general site-wide Terms of Use; the register is an explicitly confirmed carve-out.
- **Format note:** Format TBD (search interface). Engineering can investigate scraping or asking CAAS for bulk format now that license is cleared.

#### Required attribution

> Source: Civil Aviation Authority of Singapore (CAAS) — https://www.caas.gov.sg/operations-safety/aircraft/certificate-of-registration
>
> Redistributed with permission granted by CHAI Kwan Kua (for CAAS Quality Service Manager) in correspondence dated 2026-05-11. Per CAAS: the Singapore Civil Aircraft Register is publicly accessible and free to be used; attribution to CAAS with a link to the register page is requested so users can refer to CAAS for the most accurate and up-to-date information.
>
> The material has been changed: CAAS aircraft records are normalized into metal-birds-feed's canonical schema. This attribution does not imply endorsement by CAAS.

---

### CAAT Thailand — Civil Aviation Authority of Thailand

- **Status:** 🛠️ Cleared — implementation pending (PDF parser path needed)
- **Classification:** Personal-use — non-commercial reuse and redistribution permitted with attribution
- **Source URL:** https://www.caat.or.th/certificates-licenses/aircraft/service-manual/aircraft-registration-application/
- **Bulk download URL:** PDF at date-stamped filename (`Aircraft-Registration-Information-DD-MMM-YYYY.pdf`); WordPress site.
- **License:** Non-commercial bilateral grant. Cleared 2026-05-21 by Aircraft Registration Division (AR), Airworthiness and Aircraft Engineering Department (AIR), CAAT. CAAT permits the Thailand Aircraft Register data to be used and shared for non-commercial projects with CAAT credited as the data source. Structured bulk formats (CSV/XLSX/JSON) explicitly declined. Attribution required: credit CAAT and reference the official register URL. Register URL updated to new platform per CAAT reply.
- **Format note:** PDF — ingest blocked on PDF parser path (shared with AESA Spain + CAA Maldives).
- **Update cadence:** Twice per year (January and June); observed cadence roughly annual with mid-year drops — stated cadence inconsistent with publishing rhythm.
- **Correspondence:** Sent 2026-05-10 to `inter_focalpoint@caat.or.th` cc `saraban@caat.or.th`; routed internally to `registration@caat.or.th` (Aircraft Registration Division, Airworthiness and Aircraft Engineering Department).

#### Required attribution

> Source: Civil Aviation Authority of Thailand (CAAT) — https://www.caat.or.th. Register page: https://www.caat.or.th/certificates-licenses/aircraft/service-manual/aircraft-registration-application/.
>
> Licensed under Personal-use with attribution — non-commercial reuse and redistribution permitted. CAAT permits the Thailand Aircraft Register data to be used and shared for non-commercial projects with CAAT credited as the data source.
>
> The material has been changed: CAAT aircraft records are normalized into metal-birds-feed's canonical schema. This attribution does not imply endorsement by CAAT.

---

### FOCA / BAZL — Swiss Federal Office of Civil Aviation

- **Status:** 🛠️ Cleared — implementation pending (search-app CSV export path needs engineering verification)
- **Classification:** Open — bilateral grant confirmed by FOCA legal department
- **Source URL:** https://app02.bazl.admin.ch/web/bazl/en/#/lfr/search
- **Bulk download URL:** Search app supports CSV export; direct bulk endpoint unverified.
- **License:** Open via direct FOCA legal determination. Cleared 2026-05-22 by Jonas Goetz, Head of Swiss Aircraft Registry, Registry Officer, FOCA, citing legal department determination. FOCA confirmed the register is publicly available and that there are no restrictions, conditions, or formal procedures. The admin.ch site-wide prior-written-consent terms are overridden for this dataset by FOCA's direct legal determination.
- **Attribution required:** Not contractually required; attribution is provided as a courtesy.
- **Update cadence:** Not stated; refresh against the live search app.
- **Correspondence:** Sent 2026-05-05 to `aircraftregistry@bazl.admin.ch`; first reply 2026-05-06 acknowledged legal review; substantive legal-department reply received 2026-05-22 from Jonas Goetz.

#### Courtesy attribution

> Source: Federal Office of Civil Aviation (FOCA) — [bazl.admin.ch](https://www.bazl.admin.ch). Register search app: https://app02.bazl.admin.ch/web/bazl/en/#/lfr/search.
>
> Licensed under Open — per FOCA legal department, the registry is publicly available with no restrictions, conditions, or formal procedures. Attribution is provided as a courtesy.
>
> The material has been changed: FOCA aircraft records are normalized into metal-birds-feed's canonical schema. This attribution does not imply endorsement by FOCA.

---

## Conditional Open — awaiting substantive reply

License is published but carries use-conduct conditions that require agency confirmation before slotting. Substantive reply not yet received; ingest not slotted.

### GACA — General Authority of Civil Aviation, Saudi Arabia

- **Status:** Future — v3 dataset-publication request sent 2026-05-11, awaiting substantive reply
- **Classification:** Conditional Open (verified 2026-05-11 from live GACA Data Usage Policy)
- **Source URL:** https://gaca.gov.sa/en/Open-Data (Open Data Library — airports traffic only; per-tail register **not yet published**)
- **License surface:** https://gaca.gov.sa/en/open-data-policy
- **License (verbatim from live policy, verified 2026-05-11):** _"Open data refers to a set of information available without technical, financial, or legal restrictions that individuals can benefit from and use as needed."_
- **Terms of Reuse (verbatim):** Source attribution required (with link to gaca.gov.sa); no political, unlawful, criminal, racist, or incitement use; nothing contrary to KSA customs/traditions. **No non-commercial bar, no redistribution bar.**
- **Implementation status:** Per-tail aircraft register not yet published on the Open Data Library. Email asks for dataset publication or confirmation that the policy extends to register data from other GACA public surfaces.
- **Reply:** Non-substantive auto-acknowledgment received. Substantive reply pending.

---

## Excluded by agency request

### Transportstyrelsen — Swedish Transport Agency

- **Status:** ❌ Excluded by explicit agency request (2026-05-11)
- **Classification:** Excluded — Sweden asked to be left out
- **Source URL:** https://etjanster-luftfart.transportstyrelsen.se/en-gb/sokluftfartyg
- **Reply (verbatim):** Received 2026-05-11 from the Swedish Transport Agency / Swedish Civil Aircraft Register desk:

  > The Swedish Transport Agency prefers not to be a part of this project.
  > Kindly exclude Sweden from the project.
  >
  > Yours Sincerely,
  > The Swedish Civil Aircraft Register
  > The Swedish Transport Agency

- **Action commitment:** The Swedish civil aircraft register will not be ingested, normalized, or redistributed by metal-birds-feed. This exclusion is honored per the project's standing commitment to remove data on request.
- **Operator note:** Forks of metal-birds-feed must also honor this exclusion. Sweden's preference is not project-specific.
- **Revisit condition:** Affirmative reply from the Swedish Transport Agency reversing this decision, or the Agency publishes the register under an explicit open license at a future date.

---

### SHGM — Sivil Havacılık Genel Müdürlüğü (Türkiye)

- **Status:** ❌ Excluded by explicit agency request (2026-05-11)
- **Classification:** Excluded — SHGM asked to be left out after internal consultation
- **Source URL:** https://web.shgm.gov.tr/
- **Reply (verbatim):** Received 2026-05-11 from Fatma Reyyan AYYILDIZ, Aviation Expert, Flight Operations Department, Directorate General of Civil Aviation:

  > Dear Ms. Childress,
  >
  > I am writing to you on the behalf of Mr. Göral. We have received your email and consider your request. After consulting, we have decided that it would be more appropriate not to redistribute our data and, consequently, to exclude us from the project.
  >
  > Thank you for your email and we wish you success with your project.
  >
  > Best regards
  > Fatma Reyyan AYYILDIZ
  > Havacılık Uzmanı | Aviation Expert
  > Uçuş Operasyon Dairesi | Flight Operations Department
  > Sivil Havacılık Genel Müdürlüğü
  > Directorate General of Civil Aviation

- **Action commitment:** The Türkiye civil aircraft register will not be ingested, normalized, or redistributed by metal-birds-feed.
- **Operator note:** Forks of metal-birds-feed must also honor this exclusion. SHGM's preference is not project-specific.
- **Revisit condition:** Affirmative reply from SHGM reversing this decision, or SHGM publishes the register under an explicit open license at a future date.

---

### Austro Control — Austria

- **Status:** ❌ Excluded by explicit agency request (2026-06-09 after legal review)
- **Classification:** Excluded — Austro Control denied redistribution authorization
- **Source URL:** https://www.austrocontrol.at/en/aviation_agency/aircraft/aircraft_register/overview__supplement
- **Reply (verbatim):** Received 2026-06-09 from Nina Schraml, Aviation Agency / Section Airworthiness AIR / Aircraft Register, Austro Control GmbH:

  > Dear Ms. Chldress,
  > after consultation with our legal department, we would like to inform you that Austro Control GmbH does not authorize the redistribution of the published aircraft register.
  > Kind regards,
  > NINA SCHRAML
  > Aviation Agency
  > Section Airworthiness / AIR
  > Aircraft Register
  > Austro Control GmbH

- **Action commitment:** The Austrian civil aircraft register will not be ingested, normalized, or redistributed by metal-birds-feed.
- **Operator note:** Forks of metal-birds-feed must also honor this exclusion. Austro Control's denial is not project-specific.
- **Revisit condition:** Affirmative reply from Austro Control reversing this decision, or Austro Control publishes the register under an explicit open license at a future date.

---

### DCA Mauritius — Department of Civil Aviation

- **Status:** ❌ Excluded by explicit agency reply (2026-06-08 — "for viewing only")
- **Classification:** Excluded — DCA Mauritius confirmed the register is publicly viewable but not redistributable
- **Source URL:** https://civil-aviation.govmu.org/
- **Reply (verbatim):** Received 2026-06-08 from S Rambricho, Ag. Director of Civil Aviation, Department of Civil Aviation, SSR International Airport, Republic of Mauritius (Ref: CAV/GEN/1/1):

  > Dear Sir,
  >
  > We refer to your email dated 11 May 2026 regarding the above-mentioned subject.
  >
  > We wish to inform you that the document is accessible for viewing only with respect to the aircraft registration, date of registration and name of owner only.
  >
  > However, other pertinent information cannot be disclosed due to the provisions of the Data Protection Act.
  >
  > S RAMBRICHH
  > Ag. Director of Civil Aviation
  > Department of Civil Aviation
  > SSR International Airport
  > Plaine - Magnien
  > REPUBLIC OF MAURITIUS

- **Interpretation:** "Accessible for viewing only" is an implicit denial of redistribution; the disclosed fields are view-scoped, the rest protected under the Mauritius Data Protection Act.
- **Action commitment:** The Mauritian civil aircraft register will not be ingested, normalized, or redistributed by metal-birds-feed.
- **Operator note:** Forks of metal-birds-feed must also honor this exclusion. DCA Mauritius's view-only posture is not project-specific.
- **Revisit condition:** Affirmative reply from DCA Mauritius granting redistribution rights, or the Department publishes the register under an explicit open license at a future date.

---

### UAEAC Colombia — Unidad Administrativa Especial de Aeronáutica Civil

- **Status:** ❌ Excluded by formal administrative reply (2026-06-17 — Radicado 2026240060041283 Id 2605417; no appeal available under Ley 1755 de 2015)
- **Classification:** Excluded — UAEAC denied both redistribution authorization and bulk-download channel
- **Source URL:** https://www.aerocivil.gov.co/autoridad_aeronautica/publicaciones/3704/registro-de-aeronaves/
- **Reply (verbatim, Spanish — operative paragraphs from the official radicado):** Received 2026-06-17 from Hugo Moreno Cano, Coordinador Grupo Registro Aeronáutico, Unidad Administrativa Especial de Aeronáutica Civil. Authored by José Andrés Galeano Higgins, Técnico Aeronáutico:

  > Respecto a la solicitud de acceso a un canal de descarga masiva (bulk download), es pertinente indicar que la Aeronáutica Civil no suministra ni habilita mecanismos de extracción masiva o automatizada de la información, en la medida en que ello puede comprometer el adecuado uso de la información pública y el cumplimiento de las disposiciones legales en materia de protección de datos.
  >
  > En consecuencia, si bien la información se encuentra disponible para consulta pública, no es posible acceder favorablemente a la solicitud de redistribución o provisión de mecanismos de descarga masiva.
  >
  > La presente respuesta se emite en los términos de la Ley 1755 de 2015 y contra la misma no procede recurso alguno, sin perjuicio del derecho que le asiste de presentar nuevas solicitudes o acudir a las instancias correspondientes.

- **Translation (operative paragraphs):**

  > Regarding the request for access to a bulk download channel, it is pertinent to indicate that Aeronáutica Civil does not supply or enable mechanisms for mass or automated extraction of the information, insofar as this could compromise the proper use of public information and compliance with legal data-protection provisions.
  >
  > Consequently, although the information is available for public consultation, it is not possible to favorably grant the request for redistribution or for provision of mass-download mechanisms.
  >
  > This response is issued under the terms of Law 1755 of 2015 and no appeal proceeds against it, without prejudice to the right to file new requests or to approach the corresponding instances.

- **Interpretation:** Formal administrative denial. Two specific elements were refused: (1) redistribution authorization and (2) provision of a bulk-download channel. Public consultation remains available in-person at the Oficina de Registro Aeronáutico Nacional, under the Habeas Data protections of Articles 15 and 21 of the Colombian Constitution and the data-protection framework of Ley 1581 de 2012 and Ley 1712 de 2014.
- **Action commitment:** The Colombian civil aircraft register will not be ingested, normalized, or redistributed by metal-birds-feed.
- **Operator note:** Forks of metal-birds-feed must also honor this exclusion. UAEAC's denial is not project-specific and applies to any bulk redistribution attempt.
- **Revisit condition:** UAEAC publishes the register under explicit reuse terms (e.g., via datos.gov.co or a future open-data declaration), or grants redistribution rights through a future administrative resolution.

---

## Personal-use — awaiting reply

### CAA NZ — Civil Aviation Authority of New Zealand

- **Status:** Planned — permission request sent, awaiting reply
- **Classification:** Personal-use
- **Source URL:** https://www.aviation.govt.nz/aircraft/aircraft-registration/aircraft-register-search/
- **Bulk download URL:** https://www.aviation.govt.nz/assets/aircraft/aircraft-register/Aircraft-Register-for-website-.csv
- **License:** All rights reserved with personal-use exception. Per https://www.aviation.govt.nz/about-us/website-information/copyright/: personal reproduction permitted with attribution; commercial/redistribution/derived datasets require written permission to info@caa.govt.nz.
- **Attribution required:** "Source: Civil Aviation Authority of New Zealand — https://www.aviation.govt.nz/aircraft/aircraft-registration/aircraft-register-search/"
- **Update cadence:** Continuous-to-weekly.
- **Permission email:** Sent 2026-05-05 to `info@caa.govt.nz` (cc: `aircraftregistrar@caa.govt.nz`). The 30-day fallback does **not** apply — silence is not permission for Personal-use sources.
- **Reply:** _pending_

---

### DGAC France — Direction Générale de l'Aviation Civile

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Personal-use (verified 2026-05-05 from explicit register-page disclaimer)
- **Source URL:** https://immat.aviation-civile.gouv.fr/immat/servlet/aeronef_liste.html
- **Bulk download URL:** https://immat.aviation-civile.gouv.fr/immat/servlet/static/upload/export.csv (direct CSV, updated monthly on the 1st)
- **License:** Personal-use only. Per the register page (verbatim French): _"Les données du registre ne sont communiquées sur internet qu'à titre de simple information. Pour toute utilisation officielle, il convient de demander au fonctionnaire chargé de la tenue du registre un extrait du registre dûment signé."_ (Translation: "The register data is communicated on the internet only for informational purposes. For any official use, you must request a duly signed extract of the register from the official in charge of the register.") Paid extract at https://redevances.aviation-civile.gouv.fr (€6/extract) is the channel for non-informational use.
- **Update cadence:** Monthly (CSV regenerated on the 1st of each month).
- **Permission email:** Sent 2026-05-05 to `immat@aviation-civile.gouv.fr`. The 30-day fallback does **not** apply.
- **Reply:** _pending_

---

### DAC Luxembourg — Direction de l'Aviation Civile

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Personal-use (verified 2026-05-10 from DAC Aspects légaux)
- **Source URL:** https://dac.gouvernement.lu/fr/demarches/immatriculation-aeronefs/releve-immatriculations.html
- **Bulk download URL:** Direct PDF on date-stamped filename pattern (e.g. `relev-aronefs-10-04-2026.pdf`)
- **License:** Personal-use only. Per DAC's [Aspects légaux](https://dac.gouvernement.lu/fr/support/aspects-legaux.html) (verbatim French): _"Sauf indication contraire, l'Etat du Grand-Duché de Luxembourg n'accorde **aucune licence ou autorisation** relative aux droits de propriété intellectuelle qu'il a sur ce site, ses éléments ou les Services."_ The text-document exception is narrow: _"l'usager est autorisé à consulter, télécharger et imprimer les documents de type texte sans demande préalable"_ — consult, download, print only; not redistribute or modify.
- **Format note:** PDF — ingest blocked on PDF parser path.
- **Permission email:** Sent 2026-05-10 to `nav@av.etat.lu`. The 30-day fallback does **not** apply.
- **Reply:** _pending_

---

### ANAC Algeria — Autorité Nationale de l'Aviation Civile

- **Status:** Future — permission request sent, awaiting reply
- **Classification:** Personal-use (verified 2026-05-11 from Politique d'utilisation Section 6)
- **Source URL:** https://www.anac.dz/en/home/
- **License surface:** https://www.anac.dz/wp-content/uploads/2025/01/Politique-dutilisation-du-site-web-de-lANAC-25122024.pdf
- **License (verbatim French, Section 6):** _"L'utilisateur ne peut utiliser ce site qu'à des fins licites, personnelles et non commerciales."_ (English: "The user may only use this site for lawful, personal, and non-commercial purposes.")
- **Permission email:** Sent 2026-05-11 to `contact@anac.dz`. The 30-day fallback does **not** apply.
- **Reply:** _pending_

---

## Unknown — awaiting reply

### IAA — Irish Aviation Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://iaa.mysrs.ie (MySRS portal; sign-up required)
- **Bulk download URL:** Monthly XLSX via MySRS portal; URL not yet captured.
- **License:** Pending verification. No public license statement; MySRS T&Cs behind portal sign-up.
- **Permission email:** Sent 2026-05-05 to `registration@iaa.ie`.
- **Reply:** _pending_

---

### ANAC Argentina — Administración Nacional de Aviación Civil

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://geo.anac.gob.ar/afectacion
- **Bulk download URL:** TBD (search-only interface)
- **License:** Pending verification.
- **Permission email:** Sent 2026-05-05 to `registro@anac.gob.ar`.
- **Reply:** _pending_

---

### Luftfartstilsynet — Civil Aviation Authority of Norway

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://luftfartstilsynet.no/aktorer/norges-luftfartoyregister/registrerte-luftfartoy/
- **Bulk download URL:** https://data.caa.no/nlr/norgesluftfartoyregister.json (direct JSON, no auth required)
- **License:** Pending verification. `data.norge.no` tags the dataset "Public access" but License field is empty. Norwegian public-sector data generally falls under NLOD (broadly equivalent to CC BY 4.0) but not explicitly declared.
- **Update cadence:** Daily at 16:00 Oslo time.
- **Permission email:** Sent 2026-05-05 to `postmottak@caa.no`. Register-specific desk: `nlr@caa.no` (preferred for follow-up).
- **Reply:** _pending_

---

### AFAC — Mexican Federal Civil Aviation Agency

- **Status:** Future — awaiting reply; **leans Excluded** pending AFAC confirmation
- **Classification:** Unknown
- **Source URL:** https://www.gob.mx/afac
- **Bulk download URL:** None published. `portal-de-servicios.afac.gob.mx` is login-walled; Registro Aeronáutico Mexicano not on `datos.gob.mx`. Third-party sources suggest per-record fees (~$10 USD/search); if confirmed, moves to Excluded.
- **Permission email:** Sent 2026-05-05 to `tramites@afac.gob.mx`.
- **Reply:** _pending_

---

### BCAA / DGTA — Belgian Civil Aviation Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://es.mobilit.fgov.be/aircraft-registry/main/search?lang=en
- **Bulk download URL:** TBD (search interface)
- **Permission email:** Sent 2026-05-05 to `bcaa.registration@mobilit.fgov.be`.
- **Reply:** _pending_

---

### DKPPU — Directorate of Airworthiness and Aircraft Operation, Indonesia

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://imsis-djpu.kemenhub.go.id/PortalDKPPU/
- **Bulk download URL:** PDF at DKPPU portal (e.g. CAR2025E.pdf).
- **Update cadence:** Annual CAR publication.
- **Permission email:** Sent 2026-05-05 to `produkaeronautika_dkuppu@dephub.go.id`.
- **Reply:** _pending_

---

### JCAA — Jamaica Civil Aviation Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.jcaa.gov.jm/aircraft-registry-page/
- **Permission email:** Sent 2026-05-05 to `info@jcaa.gov.jm`.
- **Reply:** _pending_

---

### KOCA / MOLIT — Korea Office of Civil Aviation

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://atis.koca.go.kr/ATIS/aircraft/forwardPage.do
- **Bulk download URL:** TBD (Excel file per avcodes)
- **Permission email:** Sent 2026-05-05 to `lia0404@korea.kr`.
- **Reply:** _pending_

---

### Trafikstyrelsen — Danish Civil Aviation and Railway Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.trafikstyrelsen.dk/arbejdsomraader/luftfart/ansoegninger-individuelle/flyejer/luftfartoejsregister
- **Bulk download URL:** None published. SharePoint document library appears login-walled.
- **Permission email:** Sent 2026-05-05 to `info@trafikstyrelsen.dk`.
- **Reply:** _pending_

---

### Dopravný úrad — Slovak Transport Authority (NSAT)

- **Status:** Future — awaiting reply; **strongly leaning Open** (CC BY 4.0 from data.gov.sk portal default)
- **Classification:** Unknown
- **Source URL:** https://data.gov.sk/dataset/register-lietadiel
- **Bulk download URL:** PDF per dataset page (JS-rendered; direct URL pending reply).
- **Permission email:** Sent 2026-05-10 to `register.lietadiel@nsat.sk`.
- **Reply:** _pending_

---

### CAA Kyrgyzstan — State Agency for Civil Aviation

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://caa.kg/ru/reestr-grazhdanskikh-vozdushnykh-sudov-kyrgyzskoy-respubliki
- **Bulk download URL:** HTML table inline on register page (~64 aircraft). HTML scrape required.
- **Permission email:** Sent 2026-05-10 to `mail@caa.kg`.
- **Reply:** _pending_

---

### AACM Macau — Civil Aviation Authority of Macao SAR

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.aacm.gov.mo/en/industry-page/RegisteredAircraft
- **Bulk download URL:** None published. List view only; likely HTML scrape if bulk channel not granted.
- **Permission email:** Sent 2026-05-10 to `aacm@aacm.gov.mo`.
- **Reply:** _pending_

---

### TKA — Transport Competence Agency of Lithuania

- **Status:** Future — awaiting reply; **strongly leaning Open** (CC BY 4.0 from data.gov.lt portal default)
- **Classification:** Unknown
- **Source URL:** https://data.gov.lt/datasets/2735/
- **Bulk download URL:** Spinta API at https://get.data.gov.lt/datasets/gov/tka/registras/Irasas (paginated JSON; multiple formats including CSV).
- **Update cadence:** Continuous (per-record freshness field).
- **Permission email:** Sent 2026-05-10 to `info@tka.lt`.
- **Reply:** _pending_

---

### CAA Lebanon — Civil Aviation Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://caa.gov.lb
- **Bulk download URL:** None known. Legacy DGCA register was inline HTML; new authority's canonical URL not yet surfaced.
- **Permission email:** Sent 2026-05-10 to `info@caa.gov.lb`.
- **Reply:** _pending_

---

### Közlekedési Hatóság — Hungarian Transport Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.kozlekedesihatosag.kormany.hu/hu/dokumentum/104604
- **Bulk download URL:** Direct PDF on hash-stamped path. Updated near-daily (business days).
- **Update cadence:** Near-daily.
- **Format note:** PDF — ingest blocked on PDF parser path.
- **Permission email:** Sent 2026-05-10 to `lfhf@ekm.gov.hu`.
- **Reply:** _pending_

---

### GDCA / CAC Armenia — Civil Aviation Committee

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** http://www.aviation.am/registered_aircrafts
- **Bulk download URL:** Direct PDF at aviation.am (last update 2025-02-26 — stale).
- **Format note:** PDF — ingest blocked on PDF parser path.
- **Permission email:** Sent 2026-05-10 to `info@aviation.am`.
- **Reply:** _pending_

---

### CAA Bulgaria — Directorate General Civil Aviation Administration

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.caa.bg/en/node/17238
- **Bulk download URL:** Direct XLSX (e.g. `Aircraft_Register_YYYYMMDD.xlsx`; last file dated 2025-04-30 — over a year stale).
- **Update cadence:** Appears annual at best.
- **Permission email:** Sent 2026-05-10 to `AIRWORTHINESS@caa.bg`.
- **Reply:** _pending_

---

### BHDCA — Bosnia and Herzegovina Directorate of Civil Aviation

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** http://www.bhdca.gov.ba/index.php/en/doc/registar-civilnih-zrakoplova
- **Bulk download URL:** PDF embedded on register page.
- **Format note:** PDF — ingest blocked on PDF parser path.
- **Permission email:** Sent 2026-05-10 to `bhdca@bhdca.gov.ba`.
- **Reply:** _pending_

---

### CAA Moldova — Autoritatea Aeronautică Civilă a Republicii Moldova

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.caa.md/rom/register/
- **Bulk download URL:** https://www.caa.md/modules/filemanager/files/documentum/Registrul_Aerian_al_Republicii_Moldova.pdf
- **Format note:** PDF — ingest blocked on PDF parser path.
- **Permission email:** Sent 2026-05-10 to `info@caa.gov.md`.
- **Reply:** _pending_

---

### MCAA Mongolia — Civil Aviation Authority of Mongolia

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.mcaa.gov.mn/
- **Bulk download URL:** https://mcaa.gov.mn/PDF/REGISTER.PDF (last surfaced 2022-07-16 — ~3 years stale).
- **Format note:** PDF — ingest blocked on PDF parser path.
- **Permission email:** Sent 2026-05-10 to `info@mcaa.gov.mn`.
- **Reply:** _pending_

---

### IACM Mozambique — Instituto de Aviação Civil de Moçambique

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.iacm.gov.mz/
- **Bulk download URL:** None published.
- **Permission email:** Sent 2026-05-10 to `info@iacm.gov.mz`.
- **Reply:** _pending_

---

### ACG Montenegro — Agencija za civilno vazduhoplovstvo Crne Gore

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.caa.me/en/registri
- **Bulk download URL:** HTML scrape — paginated table (~70 aircraft) with per-aircraft detail pages. HTML scrape required.
- **Permission email:** Sent 2026-05-10 to `acv@caa.me`.
- **Reply:** _pending_

---

### DGAC Guatemala — Dirección General de Aeronáutica Civil

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.dgac.gob.gt/registro-aeronautico-nacional/
- **Bulk download URL:** None published. Legacy Java/Tomcat consultation portal only.
- **Permission email:** Sent 2026-05-10 to `registro.aeronautico@dgac.gob.gt`.
- **Reply:** _pending_

---

### IDAC Dominican Republic — Instituto Dominicano de Aviación Civil

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.idac.gob.do/en/national-aircraft-regulatory-and-registry-directorate/
- **Bulk download URL:** None published. Consultation portal only.
- **Permission email:** Sent 2026-05-10 to `info@idac.gov.do`.
- **Reply:** _pending_

---

### DGAC Chile — Dirección General de Aeronáutica Civil

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.dgac.gob.cl/aeronaves-2/registro-nacional-de-aeronaves/
- **Bulk download URL:** None published. Login-walled portal only.
- **Permission email:** Sent 2026-05-10 to `registro.aeronaves@dgac.gob.cl`.
- **Reply:** _pending_

---

### DINACIA Uruguay — Dirección Nacional de Aviación Civil e Infraestructura Aeronáutica

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.dinacia.gub.uy/
- **Bulk download URL:** XLSX reportedly available from "Aeronaves" section; canonical URL pending reply.
- **Permission email:** Sent 2026-05-10 to `dinacia@dinacia.gub.uy`.
- **Reply:** _pending_

---

### UZCAA Uzbekistan — State Civil Aviation Inspectorate

- **Status:** Future — awaiting reply; **leans Open** given Uzbekistan's published open-data legal framework
- **Classification:** Unknown
- **Source URL:** https://gov.uz/en/mintrans
- **Bulk download URL:** TBD.
- **Permission email:** Sent 2026-05-11 to `info@mintrans.uz` (routed via parent Ministry of Transport with forward request to UZCAA).
- **Reply:** _pending_

---

### ANAC Togo — Agence Nationale de l'Aviation Civile du Togo

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.anac-togo.tg/espace-professionnel/aeronefs/consultation-du-registre-dimmatriculation/
- **Bulk download URL:** None published. Consultation portal only.
- **Permission email:** Sent 2026-05-10 to `anac@anac-togo.tg`.
- **Reply:** _pending_

---

### AAC Albania — Autoriteti i Aviacionit Civil të Shqipërisë

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.aac.gov.al/
- **Bulk download URL:** None surfaced.
- **Permission email:** Sent 2026-05-10 to `info@acaa.gov.al`.
- **Reply:** _pending_

---

### HCAA Greece — Hellenic Civil Aviation Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://hcaa.gov.gr/en
- **Bulk download URL:** TBD.
- **Permission email:** Sent 2026-05-10 to `info@hcaa.gov.gr`.
- **Reply:** _pending_

---

### ULC Poland — Urząd Lotnictwa Cywilnego

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://ulc.gov.pl/technika-lotnicza/rejestr-cywilnych-statkow-powietrznych
- **Bulk download URL:** TBD.
- **Permission email:** Sent 2026-05-10 to `ltt@ulc.gov.pl`.
- **Reply:** _pending_

---

### ANAC Portugal — Autoridade Nacional da Aviação Civil

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.anac.pt/vPT/Generico/Aeronaves/RegistoAeronauticoNacional/Paginas/RegistoAeronauticoNacional.aspx
- **Bulk download URL:** None published. Per-record certified extracts only.
- **Contact channel:** Webform-only (no public email). Submitted via https://www.anac.pt/VPT/FOOTER/Paginas/Contactenos.aspx.
- **Reply:** _pending_

---

### DGAC Bolivia — Dirección General de Aeronáutica Civil

- **Status:** Future — awaiting reply; **leans Open** ("Registro Público" framing)
- **Classification:** Unknown
- **Source URL:** https://www.dgac.gob.bo/registro-publico-de-aeronaves/
- **Permission email:** Sent 2026-05-10 to `dgacbol@dgac.gob.bo`.
- **Reply:** _pending_

---

### DGAC Costa Rica — Dirección General de Aviación Civil

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://sub.dgac.go.cr/aeronautica_/registro-aeronautico/
- **Permission email:** Sent 2026-05-10 to `ventanillaunica@dgac.go.cr`.
- **Reply:** _pending_

---

### DGAC Ecuador — Dirección General de Aviación Civil

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.aviacioncivil.gob.ec/registro-aeronautico/
- **Permission email:** Sent 2026-05-10 to `oswaldo.veloz@aviacioncivil.gob.ec`.
- **Reply:** _pending_

---

### AAC El Salvador — Autoridad de Aviación Civil de El Salvador

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.aac.gob.sv/registro-aeronautico/
- **Permission email:** Sent 2026-05-11 to `rarevalo@aac.gob.sv`.
- **Reply:** _pending_

---

### AHAC Honduras — Agencia Hondureña de Aeronáutica Civil

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.ahac.gob.hn/RAN
- **Permission email:** Sent 2026-05-10 to `secretariaadministrativa@ahac.gob.hn`.
- **Reply:** _pending_

---

### INAC Nicaragua — Instituto Nicaragüense de Aeronáutica Civil

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.inac.gob.ni/
- **Permission email:** Sent 2026-05-10 to `info@inac.gob.ni`.
- **Reply:** _pending_

---

### AAC Panama — Autoridad de Aeronáutica Civil de Panamá

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://sigob.aeronautica.gob.pa/snra/subtipo/2
- **Permission email:** Sent 2026-05-10 to `Rafael.barcenas@aeronautica.gob.pa`.
- **Reply:** _pending_

---

### DINAC Paraguay — Dirección Nacional de Aeronáutica Civil

- **Status:** Future — routing acknowledgment received from RAN desk; substantive reply pending
- **Classification:** Unknown
- **Source URL:** https://www.dinac.gov.py/
- **Permission email:** Sent 2026-05-10 to `sec_gral@dinac.gov.py`. Request was forwarded to Registro Aeronáutico Nacional (RAN) desk as requested.
- **Reply:** _pending_ (routing ack received; substantive license reply outstanding)

---

### DGAC Peru — Dirección General de Aeronáutica Civil

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://portal.mtc.gob.pe/transportes/aeronautica_civil/
- **Permission email:** Sent 2026-05-10 to `pmarin@mtc.gob.pe`.
- **Reply:** _pending_

---

### CAA Slovenia — Javna agencija za civilno letalstvo

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.caa.si/register-zrakoplovov.html
- **Bulk download URL:** TBD.
- **Permission email:** Sent 2026-05-10 to `matej.dolinar@caa.si`.
- **Reply:** _pending_

---

### AAC Cabo Verde — Agência de Aviação Civil de Cabo Verde

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.aac.cv/artigos/registo-aeronautico
- **Bulk download URL:** None published. Web-page list only; likely HTML scrape.
- **Permission email:** Sent 2026-05-10 to `info@aac.cv`.
- **Reply:** _pending_

---

### OFNAC Haiti — Office National de l'Aviation Civile

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://ofnac.gouv.ht/
- **Bulk download URL:** None published. Consultation portal at https://registreimm.net/aircraftSearchingView (search-only).
- **Permission email:** Sent 2026-05-10 to `division.ais@ofnac.gouv.ht`.
- **Reply:** _pending_

---

### CCAA — Croatian Civil Aviation Agency

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.ccaa.hr/en/list-of-registered-aircraft-94674
- **Bulk download URL:** Direct PDF, updated first day of each month.
- **Update cadence:** Monthly.
- **Format note:** PDF — ingest blocked on PDF parser path.
- **Permission email:** Sent 2026-05-10 to `registar@ccaa.hr`.
- **Reply:** _pending_

---

### CAA CR — Civil Aviation Authority of the Czech Republic

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://lr.caa.gov.cz/letecky-rejstrik?lang=en
- **Bulk download URL:** None published. JS-rendered SPA, search-only. Note: Czech Republic enacted a 2024 law mandating "public registries maintained by law" be published as open data — the aircraft register fits but is not yet listed.
- **Permission email:** Sent 2026-05-10 to `dousova@caa.cz`.
- **Reply:** _pending_

---

### CAAM — Civil Aviation Authority of Malaysia

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.caam.gov.my/
- **Contact channel:** Webform submission at https://www.caam.gov.my/contact-us/.
- **Reply:** _pending_

---

### CAASL — Civil Aviation Authority of Sri Lanka

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.caa.lk/en/downloads/sl-aircraft-register
- **Bulk download URL:** TBD (PDF download link present).
- **Permission email:** Sent 2026-05-05 to `daw@caa.lk`.
- **Reply:** _pending_

---

### CASA PNG — Civil Aviation Safety Authority of Papua New Guinea

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://casapng.gov.pg/safety-regulatory/airworthiness/Aircraft-Registers/
- **Bulk download URL:** TBD (PDF format per avcodes).
- **Permission email:** Sent 2026-05-05 to `info@casapng.gov.pg`.
- **Reply:** _pending_

---

### DCA Cyprus — Department of Civil Aviation

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.mcw.gov.cy/mcw/dca/dca.nsf/DMLregister_en/DMLregister_en?OpenDocument
- **Permission email:** Sent 2026-05-05 to `director@dca.mcw.gov.cy`.
- **Reply:** _pending_

---

### DGCA India — Directorate General of Civil Aviation

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.dgca.gov.in/
- **Bulk download URL:** TBD (PDF per avcodes).
- **Permission email:** Sent 2026-05-05 to `rkanand.dgca@nic.in`.
- **Reply:** _pending_

---

### BCAA — Bahamas Civil Aviation Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://caabahamas.com/registers/
- **Permission email:** Sent 2026-05-05 to `atl@caabahamas.com`.
- **Reply:** _pending_

---

### BDCA — Belize Department of Civil Aviation

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.civilaviation.gov.bz/index.php/bdca-civil-aircraft-register
- **Permission email:** Sent 2026-05-05 to `director@civilaviation.gov.bz`.
- **Reply:** _pending_

---

### CAAB — Civil Aviation Authority of Botswana

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.caab.co.bw/caab-content.php?cid=299
- **Permission email:** Sent 2026-05-05 to `caab@caab.co.bw`.
- **Reply:** _pending_

---

### CAAF — Civil Aviation Authority of Fiji

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.caaf.org.fj/aircraft-register-search/
- **Permission email:** Sent 2026-05-05 to `info@caaf.org.fj`.
- **Reply:** _pending_

---

### CAD Malta — Civil Aviation Directorate, Transport Malta

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.transport.gov.mt/aviation/aircraft-flight-standards/registration-of-aircraft-2663
- **Permission email:** Sent 2026-05-05 to `civil.aviation@transport.gov.mt`.
- **Reply:** _pending_

---

### CARC — Civil Aviation Regulatory Commission, Jordan

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.carc.jo/en/content/344-jordanian-registered-aircraft
- **Permission email:** Sent 2026-05-05 to `info@carc.gov.jo`.
- **Reply:** _pending_

---

### CASAS — Civil Aviation Safety Authority Suriname

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.casas.sr/registry/
- **Permission email:** Sent 2026-05-05 to `casasinfo@casas.sr`.
- **Reply:** _pending_

---

### ECAA — Ethiopian Civil Aviation Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.ecaa.gov.et/home/aircraft-registered-by-the-authority-and-operational-today/
- **Permission email:** Sent 2026-05-05 to `caa.airnav@ethionet.et`.
- **Reply:** _pending_

---

### ICETRA — Icelandic Transport Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://island.is/en/aircraft-registry
- **Bulk download URL:** None published. Search-only interface; no downloadable artifact.
- **Permission email:** Sent 2026-05-05 to `samgongustofa@samgongustofa.is`.
- **Reply:** _pending_

---

### PCAA — Pakistan Civil Aviation Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://apps.caapakistan.com.pk:412/Aircraft/rptArcftRegisterOut.aspx
- **Permission email:** Sent 2026-05-05 to `umair.sufyan@caapakistan.com.pk`.
- **Reply:** _pending_

---

### SCAA — Seychelles Civil Aviation Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.scaa.sc/index.php/regulatory/e-registers/aircraft-civil-register
- **Permission email:** Sent 2026-05-05 to `secretariat@scaa.sc`.
- **Reply:** _pending_

---

### Tajikistan Civil Aviation Agency

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://caa.tj/
- **Permission email:** Sent 2026-05-11 to `info@caa.tj`.
- **Reply:** _pending_

---

### TCAA — Tanzania Civil Aviation Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.tcaa.go.tz/page?p=Aircraft+Registration
- **Permission email:** Sent 2026-05-05 to `tcaa@tcaa.go.tz`.
- **Reply:** _pending_

---

### TTCAA — Trinidad and Tobago Civil Aviation Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://caa.gov.tt/aircraft-on-ttcaa-register/
- **Permission email:** Sent 2026-05-05 to `ttcaa@caa.gov.tt`.
- **Reply:** _pending_

---

### GCAA — Georgian Civil Aviation Agency

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://gcaa.ge/civil-aircraft-register/
- **Bulk download URL:** None — register published as inline HTML table (~63 aircraft). HTML scrape required.
- **Permission email:** Sent 2026-05-05 to `office@gcaa.ge`.
- **Reply:** _pending_

---

### CAD Serbia — Civil Aviation Directorate

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://cad.gov.rs/strana/20841/Аccess-to-the-electronic-aircraft-registry
- **Bulk download URL:** Direct PDF (`https://cad.gov.rs/upload/plovidbenost/Registar%20vazduhoplova.pdf`).
- **Format note:** PDF — ingest blocked on PDF parser path.
- **Permission email:** Sent 2026-05-10 to `dgca@cad.gov.rs`.
- **Reply:** _pending_

---

### SAAU — State Aviation Administration of Ukraine

- **Status:** Future — awaiting reply; **strongly leaning Open** (CC BY 4.0 from data.gov.ua portal default)
- **Classification:** Unknown
- **Source URL:** https://data.gov.ua/dataset/08a647a0-7829-46ab-aa50-5afb7146a7a8
- **Bulk download URL:** Excel file (`avia.gov.ua/register_of_aircraft.xls`); also on data.gov.ua with daily auto-refresh.
- **Update cadence:** Daily auto-update.
- **Note:** Wartime context — responses may be delayed; ingest suspended on operational-security request at any time.
- **Permission email:** Sent 2026-05-10 to `vdz@avia.gov.ua`.
- **Reply:** _pending_

---

### ANAC Angola — Autoridade Nacional da Aviação Civil de Angola

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://anac.ao/
- **Permission email:** Sent 2026-05-11 to `sec.anac.ao@gmail.com` (agency-confirmed canonical address).
- **Reply:** _pending_

---

### CCAA — Cameroon Civil Aviation Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.ccaa.aero/
- **Permission email:** Sent 2026-05-11 to `contact@ccaa.aero`.
- **Reply:** _pending_

---

### ANAC CI — Autorité Nationale de l'Aviation Civile de Côte d'Ivoire

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.anac.ci/
- **Permission email:** Sent 2026-05-11 to `info@anac.ci`.
- **Reply:** _pending_

---

### AAC RDC — Autorité de l'Aviation Civile de la République Démocratique du Congo

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.aacrdc.org/
- **Bulk download URL:** Register navigation links exist but are empty; publication anticipated.
- **Permission email:** Sent 2026-05-11 to `info@aacrdc.org`.
- **Reply:** _pending_

---

### ACM — Aviation Civile de Madagascar

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** http://www.acm.mg/
- **Note:** SSL cert chain at acm.mg is broken — operator-side fix required before ingest pipeline can fetch over HTTPS.
- **Permission email:** Sent 2026-05-11 to `acm@acm.mg`.
- **Reply:** _pending_

---

### NCAA — Nigerian Civil Aviation Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://ncaa.gov.ng/
- **Permission email:** Sent 2026-05-11 to `info@ncaa.gov.ng`.
- **Reply:** _pending_

---

### ANACIM — Agence Nationale de l'Aviation Civile et de la Météorologie (Senegal)

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.anacim.sn/
- **Permission email:** Sent 2026-05-11 to `anacim@anacim.sn`.
- **Reply:** _pending_

---

### SACAA — South African Civil Aviation Authority

- **Status:** Future — awaiting reply; **leans Excluded** (restrictive TOU + PAIA framework)
- **Classification:** Unknown
- **Source URL:** https://www.caa.co.za/
- **Note:** PAIA (Promotion of Access to Information Act) framework — if reply confirms PAIA-only access, moves to Excluded (PAIA grants one-off copies, not ongoing redistribution rights).
- **Permission email:** Sent 2026-05-11 to `clientcare@caa.co.za` (case ref 120146).
- **Reply:** _pending_

---

### UCAA — Uganda Civil Aviation Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://caa.go.ug/
- **Permission email:** Sent 2026-05-11 to `aviation@caa.co.ug`.
- **Reply:** _pending_

---

### CAAZ — Civil Aviation Authority of Zimbabwe

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.caaz.co.zw/
- **Note:** CAAZ acknowledged receipt and flagged legal, regulatory, data protection, cybersecurity, and sovereign oversight dimensions for internal review. Substantive yes/no pending.
- **Permission email:** Sent 2026-05-11 to `licencing@caaz.co.zw`.
- **Reply:** _pending_

---

### ANAC Bénin — Agence Nationale de l'Aviation Civile du Bénin

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://anac.bj/
- **Permission email:** Sent 2026-05-11 to `secretariatanacbenin@gmail.com` (agency Gmail fallback; both `anac.bj` and `leland.bj` mail domains are dead).
- **Reply:** _pending_

---

### ANAC Burkina — Agence Nationale de l'Aviation Civile du Burkina Faso

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://anac.bf/
- **Permission email:** Sent 2026-05-11 to `info@anacburkina.org`.
- **Reply:** _pending_

---

### Ministry of Transport — Cook Islands

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.transport.gov.ck/
- **Permission email:** Sent 2026-05-11 to `mot.information@cookislands.gov.ck`.
- **Reply:** _pending_

---

### ECCAA — Eastern Caribbean Civil Aviation Authority (regional)

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.eccaa.aero/
- **Note:** Regional body covering 7 OECS member states (Antigua V2-, Anguilla VP-A, Dominica J7-, Grenada J3-, St Kitts V4-, St Lucia J6-, St Vincent J8-).
- **Permission email:** Sent 2026-05-11 to `contact@eccaa.aero`.
- **Reply:** _pending_

---

### ESWACAA — Eswatini Civil Aviation Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.eswacaa.co.sz/
- **Permission email:** Sent 2026-05-11 to `info@eswacaa.co.sz`.
- **Reply:** _pending_

---

### GCAA — Guyana Civil Aviation Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.gcaa-gy.org/
- **Permission email:** Sent 2026-05-11 to `aig@gcaa-gy.org` (primary AIS inbox `aisguyana@gcaa-gy.org` has a full mailbox).
- **Reply:** _pending_

---

### CAD HK — Civil Aviation Department, Hong Kong SAR

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.cad.gov.hk/english/planereg.html
- **Permission email:** Sent 2026-05-11 to `enquiry@cad.gov.hk`.
- **Reply:** _pending_

---

### Aviation Administration of Kazakhstan

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://caa.gov.kz/
- **Permission email:** Sent 2026-05-11 to `frontoffice@caa.gov.kz`.
- **Reply:** _pending_

---

### CAA Kosovo — Civil Aviation Authority of the Republic of Kosovo

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://caa.rks-gov.net/
- **Permission email:** Sent 2026-05-11 to `infocaa@caa-ks.org`.
- **Reply:** _pending_

---

### LCAA — Liberia Civil Aviation Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://lcaa.gov.lr/
- **Permission email:** Sent 2026-05-11 to `liberiacaa@lcaa.gov.lr`.
- **Reply:** _pending_

---

### ANAC Mauritanie — Agence Nationale de l'Aviation Civile de Mauritanie

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.anac.mr/
- **Permission email:** Sent 2026-05-11 to `anac@anac.mr`.
- **Reply:** _pending_

---

### PASO — Pacific Aviation Safety Office (regional)

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://paso.aero/
- **Note:** PASO is the regional safety regulator covering 12 Pacific Island member states; aircraft registers are maintained by each state's national CAA where one exists. Email asks PASO to forward to per-state CAA contacts.
- **Permission email:** Sent 2026-05-11 to `info@paso.aero`.
- **Reply:** _pending_

---

### INAC — Instituto Nacional de Aviação Civil de São Tomé e Príncipe

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.inac.st/
- **Permission email:** Sent 2026-05-11 to `inac@cstome.net`.
- **Reply:** _pending_

---

### SLCAA — Sierra Leone Civil Aviation Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://slcaa.gov.sl/
- **Permission email:** Sent 2026-05-11 to `info@slcaa.gov.sl`.
- **Reply:** _pending_

---

### SSCAA — South Sudan Civil Aviation Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://sscaa.gov.ss/
- **Permission email:** Sent 2026-05-11 to `support@sscaa.gov.ss`.
- **Reply:** _pending_

---

### State Service for Civil Aviation — Turkmenistan

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://caa.gov.tm/
- **Permission email:** Sent 2026-05-11 to `info-office@caa.gov.tm`.
- **Reply:** _pending_

---

### ZCAA — Zambia Civil Aviation Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.caa.co.zm/
- **Permission email:** Sent 2026-05-11 to `derrick.luembe@caa.co.zm`.
- **Reply:** _pending_

---

### CAAB Bangladesh — Civil Aviation Authority of Bangladesh

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://caab.portal.gov.bd/
- **Note:** `caab.gov.bd` direct hosts a self-signed cert; use `caab.portal.gov.bd` for production ingest.
- **Permission email:** Sent 2026-05-11 to `mahmud.pr@caab.gov.bd`.
- **Reply:** _pending_

---

### BCAA Bhutan — Bhutan Civil Aviation Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://bcaa.gov.bt/
- **Permission email:** Sent 2026-05-11 to `airworthiness@bcaa.gov.bt`.
- **Reply:** _pending_

---

### SSCA Cambodia — State Secretariat of Civil Aviation

- **Status:** Future — awaiting reply; **leans Excluded** if register fee confirmed
- **Classification:** Unknown
- **Source URL:** http://www.civilaviation.gov.kh/en/
- **Permission email:** Sent 2026-05-11 to `admin-info@ssca.gov.kh`.
- **Reply:** _pending_

---

### DCAL Laos — Department of Civil Aviation, Lao PDR

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.dcal.gov.la/
- **Permission email:** Sent 2026-05-11 to `info@dcal.gov.la`.
- **Reply:** _pending_

---

### CAAN Nepal — Civil Aviation Authority of Nepal

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://caanepal.gov.np/
- **Permission email:** Sent 2026-05-11 to `dgca@caanepal.gov.np`.
- **Reply:** _pending_

---

### CAAP Philippines — Civil Aviation Authority of the Philippines

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.caap.gov.ph/
- **Permission email:** Sent 2026-05-11 to `awociddiv@caap.gov.ph`.
- **Reply:** _pending_

---

### CAAV Vietnam — Civil Aviation Authority of Vietnam

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://caa.gov.vn/
- **Permission email:** Sent 2026-05-11 to `dunguv@caa.gov.vn`.
- **Reply:** _pending_

---

### CAA Bahrain — Civil Aviation Affairs

- **Status:** Future — awaiting reply; **leans Excluded** (appointment-only register viewing per Article 48 of Civil Aviation Law 14/2013)
- **Classification:** Unknown
- **Source URL:** https://www.mtt.gov.bh/civil-aviation
- **Note:** Register is "available in the Aeronautical Licensing Directorate... made available to the public to view, under prior appointment on any business days & hours" — structurally incompatible with bulk redistribution.
- **Permission email:** Sent 2026-05-11 to `aerolicensing@mtt.gov.bh`.
- **Reply:** _pending_

---

### DGCA Kuwait — Directorate General of Civil Aviation

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.dgca.gov.kw/CivilAviationSafety
- **Permission email:** Sent 2026-05-11 to `president@dgca.gov.kw`.
- **Reply:** _pending_

---

### DGAC Morocco — Direction Générale de l'Aviation Civile

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://transport.gov.ma/fr/secteurs/aviation-civile
- **Note:** Former `aviationcivile.gov.ma` subdomain decommissioned; migrated to parent ministry site per Décret 2-21-968 (2021).
- **Permission email:** Sent 2026-05-11 to `DCCsiteweb@transport.gov.ma`.
- **Reply:** _pending_

---

### QCAA — Qatar Civil Aviation Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.caa.gov.qa/en
- **Permission email:** Sent 2026-05-11 to `pr@caa.gov.qa`.
- **Reply:** _pending_

---

### DGAC Tunisia — Direction Générale de l'Aviation Civile

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.transport.tn/fr/aviation/article
- **Permission email:** Sent 2026-05-11 to `nidhal.souilmi@transport.state.tn`.
- **Reply:** _pending_

---

### GCAA — General Civil Aviation Authority of the UAE

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.gcaa.gov.ae/en/services/aircraft-registration
- **Open data portal:** https://opendata.fcsc.gov.ae/@general-authority-civil-aviation (airport traffic only; per-tail register not yet published)
- **Permission email:** Sent 2026-05-11 to `customercare@gcaa.gov.ae`.
- **Reply:** _pending_

---

### ENAC — Italian Civil Aviation Authority

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.enac.gov.it/sicurezza-aerea/aeronavigabilita-iniziale/registro-aeromobili/
- **Bulk download URL:** None published. Register governed by formal "visure" extract procedures (paid); yes-reply must clear both license and a bulk access channel.
- **Permission email:** Sent 2026-05-05 to `registro.aeromobili@enac.gov.it`.
- **Reply:** _pending_

---

### CAA Macedonia — Civil Aviation Agency of the Republic of North Macedonia

- **Status:** Future — awaiting reply
- **Classification:** Unknown
- **Source URL:** https://www.caa.gov.mk/en/safety/airworthiness-and-aircraft-registration/
- **Bulk download URL:** Direct PDF on date-stamped path (e.g. `AIRCRAFT-REGISTER-DD.MM.YYYY.pdf`).
- **Format note:** PDF — ingest blocked on PDF parser path.
- **Permission email:** Sent 2026-05-10 to `info@caa.gov.mk`.
- **Reply:** _pending_

---

## Excluded — structural

### Germany — Luftfahrt-Bundesamt (LBA)

- **Status:** ❌ Excluded
- **Classification:** Excluded — statutorily non-public register
- **Source URL:** https://www.lba.de/EN/Airworthiness/AircraftRegistration/AircraftRegistration_node.html
- **Why excluded:** Per the LBA's own site (verbatim): _"The Luftfahrzeugrolle of the Federal Republic of Germany is a non-public register that is neither published nor freely accessible for data protection reasons. The entries in the Aircraft Register are generally not open to the public to be searched; however, data recorded in the Aircraft Register may be requested if that person provides prima facie evidence that it needs such information for the enforcement of a private claim."_ The LBA is statutorily prohibited from publishing the register; per-record access only to parties demonstrating a legal claim. No permission email can unlock bulk redistribution.
- **Revisit condition:** German aviation register reclassified as public under future amendments to the Luftverkehrsgesetz or German data-protection law.

---

### Japan — JCAB (Japan Civil Aviation Bureau, MLIT)

- **Status:** ❌ Excluded
- **Classification:** Excluded — fee-gated per-aircraft access; no bulk channel; explicit bulk-refusal clause
- **Source URL:** https://www.mlit.go.jp/koku/koku_tk1_000035.html
- **Why excluded:** Three concurrent blockers per MLIT's published procedures (verbatim Japanese + English):

  > 航空機登録原簿謄本交付・閲覧ともに１通につき９７０円の手数料がかかります。
  > (Both certificate issuance and consultation of the aircraft registration ledger require a ¥970 fee per record.)
  >
  > 大量の閲覧請求はお受けできない場合がありますので、事前にお問合せください。
  > (Large-volume viewing requests may not be accepted; please inquire in advance.)
  >
  > コピーを取ることはできませんが、その場で写真撮影をすることはできます。
  > (You cannot take copies, but you may photograph on the spot.)

  ¥970/record (~$6 USD) × ~3,000 JA-prefixed aircraft ≈ $19,000 USD. Bulk requests explicitly may be refused. No-copy restriction (photography only on-site). A permission email cannot override a statutory framework that structurally forbids bulk redistribution.

- **Revisit condition:** MLIT publishes the per-tail register on data.go.jp or e-Gov data portal under an explicit open license (CC BY, CC0, or JGL — Japan Government License), or Japan amends Civil Aeronautics Act Article 8-2 to provide a bulk-redistribution channel.

---

### Israel — CAAI (Civil Aviation Authority of Israel)

- **Status:** ❌ Excluded
- **Classification:** Excluded — fee-gated per-aircraft access; no bulk-redistribution channel
- **Source URL:** https://www.gov.il/en/service/browse-aircraft-register
- **Why excluded:** Per the CAAI register browser at gov.il (verbatim):

  > "Each request is for one aircraft and requires a separate fee."
  >
  > "For requests that are not for a specific aircraft, you must contact the Freedom of Information Commissioner at the Ministry of Transportation to act in accordance with the Freedom of Information Law, 5758-1998."
  >
  > "\[E\]veryone is permitted, with the consent of the registrar, to review the aircraft registration register in Israel."

  Per-aircraft fee + registrar consent for individual lookups. Bulk access only via FOI request, which grants one-off copies under conditions — not redistribution rights. No public bulk publication on data.gov.il.

- **Revisit condition:** Israel publishes the register on data.gov.il under an explicit open license (CC BY, CC0, or equivalent).

---

### Romania — AACR (Romanian Civil Aeronautical Authority)

- **Status:** ❌ Excluded
- **Classification:** Restrictive — fee-gated per-record access, no bulk channel
- **Source URL:** https://www.caa.ro/en/pages/inmatricularea-aeronavelor
- **Why excluded:** Per AACR's published procedures (verbatim): _"Based on the provisions of art. 6.7 of the RACR IA as well as the provisions of other specific normative acts, the interested persons may request the AACR to be provided with information regarding the civil aircraft registered in the RUIAC. When submitting the application, the applicant will pay the **tariff charged by AACR in such situations (45 euro / aircraft + VAT)**."_ ~€55.80 per record with VAT. No discounted bulk channel exists.
- **Revisit condition:** AACR changes the access model — register added to data.gov.ro under an open license, or a free bulk-export channel becomes available.

---

### UK CAA

- **Status:** ❌ Excluded
- **Classification:** Restrictive
- **Source URL:** https://www.caa.co.uk/aircraft-register/g-info/
- **License:** Proprietary CAA copyright + database right. Bulk product (G-INFO, MS Excel): £450 single issue / £1,745/yr monthly under a single-PC license that explicitly forbids copying, distribution, sale, or hire without written CAA consent.
- **Why excluded:** Single-PC clause is incompatible with R2 storage even for operator-private use. No-redistribution clause is incompatible with source-available code that another fork might run.
- **Revisit condition:** CAA re-releases G-INFO under OGL-UK or any redistributable license.

---

### Rosaviatsia — Federal Air Transport Agency of Russia

- **Status:** ❌ Excluded
- **Classification:** Excluded (sanctions exposure)
- **Why excluded:** As a US-person operator, engaging with Russian state agencies — even for non-commercial permission requests — carries OFAC compliance risk under post-2014 and post-2022 sanctions. OFAC violations are civil-strict-liability. Cost-benefit for a hobby project does not justify the legal-review effort.
- **Revisit condition:** US/Russia sanctions situation eases materially. Re-evaluate annually.

---

### CAAC — Civil Aviation Administration of China

- **Status:** ❌ Excluded
- **Classification:** Excluded (technical access blocked + geopolitical exposure)
- **Source URL:** http://219.143.231.89/shs/ccarretrieval.do?flag=1
- **Why excluded:** The CAAC register page is built for Microsoft Internet Explorer, retired June 2022. Modern browsers cannot render the page or its underlying components. Verification is blocked at step zero. Layered geopolitical exposure compounds the technical blocker.
- **Revisit condition:** CAAC moves the register to a non-IE platform and a clearly-licensed community mirror appears, or US-China data policy changes materially. Re-evaluate annually.

---

### Egypt — ECAA (Egyptian Civil Aviation Authority)

- **Status:** ❌ Excluded
- **Classification:** Excluded (redistribution gating under national civil-aviation statutory framework)
- **Source URL:** https://www.civilaviation.gov.eg/
- **Why excluded:** Law 93/2003 (Egyptian Civil Aviation Law) framework gates redistribution. Same structural exclusion as Germany LBA, Israel CAAI, Japan JCAB — agency cannot grant what its statute does not permit. **A verbatim statutory citation must be captured before any reclassification.**
- **Note:** Acronym collision: Egyptian ECAA and Ethiopian ECAA are separate entities (Ethiopia is in-flight and has been emailed; do not conflate).
- **Revisit condition:** Egypt amends Law 93/2003 to provide an open-data or bulk-redistribution channel, or ECAA publishes the register under an explicit open license. Re-evaluate annually.

---

### GCAA Ghana — Ghana Civil Aviation Authority

- **Status:** ❌ Excluded
- **Classification:** Excluded — password-walled electronic access; no public register surface
- **Source URL:** https://www.gcaa.com.gh/web/
- **Why excluded:** Register is electronic but password-only access per GCAA Flight Standards Part 4. Same pattern as Germany LBA — structurally non-public. A permission email is not meaningful for a password-walled system.
- **Note:** Acronym collision with Georgia GCAA — Georgia GCAA is in-flight as `ge-gcaa`. Do not conflate.
- **Revisit condition:** GCAA Ghana publishes the register under an explicit open license, or restructures access to provide a bulk channel.

---

### KCAA — Kenya Civil Aviation Authority

- **Status:** ❌ Excluded
- **Classification:** Excluded — per-aircraft register extract on formal request + fee; no bulk channel
- **Source URL:** https://kcaa.or.ke/
- **Why excluded:** Same exclusion pattern as Israel CAAI + Romania AACR + Japan JCAB + UK G-INFO — fee-gated per-record access with no bulk-redistribution channel.
- **Revisit condition:** KCAA establishes a bulk-redistribution channel or publishes the register under an open license on a Kenyan open-data portal.

---

### RCAA — Rwanda Civil Aviation Authority

- **Status:** ❌ Excluded
- **Classification:** Excluded — register "maintained on premises" per RCAR Part 2; no public bulk channel
- **Source URL:** https://www.caa.gov.rw/
- **Why excluded:** On-premises consultation framework structurally incompatible with redistribution. Same pattern as Japan JCAB and Bahrain BCAA (appointment-only).
- **Revisit condition:** RCAA publishes the register under an explicit open license or establishes a bulk-redistribution channel.

---

## Commercial offshore registries — Excluded (group)

These are commercial registration services for foreign aircraft owners, making money from registration fees ($1,000s–$10,000s per aircraft) for privacy/tax/operational structures. Registers are typically PDF or paid-search products with terms forbidding bulk redistribution.

| Country / Territory | Agency                             | Register URL                                                                               | Aircraft prefix |
| ------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------ | --------------- |
| Cayman Islands      | CAA Cayman Islands                 | https://www.caacayman.com                                                                  | VP-C            |
| Isle of Man         | IOM Aircraft Registry              | https://ardis.iomaircraftregistry.com/register/search                                      | M-              |
| Guernsey            | 2-REG (Guernsey Aircraft Registry) | https://www.2-reg.com/legislation/register                                                 | 2-              |
| Jersey              | Jersey Aircraft Registry           | https://www.gov.je/travel/maritimeaviation/civilaviation/pages/jerseyaircraftregistry.aspx | ZJ-             |
| Turks & Caicos      | TCI Civil Aviation Authority       | https://tcicaa.tc                                                                          | VQ-T            |

**Status:** ❌ Excluded as a class.
**Classification:** Excluded (commercial/paid-SaaS registry pattern).
**Why excluded:** Permission requests are wasted effort — expected response is "no" or "yes for a significant fee." Even if granted, redistribution under operator-private R2 doesn't fit their commercial model.
**Revisit condition:** A specific registry restructures into an open-data publisher, or a free community mirror appears with verifiable license. Re-evaluate any individual entry at most annually.

**Also excluded under this pattern (not individually tracked):** Bermuda (VP-B), Aruba (P4-, DCA Aruba), San Marino (T7-). Same exclusion reasoning applies.

---

## Sanctions / conflict-affected — Excluded (group)

OFAC violations are civil-strict-liability for US-person operators. Active-conflict entries are excluded because aviation infrastructure is not functioning enough to produce a maintainable register feed.

| Country     | Agency                          | Prefix | Rationale                                                 | Revisit condition                               |
| ----------- | ------------------------------- | ------ | --------------------------------------------------------- | ----------------------------------------------- |
| Afghanistan | ACAA                            | YA-    | Taliban-era authority; OFAC restrictions                  | Sanctions framework changes                     |
| Belarus     | Aviation Dept of Min. Transport | EW-    | OFAC/EU sanctions exposure                                | US/Belarus sanctions ease                       |
| Cuba        | IACC                            | CU-    | OFAC blanket sanctions; do not contact                    | US/Cuba sanctions ease                          |
| Iran        | CAO.IR                          | EP-    | OFAC blanket sanctions; geo-block on cao.ir               | US/Iran sanctions ease                          |
| Iraq        | ICAA                            | YI-    | Conflict-recovery posture                                 | Stable governance + bulk channel surfaced       |
| Libya       | LCAA                            | 5A-    | Sectoral sanctions + fragmented governance                | Unified governance + sanctions ease             |
| Myanmar     | DCA Myanmar                     | XY-    | Post-coup OFAC exposure; junta posture; active conflict   | Political transition + sanctions ease           |
| Niger       | ANAC Niger                      | 5U-    | 2023 coup; sanctions-watch posture                        | Government stabilization + sanctions clarity    |
| North Korea | GACA DPRK                       | P-     | OFAC blanket; do not contact                              | US/DPRK sanctions ease (effectively never)      |
| Sudan       | CAA Sudan                       | ST-    | Active civil war; aviation infrastructure non-functioning | Conflict ends + aviation infrastructure returns |
| Syria       | SyCAA                           | YK-    | OFAC blanket sanctions                                    | US/Syria sanctions ease                         |
| Venezuela   | INAC                            | YV-    | OFAC sectoral sanctions                                   | Sectoral aviation carve-out review              |
| Yemen       | CAMA                            | 7O-    | Active conflict; aviation infrastructure non-functioning  | Conflict ends + aviation infrastructure returns |

---

## No-agency / no-own-register — Excluded (group)

Microstates and small jurisdictions without a dedicated civil aviation register authority or separately maintained aircraft register.

| Country          | Prefix | Reason                                                                                                               |
| ---------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| Andorra          | n/a    | No civil aviation register; aviation activity falls under FR/ES airspace.                                            |
| Eritrea          | n/a    | No public web presence found for Eritrea Civil Aviation Authority. Revisit if web presence restored.                 |
| Liechtenstein    | HB-    | No own register; civil aviation operates under Switzerland HB- prefix via FOCA/BAZL.                                 |
| Micronesia (FSM) | V6-    | No dedicated CAA web presence verified; likely under PASO arrangement.                                               |
| Monaco           | 3A-    | No own register; aviation under DGAC France 3A-.                                                                     |
| Nauru            | C2-    | No dedicated CAA; aircraft activity covered under PASO.                                                              |
| Niue             | E6-    | New Zealand-associated state; no separate register found.                                                            |
| Palau            | T8A-   | No separate public register found. PASO arrangement.                                                                 |
| Samoa            | 5W-    | Ministry of Works, Transport and Infrastructure handles aviation; no separate register page found. PASO arrangement. |
| Timor-Leste      | n/a    | ANATL is air-navigation-service only; no separate civil aircraft register authority confirmed.                       |
| Tonga            | A3-    | No dedicated CAA web presence; PASO arrangement.                                                                     |
| Tuvalu           | T2-    | No dedicated CAA; PASO arrangement.                                                                                  |
| Vatican          | HV-    | HV- prefix historic; no civil aviation activity.                                                                     |

For PASO-arrangement entries, the PASO permission request (sent 2026-05-11) explicitly asks for forwarding to any per-state CAA that does maintain a separate register.

---
