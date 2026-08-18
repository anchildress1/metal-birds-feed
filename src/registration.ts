// Registries punctuate marks differently — FAA "N12345", TC "C-FABC", CASA "VH-XYZ", TKA "LY AYP" —
// and a caller holding a tail number off a photo should not have to know which. Uppercase and strip
// everything that is not alphanumeric, so the stored key and the queried one meet in a single form.
//
// Its own module, imported by both the producer (feed.ts) and the service (service/handler.ts),
// because the two normalizations must be one function: while they were separate copies of this
// regex, a change to either silently missed every lookup instead of failing. feed-row.ts is
// type-only by design and cannot hold it without coupling the service to the pipeline.
export const registrationKey = (registration: string): string =>
  registration.toUpperCase().replace(/[^A-Z0-9]/g, '');

// What registrationKey can produce, bounding what a caller may send. Shared for the same reason.
export const REGISTRATION_KEY_RE = /^[A-Z0-9]{2,10}$/;
