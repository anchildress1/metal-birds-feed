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
	@_run_scan() { \
		SCANNER="$$1"; \
		$$SCANNER scan --exclude-files 'node_modules|dist|coverage|.secrets.baseline.tmp' > .secrets.baseline.tmp 2>&1 || true; \
		if [ ! -f .secrets.baseline.tmp ]; then \
			echo "⚠️ detect-secrets scan did not produce output. Skipping."; \
			return 0; \
		fi; \
		if [ -f .secrets.baseline ]; then \
			echo "Checking against baseline..."; \
			NEW_SECRETS=$$($$SCANNER scan --baseline .secrets.baseline --exclude-files 'node_modules|dist|coverage' | jq '.results | length' 2>/dev/null || echo 0); \
			if [ "$${NEW_SECRETS:-0}" -gt 0 ]; then \
				echo "❌ New secrets found! Run 'detect-secrets audit .secrets.baseline' to review."; \
				$$SCANNER scan --baseline .secrets.baseline --exclude-files 'node_modules|dist|coverage' | jq '.results'; \
				rm -f .secrets.baseline.tmp; \
				return 1; \
			else \
				echo "✅ No new secrets found. Updating baseline timestamp."; \
				[ -f .secrets.baseline.tmp ] && mv .secrets.baseline.tmp .secrets.baseline || true; \
			fi; \
		else \
			[ -f .secrets.baseline.tmp ] && mv .secrets.baseline.tmp .secrets.baseline && echo "✅ Secrets baseline created at .secrets.baseline" || echo "⚠️ Could not create baseline."; \
		fi; \
	}; \
	if command -v uvx > /dev/null; then \
		_run_scan "uvx --from detect-secrets==1.5.0 detect-secrets" || exit 1; \
	elif command -v detect-secrets > /dev/null; then \
		_run_scan "detect-secrets" || exit 1; \
	else \
		echo "⚠️ detect-secrets not found. Skipping scan."; \
	fi

commitlint:
	$(BUNX) commitlint --edit $(COMMIT_MSG_FILE)

clean:
	rm -rf dist coverage node_modules .secrets.baseline.tmp
