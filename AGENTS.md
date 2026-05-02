# AGENTS.md

Canonical instruction source for this repository. Treat this file as authoritative.

## Scope

- Apply these rules when changing code in this repo.
- If a local instruction file conflicts with this file, prefer this file.

## Non-Negotiable Constraints

- Goal is long-term maintainable and reliable solutions only.
- Do not implement quick fixes in this codebase for any reason.
- Any test files introduced for local validation must be removed, not committed.

### Security: file access and path handling

- Reject any user-controlled path input containing `..`.
- Resolve to absolute paths before use.
- Enforce sandbox-root containment after resolution.
- Default to deny on validation failure.

### GitHub Actions: action pinning

- `actions/*` references may use tagged major versions (e.g., `@v6`).
- All other actions must be pinned to a commit SHA with the version in a comment
  (e.g., `@abc123 # v4.1.0`).

### Commit format (when committing is requested)

- Use Conventional Commits.
- Include required RAI footer:
  ```
  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  ```

## Project: metal-birds-feed

A config-driven TypeScript data pipeline that translates national aviation registries
(FAA, Transport Canada, UK CAA, GCAA) into a single normalized JSON schema stored in
Cloudflare R2 as static objects for O(1) lookup by registration ID and ICAO hex code.

Runtime: **Bun**. No web framework. Execution happens on GitHub Actions monthly cron or
`workflow_dispatch`. The pipeline is the product — there is no server to run locally.

## Architecture Rules

- `src/schema.ts` is the single source of truth for the canonical aircraft schema. All
  engine output and R2 objects must validate against it.
- Source configs live in `sources/<source-id>.yaml`. Adding a new country registry means
  writing a new YAML config — never modifying the translation engine.
- The translation engine (`src/engine.ts`) must be source-agnostic. It reads a config and
  raw rows; it does not know which country it is processing.
- R2 key format is strict:
  - `aircraft/by-id/<source>/<unique-id>.json` — canonical record
  - `aircraft/by-icao-hex/<hex>.json` — `{"refs": ["<source>:<id>", ...]}` lookup
  - `aircraft/by-registration/<reg>.json` — `{"refs": ["<source>:<id>", ...]}` lookup
  - `aircraft/_manifest/<source>.json` — content-hash manifest for diff-write
- Use FAA `UNIQUE ID` (not N-number) as the `source_id` for FAA records — N-numbers are
  reissued, UNIQUE IDs are permanent.

## PII Policy

- **Never** include owner mailing addresses or ZIP codes in canonical records or R2 objects.
- Permitted owner fields: `name`, `kind`, `state`, `country`.
- Any source field that maps to a street address must be silently dropped by the mapping config.

## Test Standards

- Coverage thresholds: 85% lines/functions/statements, 80% branches (enforced in vitest.config.ts).
- Every translation engine function must have positive, negative, and edge-case tests.
- Acceptance fixtures in `fixtures/faa/` represent the ground-truth for CI. Do not modify
  expected output without a matching schema or config change that justifies it.

## TypeScript Strictness

- `strict: true` is enforced in `tsconfig.json`. Run `make typecheck` to verify.
- Do not weaken strict settings or add `// @ts-ignore` without a justifying comment.

## Documentation

- Do not add docs to the project unless specifically asked.
- `DATA_LICENSES.md` must be updated whenever a new source registry is added.
