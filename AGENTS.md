Overrides any conflicting local file. `PRD.md` carries context; this file carries rules.

Agent control files (`AGENTS.md`, `SKILL.md`, their `references/*`) have one reader: a model about to act. State scope, trigger, action, prohibition, exit condition. No onboarding, tutorials, motivational rationale, or status prose. Human-doc conventions apply only to product documentation.

## Hard prohibitions

- PII allowed: `owner.{name,kind,state,country}` + `operator.{name,kind,state,country}`. Drop street/street2/city/postal-code/county/region/care-of at the mapping config. A country reachable from an address's trailing component is permitted — read it, never assume it from the register's own country.
- No unauthenticated read API (PRD §CC.4). `src/service/` is bearer-auth, rate-limited, one consumer, two batched point lookups: `/feed` on `icao_hex`, `/feed/registration` on `registration_key`. Never add an attribute query/filter/list surface or full-artifact access.
- No commercial operator deployment (PRD §CC.3).
- No public output distribution. Artifacts are private to Ashley-operated applications; forks self-host.
- No `..` in path inputs. Resolve to absolute, enforce sandbox-root containment after resolution, default deny.
- No quick fixes.
- No `// @ts-ignore` without a justifying comment. Never weaken `tsconfig.json` strict settings.
- No backwards-compatibility shims.
- No error handling for impossible scenarios. Validate at system boundaries only.
- No comments restating WHAT. WHY only, when non-obvious.
- No `.skip` on tests. Fix or delete. Never lower coverage thresholds.
- No silent loss of upstream information. Extend `src/schema.ts` rather than dropping a structurally meaningful field at mapping config. PII is the only allowed drop. A field restating a type-level property already derivable from mapped fields is not structurally meaningful.
- No inventing data the register does not state. Null beats a plausible guess.

## Code style

- `??`/`??=` over null/undefined checks. `?.` over guard clauses.
- `const fn = () =>` over `function fn()`. `const` over `let`. Never `var`. Exception: a module-private helper called above its own definition stays a `function` — `engine.ts` relies on hoisting, so converting it is a TDZ crash. Nothing enforces this; read the call order first.
- No `as T` unless TS cannot narrow structurally.
- `await` over `.then()`/`.catch()`. Never `await` inside `for`/`while` — use `Promise.all`/`allSettled` + `.map()`. Exception: inherently sequential consumption (stream pumps, backoff chains); state the WHY inline.
- Max cognitive complexity per function: 15.

## Tests

- Live in `tests/` mirroring `src/`. Never colocate.
- `--isolate` required: `mock.module` is process-global and leaks across files.
- Branch coverage is not enforced; `bun test` thresholds line/function/statement only.
- Every engine function: positive + negative + edge cases.
- `fixtures/<source>/` is CI ground-truth: real upstream rows, changed only with a schema or config change. Sanitize natural-person names and addresses; keep organization names and every technical value verbatim. Verify against the live file before adding a row shape.
- `src/pipeline.ts` is covered via `mock.module` on its dependencies. Only `isCliEntryPoint()` is untested.
- Remove local-validation test files before commit.

## Source onboarding (read PRD §CC.x first)

- A missing ICAO 24-bit hex is not a disqualifier: `src/feed.ts` collapses hex-less records on `registration_key`. Record the coverage cost — those rows answer tail-number lookups only, unreachable from an ADS-B blip. No join path recovers a hex (national registers are mutually exclusive; third-party hex databases are neither authoritative nor license-compatible).
- A registration mark is mandatory. A mark normalizing to nothing costs that row both keys.
- Classify posture per CC.1: Open / Private-use / Restrictive / Unknown.
- Private-use + Unknown: research storage/caching/automation terms first. Email via `docs/agency-permission-request.md` only when private caching is still unclear.
- Restrictive = paid single-PC, no-copy, no-storage, no-scraping, view-only, no-redistribute with storage implications, or active denial (PRD §CC.5). Exclude; record the reason in `DATA_LICENSES.md`. Do not email absent a new material fact.
- CC.2 fallback: no reply in 30 days + no terms prohibiting private caching → proceed for private operator use. Verify in Gmail that no reply landed; `PRD.md` is authoritative, not the checklist's `Fallback` column. Record residual exposure where terms are narrower than the intended use.
- New source = all 7 surfaces:
  - `sources/<id>.yaml`
  - `fixtures/<id>/` ground-truth
  - `DATA_LICENSES.md` entry
  - `README.md` sources row
  - `README.md` `## Attribution` block — required even for CC-0/public-domain
  - `src/service/attributions.ts` `NOTICES[<id>]` — a missing entry silently degrades to a generic slug credit. Mandated wording stays verbatim to `DATA_LICENSES.md` `## Required Notices`; `tests/service/attributions.test.ts` enforces it, do not weaken it.
  - `docs/source-onboarding-checklist.md` `✅ Done` row
