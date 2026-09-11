Overrides any conflicting local file. `PRD.md` carries context; this file carries rules. Everything here is a decision, a prohibition, or a failure mode the code does not reveal — read the code for mechanics.

Agent control files (`AGENTS.md`, `SKILL.md`, their `references/*`) have one reader: a model about to act. State scope, trigger, action, prohibition, exit condition. No onboarding, tutorials, motivational rationale, or status prose. Human-doc conventions apply only to product documentation.

## Hard prohibitions

- PII: keep `owner`/`operator` `{name,kind,state,country}` only. Drop street/street2/city/postal-code/county/region/care-of at the mapping config. A country reachable from an address's trailing component is permitted — read it, never assume it from the register's own country.
- No unauthenticated read API (PRD §CC.4). Never add an attribute query/filter/list surface or full-artifact access; the service stays bearer-auth, rate-limited, one consumer, exact point lookups on a unique key.
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

- `??`/`??=` over null/undefined checks. `?.` over guard clauses. `const` over `let`, never `var`. No `as T` unless TS cannot narrow structurally.
- A module-private helper called above its own definition stays a `function` declaration — `engine.ts` relies on hoisting, so converting it to `const` is a TDZ crash, not a style win. Nothing enforces this; read the call order first.
- Never `await` inside `for`/`while` — use `Promise.all`/`allSettled` + `.map()`. Exception: inherently sequential consumption (stream pumps, backoff chains); state the WHY inline.

## Tests

- Live in `tests/` mirroring `src/`. Never colocate.
- Keep `--isolate`: `mock.module` is process-global and leaks across files without it.
- Branch coverage cannot be enforced — `bun test` thresholds line/function/statement only, so cover branches by intent rather than trusting the gate.
- Every engine function: positive + negative + edge cases.
- `fixtures/<source>/` is CI ground-truth: real upstream rows, changed only with a schema or config change. Sanitize natural-person names and addresses; keep organization names and every technical value verbatim. Verify against the live file before adding a row shape — never fabricate one.
- Remove local-validation test files before commit.

## Source onboarding (read PRD §CC.x first)

- A missing ICAO 24-bit hex is not a disqualifier — hex-less records reach the feed on `registration_key`. Record the coverage cost: those rows answer tail-number lookups only, unreachable from an ADS-B blip. No join path recovers a hex (national registers are mutually exclusive; third-party hex databases are neither authoritative nor license-compatible).
- A registration mark is mandatory. A mark normalizing to nothing costs that row both keys.
- Classify posture per CC.1: Open / Private-use / Restrictive / Unknown.
- Private-use + Unknown: research storage/caching/automation terms first. Email via `docs/agency-permission-request.md` only when private caching is still unclear.
- Restrictive = paid single-PC, no-copy, no-storage, no-scraping, view-only, no-redistribute with storage implications, or active denial (PRD §CC.5). Exclude; record the reason. Do not email absent a new material fact.
- CC.2 fallback: no reply in 30 days + no terms prohibiting private caching → proceed for private operator use. Verify in Gmail that no reply landed; `PRD.md` is authoritative, not the checklist's `Fallback` column. Record residual exposure where terms are narrower than the intended use.
- New source = all 7 surfaces: `sources/<id>.yaml` · `fixtures/<id>/` · `DATA_LICENSES.md` entry · `README.md` sources row · `README.md` `## Attribution` (required even for CC-0) · `src/service/attributions.ts` `NOTICES[<id>]` · `docs/source-onboarding-checklist.md` `✅ Done` row.
  - A missing `NOTICES` entry silently degrades to a generic slug credit. Mandated wording stays verbatim to `DATA_LICENSES.md` `## Required Notices`.
- README sources table: alphabetical by country, insert in position, never append. That table is active sources only; the full tracker is `DATA_LICENSES.md`.

### Research-first

