# AGENTS.md

Authoritative rules for AI agents in this repo. Overrides any conflicting local file. Read `PRD.md` for context, this file for rules.

## Audience

- Only AI agents read this file; assume zero human readers.
- Treat `AGENTS.md` and every other agent instruction or skill file as a machine-operational control surface.
- Optimize for deterministic execution: state scopes, triggers, priorities, required actions, prohibitions, and exit conditions explicitly.
- Exclude human onboarding, persuasion, tutorials, motivational rationale, narrative transitions, and status prose unless they materially disambiguate agent behavior.
- Human-facing documentation conventions apply only to product documentation; never use them to shape agent control files.

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
- `const fn = () =>` over `function fn()`. `const` over `let`. Never `var`. Exception: a module-private helper called above its own definition stays a `function` declaration — `engine.ts` relies on hoisting, and converting one to `const` is a TDZ crash, not a style win. Nothing enforces this rule mechanically, so read the call order before converting.
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

- **A missing ICAO 24-bit hex column is no longer a disqualifier.** It was one while `src/feed.ts` dropped hex-less records; it now collapses them on `registration_key` instead, so a hex-less register contributes to the served feed. Record the coverage cost rather than rejecting the source: without a hex those rows are unreachable from an ADS-B blip, so they answer tail-number lookups only. No join path recovers a hex — national registers are mutually exclusive, and third-party hex databases are neither authoritative nor license-compatible — so a register that publishes one is still worth more than one that does not. What a source must have is a registration mark; the schema requires it, and a mark that normalizes to nothing costs that row both keys.
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
- Record findings in lockstep: `DATA_LICENSES.md` (correspondence row + source-use detail, storage/cache restrictions) + `docs/source-onboarding-checklist.md` (in-flight row). Add the `README.md` sources row only once active or cleared.
- **Do not keep an agency email address in `DATA_LICENSES.md` unless that agency actually replied.** Reverses the earlier rule that kept a contact against an eventual follow-up. The address for a non-replier earns nothing — Gmail is the record of who was written to and is the ground truth for whether anything came back — while the tracker accumulates stale addresses that read as verified and are not: the recorded Lithuanian contact had bounced at send time and sat in the table for three months. `Email` is `n/a` for any row whose `Reply` is `pending`.
- After recon on an already-emailed agency: update docs, move on. Exception — a new fact materially changes the ask (not "please confirm what we already asked"). Rare. Default is no.

## Engine extension points (use, don't reinvent)

- Spreadsheet/markup parsers keyed off `format`: `csv` → `csv-parse`; `ods`/`xlsx` → `hucre`; `xls` → `xlsx`; `html` reads the page's first `<table>` via SheetJS; `json` walks `record_path` (dot-path, empty means the response is the array).
- Multi-table/multi-sheet: `sheet:` by name or index. SheetJS names HTML tables `Sheet1`, `Sheet2`, … in order.
- `download.format: file` for a non-zip single file, with exactly one `entries` alias.
- `download.method: POST` + `body` for search endpoints that return the full register for an empty query.
- **Bot-protection edges**: `download.prime_url` fetches that URL first and replays the cookies it sets on the discovery and download requests. Exists because an Imperva/Cloudflare-style edge answers a cold request with **200 + a challenge page**, which no status-code check catches. Primed cookies are origin-locked at load and at request time — a manually replayed `Cookie` header has no browser jar enforcing `Domain`. A declared `prime_url` that sets no cookies fails loudly.
- Filename rolling: `download.discover_url` + `download.discover_pattern` (regex, one capture group; captured URL resolved against `discover_url` as base).
- Banner/metadata rows that aren't records: `source_id_transform` returning `null`; bound with `allowed_missing_source_id_rows`.
- Registers whose feed **accumulates publications** instead of replacing them (data.gov.lt republishes the whole register and keeps every prior dump): `latest_snapshot_by: <column>` keeps only the rows at that column's maximum value, compared as strings, dropping the rest before translation and logging `translate_snapshot_filtered`. Required for such a source, not an optimization — the same mark appears cancelled in the newest publication and active in an older one, and since the feed excludes cancelled rows it would keep the stale active one and answer a lookup with a superseded record. An empty column on every row throws rather than dropping everything.
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
- **Three version markers, bumped independently — check all three on every schema change.** `db.ts` `PRAGMA user_version` (per-source artifact) · `feed.ts` `PRAGMA user_version` (consolidated `feed.sqlite`) · `FEED_SLICE_VERSION` (the R2 JSON intermediate). Their numbers coinciding is chance, never a reason to skip one.
  - The two `PRAGMA user_version` markers describe the **consumer-facing contract**; `FEED_SLICE_VERSION` describes the **slice's structure**. They answer different questions, so they do not move together.
  - Widening a canonical enum's **value domain** is a contract change: bump the `user_version` of every DB whose table carries that column. A widened `category` shipped to the feed under a stale marker once, so consumers were told a shape version that predated the values they were being served.
  - A value-domain change does **not** bump `FEED_SLICE_VERSION`. That marker exists so a structurally older slice — one short by rows the current producer keeps — fails validation instead of publishing the gap. A widened enum leaves the slice structurally identical and merely un-refreshed; nulls are legal in every version, so the stale cells self-heal on the source's normal cadence. Bumping anyway would invalidate all 16 slices at once and fail the next release deploy closed for no correctness gain.
  - Column add/remove/rename on `aircraft` → `db.ts`. On `feed` → `feed.ts` **and** `FEED_SLICE_VERSION` (the structure genuinely changed).
  - `tests/db.test.ts` and `tests/feed.test.ts` pin each marker; update the assertion in the same commit or the bump is not real.