- README sources table: alphabetical by country, insert in position. `scripts/check-sources-sorted.py` runs pre-commit; never bypass. That table is active sources only; the full tracker is `DATA_LICENSES.md`.
- New transform = 2 places: the name array in `src/types/config.ts` + the handler map in `src/transforms.ts`.

### Research-first

- Exhaust research before the first email: open-data portals (CKAN/Aporta/data.gov.\*), register pages, ToS/disclaimer, robots policy, license declarations.
- Never follow up before the 30-day window expires.
- Record in lockstep: `DATA_LICENSES.md` (correspondence row + posture, storage/cache restrictions) + `docs/source-onboarding-checklist.md` (in-flight row). Add the `README.md` row only once active or cleared.
- Keep an agency email in `DATA_LICENSES.md` only if that agency replied. Gmail is the record of who was written to. `Email` is `n/a` wherever `Reply` is `pending` — a recorded non-replier address reads as verified and is not.
- After recon on an already-emailed agency: update docs, move on. Exception: a new fact materially changes the ask. Default is no.

## Engine extension points (use, don't reinvent)

- Parsers keyed off `format`: `csv` → `csv-parse`; `ods`/`xlsx` → `hucre`; `xls` → `xlsx`; `html` → first `<table>` via SheetJS; `json` walks `record_path` (dot-path; empty means the response is the array).
- Multi-table/multi-sheet: `sheet:` by name or index. SheetJS names HTML tables `Sheet1`, `Sheet2`, … in order.
- `download.format: file` for a non-zip single file, exactly one `entries` alias.
- `download.method: POST` + `body` for search endpoints returning the full register on an empty query.
- `download.prime_url` fetches first and replays its cookies on the discovery and download requests. Required at bot-protection edges, which answer a cold request with **200 + a challenge page** that no status check catches. Primed cookies are origin-locked at load and request time — a replayed `Cookie` header has no jar enforcing `Domain`. A `prime_url` setting no cookies fails loudly.
- Rolling filenames: `download.discover_url` + `download.discover_pattern` (regex, one capture group; captured URL resolved against `discover_url`).
- Banner/metadata rows: `source_id_transform` returning `null`, bounded by `allowed_missing_source_id_rows`.
- Accumulating registers (data.gov.lt republishes the whole register and keeps prior dumps): `latest_snapshot_by: <column>` keeps only rows at that column's string-maximum, before row mapping, logging `map_snapshot_filtered`. Required, not an optimization — the same mark appears cancelled in the newest publication and active in an older one, and the feed would serve the stale active row. An empty column on every row throws.
- Headerful files with explicit `columns`: `skip_rows: 1` discards the file's own header. The parser asserts the discarded header's cell count equals `columns` length; width drift means an upstream add/remove that positional mapping would shuffle.
- Ragged CSV rows fail the parse. Bound known non-tabular rows with `allowed_ragged_rows`, per-file by download-entry alias, default 0. Joins always parse as CSV; the primary only when `format: csv`, so a budget on a non-CSV primary is a load-time error.
- `record_count.pattern` (regex, one capture group, matched against the decoded primary) asserts the mapped count and fails on mismatch, so a dropped row cannot write a short artifact.
  - `record_count.url` matches a separate endpoint instead (data.gov.lt answers `?count()`). `pipeline.ts` fetches it and passes the body to `mapRows`; the engine never touches the network. A publication landing between the two responses fails the run — rerun rather than relax.
  - `record_count.against: parsed` counts parsed rows instead of mapped records. Required where the published total covers the history `latest_snapshot_by` then filters.
  - Use the endpoint form on any paged API that cannot self-report truncation. Spinta closes every response with `_page.next` whether rows remain or not, so a short page is shape-identical to a complete one; `MIN_RETAIN_RATIO` (`writer.ts`) only catches losing more than half.
