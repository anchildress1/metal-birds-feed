# AGENTS.md

Authoritative rules for AI agents in this repo. Overrides any conflicting local file. Read `PRD.md` for context, this file for rules.

## Hard prohibitions

- PII allowed: `owner.{name,kind,state,country}` + `operator.{name,kind,state,country}`. Drop street/street2/city/postal-code/county/region/care-of at the mapping config. A country reachable from an address's trailing component is permitted — read it, don't assume it from the register's own country.
- No _public_ (unauthenticated) read API. PRD §CC.4 forbids an unauthenticated one. `src/service/` complies: bearer auth, rate-limited, one authorized consumer, and two batched exact point lookups — `/feed` on `icao_hex`, `/feed/registration` on the normalized `registration_key`. Both are point lookups on a unique key; never add an attribute query/filter/list surface or full-artifact access.
- No commercial operator deployment (PRD §CC.3).
- No public output distribution. Artifacts are private to Ashley-operated applications; forks self-host their own.
- No `..` in path inputs. Resolve to absolute, enforce sandbox-root containment after resolution, default deny.
- No quick fixes. Long-term, maintainable only.
- No `// @ts-ignore` without justifying comment. No weakening `tsconfig.json` strict settings.
- No backwards-compatibility shims when the user can simply change the code.
- No error handling for impossible scenarios. Validate at system boundaries only (user input, external APIs).
- No comments restating WHAT. Only WHY when non-obvious.
- No `.skip` on tests. Fix or delete. Never lower coverage thresholds.
- No silent loss of upstream information. If a registry publishes a structurally meaningful field the schema cannot represent, extend the canonical schema rather than drop at mapping config. PII is the only allowed drop. A field that restates a type-level property already derivable from other mapped fields is not structurally meaningful. Goal: increase info density across sources.
- No inventing data the register does not state. Null beats a plausible guess.

## Code style

- `??`/`??=` over null/undefined checks. `?.` over guard clauses.
- `const fn = () =>` over `function fn()`. `const` over `let`. Never `var`.
- No `as T` unless TS cannot narrow structurally.
- `await` over `.then()`/`.catch()`. Never `await` inside `for`/`while` — use `Promise.all`/`allSettled` + `.map()`. Exception: inherently sequential consumption (stream pumps, backoff chains) where each iteration depends on the previous — state the WHY inline.
- Max cognitive complexity per function: 15.

## Tests

- Live in `tests/` mirroring `src/`. Never colocate.
- `--isolate` is required: `mock.module` is process-global and leaks across files without it.
- Branch coverage is not enforced — `bun test` can only threshold line/function/statement.
- Every engine function: positive + negative + edge cases.
- `fixtures/<source>/` is CI ground-truth: real upstream rows, changed only with a schema or config change. Sanitize natural-person names and addresses; keep organization names and every technical value verbatim. Never fabricate a row shape the register does not emit — verify against the live file before adding one.
- `src/pipeline.ts` is covered like any other module, via `mock.module` on its dependencies. Only the `isCliEntryPoint()` bootstrap is inherently untested.
- Local-validation test files removed before commit.

## Source onboarding (PRD §CC.x — read it first)

