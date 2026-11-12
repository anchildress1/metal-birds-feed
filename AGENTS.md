- This file overrides any conflicting local instruction file. Read `PRD.md` §CC before any source-posture decision.

## Hard prohibitions

- PII: keep `owner`/`operator` `{name,kind,state,country}` only. Drop street/street2/city/postal-code/county/region/care-of at the mapping config. A country read from an address's trailing component is permitted; never infer it from the register's own country.
- No unauthenticated read API (PRD §CC.4). No attribute query/filter/list surface, no full-artifact access. Bearer auth, rate-limited, one consumer, exact point lookups on a unique key.
- No commercial operator deployment (PRD §CC.3).
- No public output distribution. Artifacts are private to Ashley-operated applications; forks self-host.
- No `..` in path inputs. Resolve to absolute, enforce sandbox-root containment after resolution, default deny.
- No quick fixes. No backwards-compatibility shims.
- No `// @ts-ignore` without a justifying comment. Never weaken `tsconfig.json` strict settings.
- No inline `eslint-disable*`/`eslint-enable` directives, src or tests. Restructure so the rule passes; a config change is a chat question, never a PR comment.
- No error handling for impossible scenarios. Validate at system boundaries only.
- No `.skip` on tests — fix or delete. Never lower coverage thresholds.
- No silent loss of upstream information. Extend `src/schema.ts` rather than drop a structurally meaningful field at mapping config. PII is the only allowed drop. A field restating a type-level property derivable from mapped fields is not structurally meaningful.
- No invented data. Null beats a plausible guess.
- Human prose only in `README.md`, `docs/*.md`, `PRD.md`, `DATA_LICENSES.md`, `CHANGELOG.md`, commit/PR bodies. Elsewhere — this file, `SKILL.md`, `references/*`, `src/`, `tests/`, `sources/*.yaml`, workflows — no overview/purpose/introduction/summary/transition/status sentence, no paragraph where a bullet states the rule.
- Comments: WHY only — a constraint, an invariant, or a failure mode a reader would reintroduce. Never WHAT. Never narrate a change, ticket, or PR.

## Code style

Match the surrounding code. Lint enforces only `no-var` and `prefer-const`; apply these by hand:

- `??`/`??=` over `||` for null/undefined; `?.` over guard clauses.
- No `as T` unless TS cannot narrow structurally. `no-unnecessary-type-assertion` catches only the no-op case.
- A module-private helper called above its definition stays a `function` declaration: `engine.ts` relies on hoisting and `const` is a TDZ crash.
- Never `await` inside `for`/`while`; use `Promise.all`/`allSettled` + `.map()`. Exception: inherently sequential consumption (stream pumps, backoff chains), with the WHY inline.

## Tests

- `tests/` mirrors `src/`; never colocate — `coverageSkipTestFiles` hides a `src/*.test.ts` from the coverage gate and it lands green.
- Keep `--isolate`: `mock.module` is process-global and leaks across files without it.
- The gate thresholds line/function/statement only. Cover branches by intent.
- A CLI entry point is a one-line shell over an exported function (`mark-deployed.ts`) and carries no test; logic in the shell is untested logic.
- No test exists to move a coverage number. A test must fail when the behavior it names breaks.
- Every engine function: positive + negative + edge cases.
- `fixtures/<source>/` is CI ground truth: real upstream rows, changed only with a schema or config change. `extraction/` also changes with the PDF model or prompt.
  - Sanitize natural-person names and addresses. Keep organization names and every technical value verbatim.
  - Verify a row shape against the live file before adding it. Never fabricate one.
- Remove local-validation test files before commit.

## Source onboarding

- A missing ICAO 24-bit hex is not a disqualifier: hex-less rows reach the feed on `registration_key`, and no join path recovers a hex. Record the coverage cost (tail-number lookups only).
- A registration mark is mandatory. A mark normalizing to nothing costs that row both keys.
- Classify posture per CC.1: Open / Private-use / Restrictive / Unknown.
- Private-use or Unknown: research storage/caching/automation terms first. Email via `docs/agency-permission-request.md` only when private caching is still unclear.
- Restrictive = paid single-PC, no-copy, no-storage, no-scraping, view-only, no-redistribute with storage implications, or active denial (PRD §CC.5). Exclude and record the reason. Do not email absent a new material fact.
- CC.2 fallback: no reply in 30 days + no terms prohibiting private caching → proceed for private operator use. Never follow up inside the window.
  - Verify in Gmail that no reply landed. `PRD.md` is authoritative, not the checklist's `Fallback` column.
  - Record residual exposure where terms are narrower than the intended use.