- Exhaust research before the first email: open-data portals (CKAN/Aporta/data.gov.\*), register pages, ToS/disclaimer, robots policy, license declarations.
- Never follow up before the 30-day window expires.
- Record in lockstep: `DATA_LICENSES.md` (correspondence row + posture, storage/cache restrictions) + `docs/source-onboarding-checklist.md` (in-flight row). Add the `README.md` row only once active or cleared.
- Keep an agency email in `DATA_LICENSES.md` only if that agency replied. Gmail is the record of who was written to. `Email` is `n/a` wherever `Reply` is `pending` — a recorded non-replier address reads as verified and is not.
- After recon on an already-emailed agency: update docs, move on. Exception: a new fact materially changes the ask. Default is no.

## Engine

Use the existing extension points; never edit row-mapping logic for one source. `src/engine.ts` is source-agnostic — a new registry is a new YAML plus, when needed, a new transform or parser path.

- `download.prime_url` exists because bot-protection edges answer a cold request with **200 + a challenge page**, which no status check catches. Primed cookies are origin-locked deliberately — a replayed `Cookie` header has no jar enforcing `Domain`.
- `latest_snapshot_by` is required for a register that accumulates publications rather than replacing them, not an optimization: the same mark appears cancelled in the newest publication and active in an older one, and the feed would serve the stale active row.
- A `record_count` check is what stops a dropped row writing a short artifact silently. Use the separate-endpoint form for any paged API that cannot self-report truncation — a cursor closing every response makes a short page shape-identical to a complete one, and the writer's retain floor only catches losing more than half. A publication landing between the two responses fails the run: rerun rather than relax. Count against parsed rows where the published total covers history that `latest_snapshot_by` then filters.
- Merge blocks (`merge_duplicates`, `joins[].merge_duplicates`) exist for registers emitting one row per co-registered party. Never drop the extra rows. A join merge names raw upstream columns and runs before row mapping, so stamp the register's own vocabulary and add it to the lookup, never a canonical value. For the primary, any differing path outside the block — or a stamped path where _either_ row holds conflicting data — is a real collision and falls to recency.
- Declare cover pages explicitly rather than tolerating them by position, which forgives a drifted first page. Zero rows always fails. PDF sources cannot use `record_count`, so nothing else catches a page that loses its anchors.
- **PDF orientation is detected, never declared as one fixed axis.** A register can republish the same table rotated 90° (mv-caa has flipped four times since 2026-07). Every PDF source declares `pdf.layouts`, single-orientation ones included — a flip then fails naming the missing axis instead of being read on the stale one, which yields a full set of structurally valid, scrambled records.
  - Field **order** survives a flip; the axis and every band position do not. Measure each layout's `column_pos` against a real file in that orientation. Never derive one layout from the other or reuse an older block's numbers.
  - A null band marks a field that orientation does not print, keeping one shared `columns` order and mappings free of orientation branches. A placeholder coordinate would instead compete for nearby items.
  - With no axis reading on any page (marks drifted, or one record per page) the first layout is used so the anchorless-page and zero-row guards report the real cause. Do not pre-empt them — such a document cannot parse under either axis.
  - Keep a fixture per declared orientation. A layout with no fixture is unverified.
- Records snap per column at the **outlier gap** between adjacent anchors, falling back to the anchor midpoint when no gap stands out, because a tall multi-line cell can outgrow its row band and overlap its neighbours'. Never plain nearest-anchor (steals a tall cell's outer lines — mv-caa recorded a company registry number as the next aircraft's lien holder) nor plain largest-gap (steals a neighbour's first line where cells abut with uniform leading).
- The outer-record reach must clear that record's tallest cell: the page-wide minimum row pitch is not a safe bound, and clipping one line promotes a street address to the party name.
- Enumerate every upstream code with **no `default`** so an added or renamed code fails the run. A `lookup` value may be null — recognized, no schema value — which is distinct from an absent key. Use `default` only where an unmatched value is routine data rather than drift; it nulls the field and logs per row, so it is unusable at volume.
- A blank cell short-circuits to null before any `lookup`, and a `transform` returning null bypasses it. Fail-loud enumeration does not cover blanks.
- `null_values` is for a register stating absence in words. Prefer it over a lookup for a free-text column of proper nouns, where a lookup would have to enumerate every other value. A code meaning "nothing to report" is absence, not data: left populated, two rows differing only there are an unresolvable duplicate; nulled, the row asserting something wins on recency.
- `status` resolves outside the normal scalar path and never consults `null_values`. Enumerate a status sentinel as a null `lookup` value.
- Use `positive_float_or_null` for a quantity a register zero-fills instead of blanking, and only where zero is impossible (mass, span, speed) — never a count, where zero is the register's real answer.

