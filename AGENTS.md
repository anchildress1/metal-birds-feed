# AGENTS.md

Authoritative rules for AI agents in this repo. Overrides any conflicting local file. Read `PRD.md` for context, this file for rules.

## Hard prohibitions

- PII allowed: `owner.{name,kind,state,country}` + `operator.{name,kind,state,country}`. Drop street/street2/city/postal-code/county/region/care-of at the mapping config.
- No public read API. Operator-private R2 binding only (PRD §CC.4).
- No commercial operator deployment. CC BY-NC + Personal-use sources require non-commercial use (PRD §CC.3).
- No `..` in path inputs. Resolve to absolute, enforce sandbox-root containment after resolution, default deny on validation failure.
- No quick fixes. Long-term, maintainable only.
- No `// @ts-ignore` without justifying comment.
- No weakening of `tsconfig.json` strict settings.
- No backwards-compatibility shims when the user can simply change the code.
- No error handling for impossible scenarios. Validate at system boundaries only (user input, external APIs).
- No comments restating WHAT. Only WHY when non-obvious.
- No `.skip` on tests. Fix or delete. Never lower coverage thresholds.
- No silent loss of upstream information. If a registry publishes a structurally meaningful field the schema cannot represent (e.g., operator≠owner, IDERA authorised party), extend the canonical schema rather than drop at mapping config. PII is the only allowed drop. Goal: increase info density across sources.

## Code style

- `??`/`??=` over null/undefined checks. `?.` over guard clauses.
- `const fn = () =>` over `function fn()`. `const` over `let`. Never `var`.
- No `as T` unless TS cannot narrow structurally.
- `await` over `.then()`/`.catch()`. Never `await` inside `for`/`while` — use `Promise.all`/`allSettled` + `.map()`.
- Max cognitive complexity per function: 15.

## Tests

- Live in `tests/` mirroring `src/`. Never colocate.
- Coverage thresholds (`vitest.config.ts`): 85% lines/functions/statements, 80% branches. Do not lower.
- Every engine function: positive + negative + edge cases.
- `fixtures/<source>/` is CI ground-truth. Change only with schema or config change.
- `src/pipeline.ts` excluded from coverage (untestable entry point).
- Local-validation test files removed before commit.

## Source onboarding (PRD §CC.x — read it first)

- Classify license per CC.1: Open / Personal-use / Restrictive / Unknown.
- Personal-use + Unknown: send permission email via `docs/agency-permission-request.md`. 30-day public-record fallback applies to **Unknown only**; Personal-use needs affirmative reply (silence ≠ permission).
- Restrictive: exclude. Document reason in `DATA_LICENSES.md`; do not email.
- New source = 5 surfaces or incomplete: `sources/<id>.yaml` + `fixtures/<id>/` ground-truth + `DATA_LICENSES.md` entry + `README.md` sources row + `docs/license-matrix.md` summary row.
- README sources table + license-matrix summary table = alphabetical by country. `scripts/check-sources-sorted.py` runs in pre-commit; do not bypass. Insert in correct position, not append.
- New scalar/compound transform = 3 places simultaneously or loader rejects: enum in `src/types/config.ts` (`ScalarTransformName`/`CompoundTransformName`) + handler in `src/transforms.ts` + allowlist in `src/config/loader.ts`.

### Research-first rule

- **Exhaust all research options before sending the first contact email.** Hunt national open-data portals (CKAN/Aporta/data.gov.\* listings), register pages, ToS / disclaimer text, and any public license declarations. Only send the permission email once research is genuinely exhausted and classification is still Unknown or under-verified.
- **Never send a follow-up or clarifier before the 30-day fallback window expires.** A second email asking the same question is a duplicate request — agencies treat it as noise and it does not earn a faster reply.
- Record findings in the proper docs in lockstep: `DATA_LICENSES.md` (detail entry) + `README.md` (sources row) + `docs/license-matrix.md` (summary row + detail block if one exists) + `docs/source-onboarding-checklist.md` (in-flight row, including any register-specific contact surfaced for the eventual follow-up).
- After recon on an already-emailed agency: update docs, move on to the next source. Wait until the original 30-day timeline expires before sending anything else to that agency.
- Exception — surfacing a new fact materially changes the ask (not "please confirm what we already asked"). Rare. Default is no.

## Engine extension points (use, don't reinvent)