- A new source is complete only with all six surfaces:

| Surface                               | Content                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `sources/<id>.yaml`                   | config                                                                                                  |
| `fixtures/<id>/`                      | real rows; a PDF source adds `extraction/` via `make record-extraction`                                 |
| `DATA_LICENSES.md`                    | `## Source Posture` bullet; `## Required Notices` line only where wording or credit content is mandated |
| `README.md` sources table             | row inserted alphabetically by country, never appended; active sources only                             |
| `src/service/attributions.ts`         | `NOTICES[<id>]` — a missing entry silently degrades to a generic slug credit                            |
| `docs/source-onboarding-checklist.md` | `✅ Done` row; remove the source's triage row                                                           |

### Research-first

- Exhaust research before the first email: open-data portals (CKAN/Aporta/data.gov.\*), register pages, ToS/disclaimer, robots policy, license declarations.
- Record in lockstep: `DATA_LICENSES.md` (correspondence row + posture, storage/cache restrictions) + `docs/source-onboarding-checklist.md` (in-flight row).
- Keep an agency email in `DATA_LICENSES.md` only if that agency replied — a recorded non-replier address reads as verified. `Email` is `n/a` wherever `Reply` is `pending`. Gmail is the record of who was written to.
- After recon on an already-emailed agency: update docs, move on; re-contact only on a materially new fact.

## Engine

- Use existing extension points; never edit row-mapping logic for one source. A new registry is a new YAML, plus a transform or parser path when needed.
- Never retry a mapping failure — deterministic on the same bytes (PDF extraction via its cache); fix the mapping so a signal exists.

### Fetching

- `download.prime_url`: for an edge that answers a cold request with 200 + a challenge page and clears it on a cookie. Primed cookies stay origin-locked — a replayed `Cookie` header has no jar enforcing `Domain`.
- `download.manual`: for a register behind a JS or CAPTCHA challenge. Never defeat the challenge (solver, proxy pool, fingerprint spoofing) — that is the CC.5 no-scraping case. The operator's browser download goes through `make ingest` into R2; every refresh maps that copy.
  - Never also set `paused`: the stored copy is what lets a `FEED_SLICE_VERSION` bump regenerate the slice unattended.
  - Its staleness issue means a new file is due from the agency, not a broken fetch. Set `cadence_days` to the agency's publication rhythm.
- `paused: true`: for an upstream no config change can reach (a geoblock or WAF CI cannot route around). It leaves the scheduled refresh but stays in feed assembly, so the last good slice keeps serving; naming it in `REFRESH_SOURCE` still runs it — that is how recovery is tested.
- A paused source cannot regenerate its slice, so a `FEED_SLICE_VERSION` bump fails publish closed until it is unpaused or removed.

### Record integrity

- `latest_snapshot_by`: required where a register accumulates publications instead of replacing them, or the feed serves an older active row for a mark the newest publication cancelled.
- `header_text`: required on a `columns` + `skip_rows` source with a discarded header row, so a column swap or rename fails the run; width alone does not catch a swap. Copy it verbatim from the live file, annotations included.
- `record_count`: catches a dropped row writing a short artifact.
  - Use the separate-endpoint form for any paged API that cannot self-report truncation. A publication landing between the two responses fails the run — rerun, never relax.
  - Count against parsed rows where the published total covers history `latest_snapshot_by` filters.
  - `count_matches: true` counts pattern matches in the endpoint response, for a register stating no total but listing one entry per row elsewhere (a sitemap). Verify the listing equals the rows, and pattern only per-row entries.
  - PDF sources cannot use it. `download.manual` sources cannot use the endpoint form.
- Zero rows always fails.
- Merge blocks (`merge_duplicates`, `joins[].merge_duplicates`) are for registers emitting one row per co-registered party; never drop the extra rows.
  - A join merge names raw upstream columns and runs before row mapping: stamp the register's own vocabulary and add it to the lookup, never a canonical value.
  - For the primary, a differing path outside the block — or a stamped path where either row conflicts — is a real collision and falls to recency.
