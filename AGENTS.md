- Overrides any conflicting local file. `PRD.md` carries context; this file carries rules.
- Read the code for mechanics. Every entry here is a decision, a prohibition, or a failure mode the code does not reveal.

## Hard prohibitions

- PII: keep `owner`/`operator` `{name,kind,state,country}` only. Drop street/street2/city/postal-code/county/region/care-of at the mapping config. A country read from an address's trailing component is permitted; never assume it from the register's own country.
- No unauthenticated read API (PRD §CC.4). No attribute query/filter/list surface, no full-artifact access. Bearer-auth, rate-limited, one consumer, exact point lookups on a unique key.
- No commercial operator deployment (PRD §CC.3).
- No public output distribution. Artifacts are private to Ashley-operated applications; forks self-host.
- No `..` in path inputs. Resolve to absolute, enforce sandbox-root containment after resolution, default deny.
- No quick fixes.
- No `// @ts-ignore` without a justifying comment. Never weaken `tsconfig.json` strict settings.
- No backwards-compatibility shims.
- No error handling for impossible scenarios. Validate at system boundaries only.
- No `.skip` on tests. Fix or delete. Never lower coverage thresholds.
- No silent loss of upstream information. Extend `src/schema.ts` rather than drop a structurally meaningful field at mapping config. PII is the only allowed drop. A field restating a type-level property already derivable from mapped fields is not structurally meaningful.
- No inventing data the register does not state. Null beats a plausible guess.
- Human prose only in `README.md`, `docs/*.md`, `PRD.md`, `DATA_LICENSES.md`, `CHANGELOG.md`, commit/PR bodies. Everywhere else — this file, `SKILL.md`, `references/*`, `src/`, `tests/`, `sources/*.yaml`, workflows — carries no overview, purpose, introduction, summary, transition, or status sentence, and no paragraph where a bullet states the same rule.
- Comments are WHY-only, minimal, load-bearing: a constraint, an invariant, or a failure mode a reader would otherwise reintroduce. Never restate WHAT. Never narrate a change, ticket, or PR.

## Code style

Match the surrounding code; `eslint.config.js` and `tsconfig.json` enforce the rest. Two rules neither one catches:

- A module-private helper called above its own definition stays a `function` declaration. `engine.ts` relies on hoisting; `const` is a TDZ crash. Read the call order first.
- Never `await` inside `for`/`while` — `Promise.all`/`allSettled` + `.map()`. Exception: inherently sequential consumption (stream pumps, backoff chains); state the WHY inline.

## Tests

- Keep `--isolate`: `mock.module` is process-global and leaks across files without it.
- `bun test` thresholds line/function/statement only. Cover branches by intent; the gate does not.
- Every engine function: positive + negative + edge cases.
- `fixtures/<source>/` is CI ground-truth: real upstream rows, changed only with a schema or config change. Sanitize natural-person names and addresses; keep organization names and every technical value verbatim. Verify a row shape against the live file before adding it; never fabricate one.
- Remove local-validation test files before commit.

## Source onboarding (read PRD §CC.x first)

- A missing ICAO 24-bit hex is not a disqualifier — hex-less records reach the feed on `registration_key`. Record the coverage cost: those rows answer tail-number lookups only. No join path recovers a hex.
- A registration mark is mandatory. A mark normalizing to nothing costs that row both keys.
- Classify posture per CC.1: Open / Private-use / Restrictive / Unknown.
- Private-use + Unknown: research storage/caching/automation terms first. Email via `docs/agency-permission-request.md` only when private caching is still unclear.
- Restrictive = paid single-PC, no-copy, no-storage, no-scraping, view-only, no-redistribute with storage implications, or active denial (PRD §CC.5). Exclude; record the reason. Do not email absent a new material fact.
- CC.2 fallback: no reply in 30 days + no terms prohibiting private caching → proceed for private operator use. Verify in Gmail that no reply landed; `PRD.md` is authoritative, not the checklist's `Fallback` column. Record residual exposure where terms are narrower than the intended use.
- New source = all 6 surfaces: `sources/<id>.yaml` · `fixtures/<id>/` · `DATA_LICENSES.md` entry · `README.md` sources row · `src/service/attributions.ts` `NOTICES[<id>]` · `docs/source-onboarding-checklist.md` `✅ Done` row.
  - The `DATA_LICENSES.md` entry is a `## Source Posture` bullet, plus a `## Required Notices` line only where wording is mandated.
  - A missing `NOTICES` entry silently degrades to a generic slug credit.
- README sources table: alphabetical by country, insert in position, never append. Active sources only; the full tracker is `DATA_LICENSES.md`.

### Research-first

