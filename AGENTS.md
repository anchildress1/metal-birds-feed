# AGENTS.md

Canonical instruction source. Overrides any conflicting local file.

## Project

`metal-birds-feed`: config-driven TS pipeline. Translates national civil aircraft registries into a normalized JSON schema, stored in Cloudflare R2 as static objects for O(1) lookup. Bun runtime. No web framework. Runs via GHA monthly cron or `workflow_dispatch`. No local server.

## Distribution model

- Source-available code (Polyform Shield). Operator-private R2. No public read API.
- Operator deployment must stay non-commercial — CC BY-NC and "personal-use" source licenses require it.
- Forks self-host against their own R2 + their own per-source license assessment.

## Architecture

- `src/schema.ts` is the single source of truth. All engine output and R2 objects validate against it.
- Source configs in `sources/<source-id>.yaml`. New registry = new YAML, never engine changes.
- `src/engine.ts` is source-agnostic. Reads config + raw rows.
- R2 keys (strict):
  - `aircraft/by-id/<source>/<unique-id>.json` — canonical record
  - `aircraft/by-icao-hex/<hex>.json` — `{"refs":["<source>:<id>",...]}`
  - `aircraft/by-registration/<reg>.json` — `{"refs":["<source>:<id>",...]}`
  - `aircraft/_manifest/<source>.json` — content-hash manifest for diff-write
- FAA `UNIQUE ID` is `source_id`, not N-number.

## PII

- Permitted owner fields: `name`, `kind`, `state`, `country`. Drop street/city/postal/care-of at mapping config.

## Path safety

- Reject any path containing `..`. Resolve to absolute; enforce sandbox-root containment after resolution. Default deny on validation failure.

## Code style

- `??` / `??=` over null/undefined checks. `?.` over guard clauses.
- `const fn = () =>` over `function fn()`. `const` over `let`. Never `var`.
- No `as T` unless TS cannot narrow and there is no structural alternative.
- `await` over `.then()`/`.catch()`. Never `await` inside `for`/`while` — use `Promise.all`/`allSettled` with `.map()`.
- Max cognitive complexity per function: 15.

## Tests

- Live in `tests/` mirroring `src/`. Never colocate.
- Coverage thresholds (vitest.config.ts): 85% lines/functions/statements, 80% branches.
- Every engine function: positive, negative, edge.
- `fixtures/faa/` is CI ground-truth — only change with a schema or config change.
- `src/pipeline.ts` excluded from coverage (untestable entry point).

## TypeScript

- `strict: true`. `make typecheck`. No weakening, no `// @ts-ignore` without justifying comment.

## GHA action pinning

- `actions/*`: tagged major (e.g. `@v6`).
- All other actions: commit SHA + version comment (e.g. `@abc123 # v4.1.0`).

## Commits

- Conventional Commits.
- RAI footer: `Co-Authored-By: Claude <Model> <noreply@anthropic.com>` — use the actual model that produced the change.

## Other

- Long-term, maintainable solutions only. No quick fixes.
- Test files introduced for local validation removed before commit.
- `DATA_LICENSES.md` updated whenever a source is added or its license posture changes.
- Do not add docs unless explicitly requested.