- Join file emitting one row per party (tc-ca `carsownr`: 2,818 co-owned marks, up to 12 parties): `joins[].merge_duplicates.fields` (upstream column names, concatenated distinct and in file order) + optional `set_on_merge`. Names raw columns, not canonical paths, and runs before row mapping, so the mapping's `lookup` still converts the result — stamp the register's own vocabulary and add it to the lookup, never a canonical value. Unconditional, unlike the primary's `set_on_merge`: the per-party difference is the signal. Unlisted columns take row one's value uncompared, so the loader requires every mapped `<join>.<COLUMN>` in `fields` or `set_on_merge`. Without the block a repeated non-identical key fails the run.
- Primary emitting one row per co-registered party: `merge_duplicates.fields` (canonical dotted paths joined by `separator`) + optional `set_on_merge`. Paths validate at load against `CANONICAL_PATHS` (`src/schema.ts`) — an unlisted path is stripped by re-validation and vanishes. Any other differing path, or a stamped path where _either_ row holds conflicting data, is a real collision and falls to recency. Never drop the extra rows.
- `pdf.allowed_anchorless_pages` (default 0) bounds text-bearing pages yielding no `anchor_pattern` match; beyond it the parse fails naming the pages. Zero rows always fails. PDF sources cannot use `record_count`. Declare cover pages explicitly — positional tolerance forgives a drifted first page.
- **PDF orientation is detected, never declared as one fixed axis.** A register can republish the same table rotated 90° (mv-caa has flipped four times since 2026-07). `pdf.layouts` holds one entry per observed orientation, at most one per `field_axis`; the parser reads the axis off the anchor spread. Every PDF source uses this shape, single-orientation ones included — a flip then fails naming the missing axis instead of yielding a full set of structurally valid, scrambled records.
  - Field **order** survives a flip; the axis and every band position do not. Measure each layout's `column_pos` against a real file in that orientation. Never derive one layout from the other or reuse an older block's numbers.
  - `columns[primary]` is shared. Where an orientation prints no cell for a field its band is `~`: the slot is kept so one order serves both and mappings need no orientation branch, and a null band is excluded from snapping so the field resolves to null. A placeholder coordinate would compete for nearby items.
  - `before_first_anchor_reach`/`_pattern` and `after_last_anchor_reach` are per-layout measured tolerances.
  - With no axis reading on any page (marks drifted, or one record per page) the first layout is used and the anchorless-page and zero-row guards report the cause. Do not pre-empt them — such a document cannot parse under either axis.
  - Keep a fixture per declared orientation (`register.pdf` + `register-rotated.pdf`). A layout with no fixture is unverified.
- A tall multi-line cell can outgrow its row band and overlap its neighbours'. Records snap per column at the **outlier gap** between adjacent anchors, falling back to the anchor midpoint when no gap stands out. Never plain nearest-anchor (steals a tall cell's outer lines — mv-caa recorded a company registry number as the next aircraft's lien holder) nor plain largest-gap (steals a neighbour's first line where cells abut with uniform leading).
- `lookup` values may be `null` — recognized, no schema value — distinct from an absent key, which is unrecognized. Enumerate every upstream code with **no `default`** so an added or renamed code fails the run. Use `default` only where an unmatched value is routine data rather than drift; it nulls the field and logs `map_lookup_default` per row, so it is unusable at volume.
- A blank cell short-circuits to null before any `lookup`; a `transform` returning null bypasses it. Fail-loud enumeration does not cover blanks.
- A register stating absence in words: `null_values` (raw cell values, matched verbatim before any transform or lookup, resolved like a blank). For a free-text column of proper nouns — lt-tka `baze`, where `NĖRA` means no base — a lookup is not the alternative, since it must enumerate every other value.
- A code meaning "nothing to report" (br-anac `CD_INTERDICAO: N`) is absence: `null_values` it. Left populated, two rows differing only there are an unresolvable duplicate; nulled, the row asserting something wins on recency.
- `null_values` is rejected on `status`: `resolveStatus` never consults it, so a declared one is ignored and the sentinel reaches the lookup as a real code. Enumerate the sentinel as a null `lookup` value instead.
- A quantity a register zero-fills instead of blanking: `positive_float_or_null`. Only where zero is impossible (mass, span, speed) — never a count, where zero is the register's real answer.

## Architecture invariants