- Exhaust research before the first email: open-data portals (CKAN/Aporta/data.gov.\*), register pages, ToS/disclaimer, robots policy, license declarations.
- Never follow up before the 30-day window expires.
- Record in lockstep: `DATA_LICENSES.md` (correspondence row + posture, storage/cache restrictions) + `docs/source-onboarding-checklist.md` (in-flight row). Add the `README.md` row only once active or cleared.
- Keep an agency email in `DATA_LICENSES.md` only if that agency replied — a recorded non-replier address reads as verified and is not. `Email` is `n/a` wherever `Reply` is `pending`. Gmail is the record of who was written to.
- After recon on an already-emailed agency: update docs, move on. Exception: a new fact materially changes the ask. Default is no.

## Engine

- Use the existing extension points; never edit row-mapping logic for one source. A new registry is a new YAML, plus a transform or parser path when needed.
- `download.prime_url`: bot-protection edges answer a cold request with 200 + a challenge page. Primed cookies stay origin-locked — a replayed `Cookie` header has no jar enforcing `Domain`.
- `latest_snapshot_by`: required where a register accumulates publications instead of replacing them, or the feed serves an older active row for a mark the newest publication cancelled.
- `record_count` catches a dropped row writing a short artifact. Separate-endpoint form for any paged API that cannot self-report truncation. A publication landing between the two responses fails the run — rerun, never relax. Count against parsed rows where the published total covers history `latest_snapshot_by` filters.
- Merge blocks (`merge_duplicates`, `joins[].merge_duplicates`) are for registers emitting one row per co-registered party; never drop the extra rows. A join merge names raw upstream columns and runs before row mapping: stamp the register's own vocabulary and add it to the lookup, never a canonical value. For the primary, a differing path outside the block — or a stamped path where either row conflicts — is a real collision and falls to recency.
- Declare cover pages explicitly, never tolerate them by position. Zero rows always fails. PDF sources cannot use `record_count`.
- PDF orientation is detected, never declared as one fixed axis. Every PDF source declares `pdf.layouts`, single-orientation ones included, so a republished flip fails naming the missing axis instead of parsing scrambled records off the stale one.
  - Field order survives a flip; the axis and band positions do not. Measure each layout's `column_pos` against a real file in that orientation. Never derive one layout from the other.
  - A null band marks a field that orientation does not print, keeping one shared `columns` order and no orientation branches. A placeholder coordinate would compete for nearby items.
  - No axis reading on any page → first layout, so the anchorless-page and zero-row guards report the real cause. Do not pre-empt them.
  - One fixture per declared orientation.
- Records snap per column at the outlier gap between adjacent anchors, anchor midpoint when no gap stands out. Never nearest-anchor, never largest-gap: a tall multi-line cell outgrows its row band and overlaps its neighbours'.
- The outer-record reach must clear that record's tallest cell. The page-wide minimum row pitch is not a safe bound.
- Enumerate every upstream code with no `default`, so an added or renamed code fails the run. A null `lookup` value (recognized, no schema value) is distinct from an absent key. `default` only where an unmatched value is routine data rather than drift: it nulls the field and logs per row, unusable at volume.
- A blank cell short-circuits to null before any `lookup`; a `transform` returning null bypasses it. Enumeration does not cover blanks.
- `null_values` is for a register stating absence in words; prefer it over a lookup for a free-text column of proper nouns. A code meaning "nothing to report" is absence, not data: left populated, two rows differing only there are an unresolvable duplicate.
- `status` resolves outside the normal scalar path and never consults `null_values`. Enumerate a status sentinel as a null `lookup` value.
- `positive_float_or_null` is for a quantity a register zero-fills instead of blanking, only where zero is impossible (mass, span, speed) — never a count.

## Architecture invariants

- `mapRows()` (`map_*`) is column mapping; `localizeRecords()` (`localize_*`) is the Gemini pass. Never call mapping "translate" anywhere, prose included.
- Three version markers, bumped independently — check all three on every schema change: per-source artifact `PRAGMA user_version` · `feed.sqlite` `PRAGMA user_version` · `FEED_SLICE_VERSION`. Coinciding numbers are chance. `user_version` is the consumer-facing contract; `FEED_SLICE_VERSION` is the slice's structure.
  - Widening a canonical enum's value domain is a contract change: bump the `user_version` of every DB carrying that column.
  - A value-domain change does not bump `FEED_SLICE_VERSION` — the slice stays structurally identical and stale cells self-heal on cadence, while a bump invalidates every slice at once and fails the next release deploy closed.
  - Tests pin each marker; update the assertion in the same commit or the bump is not real.