## Architecture invariants

- `mapRows()` (`map_*`) is column mapping; `localizeRecords()` (`localize_*`) is the Gemini pass. Never call mapping "translate" anywhere, prose included — one source is Gemini-backed, so the collision misroutes every reader.
- **Three version markers, bumped independently — check all three on every schema change.** Per-source artifact `PRAGMA user_version` · `feed.sqlite` `PRAGMA user_version` · `FEED_SLICE_VERSION`. Coinciding numbers are chance, never a reason to skip one. The `user_version` markers describe the **consumer-facing contract**; `FEED_SLICE_VERSION` describes the **slice's structure**.
  - Widening a canonical enum's **value domain** is a contract change: bump the `user_version` of every DB carrying that column. This shipped stale once.
  - A value-domain change does **not** bump `FEED_SLICE_VERSION`, which exists so a structurally older slice fails validation instead of publishing a gap. A widened enum leaves the slice structurally identical and merely un-refreshed, and nulls are legal in every version, so stale cells self-heal on normal cadence. Bumping would invalidate every slice at once and fail the next release deploy closed for no gain.
  - Tests pin each marker; update the assertion in the same commit or the bump is not real.
- `content_hash` and `upstream_hash` are separate deliberately: `content_hash` covers the written artifact and gates the PUT, so a translation-only improvement still ships; `upstream_hash` covers the same records _before_ localization and is what `changed` reports, so a late translation never stamps `last_content_change` for a register that published nothing.
- Every state field is required. A state missing one fails validation, self-heals to absent, and the source rewrites once. Never add an optional-field fallback for an older shape.
- Feed slices collapse on `icao_hex` where published and on `registration_key` where not — most sources publish no hex, and keying on hex alone silently excluded them.
  - Both key columns are nullable; the unique indexes rely on SQLite not treating NULLs as equal.
  - Within a source a hex-bearing row supersedes a hex-less one sharing its mark.
  - Rows sharing a key collapse on most recent known date, then on rendering an identical served row; a surviving tie drops the key and logs.
  - Deliberately **no `source_id` tiebreak**: it is per-row and may be reissued every publication, which flipped the served answer with no upstream change; where stable it only makes a coin flip repeatable.
  - An unresolvable **hex** falls its candidates back to the mark map (each may still answer its own tail-number lookup); an unresolvable **mark** is dropped, nothing can select it.
  - A hex winner whose mark group is itself unresolvable keeps the hex path and has its own `registration_key` cleared — the disputed mark is withheld, not served uncontested.
  - Across the merged feed a mark claimed by two aircraft is cleared to null, never resolved; a hex-less row losing its mark is dropped.
  - Cancelled, **reserved**, and **null-status** records are excluded once, at slice construction, since every slice comes from there.
  - Reserved is not a weaker cancelled: no airframe exists behind the mark, and a register may still publish the intended model, so serving it answers a lookup with an aircraft never built. Map held marks to `reserved`, never `other` — `other` is served.
  - `status` is the schema's one nullable canonical field: a blank or unresolved cell stays null, never `other`. The artifact keeps the null row; the feed excludes it.
  - A slice schema change bumps `FEED_SLICE_VERSION` so older slices regenerate. Never migrate or filter old shapes at merge — an earlier producer's slice is short by rows the current one keeps. The per-source artifact still carries full history; this is a feed-scope filter, not upstream loss.
  - Cadence-skip requires the slice to exist; publish fails closed if any is missing.
