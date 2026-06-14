.PHONY: install dev format format-files format-check lint typecheck test build bootstrap e2e perf secret-scan commitlint clean

BUN := $(or $(shell command -v bun 2>/dev/null), $(HOME)/.bun/bin/bun)
BUNX := $(BUN) x

install:
	$(BUN) install && $(BUNX) lefthook install

dev:
	@echo "This is a data pipeline — run 'bun run src/pipeline.ts' to execute locally, or trigger via GitHub Actions."

format:
	$(BUNX) prettier --write .

# Format only the files passed via FILES= (used by lefthook pre-commit).
# --ignore-unknown skips files prettier can't parse (e.g., Makefile slipping past a glob);
# empty FILES list is a no-op so the hook doesn't error on commits with no matching files.
format-files:
	@if [ -n "$(FILES)" ]; then $(BUNX) prettier --write --ignore-unknown $(FILES); fi

format-check:
	$(BUNX) prettier --check .

lint:
	$(BUNX) eslint .

# tsconfig.eslint.json widens the include to tests + *.config.ts; the default tsconfig.json is
# src-only, so type errors in tests would otherwise never gate CI.
typecheck:
	$(BUNX) tsc --noEmit -p tsconfig.eslint.json

test:
	$(BUNX) vitest run --coverage

build:
	$(BUNX) tsc

ENV_FILE ?= .env

# One-shot initial load. Run locally (no GHA timeout cap) before the first monthly cron.
# Reads R2 credentials from $(ENV_FILE) (default .env). To override the source or dry-run
# flag for a single invocation, edit $(ENV_FILE) — values there always win.
bootstrap: build
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

e2e:
	@echo "No E2E tests — this is a data pipeline, not a web app."

perf:
	@echo "No performance tests — this is a data pipeline, not a web app."

secret-scan:
	@if command -v gitleaks > /dev/null; then \
		gitleaks git --staged --redact; \
	else \
		echo "❌ gitleaks not found. Install: https://github.com/gitleaks/gitleaks#installing"; \
		exit 1; \
	fi

commitlint:
	$(BUNX) commitlint --edit $(COMMIT_MSG_FILE)

clean:
	rm -rf dist coverage node_modules
