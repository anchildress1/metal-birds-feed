.PHONY: install dev format format-check lint typecheck test build bootstrap e2e perf secret-scan commitlint clean

BUN := $(or $(shell command -v bun 2>/dev/null), $(HOME)/.bun/bin/bun)
BUNX := $(BUN) x

install:
	$(BUN) install && $(BUNX) lefthook install

dev:
	@echo "This is a data pipeline — run 'bun run src/pipeline.ts' to execute locally, or trigger via GitHub Actions."

format:
	$(BUNX) prettier --write .

format-check:
	$(BUNX) prettier --check .

lint:
	$(BUNX) eslint .

typecheck:
	$(BUNX) tsc --noEmit

test:
	$(BUNX) vitest run --coverage

build:
	$(BUNX) tsc

# One-shot initial load. Run locally (no GHA timeout cap) before the first monthly cron.
# Required env: MBF_R2_ACCOUNT_ID MBF_R2_ACCESS_KEY_ID MBF_R2_SECRET_ACCESS_KEY MBF_R2_BUCKET_NAME
# Optional env: REFRESH_SOURCE (default: faa), DRY_RUN (default: false)
bootstrap: build
	@if [ -z "$$MBF_R2_ACCOUNT_ID" ]; then echo "MBF_R2_ACCOUNT_ID is not set"; exit 1; fi
	@if [ -z "$$MBF_R2_ACCESS_KEY_ID" ]; then echo "MBF_R2_ACCESS_KEY_ID is not set"; exit 1; fi
	@if [ -z "$$MBF_R2_SECRET_ACCESS_KEY" ]; then echo "MBF_R2_SECRET_ACCESS_KEY is not set"; exit 1; fi
	@if [ -z "$$MBF_R2_BUCKET_NAME" ]; then echo "MBF_R2_BUCKET_NAME is not set"; exit 1; fi
	@echo "Bootstrap initial load — source=$${REFRESH_SOURCE:-faa} dry_run=$${DRY_RUN:-false}"
	REFRESH_SOURCE=$${REFRESH_SOURCE:-faa} DRY_RUN=$${DRY_RUN:-false} $(BUN) run dist/pipeline.js

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
