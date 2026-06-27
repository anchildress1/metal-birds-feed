# Source Onboarding Checklist

Working list for triaging the rest of the world's national aircraft registers, derived from the [avcodes.co.uk Official Civil Aircraft Registers list](https://www.avcodes.co.uk/reglinks.asp?type=Official) (86 entries).

**Workflow per agency:**

1. **Verify** — open the agency's register URL, find their copyright / terms / data-license page (usually footer link), and classify:
   - **Open** (CC BY, CC-0, OGL, public domain, "any purpose") → no email; just attribute.
   - **Personal-use** (CC BY-NC, "for personal use only," "non-commercial only") → send permission email.
   - **Unknown** (no statement, no terms link) → send permission email.
   - **Restrictive** (paid, single-PC, no-redistribute) → exclude. Don't email.
2. **Email** (if needed) — fill in the template at [`docs/agency-permission-request.md`](agency-permission-request.md) and send. Record send date in `DATA_LICENSES.md`.
3. **Update** — add a new section to `DATA_LICENSES.md` (the email record of source) and add the row to the README Sources table.

---

## Status snapshot

### ✅ Done — no further action

| Source            | License                                           | How handled    |
| ----------------- | ------------------------------------------------- | -------------- |
| FAA               | US public domain                                  | Live (phase 1) |
| Transport Canada  | GC Open Data Licence Agreement (verbatim notices) | Live (phase 2) |
| ILT (Netherlands) | CC-0                                              | Live (phase 3) |
| CASA (Australia)  | CC BY 4.0                                         | Live (phase 4) |
| CAA Latvia        | CC0-1.0                                           | Live (phase 5) |
| CAA Taiwan        | Open (OGDL v1.0)                                  | Live (phase 6) |
| ANAC Brasil       | Open w/ attribution (CC BY-equiv)                 | Live (phase 7) |
| FOCA / BAZL (CH)  | Open w/ attribution (FOCA legal grant 2026-05-22) | Live (phase 8) |
| CAA Maldives      | Open + attribution + error-disclaimer (written)   | Live (phase 9) |

### 🛠️ Cleared — implementation pending

License is cleared (via public declaration or substantive agency reply). Ingest is blocked on engineering work — usually a new parser path, a non-standard fetch pattern, a data-shape issue, or upstream dataset publication. Full reply text and contacts live in `DATA_LICENSES.md`.

| Source                 | License (cleared via)                             | Ingest blocker                                                              | Reply           |
| ---------------------- | ------------------------------------------------- | --------------------------------------------------------------------------- | --------------- |
| Traficom Finland       | Open (CC BY 4.0) — confirmed in writing           | Data shape — public ZIP-CSV is GDPR-stripped; no identifier-bearing channel | 2026-05-11      |
| Transpordiamet Estonia | Personal-use + attribution                        | HTML scrape needed                                                          | replied         |
| CAAT Thailand          | Personal-use + attribution — CAAT bilateral grant | config + fixtures (pdf parser path landed with mv-caa)                      | replied         |
| CAA Oman               | Open (CC BY 4.0-compat) — Oman Open Data License  | Register dataset not yet published                                          | sent 2026-05-11 |
| CAAS Singapore         | Open + attribution — confirmed by CAAS            | No bulk download surfaced                                                   | 2026-05-11      |

### 🟡 In flight — waiting on reply

All awaiting a substantive reply. Contact addresses, verification provenance, and per-agency notes live in `DATA_LICENSES.md` (the record of source). Fallback = whether the 30-day public-record fallback applies (Unknown) or an affirmative reply is required (Personal-use).

