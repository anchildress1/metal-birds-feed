.PHONY: install dev format format-check lint typecheck test build e2e perf secret-scan commitlint clean

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
