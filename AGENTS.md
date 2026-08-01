# AGENTS.md

Authoritative rules for AI agents in this repo. Overrides any conflicting local file. Read `PRD.md` for context, this file for rules.

## Hard prohibitions

- PII allowed: `owner.{name,kind,state,country}` + `operator.{name,kind,state,country}`. Drop street/street2/city/postal-code/county/region/care-of at the mapping config.
- No _public_ (unauthenticated) read API. PRD §CC.4 "no public read API" = no _unauthenticated_ one. The feed service (`src/service/`) complies and is allowed: `FEED_TOKEN` bearer auth, rate-limited, batched exact-`icao_hex` point lookup, one authorized server-side consumer. Never add an attribute query/filter/list surface or full-artifact access. Direct R2 artifact access stays private-operator-binding only.
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
- `src/pipeline.ts` holds real business logic and is covered like any other module, via `mock.module` on its dependencies. Only the `isCliEntryPoint()` bootstrap is inherently untested.
- Local-validation test files removed before commit.

## Source onboarding (PRD §CC.x — read it first)

- Classify source-use posture per CC.1: Open / Private-use / Restrictive / Unknown.
- Private-use + Unknown: research storage/caching/automation terms first. Send permission email via `docs/agency-permission-request.md` only when private caching is unclear after public-web research.
- Restrictive means paid single-PC, no-copy, no-storage, no-scraping, view-only, no-redistribute with storage implications, or active denial (PRD §CC.5 storage/caching gate). Exclude. Document reason in `DATA_LICENSES.md`; do not email unless there is a new material fact.
- New source = all 7 surfaces or it is incomplete:
  - `sources/<id>.yaml`
  - `fixtures/<id>/` ground-truth
  - `DATA_LICENSES.md` entry
  - `README.md` sources row
  - `README.md` `## Attribution` block — required even for CC-0/public-domain (courtesy credit)
  - `src/service/attributions.ts` `NOTICES[<id>]` — a missing entry silently falls back to a generic slug credit; mandated wording stays verbatim to `DATA_LICENSES.md` `## Required Notices`. `tests/service/attributions.test.ts` enforces this; do not weaken it.
  - `docs/source-onboarding-checklist.md` `✅ Done` row — never let a shipped source vanish from the snapshot
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
- Registers emitting one row per co-registered party: `merge_duplicates.fields` (canonical dotted paths joined by `separator`) + optional `set_on_merge` (paths stamped on merge). Paths validate at load against `CANONICAL_PATHS` (`src/schema.ts`) — an unlisted path is stripped by re-validation and vanishes silently. Any other differing path, or a stamped path where _either_ row holds conflicting data, is a real collision and falls to recency. Never drop the extra rows.
- PDF cover/preface pages (text, zero anchors by design): `pdf.allowed_anchorless_pages` (default 0) bounds how many text-bearing pages may yield no `anchor_pattern` matches. Beyond the budget the parse fails naming the pages (a drifted register page drops its fleet slice and PDF sources can't use `record_count`); zero rows overall always fails regardless of budget. Declare cover pages explicitly — position-based tolerance would silently forgive a drifted first page.

## Architecture invariants

- `src/schema.ts` = canonical Zod schema. All engine output validates against it before going into the artifact.
- `src/engine.ts` = source-agnostic. New registry = new YAML + (when needed) new transform/parser path. Never edit engine row-translation logic for a single source.
- `src/db.ts` builds one SQLite artifact per source via `bun:sqlite` (in-memory → `serialize()` bytes, no filesystem). Table `aircraft`: every canonical field its own typed column, nested objects flattened, arrays as JSON strings — consumers filter/sort on any field, not just point lookups. `PRAGMA user_version` is the producer shape marker; bump on any column/contract change.
- R2 keys (strict):
  - `aircraft/<source>.sqlite` — the per-source artifact (replaces the prior object-per-record + by-hex/by-registration index + manifest scheme).
  - `aircraft/_state/<source>.json` — last-run / last-content-change / `content_hash` for cadence gating and skip-if-unchanged, plus `upstream_hash`. The two are deliberately separate: `content_hash` covers the written (post-translation) artifact and gates the PUT, so a translation-only improvement still ships; `upstream_hash` covers the same records _before_ localization and is what `changed` reports, so a translation landing late never stamps `last_content_change` and closes a staleness issue for a register that published nothing. Every field is required — state missing one fails validation, self-heals to absent, and the source rewrites once. Never add an optional-field fallback to accommodate an older shape.
  - `aircraft/_feed/<source>.json` — per-source hex-collapsed feed slice (build intermediate). `main()` merges every source's slice into one consolidated `feed.sqlite` (`src/feed.ts`) served by the Cloud Run feed service (`src/service/`, single instance, baked DB). Cadence-skip requires this slice to exist too (self-heal, like the artifact); publish fails closed if any source's slice is missing.
  - `aircraft/_feed/_deployed.json` — content hash (`hashFeedRows`, sha256 over the sorted merged rows) of the feed last deployed to Cloud Run. The scheduled `deploy-feed` job redeploys only when the freshly built feed differs from this, and advances it only after a successful deploy.
  - `aircraft/_translation_cache/<source>.json` — versioned envelope of sha256(field+text) → English text, for Gemini delta translation of `cancellation_reason`, `airworthiness_class`, `lien_status`, and `operational_classes` (each array element hashed individually). `idera_authorised_party` is never a candidate — it's always a party's NAME, not descriptive text. A whole English-language register is excluded by its `language:` declaration (mv-caa's `mortgage` cell holds a mortgagee's NAME, and mv-caa publishes in English, so it never reaches Gemini at all); the only field-level exclusion left is `operational_classes` for sources whose mapping already yields canonical English tokens. A contract-version mismatch invalidates the whole prior generation instead of retaining unreachable entries. Persists independently of the artifact's content-hash skip gate.
- Every source declares `language:` (ISO 639-1) in its YAML. `language: en` skips the Gemini pass entirely — asking a translator to render English as English rewords curated labels (tc-ca's `Certificate of Airworthiness`) and invents meaning for bare codes (faa's `1`, `4`), and the result would overwrite the canonical field in both the artifact and the served feed. `FIELD_EXCLUDED_FOR_SOURCE` (`localize.ts`) handles the narrower case: one field inside an otherwise-translatable source that already yields English or a canonical token (cl-dgac's lookup, no-caa's English category names). Required, never defaulted — the value decides whether a source is billed to Gemini at all.
- `src/localize/` renders those fields English-primary, everywhere — the canonical artifact and the served feed both carry English in the primary field, not just the feed. Each translatable field has a companion `<field>_source_text`, captured once at parse time (`engine.ts`, before any English rendering), holding the untranslated original — that's what satisfies a license requiring the source meaning not be distorted (e.g. AESA Spain), not leaving the primary field non-English. A source whose primary field is already rendered in English by a deterministic parse-time transform (AESA's `clase` → `es_aesa_class_en`) declares an explicit `<field>_source_text` YAML mapping back to the raw upstream value (see `sources/es-aesa.yaml`), since the transform would otherwise discard it before `localize.ts` ever runs. `localize.ts` dedupes by content hash before calling Gemini; a translated value replaces the primary field in place. A cache miss (translation not yet run, or Gemini/cache failed) falls the primary field back to the original text rather than `null` — the API always carries whatever content is available, and only `source_text` is guaranteed to stay untranslated. Only a missing `GEMINI_API_KEY` deliberately throws: that's a setup bug, not a runtime blip.
- Deploy/runtime chain (R2 is build+intermediate store only; nothing serves reads from R2). `make build-feed` rebuilds `feed.sqlite` from every R2 `_feed` slice — never from an ambient on-disk copy. `make deploy` = `build-feed` then `deploy-only`. The DB is **baked into the Cloud Run image** (`Dockerfile` COPYs `feed.sqlite`; `MBF_FEED_DB_PATH=/app/feed.sqlite`), served in-memory by `bun:sqlite` — single instance, scale-to-zero, no runtime R2 or DB fetch. Reads never touch R2; a data change reaches production only by a redeploy of a new image.
- The artifact PUT is gated on `content_hash` (sha256 over the sorted record set, in `db.ts`): unchanged set → no PUT. Registry data (`source_id`/`registration`/`icao_hex`) lives inside the SQLite, never in an R2 key — so it carries no key-escaping constraint.
- FAA `UNIQUE ID` = `source_id`, never N-number. N-numbers are reissued; UNIQUE ID is permanent.
- Duplicate `source_id` within a source: byte-identical rows skip; differing rows resolve via `resolveRecency` (`src/engine.ts`) only when a real signal exists. A collision with no signal fails the run — never last-wins, which silently drops upstream data.
- A mapping `lookup` with a declared `default`: an unrecognized value doesn't fail the row (the schema still represents it via the default), but `resolveLookup` logs `translate_lookup_default` — matching every other bounded mechanism in the engine (missing-id budget, ragged-row budget, anchorless-page budget), an unrecognized code should be visible, not silently blended into the default forever.