- `content_hash` covers the written artifact and gates the PUT, so a translation-only improvement still ships. `upstream_hash` covers the same records before localization and is what `changed` reports, so a late translation never stamps `last_content_change` for a register that published nothing.
- Every state field is required. Never add an optional-field fallback for an older shape.
- Feed slices collapse on `icao_hex` where published and on `registration_key` where not; keying on hex alone silently excluded every hex-less source. Collapse mechanics are `src/feed.ts`. The rules that file cannot tell you:
  - Both key columns stay nullable — the unique indexes rely on SQLite not treating NULLs as equal.
  - No `source_id` tiebreak: it is per-row and may be reissued every publication, which flips the served answer with no upstream change.
  - Cancelled, reserved, and null-status records are excluded once, at slice construction.
  - Reserved is not a weaker cancelled: no airframe exists behind the mark. Map held marks to `reserved`, never `other` — `other` is served.
  - `status` is the schema's one nullable canonical field: a blank or unresolved cell stays null, never `other`.
  - A slice schema change bumps `FEED_SLICE_VERSION` so older slices regenerate. Never migrate or filter old shapes at merge — an earlier producer's slice is short by rows the current one keeps.
  - Cadence-skip requires the slice to exist; publish fails closed if any is missing.
- The translation cache persists independently of the content-hash skip gate; a contract-version mismatch invalidates the whole prior generation. A translating run writes the cache back before calling Gemini and skips the batch when that write fails — an unwritable cache re-bills the identical delta every run, so that byte-for-byte PUT guards spend and must not be removed as redundant. A party NAME is never a translation candidate.
- `language:` is required, never defaulted: it decides whether a source is billed to Gemini at all. `language: en` skips the pass entirely — rendering English as English rewords curated labels and invents meaning for bare codes. The per-field exclusion guards both collection and application, so an older cache entry cannot overwrite the mapping.
- Each translatable field's `<field>_source_text` is captured at parse time before any English rendering; that satisfies a license requiring the source meaning not be distorted. A source whose primary field is already English via a parse-time transform must declare that mapping explicitly, or the transform discards the raw value. A cache miss falls back to the original text, never null.
- A rejected Gemini key throws rather than warns: staleness keys off `upstream_hash`, which keeps advancing while the translator stays broken. Every other Gemini or cache failure degrades to source text.
- R2 is a build and intermediate store; nothing serves reads from it. The DB is baked into the Cloud Run image and served in-memory — single instance, scale-to-zero, no runtime fetch, so a data change reaches production only by redeploying an image. Assembly always rebuilds from R2 slices, never an ambient on-disk copy, and sequences through the recipe rather than prerequisites so `make -j` cannot assemble mid-refresh.
- A per-row surrogate key that changes between publications is not a `source_id`. Prefer a permanent registration/certificate identifier over a reissued mark, but verify uniqueness per publication.
- Duplicate `source_id`: byte-identical rows skip; differing rows resolve on a real recency signal. A collision with no signal fails the run by default — file position is not a recency signal.
  - Exception, opt-in per source: `duplicate_conflict: last-wins` keeps the later row. Only where a register contradicts itself on a field nothing can arbitrate and the alternative is a whole fleet failing on one row. Never a default, never fleet-wide. The warn is the only record that a published row was dropped; never downgrade it to a duplicate skip.
- `paused: true` is for a source whose upstream is unreachable for reasons no config change can fix (a WAF block, a geoblock CI cannot route around). It leaves the scheduled refresh but stays in feed assembly, so the last good slice keeps serving; naming it in `REFRESH_SOURCE` still runs it, which is how recovery is tested. A paused source cannot regenerate its slice, so a later `FEED_SLICE_VERSION` bump invalidates it and publish fails closed until it is unpaused or removed.
- Never retry a mapping failure: it is deterministic on the same bytes. Fix the mapping so a signal exists.

## GitHub Actions

- One deploy job, reached only by `workflow_call`. Never give it a trigger of its own, never add deploy steps to a caller — a test scans every workflow and fails on a second deploy.
- Its concurrency group is a constant, queued at maximum, never cancelled. Inside a called workflow `${{ github.workflow }}` resolves to the caller's name, so an interpolated group files the release and refresh deploys separately and can cancel the caller. The default queue retains one pending run and replaces it on a third, silently discarding a forced release deploy. A deploy killed halfway leaves the service updated with the marker naming the old hash.
- A caller must grant `contents: read` + `id-token: write`. Called-workflow permissions can only be downgraded by the caller, so an omitted grant breaks Workload Identity at deploy time, not lint time. Pass only the declared R2 credentials; never `secrets: inherit`.
- The release deploy assembles from existing R2 slices and does not refresh first, so a release that adds a source or bumps `FEED_SLICE_VERSION` cannot deploy until a refresh has written slices. Land the change, let a refresh run, then release. Recovery is Re-run failed jobs on the same release run — not Re-run all jobs, which makes Release Please report `release_created=false` and skip the deploy. Never relax the fail-closed check.
- A refresh run waiting on the deploy group keeps holding the Gemini quota group, so a manual refresh during a release deploy blocks with no visible cause. One-directional, so it cannot deadlock — do not give the deploy its own group.
- Ad-hoc deploys (rollback, retry, shipping without a release) are a local `make deploy`. Do not add a `workflow_dispatch` deploy button.
- Refresh cadence: where declared cadence and observed rhythm differ, run at the more frequent, and record both in `DATA_LICENSES.md`. Sources publishing faster than the cron need their own workflow. Every run is a full fetch; the content hash still gates the PUT.
- Cadence compares whole UTC days, never an ms window: `last_run` is stamped at completion, so a strict window pushes every cycle a day later.
- An overdue source bypasses the cadence gate every tick until it publishes, on the staleness issue's own threshold — one threshold, never two. Stuck escalated means `cadence_days` is wrong.
- Exactly three things bypass the cadence gate, and no fourth: `DRY_RUN`, `FORCE_REFRESH`, and the overdue escalation. `FORCE_REFRESH` without `REFRESH_SOURCE` throws at the pipeline boundary, not only in the workflow, since `make refresh` never touches it.