| Source                                    | Sent       | Follow-up  | Reply   | Fallback |
| ----------------------------------------- | ---------- | ---------- | ------- | -------- |
| AAC Albania                               | 2026-05-10 | 2026-06-09 | pending | Yes      |
| ANAC Algeria                              | 2026-05-11 | 2026-06-10 | pending | No       |
| ANAC Angola                               | 2026-05-11 | 2026-06-10 | pending | Yes      |
| ANAC Argentina                            | 2026-05-05 | 2026-06-04 | pending | Yes      |
| CAC Armenia                               | 2026-05-10 | 2026-06-09 | pending | Yes      |
| BCAA Bahamas                              | 2026-05-05 | 2026-06-04 | pending | Yes      |
| CAA Bahrain                               | 2026-05-11 | 2026-06-10 | pending | Yes      |
| CAAB Bangladesh                           | 2026-05-11 | 2026-06-10 | pending | Yes      |
| BCAA / DGTA Belgium                       | 2026-05-05 | 2026-06-04 | pending | Yes      |
| BDCA Belize                               | 2026-05-05 | 2026-06-04 | pending | Yes      |
| ANAC Bénin                                | 2026-05-11 | 2026-06-10 | pending | Yes      |
| BCAA Bhutan                               | 2026-05-11 | 2026-06-10 | pending | Yes      |
| DGAC Bolivia                              | 2026-05-10 | 2026-06-09 | pending | Yes      |
| BHDCA Bosnia & Herzegovina                | 2026-05-10 | 2026-06-09 | pending | Yes      |
| CAAB Botswana                             | 2026-05-05 | 2026-06-04 | pending | Yes      |
| CAA Bulgaria                              | 2026-05-10 | 2026-06-09 | pending | Yes      |
| ANAC Burkina Faso                         | 2026-05-11 | 2026-06-10 | pending | Yes      |
| AAC Cabo Verde                            | 2026-05-10 | 2026-06-09 | pending | Yes      |
| SSCA Cambodia                             | 2026-05-11 | 2026-06-10 | pending | Yes      |
| CCAA Cameroon                             | 2026-05-11 | 2026-06-10 | pending | Yes      |
| DGAC Chile                                | 2026-05-10 | 2026-06-09 | pending | Yes      |
| Ministry of Transport Cook Islands        | 2026-05-11 | 2026-06-10 | pending | Yes      |
| DGAC Costa Rica                           | 2026-05-10 | 2026-06-09 | pending | Yes      |
| ANAC CI Côte d'Ivoire                     | 2026-05-11 | 2026-06-10 | pending | Yes      |
| CCAA Croatia                              | 2026-05-10 | 2026-06-09 | pending | Yes      |
| DCA Cyprus                                | 2026-05-05 | 2026-06-04 | pending | Yes      |
| CAA CR Czech Republic                     | 2026-05-10 | 2026-06-09 | pending | Yes      |
| AAC RDC DRC                               | 2026-05-11 | 2026-06-10 | pending | Yes      |
| Trafikstyrelsen Denmark                   | 2026-05-05 | 2026-06-04 | pending | Yes      |
| IDAC Dominican Republic                   | 2026-05-10 | 2026-06-09 | pending | Yes      |
| ECCAA (regional) Eastern Caribbean (OECS) | 2026-05-11 | 2026-06-10 | pending | Yes      |
| DGAC Ecuador                              | 2026-05-10 | 2026-06-09 | pending | Yes      |
| AAC El Salvador                           | 2026-05-10 | 2026-06-10 | pending | Yes      |
| ESWACAA Eswatini                          | 2026-05-11 | 2026-06-10 | pending | Yes      |
| ECAA Ethiopia                             | 2026-05-05 | 2026-06-04 | pending | Yes      |
| CAAF Fiji                                 | 2026-05-05 | 2026-06-04 | pending | Yes      |
| DGAC France                               | 2026-05-05 | 2026-06-04 | pending | No       |
| GCAA Georgia                              | 2026-05-05 | 2026-06-04 | pending | Yes      |
| HCAA Greece                               | 2026-05-10 | 2026-06-09 | pending | Yes      |
| DGAC Guatemala                            | 2026-05-10 | 2026-06-09 | pending | Yes      |
| GCAA Guyana                               | 2026-05-11 | 2026-06-10 | pending | Yes      |
| OFNAC Haiti                               | 2026-05-10 | 2026-06-09 | pending | Yes      |
| AHAC Honduras                             | 2026-05-10 | 2026-06-09 | pending | Yes      |
| KKM Hungary                               | 2026-05-10 | 2026-06-09 | pending | Yes      |
| ICETRA Iceland                            | 2026-05-05 | 2026-06-04 | pending | Yes      |
| DGCA India                                | 2026-05-05 | 2026-06-04 | pending | Yes      |
| DKPPU Indonesia                           | 2026-05-05 | 2026-06-04 | pending | Yes      |
| IAA Ireland                               | 2026-05-05 | 2026-06-04 | pending | Yes      |
| ENAC Italy                                | 2026-05-05 | 2026-06-04 | pending | Yes      |
| JCAA Jamaica                              | 2026-05-05 | 2026-06-04 | pending | Yes      |
| CARC Jordan                               | 2026-05-05 | 2026-06-04 | pending | Yes      |
| Aviation Administration Kazakhstan        | 2026-05-11 | 2026-06-10 | pending | Yes      |
| KOCA Korea                                | 2026-05-05 | 2026-06-04 | pending | Yes      |
| CAA Kosovo                                | 2026-05-11 | 2026-06-10 | pending | Yes      |
| DGCA Kuwait                               | 2026-05-11 | 2026-06-10 | pending | Yes      |
| CAA Kyrgyzstan                            | 2026-05-10 | 2026-06-09 | pending | Yes      |
| DCAL Laos                                 | 2026-05-11 | 2026-06-10 | pending | Yes      |
| CAA Lebanon (formerly DGCA)               | 2026-05-10 | 2026-06-09 | pending | Yes      |
| LCAA Liberia                              | 2026-05-11 | 2026-06-10 | pending | Yes      |
| TKA Lithuania                             | 2026-05-10 | 2026-06-09 | pending | Yes      |
| DAC Luxembourg                            | 2026-05-10 | 2026-06-09 | pending | No       |
| AACM Macao (SAR)                          | 2026-05-10 | 2026-06-09 | pending | Yes      |
| CAA Macedonia (North)                     | 2026-05-10 | 2026-06-09 | pending | Yes      |
| ACM Madagascar                            | 2026-05-11 | 2026-06-10 | pending | Yes      |
| CAAM Malaysia                             | 2026-05-05 | 2026-06-04 | pending | Yes      |
| CAD Malta                                 | 2026-05-05 | 2026-06-04 | pending | Yes      |
| ANAC Mauritanie                           | 2026-05-11 | 2026-06-10 | pending | Yes      |
| AFAC Mexico                               | 2026-05-05 | 2026-06-04 | pending | Yes      |
| CAA Moldova                               | 2026-05-10 | 2026-06-09 | pending | Yes      |
| MCAA Mongolia                             | 2026-05-10 | 2026-06-09 | pending | Yes      |
| DGAC Morocco                              | 2026-05-11 | 2026-06-10 | pending | Yes      |
| ACG Montenegro                            | 2026-05-10 | 2026-06-09 | pending | Yes      |
| IACM Mozambique                           | 2026-05-10 | 2026-06-09 | pending | Yes      |
| CAAN Nepal                                | 2026-05-11 | 2026-06-10 | pending | Yes      |
| CAA NZ                                    | 2026-05-05 | 2026-06-04 | pending | No       |
| INAC Nicaragua                            | 2026-05-10 | 2026-06-09 | pending | Yes      |
| NCAA Nigeria                              | 2026-05-11 | 2026-06-10 | pending | Yes      |
| Luftfartstilsynet Norway                  | 2026-05-05 | 2026-06-04 | pending | Yes      |
| PASO (regional) Pacific Island states     | 2026-05-11 | 2026-06-10 | pending | Yes      |
| PCAA Pakistan                             | 2026-05-05 | 2026-06-04 | pending | Yes      |
| AAC Panama                                | 2026-05-10 | 2026-06-09 | pending | Yes      |
| CASA PNG                                  | 2026-05-05 | 2026-06-04 | pending | Yes      |
| DINAC Paraguay                            | 2026-05-10 | 2026-06-09 | pending | Yes      |
| DGAC Peru                                 | 2026-05-10 | 2026-06-09 | pending | Yes      |
| CAAP Philippines                          | 2026-05-11 | 2026-06-10 | pending | Yes      |
| ULC Poland                                | 2026-05-10 | 2026-06-09 | pending | Yes      |
| ANAC Portugal                             | 2026-05-10 | 2026-06-09 | pending | Yes      |
| QCAA Qatar                                | 2026-05-11 | 2026-06-10 | pending | Yes      |
| INAC São Tomé and Príncipe                | 2026-05-11 | 2026-06-10 | pending | Yes      |
| GACA Saudi Arabia                         | 2026-05-11 | 2026-06-10 | pending | Yes      |
| ANACIM Senegal                            | 2026-05-11 | 2026-06-10 | pending | Yes      |
| CAD Serbia                                | 2026-05-10 | 2026-06-09 | pending | Yes      |
| SCAA Seychelles                           | 2026-05-05 | 2026-06-04 | pending | Yes      |
| SLCAA Sierra Leone                        | 2026-05-11 | 2026-06-10 | pending | Yes      |
| Dopravný úrad Slovakia                    | 2026-05-10 | 2026-06-09 | pending | Yes      |
| CAA Slovenia                              | 2026-05-10 | 2026-06-09 | pending | Yes      |
| SACAA South Africa                        | 2026-05-11 | 2026-06-10 | pending | Yes      |
| SSCAA South Sudan                         | 2026-05-11 | 2026-06-10 | pending | Yes      |
| AESA Spain                                | 2026-05-05 | 2026-06-04 | pending | Yes      |
| CAASL Sri Lanka                           | 2026-05-05 | 2026-06-04 | pending | Yes      |
| CASAS Suriname                            | 2026-05-05 | 2026-06-04 | pending | Yes      |
| TCAA Tanzania                             | 2026-05-05 | 2026-06-04 | pending | Yes      |
| Tajikistan CAA                            | 2026-05-11 | 2026-06-10 | pending | Yes      |
| ANAC Togo                                 | 2026-05-10 | 2026-06-09 | pending | Yes      |
| TTCAA Trinidad & Tobago                   | 2026-05-05 | 2026-06-04 | pending | Yes      |
| DGAC Tunisia                              | 2026-05-11 | 2026-06-10 | pending | Yes      |
| State Service Civil Aviation Turkmenistan | 2026-05-11 | 2026-06-10 | pending | Yes      |
| UCAA Uganda                               | 2026-05-11 | 2026-06-10 | pending | Yes      |
| SAAU Ukraine                              | 2026-05-10 | 2026-06-09 | pending | Yes      |
| GCAA UAE                                  | 2026-05-11 | 2026-06-10 | pending | Yes      |
| DINACIA Uruguay                           | 2026-05-10 | 2026-06-09 | pending | Yes      |
| UZCAA Uzbekistan                          | 2026-05-11 | 2026-06-10 | pending | Yes      |
| CAAV Vietnam                              | 2026-05-11 | 2026-06-10 | pending | Yes      |
| ZCAA Zambia                               | 2026-05-11 | 2026-06-10 | pending | Yes      |
| CAAZ Zimbabwe                             | 2026-05-11 | 2026-06-10 | pending | Yes      |