- Duplicate `source_id`: byte-identical rows skip; differing rows resolve on a real recency signal. A collision with no signal fails the run. File position is not a recency signal.
  - Opt-in exception: `duplicate_conflict: last-wins`, only where a register contradicts itself on a field nothing can arbitrate and the alternative is a whole fleet failing on one row. Never a default, never fleet-wide. Its warn is the only record that a published row was dropped; never downgrade it to a duplicate skip.
- `source_id`: a per-row surrogate that changes between publications is not one. Prefer a permanent registration/certificate identifier over a reissued mark; verify uniqueness per publication.
- A list-valued `source_id` joins its columns with `|`, escaping `|` and `\` inside each value.
  - The first column is mandatory; a blank later one is an empty segment, never a failure.
  - Key on columns that held across publications; a reissued mark must arrive with a changed column so it keys as a new row.
  - Not combinable with `source_id_transform`.

### PDF

- Gemini (`src/pdf/gemini-table.ts`, `PDF_EXTRACT_MODEL`) reads the table. A source declares `pdf.mark_field` + `pdf.mark_pattern`, plus `mark_pattern_exclusions` / `markless_pages` where needed.
- `mark_pattern` is compiled as `^(?:…)$` and matches whole text items; write it unanchored.
- Extraction runs per 5-page chunk (`src/pdf/chunks.ts`): one response cannot hold a large register before `MAX_TOKENS`. Chunk requests start paced at `GEMINI_REQUESTS_PER_MINUTE`; a mark-less chunk is never sent.
- The text-layer mark check is the row guard, per chunk: every text item on the chunk's pages matching `mark_pattern` must be an extracted mark and vice versa, counted one for one. A model can stop early or merge rows and still report STOP.
  - A row printed across a chunk boundary fails the run (mark-less continuation row). Never relax the check or overlap chunks to pass it; re-chunking is a design change.
  - A non-mark text item matching the pattern (a wrapped continuation line) goes in `mark_pattern_exclusions`, verbatim. Never loosen the check to a count budget.
  - A mark printed as split glyph runs: widen `mark_pattern` (`\s*`), never drop the item.
- A page printing no mark escapes the check, so any mark-less page outside the trailing `pdf.markless_pages` (default 0) fails the run before any paid call. Budget only trailing pages the register genuinely prints without marks (a header-only last page); never widen it to mid-document pages. Record the residual gap in the YAML beside a nonzero budget.
- pdf.js (text layer) and pdf-lib (chunks) count pages independently; a disagreement fails the run, since a page only one sees is never checked.
- Cells keep every printed line, joined with `\n`: `first_line_or_null` and party transforms read the name off line one; a joined address leaks into the name.
- Retry transport errors only, each attempt under a request timeout. A non-STOP finish, malformed JSON, or schema break fails the run.
  - An aborted request is still billed and then retried: keep the timeout several times the slowest chunk's normal generation, never near it.
- The extraction cache (`aircraft/_pdf_extraction/<id>.json`) is what makes extraction deterministic: one entry per chunk, keyed on its pages' text + columns + `PDF_EXTRACT_FINGERPRINT` (model + prompt) → the stored response, re-validated. Gemini varies run to run; without it an unchanged PDF advances `upstream_hash`. Only a validated chunk is stored, saved as it validates, so a run killed at the job timeout or failing another chunk re-bills only what it never got back.
  - A cached response that no longer validates (a `mark_field`/pattern change keeps its key) is re-requested and replaced, never left to fail every run.
  - A corrupt cache fails the source, like the translation cache: read as empty it re-bills everything and drifts cells the mark check never compares.
  - A failed mid-run PUT is logged. A clean run rewrites the cache at the end, which retries it and throws on a second failure; after a chunk failure, the chunk failure is the thrown error.
  - `make ingest` maps through the same cache, so its forced refresh bills nothing new.
- A dry run reads the cache but suppresses the PUT like every other write, so it re-bills every uncached chunk on every run. Verify a PDF change with a real refresh, never repeated dry runs.
- `fixtures/<id>/extraction/<pdf>.json` is the recorded model response per chunk, in chunk order (null for an unsent mark-less chunk); engine tests map from it. `make record-extraction` runs the real extraction — paced and mark-checked; a PDF with any failed chunk keeps its previous recording. Re-record with `make record-extraction SOURCE=<id>` on any model or prompt change, review the diff by hand against the PDF, and commit it with that change.
- A failing mark check on a live refresh: read the named marks against the PDF. A real row the model missed is a prompt or model problem, never an exclusion.

### Values

- Enumerate every upstream code with no `default`, so an added or renamed code fails the run.
  - A null `lookup` value (recognized, no schema value) differs from an absent key.
  - `default` only where an unmatched value is routine data, not drift: it nulls the field and logs per row, unusable at volume.
- A blank cell short-circuits to null before any `lookup`; a `transform` returning null bypasses it. Enumeration does not cover blanks.
- A non-blank cell a date transform (`DATE_TRANSFORMS`) rejects maps to null, never `default`. Per field, rejections above half the non-blank cells fail the run as format drift; fewer emit one `map_date_rejected` warn. Blank and `null_values` cells count toward neither.
- Register absence-words and placeholder dates go in `null_values`; never in the transform.
- `null_values`: for a register stating absence in words; prefer it over a lookup for a free-text column of proper nouns. A code meaning "nothing to report" is absence: left populated, two rows differing only there are an unresolvable duplicate.
- `status` resolves outside the scalar path and never consults `null_values`. Enumerate a status sentinel as a null `lookup` value.
- `positive_float_or_null`: only for a quantity a register zero-fills where zero is impossible (mass, span, speed). Never a count.

## Architecture invariants

- `mapRows()` (`map_*`) is column mapping; `localizeRecords()` (`localize_*`) is the Gemini pass. Never call mapping "translate", prose included.
- Every state field is required. Never add an optional-field fallback for an older shape.
- A per-source artifact keeps its closed rows (`removed_on` set); live rows regenerate from source. A closed row is data the register no longer holds, not cache; it migrates, never resets.
  - A live row closes on the second consecutive fetched run that misses it, on a later UTC day, dated to the first miss. A cadence skip or a failed run counts as neither a miss nor a return. The artifact PUT is the last write before state, so a failed slice never advances history. Never serve `first_seen`.
  - A stored artifact that cannot be fetched or read fails that source. Only an absent one starts history over. Never reset to get past an error.
  - A schema bump migrates closed rows via `db.ts` `MIGRATIONS`, keyed by the version rows leave, chained hop by hop to current; a missing entry fails closed. An additive bump ships an identity entry (`(rows) => rows`) in the same commit — the new column stores NULL; anything else ships a real transform.
- Never serve reads from R2; it is a build and intermediate store. Bake the DB into the Cloud Run image and serve it in-memory (single instance, scale-to-zero, no runtime fetch): data reaches production only by redeploying an image.
- `make refresh` writes R2; `make deploy` assembles from R2 and ships — never chain a refresh into deploy. Assembly always rebuilds from R2 slices, never an on-disk copy. `deploy` sequences assemble → deploy-only in its recipe, not as prerequisites, so `make -j` cannot ship before assembly ends. Publish fails closed if any slice is missing.
- The Makefile sources `.env` inside every recipe that reads credentials (`LOAD_ENV`) and re-applies command-line variables after it; never let `.env` beat `make <target> VAR=x`.

### Version markers

Bump each independently; check all three on every schema change. Never align numbers — a match is chance. Tests pin each; update the assertion in the same commit.

| Marker                                    | Bump when                                                                                                                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| per-source artifact `PRAGMA user_version` | consumer-facing contract changes, incl. widening a canonical enum's value domain                                                                                        |
| `feed.sqlite` `PRAGMA user_version`       | same, for every DB carrying the column                                                                                                                                  |
| `FEED_SLICE_VERSION`                      | slice structure changes. Never for a value-domain change: stale cells self-heal on cadence, and a bump invalidates every slice and fails the next release deploy closed |

- A slice bump regenerates older slices. Never migrate or filter old shapes at merge — an earlier producer's slice is short by rows the current one keeps.

### Feed collapse

Key collapse on `icao_hex` where published and on `registration_key` where not; keying on hex alone excludes every hex-less source.

- Both key columns stay nullable — the unique indexes rely on SQLite not treating NULLs as equal.
- No `source_id` tiebreak: it may be reissued every publication, flipping the served answer with no upstream change.
- A collision the register's own dates cannot settle — within a slice or across slices on one hex — goes to the row history proves newest: its `first_seen` is after its source's `history_start` and after the other row's `first_seen`. Otherwise within-source drops the key; cross-source keeps the first claim, in sorted source order, that history has not superseded.
  - Never rank raw `first_seen`: migration and onboarding stamp every pre-existing row with `history_start`, so raw order is onboarding order.
  - Sound only on a stable `source_id`: a reissued one reopens every row as newly seen.
  - A reopened row keeps its original `first_seen`, so an airframe returning to a register loses to a stale claim another register still lists. Accepted: fixing it needs a reappearance date column; never overwrite a closed row's `first_seen` to get it.
- Cancelled, reserved, and null-status records are excluded once, at slice construction.
- Reserved is not a weaker cancelled: no airframe exists behind the mark. Map held marks to `reserved`, never `other` — `other` is served.
- `status` is the one nullable canonical field: a blank or unresolved cell stays null, never `other`.
- A register publishing no status maps to constant `unknown` (served), never `valid`. `valid` needs the register to state it — a per-row cell or a document that declares its rows active.

### Hashes and translation

- `content_hash` covers the written artifact and gates the PUT, so a translation-only improvement still ships. `upstream_hash` covers the pre-localization records and drives `changed`, so a late translation never stamps `last_content_change`.
- `language:` is required, never defaulted: it decides whether a source is billed to Gemini. `language: en` skips the pass — rendering English as English rewords curated labels and invents meaning for bare codes. The per-field exclusion guards collection and application alike, so an older cache entry cannot overwrite the mapping.
- `<field>_source_text` is captured at parse time, before any English rendering, satisfying licenses that forbid distorting source meaning. A field already rendered English by a parse-time transform must declare its source-text mapping explicitly, or the raw value is lost. A cache miss falls back to source text, never null.
- The translation cache persists independently of the content-hash gate; a contract-version mismatch invalidates the whole prior generation.
- A translating run writes the cache back before calling Gemini and skips the batch when that write fails. An unwritable cache re-bills the identical delta every run; that PUT guards spend — never remove it as redundant.
- A party NAME is never a translation candidate.
- A rejected Gemini key throws: staleness keys off `upstream_hash`, which keeps advancing while the translator stays broken. Every other Gemini or cache failure degrades to source text.

## Refresh and staleness

- Where declared cadence and observed rhythm differ, run at the more frequent and record both in `DATA_LICENSES.md` `## Update cadence`. A source publishing faster than the cron needs its own workflow. Every run is a full fetch; the content hash gates the PUT.
- Sources that call Gemini (`format: pdf` or a non-English `language:`) run one at a time against the project RPM: `main()` chains them in a fleet run, `refresh-gemini` (`max-parallel: 1`) in CI. `writeDiscoveredSources` splits the CI matrix with the pipeline's own loader; never classify sources by grepping YAML.
- Cadence compares whole UTC days, never an ms window: `last_run` is stamped at completion, so a strict window drifts every cycle a day later.
- A cadence skip requires the source's slice to exist; a missing slice forces the run.
- Exactly three things bypass the cadence gate: `DRY_RUN`, `FORCE_REFRESH`, and overdue escalation. No fourth.
  - Overdue escalation uses the staleness issue's own threshold — one threshold, never two. A source stuck escalated means `cadence_days` is wrong.
  - `FORCE_REFRESH` without `REFRESH_SOURCE` throws at the pipeline boundary, since `make refresh` never passes through the workflow guard.
