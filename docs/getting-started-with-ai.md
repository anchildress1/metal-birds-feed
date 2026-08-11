# Getting Started with an AI Assistant 🤖

**Who this is for:** you want your own copy of metal-birds-feed running, and you'd rather have an AI
coding assistant drive the terminal than type the commands yourself. You do not need to know
TypeScript, and you do not need to understand what the commands do.

**Doing it by hand instead?** See [Getting Started (Do It Yourself)](getting-started.md). Same
result. Pick one path — running both just duplicates work.

This project ships a **setup skill**: a script of instructions the assistant reads and follows. It
turns "set this up for me" into a checked, ordered process instead of the assistant improvising.

---

## Read This First ⚖️

The same two rules from the manual guide apply, and an assistant does not change them:

- **Your copy is self-hosted.** Source-available code under [Polyform Shield](../LICENSE), private
  data output. No public API, no republishing the data.
- **You own the license assessment.** The registry clearances in
  [DATA_LICENSES.md](../DATA_LICENSES.md) were granted for Ashley's private use — several by name.
  They do not transfer to you. The assistant will point you at that file and refuse to decide for
  you, because it isn't the assistant's call to make.

---

## What the Assistant Will and Won't Do

| It will                                                     | It will not                                         |
| ----------------------------------------------------------- | --------------------------------------------------- |
| Check what's installed and install what's missing           | Create your Cloudflare, Google, or GitHub accounts  |
| Run every `make` command and read the output                | Type your password or click through a signup form   |
| Create your `.env` and tell you exactly which lines to fill | Invent, guess, or generate credentials              |
| Diagnose failures and retry                                 | Print your secret values back to the screen         |
| Configure MCP servers (see below)                           | Spend your money without asking first               |
| Stop and wait when it needs something only you can do       | Decide whether a registry's license covers your use |

**The parts that need a human are the parts that need a human.** The assistant pauses, tells you
exactly what to click, and waits. It does not pretend to have done them.

---

## Step 1 — Install an Assistant

Pick one. Both work; the skill is written for either. Neither of these installers needs Node.js —
they drop a self-contained binary.

### Claude Code

```bash
# macOS, Linux, WSL
curl -fsSL https://claude.ai/install.sh | bash

# or with Homebrew
brew install --cask claude-code
```