- **Check for an ICAO 24-bit hex column before anything else.** `src/feed.ts` drops hex-less records when building a slice, so a register without one reaches the artifact but contributes zero rows to the served feed. It is the cheapest disqualifier; run it before license research. No join path recovers a hex: national registers are mutually exclusive, and third-party hex databases are neither authoritative nor license-compatible.
- Classify source-use posture per CC.1: Open / Private-use / Restrictive / Unknown.
- Private-use + Unknown: research storage/caching/automation terms first. Send permission email via `docs/agency-permission-request.md` only when private caching is unclear after public-web research.
- Restrictive means paid single-PC, no-copy, no-storage, no-scraping, view-only, no-redistribute with storage implications, or active denial (PRD §CC.5). Exclude. Document reason in `DATA_LICENSES.md`; do not email unless there is a new material fact.
- CC.2 fallback: no reply within 30 days + no terms prohibiting private caching → may proceed for private operator use. Verify no reply actually landed in Gmail before claiming a timeout; the checklist's `Fallback` column is not authoritative, `PRD.md` is. Where terms are stated but narrower than the intended use, record the residual exposure in `DATA_LICENSES.md` rather than glossing it.
- New source = all 7 surfaces or it is incomplete:
  - `sources/<id>.yaml`
  - `fixtures/<id>/` ground-truth
  - `DATA_LICENSES.md` entry
  - `README.md` sources row
  - `README.md` `## Attribution` block — required even for CC-0/public-domain (courtesy credit)
  - `src/service/attributions.ts` `NOTICES[<id>]` — a missing entry silently falls back to a generic slug credit; mandated wording stays verbatim to `DATA_LICENSES.md` `## Required Notices`. `tests/service/attributions.test.ts` enforces this; do not weaken it.
  - `docs/source-onboarding-checklist.md` `✅ Done` row — never let a shipped source vanish from the snapshot
- README sources table = alphabetical by country. `scripts/check-sources-sorted.py` runs in pre-commit; do not bypass. Insert in position, not append. That table lists sources active in the private pipeline; the full tracker lives in `DATA_LICENSES.md`.
- New scalar/array/compound transform = 2 places: the name array in `src/types/config.ts` + the handler map in `src/transforms.ts`. The loader validates off those arrays, so a missing handler fails to compile and an unlisted name fails to load.

### Research-first rule

- **Exhaust all research options before the first contact email.** National open-data portals (CKAN/Aporta/data.gov.\* listings), register pages, ToS / disclaimer text, robots policy, public license declarations. Email only once research is exhausted and storage/caching posture is still Unknown.
- **Never send a follow-up before the 30-day window expires.** A duplicate ask reads as noise and earns nothing.
- Record findings in lockstep: `DATA_LICENSES.md` (correspondence row + source-use detail, storage/cache restrictions, register-specific contact for the eventual follow-up) + `docs/source-onboarding-checklist.md` (in-flight row). Add the `README.md` sources row only once active or cleared.
- After recon on an already-emailed agency: update docs, move on. Exception — a new fact materially changes the ask (not "please confirm what we already asked"). Rare. Default is no.

## Engine extension points (use, don't reinvent)