- `src/schema.ts` = canonical Zod schema. All engine output validates against it before entering the artifact.
- `src/engine.ts` is source-agnostic. New registry = new YAML + (when needed) a new transform/parser path. Never edit row-mapping logic for one source.
- `mapRows()` (`engine.ts`, `map_*`) is column mapping; `localizeRecords()` (`localize/`, `localize_*`) is the Gemini pass. Never call mapping "translate" anywhere, prose included — br-anac is the only Gemini source, so the collision misroutes every reader.
- `src/db.ts` builds one SQLite artifact per source via `bun:sqlite` (in-memory → `serialize()`, no filesystem). Table `aircraft`: every canonical field its own typed column, nested objects flattened, arrays as JSON strings.
- **Three version markers, bumped independently — check all three on every schema change.** `db.ts` `PRAGMA user_version` (per-source artifact) · `feed.ts` `PRAGMA user_version` (`feed.sqlite`) · `FEED_SLICE_VERSION` (R2 JSON intermediate). Coinciding numbers are chance, never a reason to skip one.
  - The `PRAGMA user_version` markers describe the **consumer-facing contract**; `FEED_SLICE_VERSION` describes the **slice's structure**.
  - Widening a canonical enum's **value domain** is a contract change: bump the `user_version` of every DB carrying that column. A widened `category` once shipped under a stale marker.
  - A value-domain change does **not** bump `FEED_SLICE_VERSION`: that marker exists so a structurally older slice fails validation instead of publishing a gap. A widened enum leaves the slice structurally identical and merely un-refreshed, and nulls are legal in every version, so stale cells self-heal on normal cadence. Bumping would invalidate all 16 slices and fail the next release deploy closed for no gain.
  - Column add/remove/rename on `aircraft` → `db.ts`. On `feed` → `feed.ts` **and** `FEED_SLICE_VERSION`.
  - `tests/db.test.ts` and `tests/feed.test.ts` pin each marker; update the assertion in the same commit or the bump is not real.
- R2 keys (strict):
  - `aircraft/<source>.sqlite` — per-source artifact.
  - `aircraft/_state/<source>.json` — last-run / last-content-change / `content_hash` / `upstream_hash`. The hashes are separate deliberately: `content_hash` covers the written artifact and gates the PUT, so a translation-only improvement still ships; `upstream_hash` covers the same records _before_ localization and is what `changed` reports, so a late translation never stamps `last_content_change` for a register that published nothing. Every field required — a state missing one fails validation, self-heals to absent, and the source rewrites once. Never add an optional-field fallback for an older shape.
  - `aircraft/_feed/<source>.json` — versioned per-source slice, collapsed on `icao_hex` where published and on `registration_key` where not. Ten of sixteen publish no hex; keying on hex alone silently excluded them.
    - Both columns are nullable; both unique indexes rely on SQLite not treating NULLs as equal.
    - Within a source a hex-bearing row supersedes a hex-less one sharing its mark.
    - Rows sharing a key collapse on most recent known date, then on rendering an identical served row; a surviving tie drops the key and logs `feed_source_key_ambiguous`.
    - Deliberately **no `source_id` tiebreak**: it is per-row and may be reissued every publication (lt-tka `vda_id`), which flipped the served answer with no upstream change; where stable it only makes a coin flip repeatable.
    - An unresolvable **hex** falls its candidates back to the mark map (each may still answer its own tail-number lookup); an unresolvable **mark** is dropped, nothing can select it.
    - A hex winner whose mark group is itself unresolvable keeps the hex path and has its own `registration_key` cleared to null — the disputed mark is withheld, not served uncontested.
    - Across the merged feed a mark claimed by two aircraft is cleared to null, never resolved; a hex-less row losing its mark is dropped. `feed_registration_key_ambiguous` reports both counts.
    - Cancelled, **reserved**, and **null-status** records are excluded once, in `toFeedRows`, since every slice comes from there.
    - Reserved is not a weaker cancelled: no airframe exists behind the mark, and a register may still publish the intended model, so serving it answers a lookup with an aircraft never built. Map held marks to `status: reserved`, never `other` — `other` is served.
    - `status` is the schema's one nullable canonical field: a blank or unresolved cell stays null, never `other`. The artifact keeps the null row; the feed excludes it.
    - A slice schema change bumps `FEED_SLICE_VERSION` so older slices fail validation and regenerate. Never migrate or filter old shapes at merge — an earlier producer's slice is short by rows the current one keeps. The per-source artifact still carries full history; this is a feed-scope filter, not upstream loss.
    - `main()` merges every slice into `feed.sqlite` (`src/feed.ts`). Cadence-skip requires the slice to exist; publish fails closed if any is missing.
  - `aircraft/_feed/_deployed.json` — `hashFeedRows` of the feed last deployed. `deploy-feed` redeploys only on a difference and advances this only after a successful deploy.
  - `aircraft/_translation_cache/<source>.json` — versioned envelope of sha256(field+text) → English for `cancellation_reason`, `airworthiness_class`, `lien_status`, `operational_classes` (each element hashed individually). `idera_authorised_party` is never a candidate — always a party NAME, not descriptive text. A contract-version mismatch invalidates the whole prior generation. Persists independently of the content-hash skip gate. **A translating run writes the cache back before calling Gemini** (`persistCache`, `localize.ts`) and skips the batch when that write fails — an unwritable cache re-bills the identical delta every run. In the steady state that PUT rewrites the object byte-for-byte; it guards Gemini spend and must not be removed as redundant. It also makes an obsolete-generation reset durable, bounding a version bump to one paid regeneration.
