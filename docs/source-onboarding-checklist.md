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

| Source | License | How handled |
|---|---|---|
| FAA | US public domain | Live (phase 1) |
| Transport Canada | GC Open Data Licence Agreement (verbatim notices) | Live (phase 2) |
| ILT (Netherlands) | CC-0 | Live (phase 3) |
| CASA (Australia) | CC BY 4.0 | Verified, no email needed |

### 🟡 In flight — waiting on reply

| Source | Sent | Follow-up | Fallback applies? |
|---|---|---|---|
| CAA NZ | 2026-05-05 | 2026-06-04 | **No** (Personal-use; silence ≠ permission) |
| IAA Ireland | 2026-05-05 | 2026-06-04 | **Yes** (Unknown; public-record fallback after follow-up) |

### ❌ Excluded — do not pursue

| Source | Reason |
|---|---|
| UK CAA (G-INFO) | Paid + single-PC + no-redistribute. Verified verbatim. Revisit only if terms change. |

### 🤷 Non-English (deferred until translator available for the relevant language)

Triage these one language at a time, only when there's a confirmed translator. Email body translates from the same template. See "Deferred — non-English" section at the bottom of this file for the full list grouped by language family.

---

## Phase 1 — English-language quick wins (license-clean candidates)

These countries have English as an official or working administrative language and likely have OGL-style or CC BY-style defaults given their Crown / Anglosphere lineage. **Verify the license first; many will require no email.**

For each: open the agency homepage in the browser, find the footer "Copyright" or "Terms" link, classify, and decide.