- Spreadsheet/markup parsers keyed off `format`: `csv` → `csv-parse`; `ods`/`xlsx` → `hucre`; `xls` → `xlsx`; `html` reads the page's first `<table>` via SheetJS; `json` walks `record_path` (dot-path, empty means the response is the array).
- Multi-table/multi-sheet: `sheet:` by name or index. SheetJS names HTML tables `Sheet1`, `Sheet2`, … in order.
- `download.format: file` for a non-zip single file, with exactly one `entries` alias.
- `download.method: POST` + `body` for search endpoints that return the full register for an empty query.
- **Bot-protection edges**: `download.prime_url` fetches that URL first and replays the cookies it sets on the discovery and download requests. Exists because an Imperva/Cloudflare-style edge answers a cold request with **200 + a challenge page**, which no status-code check catches. Primed cookies are origin-locked at load and at request time — a manually replayed `Cookie` header has no browser jar enforcing `Domain`. A declared `prime_url` that sets no cookies fails loudly.
- Filename rolling: `download.discover_url` + `download.discover_pattern` (regex, one capture group; captured URL resolved against `discover_url` as base).
- Banner/metadata rows that aren't records: `source_id_transform` returning `null`; bound with `allowed_missing_source_id_rows`.
- Headerful files using explicit `columns`: `skip_rows: 1` discards the file's own header. The parser asserts the discarded header's cell count equals `columns` length — width drift means an upstream column add/remove that positional mapping would silently shuffle.
- Ragged CSV rows fail the parse (short rows null trailing fields, long rows drop cells). Known non-tabular rows: bound with `allowed_ragged_rows`, per-file, keyed by download-entry alias, default 0. Joins always parse as CSV; the primary only when `format: csv`, so a budget on a non-CSV primary is a load-time error.
- Source-published fleet total: `record_count.pattern` (regex, one capture group, matched against the decoded primary) — the engine asserts the translated count equals it and fails on mismatch, so a dropped row can't write a short artifact silently.
- Registers emitting one row per co-registered party: `merge_duplicates.fields` (canonical dotted paths joined by `separator`) + optional `set_on_merge`. Paths validate at load against `CANONICAL_PATHS` (`src/schema.ts`) — an unlisted path is stripped by re-validation and vanishes silently. Any other differing path, or a stamped path where _either_ row holds conflicting data, is a real collision and falls to recency. Never drop the extra rows.
- PDF cover/preface pages: `pdf.allowed_anchorless_pages` (default 0) bounds text-bearing pages yielding no `anchor_pattern` match. Beyond it the parse fails naming the pages (PDF sources can't use `record_count`); zero rows overall always fails. Declare cover pages explicitly — position-based tolerance silently forgives a drifted first page.
- Mapping `lookup` values may be `null`, meaning "recognized, but the schema has no value for it" — distinct from an absent key, which is unrecognized. Enumerate every upstream code with **no `default`** so an added or renamed code fails the run. Reach for `default` only where an unmatched value is routine data rather than drift; it nulls the field and logs `translate_lookup_default` per row, so it is unusable at high volume.
- A blank cell short-circuits to null before any `lookup` runs — a `transform` returning null bypasses it. Fail-loud enumeration does not cover blanks.

## Architecture invariants

- `src/schema.ts` = canonical Zod schema. All engine output validates against it before entering the artifact.
- `src/engine.ts` = source-agnostic. New registry = new YAML + (when needed) new transform/parser path. Never edit row-translation logic for one source.
- `src/db.ts` builds one SQLite artifact per source via `bun:sqlite` (in-memory → `serialize()`, no filesystem). Table `aircraft`: every canonical field its own typed column, nested objects flattened, arrays as JSON strings. `PRAGMA user_version` is the producer shape marker; bump on any column/contract change.
- R2 keys (strict):
  - `aircraft/<source>.sqlite` — per-source artifact.
  - `aircraft/_state/<source>.json` — last-run / last-content-change / `content_hash` / `upstream_hash`. The hashes are deliberately separate: `content_hash` covers the written artifact and gates the PUT, so a translation-only improvement still ships; `upstream_hash` covers the same records _before_ localization and is what `changed` reports, so a late translation never stamps `last_content_change` for a register that published nothing. Every field required — a state missing one fails validation, self-heals to absent, and the source rewrites once. Never add an optional-field fallback for an older shape.
  - `aircraft/_feed/<source>.json` — versioned per-source slice (build intermediate), collapsed on `icao_hex` where the register publishes one and on `registration_key` where it does not. Nine of fifteen publish no hex; keying the slice on hex alone silently excluded them from the feed. Both columns are nullable, and both unique indexes rely on SQLite not treating NULLs as equal. Within a source a hex-bearing row supersedes a hex-less one sharing its mark (same aircraft, less complete row). Across the merged feed a mark claimed by two aircraft is cleared to null rather than resolved — a wrong answer is worse than a miss — and a hex-less row that loses its mark is dropped, since nothing can select it; `feed_registration_key_ambiguous` reports both counts. Cancelled records are excluded when the slice is written — once, in `toFeedRows`, since every slice comes from there. A schema change to the slice is handled by bumping `FEED_SLICE_VERSION` so older slices fail validation and each source regenerates one, never by migrating or by filtering old shapes at merge: a slice written by an earlier producer is short by rows the current one keeps, and migrating it would publish that gap. The per-source artifact still carries the full history — this is a feed-scope filter, not upstream loss. `main()` merges every slice into one `feed.sqlite` (`src/feed.ts`). Cadence-skip requires the slice to exist (self-heal, like the artifact); publish fails closed if any is missing.
  - `aircraft/_feed/_deployed.json` — `hashFeedRows` of the feed last deployed. The scheduled `deploy-feed` job redeploys only on a difference and advances this only after a successful deploy.
  - `aircraft/_translation_cache/<source>.json` — versioned envelope of sha256(field+text) → English, for Gemini delta translation of `cancellation_reason`, `airworthiness_class`, `lien_status`, `operational_classes` (each array element hashed individually). `idera_authorised_party` is never a candidate — always a party's NAME, not descriptive text. A contract-version mismatch invalidates the whole prior generation rather than retaining unreachable entries. Persists independently of the content-hash skip gate.
- Every source declares `language:` (ISO 639-1). `language: en` skips the Gemini pass entirely — rendering English as English rewords curated labels (tc-ca's `Certificate of Airworthiness`) and invents meaning for bare codes (faa's `1`, `4`), overwriting the canonical field in both artifact and feed. Required, never defaulted: the value decides whether a source is billed to Gemini at all. `FIELD_EXCLUDED_FOR_SOURCE` (`localize.ts`) covers the narrower case — one field inside an otherwise-translatable source that already yields English via a deterministic mapping. It guards both collection and application, so a cache entry written before the exclusion existed cannot overwrite the mapping.
- `src/localize/` renders those fields English-primary in both the artifact and the feed. Each translatable field has a companion `<field>_source_text`, captured at parse time in `engine.ts` before any English rendering — that is what satisfies a license requiring the source meaning not be distorted (e.g. AESA Spain), not leaving the primary field non-English. A source whose primary field is already English via a parse-time transform declares an explicit `<field>_source_text` YAML mapping back to the raw value, since the transform would otherwise discard it. `localize.ts` dedupes by content hash before calling Gemini; a translation replaces the primary field in place. A cache miss falls the primary field back to the original text, never `null` — only `source_text` is guaranteed untranslated. A rejected key throws — a missing one via `requireEnv`, a revoked/wrong-project/billing-disabled one via the 401/403 that Gemini answers with. Both are setup bugs that recur identically every run, so a warn would ship untranslated data indefinitely behind a green pipeline, and nothing else catches it: staleness keys off `upstream_hash`, which keeps advancing while the register publishes and the translator stays broken. Failing costs that source's refresh only — `deploy-feed` runs under `!cancelled()` and reuses its prior slice. Every other Gemini or cache failure degrades to source text.
- Deploy/runtime chain: R2 is build+intermediate store only; nothing serves reads from R2. `make assemble-feed` rebuilds `feed.sqlite` from every R2 `_feed` slice, never from an ambient on-disk copy; `make build-feed` refreshes every source first and then assembles. Both sequence through the recipe rather than prerequisites, so a parallel `make -j` cannot assemble mid-refresh. The DB is **baked into the Cloud Run image** and served in-memory by `bun:sqlite` — single instance, scale-to-zero, no runtime R2 or DB fetch. A data change reaches production only by redeploying a new image.
- The artifact PUT is gated on `content_hash` (sha256 over the sorted record set). Registry data lives inside the SQLite, never in an R2 key, so it carries no key-escaping constraint.
- FAA `UNIQUE ID` = `source_id`, never N-number. N-numbers are reissued; UNIQUE ID is permanent. More generally: a per-row surrogate key that changes between publications is not a `source_id`.
- Duplicate `source_id` within a source: byte-identical rows skip; differing rows resolve via `resolveRecency` (`src/engine.ts`) only when a real signal exists. A collision with no signal fails the run — never last-wins, which silently drops upstream data.

## Distribution model

- Source-available code (Polyform Shield 1.0.0 + Supplemental Terms). Forks self-host against their own R2 + their own per-source source-use assessment.
- Normalized output is private to Ashley-operated applications, plus the feed service's gated slice. No public download, query surface, or dataset publication.
- Operator deployment must remain non-commercial for the lifetime of any Private-use source ingested.

## GitHub Actions

- `actions/*`: tagged major. All others: commit SHA + version comment (`@abc123 # v4.1.0`).
- `refresh.yml` discovers `sources/*.yaml` automatically — no workflow edit when adding a source.
- **Deploy trigger:** `deploy-feed` runs on an actual feed content change, not per-source success. `!cancelled()` means one source failing (its prior slice is reused) never blocks shipping another's update; the build step gates the deploy on `_deployed.json`. The rule is "redeploy iff the consolidated feed changed."
- **Refresh cadence:** where a declared cadence and the observed publishing rhythm differ, run at the **more frequent** of the two, and record both in `DATA_LICENSES.md`. Per-source `cadence_days` gates actual work; sources without it run every time the cron fires. Sources publishing faster than the cron need their own workflow. The downloader sends no conditional-request headers, so each run is a full fetch — `content_hash` still gates the PUT.

## Commits

- Conventional Commits. **Lowercase type + subject** (commitlint rejects sentence-case/start-case).
- RAI footer: **exactly one**, carrying a contact. `rai-footer-exists` grades by contribution and rejects if none matches: `Authored-by` human-only · `Commit-generated-by` trivial AI · `Assisted-by` AI-helped but human-written · `Co-authored-by` ~50/50 · `Generated-by` AI-majority. Pick honestly. AI-majority is the normal case here. Never stack a second footer naming the same model — a harness default asking for `Co-Authored-By` does not override this. A genuinely distinct agent (e.g. `Codex <noreply@openai.com>`) gets its own line.
- Atomic: each commit independently typechecks, lints, passes tests. Don't sweep unrelated working-tree changes into a commit.
- Never skip hooks with `--no-verify`.

## Branch hygiene — scope creep prevention

Scope = branch name + first commit's diff shape. Nothing else.

- `feat/*`: `src/`, `tests/`, `sources/`, `fixtures/`, plus docs for that feature only.
- `docs/*`: `README.md`, `DATA_LICENSES.md`, `docs/*` only. No code/sources/fixtures.
- `fix/*`: bug + tests proving it. Nothing else.
- `chore/*`: tooling, CI, deps. Nothing user-facing.

Out-of-scope work → new branch, even if small. Trigger: active `feat/*` and asked for license triage or unrelated docs; active `docs/*` and asked for code; commit log already shows two themes and a third is asked.

Switch: commit/stash → state the mismatch in one line → branch from `main` (not the active branch, which carries unwanted commits) → return when the feature resumes.

Never call a mix "related" when the only link is one conversation. Diff hard to title in one line → two PRs.

## Documentation

- Prose carries intent, rationale, and license/legal facts — never restate what `sources/*.yaml`, `src/schema.ts`, or other code already states. Link, don't transcribe. Per-source mechanics, field mappings, and schema field lists belong in the YAML/schema.
- Don't create new top-level doc files unilaterally. Ask first; the answer is usually "fold into an existing one". Exception: source-onboarding artifacts in the standard workflow.
- Required updates when underlying state changes: `DATA_LICENSES.md` (source added or posture changed) · `README.md` sources table + `## Attribution` (alongside any new `sources/<id>.yaml`) · `PRD.md` (only when goals, requirements, or constraints shift — it is planning, not a shipped-implementation log).
- `DATA_LICENSES.md` is the single record of source for correspondence and posture. Flat tracker, not a reply archive — the email thread is the verbatim record. Capture status, posture, storage/cache restrictions, and terms that must be quoted exactly for the README `## Attribution` block. Don't transcribe replies; don't duplicate the table elsewhere.
- `docs/source-onboarding-checklist.md`: triage worklist only. Tracking tables stay bare — contact provenance, names, phones, and prefixes belong in `DATA_LICENSES.md`.
- When a decision reverses an earlier one, say so explicitly in the commit body and update the rule here in the same commit. A stale rule that happens to match new behavior is worse than none.
