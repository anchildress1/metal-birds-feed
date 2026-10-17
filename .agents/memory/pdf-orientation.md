Declare a second layout only from a real file published in that orientation. Never derive one layout from another: CCAA's flip moved bands by 18pt at the first column and 30pt at the last.

## Triggers

| Run log                                                                        | Meaning                                | Action                                                                                              |
| ------------------------------------------------------------------------------ | -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `PDF records run along X, needing a field_axis: Y layout, but only Z declared` | The register flipped                   | Measure the failing file's first-line band per column, add a `layouts` entry, add a rotated fixture |
| `Downloaded file is not a PDF (starts with "<!DOCTYPE html>…")`                | Outage or error page, not a flip       | Wait; the last good slice keeps serving                                                             |
| `PDF fits N declared layouts equally`                                          | Bands do not separate the orientations | Re-measure                                                                                          |

## Declared orientations

| Source  | Layouts | Fixtures                                                            | Open                                       |
| ------- | ------- | ------------------------------------------------------------------- | ------------------------------------------ |
| mv-caa  | x, y    | `register.pdf`, `register-rotated.pdf`                              | none                                       |
| hr-ccaa | x, y    | `register.pdf`, `register-rotated.pdf`, `register-rotated-tail.pdf` | disclaimer match is wording-based; see TTD |
| es-aesa | x       | `register.pdf`                                                      | y unmeasured                               |
| hu-kh   | x       | `register.pdf`                                                      | y unmeasured                               |
| th-caat | x       | `register.pdf`                                                      | y unmeasured                               |

## Flip history

| Source  | Observed                                                             |
| ------- | -------------------------------------------------------------------- |
| mv-caa  | four flips since 2026-07                                             |
| hr-ccaa | first failed refresh 2026-10-11, fixed on `fix/pdf-refresh-failures` |

- Add a row when a source flips. Move a source out of the Open column when its second layout and fixture land.
- Wrapped lines that nearest-anchor snapping hands to the next record: set `wrap_after_anchor: true` on that layout.
- Page furniture a widened reach pulls into a cell: `ignore_pattern`, matched on whole printed lines.
- Never have a model read a PDF into rows when a deterministic check fails: a guessed row is invented data.