## Distribution model

- Source-available code (Polyform Shield 1.0.0 + Supplemental Terms). Forks self-host against own R2 + own per-source source-use assessment.
- Normalized output is private to Ashley-operated applications only, plus the feed service's gated slice (terms under Hard prohibitions). No public download, query surface, or dataset publication.
- Operator deployment must remain non-commercial for lifetime of any Private-use source ingested.

## GitHub Actions

- `actions/*`: tagged major (e.g., `@v6`).
- All other actions: commit SHA + version comment (e.g., `@abc123 # v4.1.0`).
- `refresh.yml` discover step auto-enumerates `sources/*.yaml` — no workflow edits when adding a source.
- **Deploy trigger:** `deploy-feed` runs on an actual feed content change, not on per-source success. `if: !cancelled()` means a single source failure (its prior slice is reused) never blocks shipping another source's update; the build step gates the Cloud Run deploy on `_deployed.json` so an all-unchanged run never redeploys. The rule is "redeploy iff the consolidated feed changed," not "skip deploy if any source failed."
- **Refresh cadence rule:** when a source declares one cadence but the observed publishing rhythm differs, the GHA refresh must run at the **more frequent** of the two. Record both values in `DATA_LICENSES.md` under that source's `Update cadence` block. The current fleet-wide cron is daily (`0 6 * * *`); per-source `cadence_days` in the source YAML controls how often each source actually runs — sources without `cadence_days` run every day the cron fires. Sources publishing faster than daily require their own workflow. Source mappings should use conditional fetch (`Last-Modified` / `ETag` / filename-change detection) so polling more frequently than the publishing rhythm stays cheap.