- [ ] **Singapore** — CAAS — register at [caas.gov.sg](https://www.caas.gov.sg/operations-safety/aircraft/certificate-of-registration). Singapore government data is often under [Singapore Open Data License](https://data.gov.sg/open-data-licence). Look for explicit license declaration on the page or in the site footer. **Likely Open.**
- [ ] **Jamaica** — JCAA — register at [jcaa.gov.jm](https://www.jcaa.gov.jm/index.php/regulatory-affairs/safety-and-security-oversight/aircraft-registry/). Verify footer terms. **Likely needs email.**
- [ ] **Trinidad & Tobago** — TTCAA — register at [caa.gov.tt](https://caa.gov.tt/aircraft-on-ttcaa-register/). Verify footer. **Likely needs email.**
- [ ] **Bahamas** — BCAA — register at [caabahamas.com/registers](https://caabahamas.com/registers/). PDF format only — verify terms. **Likely needs email.**
- [ ] **Belize** — BDCA — register at [civilaviation.gov.bz](https://www.civilaviation.gov.bz/index.php/bdca-civil-aircraft-register). Verify. **Likely needs email.**
- [ ] **Fiji** — CAAF — register at [caaf.org.fj](https://www.caaf.org.fj/aircraft-register-search/). Verify. **Likely needs email.**
- [ ] **Papua New Guinea** — CASA PNG — register at [casapng.gov.pg](https://casapng.gov.pg/safety-regulatory/airworthiness/Aircraft-Registers/). Verify. **Likely needs email.**
- [ ] **Botswana** — CAAB — register at [caab.co.bw](https://www.caab.co.bw/caab-content.php?cid=299). Verify. **Likely needs email.**
- [ ] **Tanzania** — TCAA — register at [tcaa.go.tz](https://www.tcaa.go.tz/page?p=Aircraft+Registration). Verify. **Likely needs email.**
- [ ] **Seychelles** — SCAA — register at [scaa.sc](https://www.scaa.sc/index.php/regulatory/e-registers/aircraft-civil-register). Verify. **Likely needs email.**
- [ ] **Malta** — CAD Malta — register at [transport.gov.mt](https://www.transport.gov.mt/aviation/aircraft-flight-standards/registration-of-aircraft-2663). EU member, Maltese / English co-official. Check Malta's open-data policy. **Could be either.**
- [ ] **Iceland** — ICETRA — register at [island.is/en/aircraft-registry](https://island.is/en/aircraft-registry). Icelandic primary; English website fine. Check Iceland's open data policy (most Nordic data is open). **Likely Open.**

### Phase 1 — known-difficult English-language

- [ ] **India** — DGCA — register at [dgca.gov.in](https://www.dgca.gov.in/digigov-portal/?page=4000/4022/servicename). DGCA tends toward paid services and bureaucratic restrictions. Verify; expect to email and possibly drop.
- [ ] **Pakistan** — PCAA — register at [apps.caapakistan.com.pk:412](https://apps.caapakistan.com.pk:412/Aircraft/rptArcftRegisterOut.aspx). Verify; expect email.
- [ ] **Sri Lanka** — CAASL — register at [caa.lk](https://www.caa.lk/en/downloads/sl-aircraft-register). Verify; expect email.
- [ ] **Maldives** — CAAM — register at [caa.gov.mv](https://www.caa.gov.mv/operations/registration-of-aircraft-and-mortgages). Verify; expect email.
- [ ] **Ethiopia** — ECAA — register at [ecaa.gov.et](https://www.ecaa.gov.et/home/aircraft-registered-by-the-authority-and-operational-today/). Verify; expect email.
- [ ] **Malaysia** — SKMM/CAAM — register at [skmm.gov.my](https://www.skmm.gov.my/registers/cma/ApparatusAssignment/index.asp). Verify; expect email.

### Phase 1 — borderline (English commonly used, but local language is primary)

- [ ] **Cyprus** — DCA Cyprus — register at [mcw.gov.cy](https://www.mcw.gov.cy/mcw/dca/dca.nsf/DMLregister_en/DMLregister_en?OpenDocument). English co-official. Verify in English first.
- [ ] **Israel** — CAAI — register at [data.gov.il](https://data.gov.il/dataset/aircraft_data_il/resource/bc00ed41-75d0-4d0f-9eca-3cd0a2c332cc). Hosted on Israel's open-data portal — check the dataset's license metadata directly. **Likely Open** if data.gov.il follows standard practice.
- [ ] **Jordan** — CARC — register at [carc.jo](https://www.carc.jo/en/content/344-jordanian-registered-aircraft). Verify in English; CARC has English-language pages.

---

## Phase 2 — skip list (commercial offshore registries)

These are commercial registration services for foreign aircraft owners. Don't waste an email — expected response is "no" or "yes for [significant fee]."

- ❌ **Cayman Islands** — CAA Cayman — [caacayman.com](https://www.caacayman.com)
- ❌ **Isle of Man** — IOM Aircraft Registry — [iomaircraftregistry.com](https://ardis.iomaircraftregistry.com/register/search)
- ❌ **Guernsey** — 2-REG — [2-reg.com](https://www.2-reg.com/legislation/register)
- ❌ **Turks & Caicos** — TCI CAA — [tcicaa.tc](https://tcicaa.tc)
- ❌ **Jersey** — Jersey Aircraft Registry — [gov.je](https://www.gov.je/travel/maritimeaviation/civilaviation/pages/jerseyaircraftregistry.aspx)

Also fits this pattern but not on the avcodes list: **Bermuda (VP-B), Aruba (P4-), San Marino (T7-).** Same reasoning.

---

## Deferred — non-English (need translator)

Group by language. Don't send any of these until a translator is confirmed for that language family. Verification of license pages also requires translation.

### Romance (French / Spanish / Portuguese / Italian / Romanian)

| Country | Agency | Register URL | Language |
|---|---|---|---|
| Argentina | ANAC | [geo.anac.gob.ar](https://geo.anac.gob.ar/afectacion) | Spanish |
| Brazil | ANAC Brasil | [sistemas.anac.gov.br](https://sistemas.anac.gov.br/aeronaves/cons_rab.asp) | Portuguese |
| Chile | DGAC | [servicios.dgac.gob.cl](https://servicios.dgac.gob.cl/rna-web/publico.html) | Spanish |
| Colombia | UAEAC | [aerocivil.gov.co](https://www.aerocivil.gov.co/consultas-en-linea/matriculas-de-aeronaves/) | Spanish |
| Dominican Republic | IDAC | [idac.gob.do](https://serviciosvirtualestac.idac.gob.do/ConsultaAeronaves/) | Spanish |
| Guatemala | DGAC | [dgac.gob.gt](http://cass.dgac.gob.gt:8080/cass/servlet/consultaaeronaves) | Spanish |
| Uruguay | DINACIA | [dinacia.gub.uy](https://www.dinacia.gub.uy) | Spanish |
| Spain | AESA | [seguridadaerea.gob.es](https://www.seguridadaerea.gob.es/en/ambitos/aeronaves/registro-de-matriculas-de-aeronaves-civiles/registro-de-matriculas) | Spanish |
| Italy | ENAC | [enac.gov.it](https://www.enac.gov.it/sicurezza-aerea/aeronavigabilita-iniziale/omologazione-organizzazioni-di-progettazioni/prodotti/rilascio-certificato-di-navigabilita) | Italian |
| France | DGAC | [immat.aviation-civile.gouv.fr](https://immat.aviation-civile.gouv.fr/immat/servlet/aeronef_liste.html) | French |
| Luxembourg | DAC | [dac.gouvernement.lu](https://dac.gouvernement.lu/fr/administration/departements/navigabilite/immatriculation-aeronefs/releve-immatriculations.html) | French / German |
| Haiti | OFNAC | [registreimm.net](https://registreimm.net/aircraftSearchingView) | French / Haitian Creole |
| Togo | ANAC Togo | [anac-togo.tg](https://www.anac-togo.tg/espace-professionnel/aeronefs/consultation-du-registre-dimmatriculation/) | French |
| Cabo Verde | AAC | [aac.cv](http://www.aac.cv/index.php?option=com_content&task=view&id=25&Itemid=63) | Portuguese |
| Mozambique | IACM | [iacm.gov.mz](https://www.iacm.gov.mz/direccao-de-seguranca-de-voo/) | Portuguese |
| Romania | CAA | [caa.ro](https://formulare.caa.ro/inmatriculari) | Romanian |
| Moldova | CAA | [caa.md](https://www.caa.md/registru-aerian-3-84) | Romanian |

### Germanic / Nordic (German / Dutch / Danish / Swedish / Norwegian / Finnish)

| Country | Agency | Register URL | Language |
|---|---|---|---|
| Austria | Austro Control | [austrocontrol.at](https://www.austrocontrol.at/en/aviation_agency/aircraft/aircraft_register/search_online) | German (English UI exists) |
| Switzerland | BAZL/FOCA | [bazl.admin.ch](https://app02.bazl.admin.ch/web/bazl/en/) | German / French / Italian (English UI) |
| Belgium | DGTA | [es.mobilit.fgov.be](https://es.mobilit.fgov.be/aircraft-registry/main/search?lang=en) | Dutch / French / German (English UI) |
| Suriname | CASAS | [casas.sr](https://www.casas.sr/registry/) | Dutch |
| Denmark | TS Denmark | [trafikstyrelsen.dk](https://selvbetjening.trafikstyrelsen.dk/civilluftfart/Dokumenter/Forms/AllItems.aspx) | Danish (English in practice) |
| Sweden | Transportstyrelsen | [transportstyrelsen.se](https://etjanster-luftfart.transportstyrelsen.se/en-gb/sokluftfartyg) | Swedish (English UI) |
| Norway | Luftfartstilsynet | [luftfartstilsynet.no](https://luftfartstilsynet.no/aktorer/norges-luftfartoyregister/registrerte-luftfartoy/) | Norwegian (English in practice) |
| Finland | Traficom | [trafi.fi](https://asiointi.trafi.fi/en/henkiloasiakkaat/ilmailu/tarkista-ilma-aluksen-tiedot) | Finnish / Swedish (English UI) |

### Slavic / Eastern European

| Country | Agency | Register URL | Language |
|---|---|---|---|
| Russia | Rosaviatsia | [favt.gov.ru](https://favt.gov.ru/opendata/7714549744-gosreestrgvs/) | Russian |
| Ukraine | SAAU | [avia.gov.ua](https://avia.gov.ua/State-Civil-Aircraft-Register-of-Ukraine/) | Ukrainian |
| Bulgaria | CAA | [caa.bg](http://www.caa.bg/bg/category/300/17238) | Bulgarian |
| Czech Republic | CAA CR | [caa.cz](https://lr.caa.cz/letecky-rejstrik?lang=en) | Czech (English UI) |
| Slovakia | NSA Slovakia | [nsat.sk](https://letectvo.nsat.sk/letova-sposobilost/register-lietadiel-slovenskej-republiky/zoznam-registra/) | Slovak |
| Hungary | KKM | [kozlekedesihatosag.kormany.hu](https://www.kozlekedesihatosag.kormany.hu/hu/dokumentum/104604) | Hungarian |
| Croatia | CCAA | [ccaa.hr](https://www.ccaa.hr/en/list-of-registered-aircraft-94674) | Croatian (English UI) |
| Serbia | CAD Serbia | [cad.gov.rs](https://cad.gov.rs/strana/20841/aircraft-registry) | Serbian (English UI) |
| Bosnia & Herzegovina | BHDCA | [bhdca.gov.ba](https://www.bhdca.gov.ba/index.php/en/regulations-and-areas/airworthiness) | Bosnian (English UI) |
| Macedonia | CAA | [caa.gov.mk](https://www.caa.gov.mk/en/safety/airworthiness-and-aircraft-registration/) | Macedonian (English UI) |
| Montenegro | ACG | [caa.me](https://www.caa.me/en/registri) | Montenegrin (English UI) |
| Latvia | CAA | [caa.gov.lv](https://www.caa.gov.lv/lv/gaisa-kugu-registrs) | Latvian |
| Lithuania | TKA | [tka.lt](https://tka.lt/oro-transportas/katalogas/register-of-civil-aircraft-of-the-republic-of-lithuania/?lang=en) | Lithuanian (English UI) |
| Estonia | Transpordiamet | [transpordiamet.ee](https://transpordiamet.ee/ohusoidukite-register) | Estonian |

### CJK / East Asian

| Country | Agency | Register URL | Language |
|---|---|---|---|
| China | CAAC | [219.143.231.89](http://219.143.231.89/shs/ccarretrieval.do?flag=1) | Chinese (Mandarin); IE-only |
| Taiwan | CAA Taiwan | [caa.gov.tw](https://www.caa.gov.tw/article.aspx?a=238&lang=1) | Mandarin (Traditional) |
| Korea | KOCA / MOLIT | [koca.go.kr](https://atis.koca.go.kr/ATIS/aircraft/forwardPage.do) | Korean |
| Macau | AACM | [aacm.gov.mo](https://www.aacm.gov.mo/overview_aircraft.php?pageid=84) | Chinese / Portuguese |
| Mongolia | MCAA | [mcaa.gov.mn](https://www.mcaa.gov.mn/?p=1758) | Mongolian |
| Thailand | CAAT | [caat.or.th](https://www.caat.or.th/en/archives/52215) | Thai (English UI) |
| Indonesia | DKPPU | [imsis-djpu.dephub.go.id](https://imsis-djpu.dephub.go.id/PortalDKPPU/) | Indonesian |

### Caucasus / Central Asia

| Country | Agency | Register URL | Language |
|---|---|---|---|
| Georgia | GCAA | [gcaa.ge](https://gcaa.ge/civil-aircraft-register/) | Georgian (already in v4 spec) |
| Armenia | GDCA | [aviation.am](http://www.aviation.am/registered_aircrafts) | Armenian |
| Kyrgyzstan | CAA | [caa.kg](https://caa.kg/reestr-vs/) | Kyrgyz / Russian |

### Middle East

| Country | Agency | Register URL | Language |
|---|---|---|---|
| Lebanon | DGCA Lebanon | [lebcaa.com](https://www.lebcaa.com/a_r.shtml) | Arabic / French |

---

## Recommended order of attack

1. **Phase 1 quick wins:** Iceland, Singapore, Israel, Jamaica, Trinidad & Tobago, Cyprus — most likely Open or simple-email cases. Knock these out one afternoon.
2. **Phase 1 known-difficult:** India, Pakistan, Sri Lanka, Maldives, Ethiopia, Malaysia — verify, send emails, expect mixed responses.
3. **Skip Phase 2 entirely** unless something specific drives interest.
4. **Defer non-English** until a translator pipeline exists. Realistic batches: Spanish-speaking Latin America (one translator); Germanic/Nordic (English UIs often suffice — verify license pages first); EU member states by accession date.

## Notes for whoever runs this

- The "Likely Open / Likely needs email" hints in Phase 1 are heuristics, not facts. Always verify before assuming.
- Save evidence: when verifying a license, screenshot or copy the relevant page text into the agency's `DATA_LICENSES.md` entry. Site terms move; receipts are durable.
- Re-verify each existing source annually. Government policies change quietly.
- Any reply to a permission email goes verbatim into `DATA_LICENSES.md` — never paraphrase agency replies, since attribution conditions may need to be quoted exactly.