- Every source declares `language:` (ISO 639-1). `language: en` skips the Gemini pass entirely — rendering English as English rewords curated labels (tc-ca `Certificate of Airworthiness`) and invents meaning for bare codes (faa `1`, `4`), overwriting the canonical field in artifact and feed. Required, never defaulted: it decides whether a source is billed at all. `FIELD_EXCLUDED_FOR_SOURCE` (`localize.ts`) covers one field inside an otherwise-translatable source that already yields English deterministically; it guards collection and application, so an older cache entry cannot overwrite the mapping.
- `src/localize/` renders those fields English-primary in artifact and feed. Each translatable field has a companion `<field>_source_text` captured at parse time in `engine.ts` before any English rendering — that is what satisfies a license requiring the source meaning not be distorted (es-aesa), not leaving the primary field non-English. A source whose primary field is already English via a parse-time transform declares an explicit `<field>_source_text` mapping back to the raw value. `localize.ts` dedupes by content hash before calling Gemini; a translation replaces the primary field in place. A cache miss falls back to the original text, never `null` — only `source_text` is guaranteed untranslated.
- A rejected Gemini key throws: missing via `requireEnv`, revoked/wrong-project/billing-disabled via the 401/403. Both recur identically every run, and staleness keys off `upstream_hash`, which keeps advancing while the translator stays broken — a warn would ship untranslated data behind a green pipeline. Failing costs that source's refresh only; `deploy-feed` runs under `!cancelled()` and reuses its prior slice. Every other Gemini or cache failure degrades to source text.
- Deploy chain: R2 is build+intermediate store only; nothing serves reads from R2. `make assemble-feed` rebuilds `feed.sqlite` from every R2 `_feed` slice, never an ambient on-disk copy; `make build-feed` refreshes then assembles. Both sequence through the recipe, not prerequisites, so `make -j` cannot assemble mid-refresh. The DB is **baked into the Cloud Run image** and served in-memory by `bun:sqlite` — single instance, scale-to-zero, no runtime fetch. A data change reaches production only by redeploying an image.
- The artifact PUT is gated on `content_hash` (sha256 over the sorted record set). Registry data lives inside the SQLite, never in an R2 key.
- faa `UNIQUE ID` = `source_id`, never N-number. Generally: a per-row surrogate key that changes between publications is not a `source_id`.
- Duplicate `source_id`: byte-identical rows skip; differing rows resolve via `resolveRecency` (`src/engine.ts`) only when a real signal exists. A collision with no signal fails the run by default — file position is not a recency signal.
  - **Exception, opt-in per source:** `duplicate_conflict: last-wins` keeps the later row and logs `map_duplicate_id_last_wins`. Reverses the former absolute ban, and only where a register contradicts _itself_ on a field nothing can arbitrate (cl-dgac lists CC-DQA twice with two models and publishes no date or status) and the alternative is a 2,000-row fleet failing on one row. Never a default, never fleet-wide — a collision from a wrong `source_id` assumption must still fail. The warn is the only record that a published row was dropped; never downgrade it to a duplicate skip.