Verify with `claude --version`. Windows instructions and everything else:
[code.claude.com/docs/en/setup](https://code.claude.com/docs/en/setup)

Requires a Claude **Pro, Max, Team, Enterprise, or Console** account. The free Claude.ai plan does
not include Claude Code.

### Codex CLI

```bash
# macOS, Linux
curl -fsSL https://chatgpt.com/codex/install.sh | sh

# or with Homebrew
brew install codex
```

Verify with `codex --version`. Full instructions:
[learn.chatgpt.com/docs/codex/cli](https://learn.chatgpt.com/docs/codex/cli)

Codex is available with ChatGPT plans, including Free and Go; usage limits vary by plan. An OpenAI
API key is another option and is billed separately.

---

## Step 2 — Get the Code

Do this yourself first. The skill lives inside the repository, so the assistant can't read it until
the repository exists on your machine — which means you need Git before the assistant can help with
anything.

```bash
# Git — macOS installs it with the Xcode Command Line Tools
xcode-select --install
# Ubuntu / Debian / WSL
sudo apt-get update && sudo apt-get install -y git

git clone https://github.com/anchildress1/metal-birds-feed.git
cd metal-birds-feed
```

The assistant checks for everything else — Bun, make, python3 — and installs what's missing.

---

## Step 3 — Point Your Assistant at the Skill

The skill lives at `.agents/skills/setup-metal-birds-feed/SKILL.md` — a vendor-neutral location,
so neither assistant is privileged over the other. There is exactly one copy of it.

### Claude Code — nothing to do

The repo ships a symlink at `.claude/skills/setup-metal-birds-feed` pointing at that file, and
Claude Code follows symlinks when it scans `.claude/skills/`. So it finds the skill on its own:

```bash
claude
```

Then just say **"Set up this project locally."**

### Codex — nothing to do

Codex scans repository-local `.agents/skills` from the current directory up to the repository root.
Start it from the repository you just cloned:

```bash
codex
```

Then just say **"Set up this project locally."** Codex discovers the checked-in skill automatically.

> [!NOTE]
> **Windows without WSL:** git only recreates the shipped symlink if symlinks are enabled
> (`git config --global core.symlinks true`, plus Developer Mode or an elevated shell). Without
> that, `.claude/skills/setup-metal-birds-feed` clones as a text file containing a path, and Claude
> Code will not find the skill automatically. Tell Claude Code to read
> `.agents/skills/setup-metal-birds-feed/SKILL.md` directly, or work inside WSL where symlinks behave
> normally. Codex uses the real `.agents` copy and is unaffected.

---

## Step 4 — Configure MCP Servers (Optional but Useful)

**MCP** lets an assistant talk to outside services directly — reading Cloudflare docs, checking your
R2 bucket — instead of guessing from memory.

You can skip this entirely. Setup works without it. It mostly buys you better error diagnosis.

The assistant can run these for you if you ask. The commands are here so you know what it's doing.

### Cloudflare — inspect your R2 bucket

Lets the assistant confirm your bucket exists and see what got uploaded, instead of asking you to
check the dashboard.

```bash
# Claude Code
claude mcp add --transport http --scope user cloudflare-bindings https://bindings.mcp.cloudflare.com/mcp

# Codex
codex mcp add cloudflare-bindings --url https://bindings.mcp.cloudflare.com/mcp
```

Opens a browser to log in to Cloudflare. It uses your normal login — **your R2 API keys are never
handed to it**.

### Cloudflare Docs — no login required

```bash
# Claude Code
claude mcp add --transport http --scope user cloudflare-docs https://docs.mcp.cloudflare.com/mcp

# Codex
codex mcp add cloudflare-docs --url https://docs.mcp.cloudflare.com/mcp
```

### Context7 — current library documentation

Keeps the assistant from relying on stale training data about Bun, Zod, or the AWS SDK.

```bash
# Claude Code
claude mcp add --transport http --scope user context7 https://mcp.context7.com/mcp

# Codex
codex mcp add context7 --url https://mcp.context7.com/mcp
```

Works with no API key. A free key from [context7.com/dashboard](https://context7.com/dashboard)
raises the rate limit.

### Check they connected

```bash
claude mcp list      # Claude Code
codex mcp list       # Codex
```

---

## Step 5 — Ask It to Set Things Up

Start the assistant in the project folder and say:

> Set up this project locally.

That's enough to trigger the skill. It then works through, in order:

1. **Checks your machine** — Bun, git, make, python3, and what's missing
2. **Installs the project** — `make install`
3. **Verifies before you spend anything** — `make check`, ~1,400 tests, no credentials needed
4. **Stops and waits** while you create your Cloudflare R2 bucket and API token
5. **Creates `.env`** and tells you which four lines to paste into
6. **Pulls one small registry first** — Dutch, ~3,000 records, no translation key, near-zero cost
7. **Stops and tells you** that the local feed API needs every registry still configured in
   `sources/`, not just that one, and lets you decide whether the full pull is worth it

Useful things to say along the way:

| Say this                                 | To get                                                            |
| ---------------------------------------- | ----------------------------------------------------------------- |
| "Just get to the point where tests pass" | Stop after step 3 — no accounts, no money                         |
| "Set up MCP first"                       | Step 4 before anything else                                       |
| "Use a different first source"           | It inspects that source's `language:` and asks for any needed key |
| "I want to pull every configured source" | The full load — it will warn you about time and usage             |
| "Explain what that command just did"     | A plain-language explanation, any time                            |
| "Stop"                                   | It stops. Nothing is half-applied                                 |

---

## What "Waiting on You" Looks Like

At the account steps, the assistant stops and says something like:

> I need R2 credentials before I can continue. In the Cloudflare dashboard: **R2** → **Manage R2 API
> Tokens** → **Create API token** → **Object Read & Write**, scoped to your bucket. Paste the four
> values into `.env` — not into this chat — and tell me when it's done.

Two things to hold onto:

- **Put secrets in `.env`, never in the chat.** `.env` is gitignored and cannot be committed by
  accident. A chat log is a different story.
- **"Tell me when it's done" means it stopped.** It is not working in the background. Nothing happens
  until you reply.

---

## Safety Rails 🚧

The skill hard-codes these. They are not suggestions the assistant may talk itself out of:

- It never writes a credential it wasn't given, and never generates a placeholder that looks real
- It never echoes the contents of `.env` to the screen
- It never commits `.env`, and never disables the secret scanner
- It confirms with you before the full configured-source pull and reports that the operator's first
  data load incurred approximately $6.50 USD in R2 charges — an observed bill, not a guaranteed
  quote or a claim about which billing dimension caused it
- It confirms with you before any Cloud Run deploy, because that puts data on a server
- It sends you to `DATA_LICENSES.md` rather than deciding a licensing question itself

If your assistant does something off-script, stop it and fall back to
[the manual guide](getting-started.md). Every step there is the same step, typed by you.

---

## When It Gets Stuck

Assistants stall. Usually it's one of these:

| Symptom                                        | What to try                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| It loops on a failing command                  | "Stop. Show me the exact error and don't fix it yet."                    |
| It never mentions the skill                    | "Read `.agents/skills/setup-metal-birds-feed/SKILL.md` and follow it."   |
| It asks for secrets in chat                    | Refuse. Put them in `.env` and say you did. That is the correct behavior |
| It claims something worked but nothing changed | "Run the verification step again and show me the actual output."         |
| MCP tools aren't available                     | `claude mcp list` / `codex mcp list`, then restart the assistant         |

Falling back to [getting-started.md](getting-started.md) is always a valid move, at any step. The
commands are identical — the only difference is who types them.

---

## Where to Go Next

| I want to…                            | Go to                                    |
| ------------------------------------- | ---------------------------------------- |
| Do this without an assistant          | [getting-started.md](getting-started.md) |
| Understand how the pipeline works     | [README.md](../README.md#how-it-works)   |
| Check whether I may use a registry    | [DATA_LICENSES.md](../DATA_LICENSES.md)  |
| Know the rules assistants follow here | [AGENTS.md](../AGENTS.md)                |
| See every available command           | `make help`                              |
