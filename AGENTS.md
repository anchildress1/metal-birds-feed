# AGENTS.md

Authoritative rules for AI agents in this repo. Overrides any conflicting local file. Read `PRD.md` for context, this file for rules.

## Hard prohibitions

- PII allowed: `owner.{name,kind,state,country}` + `operator.{name,kind,state,country}`. Drop street/street2/city/postal-code/county/region/care-of at the mapping config.
- No _public_ (unauthenticated) read API. A private, authenticated API is allowed: the feed service (Cloud Run, `src/service/`) is gated by a UUID bearer secret (`FEED_TOKEN`), rate-limited, batched by-hex point-lookup (`POST /feed`, up to 500 exact `icao_hex` values → descriptive aircraft slice: identity, airframe, engine, performance, ownership — no registry-admin/legal/date bookkeeping), server-side, a single authorized consumer application. Batching by exact hex is not enumeration — there is no attribute query/filter/list surface, misses are omitted, and the rate limit bounds it. Not a public surface — no unauthenticated access, query surface, or full-artifact access. It serves one consolidated `feed.sqlite` (built by the pipeline, baked into the image); direct R2 artifact access stays private-operator-binding only. (PRD §CC.4 "no public read API" = no _unauthenticated_ one; this private API complies.)
- No commercial operator deployment. CC BY-NC + Private-use sources require non-commercial use (PRD §CC.3).
- No public output distribution. Normalized artifacts are private to Ashley-operated applications only; forks self-host their own artifacts.
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
- `await` over `.then()`/`.catch()`. Never `await` inside `for`/`while` — use `Promise.all`/`allSettled` + `.map()`. Exception: inherently sequential consumption (stream pumps, backoff chains) where each iteration depends on the previous — state the WHY in an inline comment.
- Max cognitive complexity per function: 15.

## Tests

- Live in `tests/` mirroring `src/`. Never colocate.
- Runner is `bun test --isolate` (vitest removed). `--isolate` is required: `mock.module` is process-global and leaks across files without it.
- Coverage thresholds (`bunfig.toml`): 85% lines/functions/statements. Do not lower. Branch coverage is not enforced — `bun test` cannot threshold branches (line/function/statement only).
- Every engine function: positive + negative + edge cases.
- `fixtures/<source>/` is CI ground-truth. Change only with schema or config change.
- `src/pipeline.ts` holds real business logic (cadence gating, staleness-issue open/close, failure-summary rendering) and is covered like any other module via `mock.module` on its dependencies (`tests/pipeline.test.ts`). Only the top-level `if (isCliEntryPoint())` bootstrap is inherently untested — it only runs when the file is invoked as a script, not imported.
- Local-validation test files removed before commit.

## Source onboarding (PRD §CC.x — read it first)

- Classify source-use posture per CC.1: Open / Private-use / Restrictive / Unknown.
- Private-use + Unknown: research storage/caching/automation terms first. Send permission email via `docs/agency-permission-request.md` only when private caching is unclear after public-web research.
- Restrictive means paid single-PC, no-copy, no-storage, no-scraping, view-only, no-redistribute with storage implications, or active denial (PRD §CC.5 storage/caching gate). Exclude. Document reason in `DATA_LICENSES.md`; do not email unless there is a new material fact.
- New source = 7 surfaces or incomplete: `sources/<id>.yaml` + `fixtures/<id>/` ground-truth + `DATA_LICENSES.md` entry + `README.md` sources row + `README.md` `## Attribution` block (required even for CC-0/public-domain: courtesy credit) + `src/service/attributions.ts` `NOTICES[<id>]` runtime credit (the `/feed` service serves it per row; a missing entry silently falls back to a generic slug credit — for mandated wording keep it verbatim to `DATA_LICENSES.md` `## Required Notices`) + `docs/source-onboarding-checklist.md` `✅ Done` row (move it there when live; never let a shipped source vanish from the snapshot). `tests/service/attributions.test.ts` asserts every `sources/*.yaml` has a non-fallback notice — do not weaken it.
- README sources table = alphabetical by country. `scripts/check-sources-sorted.py` runs in pre-commit; do not bypass. Insert in correct position, not append. The README table lists sources active in the private operator pipeline; the full agency/source-use tracker lives in `DATA_LICENSES.md`.
- New scalar/compound transform = 3 places simultaneously or loader rejects: enum in `src/types/config.ts` (`ScalarTransformName`/`CompoundTransformName`) + handler in `src/transforms.ts` + allowlist in `src/config/loader.ts`.

### Research-first rule

