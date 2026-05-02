# AGENTS.md

Canonical instruction source. Authoritative. Overrides any conflicting local instruction file.

## Scope

Apply when changing code in this repo.

## Non-Negotiable Constraints

- Long-term maintainable and reliable solutions only. No quick fixes.
- Test files introduced for local validation must be removed before commit.

### Security: file access and path handling

- Reject any path input containing `..`.
- Resolve to absolute before use. Enforce sandbox-root containment after resolution.
- Default deny on validation failure.

### GitHub Actions: action pinning

- `actions/*` may use tagged major versions (e.g., `@v6`).
- All other actions: pin to commit SHA with version comment (e.g., `@abc123 # v4.1.0`).

### Commit format

- Conventional Commits.
- Required RAI footer: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

## Project: metal-birds-feed

Config-driven TypeScript pipeline. Translates national aviation registries (FAA, Transport Canada, UK CAA, GCAA) into normalized JSON schema stored in Cloudflare R2 as static objects for O(1) lookup.

Runtime: Bun. No web framework. Runs on GitHub Actions monthly cron or `workflow_dispatch`. No local server.

## Architecture Rules

- `src/schema.ts` is the single source of truth. All engine output and R2 objects must validate against it.
- Source configs live in `sources/<source-id>.yaml`. New registry = new YAML config, never engine changes.
- `src/engine.ts` is source-agnostic. Reads config + raw rows. Does not know which country it processes.
- R2 key format (strict):
  - `aircraft/by-id/<source>/<unique-id>.json` — canonical record
  - `aircraft/by-icao-hex/<hex>.json` — `{"refs": ["<source>:<id>", ...]}`
  - `aircraft/by-registration/<reg>.json` — `{"refs": ["<source>:<id>", ...]}`
  - `aircraft/_manifest/<source>.json` — content-hash manifest for diff-write
- FAA `UNIQUE ID` (not N-number) is `source_id`. N-numbers are reissued; UNIQUE IDs are permanent.

## PII Policy

- Never include owner mailing addresses or ZIP codes in canonical records or R2 objects.
- Permitted owner fields: `name`, `kind`, `state`, `country`.
- Street address fields must be silently dropped in mapping config.

## Code Style

- Prefer `??` and `??=` over null/undefined checks.
- Prefer `?.` optional chaining over guard clauses for property access.
- Prefer `const fn = () =>` over `function fn()` declarations.
- Prefer `const` over `let`. Never `var`.
- No type assertions (`as T`) unless TypeScript cannot narrow and there is no structural alternative.
- Prefer `await` over `.then()`/`.catch()` promise chaining.
- Never use `await` inside a `for`/`while` loop. Use `Promise.all` or `Promise.allSettled` with `.map()` instead.
- Prefer `Promise.allSettled` or `Promise.all` over sequential awaits when operations are independent.
- Maximum cognitive complexity per function: 15.

## Test Standards

- Tests live in `tests/` mirroring `src/` structure (e.g., `tests/engine.test.ts` for `src/engine.ts`). Do not colocate test files next to source files.
- Coverage thresholds: 85% lines/functions/statements, 80% branches (enforced in vitest.config.ts).
- Every translation engine function: positive, negative, and edge-case tests.
- `fixtures/faa/` is CI ground-truth. Do not modify expected output without a schema or config change.
- `src/pipeline.ts` is excluded from coverage (untestable entry point).

## TypeScript Strictness

- `strict: true` enforced. Run `make typecheck`.
- Do not weaken strict settings or add `// @ts-ignore` without justifying comment.

## Documentation

- Do not add docs unless explicitly requested.
- `DATA_LICENSES.md` must be updated when a new source registry is added.