- Staleness issues open and close on level, evaluated every CI run. A paused source is outside the matrix, so the `paused-staleness` job reads its stored state without fetching; `main()` never evaluates one. Never close only on the run that saw new content: a run without a GitHub token (local, VPN, `make ingest`) moves state with nobody to close the issue.

## GitHub Actions

- One deploy job, reached only by `workflow_call`. Never give it its own trigger, never add deploy steps to a caller.
- Its concurrency group is a constant, queued at maximum, never cancelled.
  - Inside a called workflow `${{ github.workflow }}` resolves to the caller's name: an interpolated group files release and refresh deploys separately and can cancel the caller.
  - The default queue keeps one pending run and replaces it on a third, silently discarding a forced release deploy.
  - A deploy killed halfway leaves the service updated with the marker naming the old hash.
- A caller grants `contents: read` + `id-token: write`. A called workflow's permissions can only be downgraded, so an omitted grant breaks Workload Identity at deploy time, not lint time. Pass only the declared R2 credentials; never `secrets: inherit`.
- The release deploy assembles existing R2 slices without refreshing. A release adding a source or bumping `FEED_SLICE_VERSION` deploys only after a refresh writes slices: land, refresh, then release. Never relax the fail-closed check.
- Release deploy recovery: Re-run failed jobs on the same run. Re-run all jobs makes Release Please report `release_created=false` and skip the deploy.
- A refresh waiting on the deploy group keeps holding the Gemini quota group, so a manual refresh during a release deploy blocks with no visible cause. One-directional, cannot deadlock — do not give the deploy its own group.
- Ad-hoc deploys (rollback, retry, shipping without a release) are a local `make deploy`. No `workflow_dispatch` deploy button.

