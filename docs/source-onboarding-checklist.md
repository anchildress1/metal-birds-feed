# Source Onboarding Checklist

Working list for triaging the rest of the world's national aircraft registers, derived from the [avcodes.co.uk Official Civil Aircraft Registers list](https://www.avcodes.co.uk/reglinks.asp?type=Official) (86 entries).

**Workflow per agency:**

1. **Verify** — open the agency's register URL, find their copyright / terms / data-license page (usually footer link), and classify:
   - **Open** (CC BY, CC-0, OGL, public domain, "any purpose") → no email; just attribute.
   - **Personal-use** (CC BY-NC, "for personal use only," "non-commercial only") → send permission email.
   - **Unknown** (no statement, no terms link) → send permission email.
   - **Restrictive** (paid, single-PC, no-redistribute) → exclude. Don't email.
2. **Email** (if needed) — fill in the template at [`docs/agency-permission-request.md`](agency-permission-request.md) and send. Record send date in `DATA_LICENSES.md`.
3. **Update** — add a new section to `DATA_LICENSES.md`, add the row to the README Sources table, add the row to `docs/license-matrix.md`.

---

## Status snapshot

### ✅ Done — no further action

| Source            | License                                           | How handled    |
| ----------------- | ------------------------------------------------- | -------------- |
| FAA               | US public domain                                  | Live (phase 1) |
| Transport Canada  | GC Open Data Licence Agreement (verbatim notices) | Live (phase 2) |
| ILT (Netherlands) | CC-0                                              | Live (phase 3) |
| CASA (Australia)  | CC BY 4.0                                         | Live (phase 4) |

### 🛠️ Cleared — implementation pending

License is cleared via public license declaration (no email reply needed). Ingest is blocked on engineering work — usually a new parser path or a non-standard fetch pattern.

