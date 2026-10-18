Declare a second layout only from a real file published in that orientation. Never derive one layout from another: CCAA's flip moved bands by 18pt at the first column and 30pt at the last.

## Triggers

| Run log                                                                        | Meaning                                | Action                                                                                              |
| ------------------------------------------------------------------------------ | -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `PDF records run along X, needing a field_axis: Y layout, but only Z declared` | The register flipped                   | Measure the failing file's first-line band per column, add a `layouts` entry, add a rotated fixture |
| `Downloaded file is not a PDF (starts with "<!DOCTYPE html>…")`                | Outage or error page, not a flip       | Wait; the last good slice keeps serving                                                             |
| `PDF fits N declared layouts equally`                                          | Bands do not separate the orientations | Re-measure                                                                                          |

## Open

- es-aesa, hu-kh and th-caat declare only the `x` layout; `y` is unmeasured. Declare it from the first flipped file, then delete the source from this list.
- `grep field_axis sources/<id>.yaml` is the source of truth for what a source declares; this list only names the gaps.

## Directives

- Wrapped lines that nearest-anchor snapping hands to the next record: set `wrap_after_anchor: true` on that layout.
- Margin text a widened reach pulls into a cell (a disclaimer, a repeated header): `drop_margin_lines: true`. It judges where a printed line starts; never match an agency's wording.
- Never have a model read a PDF into rows when a deterministic check fails: a guessed row is invented data.