### ❌ Excluded — do not pursue

| Source                                    | Reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Afghanistan (ACAA)                        | Taliban-era authority; OFAC restrictions; no contact. YA- prefix. Revisit if sanctions framework changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Andorra                                   | Landlocked microstate; no civil aviation register; aviation activity falls under FR/ES airspace.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Aruba (DCA Aruba / Registry of Aruba)     | Commercial offshore registry — paid SaaS-style MTOW-based commercial offshore registry (theregistryofaruba.com, p4registry.com); 24-48h registration product; not in business of bulk redistribution. P4- prefix. Reconfirmed 2026-05-11.                                                                                                                                                                                                                                                                                                                                                                       |
| **Austria (Austro Control)**              | **❗ Excluded by explicit agency request 2026-06-09** — third formal denial received. Reply from Nina Schraml (Aviation Agency / Section Airworthiness AIR / Aircraft Register) after legal review: "Austro Control GmbH does not authorize the redistribution of the published aircraft register." Honored per the project's standing commitment. Revisit only on affirmative reply reversing the decision (no automatic re-contact). Operator-binding: forks must also honor. OE- prefix.                                                                                                                     |
| Belarus (Aviation Dept of Min. Transport) | OFAC/EU sanctions exposure; same posture as Russia. EW- prefix.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Colombia (UAEAC)**                      | **❗ Excluded by formal administrative reply 2026-06-17** (Radicado 2026240060041283 Id 2605417) — fifth formal denial received. Reply from Hugo Moreno Cano (Coordinador Grupo Registro Aeronáutico, UAEAC; authored by José Andrés Galeano Higgins): both redistribution authorization and bulk-download channel explicitly denied. Public consultation remains in-person only under Habeas Data + Ley 1581/2012 + Ley 1712/2014; no appeal under Ley 1755 de 2015. Honored per the project's standing commitment. Operator-binding: forks must also honor. HK- prefix.                                       |
| Cuba (IACC)                               | OFAC blanket sanctions; do not contact. CU- prefix.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Eritrea                                   | No public web presence found for Eritrea Civil Aviation Authority (aviation.gov.er unreachable); no surfaceable register. Revisit if web presence restored.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Hong Kong (CAD HK)**                    | **Excluded by agency confirmation 2026-05-19** — Airworthiness Office, Flight Standards and Airworthiness Division replied: "the Hong Kong aircraft registry is not published on the CAD website". Same structural-non-public pattern as Israel CAAI / Romania AACR / Japan JCAB / UK G-INFO / Germany LBA / Kenya KCAA. B-H/B-K/B-L prefix. Revisit only if CAD publishes the register on the CAD website or on data.gov.hk under explicit reuse terms.                                                                                                                                                        |
| Iran (CAO.IR)                             | OFAC blanket sanctions; geo-block on cao.ir. EP- prefix.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Iraq (ICAA)                               | Conflict-recovery posture; deferred. YI- prefix.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Libya (LCAA)                              | Sectoral sanctions + fragmented governance. 5A- prefix.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Liechtenstein                             | No own register; civil aviation operates under Switzerland HB- prefix via FOCA/BAZL. HB- aircraft surface through the Switzerland FOCA source, now classified Open via bilateral grant.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Mauritius (DCA Mauritius)**             | **❗ Excluded by explicit agency reply 2026-06-08** (Ref: CAV/GEN/1/1) — fourth formal denial received. Reply from S Rambricho (Ag. Director of Civil Aviation, Department of Civil Aviation, SSR International Airport): the register is "accessible for viewing only" (registration mark, registration date, owner name); other fields protected under Mauritius Data Protection Act; redistribution not permitted. Honored per the project's standing commitment. Revisit only on affirmative reply reversing the decision. Operator-binding: forks must also honor. 3B- prefix.                             |
| Micronesia (FSM)                          | No dedicated CAA web presence verified; V6- prefix; likely under PASO arrangement.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Monaco                                    | No own register; aviation under DGAC France 3A- (DGAC France already in flight).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Myanmar (DCA Myanmar)                     | Post-coup OFAC exposure; junta posture; active conflict. XY- prefix.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Nauru                                     | C2- prefix; no dedicated CAA; aircraft activity covered under PASO.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Niger (ANAC Niger)                        | 2023 coup; sanctions-watch posture; defer until government stabilizes. 5U- prefix.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Niue                                      | E6- prefix; New Zealand-associated state; no separate register found.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| North Korea (GACA DPRK)                   | OFAC blanket; do not contact. P- prefix.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Palau                                     | T8A- prefix; aviation under Bureau of Aviation Palau / Ministry of Public Infrastructure; no separate public register found. PASO arrangement.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Samoa                                     | 5W- prefix; Ministry of Works, Transport and Infrastructure handles aviation but no separate register page found. PASO arrangement.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Sudan (CAA Sudan)                         | Active civil war; aviation infrastructure non-functioning. ST- prefix.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Sweden (Transportstyrelsen)**           | **❗ Excluded by explicit agency request 2026-05-11** — first formal denial received during the metal-birds-feed permission outreach. Verbatim: "The Swedish Transport Agency prefers not to be a part of this project. Kindly exclude Sweden from the project." Honored per the project's standing commitment to remove or modify data on request. Revisit only on affirmative reply reversing the decision (no automatic re-contact). Operator-binding: forks must also honor.                                                                                                                                |
| Syria (SyCAA)                             | OFAC blanket sanctions. YK- prefix.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Timor-Leste                               | ANATL is air-navigation-service only; no separate civil aircraft register authority confirmed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Tonga                                     | A3- prefix; no dedicated CAA web presence; PASO arrangement.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Türkiye (SHGM)**                        | **❗ Excluded by explicit agency request 2026-05-11** — second formal denial received. Reply from Fatma Reyyan AYYILDIZ (Aviation Expert, Flight Operations Department) on behalf of Mr. Bülent Göral: "After consulting, we have decided that it would be more appropriate not to redistribute our data and, consequently, to exclude us from the project." Honored per the project's standing commitment. Revisit only on affirmative reply reversing the decision (no automatic re-contact). Operator-binding: forks must also honor. TC- prefix.                                                            |
| Tuvalu                                    | T2- prefix; no dedicated CAA; PASO arrangement.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Vatican                                   | HV- prefix historic; no civil aviation activity.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Venezuela (INAC)                          | OFAC sectoral sanctions; defer pending sectoral carve-out review. YV- prefix.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Yemen (CAMA)                              | Active conflict; aviation infrastructure non-functioning. 7O- prefix.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| UK CAA (G-INFO)                           | Paid + single-PC + no-redistribute. Verified verbatim. Revisit only if terms change.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Russia (Rosaviatsia)                      | US sanctions exposure for a US-person operator. Engaging Russian state agencies — even for permission — carries OFAC compliance risk. Revisit only if sanctions situation eases.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| China (CAAC)                              | Register page is IE-only (Microsoft Internet Explorer, deprecated June 2022) — cannot verify or scrape with any modern browser. Plus geopolitical exposure as a US-based project. Revisit when either changes.                                                                                                                                                                                                                                                                                                                                                                                                  |
| Egypt (ECAA)                              | Law 93/2003 (Egyptian Civil Aviation Law) framework was reviewed in prior triage. Pending verbatim statutory citation — flag for re-verification before any ingest. SU- prefix. Same acronym collision as Ethiopia ECAA.                                                                                                                                                                                                                                                                                                                                                                                        |
| Cayman Islands (CAA Cayman)               | Commercial offshore registry — paid SaaS-style registration product for foreign aircraft owners. Bulk data redistribution not part of their business model.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Isle of Man (IOM Aircraft Registry)       | Commercial offshore registry — M-prefix on every Gulfstream that ever lived. Paid registration product.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Guernsey (2-REG)                          | Commercial offshore registry, explicitly branded "2-REG." Subscription product.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Jersey (Jersey Aircraft Registry)         | Crown dependency offshore registry — same commercial template as Guernsey at lower volume.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Turks & Caicos (TCI CAA)                  | Caribbean offshore registry, same commercial pattern.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Germany (LBA)                             | Luftfahrzeugrolle is **statutorily non-public** under German data protection law. LBA states the register "is neither published nor freely accessible." Data only released per-record on proof of legal claim. No permission email is meaningful — they cannot grant what the law forbids them from publishing. Revisit only if German privacy law reclassifies.                                                                                                                                                                                                                                                |
| Ghana (GCAA Ghana)                        | Register is electronic but password-only access per GCAA Flight Standards Part 4; no public register surface. Same exclusion pattern as Germany LBA (statutorily non-public). **Acronym collision with Georgia GCAA** — Georgia GCAA is in flight in this project as `ge-gcaa`, do not conflate. 9G- prefix. Revisit if GCAA Ghana publishes the register under an explicit open license.                                                                                                                                                                                                                       |
| Israel (CAAI)                             | Per-aircraft fee + registrar consent for individual lookups. Bulk access requires Freedom of Information request to the Ministry of Transportation's FOI Commissioner under Law 5758-1998 — FOI grants one-off copies under conditions, not ongoing redistribution rights. No bulk-redistribution channel exists. Same structural exclusion as Germany. Revisit only if Israel publishes the register under an open license on data.gov.il.                                                                                                                                                                     |
| Japan (JCAB / MLIT)                       | Verified 2026-05-10 — ¥970/aircraft (~$6 USD) for per-record consultation of 航空機登録原簿; procedure explicitly reserves the right to decline bulk requests (_"大量の閲覧請求はお受けできない場合があります"_); photography-only on-site review, no copies allowed. MLIT publishes aggregate count XLSX only; per-tail register absent from data.go.jp and e-Gov data portal. Same exclusion pattern as Germany LBA + Israel CAAI + Romania AACR. Revisit only if MLIT publishes the per-tail register on data.go.jp under an explicit open license, or 航空法 Art. 8-2 is amended to provide a bulk channel. |
| Kenya (KCAA)                              | Per-aircraft register extract on formal request + fee; no bulk channel exists. Same exclusion pattern as Israel CAAI + Romania AACR + Japan JCAB + UK G-INFO. 5Y- prefix. Revisit if KCAA establishes a bulk-redistribution channel or publishes the register under an open license on a Kenyan open-data portal.                                                                                                                                                                                                                                                                                               |
| Romania (AACR)                            | Verified 2026-05-10 — €45/aircraft + VAT for register information per RACR IA art. 6.7 (~€11k+ for ~200 aircraft). No bulk channel. Register page also CAPTCHA-walled. Same exclusion criteria as UK G-INFO + Israel CAAI. Revisit only if AACR publishes RUIAC on data.gov.ro under an open license.                                                                                                                                                                                                                                                                                                           |
| Rwanda (RCAA)                             | Register "maintained on premises" per RCAR Part 2; no public bulk channel. Same exclusion pattern as Japan JCAB / Bahrain BCAA (appointment-only). 9XR- prefix. Revisit if RCAA publishes the register under an explicit open license or establishes a bulk-redistribution channel.                                                                                                                                                                                                                                                                                                                             |