| Source     | License (cleared via)                                                                                       | Ingest blocker                                                                                                                                | Email status                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| AESA Spain        | Open with attribution — AESA portal Legal Notice + Royal Decree 1495/2011 (Spain PSI / Aporta); CC BY-equiv. | Bulk file is **PDF** ([aeronaves_inscritas.pdf](https://www.seguridadaerea.gob.es/sites/default/files/aeronaves_inscritas.pdf)); engine handles csv/ods/xlsx — new PDF parser path needed | Sent 2026-05-05 to `rmac.aesa@seguridadaerea.es` as courtesy; reply not gating use          |
| Traficom Finland  | Open — CC BY 4.0 explicit on Traficom open-data page                                                          | Bulk file is **ZIP-packed CSV** ([direct download](https://eservices.traficom.fi/LicensesServices/Forms/AircraftRegister.aspx?download=zip)); engine handles csv natively — thin unzip-then-parse wrapper needed (reusable for FI vehicles/vessels/rail)  | Sent 2026-05-05 to `kirjaamo@traficom.fi` (cc `tietojenluovutus@traficom.fi`) as courtesy; reply not gating use |
| CAA Latvia        | Open — CC0-1.0 (public domain) explicit on data.gov.lv                                                        | Direct CSV ([download](https://data.gov.lv/dati/dataset/3f67abc8-f8b7-4833-a2e2-9a304df06afd/resource/dbde00e6-8616-449a-8cac-ef748c6793f3/download/output.csv)); engine handles csv natively — **zero parser work**, only YAML config + fixtures needed | None needed — license fully clear via portal; same posture as ILT NL |

### 🟡 In flight — waiting on reply

| Source                    | Sent                                 | Follow-up  | Sent to                                                                                      | Fallback applies?                                         |
| ------------------------- | ------------------------------------ | ---------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| ANAC Argentina            | 2026-05-05                           | 2026-06-04 | registro@anac.gob.ar                                                                         | **Yes** (Unknown; public-record fallback after follow-up) |
| CAC Armenia               | 2026-05-09                           | 2026-06-08 | info@aviation.am (cc info@gdca.am; neither verified — retry if bounces)                      | **Yes** (Unknown; public-record fallback after follow-up) |
| Austro Control Austria    | 2026-05-05                           | 2026-06-04 | register@austrocontrol.at                                                                    | **Yes** (Unknown; public-record fallback after follow-up) |
| BCAA Bahamas              | 2026-05-05                           | 2026-06-04 | atl@caabahamas.com                                                                           | **Yes** (Unknown; public-record fallback after follow-up) |
| BCAA / DGTA Belgium       | 2026-05-05                           | 2026-06-04 | bcaa.registration@mobilit.fgov.be                                                            | **Yes** (Unknown; public-record fallback after follow-up) |
| BDCA Belize               | 2026-05-05                           | 2026-06-04 | director@civilaviation.gov.bz                                                                | **Yes** (Unknown; public-record fallback after follow-up) |
| BHDCA Bosnia & Herzegovina | 2026-05-09                          | 2026-06-08 | bhdca@bhdca.gov.ba (general Directorate inbox)                                               | **Yes** (Unknown; public-record fallback after follow-up) |
| CAAB Botswana             | 2026-05-05                           | 2026-06-04 | caab@caab.co.bw                                                                              | **Yes** (Unknown; public-record fallback after follow-up) |
| ANAC Brasil               | 2026-05-05                           | 2026-06-04 | rab@anac.gov.br                                                                              | **Yes** (Unknown; public-record fallback after follow-up) |
| CAA Bulgaria              | 2026-05-09                           | 2026-06-08 | AIRWORTHINESS@caa.bg (cc caa@caa.bg; Airworthiness Department)                               | **Yes** (Unknown; public-record fallback after follow-up) |
| DGAC Chile                | 2026-05-09 (English v2; v1 Spanish to delete) | 2026-06-08 | registro.aeronaves@dgac.gob.cl                                                      | **Yes** (Unknown; public-record fallback after follow-up) |
| UAEAC Colombia            | 2026-05-09                           | 2026-06-08 | atencionalciudadano@aerocivil.gov.co (Citizen Attention)                                     | **Yes** (Unknown; public-record fallback after follow-up) |
| CCAA Croatia              | 2026-05-09                           | 2026-06-08 | registar@ccaa.hr (registry-specific desk)                                                    | **Yes** (Unknown; public-record fallback after follow-up) |
| DCA Cyprus                | 2026-05-05                           | 2026-06-04 | director@dca.mcw.gov.cy                                                                      | **Yes** (Unknown; public-record fallback after follow-up) |
| CAA CR Czech Republic     | 2026-05-09                           | 2026-06-08 | dousova@caa.cz (cc podatelna@caa.gov.cz; Jana Doušová, register dept head)                   | **Yes** (Unknown; public-record fallback after follow-up) |
| Trafikstyrelsen Denmark   | 2026-05-05                           | 2026-06-04 | info@trafikstyrelsen.dk                                                                      | **Yes** (Unknown; public-record fallback after follow-up) |
| Transpordiamet Estonia    | 2026-05-09                           | 2026-06-08 | info@transpordiamet.ee                                                                       | **Yes** (Unknown; public-record fallback after follow-up) |
| ECAA Ethiopia             | 2026-05-05                           | 2026-06-04 | caa.airnav@ethionet.et                                                                       | **Yes** (Unknown; public-record fallback after follow-up) |
| CAAF Fiji                 | 2026-05-05                           | 2026-06-04 | info@caaf.org.fj                                                                             | **Yes** (Unknown; public-record fallback after follow-up) |
| DGAC France               | 2026-05-05                           | 2026-06-04 | immat@aviation-civile.gouv.fr                                                                | **No** (Personal-use; silence ≠ permission)               |
| GCAA Georgia              | 2026-05-05                           | 2026-06-04 | office@gcaa.ge (English per English-first strategy)                                          | **Yes** (Unknown; public-record fallback after follow-up) |
| KKM Hungary               | 2026-05-09                           | 2026-06-08 | lfhf@ekm.gov.hu (cc caa@ekm.gov.hu; Légügyi Felügyeleti Hatósági Főosztály)                  | **Yes** (Unknown; public-record fallback after follow-up) |
| ICETRA Iceland            | 2026-05-05                           | 2026-06-04 | samgongustofa@samgongustofa.is                                                               | **Yes** (Unknown; public-record fallback after follow-up) |
| DGCA India                | 2026-05-05                           | 2026-06-04 | rkanand.dgca@nic.in, mdevula.dgca@nic.in (DDGs Airworthiness)                                | **Yes** (Unknown; public-record fallback after follow-up) |
| DKPPU Indonesia           | 2026-05-05                           | 2026-06-04 | produkaeronautika_dkuppu@dephub.go.id (cc info151@dephub.go.id)                              | **Yes** (Unknown; public-record fallback after follow-up) |
| IAA Ireland               | 2026-05-05                           | 2026-06-04 | registration@iaa.ie                                                                          | **Yes** (Unknown; public-record fallback after follow-up) |
| ENAC Italy                | 2026-05-05                           | 2026-06-04 | registro.aeromobili@enac.gov.it                                                              | **Yes** (Unknown; public-record fallback after follow-up) |
| JCAA Jamaica              | 2026-05-05                           | 2026-06-04 | info@jcaa.gov.jm                                                                             | **Yes** (Unknown; public-record fallback after follow-up) |
| CARC Jordan               | 2026-05-05                           | 2026-06-04 | info@carc.gov.jo (cc Bilal.Nazzal@CARC.GOV.JO)                                               | **Yes** (Unknown; public-record fallback after follow-up) |
| KOCA Korea                | 2026-05-05                           | 2026-06-04 | lia0404@korea.kr                                                                             | **Yes** (Unknown; public-record fallback after follow-up) |
| CAA Kyrgyzstan            | 2026-05-09                           | 2026-06-08 | mail@caa.kg (general Agency inbox)                                                           | **Yes** (Unknown; public-record fallback after follow-up) |
| TKA Lithuania             | 2026-05-09 (v2 to `info@tka.lt`)     | 2026-06-08 | info@tka.lt (cc audrius.turauskas@tka.lt; v1 to ~~joris.dumcius@tka.lt~~ bounced)            | **Yes** (Unknown; public-record fallback after follow-up) |
| DAC Luxembourg            | 2026-05-09                           | 2026-06-08 | nav@av.etat.lu (Département Navigabilité)                                                    | **No** (Personal-use; silence ≠ permission)               |
| CAA Macedonia (North)     | 2026-05-09                           | 2026-06-08 | caa@gov.mk (general Agency inbox)                                                            | **Yes** (Unknown; public-record fallback after follow-up) |
| CAAM Malaysia             | 2026-05-05                           | 2026-06-04 | webform at caam.gov.my/contact-us                                                            | **Yes** (Unknown; public-record fallback after follow-up) |
| CAA Maldives              | 2026-05-05                           | 2026-06-04 | airworthiness@caa.gov.mv                                                                     | **Yes** (Unknown; public-record fallback after follow-up) |
| CAD Malta                 | 2026-05-05                           | 2026-06-04 | civil.aviation@transport.gov.mt                                                              | **Yes** (Unknown; public-record fallback after follow-up) |
| AFAC Mexico               | 2026-05-05                           | 2026-06-04 | tramites@afac.gob.mx                                                                         | **Yes** (Unknown; public-record fallback after follow-up) |
| CAA Moldova               | 2026-05-09                           | 2026-06-08 | info@caa.gov.md (note: domain differs from `caa.md` website — verify if bounces)             | **Yes** (Unknown; public-record fallback after follow-up) |
| ACG Montenegro            | 2026-05-09                           | 2026-06-08 | acv@caa.me (general Agency inbox)                                                            | **Yes** (Unknown; public-record fallback after follow-up) |
| CAA NZ                    | 2026-05-05                           | 2026-06-04 | info@caa.govt.nz                                                                             | **No** (Personal-use; silence ≠ permission)               |
| Luftfartstilsynet Norway  | 2026-05-05                           | 2026-06-04 | postmottak@caa.no (sent); `nlr@caa.no` register-specific — use for follow-up                 | **Yes** (Unknown; public-record fallback after follow-up) |
| PCAA Pakistan             | 2026-05-05                           | 2026-06-04 | umair.sufyan@caapakistan.com.pk (named individual)                                           | **Yes** (Unknown; public-record fallback after follow-up) |
| CASA PNG                  | 2026-05-05                           | 2026-06-04 | info@casapng.gov.pg                                                                          | **Yes** (Unknown; public-record fallback after follow-up) |
| CAD Serbia                | 2026-05-09                           | 2026-06-08 | dgca@cad.gov.rs (general Directorate inbox)                                                  | **Yes** (Unknown; public-record fallback after follow-up) |
| SCAA Seychelles           | 2026-05-05                           | 2026-06-04 | secretariat@scaa.sc                                                                          | **Yes** (Unknown; public-record fallback after follow-up) |
| CAAS Singapore            | 2026-05-05                           | 2026-05-26 | webform (3–15 business-day SLA)                                                              | **No** (Personal-use; silence ≠ permission)               |
| Dopravný úrad Slovakia    | 2026-05-09                           | 2026-06-08 | register.lietadiel@nsat.sk (register-specific desk; license confirmation only)               | **Yes** (Unknown; public-record fallback after follow-up) |
| CAASL Sri Lanka           | 2026-05-05                           | 2026-06-04 | daw@caa.lk (cc scaiaras@caa.lk; Mr. Ratnayake, Director Aircraft Registration)               | **Yes** (Unknown; public-record fallback after follow-up) |
| CASAS Suriname            | 2026-05-05                           | 2026-06-04 | casasinfo@casas.sr (Cloudflare-decoded; verify if bounces)                                   | **Yes** (Unknown; public-record fallback after follow-up) |
| Transportstyrelsen Sweden | 2026-05-05                           | 2026-06-04 | luftfart@transportstyrelsen.se (sent); `lfr@transportstyrelsen.se` register-specific — use for follow-up | **Yes** (Unknown; public-record fallback after follow-up) |
| FOCA Switzerland          | 2026-05-05                           | 2026-06-04 | aircraftregistry@bazl.admin.ch                                                               | **No** (Personal-use; silence ≠ permission)               |
| CAA Taiwan                | 2026-05-05                           | 2026-06-04 | gencaa@mail.caa.gov.tw                                                                       | **Yes** (Unknown; public-record fallback after follow-up) |
| TCAA Tanzania             | 2026-05-05 (v2 to `tcaa@tcaa.go.tz`) | 2026-06-04 | tcaa@tcaa.go.tz (v1 to ~~airworthinessinspectors@tcaa.go.tz~~ / ~~info@tcaa.go.tz~~ bounced) | **Yes** (Unknown; public-record fallback after follow-up) |
| TTCAA Trinidad & Tobago   | 2026-05-05                           | 2026-06-04 | ttcaa@caa.gov.tt                                                                             | **Yes** (Unknown; public-record fallback after follow-up) |
| SAAU Ukraine              | 2026-05-09                           | 2026-06-08 | vdz@avia.gov.ua (Documentation and Control Dept; license confirmation only; wartime ack)     | **Yes** (Unknown; public-record fallback after follow-up) |

### ❌ Excluded — do not pursue

| Source                              | Reason                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UK CAA (G-INFO)                     | Paid + single-PC + no-redistribute. Verified verbatim. Revisit only if terms change.                                                                                                                                                                                                                                                                                                                                                        |
| Russia (Rosaviatsia)                | US sanctions exposure for a US-person operator. Engaging Russian state agencies — even for permission — carries OFAC compliance risk. Revisit only if sanctions situation eases.                                                                                                                                                                                                                                                            |
| China (CAAC)                        | Register page is IE-only (Microsoft Internet Explorer, deprecated June 2022) — cannot verify or scrape with any modern browser. Plus geopolitical exposure as a US-based project. Revisit when either changes.                                                                                                                                                                                                                              |
| Cayman Islands (CAA Cayman)         | Commercial offshore registry — paid SaaS-style registration product for foreign aircraft owners. Bulk data redistribution not part of their business model.                                                                                                                                                                                                                                                                                 |
| Isle of Man (IOM Aircraft Registry) | Commercial offshore registry — M-prefix on every Gulfstream that ever lived. Paid registration product.                                                                                                                                                                                                                                                                                                                                     |
| Guernsey (2-REG)                    | Commercial offshore registry, explicitly branded "2-REG." Subscription product.                                                                                                                                                                                                                                                                                                                                                             |
| Jersey (Jersey Aircraft Registry)   | Crown dependency offshore registry — same commercial template as Guernsey at lower volume.                                                                                                                                                                                                                                                                                                                                                  |
| Turks & Caicos (TCI CAA)            | Caribbean offshore registry, same commercial pattern.                                                                                                                                                                                                                                                                                                                                                                                       |
| Germany (LBA)                       | Luftfahrzeugrolle is **statutorily non-public** under German data protection law. LBA states the register "is neither published nor freely accessible." Data only released per-record on proof of legal claim. No permission email is meaningful — they cannot grant what the law forbids them from publishing. Revisit only if German privacy law reclassifies.                                                                            |
| Israel (CAAI)                       | Per-aircraft fee + registrar consent for individual lookups. Bulk access requires Freedom of Information request to the Ministry of Transportation's FOI Commissioner under Law 5758-1998 — FOI grants one-off copies under conditions, not ongoing redistribution rights. No bulk-redistribution channel exists. Same structural exclusion as Germany. Revisit only if Israel publishes the register under an open license on data.gov.il. |
| Romania (AACR)                      | Verified 2026-05-09 — €45/aircraft + VAT for register information per RACR IA art. 6.7 (~€11k+ for ~200 aircraft). No bulk channel. Register page also CAPTCHA-walled. Same exclusion criteria as UK G-INFO + Israel CAAI. Revisit only if AACR publishes RUIAC on data.gov.ro under an open license.                                                                                                                                       |

Also fits this pattern but not currently tracked (not on avcodes list, would need separate research): **Bermuda (VP-B, BCAA)**, **Aruba (P4-, DCA Aruba)**, **San Marino (T7-, CAA San Marino)**. Don't pursue.

### 🌐 Non-English registries (English-first strategy)

Per the strategy decided 2026-05-05: send the permission template in **English** to all of these regardless of primary working language. Most national CAAs are ICAO members with English-fluent correspondence staff. Translator pipeline only needed for replies in the local language or follow-up rounds if English is ignored. See "Phase 2 — non-English registries" section below for the full list grouped by language family.

---

## Phase 1 — English-language quick wins (license-clean candidates)

These countries have English as an official or working administrative language and likely have OGL-style or CC BY-style defaults given their Crown / Anglosphere lineage. **Verify the license first; many will require no email.**

For each: open the agency homepage in the browser, find the footer "Copyright" or "Terms" link, classify, and decide.

_All Phase 1 quick-win candidates emailed 2026-05-05; see In flight section above._

### Phase 1 — known-difficult English-language

_Pakistan, Maldives, and Ethiopia all emailed 2026-05-05; see In flight section above._

### Phase 1 — borderline (English commonly used, but local language is primary)

_Jordan (CARC) emailed 2026-05-05; see In flight section above._

---

## Phase 2 — non-English registries (English-first strategy)

> Strategy decided 2026-05-05: send the permission template in **English** to every agency on this list, regardless of the country's primary working language. Most national CAAs are ICAO members and have English-fluent staff in correspondence roles. Translator pipeline is only needed for (a) replies that come back in the local language, or (b) follow-up rounds if English correspondence is ignored. Don't pre-block these on translator availability — send English first, see who responds.

The lists below are grouped by language family for organizational clarity (so a translator pipeline can pick a batch when one is needed for replies / follow-ups). Each agency gets the same English template as Phase 1.

### Romance (French / Spanish / Portuguese / Italian / Romanian)

> Note: Argentina, Brazil, Spain, Italy, and France were emailed in English on 2026-05-05 and now sit in the **In flight** section above. Remaining entries below are next up — send English first per the Phase 2 strategy.

| Country            | Agency    | Register URL                                                                                                                                         | Language                |
| ------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Dominican Republic | IDAC      | [idac.gob.do](https://serviciosvirtualestac.idac.gob.do/ConsultaAeronaves/)                                                                          | Spanish                 |
| Guatemala          | DGAC      | [dgac.gob.gt](http://cass.dgac.gob.gt:8080/cass/servlet/consultaaeronaves)                                                                           | Spanish                 |
| Uruguay            | DINACIA   | [dinacia.gub.uy](https://www.dinacia.gub.uy)                                                                                                         | Spanish                 |
| Haiti              | OFNAC     | [registreimm.net](https://registreimm.net/aircraftSearchingView)                                                                                     | French / Haitian Creole |
| Togo               | ANAC Togo | [anac-togo.tg](https://www.anac-togo.tg/espace-professionnel/aeronefs/consultation-du-registre-dimmatriculation/)                                    | French                  |
| Cabo Verde         | AAC       | [aac.cv](http://www.aac.cv/index.php?option=com_content&task=view&id=25&Itemid=63)                                                                   | Portuguese              |
| Mozambique         | IACM      | [iacm.gov.mz](https://www.iacm.gov.mz/direccao-de-seguranca-de-voo/)                                                                                 | Portuguese              |

### Germanic / Nordic (German / Dutch / Danish / Swedish / Norwegian / Finnish)

> Note: Switzerland, Sweden, Norway, Austria, Belgium, Denmark, Finland, and Suriname were all emailed in English on 2026-05-05 and now sit in the **In flight** section above. No agencies remain deferred in this group.

### Slavic / Eastern European

> Note: Russia (Rosaviatsia) was moved to the **Excluded** section above (sanctions exposure).

| Country              | Agency         | Register URL                                                                                                        | Language                 |
| -------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Estonia              | Transpordiamet | [transpordiamet.ee](https://transpordiamet.ee/ohusoidukite-register) **(emailed 2026-05-09 — see In flight section above)** | Estonian                 |

### CJK / East Asian

> Note: China (CAAC) was moved to the **Excluded** section above (IE-only register page + geopolitical exposure). Taiwan, Korea, and Indonesia were emailed in English on 2026-05-05 and now sit in the **In flight** section above. Japan was deferred (no clean register-specific email surfaced; MLIT website cert issues prevented direct browsing).

| Country  | Agency | Register URL                                                           | Language             |
| -------- | ------ | ---------------------------------------------------------------------- | -------------------- |
| Macau    | AACM   | [aacm.gov.mo](https://www.aacm.gov.mo/overview_aircraft.php?pageid=84) | Chinese / Portuguese |
| Mongolia | MCAA   | [mcaa.gov.mn](https://www.mcaa.gov.mn/?p=1758)                         | Mongolian            |
| Thailand | CAAT   | [caat.or.th](https://www.caat.or.th/en/archives/52215)                 | Thai (English UI)    |

### Caucasus / Central Asia

> Note: Georgia (GCAA) was emailed in English on 2026-05-05 per the English-first strategy (R3.1 research already done — register is an HTML scrape at gcaa.ge/civil-aircraft-register/, ~63 aircraft). Now sits in **In flight** above. Armenia and Kyrgyzstan remain deferred.

| Country    | Agency | Register URL                                               | Language         |
| ---------- | ------ | ---------------------------------------------------------- | ---------------- |

### Middle East

| Country | Agency       | Register URL                                   | Language        |
| ------- | ------------ | ---------------------------------------------- | --------------- |
| Lebanon | DGCA Lebanon | [lebcaa.com](https://www.lebcaa.com/a_r.shtml) | Arabic / French |

---

## Recommended order of attack

1. **Phase 1 quick wins:** Iceland, Trinidad & Tobago, Cyprus — most likely Open or simple-email cases. Knock these out one afternoon. (Israel and Singapore were previously listed here; both moved out — Israel to **Excluded** after CAAI register confirmed fee-gated + FOI-only, Singapore to "known-difficult" after CAAS Terms of Use confirmed Personal-use.)
2. **Phase 1 known-difficult:** India, Pakistan, Sri Lanka, Maldives, Ethiopia, Malaysia — verify, send emails, expect mixed responses.
3. **Phase 2 (non-English registries):** send English to all of them per the agreed strategy. Tier by fleet size or bandwidth — eight largest were sent 2026-05-05 (Brazil, France, Italy, Spain, Argentina, Switzerland, Sweden, Norway). Next likely batch: Germany (LBA), Japan (JCAB), Mexico (AFAC), Indonesia (DKPPU), Korea (KOCA), Taiwan (CAA Taiwan), Belgium (DGTA), Austria (Austro Control), Denmark (TS), Finland (Traficom).
4. **Translator follow-up only** when an agency replies in their local language with substantive license terms, or when no English reply arrives and a follow-up in the local language is warranted.

## Notes for whoever runs this

- The "Likely Open / Likely needs email" hints in Phase 1 are heuristics, not facts. Always verify before assuming.
- Save evidence: when verifying a license, screenshot or copy the relevant page text into the agency's `DATA_LICENSES.md` entry. Site terms move; receipts are durable.
- Re-verify each existing source annually. Government policies change quietly.
- Any reply to a permission email goes verbatim into `DATA_LICENSES.md` — never paraphrase agency replies, since attribution conditions may need to be quoted exactly.
