# Data Licenses

This file documents the license and attribution requirements for each national aviation
registry source used by metal-birds-feed. Update this file whenever a new source is added.

---

## FAA — US Federal Aviation Administration

- **Source URL:** https://registry.faa.gov/aircraftinquiry/Search/NNumberInquiry
- **Bulk download:** Monthly ZIP (MASTER.txt, ACFTREF.txt, ENGINE.txt)
- **License:** US Government work — public domain (17 U.S.C. § 105)
- **Attribution:** Not legally required. This project credits the source in this file.
- **Update cadence:** Monthly

---

## Transport Canada (TC-CA) — v2

- **Bulk download URL:** https://wwwapps.tc.gc.ca/saf-sec-sur/2/ccarcs-riacc/download/ccarcsdb.zip
- **Search interface:** https://wwwapps.tc.gc.ca/saf-sec-sur/2/ccarcs-riacc/RchSimp.aspx
- **Bulk archive:** ZIP containing `carscurr.txt` (current marks + aircraft),
  `carsownr.txt` (owners, joined by mark), and `carslayout.txt` (column layout).
  ASCII (latin1), comma-separated, double-quote delimited. No header row.
- **License:** Open Government Licence — Canada
  (https://open.canada.ca/en/open-government-licence-canada)
- **Attribution required:** Yes. Per OGL-Canada: include the OGL notice and
  acknowledge the source as the Government of Canada.
- **Update cadence:** Monthly (file `Last-Modified` typically the 1st of the month).
- **PII dropped at ingest:** street1/street2/city/postal-code/care-of fields in
  `carsownr.txt` are not mapped or stored. Owner records expose name, kind,
  province (state-equivalent), and country only.
- **Field-coverage gaps vs. canonical schema:** these stay null for TC records —
  `category`, `build_certification`, `operating_environment`, `icao_type_code`,
  `year_manufactured`, `cruise_speed_ktas`, `engine.model`, `engine.horsepower`,
  `engine.thrust_lbs`. `airframe_type` is null for `Aeroplane` rows that lack
  a usable `NUMBER_OF_ENGINES` value.

---

## UK CAA — v3

- **Source URL:** https://www.caa.co.uk/data-and-research/aircraft/g-info/
- **License:** Open Government Licence v3.0 (OGL-UK)
- **Attribution required:** Yes. Per OGL-UK: include the OGL notice and acknowledge
  the Civil Aviation Authority as the source.
- **Update cadence:** Check CAA publication schedule; approximately monthly.

---

## Georgia GCAA — v4

- **Status:** Pending data-source research (R3.1)
- **Source URL:** https://www.gcaa.ge (data accessibility TBD)
- **License:** Unknown — to be determined during R3.1 research milestone.
- **Update cadence:** Unknown — to be determined.