- The translation cache persists independently of the content-hash skip gate, and a contract-version mismatch invalidates the whole prior generation. **A translating run writes the cache back before calling Gemini** and skips the batch when that write fails — an unwritable cache re-bills the identical delta every run. In the steady state that PUT rewrites the object byte-for-byte; it guards spend and must not be removed as redundant. It also makes an obsolete-generation reset durable, bounding a version bump to one paid regeneration. A party NAME is never a translation candidate.
- `language:` is required, never defaulted: it decides whether a source is billed to Gemini at all. `language: en` skips the pass entirely — rendering English as English rewords curated labels and invents meaning for bare codes, overwriting the canonical field in artifact and feed. The per-field exclusion covers one field inside an otherwise-translatable source that already yields English deterministically, and guards both collection and application so an older cache entry cannot overwrite the mapping.
- Each translatable field's `<field>_source_text` is captured at parse time before any English rendering — that is what satisfies a license requiring the source meaning not be distorted, not leaving the primary field non-English. A source whose primary field is already English via a parse-time transform must declare that mapping explicitly, or the transform discards the raw value. A cache miss falls back to the original text, never null — only `source_text` is guaranteed untranslated.
- A rejected Gemini key throws rather than warns: it recurs identically every run, and staleness keys off `upstream_hash`, which keeps advancing while the translator stays broken — a warn ships untranslated data behind a green pipeline. Failing costs that source's refresh only. Every other Gemini or cache failure degrades to source text.
- R2 is a build and intermediate store; nothing serves reads from it. The DB is **baked into the Cloud Run image** and served in-memory — single instance, scale-to-zero, no runtime fetch. A data change reaches production only by redeploying an image. Assembly always rebuilds from R2 slices, never an ambient on-disk copy, and sequences through the recipe rather than prerequisites so `make -j` cannot assemble mid-refresh.
- A per-row surrogate key that changes between publications is not a `source_id`. Prefer a permanent registration/certificate identifier over a reissued mark — but verify uniqueness per publication, since a register may reuse one across two registrations.
- Duplicate `source_id`: byte-identical rows skip; differing rows resolve on a real recency signal. A collision with no signal fails the run by default — file position is not a recency signal.
  - **Exception, opt-in per source:** `duplicate_conflict: last-wins` keeps the later row. Reverses the former absolute ban, and only where a register contradicts _itself_ on a field nothing can arbitrate and the alternative is a whole fleet failing on one row. Never a default, never fleet-wide — a collision from a wrong `source_id` assumption must still fail. The warn is the only record that a published row was dropped; never downgrade it to a duplicate skip.
- `paused: true` is for a source whose upstream is unreachable for reasons no config change can fix (a WAF block on the publisher domain). It leaves the scheduled refresh but stays in feed assembly, so the last good slice keeps serving; naming it in `REFRESH_SOURCE` still runs it, which is how recovery is tested. A paused source cannot regenerate its slice, so a later `FEED_SLICE_VERSION` bump invalidates it and publish fails closed until it is unpaused or removed — the intended loud failure.
- Never retry a mapping failure: it is deterministic on the same bytes, and file position is not a recency signal. Fix the mapping so a signal exists.

## Distribution model

- Source-available (Polyform Shield 1.0.0 + Supplemental Terms). Forks self-host against their own R2 and their own per-source assessment.
- Normalized output is private to Ashley-operated applications plus the feed service's gated slice. No public download, query surface, or dataset publication.
- Operator deployment stays non-commercial for the lifetime of any Private-use source ingested.

## GitHub Actions