## Commits

- RAI footer: exactly one, carrying a contact, graded by contribution — `Authored-by` human-only · `Commit-generated-by` trivial AI · `Assisted-by` AI-helped but human-written · `Co-authored-by` ~50/50 · `Generated-by` AI-majority. AI-majority is the normal case. Never stack a second footer naming the same model, whatever a harness default asks for. A genuinely distinct agent (e.g. `Codex <noreply@openai.com>`) gets its own line.
- Atomic: each commit independently typechecks, lints, passes tests. Never sweep unrelated working-tree changes in.
- Never `--no-verify`, never bypass a pre-commit check.

## Branch hygiene

- Scope = branch name + first commit's diff shape. Nothing else.
- `feat/*`: `src/`, `tests/`, `sources/`, `fixtures/`, plus docs for that feature.
- `docs/*`: `README.md`, `DATA_LICENSES.md`, `docs/*`. No code/sources/fixtures.
- `fix/*`: bug + tests proving it.
- `chore/*`: tooling, CI, deps. Nothing user-facing.
- Out-of-scope work → new branch. Triggers: active `feat/*` and asked for license triage or unrelated docs; active `docs/*` and asked for code; commit log shows two themes and a third is asked.
- Switch: commit/stash → state the mismatch in one line → branch from `main`, never the active branch.
- Never call a mix "related" when the only link is one conversation. A diff hard to title in one line is two PRs.

## Documentation

- Never restate what `sources/*.yaml`, `src/schema.ts`, or other code states — link, don't transcribe. Per-source mechanics, field mappings, and schema field lists belong in the YAML/schema.
- Never create a new top-level doc file unilaterally; ask. Exception: source-onboarding artifacts in the standard workflow.
- Required on state change: `DATA_LICENSES.md` (source added or posture changed) · `README.md` sources table (alongside any new source) · `PRD.md` (only when goals, requirements, or constraints shift — planning, not a shipped-implementation log).
- Three onboarding surfaces — a change to `make` targets, `.env.example`, or a required env var updates all three or none: `docs/getting-started.md` (non-developer, manual) · `docs/getting-started-with-ai.md` (non-developer, agent-driven) · the setup skill (executed by the agent). The first two are human product documentation.
- The setup skill's one real copy lives under `.agents/` (vendor-neutral, and what Codex scans); `.claude/skills/` holds a tracked relative symlink. Edit the `.agents/` copy; never replace the symlink with a second real file. `.gitignore` must keep `.claude/*` + `!.claude/skills/` — ignoring `.claude/` kills the negation, since git cannot re-include under an excluded directory, and the symlink vanishes from every clone with nothing failing. Windows clones without `core.symlinks` get a text file; the AI guide documents the fallback.
- Never put a literal registration, hex, or record in onboarding docs. Read one out of the built artifact at runtime.
- `DATA_LICENSES.md` is the single record for correspondence and posture. Flat tracker, not a reply archive — the email thread is the verbatim record. Three sections, each with one job:
  - `## Agency Correspondence` — who was written to, when, and the reply state. Bare table.
  - `## Required Notices` — agency-mandated wording and nothing else: one `<source-id>: "<text>"` line per mandate. No rationale, clearance basis, coverage cost, or served credit line. A source with no mandated wording does not appear.
  - `## Source Posture` — clearance basis, conditions, residual exposure, coverage cost. Never the served credit line; that is `src/service/attributions.ts`.
- `docs/source-onboarding-checklist.md`: triage worklist only. Tracking tables stay bare — contact provenance, names, phones, prefixes belong in `DATA_LICENSES.md`.
- When a decision reverses an earlier one, say so in the commit body and update the rule here in the same commit.
