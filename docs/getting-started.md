# Getting Started (Do It Yourself) 🛠️

**Who this is for:** you want to run your own copy of metal-birds-feed, and you'd rather type the
commands yourself than have an AI do it. You do not need to know TypeScript. You do need to be
willing to paste commands into a terminal and click through two or three signup forms.

**Want an AI assistant to walk you through it instead?** See
[Getting Started with an AI Assistant](getting-started-with-ai.md). Same result, different path.
Pick one — you don't need both.

**Developers:** you want [README.md](../README.md) and [AGENTS.md](../AGENTS.md) instead. This page
deliberately explains things you already know.

---

## Read This First ⚖️

This project downloads national aircraft registries and normalizes them into one database.

Two rules are not optional:

- **Your copy is yours to self-host.** The code is source-available under
  [Polyform Shield](../LICENSE). The data output is private to the operator. There is no public
  download, no public API, no dataset you may republish.
- **You are responsible for your own license assessment.** Every registry in `sources/` was cleared
  for _Ashley's_ private use, and some of those clearances are permissions granted to her by name.
  They do not transfer to you. Before you pull any source, read its entry in
  [DATA_LICENSES.md](../DATA_LICENSES.md) and decide whether your use is covered.

If that second bullet sounds like more than you signed up for, stop here. That is a legitimate
place to stop.

---

## What You End Up With

| Thing                | What it is                                                            |
| -------------------- | --------------------------------------------------------------------- |
| Per-source databases | One SQLite file per registry, stored in your own Cloudflare R2 bucket |
| `feed.sqlite`        | All registries merged into one file you can query locally             |
| A local feed service | A small web API that answers tail-number and ICAO hex lookups         |

The last step — putting that service on the public internet via Google Cloud Run — is **optional**.
Everything up to it runs on your laptop.

---

## What It Costs 💸

| Service            | Required?           | Cost                                                                                  |
| ------------------ | ------------------- | ------------------------------------------------------------------------------------- |
| Cloudflare R2      | Yes                 | A fresh bootstrap is expected to fit the standard free tier; check account-wide usage |
| Google AI (Gemini) | Non-English sources | Depends on your Google AI account; the pipeline limits request rate                   |
| Google Cloud Run   | Only if you deploy  | Scale-to-zero; pennies unless you send it real traffic                                |
| GitHub             | Only for automation | Free                                                                                  |

R2 bills object operations and stored bytes, not aircraft rows. This pipeline writes a small,
fixed set of objects per configured source. The free allowance is shared across your Cloudflare
account, so check existing usage before a full pull. Step 7 starts with one registry first.

---

## Step 1 — Install the Tools

