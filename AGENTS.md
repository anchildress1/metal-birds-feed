# AGENTS.md

Authoritative rules for AI agents working in this repo. Overrides any conflicting local file. Read `PRD.md` for context, this file for rules.

## Hard prohibitions

- No PII beyond `owner.{name, kind, state, country}`. Street, street2, city, postal-code, county, region, care-of fields drop at the mapping config.
- No public read API. Operator-private R2 binding only (PRD §CC.4).
- No commercial deployment of operator. CC BY-NC and Personal-use sources require non-commercial use (PRD §CC.3).
- No `..` in path inputs. Resolve to absolute, enforce sandbox-root containment after resolution, default deny on validation failure.
- No quick fixes. Long-term, maintainable only.
- No `// @ts-ignore` without a justifying comment.
- No weakening of `tsconfig.json` strict settings.
- No backwards-compatibility shims when the user can simply change the code.
- No error handling for scenarios that can't happen. Validate at system boundaries only (user input, external APIs).
- No comments that restate WHAT the code does. Comments only when WHY is non-obvious.
- No `.skip` on tests. If a test is broken, fix it or delete it. Never lower coverage thresholds to make CI pass.

## Code style

- `??` / `??=` over null/undefined checks; `?.` over guard clauses.
- `const fn = () =>` over `function fn()`. `const` over `let`. Never `var`.
- No `as T` unless TS cannot narrow structurally.
- `await` over `.then()` / `.catch()`. Never `await` inside `for` / `while` — use `Promise.all` / `allSettled` + `.map()`.
- Max cognitive complexity per function: 15.

## Tests

- Live in `tests/` mirroring `src/`. Never colocate.
- Coverage thresholds (`vitest.config.ts`): 85% lines/functions/statements, 80% branches. Do not lower.
- Every engine function: positive + negative + edge cases.
- `fixtures/<source>/` is CI ground-truth. Only change with a schema or config change.
- `src/pipeline.ts` excluded from coverage (untestable entry point).
- Test files introduced for local validation removed before commit.

## Source onboarding (PRD §CC.x — read it first)

- Classify license per CC.1: Open / Personal-use / Restrictive / Unknown.
- Personal-use + Unknown: send permission email using `docs/agency-permission-request.md`. The 30-day public-record fallback applies to **Unknown only** — Personal-use needs an affirmative reply (silence ≠ permission).
- Restrictive: exclude. Document the reason in `DATA_LICENSES.md`; do not email.
- New source onboarding touches all five surfaces or the source is incomplete: `sources/<id>.yaml`, `fixtures/<id>/` ground-truth, `DATA_LICENSES.md` entry, `README.md` sources table row, `docs/license-matrix.md` summary row.
- The README sources table and the license-matrix summary table are alphabetical by country. `scripts/check-sources-sorted.py` runs in pre-commit; do not bypass it. Insert new rows in their correct alphabetical position rather than appending — fix-up commits otherwise become noise.
- A new scalar or compound transform requires updates in **three places** simultaneously or the loader rejects the config: enum in `src/types/config.ts` (`ScalarTransformName` / `CompoundTransformName`), handler in `src/transforms.ts`, allowlist array in `src/config/loader.ts`.

## Engine extension points (already in place — use them, do not reinvent)

- Spreadsheet sources: `format: csv | ods | xlsx` in source YAML. `csv` routes to `csv-parse`; `ods` / `xlsx` route to `hucre`.
- Filename rolling (date-stamped bulk URLs): `download.discover_url` + `download.discover_pattern` — pattern is a regex with one capture group; the captured URL is resolved against `discover_url` as the base.
- Single-file (non-zip) download: `download.format: file` with exactly one `entries` alias.
- Banner / metadata rows that aren't real records: `source_id_transform` with a transform that returns `null` for non-records; pair with `allowed_missing_source_id_rows` to bound the skip.
- Headerful files using explicit `columns`: `skip_rows: 1` discards the file's own header so `columns` overrides cleanly.

## Architecture invariants

- `src/schema.ts` is the canonical Zod schema. All engine output and R2 objects validate against it.
- `src/engine.ts` is source-agnostic. New registry = new YAML + (when needed) a new transform / parser path. Never edit engine row-translation logic for a single source.
- R2 keys (strict format):
  - `aircraft/by-id/<source>/<unique-id>.json` — canonical record
  - `aircraft/by-icao-hex/<hex>.json` — `{"refs":["<source>:<id>",...]}`
  - `aircraft/by-registration/<reg>.json` — `{"refs":["<source>:<id>",...]}`
  - `aircraft/_manifest/<source>.json` — content-hash manifest for diff-write
