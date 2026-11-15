---
name: staleness-triage
description: >
  Diagnose an open `[staleness] <source> has not updated in N days` issue in metal-birds-feed and
  land the right outcome: an upstream that is genuinely silent, a cadence_days that is too short, a
  broken or blocked fetch, or a wrong download URL. Trigger on "staleness issue", "[staleness]",
  "why does <source> still say N days", "<source> isn't updating", "I refreshed but the issue is
  still open", or a link to a data-staleness issue. Do NOT trigger for onboarding a new source,
  a failing mapping (map_error), or a deploy.
---

Staleness counts days since `last_content_change` (what was stored last changed), never since `last_run`. A run that finds identical data advances `last_run` only, so the issue stays open.

## 1. Read stored state

```bash
make state SOURCE=<id>   # or bare `make state` when .env sets REFRESH_SOURCE
```

| Field                 | Meaning                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `last_run`            | last completed run that wrote state                                |
| `last_content_change` | last run whose pre-localization records differed (`upstream_hash`) |
| `threshold_days`      | `round(cadence_days × 1.5)`: issue opens past this                 |
| `overdue`             | what the next CI evaluation will decide                            |

- Ignore the issue title's day count: written once at open, never updated.
- `overdue=false` with the issue open → the next CI run closes it. Say so; change nothing.

## 2. Classify

| Evidence                                                  | Cause                            | Go to |
| --------------------------------------------------------- | -------------------------------- | ----- |
| `last_run` older than `cadence_days`, source not `paused` | refresh not running/failing      | 3a    |
| `paused: true` in the YAML, `last_run` old                | blocked upstream; manual refresh | 3b    |
| `last_run` recent, run logged `artifact_unchanged`        | upstream published nothing new   | 4     |

### 3a. Failing refresh

- `gh run list --workflow refresh.yml --limit 5`, then the failed job's log for `<id>`.
- Fix the fetch or mapping on a `fix/*` branch. Never relax a guard to pass.

### 3b. Paused source

- The user runs it from a network that reaches the upstream (VPN for lt-tka): `REFRESH_SOURCE=<id>` in `.env`, then `make refresh`.
- Re-read `make state`; continue at 4 if `artifact_unchanged`.

## 4. Verify upstream before blaming cadence

- **URL:** find the agency's catalog entry; its download link must resolve (`curl -sI`, follow the 302) to the YAML's `download.url`. Change the URL only on that evidence.
- **Publication dates:** list them from the data itself: distinct `latest_snapshot_by` values, the file's `Last-Modified`, or the register's own update stamp.
- **Declared cadence:** the catalog's update-frequency field or the agency's page.

## 5. Decide

| Finding                                                                                                                 | Action                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Upstream behind its own declared cadence                                                                                | Leave the issue open: real staleness. Comment (step 6).                                                     |
| `cadence_days` shorter than the observed gaps (issue reopens on ordinary gaps; prior closed issues for the same source) | `fix/*` PR: `cadence_days` = the more frequent of declared vs observed (AGENTS.md § Refresh and staleness). |
| URL drifted                                                                                                             | `fix/*` PR updating `download.url` with the catalog evidence in the body.                                   |

A cadence PR also adds/updates the source's `DATA_LICENSES.md` `## Update cadence` line:

- Declared rhythm + observed gaps between **named** publications (`gaps between the 2025-04-29 and 2026-03-09 publications ran 41, 41, 92, and 139 days`).
- Never "silent since", "N days stale", or any figure that ages; that belongs in the issue comment.
- YAML comment beside `cadence_days`: one WHY line pointing to `DATA_LICENSES.md`.

## 6. Comment on the issue

Post with `gh issue comment <n> --body-file <file>`. Bullets:

- why it is open (`last_content_change` vs threshold), from `make state`
- what the latest refresh logged (`artifact_unchanged` or the failure)
- URL verified against the catalog (link)
- declared vs observed cadence; the PR number if one was opened
- the condition that closes it

## Never

- Close a staleness issue by hand: it closes on level at the next CI evaluation. A local run has no GitHub token to close it.
- `FORCE_REFRESH` hoping for a change: the content hash is the answer.
- Email the agency over silence alone (AGENTS.md: only on a materially new fact).