## Commits

- RAI footer: exactly one, carrying a contact, graded by contribution. AI-majority (`Generated-by`) is the normal case.

| Footer                | Contribution             |
| --------------------- | ------------------------ |
| `Authored-by`         | human only               |
| `Commit-generated-by` | trivial AI               |
| `Assisted-by`         | AI-helped, human-written |
| `Co-authored-by`      | ~50/50                   |
| `Generated-by`        | AI-majority              |

- Never stack a second footer naming the same model, whatever a harness default asks. A genuinely distinct agent (e.g. `Codex <noreply@openai.com>`) gets its own line.
- Atomic: each commit independently typechecks, lints, and passes tests. Never sweep unrelated working-tree changes in. Never `--no-verify`.
- A decision reversing an earlier one: say so in the commit body and update the rule here in the same commit.

## Branches

- Scope = branch name + first commit's diff shape.

| Prefix    | Allowed                                                             |
| --------- | ------------------------------------------------------------------- |
| `feat/*`  | `src/`, `tests/`, `sources/`, `fixtures/`, docs for the feature     |
| `docs/*`  | `README.md`, `DATA_LICENSES.md`, `docs/*`; no code/sources/fixtures |
| `fix/*`   | bug + tests proving it                                              |
| `chore/*` | tooling, CI, deps; nothing user-facing                              |