You need a terminal. On macOS that's **Terminal** or **iTerm**. On Windows, install
[WSL](https://learn.microsoft.com/windows/wsl/install) first and run everything inside it — the
build commands assume a Unix shell.

### Required

```bash
# Bun — the JavaScript runtime this project runs on
curl -fsSL https://bun.sh/install | bash

# Git — for downloading the code
#   macOS: installs with Xcode Command Line Tools
xcode-select --install
#   Ubuntu / Debian / WSL:
sudo apt-get update && sudo apt-get install -y git make python3
```

Close and reopen your terminal, then confirm both work:

```bash
bun --version    # expect 1.3.14 or newer
git --version
make --version
```

> [!NOTE]
> This project pins Bun **1.3.14** in `.tool-versions`. If you use
> [mise](https://mise.jdx.dev/) or [asdf](https://asdf-vm.com/), run `mise install` in the project
> folder and it picks up the pinned version automatically.

### Only if you plan to commit changes

Every commit runs a secret scanner. Without it, `git commit` fails.

```bash
# macOS
brew install gitleaks
# Ubuntu / Debian / WSL — see https://github.com/gitleaks/gitleaks#installing
```

### Only if you plan to deploy to Cloud Run

```bash
# https://cloud.google.com/sdk/docs/install
gcloud --version
```

---

## Step 2 — Get the Code

```bash
git clone https://github.com/anchildress1/metal-birds-feed.git
cd metal-birds-feed
```

Every command from here runs **inside that folder**. If a command fails with "no rule to make
target", you're in the wrong directory — run `pwd` and check.

---

## Step 3 — Install the Project

```bash
make install
```

This downloads the project's dependencies and installs the git hooks. It takes under a minute and
needs no accounts, no keys, and no internet beyond the package registry.

---

## Step 4 — Prove It Works Before You Sign Up for Anything

```bash
make check
```

This runs the formatter check, the linter, the type checker, and the full test suite — around 1,400
tests in a couple of seconds. **It needs no credentials at all.** Nothing in it touches Cloudflare,
Google, or the internet.

You want to end on `0 fail`. If you do, your machine is set up correctly and every failure after
this point is a configuration problem, not an installation problem. That's a useful thing to know
before you start creating accounts.

---

## Step 5 — Create a Cloudflare R2 Bucket

R2 is where your databases live. It is object storage — think "a folder in the cloud".

1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com/sign-up) (free).
2. In the left sidebar, click **R2**. Add a payment method when prompted — the free tier still
   applies, but R2 requires a card on file.
3. Click **Create bucket**. Name it anything (`metal-birds` works). Keep the default location.
4. Back on the R2 page, note the **Account ID** shown on the right. That's `MBF_R2_ACCOUNT_ID`.
5. Click **Manage R2 API Tokens** → **Create API token**.
   - Permission: **Object Read & Write**
   - Scope it to the one bucket you just made
6. Cloudflare shows you an **Access Key ID** and a **Secret Access Key**.
   **Copy both now** — the secret is shown exactly once.

---

## Step 6 — Create Your `.env` File

`.env` is a plain text file holding your keys. It is already in `.gitignore`, so it can never be
committed by accident.

```bash
cp .env.example .env
```

Open `.env` in any text editor and fill in the four values from Step 5:

```bash
MBF_R2_ACCOUNT_ID=your_account_id_here
MBF_R2_ACCESS_KEY_ID=your_access_key_here
MBF_R2_SECRET_ACCESS_KEY=your_secret_key_here
MBF_R2_BUCKET_NAME=metal-birds
```

Leave everything else alone for now.

> [!WARNING]
> Never paste these values into a chat window, an issue, a screenshot, or a commit. If you think one
> leaked, delete the token in the Cloudflare dashboard and make a new one. That takes 30 seconds and
> fully solves the problem.

### The Gemini key — only for configured non-English registries

Each `sources/<id>.yaml` declares its current `language:`. A source declaring `language: en` skips
Gemini; any other value sends a few descriptive fields through Gemini to render them in English.
Read the selected source's YAML instead of relying on a copied country list.

Skip this if you're only pulling English sources. Otherwise:

1. Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Set the existing `GEMINI_API_KEY=` line in `.env` (it's already there, empty). Don't add a
   second one — the file is read top to bottom and the last assignment wins, so a duplicate below
   yours silently blanks it:

```bash
GEMINI_API_KEY=your_key_here
GEMINI_REQUESTS_PER_MINUTE=10
```

A missing key does not fail quietly — a run that needs it stops immediately and says so.

---

## Step 7 — Pull Your First Registry

**Start with one small source.** The Dutch register is ~3,000 records, publishes in English (no
Gemini key needed), and finishes in well under a minute.

Set the existing `REFRESH_SOURCE=` line in `.env` — it already exists and is empty. Change that
line in place rather than adding a new one; a duplicate further down silently wins and you get the
full configured-source pull instead:

```bash
REFRESH_SOURCE=nl-ilt
```

Then:

```bash
make refresh
```

Watch the progress in a second terminal:

```bash
tail -F logs/pipeline.log
```

You're looking for `event=pipeline_complete`. When it appears, open your Cloudflare R2 bucket in the
browser — there is now an `aircraft/nl-ilt.sqlite` file in it. That's the whole pipeline, working.

### When you're ready for everything

Remove the `REFRESH_SOURCE` line from `.env` (or blank it out) and run `make refresh` again. Now the
warnings apply:

- It pulls every registry still configured in `sources/`, and they run **concurrently** — the wall
  clock is the slowest single
  register, not the sum. For scale, a complete `make refresh` measured on this project's own
  machine took **25 seconds** end to end, publishing 413,000 rows across all 15 sources. Most were
  already current and skipped their download, so budget longer for a genuine first pull, where all
  15 download and the FAA's 312k records dominate.

  You may see "30 minutes" quoted for this elsewhere. That is the `timeout-minutes` this project
  sets on its own CI refresh job — not a GitHub limit (hosted runners allow 6 hours) and not a
  local measurement

- Check account-wide R2 usage first. The pipeline is expected to fit the standard free tier, but
  that allowance is shared with every other R2 workload in the account
- Remaining non-English sources need `GEMINI_API_KEY` set or the run stops
- **Re-read [DATA_LICENSES.md](../DATA_LICENSES.md) first, then delete what you're not covered
  for.** Some of these permissions were granted to Ashley personally and do not extend to you.
  Reading the file is not enough — a refresh with no `REFRESH_SOURCE` pulls **every** config that
  is present, so an uncovered register is downloaded unless you remove it:

  ```bash
  rm sources/<id>.yaml    # <id> is the filename stem, e.g. sources/es-aesa.yaml
  ```

  The pipeline only sees what is on disk, so deleting the file is the whole mechanism. Do this
  before the full pull, not after

Want to see what it would do without writing anything? Set `DRY_RUN=true` in `.env`. It downloads,
parses and compares, but it does **not** translate — so it cannot tell you whether your
`GEMINI_API_KEY` works. Treat it as a shape check, not a rehearsal.

---

## Step 8 — Build and Run the Feed Locally

> [!IMPORTANT]
> **This step needs every registry still configured in `sources/`, not just Step 7's registry.**
> `make assemble-feed` merges the whole feed or none of it — if any source is missing, it stops
> rather than serving a feed with silent holes in it. After a single-source pull it exits with:
>
> ```
> Missing feed rows for: au-casa, br-anac, ch-foca, … Run `make refresh`
> ```
>
> That is the tool working correctly, not a bug. Step 7 proved your pipeline works end to end; this
> step is a separate milestone with account-wide usage to check first.
>
> **To continue:** blank out `REFRESH_SOURCE` in `.env` and run `make refresh` — check account-wide
> R2 usage, set `GEMINI_API_KEY` for remaining non-English sources, and re-read
> [DATA_LICENSES.md](../DATA_LICENSES.md) first. If you're not ready for that, stop at Step 7. You
> have a working pipeline and a real artifact in R2; that is a legitimate place to stop.

Once every source has been pulled, merge them into one database:

```bash
make assemble-feed
```

This reads from R2 and writes `feed.sqlite` in the project folder. Two things stop it: a missing
`MBF_R2_*` value (it names the one), or a missing source slice (it names them, as above).

Now start the API and prove it answers for a key selected from your own database.

> [!IMPORTANT]
> Run this as one block. Its subshell keeps the generated token, server, request, validation, and
> cleanup together. The bounded loop waits up to five seconds for port 8080, and the trap stops the
> exact server PID if any proof step fails.

```bash
(
  set -eu
  FEED_TOKEN=$(openssl rand -hex 16)          # a password for your own API; must be 16+ characters
  test "${#FEED_TOKEN}" -ge 16
  export FEED_TOKEN
  export MBF_FEED_DB_PATH=./feed.sqlite
  bun run src/service/server.ts &             # the command behind make serve
  SERVER_PID=$!                               # exact process to stop later
  trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

  READY=false
  for attempt in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
    if curl -s -o /dev/null http://localhost:8080/feed; then READY=true; break; fi
    sleep 0.25
  done
  test "$READY" = true

  MARK=$(bun -e 'import { Database } from "bun:sqlite";
    console.log(new Database("feed.sqlite", { readonly: true })
      .query("SELECT registration_key FROM feed WHERE registration_key IS NOT NULL LIMIT 1")
      .get().registration_key)')
  echo "Looking up: $MARK"
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

The command exits only after the response contains the normalized mark selected from the database.
An empty `{}` is a failed proof here. For arbitrary marks, aircraft the feed does not know are left
out rather than returned as empty entries.

Two endpoints exist:

| Endpoint             | Send it                                          | Use when                                     |
| -------------------- | ------------------------------------------------ | -------------------------------------------- |
| `/feed`              | `{"hexes": ["<a hex from your data>"]}`          | You have an ICAO hex code from an ADS-B feed |
| `/feed/registration` | `{"registrations": ["<a mark from your data>"]}` | You have a tail number                       |

Both take up to 500 entries per request. The block stops the exact background PID after the proof;
its trap performs the same cleanup if any intermediate command fails.

---

## Step 9 (Optional) — Put It on the Internet

Only do this if you actually need the API reachable from somewhere other than your laptop. It costs
money, however little, and it puts your data on a server.

You'll need a billing-enabled Google Cloud project and an authenticated `gcloud` CLI. The commands
below generate a fresh deployment token and store it immediately in Secret Manager; the temporary
local token from Step 8 is not reused.

Set the existing `GCP_PROJECT_ID=` line in `.env` — like the others, it is already there and empty,
so edit it in place rather than adding a second one:

```bash
GCP_PROJECT_ID=your-project-id
```

Export the same value for the setup commands, then provision the APIs, runtime identity, secret,
and permission that the deploy recipe expects:

```bash
export GCP_PROJECT_ID=your-project-id
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com iam.googleapis.com \
  --project="$GCP_PROJECT_ID"
PROJECT_NUMBER=$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/run.builder"
gcloud iam service-accounts create metal-birds-feed-run \
  --display-name="metal-birds-feed runtime" --project="$GCP_PROJECT_ID"
FEED_TOKEN=$(openssl rand -hex 16) && \
  test "${#FEED_TOKEN}" -ge 16 && \
  printf '%s' "$FEED_TOKEN" | gcloud secrets create feed-token \
  --data-file=- --project="$GCP_PROJECT_ID"
gcloud secrets add-iam-policy-binding feed-token \
  --member="serviceAccount:metal-birds-feed-run@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" --project="$GCP_PROJECT_ID"
make deploy
```

These are first-deploy commands. If the service account or secret already exists, stop rather than
overwriting it; use the existing deployment's operator procedure instead.

When a client needs the deployed token in a later shell, retrieve it from the vault without printing
it:

```bash
export FEED_TOKEN=$(gcloud secrets versions access latest \
  --secret=feed-token --project="$GCP_PROJECT_ID")
```

This rebuilds `feed.sqlite` from R2 (so a stale local file is never shipped) and deploys it to Cloud
Run. It does **not** re-download the registries — run `make refresh` first if you want fresh data in
the deploy.

Full GitHub Actions automation — daily refreshes, automatic deploys — is documented in
[README.md](../README.md#required-github-actions-configuration). That's genuinely developer
territory.

---

## When Something Breaks 🔧

| What you see                                            | What it means                                           | Fix                                                                                                                                                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `command not found: bun`                                | Terminal hasn't picked up the new install               | Close and reopen your terminal                                                                                                                                                                          |
| `command not found: make`                               | Build tools missing                                     | macOS: `xcode-select --install` · Linux: `apt-get install make`                                                                                                                                         |
| `.env not found`                                        | Step 6 didn't happen                                    | `cp .env.example .env` and fill it in                                                                                                                                                                   |
| `MBF_R2_ACCOUNT_ID missing from .env` (Step 7)          | That one line is blank                                  | Fill it in — the message names the exact key                                                                                                                                                            |
| `MBF_R2_ACCOUNT_ID is required` (Step 8)                | Same thing — Step 8 words it differently                | Fill it in — the message names the exact key                                                                                                                                                            |
| `Missing required environment variable: GEMINI_API_KEY` | A non-English source needs translation                  | Add the key, or set `REFRESH_SOURCE` to an English source                                                                                                                                               |
| `FEED_TOKEN must be set (at least 16 characters)`       | Token missing or too short                              | `export FEED_TOKEN=$(openssl rand -hex 16)`                                                                                                                                                             |
| `gitleaks not found` when committing                    | Secret scanner isn't installed                          | `brew install gitleaks` — do not skip the hook                                                                                                                                                          |
| Refresh looks stuck                                     | You're pulling every configured registry at once        | Tail `logs/pipeline.log` — each source logs `elapsed_ms` as it finishes, and `feed_published` marks the end. A steady-state run is ~25s; a cold first pull is longer but not minutes-times-source-count |
| An R2 `403` or `AccessDenied`                           | Token lacks write access or is scoped to another bucket | Recreate it with **Object Read & Write** on the right bucket                                                                                                                                            |

Still stuck? Open an issue with the command you ran and the last 20 lines of `logs/pipeline.log`.
**Redact your keys first** — the log does not print them, but paste carefully anyway.

---

## Where to Go Next

| I want to…                         | Go to                                                    |
| ---------------------------------- | -------------------------------------------------------- |
| Let an AI do this instead          | [getting-started-with-ai.md](getting-started-with-ai.md) |
| Understand how the pipeline works  | [README.md](../README.md#how-it-works)                   |
| Check whether I may use a registry | [DATA_LICENSES.md](../DATA_LICENSES.md)                  |
| Add a registry of my own           | [README.md](../README.md#adding-a-new-registry-source)   |
| See every available command        | `make help`                                              |
