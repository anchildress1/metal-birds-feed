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
  'br-anac':
    'Source: Agência Nacional de Aviação Civil (ANAC), Brazil — open aviation registry, normalized into this project schema without implying endorsement.',
  'ee-tram':
    'Data source: Estonian Transport Administration (Transpordiamet) — https://transpordiamet.ee/ohusoidukite-register; reused and redistributed with permission for non-commercial use, normalized into this project schema without implying endorsement. The data is provided without guarantees of completeness, accuracy, or uninterrupted availability.',
  'lv-caa':
    'Source: Civil Aviation Agency of Latvia (CAA Latvia) — open aviation registry, normalized into this project schema without implying endorsement.',
  'mv-caa':
    "Source data from the Civil Aviation Authority of the Republic of Maldives — https://www.caa.gov.mv/; reproduced with the CAA's written permission, normalized into this project schema without implying endorsement. Whilst reasonable care is taken compiling the data, the CAA does not warrant it is free of error or omission.",
  'nl-ilt':
    'Source: Human Environment and Transport Inspectorate (ILT), Netherlands — open aviation registry, normalized into this project schema without implying endorsement.',
  'no-caa':
    'Source data from Luftfartstilsynet (Civil Aviation Authority of Norway), Norges luftfartøyregister — https://data.norge.no/datasets/ca241ae5-fc9e-3702-bbcd-5453d2d0f06f; publicly accessible with no specified license and treated as Private-use, normalized into this project schema without implying endorsement.',
  'sg-caas':
    'Source data from the Civil Aviation Authority of Singapore — https://www.caas.gov.sg/industry/aircraft-operators/certificate-of-registration/; publicly accessible and free to use with attribution, confirmed by CAAS, normalized into this project schema without implying endorsement.',
  'es-aesa':
    'Data source: Agencia Estatal de Seguridad Aérea (AESA) — https://www.seguridadaerea.gob.es/en/ambitos/aeronaves/registro-de-matriculas-de-aeronaves-civiles/registro-de-matriculas; reusable under Real Decreto 1495/2011 (Ley 37/2007 on public-sector-information reuse), normalized into this project schema without implying endorsement.',
  'ch-foca':
    'Source data from the Federal Office of Civil Aviation (FOCA / BAZL), Switzerland — https://app02.bazl.admin.ch/web/bazl/en/; redistribution confirmed by FOCA, normalized into this project schema without implying endorsement.',
  'tw-caa':
    'Source: Civil Aeronautics Administration (CAA Taiwan) — aviation registry, normalized into this project schema without implying endorsement.',
};

// A source slug with no mapped notice still gets a credit rather than an empty string — a displayed
// row must never appear uncredited. Reaching this means a source shipped without its line above.
const fallback = (source: string): string =>
  `Source: ${source} aviation registry, normalized into this project schema without implying endorsement.`;

// The ready-to-display attribution line for a source. Returned verbatim to the consumer.
export const attributionFor = (source: string): string => NOTICES[source] ?? fallback(source);
