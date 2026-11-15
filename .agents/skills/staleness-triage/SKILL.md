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

- Staleness counts from `last_content_change`, never `last_run`: a run finding identical upstream records advances `last_run` only, so the issue stays open.
- An open issue escalates a non-paused source to a daily refresh: its `last_run` should be from today's cron tick.

## 1. Read stored state

```bash
make state SOURCE=<id>   # or bare `make state` when .env sets REFRESH_SOURCE
```

| Field                 | Meaning                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| `last_run`            | last completed run that wrote state                                      |
| `last_content_change` | last run whose pre-localization records differed (`upstream_hash`)       |
| `paused`              | outside the scheduled matrix; refreshed only by hand                     |
| `threshold_days`      | `cadence_days × 1.5`, unrounded: overdue once `days_since_change` passes |
| `days_since_change`   | whole days, floored; can read below `threshold_days` while overdue       |
| `overdue`             | what the next CI evaluation decides: trust it over the two figures       |

- `state_parse_failed` logged before the report → the nulls mean corrupt state, not none; the next successful refresh rewrites it.
- Ignore the issue title's day count: written once at open, never updated.
- `overdue=false` with the issue open → the next CI run closes it. Say so; change nothing.

## 2. Classify

| Evidence                                                      | Cause                            | Go to |
| ------------------------------------------------------------- | -------------------------------- | ----- |
| `paused=false`, `last_run` before today's scheduled refresh   | refresh failing                  | 3a    |
| `paused=true`, `last_run` old                                 | blocked upstream; manual refresh | 3b    |
| `last_run` current, `last_content_change` unmoved by that run | upstream published nothing new   | 4     |

- Never key on `artifact_unchanged`: it follows `content_hash`, so a translation-only rewrite skips it while `last_content_change` stays put.

### 3a. Failing refresh

- `gh run list --workflow refresh.yml --limit 5`, then the failed job's log for `<id>`.
- Fix the fetch or mapping on a `fix/*` branch. Never relax a guard to pass.

### 3b. Paused source

- The user runs it from a network that reaches the upstream (VPN for lt-tka): `REFRESH_SOURCE=<id>` in `.env`, then `make refresh`, then `make state`.
- `last_content_change` unmoved → step 4.

## 4. Verify upstream before blaming cadence

- **URL:** find the agency's catalog entry; `curl -sIL` its download link and compare the final location to the YAML's `download.url`. Change the URL only on that evidence.
- **Publication dates:** list them from the data itself: distinct `latest_snapshot_by` values, the file's `Last-Modified`, or the register's own update stamp.
- **Declared cadence:** the catalog's update-frequency field or the agency's page.

## 5. Decide

Target `cadence_days` = the more frequent of declared vs observed (AGENTS.md § Refresh and staleness).

| Finding                                                                         | Action                                                                    |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `cadence_days` already equals the target                                        | Real staleness: upstream behind its own rhythm. Leave open; comment (6).  |
| `cadence_days` shorter than the target (lt-tka: 7 vs observed 41, declared 122) | `fix/*` PR raising `cadence_days` to the target.                          |
| URL drifted                                                                     | `fix/*` PR updating `download.url` with the catalog evidence in the body. |

- Never raise `cadence_days` past the target to silence an issue: the declared or observed rhythm is the floor on polling.
- Cadence PR: add/update the source's `DATA_LICENSES.md` `## Update cadence` line.
  - Declared rhythm + observed gaps between **named** publications (`gaps between the 2025-04-29 and 2026-03-09 publications ran 41, 41, 92, and 139 days`).
  - Never "silent since", "N days stale", or any figure that ages; that belongs in the issue comment.
  - YAML comment beside `cadence_days`: one WHY line pointing to `DATA_LICENSES.md`.

## 6. Comment on the issue

- `gh issue comment <n> --body-file <file>`, bullets:
  - why it is open (`last_content_change` vs `threshold_days`), from `make state`
  - what the latest refresh showed (`last_content_change` unmoved, or the failure)
  - URL verified against the catalog (link)
  - declared vs observed cadence; the PR number if one was opened
  - the condition that closes it

## Never

- Close a staleness issue by hand: it closes on level at the next CI evaluation. A local run has no GitHub token to close it.
- `FORCE_REFRESH` hoping for a change: the content hash is the answer.
- Email the agency over silence alone (AGENTS.md: only on a materially new fact).