- `actions/*`: tagged major. All others: commit SHA + version comment (`@abc123 # v4.1.0`).
- **One deploy job, reached only by `workflow_call`.** Never give it a trigger of its own, and never add deploy steps to a caller — a test scans every workflow and fails on a second deploy.
- **Its concurrency group is a constant, queued at maximum, never cancelled.** Inside a called workflow `${{ github.workflow }}` resolves to the _caller's_ name, so an interpolated group files the release and refresh deploys separately — the race the group prevents — and can cancel the caller. The maximal queue is required: the default retains one pending run and replaces it on a third, silently discarding a forced release deploy. Queue rather than cancel — a deploy killed halfway leaves the service updated with the marker naming the old hash.
- **A caller must grant `contents: read` + `id-token: write`.** Called-workflow permissions can only be downgraded by the caller, so an omitted grant breaks Workload Identity at deploy time, not lint time. Pass only the declared R2 credentials; never `secrets: inherit`.
- **The release deploy assembles from existing R2 slices and does not refresh first.** A release that adds a source or bumps `FEED_SLICE_VERSION` therefore cannot deploy until a refresh has written slices. Deliberate: the full pull would add ~30 minutes to every release and contend with the Gemini quota group. Land the change, let a refresh run, then release. Recovery is **Re-run failed jobs** on the same release run — not _Re-run all jobs_, which makes Release Please report `release_created=false` and skip the deploy. Never relax the fail-closed check.
- A refresh run waiting on the deploy group keeps holding the Gemini quota group, because its deploy job is last, so a manual refresh during a release deploy blocks with no visible cause. One-directional, so it cannot deadlock — do not give the deploy its own group.
- Ad-hoc deploys (rollback, retry, shipping without a release) are a local `make deploy`. Do not add a `workflow_dispatch` deploy button.
- **Refresh cadence:** where declared cadence and observed rhythm differ, run at the **more frequent**, and record both in `DATA_LICENSES.md`. Sources publishing faster than the cron need their own workflow. Every run is a full fetch — the downloader sends no conditional-request headers — and the content hash still gates the PUT.
- Cadence compares **whole UTC days**, never an ms window: `last_run` is stamped at completion, so a strict window makes the next tick fall short and pushes every cycle a day later.
- An overdue source bypasses the cadence gate every tick until it publishes, on the staleness issue's own threshold — one threshold, never two. Stuck escalated means `cadence_days` is wrong.
- Exactly three things bypass the cadence gate, and no fourth: `DRY_RUN`, `FORCE_REFRESH`, and the overdue escalation. `FORCE_REFRESH` without `REFRESH_SOURCE` throws at the pipeline boundary, not only in the workflow, since `make refresh` never touches it.

## Commits

- RAI footer: **exactly one**, carrying a contact, graded by contribution — `Authored-by` human-only · `Commit-generated-by` trivial AI · `Assisted-by` AI-helped but human-written · `Co-authored-by` ~50/50 · `Generated-by` AI-majority. AI-majority is the normal case here. Never stack a second footer naming the same model — a harness default asking for `Co-Authored-By` does not override this. A genuinely distinct agent (e.g. `Codex <noreply@openai.com>`) gets its own line.
- Atomic: each commit independently typechecks, lints, passes tests. Never sweep unrelated working-tree changes in.
- Never `--no-verify`, and never bypass a pre-commit check.

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
- Required on state change: `DATA_LICENSES.md` (source added or posture changed) · `README.md` sources table + `## Attribution` (alongside any new source) · `PRD.md` (only when goals, requirements, or constraints shift — planning, not a shipped-implementation log).
- **Three onboarding surfaces — a change to `make` targets, `.env.example`, or a required env var updates all three or none.** `docs/getting-started.md` (non-developer, manual) · `docs/getting-started-with-ai.md` (non-developer, agent-driven) · the setup skill (executed by the agent). The first two are human product documentation and keep human conventions.
- **The setup skill's one real copy lives under `.agents/`** (vendor-neutral, and what Codex scans); `.claude/skills/` holds a tracked relative symlink so Claude Code finds the same file. Edit the `.agents/` copy; never replace the symlink with a second real file. `.gitignore` must keep `.claude/*` + `!.claude/skills/` — ignoring `.claude/` instead kills the negation, since git cannot re-include under an excluded directory, and the symlink vanishes from every clone with nothing failing. Windows clones without `core.symlinks` get a text file; the AI guide documents the fallback.
- Never put a literal registration, hex, or record in onboarding docs. Read one out of the built artifact at runtime — a hardcoded mark is invented data and reads as a broken service the day it stops matching.
- `DATA_LICENSES.md` is the single record for correspondence and posture. Flat tracker, not a reply archive — the email thread is the verbatim record. Capture status, posture, storage/cache restrictions, and terms to be quoted exactly in `README.md` `## Attribution`. Never transcribe replies or duplicate the table.
- `docs/source-onboarding-checklist.md`: triage worklist only. Tracking tables stay bare — contact provenance, names, phones, prefixes belong in `DATA_LICENSES.md`.
- When a decision reverses an earlier one, say so in the commit body and update the rule here in the same commit. A stale rule that happens to match new behavior is worse than none.
