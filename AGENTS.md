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
- Runner is `bun test --isolate` (vitest removed). `--isolate` is required: `mock.module` is process-global and leaks across files without it.
- Coverage thresholds (`bunfig.toml`): 85% lines/functions/statements. Do not lower. Branch coverage is not enforced — `bun test` cannot threshold branches (line/function/statement only).
- Every engine function: positive + negative + edge cases.
- `fixtures/<source>/` is CI ground-truth. Change only with schema or config change.
- `src/pipeline.ts` excluded from coverage (untestable entry point).
- Local-validation test files removed before commit.

## Source onboarding (PRD §CC.x — read it first)

- Classify license per CC.1: Open / Personal-use / Restrictive / Unknown.
- Personal-use + Unknown: send permission email via `docs/agency-permission-request.md`. 30-day public-record fallback applies to **Unknown only**; Personal-use needs affirmative reply (silence ≠ permission).
- Restrictive: exclude. Document reason in `DATA_LICENSES.md`; do not email.
- New source = 6 surfaces or incomplete: `sources/<id>.yaml` + `fixtures/<id>/` ground-truth + `DATA_LICENSES.md` entry + `README.md` sources row + `README.md` `## Attribution` block (required even for CC-0/public-domain: courtesy credit) + `docs/license-matrix.md` summary row.
- README sources table + license-matrix summary table = alphabetical by country. `scripts/check-sources-sorted.py` runs in pre-commit; do not bypass. Insert in correct position, not append.
- New scalar/compound transform = 3 places simultaneously or loader rejects: enum in `src/types/config.ts` (`ScalarTransformName`/`CompoundTransformName`) + handler in `src/transforms.ts` + allowlist in `src/config/loader.ts`.

### Research-first rule

- **Exhaust all research options before sending the first contact email.** Hunt national open-data portals (CKAN/Aporta/data.gov.\* listings), register pages, ToS / disclaimer text, and any public license declarations. Only send the permission email once research is genuinely exhausted and classification is still Unknown or under-verified.
- **Never send a follow-up or clarifier before the 30-day fallback window expires.** A second email asking the same question is a duplicate request — agencies treat it as noise and it does not earn a faster reply.
- Record findings in the proper docs in lockstep: `DATA_LICENSES.md` (detail entry) + `README.md` (sources row) + `docs/license-matrix.md` (summary row) + `docs/source-onboarding-checklist.md` (in-flight row, including any register-specific contact surfaced for the eventual follow-up).
- After recon on an already-emailed agency: update docs, move on to the next source. Wait until the original 30-day timeline expires before sending anything else to that agency.
- Exception — surfacing a new fact materially changes the ask (not "please confirm what we already asked"). Rare. Default is no.

## Engine extension points (use, don't reinvent)

- Spreadsheet sources: `format: csv|ods|xlsx|xls` in source YAML. `csv` → `csv-parse`; `ods`/`xlsx` → `hucre`; `xls` → `xlsx`.
- Filename rolling (date-stamped bulk URLs): `download.discover_url` + `download.discover_pattern` (regex, one capture group; captured URL resolved against `discover_url` as base).
- Single-file (non-zip) download: `download.format: file` with exactly one `entries` alias.
- Banner/metadata rows that aren't real records: `source_id_transform` returning `null` for non-records; pair with `allowed_missing_source_id_rows` to bound skip.
- Headerful files using explicit `columns`: `skip_rows: 1` discards the file's own header so `columns` overrides cleanly.

## Architecture invariants

- `src/schema.ts` = canonical Zod schema. All engine output validates against it before going into the artifact.
- `src/engine.ts` = source-agnostic. New registry = new YAML + (when needed) new transform/parser path. Never edit engine row-translation logic for a single source.
- `src/db.ts` builds one SQLite artifact per source via `bun:sqlite` (in-memory → `serialize()` bytes, no filesystem). Table `aircraft`: every canonical field is its own typed column (`source_id` PK; nested `owner`/`operator`/`engine` flattened to `owner_*`/`operator_*`/`engine_*`; the lone array `operational_classes` as a JSON-string column). Indexed `icao_hex`, `registration`, `status`, `airframe_type`, `owner_country` — consumers filter/sort on any field, not just point lookups. `PRAGMA user_version` is the producer shape marker; bump on any column/contract change.
- R2 keys (strict):
  - `aircraft/<source>.sqlite` — the per-source artifact (replaces the prior object-per-record + by-hex/by-registration index + manifest scheme).
  - `aircraft/_state/<source>.json` — last-run / last-content-change / `content_hash` for cadence gating and skip-if-unchanged.
