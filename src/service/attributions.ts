// Why this exists: the feed is the one place a consumer reads a row's credit line, so it never has
// to encode its own source→notice map. Where a license mandates exact wording (Transport Canada,
// CAA Maldives, AESA's required citation), the string here must stay verbatim to that mandate — keep
// it in sync with DATA_LICENSES `## Required Notices`, which is authoritative for the legally-fixed
// text. Open / public-domain sources with no mandated notice get a courtesy credit so no displayed
// row is ever uncredited. Keyed by source slug (config.id / FeedRow.source).

const NOTICES: Record<string, string> = {
  faa: 'Source: Federal Aviation Administration (FAA), United States — public-domain civil aircraft registry, normalized into this project schema without implying endorsement.',
  'tc-ca':
    'Reproduced and distributed with the permission of the Government of Canada. This product has been produced by or for Ashley Childress and includes data provided by the Government of Canada. The incorporation of data sourced from the Government of Canada within this product shall not be construed as constituting an endorsement by the Government of Canada of our product.',
  'au-casa':
    'Source data from the Civil Aviation Safety Authority (CASA), Australia, licensed under CC BY 4.0, normalized into this project schema without implying endorsement.',
  // ANAC states the register is open data needing no prior authorization, but that "proper citation
  // of the source is mandatory" (Brazilian Aeronautical Registry Technical Branch, 2026-05-12). No
  // wording was prescribed; the citation itself is the condition, so it cannot be dropped.
  'br-anac':
    'Source: Agência Nacional de Aviação Civil (ANAC), Brazil — https://sistemas.anac.gov.br/dadosabertos/Aeronaves/RAB/; open data reused with the mandatory source citation, normalized into this project schema without implying endorsement.',
  'ee-tram':
    'Data source: Estonian Transport Administration (Transpordiamet) — https://transpordiamet.ee/ohusoidukite-register; reused and redistributed with permission for non-commercial use, normalized into this project schema without implying endorsement. The data is provided without guarantees of completeness, accuracy, or uninterrupted availability.',
  'lv-caa':
    'Source: Civil Aviation Agency of Latvia (CAA Latvia) — open aviation registry, normalized into this project schema without implying endorsement.',
  // CC BY 4.0 makes attribution, licence identification, and indication of changes conditions of
  // the licence, so all three have to survive into the served line — a courtesy credit would not.
  'lt-tka':
    'Transporto kompetencijų agentūra (Transport Competence Agency), Lithuania — Civilinių orlaivių registro duomenys, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/); retrieved from https://data.gov.lt and changed by normalization into this project schema, without implying endorsement.',
  'mv-caa':
    "Source data from the Civil Aviation Authority of the Republic of Maldives — https://www.caa.gov.mv/; reproduced with the CAA's written permission, normalized into this project schema without implying endorsement. Whilst reasonable care is taken compiling the data, the CAA does not warrant it is free of error or omission.",
  'nl-ilt':
    'Source: Human Environment and Transport Inspectorate (ILT), Netherlands — open aviation registry, normalized into this project schema without implying endorsement.',
  'nz-caa':
    'Source data from the Civil Aviation Authority of New Zealand — https://www.aviation.govt.nz/aircraft/aircraft-registration/aircraft-register-search/; the CAA is acknowledged as the source as its terms require, treated as Private-use and normalized into this project schema without implying endorsement.',
  'no-caa':
    'Source data from Luftfartstilsynet (Civil Aviation Authority of Norway), Norges luftfartøyregister — https://data.norge.no/datasets/ca241ae5-fc9e-3702-bbcd-5453d2d0f06f; publicly accessible with no specified license and treated as Private-use, normalized into this project schema without implying endorsement.',
  'sg-caas':
    'Source data from the Civil Aviation Authority of Singapore — https://www.caas.gov.sg/industry/aircraft-operators/certificate-of-registration/; publicly accessible and free to use with attribution, confirmed by CAAS, normalized into this project schema without implying endorsement.',
  'es-aesa':
    'Data source: Agencia Estatal de Seguridad Aérea (AESA) — https://www.seguridadaerea.gob.es/en/ambitos/aeronaves/registro-de-matriculas-de-aeronaves-civiles/registro-de-matriculas; reusable under Real Decreto 1495/2011 (Ley 37/2007 on public-sector-information reuse), normalized into this project schema without implying endorsement.',
  'cl-dgac':
    'Source data from the Dirección General de Aeronáutica Civil (DGAC) of Chile — the sole official source and copyright holder of the information — https://www.dgac.gob.cl/aeronaves-2/registro-nacional-de-aeronaves/; reused non-commercially for research and reference under Ley N° 17.336, normalized into this project schema without implying endorsement.',
  'ch-foca':
    'Source data from the Federal Office of Civil Aviation (FOCA / BAZL), Switzerland — https://app02.bazl.admin.ch/web/bazl/en/; redistribution confirmed by FOCA, normalized into this project schema without implying endorsement.',
  // CAA Taiwan supplied this wording and it was accepted verbatim (Nicholas Liaw, Flight Standards
  // Division, 2026-05-15). The first sentence is theirs and must not be reworded; permission is
  // conditional on OGDL v1.0 and on the register link accompanying the credit.
  'tw-caa':
    'Source: Civil Aviation Administration, MOTC R.O.C. — caa.gov.tw. Licensed under the Open Government Data License, v1.0. Register: https://www.caa.gov.tw/article.aspx?a=4499&lang=1; normalized into this project schema without implying endorsement.',
};

// A source slug with no mapped notice still gets a credit rather than an empty string — a displayed
// row must never appear uncredited. Reaching this means a source shipped without its line above.
const fallback = (source: string): string =>
  `Source: ${source} aviation registry, normalized into this project schema without implying endorsement.`;

// The ready-to-display attribution line for a source. Returned verbatim to the consumer.
export const attributionFor = (source: string): string => NOTICES[source] ?? fallback(source);