- R2 keys (strict):
  - `aircraft/<source>.sqlite` — per-source artifact.
  - `aircraft/_state/<source>.json` — last-run / last-content-change / `content_hash` / `upstream_hash`. The hashes are deliberately separate: `content_hash` covers the written artifact and gates the PUT, so a translation-only improvement still ships; `upstream_hash` covers the same records _before_ localization and is what `changed` reports, so a late translation never stamps `last_content_change` for a register that published nothing. Every field required — a state missing one fails validation, self-heals to absent, and the source rewrites once. Never add an optional-field fallback for an older shape.
  - `aircraft/_feed/<source>.json` — versioned per-source slice (build intermediate), collapsed on `icao_hex` where the register publishes one and on `registration_key` where it does not. Ten of sixteen publish no hex; keying the slice on hex alone silently excluded them from the feed. Both columns are nullable, and both unique indexes rely on SQLite not treating NULLs as equal. Within a source a hex-bearing row supersedes a hex-less one sharing its mark (same aircraft, less complete row). Across the merged feed a mark claimed by two aircraft is cleared to null rather than resolved — a wrong answer is worse than a miss — and a hex-less row that loses its mark is dropped, since nothing can select it; `feed_registration_key_ambiguous` reports both counts. Cancelled **and reserved** records are excluded when the slice is written — once, in `toFeedRows`, since every slice comes from there. Reserved is not a weaker cancelled: it means no airframe exists behind the mark, and a register may still publish the intended model against the row, so serving it answers a lookup with an aircraft that was never built. A register publishing held marks must map them to `status: reserved`, never `other` — `other` is served. A schema change to the slice is handled by bumping `FEED_SLICE_VERSION` so older slices fail validation and each source regenerates one, never by migrating or by filtering old shapes at merge: a slice written by an earlier producer is short by rows the current one keeps, and migrating it would publish that gap. The per-source artifact still carries the full history — this is a feed-scope filter, not upstream loss. `main()` merges every slice into one `feed.sqlite` (`src/feed.ts`). Cadence-skip requires the slice to exist (self-heal, like the artifact); publish fails closed if any is missing.
  - `aircraft/_feed/_deployed.json` — `hashFeedRows` of the feed last deployed. The scheduled `deploy-feed` job redeploys only on a difference and advances this only after a successful deploy.
  - `aircraft/_translation_cache/<source>.json` — versioned envelope of sha256(field+text) → English, for Gemini delta translation of `cancellation_reason`, `airworthiness_class`, `lien_status`, `operational_classes` (each array element hashed individually). `idera_authorised_party` is never a candidate — always a party's NAME, not descriptive text. A contract-version mismatch invalidates the whole prior generation rather than retaining unreachable entries. Persists independently of the content-hash skip gate. **A translating run writes the cache back before calling Gemini** (`persistCache`, `localize.ts`) and skips the batch when that write fails — an unwritable cache keeps nothing the run buys, so the identical delta is re-billed every run. In the steady state that PUT rewrites the object byte-for-byte; it guards Gemini spend and must not be removed as a redundant write. It also makes an obsolete-generation reset durable, bounding a version bump to one paid regeneration.
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
- **One deploy job, in `deploy.yml`, reached only by `workflow_call`.** Two callers: `release-please.yml` on a release (`force: true` — a version bump ships even with unchanged data) and `refresh.yml` after the daily pull (`force: false` — the called workflow assembles, then deploys only when the result differs from `_deployed.json`). Never give `deploy.yml` a trigger of its own, and never add deploy steps to a caller: `tests/workflows/deploy.test.ts` scans every `.yml`/`.yaml` workflow for `/\bmake deploy\b/` (covering `make deploy` and `make deploy-only`) or `gcloud run deploy`, and fails if a second one appears.
- **Its concurrency group is the constant `cloud-run-deploy` (`queue: max`, `cancel-in-progress: false`).** Inside a called workflow `${{ github.workflow }}` resolves to the _caller's_ name, so an interpolated group would file the release deploy and the refresh deploy separately — the race the group exists to prevent — and can cancel the caller. The explicit maximal queue is required: GitHub's default retains only one pending run and replaces it when a third arrives, which can silently discard a forced release deploy. Queue rather than cancel: a deploy killed halfway leaves the service updated while the marker still names the old hash. Until actionlint ships `concurrency.queue` support, `.github/actionlint.yaml` ignores only its stale unknown-key error and `tests/workflows/deploy.test.ts` pins the value to `max`.
- **A caller must grant `contents: read` + `id-token: write`.** Called-workflow permissions can only be downgraded by the caller, so an omitted grant breaks Workload Identity at deploy time, not at lint time. Pass exactly the four declared R2 credentials; never use `secrets: inherit`.
- **The release deploy assembles from existing R2 slices; it does not refresh first.** `resolveAllSources()` reads `sources/*.yaml` at the released commit and `publishFeed` fails closed when any of them lacks a current slice, so a release that adds a source or bumps `FEED_SLICE_VERSION` fails to deploy until a refresh has written slices for it. That ordering is deliberate — running the 16-register pull inside the release path would add ~30 minutes to every release and contend with the `registry-refresh-gemini` quota group. Land such a change, let a refresh run (cron or manual `refresh.yml` dispatch), then release. Recovery is: run `refresh.yml`, then **Re-run failed jobs** on the same release run — not _Re-run all jobs_, which makes Release Please see the release as already created, report `release_created=false`, and skip the deploy instead of retrying it. `deploy.yml`'s `Explain the assembly failure` step prints exactly that, scoped to the assemble step's own outcome so a failed version check does not print refresh advice. Never relax the fail-closed check to get past it.
- A `refresh.yml` run waiting on `cloud-run-deploy` keeps holding `registry-refresh-gemini` while it waits, because its deploy job is the last thing in that run. A manual refresh dispatched during a release deploy therefore sits blocked with no visible cause until the release finishes. One-directional, so it cannot deadlock — do not "fix" it by giving the deploy its own group.
- Ad-hoc deploys (rollback, retry, shipping without a release) are a local `make deploy` — same R2 slices, same path. Do not add a `workflow_dispatch` deploy button.
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
- **Three onboarding surfaces, one audience each — a change to `make` targets, `.env.example`, or a required env var updates all three or none.** `docs/getting-started.md` (non-developer, manual) · `docs/getting-started-with-ai.md` (non-developer, agent-driven) · `.agents/skills/setup-metal-birds-feed/SKILL.md` (the agent itself). The skill is the only one an agent executes; the other two are human product documentation and keep human-facing conventions, so the AI-only style rule above does not apply to them.
- **The skill's one real copy is `.agents/skills/setup-metal-birds-feed/SKILL.md`.** `.agents/` is vendor-neutral and is what Codex scans natively. Claude Code scans only `~/.claude/skills/` and `.claude/skills/`, so the repo also tracks a symlink `.claude/skills/setup-metal-birds-feed → ../../.agents/skills/setup-metal-birds-feed` (git mode `120000`, relative target so it resolves after a clone anywhere). Claude Code follows symlinks, so both tools discover the same file and there is nothing to keep in sync. Edit the `.agents/` copy; never replace the symlink with a second real file. `.gitignore` therefore keeps `.claude/*` + `!.claude/skills/` — ignoring `.claude/` instead silently kills the negation, since git cannot re-include under an excluded directory, and the symlink vanishes from every clone with nothing failing. `tests/onboarding.test.ts` asserts the symlink exists and resolves. Windows clones without `core.symlinks` get a text file instead; the AI guide documents that and the fallback.
- Never put a literal registration, hex, or record in onboarding docs as a worked example. Read one out of the built artifact at runtime instead: a hardcoded mark is invented data the register may not state, and it reads as a broken service the day it stops matching.
- `DATA_LICENSES.md` is the single record of source for correspondence and posture. Flat tracker, not a reply archive — the email thread is the verbatim record. Capture status, posture, storage/cache restrictions, and terms that must be quoted exactly for the README `## Attribution` block. Don't transcribe replies; don't duplicate the table elsewhere.
- `docs/source-onboarding-checklist.md`: triage worklist only. Tracking tables stay bare — contact provenance, names, phones, and prefixes belong in `DATA_LICENSES.md`.
- When a decision reverses an earlier one, say so explicitly in the commit body and update the rule here in the same commit. A stale rule that happens to match new behavior is worse than none.