- FAA `UNIQUE ID` is `source_id`, **never N-number**. N-numbers are reissued; UNIQUE ID is permanent.

## Distribution model

- Source-available code (Polyform Shield 1.0.0 + Supplemental Terms). Forks self-host against their own R2 + their own per-source license assessment.
- Operator deployment must remain non-commercial for the lifetime of any Personal-use source it ingests.

## GitHub Actions

- `actions/*`: tagged major version (e.g., `@v6`).
- All other actions: commit SHA + version comment (e.g., `@abc123 # v4.1.0`).
- `refresh.yml` discover step auto-enumerates `sources/*.yaml` — no workflow edits needed when adding a source.

## Commits

- Conventional Commits. **Lowercase type and subject** — commitlint rejects sentence-case / start-case.
- RAI footer required: `Co-Authored-By: Claude <Model> <noreply@anthropic.com>` — use the actual model name that produced the change.
- Atomic: each commit must independently typecheck, lint, and pass tests.
- Pre-commit hooks (lefthook): format, lint, gitleaks, sort validator, actionlint, commitlint. Do not skip with `--no-verify`.

## Branch hygiene — scope creep prevention

This rule exists because of a real regression. AI agents are prone to "while we're here" thinking that quietly turns a focused branch into a 30-commit catch-all. Follow these in order; do not skip steps.

**Scope is set by the branch name and the first commit's diff shape.** The branch's allowed scope is whatever those describe — nothing else.

- A `feat/*` branch may touch `src/`, `tests/`, `sources/`, `fixtures/`, plus the docs that describe the feature being added.
- A `docs/*` branch may touch `README.md`, `DATA_LICENSES.md`, `docs/*` only. No code, no `sources/`, no `fixtures/`.
- A `fix/*` branch is bounded to the bug being fixed plus the tests that prove it.
- A `chore/*` branch handles tooling, CI, dependency bumps — nothing user-facing.

**When the user asks for work outside the active branch's scope, stop and propose a new branch.** Do not append the new work to the active branch even if it feels fast or small.

Triggers — when any of these appear, the work belongs on a new branch:

- Active branch is `feat/*` and the user asks for license triage on additional sources beyond the one the feature ships.
- Active branch is `feat/*` and the user asks for doc-only updates not directly required by the feature.
- Active branch is `docs/*` and the user asks for any code change.
- The active branch's commit log already shows two distinct themes and the user is asking to extend a third.

**How to switch:**

1. Commit the in-progress work cleanly (or stash if mid-edit).
2. Surface the scope mismatch in one sentence: "this is doc-only license triage, not part of the NL ILT feature — splitting to a new branch."
3. Create the new branch from `main`, not from the active feature branch (otherwise the new branch carries feature commits the user does not want bundled).
4. Apply the new work there.
5. Return to the original branch when the user wants to continue feature work.

**Never:**

- Stack feature commits and unrelated doc commits on the same branch because the user kept saying commit + push.
- Rationalize the mix as "they're related" when the only relation is "I worked on them sequentially in one conversation."
- Wait until PR-open time to discover the branch is doing two things — the user will catch it and ask why, and "I didn't push back when scope expanded" is the wrong answer.

**Heuristic:** if the diff would be hard to describe in one PR title, it is two PRs.

## Documentation

- Do not create new doc files unilaterally. If the work seems to call for a new top-level doc, ask first; the answer is usually "no, fold it into an existing one." This applies to `NOTES.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, and the like — not to `sources/<id>.yaml`, `fixtures/<id>/`, or other source-onboarding artifacts that are part of the standard workflow.
- Updates to existing tracked docs are required, not optional, when the underlying state changes:
  - `DATA_LICENSES.md` — whenever a source is added or its license posture changes.
  - `README.md` sources table and `docs/license-matrix.md` summary table — alongside any new `sources/<id>.yaml`.
  - `PRD.md` — when project goals, requirements, or constraints shift.
- Inline code comments follow the WHAT-vs-WHY rule from Hard prohibitions: WHY only.