- Out-of-scope work → new branch. Triggers: active `feat/*` and asked for license triage or unrelated docs; active `docs/*` and asked for code; commit log shows two themes and a third is asked.
- Switch: commit/stash → state the mismatch in one line → branch from `main`, never the active branch.
- Never call a mix "related" when the only link is one conversation. A diff hard to title in one line is two PRs.

## Documentation

- Never restate what `sources/*.yaml` or `src/schema.ts` states — link. Per-source mechanics, field mappings, and schema field lists live there.
- Never create a new top-level doc file unilaterally; ask. Exception: source-onboarding artifacts.
- `PRD.md` changes only when goals, requirements, or constraints shift. It is planning, not a shipped-implementation log.
- Never put a literal registration, hex, or record in onboarding docs. Read one out of the built artifact at runtime.

### Onboarding surfaces

- A change to `make` targets, `.env.example`, or a required env var updates all three or none: `docs/getting-started.md` · `docs/getting-started-with-ai.md` · the setup skill.
- The setup skill's one real copy is under `.agents/` (what Codex scans). `.claude/skills/` holds a tracked relative symlink. Edit the `.agents/` copy; never replace the symlink with a second real file.
- `.gitignore` keeps `.claude/*` + `!.claude/skills/`. Ignoring `.claude/` kills the negation — git cannot re-include under an excluded directory — and the symlink vanishes from every clone with nothing failing.

### `DATA_LICENSES.md`

Update it on every source addition or posture change; it is the single record for correspondence and posture. Keep it a flat tracker, never a reply archive — the email thread is the verbatim record.

| Section                    | Holds                                                                          | Never holds                                                                        |
| -------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `## Agency Correspondence` | who was written to, when, reply state; bare table                              | reply text                                                                         |
| `## Required Notices`      | one `<source-id>: "<text>"` line per agency-mandated wording or credit content | rationale, clearance basis, coverage cost, credit line; any source with no mandate |
| `## Source Posture`        | clearance basis, conditions, residual exposure, coverage cost                  | the served credit line (that is `src/service/attributions.ts`)                     |
| `## Update cadence`        | declared vs observed rhythm per source                                         | `cadence_days` values (those live in the YAML)                                     |

- `docs/source-onboarding-checklist.md` is a triage worklist. Its tables stay bare: contact provenance, names, phones, prefixes belong in `DATA_LICENSES.md`.