- A source whose upstream is unreachable for reasons no config change can fix (a WAF block on the publisher domain) takes `paused: true`. It leaves the scheduled refresh but stays in `resolveAllSources()`, so feed assembly keeps merging its last good slice; `REFRESH_SOURCE=<id>` still runs it, which is how recovery is tested. A paused source cannot regenerate its slice, so a later `FEED_SLICE_VERSION` bump invalidates it and publish fails closed until it is unpaused or removed — the intended loud failure.
- Never retry a mapping failure: it is deterministic on the same bytes, and file position is not a recency signal (br-anac's RAB arrives as 57 unordered runs). Fix the mapping so a signal exists.

## Distribution model

- Source-available (Polyform Shield 1.0.0 + Supplemental Terms). Forks self-host against their own R2 and their own per-source assessment.
- Normalized output is private to Ashley-operated applications plus the feed service's gated slice. No public download, query surface, or dataset publication.
- Operator deployment stays non-commercial for the lifetime of any Private-use source ingested.

## GitHub Actions

- `actions/*`: tagged major. All others: commit SHA + version comment (`@abc123 # v4.1.0`).
- `refresh.yml` discovers `sources/*.yaml` automatically — no workflow edit per source.
- **One deploy job, in `deploy.yml`, reached only by `workflow_call`.** Callers: `release-please.yml` on a release (`force: true`, so a version bump ships with unchanged data) and `refresh.yml` after the daily pull (`force: false`, deploying only when the result differs from `_deployed.json`). Never give `deploy.yml` its own trigger, never add deploy steps to a caller — `tests/workflows/deploy.test.ts` scans every workflow for `/\bmake deploy\b/` or `gcloud run deploy` and fails on a second.
- **Concurrency group is the constant `cloud-run-deploy` (`queue: max`, `cancel-in-progress: false`).** Inside a called workflow `${{ github.workflow }}` resolves to the _caller's_ name, so an interpolated group files release and refresh deploys separately — the race the group prevents — and can cancel the caller. The maximal queue is required: GitHub's default retains one pending run and replaces it on a third, silently discarding a forced release deploy. Queue rather than cancel — a deploy killed halfway leaves the service updated with the marker naming the old hash. Until actionlint supports `concurrency.queue`, `.github/actionlint.yaml` ignores only that unknown-key error and `tests/workflows/deploy.test.ts` pins `max`.
- **A caller must grant `contents: read` + `id-token: write`.** Called-workflow permissions can only be downgraded by the caller, so an omitted grant breaks Workload Identity at deploy time, not lint time. Pass exactly the four declared R2 credentials; never `secrets: inherit`.
- **The release deploy assembles from existing R2 slices and does not refresh first.** `resolveAllSources()` reads `sources/*.yaml` at the released commit and `publishFeed` fails closed when any lacks a current slice, so a release adding a source or bumping `FEED_SLICE_VERSION` cannot deploy until a refresh has written slices. Deliberate: the 16-register pull would add ~30 minutes to every release and contend with the `registry-refresh-gemini` quota group. Land the change, let a refresh run, then release. Recovery: run `refresh.yml`, then **Re-run failed jobs** on the same release run — not _Re-run all jobs_, which makes Release Please report `release_created=false` and skip the deploy. `deploy.yml`'s `Explain the assembly failure` step prints this, scoped to the assemble step's outcome. Never relax the fail-closed check.
- A `refresh.yml` run waiting on `cloud-run-deploy` keeps holding `registry-refresh-gemini`, because its deploy job is last. A manual refresh during a release deploy therefore blocks with no visible cause. One-directional, so it cannot deadlock — do not give the deploy its own group.
- Ad-hoc deploys (rollback, retry, shipping without a release) are a local `make deploy`. Do not add a `workflow_dispatch` deploy button.
- **Refresh cadence:** where declared cadence and observed rhythm differ, run at the **more frequent**, and record both in `DATA_LICENSES.md`. `cadence_days` gates work; sources without it run every cron tick. Sources publishing faster than the cron need their own workflow. The downloader sends no conditional-request headers, so every run is a full fetch; `content_hash` still gates the PUT.
- `shouldSkip` compares **whole UTC days**, never an ms window: `last_run` is stamped at completion, so a strict window makes the next tick fall short and pushes every cycle a day later.
- An overdue source bypasses the cadence gate every tick until it publishes, on the staleness issue's own 1.5× threshold — one threshold, never two. Stuck escalated means `cadence_days` is wrong.
- Exactly three things bypass the cadence gate, and no fourth: `DRY_RUN`, `FORCE_REFRESH=true`, and the overdue escalation in `shouldSkip`. `FORCE_REFRESH` without `REFRESH_SOURCE` throws in `resolveSources` — enforced at the pipeline boundary, since `make refresh` never touches the workflow.

## Commits

- Conventional Commits. **Lowercase type + subject** (commitlint rejects sentence-case/start-case).
- RAI footer: **exactly one**, carrying a contact. `rai-footer-exists` grades by contribution: `Authored-by` human-only · `Commit-generated-by` trivial AI · `Assisted-by` AI-helped but human-written · `Co-authored-by` ~50/50 · `Generated-by` AI-majority. AI-majority is the normal case here. Never stack a second footer naming the same model — a harness default asking for `Co-Authored-By` does not override this. A genuinely distinct agent (e.g. `Codex <noreply@openai.com>`) gets its own line.
- Atomic: each commit independently typechecks, lints, passes tests. Never sweep unrelated working-tree changes in.
- Never `--no-verify`.

## Branch hygiene

Scope = branch name + first commit's diff shape. Nothing else.

- `feat/*`: `src/`, `tests/`, `sources/`, `fixtures/`, plus docs for that feature.
- `docs/*`: `README.md`, `DATA_LICENSES.md`, `docs/*`. No code/sources/fixtures.
- `fix/*`: bug + tests proving it.
- `chore/*`: tooling, CI, deps. Nothing user-facing.

Out-of-scope work → new branch. Triggers: active `feat/*` and asked for license triage or unrelated docs; active `docs/*` and asked for code; commit log shows two themes and a third is asked.

Switch: commit/stash → state the mismatch in one line → branch from `main`, never the active branch → return when the feature resumes.

Never call a mix "related" when the only link is one conversation. A diff hard to title in one line is two PRs.

## Documentation

- Prose carries intent, rationale, and license/legal facts. Never restate what `sources/*.yaml`, `src/schema.ts`, or other code states — link, don't transcribe. Per-source mechanics, field mappings, and schema field lists belong in the YAML/schema.
- Never create a new top-level doc file unilaterally; ask. Exception: source-onboarding artifacts in the standard workflow.
- Required on state change: `DATA_LICENSES.md` (source added or posture changed) · `README.md` sources table + `## Attribution` (alongside any new `sources/<id>.yaml`) · `PRD.md` (only when goals, requirements, or constraints shift — planning, not a shipped-implementation log).
- **Three onboarding surfaces — a change to `make` targets, `.env.example`, or a required env var updates all three or none.** `docs/getting-started.md` (non-developer, manual) · `docs/getting-started-with-ai.md` (non-developer, agent-driven) · `.agents/skills/setup-metal-birds-feed/SKILL.md` (executed by the agent). The first two are human product documentation and keep human conventions.
- **The skill's one real copy is `.agents/skills/setup-metal-birds-feed/SKILL.md`** (`.agents/` is what Codex scans). Claude Code scans only `~/.claude/skills/` and `.claude/skills/`, so the repo tracks a symlink `.claude/skills/setup-metal-birds-feed → ../../.agents/skills/setup-metal-birds-feed` (git mode `120000`, relative so it resolves after any clone). Edit the `.agents/` copy; never replace the symlink with a second real file. `.gitignore` keeps `.claude/*` + `!.claude/skills/` — ignoring `.claude/` instead kills the negation, since git cannot re-include under an excluded directory, and the symlink vanishes from every clone with nothing failing. `tests/onboarding.test.ts` asserts it resolves. Windows clones without `core.symlinks` get a text file; the AI guide documents the fallback.
- Never put a literal registration, hex, or record in onboarding docs. Read one out of the built artifact at runtime — a hardcoded mark is invented data and reads as a broken service the day it stops matching.
- `DATA_LICENSES.md` is the single record for correspondence and posture. Flat tracker, not a reply archive — the email thread is the verbatim record. Capture status, posture, storage/cache restrictions, and terms to be quoted exactly in `README.md` `## Attribution`. Never transcribe replies or duplicate the table.
- `docs/source-onboarding-checklist.md`: triage worklist only. Tracking tables stay bare — contact provenance, names, phones, prefixes belong in `DATA_LICENSES.md`.
- When a decision reverses an earlier one, say so in the commit body and update the rule here in the same commit. A stale rule that happens to match new behavior is worse than none.
