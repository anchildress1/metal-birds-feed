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
| AAC Albania               | 2026-05-10 (v2 to `info@acaa.gov.al`) | 2026-06-09 | info@acaa.gov.al (verified via ATC Network mailto + M365 mail infra; note ACAA domain ≠ AAC web domain; ZA- prefix; v1 to `info@aac.gov.al` superseded before send) | **Yes** (Unknown; public-record fallback after follow-up) |
| ANAC Argentina            | 2026-05-05                           | 2026-06-04 | registro@anac.gob.ar                                                                         | **Yes** (Unknown; public-record fallback after follow-up) |
| CAC Armenia               | 2026-05-10                           | 2026-06-09 | info@aviation.am (cc info@gdca.am; neither verified — retry if bounces)                      | **Yes** (Unknown; public-record fallback after follow-up) |
| Austro Control Austria    | 2026-05-05                           | 2026-06-04 | register@austrocontrol.at                                                                    | **Yes** (Unknown; public-record fallback after follow-up) |
| BCAA Bahamas              | 2026-05-05                           | 2026-06-04 | atl@caabahamas.com                                                                           | **Yes** (Unknown; public-record fallback after follow-up) |
| BCAA / DGTA Belgium       | 2026-05-05                           | 2026-06-04 | bcaa.registration@mobilit.fgov.be                                                            | **Yes** (Unknown; public-record fallback after follow-up) |
| BDCA Belize               | 2026-05-05                           | 2026-06-04 | director@civilaviation.gov.bz                                                                | **Yes** (Unknown; public-record fallback after follow-up) |
| DGAC Bolivia              | 2026-05-10                           | 2026-06-09 | dgacbol@dgac.gob.bo cc contacto@dgac.gob.bo (verified via DGAC site; CP- prefix; Registro Público de Aeronaves) | **Yes** (Unknown; public-record fallback after follow-up) |
| BHDCA Bosnia & Herzegovina | 2026-05-10                          | 2026-06-09 | bhdca@bhdca.gov.ba (general Directorate inbox)                                               | **Yes** (Unknown; public-record fallback after follow-up) |
| CAAB Botswana             | 2026-05-05                           | 2026-06-04 | caab@caab.co.bw                                                                              | **Yes** (Unknown; public-record fallback after follow-up) |
| ANAC Brasil               | 2026-05-05                           | 2026-06-04 | rab@anac.gov.br                                                                              | **Yes** (Unknown; public-record fallback after follow-up) |
| CAA Bulgaria              | 2026-05-10                           | 2026-06-09 | AIRWORTHINESS@caa.bg (cc caa@caa.bg; Airworthiness Department)                               | **Yes** (Unknown; public-record fallback after follow-up) |
| AAC Cabo Verde            | 2026-05-10                           | 2026-06-09 | info@aac.cv (general AAC inbox)                                                              | **Yes** (Unknown; public-record fallback after follow-up) |
| DGAC Chile                | 2026-05-10 (English v2; v1 Spanish to delete) | 2026-06-09 | registro.aeronaves@dgac.gob.cl                                                      | **Yes** (Unknown; public-record fallback after follow-up) |
| UAEAC Colombia            | 2026-05-10                           | 2026-06-09 | atencionalciudadano@aerocivil.gov.co (Citizen Attention)                                     | **Yes** (Unknown; public-record fallback after follow-up) |
| DGAC Costa Rica           | 2026-05-10                           | 2026-06-09 | ventanillaunica@dgac.go.cr (verified via DGAC contact page, Cloudflare-decoded; official single-window inbox; TI- prefix) | **Yes** (Unknown; public-record fallback after follow-up) |
| CCAA Croatia              | 2026-05-10                           | 2026-06-09 | registar@ccaa.hr (registry-specific desk)                                                    | **Yes** (Unknown; public-record fallback after follow-up) |
| DCA Cyprus                | 2026-05-05                           | 2026-06-04 | director@dca.mcw.gov.cy                                                                      | **Yes** (Unknown; public-record fallback after follow-up) |
| CAA CR Czech Republic     | 2026-05-10                           | 2026-06-09 | dousova@caa.cz (cc podatelna@caa.gov.cz; Jana Doušová, register dept head)                   | **Yes** (Unknown; public-record fallback after follow-up) |
| Trafikstyrelsen Denmark   | 2026-05-05                           | 2026-06-04 | info@trafikstyrelsen.dk                                                                      | **Yes** (Unknown; public-record fallback after follow-up) |
| IDAC Dominican Republic   | 2026-05-10 (v2 to `info@idac.gov.do`) | 2026-06-09 | info@idac.gov.do (cc direccion@idac.gov.do — both delivered; cc ~~contacto@idac.gov.do~~ also bounced; v1 to ~~info@idac.gob.do~~ bounced — `.gob.do` does not host mailboxes) | **Yes** (Unknown; public-record fallback after follow-up) |
| DGAC Ecuador              | 2026-05-10                           | 2026-06-09 | oswaldo.veloz@aviacioncivil.gob.ec (Registro Aeronáutico desk — verified via search; HC- prefix; DGAC has org page on datosabiertos.gob.ec) | **Yes** (Unknown; public-record fallback after follow-up) |
| AAC El Salvador           | 2026-05-10                           | 2026-06-09 | jsalguero@aac.gob.sv (Director, Consejo de Aviación Civil — verified via AAC funcionarios page; YS- prefix; Registro Aeronáutico Salvadoreño) | **Yes** (Unknown; public-record fallback after follow-up) |
| Transpordiamet Estonia    | 2026-05-10                           | 2026-06-09 | info@transpordiamet.ee                                                                       | **Yes** (Unknown; public-record fallback after follow-up) |
| ECAA Ethiopia             | 2026-05-05                           | 2026-06-04 | caa.airnav@ethionet.et                                                                       | **Yes** (Unknown; public-record fallback after follow-up) |
| CAAF Fiji                 | 2026-05-05                           | 2026-06-04 | info@caaf.org.fj                                                                             | **Yes** (Unknown; public-record fallback after follow-up) |
| DGAC France               | 2026-05-05                           | 2026-06-04 | immat@aviation-civile.gouv.fr                                                                | **No** (Personal-use; silence ≠ permission)               |
| GCAA Georgia              | 2026-05-05                           | 2026-06-04 | office@gcaa.ge (English per English-first strategy)                                          | **Yes** (Unknown; public-record fallback after follow-up) |
| HCAA Greece               | 2026-05-10 (v2 with structured subject) | 2026-06-09 | info@hcaa.gov.gr (Flight Standards Directorate A2 routing inbox; v2 subject `Part-21 — Certificate Issuance — Ashley CHILDRESS` per HCAA structured-subject routing rules; body acknowledges menu-fit ambiguity; SX- prefix) | **Yes** (Unknown; public-record fallback after follow-up) |
| DGAC Guatemala            | 2026-05-10                           | 2026-06-09 | registro.aeronautico@dgac.gob.gt (register-specific desk)                                    | **Yes** (Unknown; public-record fallback after follow-up) |
| OFNAC Haiti               | 2026-05-10                           | 2026-06-09 | division.ais@ofnac.gouv.ht (only OFNAC email surfaced; body asks for forward to register dept) | **Yes** (Unknown; public-record fallback after follow-up) |
| AHAC Honduras             | 2026-05-10                           | 2026-06-09 | secretariaadministrativa@ahac.gob.hn cc licencias@ahac.gob.hn (verified via AHAC site; HR- prefix; RAN under Decreto 55-2004) | **Yes** (Unknown; public-record fallback after follow-up) |
| KKM Hungary               | 2026-05-10                           | 2026-06-09 | lfhf@ekm.gov.hu (cc caa@ekm.gov.hu; Légügyi Felügyeleti Hatósági Főosztály)                  | **Yes** (Unknown; public-record fallback after follow-up) |
| ICETRA Iceland            | 2026-05-05                           | 2026-06-04 | samgongustofa@samgongustofa.is                                                               | **Yes** (Unknown; public-record fallback after follow-up) |
| DGCA India                | 2026-05-05                           | 2026-06-04 | rkanand.dgca@nic.in, mdevula.dgca@nic.in (DDGs Airworthiness)                                | **Yes** (Unknown; public-record fallback after follow-up) |
| DKPPU Indonesia           | 2026-05-05                           | 2026-06-04 | produkaeronautika_dkuppu@dephub.go.id (cc info151@dephub.go.id)                              | **Yes** (Unknown; public-record fallback after follow-up) |
| IAA Ireland               | 2026-05-05                           | 2026-06-04 | registration@iaa.ie                                                                          | **Yes** (Unknown; public-record fallback after follow-up) |
| ENAC Italy                | 2026-05-05                           | 2026-06-04 | registro.aeromobili@enac.gov.it                                                              | **Yes** (Unknown; public-record fallback after follow-up) |
| JCAA Jamaica              | 2026-05-05                           | 2026-06-04 | info@jcaa.gov.jm                                                                             | **Yes** (Unknown; public-record fallback after follow-up) |
| CARC Jordan               | 2026-05-05                           | 2026-06-04 | info@carc.gov.jo (cc Bilal.Nazzal@CARC.GOV.JO)                                               | **Yes** (Unknown; public-record fallback after follow-up) |
| KOCA Korea                | 2026-05-05                           | 2026-06-04 | lia0404@korea.kr                                                                             | **Yes** (Unknown; public-record fallback after follow-up) |
| CAA Kyrgyzstan            | 2026-05-10                           | 2026-06-09 | mail@caa.kg (general Agency inbox)                                                           | **Yes** (Unknown; public-record fallback after follow-up) |
| CAA Lebanon (formerly DGCA) | 2026-05-10 (v2 to `info@caa.gov.lb` delivered) | 2026-06-09 | info@caa.gov.lb (delivered) cc ~~contact@caa.gov.lb~~ (bounced — hedge guess, dead); v1 to ~~info@dgca.gov.lb~~ also bounced; agency restructuring into General Authority of Civil Aviation per MPWT May 2025 | **Yes** (Unknown; public-record fallback after follow-up) |
| TKA Lithuania             | 2026-05-10 (v2 to `info@tka.lt`)     | 2026-06-09 | info@tka.lt (cc audrius.turauskas@tka.lt; v1 to ~~joris.dumcius@tka.lt~~ bounced)            | **Yes** (Unknown; public-record fallback after follow-up) |
| DAC Luxembourg            | 2026-05-10                           | 2026-06-09 | nav@av.etat.lu (Département Navigabilité)                                                    | **No** (Personal-use; silence ≠ permission)               |
| AACM Macao (SAR)          | 2026-05-10                           | 2026-06-09 | aacm@aacm.gov.mo (general Authority inbox)                                                   | **Yes** (Unknown; public-record fallback after follow-up) |
| CAA Macedonia (North)     | 2026-05-10 (v2 to `info@caa.gov.mk`) | 2026-06-09 | info@caa.gov.mk (correct subdomain; v1 to ~~caa@gov.mk~~ bounced — `gov.mk` is not a valid domain)          | **Yes** (Unknown; public-record fallback after follow-up) |
| CAAM Malaysia             | 2026-05-05                           | 2026-06-04 | webform at caam.gov.my/contact-us                                                            | **Yes** (Unknown; public-record fallback after follow-up) |
| CAA Maldives              | 2026-05-05                           | 2026-06-04 | airworthiness@caa.gov.mv                                                                     | **Yes** (Unknown; public-record fallback after follow-up) |
| CAD Malta                 | 2026-05-05                           | 2026-06-04 | civil.aviation@transport.gov.mt                                                              | **Yes** (Unknown; public-record fallback after follow-up) |
| AFAC Mexico               | 2026-05-05                           | 2026-06-04 | tramites@afac.gob.mx                                                                         | **Yes** (Unknown; public-record fallback after follow-up) |
| CAA Moldova               | 2026-05-10                           | 2026-06-09 | info@caa.gov.md (note: domain differs from `caa.md` website — verify if bounces)             | **Yes** (Unknown; public-record fallback after follow-up) |
| MCAA Mongolia             | 2026-05-10                           | 2026-06-09 | info@mcaa.gov.mn (general Authority inbox; stale PDF, refresh cadence requested)             | **Yes** (Unknown; public-record fallback after follow-up) |
| ACG Montenegro            | 2026-05-10                           | 2026-06-09 | acv@caa.me (general Agency inbox)                                                            | **Yes** (Unknown; public-record fallback after follow-up) |
| IACM Mozambique           | 2026-05-10                           | 2026-06-09 | info@iacm.gov.mz (cc geral@iacm.gov.mz)                                                      | **Yes** (Unknown; public-record fallback after follow-up) |
| CAA NZ                    | 2026-05-05                           | 2026-06-04 | info@caa.govt.nz                                                                             | **No** (Personal-use; silence ≠ permission)               |
| INAC Nicaragua            | 2026-05-10                           | 2026-06-09 | info@inac.gob.ni (verified via INAC contact page; YN- prefix; Law 595/2006)                  | **Yes** (Unknown; public-record fallback after follow-up) |
| Luftfartstilsynet Norway  | 2026-05-05                           | 2026-06-04 | postmottak@caa.no (sent); `nlr@caa.no` register-specific — use for follow-up                 | **Yes** (Unknown; public-record fallback after follow-up) |
| PCAA Pakistan             | 2026-05-05                           | 2026-06-04 | umair.sufyan@caapakistan.com.pk (named individual)                                           | **Yes** (Unknown; public-record fallback after follow-up) |
| AAC Panama                | 2026-05-10                           | 2026-06-09 | Rafael.barcenas@aeronautica.gob.pa cc paola.aparicio@aeronautica.gob.pa (verified via ATC Network; HP- prefix; SNRA R.A.C.P.) | **Yes** (Unknown; public-record fallback after follow-up) |
| CASA PNG                  | 2026-05-05                           | 2026-06-04 | info@casapng.gov.pg                                                                          | **Yes** (Unknown; public-record fallback after follow-up) |
| DINAC Paraguay            | 2026-05-10                           | 2026-06-09 | sec_gral@dinac.gov.py (External Document Reception per DINAC site; ZP- prefix; RAN under DINAC R-47) | **Yes** (Unknown; public-record fallback after follow-up) |
| DGAC Peru                 | 2026-05-10                           | 2026-06-09 | pmarin@mtc.gob.pe cc ncarhuay@mtc.gob.pe (DGAC officials verified via ATC Network; OB- prefix) | **Yes** (Unknown; public-record fallback after follow-up) |
| ULC Poland                | 2026-05-10 (v2 to `ltt@ulc.gov.pl`)  | 2026-06-09 | ltt@ulc.gov.pl (Department of Airworthiness — Director Marcin Perkowski, Deputy Justyna Iglewska; v1 to `kancelaria@ulc.gov.pl` superseded before send) | **Yes** (Unknown; public-record fallback after follow-up) |
| ANAC Portugal             | 2026-05-10 (webform pending — no email) | 2026-06-09 | **Webform only** at https://www.anac.pt/VPT/FOOTER/Paginas/Contactenos.aspx — verified no public email exists. Route to "Direção Jurídica" (Legal Direction) or "Direção de Aeronavegabilidade" (Airworthiness Direction); v1 to `geral@anac.pt` was unverified guess, superseded before send | **Yes** (Unknown; public-record fallback after follow-up) |
| CAD Serbia                | 2026-05-10                           | 2026-06-09 | dgca@cad.gov.rs (general Directorate inbox)                                                  | **Yes** (Unknown; public-record fallback after follow-up) |
| SCAA Seychelles           | 2026-05-05                           | 2026-06-04 | secretariat@scaa.sc                                                                          | **Yes** (Unknown; public-record fallback after follow-up) |
| CAAS Singapore            | 2026-05-05                           | 2026-05-26 | webform (3–15 business-day SLA)                                                              | **No** (Personal-use; silence ≠ permission)               |
| Dopravný úrad Slovakia    | 2026-05-10                           | 2026-06-09 | register.lietadiel@nsat.sk (register-specific desk; license confirmation only)               | **Yes** (Unknown; public-record fallback after follow-up) |
| CAA Slovenia              | 2026-05-10 (v2 to register-specific desk) | 2026-06-09 | matej.dolinar@caa.si (Airworthiness Division / Sektor za plovnost — verified via search; phone 01 244 66 34) cc info@caa.si (general); S5- prefix; cited Latvia/Lithuania/Finland as peer comparables | **Yes** (Unknown; public-record fallback after follow-up) |
| CAASL Sri Lanka           | 2026-05-05                           | 2026-06-04 | daw@caa.lk (cc scaiaras@caa.lk; Mr. Ratnayake, Director Aircraft Registration)               | **Yes** (Unknown; public-record fallback after follow-up) |
| CASAS Suriname            | 2026-05-05                           | 2026-06-04 | casasinfo@casas.sr (Cloudflare-decoded; verify if bounces)                                   | **Yes** (Unknown; public-record fallback after follow-up) |
| Transportstyrelsen Sweden | 2026-05-05                           | 2026-06-04 | luftfart@transportstyrelsen.se (sent); `lfr@transportstyrelsen.se` register-specific — use for follow-up | **Yes** (Unknown; public-record fallback after follow-up) |
| FOCA Switzerland          | 2026-05-05                           | 2026-06-04 | aircraftregistry@bazl.admin.ch                                                               | **No** (Personal-use; silence ≠ permission)               |
| CAA Taiwan                | 2026-05-05                           | 2026-06-04 | gencaa@mail.caa.gov.tw                                                                       | **Yes** (Unknown; public-record fallback after follow-up) |
| TCAA Tanzania             | 2026-05-05 (v2 to `tcaa@tcaa.go.tz`) | 2026-06-04 | tcaa@tcaa.go.tz (v1 to ~~airworthinessinspectors@tcaa.go.tz~~ / ~~info@tcaa.go.tz~~ bounced) | **Yes** (Unknown; public-record fallback after follow-up) |
| CAAT Thailand             | 2026-05-10                           | 2026-06-09 | inter_focalpoint@caat.or.th (cc saraban@caat.or.th; international focal point)               | **Yes** (Unknown; public-record fallback after follow-up) |
| ANAC Togo                 | 2026-05-10                           | 2026-06-09 | anac@anac-togo.tg (cc secretariat@anac-togo.tg)                                              | **Yes** (Unknown; public-record fallback after follow-up) |
| TTCAA Trinidad & Tobago   | 2026-05-05                           | 2026-06-04 | ttcaa@caa.gov.tt                                                                             | **Yes** (Unknown; public-record fallback after follow-up) |
| SAAU Ukraine              | 2026-05-10                           | 2026-06-09 | vdz@avia.gov.ua (Documentation and Control Dept; license confirmation only; wartime ack)     | **Yes** (Unknown; public-record fallback after follow-up) |
| DINACIA Uruguay           | 2026-05-10                           | 2026-06-09 | dinacia@dinacia.gub.uy (cc certaero@dinacia.gub.uy)                                          | **Yes** (Unknown; public-record fallback after follow-up) |

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
| Japan (JCAB / MLIT)                 | Verified 2026-05-10 — ¥970/aircraft (~$6 USD) for per-record consultation of 航空機登録原簿; procedure explicitly reserves the right to decline bulk requests (_"大量の閲覧請求はお受けできない場合があります"_); photography-only on-site review, no copies allowed. MLIT publishes aggregate count XLSX only; per-tail register absent from data.go.jp and e-Gov data portal. Same exclusion pattern as Germany LBA + Israel CAAI + Romania AACR. Revisit only if MLIT publishes the per-tail register on data.go.jp under an explicit open license, or 航空法 Art. 8-2 is amended to provide a bulk channel.                                                                                              |
| Romania (AACR)                      | Verified 2026-05-10 — €45/aircraft + VAT for register information per RACR IA art. 6.7 (~€11k+ for ~200 aircraft). No bulk channel. Register page also CAPTCHA-walled. Same exclusion criteria as UK G-INFO + Israel CAAI. Revisit only if AACR publishes RUIAC on data.gov.ro under an open license.                                                                                                                                       |

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