## Commits

- Conventional Commits. **Lowercase type + subject** (commitlint rejects sentence-case/start-case).
- RAI footer: **exactly one**, and it must carry a contact. AI-majority changes (the normal case here) use `Generated-by: Claude <Model> <noreply@anthropic.com>` with the actual model. Never stack a second footer naming that same model — a harness default asking for `Co-Authored-By` does not override this.
- `rai-footer-exists` (`@checkmarkdevtools/commitlint-plugin-rai`) grades the footer by contribution and rejects the commit if none matches: `Authored-by` human-only · `Commit-generated-by` trivial AI · `Assisted-by` AI-helped but human-written · `Co-authored-by` ~50/50 · `Generated-by` AI-majority. Pick honestly. A second, genuinely distinct agent (e.g. `Codex <noreply@openai.com>`) gets its own line.
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
- `DATA_LICENSES.md` is the single record of source for agency correspondence and source-use posture. Flat tracker, not a reply archive — the email thread is the verbatim record. Capture only what downstream needs: status, posture, storage/cache restrictions, and license/attribution terms that must be quoted exactly (never paraphrased) for the README `## Attribution` block. Don't transcribe replies; don't duplicate the table into other docs.
- `docs/source-onboarding-checklist.md`: triage worklist only. Tracking tables stay bare (Source/Sent/Follow-up/Reply/Fallback) — contact provenance, names, phones, and prefixes belong in `DATA_LICENSES.md`, not here.
- Inline code comments: WHY only (per Hard prohibitions WHAT-vs-WHY rule).