Also fits this pattern but not currently tracked (not on avcodes list, would need separate research): **Bermuda (VP-B, BCAA)**, **San Marino (T7-, CAA San Marino)**. Don't pursue. (Aruba now explicitly listed above in the Excluded table.)

### 🔍 Deferred — contact path unresolved

These agencies were researched 2026-05-11 but the contact path could not be verified from the US sandbox. Most need a VPN-based recheck or headless-browser pass before they can be triaged into In flight / Excluded. Park them here so they don't get lost.

| Country          | Agency / Prefix               | Reason                                                                                                                                                                                                                                                                                                                                      | Recheck condition                                                                                                                                                                                                      |
| ---------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brunei           | DCA Brunei (V8-)              | Subagent fabricated `civil-aviation.gov.bn` (NXDOMAIN). Real domains `dca.gov.bn` (103.4.188.110) and `mincom.gov.bn` (103.4.188.86) resolve but serve no public content — user-verified via Brunei VPN 2026-05-11: both pages do not load with usable content. **Not geo-block, not DNS-fail — Brunei DCA has no published web presence.** | Recheck if DCA Brunei publishes a public web property, OR if an alternative contact surfaces via third-party (ATC Network, ICAO state letter directory, CAPA). No further sandbox/VPN probing needed — confirmed thin. |
| Kiribati         | MCIA Kiribati (T3-)           | Site live but no email surfaceable on landing or /forms/contact pages                                                                                                                                                                                                                                                                       | Recheck if site adds contact info or PASO routes                                                                                                                                                                       |
| Mali             | ANAC Mali (TZ-)               | anac-mali.org contact page returns 114 B (likely error); WebSearch surfaced only phone                                                                                                                                                                                                                                                      | Recheck if site contact page populates                                                                                                                                                                                 |
| Marshall Islands | (no dedicated CAA found, V7-) | Subagent could not verify a separate civil aircraft register authority; likely under Ministry/maritime registry arrangement                                                                                                                                                                                                                 | Recheck if RMI establishes separate aircraft CAA                                                                                                                                                                       |
| Solomon Islands  | CAASI (H4-)                   | Site live but no email surfaceable from landing, /aboutus, or executive-contact pages                                                                                                                                                                                                                                                       | Recheck if site adds email or PASO routes                                                                                                                                                                              |
| Somalia          | SCAA (6O-)                    | Current scaa.gov.so contact page 2 KB (empty); 2014 FAA document references stale SCAMA addresses on different domain                                                                                                                                                                                                                       | Recheck if scaa.gov.so populates contact                                                                                                                                                                               |

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

