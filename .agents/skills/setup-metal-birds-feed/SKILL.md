---
name: setup-metal-birds-feed
description: >
  Drive a first-time local setup of the metal-birds-feed repository for a non-developer: verify the
  toolchain, install dependencies, run the credential-free test gate, walk the user through creating
  their own Cloudflare R2 bucket and API token, write .env, pull one small registry, then assemble
  and serve the feed locally. Trigger on "set up this project", "set this up for me", "help me get
  this running", "install this locally", "get me started", "walk me through setup", "configure MCP
  for this repo", and on any first-run failure of `make refresh`, `make assemble-feed`, or
  `make serve` in this repository. Do NOT trigger for adding a registry source, debugging pipeline
  translation, editing sources/*.yaml, or a deploy to Cloud Run on an already-working setup.
---

The user is not a developer. Every command runs through you; every account action runs through
them. Never blur that line — a step you cannot perform is a step you stop and hand over, not one you
narrate as done.

## Hard stops

| Never                                                     | Instead                                                   |
| --------------------------------------------------------- | --------------------------------------------------------- |
| Invent or placeholder an **externally issued** credential | Stop; the user pastes real values into `.env`             |
| Print `.env` contents, or echo a secret to stdout         | Confirm a key is non-empty; never reveal it               |
| Accept a secret pasted into chat                          | Direct it to `.env`; a chat log is not gitignored         |
| `git commit` anything during setup                        | Setup writes `.env` and `feed.sqlite` only — both ignored |
| `--no-verify`, or uninstall a hook to get past gitleaks   | Install gitleaks                                          |
| Run the full configured-source `make refresh` unprompted  | Confirm cost + time first (see Phase 5)                   |
| `make deploy` / `make deploy-only` unprompted             | Confirm; it publishes data to a server                    |
| Answer whether a registry's license covers this user      | Route to `DATA_LICENSES.md`; not your call                |
| Skip a phase because the user seems in a hurry            | Phase 2 exists to fail before they spend money            |

`.env` is gitignored and `make check` needs no credentials. Both facts are load-bearing: they let
the whole toolchain be proven correct before the user creates a single account.

## Phase 0 — Preflight

Run each; report as one table, not one message per check.

```bash
bun --version; git --version; make --version; python3 --version; openssl version; command -v gitleaks || echo "gitleaks: absent"
```

| Tool       | Required for                                         | If absent                                                         |
| ---------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| `bun`      | everything                                           | `curl -fsSL https://bun.sh/install \| bash`, then a new shell     |
| `git`      | clone                                                | macOS `xcode-select --install` · Debian `apt-get install -y git`  |
| `make`     | every command in this skill                          | macOS Xcode CLT · Debian `apt-get install -y make`                |
| `python3`  | `scripts/check-sources-sorted.py` on a README commit | Debian `apt-get install -y python3`                               |
| `openssl`  | minting `FEED_TOKEN` in Phase 6 and Phase 7          | Debian `apt-get install -y openssl`; absent on minimal WSL images |
| `gitleaks` | any `git commit` (unglobbed pre-commit hook)         | `brew install gitleaks`; defer if not committing                  |
| `gcloud`   | Phase 7 only                                         | Skip unless the user asks to deploy                               |

`.tool-versions` pins `bun 1.3.14`. A newer Bun is fine. If the user has mise or asdf, `mise install`
resolves the pin.

Windows: require WSL before continuing. The Makefile assumes a Unix shell.

## Phase 1 — Install

```bash
make install
```

Installs dependencies and git hooks. No network beyond the package registry, no credentials.

## Phase 2 — Prove the toolchain before any account exists

```bash
make check
```

Runs format-check, lint, typecheck, and ~1,400 tests. **Report the pass/fail line verbatim.** Do not
proceed on failure — a broken machine misdiagnosed as a broken credential wastes the user's money in
Phase 3.

Tell the user what this bought them: every later failure is configuration, not installation.

## Phase 3 — Human gate: Cloudflare R2

Stop. Emit these steps and wait for confirmation. Do not poll, do not continue, do not claim
progress while waiting.

1. Sign up at <https://dash.cloudflare.com/sign-up>
2. Left sidebar → **R2** → add a payment method (free tier still applies; R2 requires a card)
3. **Create bucket** — any name, default location
4. Copy the **Account ID** from the R2 overview page
5. **Manage R2 API Tokens** → **Create API token** → permission **Object Read & Write**, scoped to
   that one bucket
6. Copy the **Access Key ID** and **Secret Access Key** — the secret displays exactly once

State plainly: paste these into `.env` in the next phase, never into this conversation.

## Phase 4 — Write `.env`

```bash
cp .env.example .env
```

Then instruct the user to fill exactly four keys. Do not fill them; do not read them back.

| Key                        | From                          |
| -------------------------- | ----------------------------- |
| `MBF_R2_ACCOUNT_ID`        | R2 overview page              |
| `MBF_R2_ACCESS_KEY_ID`     | API token screen              |
| `MBF_R2_SECRET_ACCESS_KEY` | API token screen (shown once) |
| `MBF_R2_BUCKET_NAME`       | The bucket name they chose    |

Verify without disclosing:

```bash
grep -c '^MBF_R2_[A-Z_]*=.\+' .env   # expect 4
```

`GEMINI_API_KEY` is required only for a source whose YAML declares a non-English `language:`.
Inspect the current declarations in `sources/*.yaml`; do not copy a source list into this skill.
`language: en` skips Gemini entirely. Defer the key until a non-English source is actually
requested; a missing key throws rather than degrading, so it fails loudly when it matters.

## Phase 5 — First pull: one small source

Set the existing empty `REFRESH_SOURCE=` line in `.env` to `nl-ilt` — ~3k records, `language: en`,
no Gemini key, under a minute. Edit that line in place; the Makefile sources the file with `set -a`,
so a duplicate key further down silently wins and triggers the full pull. Do not offer the full pull
here, but state up front that Phase 6 needs every source, so the user knows Phase 5 is a checkpoint
rather than the finish line.

```bash
make refresh
```

Success is `event=pipeline_complete` in `logs/pipeline.log`. Confirm the object landed:
`aircraft/nl-ilt.sqlite` in the bucket (via the Cloudflare MCP server if configured, otherwise ask
the user to look).

**Full configured-source pull — confirm all four before running:**

- wall clock ≈ the slowest single register, since sources run concurrently. Measured locally: a
  complete run took 25s end to end (413k rows, 15 sources) with most sources cadence-skipped, so
  quote that as steady state and say a cold first pull is longer. **Not** the 30 minutes quoted
  elsewhere in this repo — that is this repo's own `timeout-minutes` on the CI refresh job, not a
  platform limit (GitHub allows 6h) and not a local measurement
- R2 pricing and account usage checked. State that the operator's first data load incurred
  approximately $6.50 USD in R2 charges. Present that as an observed bill, not a guaranteed quote
  or a claim about which billing dimension caused it
- `GEMINI_API_KEY` set if any remaining source declares a non-English `language:`
- the user has read `DATA_LICENSES.md` **and removed the `sources/<id>.yaml` of every source their
  own assessment does not cover.** Acknowledging that Ashley's clearances do not transfer is not
  enough: `make refresh` with no `REFRESH_SOURCE` pulls every config present, so an uncovered
  register is downloaded unless its file is gone. Deleting the YAML is the removal mechanism —
  the loader only sees what is on disk. Do not decide coverage for them; make the step explicit
  and let them choose per source.

`DRY_RUN=true` in `.env` downloads, parses and diffs without writing to R2. It does **not**
translate: `localize.ts` enters the Gemini call only when `!dryRun`, so a non-English source falls
back to cache or source text and the run cannot validate `GEMINI_API_KEY`. Offer it as a
shape check, never as a rehearsal of the paid run.

## Phase 6 — Assemble and serve

```bash
make assemble-feed
```

**Requires a slice for every source still configured in `sources/`, not just Phase 5's source.**
`resolveAllSources()` reads every YAML and `publishFeed` fails closed, so after a single-source pull
this exits `Missing feed rows for: <the other configured sources>`. Correct behaviour, not a bug:
a partial feed would serve silent holes. Do not retry it and do not work around it.

Stop and put the choice to the user: a full `make refresh` (check account-wide R2 usage,
`GEMINI_API_KEY` required for remaining non-English sources, `DATA_LICENSES.md` re-read first), or
end at Phase 5 with a working pipeline and a real artifact in R2. Phase 5 is a legitimate stopping
point — say so.

It also aborts naming a missing `MBF_R2_*` variable; quote whichever name it prints.

`FEED_TOKEN` must be ≥ 16 characters or startup throws. Export it and start the same entry point as
`make serve` **in the same shell**, backgrounded — a second terminal does not inherit the export,
and re-running `openssl` there mints a different token, so the request 401s while looking correct.
Capture `$!`; cleanup must target that process ID, never a shell job slot.

Then prove it with a mark read out of the artifact — never a remembered or plausible-looking one,
which misses and reads as a broken service:

```bash
(
  set -eu
  FEED_TOKEN=$(openssl rand -hex 16)
  test "${#FEED_TOKEN}" -ge 16
  export FEED_TOKEN
  export MBF_FEED_DB_PATH=./feed.sqlite
  bun run src/service/server.ts &
  SERVER_PID=$!
  trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

  READY=false
  for attempt in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
    if curl -s -o /dev/null http://localhost:8080/feed; then READY=true; break; fi
    sleep 0.25
  done
  test "$READY" = true

  MARK=$(bun -e 'import { Database } from "bun:sqlite";
    console.log(new Database("feed.sqlite", { readonly: true })
      .query("SELECT registration_key FROM feed WHERE registration_key IS NOT NULL AND length(registration_key) BETWEEN 2 AND 10 LIMIT 1")
      .get().registration_key)')
  RESPONSE=$(curl --fail-with-body -sS http://localhost:8080/feed/registration \
    -H "Authorization: Bearer $FEED_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"registrations\": [\"$MARK\"]}")
  RESPONSE="$RESPONSE" MARK="$MARK" bun -e '
    const body = JSON.parse(process.env.RESPONSE ?? "");
    const mark = process.env.MARK ?? "";
    if (!Object.hasOwn(body, mark) || typeof body[mark] !== "object" || body[mark] === null)
      throw new Error(`lookup missed selected mark: ${mark}`);'
  kill "$SERVER_PID"
  trap - EXIT
)
```

The selected key came from the feed, so an empty `{}` is a failed proof. Arbitrary marks genuinely
absent from the feed are omitted rather than returned as nulls.

Setup is complete here. Stop unless the user asks for Phase 7.

## Phase 7 — Deploy (only on explicit request)

Requires `gcloud` authentication and a billing-enabled Google Cloud project. Confirm the project
ID with the user, set it on the existing `GCP_PROJECT_ID=` line in `.env`, then provision the
first-deploy dependencies without printing the feed token:

```bash
(
  set -eu
  export GCP_PROJECT_ID=the-confirmed-project-id
  gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
    artifactregistry.googleapis.com secretmanager.googleapis.com iam.googleapis.com \
    --project="$GCP_PROJECT_ID"
  PROJECT_NUMBER=$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')
  gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/run.builder"
  gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
    --member="user:$(gcloud config get-value account)" \
    --role="roles/artifactregistry.repoAdmin"
  gcloud iam service-accounts create metal-birds-feed-run \
    --display-name="metal-birds-feed runtime" --project="$GCP_PROJECT_ID"
  FEED_TOKEN=$(openssl rand -hex 16)
  test "${#FEED_TOKEN}" -ge 16
  printf '%s' "$FEED_TOKEN" | gcloud secrets create feed-token \
    --data-file=- --project="$GCP_PROJECT_ID"
  gcloud secrets add-iam-policy-binding feed-token \
    --member="serviceAccount:metal-birds-feed-run@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" --project="$GCP_PROJECT_ID"
  make deploy
)
```

The deploy token is generated immediately before Secret Manager stores it; it is not the temporary
local token from Phase 6. If either resource existed before this attempt, stop; this is the
first-deploy path, not an overwrite path. The block is fail-closed, not transactional. If this
attempt created a resource before a later command failed, do not rerun the whole block.

`roles/artifactregistry.repoAdmin` lets every later `make deploy` prune old container images from
`cloud-run-source-deploy` (keep 5 newest, delete anything older than 90 days). Without it, deploy
still succeeds and just warns on stderr, skipping pruning for that run — not a reason to stop.

### Recover an interrupted first deploy

Use this only after confirming the fixed-name resources were created by the interrupted attempt in
the confirmed project:

```bash
(
  set -eu
  export GCP_PROJECT_ID=the-confirmed-project-id
  SERVICE_ACCOUNT="metal-birds-feed-run@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
  SERVICE_ACCOUNT_MATCH=$(gcloud iam service-accounts list \
    --filter="email=$SERVICE_ACCOUNT" --limit=1 --format='value(email)' \
    --project="$GCP_PROJECT_ID")
  if [ -z "$SERVICE_ACCOUNT_MATCH" ]; then
    gcloud iam service-accounts create metal-birds-feed-run \
      --display-name="metal-birds-feed runtime" --project="$GCP_PROJECT_ID"
  fi
  SECRET_MATCH=$(gcloud secrets list --filter='name=feed-token' \
    --limit=1 --format='value(name)' --project="$GCP_PROJECT_ID")
  if [ -z "$SECRET_MATCH" ]; then
    FEED_TOKEN=$(openssl rand -hex 16)
    test "${#FEED_TOKEN}" -ge 16
    printf '%s' "$FEED_TOKEN" | gcloud secrets create feed-token \
      --data-file=- --project="$GCP_PROJECT_ID"
  else
    ENABLED_VERSION=$(gcloud secrets versions list feed-token --filter='state=ENABLED' \
      --limit=1 --format='value(name)' --project="$GCP_PROJECT_ID")
    if [ -z "$ENABLED_VERSION" ]; then
      FEED_TOKEN=$(openssl rand -hex 16)
      test "${#FEED_TOKEN}" -ge 16
      printf '%s' "$FEED_TOKEN" | gcloud secrets versions add feed-token \
        --data-file=- --project="$GCP_PROJECT_ID"
    fi
  fi
  gcloud secrets add-iam-policy-binding feed-token \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor" --project="$GCP_PROJECT_ID"
  make deploy
)
```

Retrieve the token later without printing it:

```bash
export GCP_PROJECT_ID=the-confirmed-project-id
if FEED_TOKEN=$(gcloud secrets versions access latest \
  --secret=feed-token --project="$GCP_PROJECT_ID") && \
  test "${#FEED_TOKEN}" -ge 16; then
  export FEED_TOKEN
else
  unset FEED_TOKEN
  printf '%s\n' 'Could not retrieve a valid feed token.' >&2
  false
fi
```

`make deploy` assembles from R2 first, so a stale local `feed.sqlite` is never shipped. It does not
re-pull upstream. Confirm immediately before running it because it publishes data to a server.

## MCP configuration

Optional. Setup succeeds without it; it improves diagnosis. Configure on request, or offer once.

| Server                | URL                                       | Buys                                                     |
| --------------------- | ----------------------------------------- | -------------------------------------------------------- |
| `cloudflare-bindings` | `https://bindings.mcp.cloudflare.com/mcp` | Verify the bucket and uploaded objects directly          |
| `cloudflare-docs`     | `https://docs.mcp.cloudflare.com/mcp`     | R2 docs; no auth                                         |
| `context7`            | `https://mcp.context7.com/mcp`            | Current Bun / Zod / AWS SDK docs instead of stale recall |

```bash
# Claude Code
claude mcp add --transport http --scope user cloudflare-bindings https://bindings.mcp.cloudflare.com/mcp

# Codex
codex mcp add cloudflare-bindings --url https://bindings.mcp.cloudflare.com/mcp
```

`cloudflare-bindings` opens a browser OAuth login. It uses the user's Cloudflare session — never
pass it the R2 API keys from `.env`. Verify with `claude mcp list` / `codex mcp list`; a newly added
server needs an assistant restart before its tools load.

## Failure routing

| Message                                                       | Cause                                      | Action                                                                   |
| ------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| `command not found: bun`                                      | PATH not reloaded                          | New shell, re-run Phase 0                                                |
| `.env not found`                                              | Phase 4 skipped                            | `cp .env.example .env`                                                   |
| `MBF_R2_<KEY> missing from .env` (refresh)                    | That line is blank                         | Quote the named key; user fills it                                       |
| `MBF_R2_<KEY> is required` (assemble-feed / deploy)           | Same cause, different target's wording     | Quote the named key; user fills it                                       |
| `Missing feed rows for: <sources>`                            | Only some sources pulled yet               | Expected after a single-source pull; offer the full refresh, never retry |
| `Missing required environment variable: GEMINI_API_KEY`       | Non-English source in scope                | Add the key, or set `REFRESH_SOURCE` to an `en` source                   |
| `GEMINI_API_KEY rejected by Gemini`                           | Revoked / wrong project / billing off      | Setup bug, not transient — do not retry                                  |
| `FEED_TOKEN must be set (at least 16 characters)`             | Unset or short                             | `export FEED_TOKEN=$(openssl rand -hex 16)`                              |
| `MBF_FEED_DB_PATH must stay within the service root`          | Path escapes the sandbox                   | Use `./feed.sqlite`                                                      |
| R2 `403` / `AccessDenied`                                     | Token lacks write, or wrong bucket scope   | Recreate as Object Read & Write on the correct bucket                    |
| `gitleaks not found` on commit                                | Scanner absent                             | Install it; never bypass the hook                                        |
| `warning: could not set the Artifact Registry cleanup policy` | Missing `roles/artifactregistry.repoAdmin` | Not fatal — deploy succeeded; re-run the Phase 7 grant command           |

Two consecutive failures of the same command: stop, surface the exact stderr, and hand back. Do not
improvise around the pipeline's own validation — every message above names its own fix.

## Exit gate

Every phase's own verification must have passed in this run — not been assumed from a prior one,
and not inferred from a command exiting 0. Phase 6's `curl` is the only one that proves the whole
chain; a green Phase 2 with an empty response body is not setup complete.

Then hand over `make help`, `docs/getting-started.md` for the manual equivalents, and
`DATA_LICENSES.md` before they widen past the first source.
