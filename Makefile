.PHONY: help install check format format-check lint typecheck test build refresh ingest record-extraction secret-scan clean serve assemble-feed deploy-only deploy

.DEFAULT_GOAL := help

# Only the targets carrying a `##` comment show up here — the rest are plumbing these call.
help:
	@grep -hE '^[a-z][a-z-]*:.*##' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  %-17s %s\n", $$1, $$2}'

# No fallback path: a stray global install would silently run a Bun other than the .tool-versions pin.
BUN := $(or $(shell command -v bun 2>/dev/null),$(error bun not on PATH — run `mise install`))
BUNX := $(BUN) x

# Cloud Run feed service.
SERVICE_NAME ?= metal-birds-feed
REGION ?= us-east1
# Secret Manager secret holding FEED_TOKEN, bound into the service on every deploy (idempotent).
FEED_SECRET ?= feed-token
# Dedicated runtime service account (not the default compute SA) — least privilege: it only reads
# the FEED_TOKEN secret. Resolved to <name>@<project>.iam.gserviceaccount.com at deploy time.
RUN_SA ?= metal-birds-feed-run
# Dedicated repo, created once with its cleanup policy (docs/getting-started.md). Without --image,
# `--source` builds into the region's default `cloud-run-source-deploy`, shared by every service in
# the project, where a cleanup policy cannot be scoped to this service alone.
RUN_ARTIFACT_REPO ?= metal-birds-feed

# Sourcing .env overwrites command-line vars: re-applied after it, quote-escaped.
ENV_FILE ?= .env
CLI_VARS := $(foreach v,$(.VARIABLES),$(if $(filter command line,$(origin $v)),$v))
LOAD_ENV = set -a; if [ -f "$(abspath $(ENV_FILE))" ]; then . "$(abspath $(ENV_FILE))"; fi; \
	$(foreach v,$(CLI_VARS),$v='$(subst ','\'',$($v))';) set +a

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

# NODE_ENV is forced, not left to bun's default: bun only defaults it to `test` when it is unset,
# so a shell or .env that exports NODE_ENV would send fixture logs into logs/pipeline.log.
test:
	NODE_ENV=test $(BUN) test --isolate --coverage

# tsconfig.json is noEmit; emit lives in tsconfig.build.json — bare tsc produces no dist/.
build:
	$(BUNX) tsc -p tsconfig.build.json

check: format-check lint typecheck test ## Everything CI gates on, in one command

refresh: build ## Update R2: download, map, and write every source (REFRESH_SOURCE=<id> for one)
	@$(LOAD_ENV); $(BUN) run dist/pipeline.js

# A dry run stops after the mapping check: a chained refresh would read the previous stored drop.
ingest: build ## Store a browser-downloaded register file (SOURCE=<id> FILE=drops/<file>) and refresh it
	@$(LOAD_ENV); \
		if [ -z "$${SOURCE:-}" ] || [ -z "$${FILE:-}" ]; then echo "usage: make ingest SOURCE=<id> FILE=drops/<file>"; exit 1; fi; \
		INGEST_SOURCE="$$SOURCE" INGEST_FILE="$$FILE" $(BUN) run dist/ingest.js || exit $$?; \
		if [ "$${DRY_RUN:-false}" = true ]; then echo "DRY_RUN=true: the file maps cleanly; nothing was stored."; exit 0; fi; \
		REFRESH_SOURCE="$$SOURCE" FORCE_REFRESH=true $(BUN) run dist/pipeline.js

# Billed: one Gemini call per marked chunk. Review `git diff fixtures/` against the PDFs.
record-extraction: build ## Re-record Gemini's response for a PDF source's fixtures (SOURCE=<id>)
	@$(LOAD_ENV); $(BUN) run dist/record-extraction.js "$${SOURCE:-}"

secret-scan: ## Scan staged changes for accidentally committed secrets
	@if command -v gitleaks > /dev/null; then \
		gitleaks git --staged --redact; \
	else \
		echo "❌ gitleaks not found. Install: https://github.com/gitleaks/gitleaks#installing"; \
		exit 1; \
	fi

clean: ## Remove build output and local artifacts
	rm -rf dist coverage node_modules feed.sqlite

serve: ## Run the feed service locally against feed.sqlite (MBF_FEED_DB_PATH)
	$(BUN) run src/service/server.ts

# Rebuilt from R2 every time: a prior local feed.sqlite is never trusted.
assemble-feed: build ## Build feed.sqlite from the R2 slices (does not refresh)
	@set -eu; $(LOAD_ENV); \
		rm -f feed.sqlite; \
		MBF_FEED_DB_OUT=feed.sqlite $(BUN) run dist/publish-feed.js; \
		test -s feed.sqlite

# Deploys the feed.sqlite on disk; CI calls it after its own assemble + change check.
deploy-only:
	@set -eu; $(LOAD_ENV); \
		: $${GCP_PROJECT_ID:?GCP_PROJECT_ID is required}; \
		test -s feed.sqlite; \
		gcloud run deploy $(SERVICE_NAME) --project "$$GCP_PROJECT_ID" --source . --image "$(REGION)-docker.pkg.dev/$$GCP_PROJECT_ID/$(RUN_ARTIFACT_REPO)/$(SERVICE_NAME)" --region $(REGION) --allow-unauthenticated --min-instances=0 --max-instances=1 --service-account "$(RUN_SA)@$$GCP_PROJECT_ID.iam.gserviceaccount.com" --set-secrets FEED_TOKEN=$(FEED_SECRET):latest --quiet

# Sequenced in the recipe, not as prerequisites, so `make -j` cannot deploy before assembly ends.
deploy: ## Deploy R2's current data to Cloud Run (does not refresh)
	$(MAKE) assemble-feed
	$(MAKE) deploy-only