| Country | Agency | Register URL | Language |
| ------- | ------ | ------------ | -------- |

### Germanic / Nordic (German / Dutch / Danish / Swedish / Norwegian / Finnish)

> Note: Phase 2 English-only batch sent 2026-05-05 covered Switzerland, Sweden, Norway, Austria, Belgium, Denmark, Finland, and Suriname. Switzerland is now Cleared (Open, bilateral grant 2026-05-22); Sweden and Austria are Excluded (per agency request 2026-05-11 and 2026-06-09 respectively); the rest sit in the **In flight** section above. No agencies remain deferred in this group.

### Slavic / Eastern European

> Note: Russia (Rosaviatsia) was moved to the **Excluded** section above (sanctions exposure).

| Country | Agency         | Register URL                                                                                                                               | Language |
| ------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Estonia | Transpordiamet | [transpordiamet.ee](https://transpordiamet.ee/ohusoidukite-register) **(✅ Cleared 2026-05-13, Personal-use — see Cleared section above)** | Estonian |

### CJK / East Asian

> Note: China (CAAC) and Japan (JCAB / MLIT) were moved to the **Excluded** section above — China for IE-only register page + geopolitical exposure, Japan for ¥970/aircraft fee + explicit refusal-of-bulk clause + no-copy on-site review (same exclusion pattern as Germany LBA, Israel CAAI, Romania AACR). Taiwan, Korea, and Indonesia were emailed in English on 2026-05-05 and now sit in the **In flight** section above.

| Country | Agency | Register URL | Language |
| ------- | ------ | ------------ | -------- |

### Caucasus / Central Asia

> Note: Georgia (GCAA) was emailed in English on 2026-05-05 per the English-first strategy (R3.1 research already done — register is an HTML scrape at gcaa.ge/civil-aircraft-register/, ~63 aircraft). Now sits in **In flight** above. Armenia and Kyrgyzstan remain deferred.

| Country | Agency | Register URL | Language |
| ------- | ------ | ------------ | -------- |

### Middle East

> Note: Lebanon (DGCA Lebanon) was emailed in English on 2026-05-10 and now sits in the **In flight** section above. No agencies remain deferred in this group.

---

## Phase 3 — beyond avcodes (initial recon)

The avcodes.co.uk list (~86 entries) is not exhaustive of world civil aviation authorities. This section captures agencies with national aircraft registers that are NOT on avcodes but exist and operate registers. Initial Pass 1 recon completed 2026-05-10 — agency confirmed, register URL surfaced where possible, license posture indicator noted. Most land in **Unknown** and need a permission email (Pass 2 + send).

**Auto-deferred — sanctions / active conflict exposure (no research):**

> Sanctions audit completed 2026-05-11 — these entries now have full Excluded entries (with rationale + revisit condition) in the Excluded table above and in `DATA_LICENSES.md`. Afghanistan ACAA and Niger ANAC added in the 2026-05-11 audit. The table below is retained for navigation only.

| Country               | Reason                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------- |
| Afghanistan           | Taliban-era authority; OFAC restrictions; no contact (added 2026-05-11)                  |
| Belarus               | OFAC/EU sanctions; same posture as Russia                                                |
| Venezuela             | OFAC sectoral sanctions; defer pending sectoral aviation carve-out review                |
| Cuba (IACC)           | OFAC blanket; same posture as Russia                                                     |
| Iran (CAO.IR)         | OFAC blanket sanctions                                                                   |
| Syria (SyCAA)         | OFAC blanket sanctions                                                                   |
| North Korea           | OFAC blanket sanctions                                                                   |
| Yemen (CAMA)          | Active conflict; aviation infrastructure non-functioning                                 |
| Sudan (CAA Sudan)     | Active conflict                                                                          |
| Libya (LCAA)          | Sectoral sanctions + fragmented governance                                               |
| Iraq (ICAA)           | Conflict-recovery posture; defer                                                         |
| Myanmar (DCA Myanmar) | Active conflict + post-coup sanctions exposure                                           |
| Niger                 | 2023 coup; sanctions-watch posture; defer until government stabilizes (added 2026-05-11) |

### Europe (avcodes-gap)

> All 5 Europe-gap agencies (Albania, Greece, Poland, Portugal, Slovenia) emailed in English 2026-05-10 and graduated to the **In flight** section above. No agencies remain in this group. Belarus excluded (sanctions).

### Latin America (avcodes-gap)

> All 9 LatAm-gap agencies (Bolivia, Costa Rica, Ecuador, El Salvador, Honduras, Nicaragua, Panama, Paraguay, Peru) emailed in English 2026-05-10 with verified contacts and graduated to the **In flight** section above. No agencies remain in this group. Cuba + Venezuela excluded (sanctions).

### MENA (avcodes-gap)

> All 10 MENA-gap agencies processed 2026-05-11. Nine emailed (Algeria, Bahrain, Kuwait, Morocco, Oman, Qatar, Saudi Arabia, Tunisia, UAE) — see In flight section above. Egypt excluded — see Excluded section.

### Africa (avcodes-gap)

> All 15 Africa-gap agencies processed 2026-05-11. Twelve emailed (Angola, Cameroon, Côte d'Ivoire, DRC, Madagascar, Mauritius, Nigeria, Senegal, South Africa, Uganda, Zambia, Zimbabwe). Mauritius was subsequently Excluded by agency reply 2026-06-08 ("for viewing only"); the remaining eleven sit in In flight. Three excluded at recon (Ghana, Kenya, Rwanda) — see Excluded section.

### Asia (avcodes-gap)

> All 7 Asia-gap agencies processed 2026-05-11. Seven emailed (Bangladesh, Bhutan, Cambodia, Laos, Nepal, Philippines, Vietnam) — see In flight section above. No exclusions, no deferrals.

### Phase 3 follow-up priorities

Ranked by license-posture promise:

1. **Saudi GACA** — Conditional Open framework cleared verbatim 2026-05-11 (GACA Data Usage Policy: attribution + use-conduct restrictions; no NC/no-redistribute bar). Register dataset not yet on Open Data Library (airports-traffic-only); v3 sent 2026-05-11 as dataset-publication request.
2. **Oman CAA** — Open Data Use License (CC BY 4.0-compatible per Clause 6.2) cleared verbatim 2026-05-11. Register dataset not yet on portal (airport-traffic-only); v2 sent 2026-05-11 as dataset-publication request; license-extension scope or portal publication awaiting reply.
3. **UAE GCAA** — open-data portal presence (FCSC). Register-specific dataset not yet visible; only "Accepted Aircraft Models" type approvals published. v2 sent 2026-05-11 direct to customercare@gcaa.gov.ae after VPN-based verification.
4. **Ecuador DGAC** — has an organization page on datosabiertos.gob.ec. Pass 2 should confirm whether the register is one of their datasets.
5. **Bolivia DGAC** — "Registro Público de Aeronaves" framing leans Open.
6. ~~**Mauritius DCA** — statutorily-public mortgage register is a strong civil-law carve-out signal.~~ Excluded by agency reply 2026-06-08 ("for viewing only"); the mortgage register angle did not survive the substantive reply.

**Likely-Excluded candidates** (Pass 2 must confirm before final classification):

- **Kenya KCAA** — fee-gated per-record extract; bulk channel not surfaced. Pattern matches Israel/Romania/Japan.
- **Ghana GCAA** — password-walled electronic register access per GCAA Flight Standards Part 4.

**Everything else** is Unknown and needs the standard permission-email workflow once Pass 2 confirms the register URL and contact path.

---

## Recommended order of attack

> **Phase 4 long-tail status (2026-05-11):** 17 new in-flight entries added in the long-tail batch (Benin, Burkina Faso, Cook Islands, ECCAA regional, Eswatini, Guyana, Hong Kong, Kazakhstan, Kosovo, Liberia, Mauritania, PASO regional, São Tomé, Sierra Leone, South Sudan, Türkiye, Turkmenistan). ~26 Excluded entries added (no-agency / commercial-offshore / sanctions audit including new Afghanistan + Niger). 8 entries Deferred for VPN-round (Brunei, Kiribati, Mali, Marshall Islands, Solomon Islands, Somalia, Tajikistan, Uzbekistan) — see Deferred section above.

1. **Phase 1 quick wins:** Iceland, Trinidad & Tobago, Cyprus — most likely Open or simple-email cases. Knock these out one afternoon. (Israel and Singapore were previously listed here; both moved out — Israel to **Excluded** after CAAI register confirmed fee-gated + FOI-only, Singapore to "known-difficult" after CAAS Terms of Use confirmed Personal-use.)
2. **Phase 1 known-difficult:** India, Pakistan, Sri Lanka, Maldives, Ethiopia, Malaysia — verify, send emails, expect mixed responses.
3. **Phase 2 (non-English registries):** send English to all of them per the agreed strategy. Tier by fleet size or bandwidth — eight largest were sent 2026-05-05 (Brazil, France, Italy, Spain, Argentina, Switzerland, Sweden, Norway). Next likely batch: Germany (LBA), Japan (JCAB), Mexico (AFAC), Indonesia (DKPPU), Korea (KOCA), Taiwan (CAA Taiwan), Belgium (DGTA), Austria (Austro Control), Denmark (TS), Finland (Traficom).
4. **Translator follow-up only** when an agency replies in their local language with substantive license terms, or when no English reply arrives and a follow-up in the local language is warranted.

## Notes for whoever runs this

- The "Likely Open / Likely needs email" hints in Phase 1 are heuristics, not facts. Always verify before assuming.
- Save evidence: when verifying a license, screenshot or copy the relevant page text into the agency's `DATA_LICENSES.md` entry. Site terms move; receipts are durable.
- Re-verify each existing source annually. Government policies change quietly.
- Any reply to a permission email goes verbatim into `DATA_LICENSES.md` — never paraphrase agency replies, since attribution conditions may need to be quoted exactly.