- The artifact PUT is gated on `content_hash` (sha256 over the sorted record set, in `db.ts`): unchanged set → no PUT. Registry data (`source_id`/`registration`/`icao_hex`) lives inside the SQLite, never in an R2 key — so it carries no key-escaping constraint.
- FAA `UNIQUE ID` = `source_id`, never N-number. N-numbers are reissued; UNIQUE ID is permanent.

## Distribution model

- Source-available code (Polyform Shield 1.0.0 + Supplemental Terms). Forks self-host against own R2 + own per-source license assessment.
- Operator deployment must remain non-commercial for lifetime of any Personal-use source ingested.

## GitHub Actions

- `actions/*`: tagged major (e.g., `@v6`).
- All other actions: commit SHA + version comment (e.g., `@abc123 # v4.1.0`).
- `refresh.yml` discover step auto-enumerates `sources/*.yaml` — no workflow edits when adding a source.
- **Refresh cadence rule:** when a source declares one cadence but the observed publishing rhythm differs, the GHA refresh must run at the **more frequent** of the two. Record both values in `DATA_LICENSES.md` under that source's `Update cadence` block. The current fleet-wide cron is daily (`0 6 * * *`); per-source `cadence_days` in the source YAML controls how often each source actually runs — sources without `cadence_days` run every day the cron fires. Sources publishing faster than daily require their own workflow. Source mappings should use conditional fetch (`Last-Modified` / `ETag` / filename-change detection) so polling more frequently than the publishing rhythm stays cheap.

## Commits

- Conventional Commits. **Lowercase type + subject** (commitlint rejects sentence-case/start-case).
- RAI footer required: `Co-Authored-By: Claude <Model> <noreply@anthropic.com>` (use the actual model name that produced the change).
- Atomic: each commit independently typechecks, lints, passes tests.
- Pre-commit hooks (lefthook): format, lint, gitleaks, sort validator, actionlint, commitlint. Do not skip with `--no-verify`.

## Branch hygiene — scope creep prevention

Scope = branch name + first commit's diff shape. Nothing else.

- `feat/*`: `src/`, `tests/`, `sources/`, `fixtures/`, plus docs for that feature only.
- `docs/*`: `README.md`, `DATA_LICENSES.md`, `docs/*` only. No code/sources/fixtures.
- `fix/*`: bug + tests proving it. Nothing else.
- `chore/*`: tooling, CI, deps. Nothing user-facing.

Out-of-scope work → new branch. Do not append, even if small.

New branch when: active `feat/*` and asked for license triage on other sources, or doc-only work not required by the feature; active `docs/*` and asked for any code change; commit log already shows two themes and a third is asked.

Switch: commit/stash current work → state the mismatch in one line → branch from `main` (not the active branch, which would carry unwanted commits) → apply there → return when the feature resumes.

Never: stack feature + unrelated docs because "commit + push" was said; call a mix "related" when the only link is one conversation; let scope expand unflagged until PR-open. Diff hard to title in one line → two PRs.

## Documentation

- Prose docs carry intent, rationale, and license/legal facts — never restate what `sources/*.yaml`, `src/schema.ts`, or other code already states. If a reader can get it from the source, link; don't transcribe. Per-source CSV mechanics, field mappings, and schema field lists belong in the YAML/schema, not in prose.
- Don't create new top-level doc files unilaterally. If work seems to call for one, ask first; answer is usually "fold into an existing one". Exception: `sources/<id>.yaml`, `fixtures/<id>/`, other source-onboarding artifacts in the standard workflow.
- Required updates (not optional) when underlying state changes:
  - `DATA_LICENSES.md` — when a source is added or its license posture changes.
  - `README.md` sources table + `README.md` `## Attribution` block + `docs/license-matrix.md` summary table — alongside any new `sources/<id>.yaml`.
  - `PRD.md` — only when goals, requirements, or constraints shift. It is planning, not a shipped-implementation log; do not restate source YAML or schema here.
- `docs/license-matrix.md`: the summary table is the surface (triage across all candidate registries). Per-agency `### detail` blocks are legacy — they duplicate `DATA_LICENSES.md`; do not add them for new sources.
- Inline code comments: WHY only (per Hard prohibitions WHAT-vs-WHY rule).
