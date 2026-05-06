# Aircraft Register License Matrix

Per-agency license posture and whether an email confirmation is required before metal-birds-feed can republish their data.

Last researched: 2026-05-05. Re-verify before each phase ships and at least annually thereafter — government policies change.

## Summary table

| Country        | Agency           | Register URL                                                                                                              | Format                                                                                                          | Classification             | License                                                                                             | Email needed?      | Contact                                                                       |
| -------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------- |
| United States  | FAA              | [registry.faa.gov](https://registry.faa.gov/aircraftinquiry/)                                                             | ZIP of fixed-width text files (MASTER, ACFTREF, ENGINE, DEREG)                                                  | Open                       | US federal government work, public domain by 17 USC §105                                            | **No**             | n/a                                                                           |
| Canada         | Transport Canada | [tc.canada.ca](https://www.tc.gc.ca/en/services/aviation/aircraft-services/canadian-civil-aircraft-register.html)         | ZIP — `carscurr.txt` + `carsownr.txt` + layout                                                                  | Open (with conditions)     | Government of Canada Open Data Licence Agreement for Unrestricted Use of Canada's Data (click-wrap) | **No**             | n/a                                                                           |
| Netherlands    | ILT              | [ilent.nl register data](https://www.ilent.nl/documenten/lijsten/luchtvaart/databestanden/luchtvaartregister-data)        | OpenDocument Spreadsheet (`.ods`), date-stamped filename                                                        | Open                       | CC-0 1.0 Universal (public domain) per data.overheid.nl                                             | **No**             | n/a                                                                           |
| Australia      | CASA             | [casa.gov.au data files](https://www.casa.gov.au/aircraft/aircraft-registration/data-files-registered-aircraft)           | CSV / ZIP — bulk and lookup both inherit site-wide license                                                      | Open                       | CC BY 4.0 (explicit on the casa.gov.au copyright page)                                              | **No**             | n/a                                                                           |
| United Kingdom | UK CAA (G-INFO)  | [caa.co.uk/g-info](https://www.caa.co.uk/aircraft-register/g-info/)                                                       | Excel — paid product (£450 single, £745/yr quarterly, £1,745/yr monthly)                                        | **Restrictive — excluded** | Single-PC license, no copying, no distribution, no sale, no hire without written CAA consent        | **N/A — excluded** | n/a                                                                           |
| New Zealand    | CAA NZ           | [aviation.govt.nz register search](https://www.aviation.govt.nz/aircraft/aircraft-registration/aircraft-register-search/) | [Direct CSV](https://www.aviation.govt.nz/assets/aircraft/aircraft-register/Aircraft-Register-for-website-.csv) | Personal-use               | "Personal use without permission" only — any other use requires explicit permission                 | **Yes**            | info@caa.govt.nz (general), aircraftregistrar@caa.govt.nz (register-specific) |
| Ireland        | IAA              | [iaa.mysrs.ie](https://iaa.mysrs.ie/) (since Oct 2025; web-hosted register retired)                                       | Bulk download via MySRS portal — sign-up required, T&Cs behind login                                            | Unknown                    | No public license statement; portal T&Cs unreviewable without account                               | **Yes**            | registration@iaa.ie                                                           |
| Georgia        | GCAA             | [gcaa.ge register](https://gcaa.ge/civil-aircraft-register/)                                                              | HTML table only (~63 aircraft)                                                                                  | Unknown                    | None stated; OGP member, proactive disclosure under General Administrative Code ch. 3               | **Yes**            | office@gcaa.ge (Georgian translation required)                                |

## Detail by agency

### United States — FAA

US federal government works are public domain by statute (17 USC §105). The FAA publishes the Aircraft Registry as a free bulk download (MASTER + ACFTREF + ENGINE + DEREG) updated monthly. No license required for redistribution. Attribution is recommended courtesy, not legally required.

Action: comply with attribution norm in `DATA_LICENSES.md`. No email.

### Canada — Transport Canada

Civil Aircraft Register published under the **Government of Canada Open Data Licence Agreement for Unrestricted Use of Canada's Data** (not OGL-Canada — which is a separate, simpler license used elsewhere on open.canada.ca). The license is click-wrap: by downloading the data, the operator acknowledges acceptance of the full terms.

The substantive grant is broad — royalty-free, worldwide, modification and sublicensing allowed, Value-Added Products explicitly contemplated. Classification stays **Open**, but the license carries several procedural conditions that pure OGL- or CC-BY-style licenses do not, and they need to be complied with explicitly:

- Verbatim reproduction notice required (§4.1): _"Reproduced and distributed with the permission of the Government of Canada."_
- Verbatim Value-Added Product notice required (§4.2) naming the producer and disclaiming endorsement.
- No use of Canada's name, crest, logos, flags, or domain names in promotion (§4.3).
- No merging with other databases for the purpose of identifying individuals or businesses (§3.1.d).
- No reverse-engineering of the data (§3.1.d).
- Indemnification obligation (§6.3); no warranty (§6.1); no recourse (§6.2).
- Auto-termination on breach (§7.2). Governed by Ontario / federal Canadian law (§8.1).

Full verbatim conditions and the project's compliance posture live in `DATA_LICENSES.md`. The PII drop at ingest (street, city, postal-code, care-of fields not stored) directly satisfies §3.1.d's no-identity-merge clause.

Action: include both verbatim notices and the full condition list in `DATA_LICENSES.md`. No email.

### Netherlands — ILT

CC-0 1.0 Universal (public domain) per data.overheid.nl. The on-page disclaimer _"Aan deze gegevens kunnen geen rechten worden ontleend"_ is a quality-of-data disclaimer, not a license restriction — CC-0 stands. Attribution not legally required; credited as a courtesy.

Action: include CC-0 acknowledgment in `DATA_LICENSES.md`. No email. Note: aviation certification services moved from Kiwa to CAA NL in June 2025; register publication remains with ILT for now.

### Australia — CASA

Researched 2026-05-05. Both surfaces — bulk download (`acrftreg.csv` / `acrftreg.zip` at services.casa.gov.au) and the search interface (casa.gov.au/search-centre/aircraft-register) — fall under the **site-wide CC BY 4.0** declared at https://www.casa.gov.au/about-us/about-website/copyright, which states verbatim:

> We own all the material we produce. With the exceptions noted below, we provide all material on this website under a Creative Commons Attribution 4.0 International Licence. This licence (the CC BY 4.0 Licence) allows you to share and adapt content for any purpose.

Excluded items: Commonwealth Coat of Arms, CASA logo, third-party content, and material specifically marked otherwise. The aircraft register data files page carries no opt-out marker, so the default applies.

**Note on the BY-NC variant:** Some CASA standalone PDFs (flight-crew licensing manuals, certain technical guides) declare CC BY-NC 4.0 in their document footers. That is per-document and **does not extend** to the aircraft register data files. Do not conflate the two surfaces.

Conditions to comply with:

- Attribute to "Civil Aviation Safety Authority" (without implying endorsement).
- Provide a link to the [CC BY 4.0 license](https://creativecommons.org/licenses/by/4.0/).
- Indicate if the material has been changed.

Action: include CASA attribution and CC BY 4.0 link in `DATA_LICENSES.md`. Engine output is normalized → counts as "changed material" under CC BY 4.0. **No email.**

### United Kingdom — UK CAA (G-INFO) — EXCLUDED

Verified 2026-05-05 directly from caa.co.uk/aircraft-register/g-info/g-info-forms-and-fees/. Both surfaces are restrictive in different ways. Neither helps the project.

**Bulk product (G-INFO MS Excel file):** paid commercial product, single-PC license, explicit no-redistribute clause. Verbatim from the CAA's G-INFO Forms and Fees page:

> Copyright and Database right in the Database (and the format of the data) are vested in the CAA and it shall not be copied or distributed, sold or hired out or otherwise dealt with, without the written consent of the CAA. All rights reserved.
>
> The Database is authorised for use on a single PC only. If you intend to use the Database on more than one PC, or to network the data, contact the Aircraft Registration Section in order to obtain the appropriate licences.

Current pricing (inc. VAT, 2026):

| Product                                        | Inc. VAT  |
| ---------------------------------------------- | --------- |
| Single issue, MS Excel                         | £450.00   |
| 4 quarterly issues                             | £745.00   |
| 12 monthly issues                              | £1,745.00 |
| 12 monthly issues, printed CHANGES report only | £500.00   |
| Additional licence                             | £65.00    |
| Corporate licence (unlimited users)            | £1,855.00 |

The single-PC clause is incompatible with R2 storage even for purely operator-private use; the no-redistribute clause is incompatible with source-available code that another fork might run.

**Free web search interface (caa.co.uk/aircraft-register/g-info/search-g-info/):** also restrictive. Per the CAA's general copyright statement at caa.co.uk/about-us/information-requests/copyright-information/: _"The Civil Aviation Authority owns the copyright of the information featured on its website, and you may download information and publications for use within your company or organisation or for personal use but may not reproduce them for publication."_ Personal/internal use only, no reproduction for publication, no redistribution. Also produces no bulk export anyway.

**OGL does not apply.** UK CAA's aircraft register is explicitly outside the Open Government Licence regime — Crown copyright + database right are retained, not waived.

Under PRD CC.1, this is **Restrictive** and **excluded** from the project.

Action: **excluded.** Revisit only if CAA changes terms — e.g., re-releases G-INFO under OGL-UK or any other redistributable license. Check at most annually; a policy shift this material would be announced and findable.

### New Zealand — CAA NZ

The aviation.govt.nz copyright page states verbatim:

> Unless otherwise stated, the information available on or through this website is protected by copyright and subject to the copyright laws of New Zealand. Such information may be reproduced for personal use without permission, subject to the material being reproduced accurately and not being used in a misleading context. In all cases, the CAA must be acknowledged as the source.
>
> For permission to reproduce information on this website for any purpose other than personal use, please contact the CAA by emailing info@caa.govt.nz.

Classic "personal use only without permission" license. metal-birds-feed redistributing the register is not personal use. **Email required.**

The register is downloadable as CSV: https://www.aviation.govt.nz/assets/aircraft/aircraft-register/Aircraft-Register-for-website-.csv (last seen updated 2026-04-10).

**Important — the 30-day silence fallback does NOT apply to CAA NZ.** It is Personal-use classification, where the agency has made an explicit license claim that excludes redistribution. Silence from a Personal-use source is not implicit permission. If no reply, follow up at 30 days, then either further patience or drop.

Action: send the agency-permission template to info@caa.govt.nz, copying aircraftregistrar@caa.govt.nz. English; no translation needed.

### Ireland — IAA

As of October 2025, the IAA retired the web-hosted aircraft register and moved everything into the **MySRS** portal (iaa.mysrs.ie). The register is downloadable from MySRS but the portal requires sign-up, and the Terms & Conditions are not visible without an account.

Two unknowns we can't resolve via automated web research:

1. Whether bulk download is technically permitted by MySRS T&Cs (versus account-bound individual access).
2. Whether automated access (a GHA workflow logging in monthly) violates the T&Cs.

The IAA's main website also has no Creative Commons or OGL-equivalent license statement.

**The 30-day silence fallback applies after follow-up.** IAA is Unknown classification (no public license statement; portal-gated terms). Public-record argument is at least arguable — aviation registration is statutorily public under EU/Irish law and ICAO Annex 7.

Action: send the agency-permission template to registration@iaa.ie. English; no translation needed. The email explicitly asks:

- Whether bulk download of the register from MySRS is permitted for redistribution.
- Whether an authorized programmatic-access mechanism exists (API, automated download path).
- Preferred attribution text.
- Any other restrictions.

If they decline or require a paid commercial license, drop Ireland.

### Georgia — GCAA

No license statement; OGP member; Georgia's General Administrative Code ch. 3 mandates proactive disclosure of public information; aviation registration is public record under ICAO Annex 7. Email to be sent to office@gcaa.ge in Georgian translation.

**The 30-day silence fallback applies.** GCAA is Unknown classification, public-record argument is strong (no explicit restriction + statutory disclosure obligation).

## Permission protocol — when silence means yes vs. no

Per `DATA_LICENSES.md` (PRD CC.2), the 30-day silence fallback is **classification-dependent**:

- **Open** classification → no email needed; comply with the stated open license.
- **Personal-use** classification → email required; **silence is not permission** (the agency already said no by default). Follow up at 30 days, then patience or drop.
- **Unknown** classification → email required; silence after 30 days falls to public-record argument, with prominent attribution and a documented decision date. Any later removal request honored immediately.
- **Restrictive** classification → excluded; do not slot.

## Pattern

**No email needed (Open):** US public domain (FAA), Canada OGL (TC), Netherlands CC-0 (ILT), Australia CC BY 4.0 (CASA). Four clean wins.

**Email needed (Personal-use):** New Zealand CAA — explicit "must ask" rule, silence ≠ permission.

**Email needed (Unknown):** Ireland IAA, Georgia GCAA — no public license, silence falls to public-record argument after 30 days.

**Excluded (Restrictive):** UK CAA G-INFO — paid + single-PC + no-redistribute.

## Likely future research targets

Ranked by expected effort. **None of these are confirmed; verify each before assuming.**

- **Probably easy** (Anglosphere/Crown defaults likely OGL-style): Singapore CAAS, Hong Kong CAD, Jamaica JCAA, South Africa SACAA. Verify via each agency's website copyright page before adding.
- **Probably email needed**: most EU member states (national variations on the PSI Directive — some adopt CC BY 4.0, others retain national copyright with personal-use carve-outs), most non-Anglosphere registries.
- **Probably excluded** (commercial / offshore registry pattern): Cayman Islands, Isle of Man, Guernsey (2-REG), Turks & Caicos, Jersey, Bermuda, Aruba, San Marino. Don't waste an email; expect "no" or "yes for [significant fee]."

## Re-verification cadence

Re-check each agency's license/terms page **annually** at minimum, and immediately before adding any new source. Government policies move. Document the verified-on date in `DATA_LICENSES.md` per source.