- **Exhaust all research options before sending the first contact email.** Hunt national open-data portals (CKAN/Aporta/data.gov.\* listings), register pages, ToS / disclaimer text, robots policy, and any public license declarations. Only send the permission email once research is genuinely exhausted and private storage/caching posture is still Unknown or under-verified.
- **Never send a follow-up or clarifier before the 30-day fallback window expires.** A second email asking the same question is a duplicate request — agencies treat it as noise and it does not earn a faster reply.
- Record findings in the proper docs in lockstep: `DATA_LICENSES.md` (the record of source — correspondence row + source-use detail, including storage/cache restrictions and any register-specific contact surfaced for the eventual follow-up) + `docs/source-onboarding-checklist.md` (in-flight row: Source/Sent/Follow-up/Reply/Fallback). Add the `README.md` sources row only once the source is active in the private pipeline or cleared for implementation.
- After recon on an already-emailed agency: update docs, move on to the next source. Wait until the original 30-day timeline expires before sending anything else to that agency.
- Exception — surfacing a new fact materially changes the ask (not "please confirm what we already asked"). Rare. Default is no.

## Engine extension points (use, don't reinvent)

- Spreadsheet sources: `format: csv|ods|xlsx|xls` in source YAML. `csv` → `csv-parse`; `ods`/`xlsx` → `hucre`; `xls` → `xlsx`.
- Filename rolling (date-stamped bulk URLs): `download.discover_url` + `download.discover_pattern` (regex, one capture group; captured URL resolved against `discover_url` as base).
- Single-file (non-zip) download: `download.format: file` with exactly one `entries` alias.
- Banner/metadata rows that aren't real records: `source_id_transform` returning `null` for non-records; pair with `allowed_missing_source_id_rows` to bound skip.
- Headerful files using explicit `columns`: `skip_rows: 1` discards the file's own header so `columns` overrides cleanly. The parser asserts the discarded header's cell count equals `columns` length (csv + sheet paths) — width drift means an upstream column add/remove that positional mapping would silently shuffle.
- Ragged CSV rows (cell count ≠ header) fail the parse: short rows silently null trailing fields, long rows silently drop cells. Known non-tabular rows (e.g. an Oracle "N rows selected." trailer): bound with `allowed_ragged_rows`, a per-file budget keyed by download-entry alias exactly like `columns` (default 0 for every unlisted file). Joins always parse as CSV; the primary only does when `format: csv`, so a budget on a non-CSV primary is a load-time error.
- Server-rendered HTML register table: `format: html` reads the page's first `<table>` via SheetJS (no new dep), then the same `columns`/`skip_rows` shaping as the spreadsheet paths. Multi-table pages: `sheet:` (name or index, same as xls) — SheetJS names them `Sheet1`, `Sheet2`, ... in order.
- Source-published fleet total (silent-drift guard): `record_count.pattern` (regex, one capture group, matched against the decoded primary file) — the engine asserts the translated record count equals that integer and fails the run on mismatch, so a dropped/added row or a preamble-count shift can't write a wrong-size private artifact silently.
- Registers emitting one row per co-registered party (same key, rows differing only in the party field): `merge_duplicates.fields` (canonical dotted paths concatenated with `separator`, default `, `) + optional `set_on_merge` (paths stamped to a fixed value when a merge fires). Both key sets validate at load against `CANONICAL_PATHS` (derived from `src/schema.ts`) — an unlisted path would be stripped by re-validation and vanish silently. A differing path outside the policy, or a stamped path where _either_ row holds conflicting data, is a real collision and still falls to recency resolution. Never drop the extra rows.
- PDF cover/preface pages (text, zero anchors by design): `pdf.allowed_anchorless_pages` (default 0) bounds how many text-bearing pages may yield no `anchor_pattern` matches. Beyond the budget the parse fails naming the pages (a drifted register page drops its fleet slice and PDF sources can't use `record_count`); zero rows overall always fails regardless of budget. Declare cover pages explicitly — position-based tolerance would silently forgive a drifted first page.

## Architecture invariants

- `src/schema.ts` = canonical Zod schema. All engine output validates against it before going into the artifact.
- `src/engine.ts` = source-agnostic. New registry = new YAML + (when needed) new transform/parser path. Never edit engine row-translation logic for a single source.
- `src/db.ts` builds one SQLite artifact per source via `bun:sqlite` (in-memory → `serialize()` bytes, no filesystem). Table `aircraft`: every canonical field is its own typed column (`source_id` PK; nested `owner`/`operator`/`legal_owner`/`engine` flattened to `owner_*`/`operator_*`/`legal_owner_*`/`engine_*`; the lone array `operational_classes` as a JSON-string column). Indexed `icao_hex`, `registration`, `status`, `airframe_type`, `owner_country` — consumers filter/sort on any field, not just point lookups. `PRAGMA user_version` is the producer shape marker; bump on any column/contract change.
- R2 keys (strict):
  - `aircraft/<source>.sqlite` — the per-source artifact (replaces the prior object-per-record + by-hex/by-registration index + manifest scheme).
  - `aircraft/_state/<source>.json` — last-run / last-content-change / `content_hash` for cadence gating and skip-if-unchanged.
  - `aircraft/_feed/<source>.json` — per-source hex-collapsed feed slice (build intermediate). `main()` merges every source's slice into one consolidated `feed.sqlite` (`src/feed.ts`) served by the Cloud Run feed service (`src/service/`, single instance, baked DB). Cadence-skip requires this slice to exist too (self-heal, like the artifact); publish fails closed if any source's slice is missing.
  - `aircraft/_feed/_deployed.json` — content hash (`hashFeedRows`, sha256 over the sorted merged rows) of the feed last deployed to Cloud Run. The scheduled `deploy-feed` job redeploys only when the freshly built feed differs from this, and advances it only after a successful deploy.
- Deploy/runtime chain (R2 is build+intermediate store only; nothing serves reads from R2). `make build-feed` rebuilds `feed.sqlite` from every R2 `_feed` slice — never from an ambient on-disk copy. `make deploy` = `build-feed` then `deploy-only`. The DB is **baked into the Cloud Run image** (`Dockerfile` COPYs `feed.sqlite`; `MBF_FEED_DB_PATH=/app/feed.sqlite`), served in-memory by `bun:sqlite` — single instance, scale-to-zero, no runtime R2 or DB fetch. Reads never touch R2; a data change reaches production only by a redeploy of a new image.
- The artifact PUT is gated on `content_hash` (sha256 over the sorted record set, in `db.ts`): unchanged set → no PUT. Registry data (`source_id`/`registration`/`icao_hex`) lives inside the SQLite, never in an R2 key — so it carries no key-escaping constraint.
- FAA `UNIQUE ID` = `source_id`, never N-number. N-numbers are reissued; UNIQUE ID is permanent.
- Duplicate `source_id` within a source: byte-identical rows are skipped. Differing rows resolve by recency (`resolveRecency` in `src/engine.ts`) only when a signal exists — a `cancelled` status never outranks a live one, checked before date; failing that, the row with the most recent known date wins. When status and dates tie, a strict canonical superset may win only when every populated value in the sparse row matches; conflicting collisions fail instead of silently dropping upstream data.
- A mapping `lookup` with a declared `default`: an unrecognized value doesn't fail the row (the schema still represents it via the default), but `resolveLookup` logs `translate_lookup_default` — matching every other bounded mechanism in the engine (missing-id budget, ragged-row budget, anchorless-page budget), an unrecognized code should be visible, not silently blended into the default forever.

## Distribution model

- Source-available code (Polyform Shield 1.0.0 + Supplemental Terms). Forks self-host against own R2 + own per-source source-use assessment.
- Normalized output is private to Ashley-operated applications only, plus the feed service's gated point-lookup slice served to an explicitly authorized consumer application, server-side. No public (unauthenticated) API, public download, public query surface, or public dataset publication — the service is authenticated by a UUID bearer secret, rate-limited, and single-consumer, not public.
- Operator deployment must remain non-commercial for lifetime of any Private-use source ingested.

## GitHub Actions

- `actions/*`: tagged major (e.g., `@v6`).
- All other actions: commit SHA + version comment (e.g., `@abc123 # v4.1.0`).
- `refresh.yml` discover step auto-enumerates `sources/*.yaml` — no workflow edits when adding a source.
- **Deploy trigger:** `deploy-feed` runs on an actual feed content change, not on per-source success. `if: !cancelled()` means a single source failure (its prior slice is reused) never blocks shipping another source's update; the build step gates the Cloud Run deploy on `_deployed.json` so an all-unchanged run never redeploys. The rule is "redeploy iff the consolidated feed changed," not "skip deploy if any source failed."
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
  - `DATA_LICENSES.md` — when a source is added or its source-use posture changes.
  - `README.md` sources table (private-pipeline/cleared sources) + `README.md` `## Attribution` block — alongside any new `sources/<id>.yaml`.
  - `PRD.md` — only when goals, requirements, or constraints shift. It is planning, not a shipped-implementation log; do not restate source YAML or schema here.
- `DATA_LICENSES.md` is the single record of source for agency correspondence (every country contacted: email, sent/reply dates, status) and source-use posture. It is a flat tracker, not a reply archive: the agency's email thread is the complete verbatim record. Into the tracker capture only what downstream needs — status, source-use posture, storage/cache restrictions, and any license/attribution terms that must be quoted exactly (never paraphrased) so the `README.md` `## Attribution` block can cite them. Do not transcribe full replies into the table, and do not duplicate the table into other docs.
- `docs/source-onboarding-checklist.md`: triage worklist only. Tracking tables stay bare (Source/Sent/Follow-up/Reply/Fallback) — contact provenance, names, phones, and prefixes belong in `DATA_LICENSES.md`, not here.
- Inline code comments: WHY only (per Hard prohibitions WHAT-vs-WHY rule).