### Germanic / Nordic (German / Dutch / Danish / Swedish / Norwegian / Finnish)

> Note: Switzerland, Sweden, Norway, Austria, Belgium, Denmark, Finland, and Suriname were all emailed in English on 2026-05-05 and now sit in the **In flight** section above. No agencies remain deferred in this group.

### Slavic / Eastern European

> Note: Russia (Rosaviatsia) was moved to the **Excluded** section above (sanctions exposure).

| Country              | Agency         | Register URL                                                                                                        | Language                 |
| -------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Estonia              | Transpordiamet | [transpordiamet.ee](https://transpordiamet.ee/ohusoidukite-register) **(emailed 2026-05-10 — see In flight section above)** | Estonian                 |

### CJK / East Asian

> Note: China (CAAC) and Japan (JCAB / MLIT) were moved to the **Excluded** section above — China for IE-only register page + geopolitical exposure, Japan for ¥970/aircraft fee + explicit refusal-of-bulk clause + no-copy on-site review (same exclusion pattern as Germany LBA, Israel CAAI, Romania AACR). Taiwan, Korea, and Indonesia were emailed in English on 2026-05-05 and now sit in the **In flight** section above.

| Country  | Agency | Register URL                                                           | Language             |
| -------- | ------ | ---------------------------------------------------------------------- | -------------------- |

### Caucasus / Central Asia

> Note: Georgia (GCAA) was emailed in English on 2026-05-05 per the English-first strategy (R3.1 research already done — register is an HTML scrape at gcaa.ge/civil-aircraft-register/, ~63 aircraft). Now sits in **In flight** above. Armenia and Kyrgyzstan remain deferred.

| Country    | Agency | Register URL                                               | Language         |
| ---------- | ------ | ---------------------------------------------------------- | ---------------- |

### Middle East

> Note: Lebanon (DGCA Lebanon) was emailed in English on 2026-05-10 and now sits in the **In flight** section above. No agencies remain deferred in this group.

---

## Phase 3 — beyond avcodes (initial recon)

The avcodes.co.uk list (~86 entries) is not exhaustive of world civil aviation authorities. This section captures agencies with national aircraft registers that are NOT on avcodes but exist and operate registers. Initial Pass 1 recon completed 2026-05-10 — agency confirmed, register URL surfaced where possible, license posture indicator noted. Most land in **Unknown** and need a permission email (Pass 2 + send).

**Auto-deferred — sanctions / active conflict exposure (no research):**

| Country | Reason |
| --- | --- |
| Belarus | OFAC/EU sanctions; same posture as Russia |
| Venezuela | OFAC sectoral sanctions; defer pending sectoral aviation carve-out review |
| Cuba (IACC) | OFAC blanket; same posture as Russia |
| Iran (CAO.IR) | OFAC blanket sanctions |
| Syria (SyCAA) | OFAC blanket sanctions |
| North Korea | OFAC blanket sanctions |
| Yemen (CAMA) | Active conflict; aviation infrastructure non-functioning |
| Sudan (CAA Sudan) | Active conflict |
| Libya (LCAA) | Sectoral sanctions + fragmented governance |
| Iraq (ICAA) | Conflict-recovery posture; defer |
| Myanmar (DCA Myanmar) | Active conflict + post-coup sanctions exposure |

### Europe (avcodes-gap)

> All 5 Europe-gap agencies (Albania, Greece, Poland, Portugal, Slovenia) emailed in English 2026-05-10 and graduated to the **In flight** section above. No agencies remain in this group. Belarus excluded (sanctions).

### Latin America (avcodes-gap)

> All 9 LatAm-gap agencies (Bolivia, Costa Rica, Ecuador, El Salvador, Honduras, Nicaragua, Panama, Paraguay, Peru) emailed in English 2026-05-10 with verified contacts and graduated to the **In flight** section above. No agencies remain in this group. Cuba + Venezuela excluded (sanctions).

### MENA (avcodes-gap)

| Country | Agency | Register URL | Format hint | License posture | Notes |
| --- | --- | --- | --- | --- | --- |
| UAE | GCAA (General Civil Aviation Authority) | [gcaa.gov.ae](https://www.gcaa.gov.ae/) + [opendata.fcsc.gov.ae/@general-authority-civil-aviation](https://opendata.fcsc.gov.ae/@general-authority-civil-aviation) | Has open-data portal presence — but published dataset is "Accepted Aircraft Models" (type approvals, not the per-tail register) | Unknown for the register specifically — **promising open-data posture but the per-tail register itself is not yet visible on the portal** | A6- prefix. |
| Saudi Arabia | GACA (General Authority of Civil Aviation) | [gaca.gov.sa/en/Open-Data](https://gaca.gov.sa/en/Open-Data) | **Explicit Open Data section on official site** — strongest signal in this batch | Unknown but strongest Open lean of the entire Phase 3 batch — needs Pass 2 to confirm aircraft register specifically is on the portal | HZ- prefix. |
| Egypt | ECAA (Egyptian Civil Aviation Authority) | [civilaviation.gov.eg](https://www.civilaviation.gov.eg/ECAA/Legisation) | TBD | Unknown | SU- prefix. Same acronym collision as Ethiopia ECAA. |
| Qatar | QCAA (Qatar Civil Aviation Authority) | [caa.gov.qa](https://www.caa.gov.qa/en) | Has "Open Data" section in navigation but register-specific dataset not surfaced | Unknown | A7- prefix. Contact: pr@caa.gov.qa |
| Kuwait | DGCA Kuwait (Directorate General of Civil Aviation) | [dgca.gov.kw](https://www.dgca.gov.kw/) + [kcaa.dgca.gov.kw](https://kcaa.dgca.gov.kw/) | TBD | Unknown | 9K- prefix. Acronym collision with Lebanon legacy DGCA. |
| Bahrain | CAA Bahrain (Civil Aviation Affairs) | [mtt.gov.bh/civil-aviation](https://www.mtt.gov.bh/civil-aviation) | TBD | Unknown | A9C- prefix. |
| Oman | PACA (Public Authority for Civil Aviation, renamed to CAA) | [paca.gov.om](https://www.paca.gov.om/) | TBD | Unknown | A4O- prefix. |
| Morocco | DGAC Morocco | [aviationcivile.gov.ma](https://www.aviationcivile.gov.ma/) | TBD — data.gov.ma cross-check pending | Unknown | CN- prefix. |
| Tunisia | DGAC Tunisia (Office de l'aviation civile et des aéroports / Direction Générale de l'Aviation Civile) | [transport.tn/fr/aviation](https://www.transport.tn/fr/aviation/) | TBD — data.gov.tn cross-check pending | Unknown | TS- prefix. Contact: be.dgac@mt.gov.tn |
| Algeria | ANAC Algeria (formerly DACM) | [anac.dz](https://www.anac.dz/en/home/) | TBD — data.gov.dz cross-check pending | Unknown | 7T- prefix. |

### Africa (avcodes-gap)

| Country | Agency | Register URL | Format hint | License posture | Notes |
| --- | --- | --- | --- | --- | --- |
| South Africa | SACAA (South African Civil Aviation Authority) | [caa.co.za](https://www.caa.co.za/) → SACAR (South African Civil Aircraft Register) | TBD — register exists, public access pattern TBD | Unknown | ZS- prefix. |
| Nigeria | NCAA (Nigerian Civil Aviation Authority) | [ncaa.gov.ng](https://ncaa.gov.ng/) | TBD | Unknown | 5N- prefix. |
| Kenya | KCAA (Kenya Civil Aviation Authority) | [kcaa.or.ke](https://kcaa.or.ke/) | Per-aircraft register extract on formal request + fee | **Leans Excluded** (fee-gated per-record, same pattern as Israel CAAI / Romania AACR / Japan JCAB) | 5Y- prefix. Pass 2 must confirm whether bulk channel exists before formal classification. |
| Ghana | GCAA Ghana (Ghana Civil Aviation Authority) | [gcaa.com.gh](https://www.gcaa.com.gh/web/) | Register is electronic but **password-only access** per GCAA Flight Standards Part 4 | **Leans Personal-use or Excluded** — password-walled access is a strong restrictive signal | 9G- prefix. Acronym collision with Georgia GCAA. |
| Senegal | ANACIM (Agence Nationale de l'Aviation Civile et de la Météorologie) | [anacs.sn/immatriculation.php](https://www.anacs.sn/immatriculation.php) (legacy ANACS domain still cited) + anacim.sn (current) | Web register page (legacy) | Unknown — legacy domain status needs Pass 2 verification | 6V- prefix. ANACIM = ANACS merged with meteorology agency in 2011. |
| Côte d'Ivoire | ANAC CI (Autorité Nationale de l'Aviation Civile) | [anac.ci](https://www.anac.ci/) | TBD | Unknown | TU- prefix. |
| Cameroon | CCAA (Cameroon Civil Aviation Authority) | [ccaa.aero](https://www.ccaa.aero/index.php/en/) | Third-party Aeroflight has TJ- register in zipped .txt — suggests bulk format exists somewhere | Unknown | TJ- prefix. |
| Angola | INAVIC / ANAC Angola (renamed) | [inavic.gov.ao](https://inavic.gov.ao/) | TBD | Unknown | D2- prefix. |
| Zimbabwe | CAAZ (Civil Aviation Authority of Zimbabwe) | [caaz.co.zw](https://www.caaz.co.zw/) | TBD | Unknown | Z- prefix. Contacts: licencing@caaz.co.zw, pr@caaz.co.zw |
| Zambia | ZCAA (Zambia Civil Aviation Authority) | [caa.co.zm](https://www.caa.co.zm/) | TBD | Unknown | 9J- prefix. |
| Madagascar | ACM (Aviation Civile de Madagascar) | [acm.mg](http://www.acm.mg/) | TBD — DSEA (Directorate for Safety and Use of Aircraft) maintains register | Unknown | 5R- prefix. |
| Mauritius | DCA Mauritius (Department of Civil Aviation) | [civil-aviation.govmu.org](https://civil-aviation.govmu.org/) | **Mortgage register is publicly available** per Civil Aviation Regulations 2007; main register publicity TBD | Unknown but **leans partial-Open** (publicly-accessible mortgage register is a statutory carve-out) | 3B- prefix. |
| Rwanda | RCAA (Rwanda Civil Aviation Authority) | [caa.gov.rw](https://www.caa.gov.rw/) | Register "maintained on premises" per RCAR Part 2 — phrasing suggests on-site consultation | Unknown — leans toward consultation-only | 9XR- prefix. |
| Uganda | UCAA (Uganda Civil Aviation Authority) | [caa.go.ug](https://caa.go.ug/) | TBD | Unknown | 5X- prefix. |
| DRC | AAC RDC (Autorité de l'Aviation Civile de la République Démocratique du Congo) | [aacrdc.org](https://www.aacrdc.org/) | TBD | Unknown | 9Q- prefix. |

### Asia (avcodes-gap)

| Country | Agency | Register URL | Format hint | License posture | Notes |
| --- | --- | --- | --- | --- | --- |
| Vietnam | CAAV (Civil Aviation Authority of Vietnam) | [caa.gov.vn](https://caa.gov.vn/) | TBD — online public service portal exists for applications | Unknown | VN- prefix. |
| Philippines | CAAP (Civil Aviation Authority of the Philippines) | [caap.gov.ph](https://www.caap.gov.ph/) | TBD | Unknown | RP- prefix (with sub-letters: RP-C civilian, RP-R restricted, RP-G government, RP-U unmanned). |
| Cambodia | SSCA (State Secretariat of Civil Aviation) | [civilaviation.gov.kh](http://www.civilaviation.gov.kh/en/) | TBD | Unknown | XU- prefix. Contacts: admin-info@ssca.gov.kh, ssca-int@ssca.gov.kh |
| Laos | DCAL (Department of Civil Aviation, Lao PDR) | [dcal.gov.la](https://www.dcal.gov.la/) | Third-party Air-Britain has RDPL- register PDF — suggests bulk format exists somewhere | Unknown | RDPL- prefix (5-char, unusual). |
| Bangladesh | CAAB (Civil Aviation Authority of Bangladesh) | [caab.portal.gov.bd](https://caab.portal.gov.bd/) | TBD | Unknown | S2- prefix. Acronym collision with Bosnia BHDCA. Contact: adminceoffice@caab.gov.bd |
| Nepal | CAAN (Civil Aviation Authority of Nepal) | [caanepal.gov.np](https://caanepal.gov.np/) | TBD — Flight Safety Standards Department maintains | Unknown | 9N- prefix. |
| Bhutan | BCAA Bhutan (Bhutan Civil Aviation Authority) | [bcaa.gov.bt](https://bcaa.gov.bt/) | TBD — very small register (~5 aircraft total) | Unknown | A5- prefix. Tiny fleet — low priority. |

### Phase 3 follow-up priorities

Ranked by license-posture promise:

1. **Saudi GACA** — explicit Open Data section on official site. Highest probability of clean Open posture in the batch.
2. **UAE GCAA** — open-data portal presence (FCSC). Register-specific dataset not yet visible but the infrastructure is there.
3. **Ecuador DGAC** — has an organization page on datosabiertos.gob.ec. Pass 2 should confirm whether the register is one of their datasets.
4. **Bolivia DGAC** — "Registro Público de Aeronaves" framing leans Open.
5. **Mauritius DCA** — statutorily-public mortgage register is a strong civil-law carve-out signal.

**Likely-Excluded candidates** (Pass 2 must confirm before final classification):

- **Kenya KCAA** — fee-gated per-record extract; bulk channel not surfaced. Pattern matches Israel/Romania/Japan.
- **Ghana GCAA** — password-walled electronic register access per GCAA Flight Standards Part 4.

**Everything else** is Unknown and needs the standard permission-email workflow once Pass 2 confirms the register URL and contact path.

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
