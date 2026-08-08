.PHONY: help install check format format-check lint typecheck test build refresh secret-scan clean serve assemble-feed build-feed deploy-only deploy

.DEFAULT_GOAL := help

# Only the targets carrying a `##` comment show up here — the rest are plumbing these call.
help:
	@grep -hE '^[a-z][a-z-]*:.*##' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  %-14s %s\n", $$1, $$2}'

BUN := $(or $(shell command -v bun 2>/dev/null), $(HOME)/.bun/bin/bun)
BUNX := $(BUN) x

# Cloud Run feed service.
SERVICE_NAME ?= metal-birds-feed
REGION ?= us-east1
# Secret Manager secret holding FEED_TOKEN, bound into the service on every deploy (idempotent).
FEED_SECRET ?= feed-token
# Dedicated runtime service account (not the default compute SA) — least privilege: it only reads
# the FEED_TOKEN secret. Resolved to <name>@<project>.iam.gserviceaccount.com at deploy time.
RUN_SA ?= metal-birds-feed-run

install: ## Install dependencies and git hooks
	$(BUN) install --frozen-lockfile && $(BUNX) lefthook install


format:
	$(BUNX) prettier --write .


format-check:
	$(BUNX) prettier --check .

lint:
	$(BUNX) eslint .

# tsconfig.eslint.json widens the include to tests + *.config.ts; the default tsconfig.json is
# src-only, so type errors in tests would otherwise never gate CI.
typecheck:
	$(BUNX) tsc --noEmit -p tsconfig.eslint.json

test:
	$(BUN) test --isolate --coverage

# tsconfig.json is noEmit; emit lives in tsconfig.build.json — bare tsc produces no dist/.
build:
	$(BUNX) tsc -p tsconfig.build.json

check: format-check lint typecheck test ## Everything CI gates on, in one command

ENV_FILE ?= .env

# Reads R2 credentials from $(ENV_FILE) (default .env). Set REFRESH_SOURCE there to do one source.
refresh: build ## Pull every source: download, translate, write artifacts + feed slices
	@if [ ! -f $(ENV_FILE) ]; then \
		echo "$(ENV_FILE) not found. Create it with MBF_R2_* and optional REFRESH_SOURCE/DRY_RUN."; \
		exit 1; \
	fi
	@case "$(ENV_FILE)" in /*) src="$(ENV_FILE)" ;; *) src="./$(ENV_FILE)" ;; esac; \
		set -a; . "$$src"; set +a; \
		: $${MBF_R2_ACCOUNT_ID:?MBF_R2_ACCOUNT_ID missing from $(ENV_FILE)}; \
		: $${MBF_R2_ACCESS_KEY_ID:?MBF_R2_ACCESS_KEY_ID missing from $(ENV_FILE)}; \
		: $${MBF_R2_SECRET_ACCESS_KEY:?MBF_R2_SECRET_ACCESS_KEY missing from $(ENV_FILE)}; \
		: $${MBF_R2_BUCKET_NAME:?MBF_R2_BUCKET_NAME missing from $(ENV_FILE)}; \
		DRY_RUN=$${DRY_RUN:-false}; \
		echo "Bootstrap initial load — source=$${REFRESH_SOURCE:-<all>} dry_run=$$DRY_RUN"; \
		export REFRESH_SOURCE DRY_RUN; \
		$(BUN) run dist/pipeline.js



secret-scan:
	@if command -v gitleaks > /dev/null; then \
		gitleaks git --staged --redact; \
	else \
		echo "❌ gitleaks not found. Install: https://github.com/gitleaks/gitleaks#installing"; \
		exit 1; \
	fi


clean: ## Remove build output and local artifacts
	rm -rf dist coverage node_modules feed.sqlite

# Run the feed service locally against a built feed.sqlite (set MBF_FEED_DB_PATH).
serve: ## Run the feed service locally against feed.sqlite
	$(BUN) run src/service/server.ts

# Build a fresh consolidated database from every durable R2 feed slice. Loads .env when present;
# CI supplies the same credentials directly. Phony by design — a prior local file is never trusted.
assemble-feed: build
	@set -eu; \
		if [ -f "$(ENV_FILE)" ]; then \
			case "$(ENV_FILE)" in /*) feed_env_source="$(ENV_FILE)" ;; *) feed_env_source="./$(ENV_FILE)" ;; esac; \
			set -a; . "$$feed_env_source"; set +a; \
		fi; \
		: $${MBF_R2_ACCOUNT_ID:?MBF_R2_ACCOUNT_ID is required}; \
		: $${MBF_R2_ACCESS_KEY_ID:?MBF_R2_ACCESS_KEY_ID is required}; \
		: $${MBF_R2_SECRET_ACCESS_KEY:?MBF_R2_SECRET_ACCESS_KEY is required}; \
		: $${MBF_R2_BUCKET_NAME:?MBF_R2_BUCKET_NAME is required}; \
		rm -f feed.sqlite; \
		MBF_FEED_DB_OUT=feed.sqlite $(BUN) run dist/publish-feed.js; \
		test -s feed.sqlite

build-feed: refresh assemble-feed ## Refresh every source, then assemble feed.sqlite

# Deploy whatever feed.sqlite is on disk. Separate from build-feed so CI (which already built and
# change-checked the DB) can deploy without a second build; `make deploy` chains both for operators.
# FEED_TOKEN is bound from the Secret Manager secret ($(FEED_SECRET)) on every deploy — idempotent,
# so the first deploy works too. Application auth owns the Authorization header.
deploy-only:
	@set -eu; \
		if [ -f "$(ENV_FILE)" ]; then \
			case "$(ENV_FILE)" in /*) deploy_env_source="$(ENV_FILE)" ;; *) deploy_env_source="./$(ENV_FILE)" ;; esac; \
			set -a; . "$$deploy_env_source"; set +a; \
		fi; \
		: $${GCP_PROJECT_ID:?GCP_PROJECT_ID is required}; \
		test -s feed.sqlite; \
		gcloud run deploy $(SERVICE_NAME) --project "$$GCP_PROJECT_ID" --source . --region $(REGION) --allow-unauthenticated --min-instances=0 --max-instances=1 --service-account "$(RUN_SA)@$$GCP_PROJECT_ID.iam.gserviceaccount.com" --set-secrets FEED_TOKEN=$(FEED_SECRET):latest --quiet

# Build immediately before deploying so Cloud Run can never receive an ambient stale database.
# assemble-feed, not build-feed: deploying rebuilds the DB from the slices already in R2 so an
# ambient stale feed.sqlite is never shipped, but it does not re-pull every register — run
# `make refresh` first if you want new upstream data in the deploy.
deploy: assemble-feed deploy-only ## Assemble the feed from R2 and ship it to Cloud Run