- Spreadsheet sources: `format: csv|ods|xlsx` in source YAML. `csv` → `csv-parse`; `ods`/`xlsx` → `hucre`.
- Filename rolling (date-stamped bulk URLs): `download.discover_url` + `download.discover_pattern` (regex, one capture group; captured URL resolved against `discover_url` as base).
- Single-file (non-zip) download: `download.format: file` with exactly one `entries` alias.
- Banner/metadata rows that aren't real records: `source_id_transform` returning `null` for non-records; pair with `allowed_missing_source_id_rows` to bound skip.
- Headerful files using explicit `columns`: `skip_rows: 1` discards the file's own header so `columns` overrides cleanly.

## Architecture invariants

- `src/schema.ts` = canonical Zod schema. All engine output + R2 objects validate against it.
- `src/engine.ts` = source-agnostic. New registry = new YAML + (when needed) new transform/parser path. Never edit engine row-translation logic for a single source.
- R2 keys (strict):
  - `aircraft/by-id/<source>/<unique-id>.json` — canonical record
  - `aircraft/by-icao-hex/<hex>.json` — `{"refs":["<source>:<id>",...]}`
  - `aircraft/by-registration/<reg>.json` — `{"refs":["<source>:<id>",...]}`
  - `aircraft/_manifest/<source>.json` — content-hash manifest for diff-write
- FAA `UNIQUE ID` = `source_id`, never N-number. N-numbers are reissued; UNIQUE ID is permanent.

## Distribution model

- Source-available code (Polyform Shield 1.0.0 + Supplemental Terms). Forks self-host against own R2 + own per-source license assessment.
- Operator deployment must remain non-commercial for lifetime of any Personal-use source ingested.

## GitHub Actions

- `actions/*`: tagged major (e.g., `@v6`).
- All other actions: commit SHA + version comment (e.g., `@abc123 # v4.1.0`).
- `refresh.yml` discover step auto-enumerates `sources/*.yaml` — no workflow edits when adding a source.

## Commits

- Conventional Commits. **Lowercase type + subject** (commitlint rejects sentence-case/start-case).
- RAI footer required: `Co-Authored-By: Claude <Model> <noreply@anthropic.com>` (use the actual model name that produced the change).
- Atomic: each commit independently typechecks, lints, passes tests.
- Pre-commit hooks (lefthook): format, lint, gitleaks, sort validator, actionlint, commitlint. Do not skip with `--no-verify`.

## Branch hygiene — scope creep prevention

Real regression: AI agents pile unrelated work onto active branches via "while we're here" thinking. Stop it.

**Scope = branch name + first commit's diff shape.** Nothing else.

- `feat/*`: `src/`, `tests/`, `sources/`, `fixtures/`, plus docs describing the feature being added.
- `docs/*`: `README.md`, `DATA_LICENSES.md`, `docs/*` only. No code, sources, or fixtures.
- `fix/*`: bug + tests proving the fix. Nothing else.
- `chore/*`: tooling, CI, dep bumps. Nothing user-facing.

Out-of-scope work = stop and propose a new branch. Do not append even if it feels small.

Triggers — work belongs on a new branch when:

- Active is `feat/*` and user asks for license triage on additional sources beyond the one shipping.
- Active is `feat/*` and user asks for doc-only updates not directly required by the feature.
- Active is `docs/*` and user asks for any code change.
- Active branch's commit log already shows two distinct themes and user is asking to extend a third.

Switch procedure:

1. Commit in-progress work cleanly (or stash if mid-edit).
2. Surface the scope mismatch in one sentence (e.g., "this is doc-only license triage, not part of the NL ILT feature — splitting to a new branch").
3. Branch from `main`, not from the active feature branch (otherwise the new branch carries feature commits the user does not want bundled).
4. Apply new work there.
5. Return to original branch when user resumes feature work.

Never:

- Stack feature + unrelated docs on the same branch because user said commit + push.
- Rationalize the mix as "related" when the only relation is "I worked on them sequentially in one conversation".
- Discover at PR-open time that the branch is doing two things — user catches it and "I didn't push back when scope expanded" is the wrong answer.

Heuristic: diff hard to describe in one PR title → two PRs.

## Documentation

- Don't create new top-level doc files unilaterally. If work seems to call for one, ask first; answer is usually "fold into an existing one". Exception: `sources/<id>.yaml`, `fixtures/<id>/`, other source-onboarding artifacts in the standard workflow.
- Required updates (not optional) when underlying state changes:
  - `DATA_LICENSES.md` — when a source is added or its license posture changes.
  - `README.md` sources table + `docs/license-matrix.md` summary table — alongside any new `sources/<id>.yaml`.
  - `PRD.md` — when project goals, requirements, or constraints shift.
- Inline code comments: WHY only (per Hard prohibitions WHAT-vs-WHY rule).
