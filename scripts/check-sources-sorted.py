#!/usr/bin/env python3
"""Verify that the Sources tables in README.md and docs/license-matrix.md are sorted
alphabetically by Country.

The Sources tables grow as new agencies are triaged. Inserting new rows in the wrong
position has happened three times in a row across recent doc batches; this validator
catches it at commit time so the next forty entries stay in shape.

Exit codes:
    0 — both tables are sorted by Country (case-insensitive).
    1 — one or more tables out of order; offending pairs printed.

Run via lefthook pre-commit (`scripts: check-sources-sorted` in lefthook.yml) or
directly: `python3 scripts/check-sources-sorted.py`.

Conventions per PRD:
    - README sources table sits under the `## Sources` heading. Country is the second
      pipe-delimited column (parts[2] after `line.split('|')`).
    - docs/license-matrix.md summary table sits under `## Summary table`. Country is
      the first column (parts[1]).

The validator is intentionally specific to these two files and these two columns —
no auto-discovery, no markdown-table parser dependency. If the doc structure
changes, update CONFIG below and the validator.
"""

from __future__ import annotations

import sys
import unicodedata
from pathlib import Path
from typing import Iterable

REPO_ROOT = Path(__file__).resolve().parent.parent

# (file path relative to REPO_ROOT, table-section heading marker, country-column index)
CONFIG = [
    (REPO_ROOT / "README.md", "## Sources", 2),
    (REPO_ROOT / "docs" / "license-matrix.md", "## Summary table", 1),
]


def country_column(line: str, col: int) -> str | None:
    """Return the trimmed Country cell from a table row, or None if not a data row."""
    if not line.lstrip().startswith("|"):
        return None
    parts = [p.strip() for p in line.split("|")]
    if len(parts) <= col:
        return None
    cell = parts[col]
    # Skip header (literal "Country") and separator rows ("----...").
    if cell == "" or cell == "Country" or set(cell) <= {"-", " "}:
        return None
    return cell


def extract_table_countries(path: Path, marker: str, col: int) -> list[tuple[int, str]]:
    """Return [(line_no, country)] for every data row in the table that follows `marker`.

    Stops at the next blank line that follows at least one data row, or at the next
    `## ` heading — whichever comes first. line_no is 1-indexed for human-readable
    error output.
    """
    lines = path.read_text(encoding="utf-8").splitlines()
    in_table = False
    found_data = False
    countries: list[tuple[int, str]] = []
    for i, line in enumerate(lines, start=1):
        if line.strip() == marker:
            in_table = True
            continue
        if not in_table:
            continue
        if line.startswith("## "):
            break  # next section
        country = country_column(line, col)
        if country is not None:
            countries.append((i, country))
            found_data = True
        elif found_data and line.strip() == "":
            break  # blank line after table ends the section
    return countries


def _sort_key(country: str) -> str:
    # Drop combining diacritical marks so accented chars (Côte d'Ivoire) collate with their
    # ASCII base. Atomic Latin letters (ø, ł, æ) don't decompose and still sort by code point.
    return "".join(
        c for c in unicodedata.normalize("NFD", country)
        if unicodedata.category(c) != "Mn"
    ).lower()


def find_sort_violations(rows: Iterable[tuple[int, str]]) -> list[tuple[int, str, str]]:
    """Return list of (line_no, this_country, prev_country) where this < prev."""
    violations: list[tuple[int, str, str]] = []
    prev: tuple[int, str] | None = None
    for line_no, country in rows:
        if prev is not None and _sort_key(country) < _sort_key(prev[1]):
            violations.append((line_no, country, prev[1]))
        prev = (line_no, country)
    return violations


def main() -> int:
    exit_code = 0
    for path, marker, col in CONFIG:
        rel = path.relative_to(REPO_ROOT)
        rows = extract_table_countries(path, marker, col)
        if not rows:
            print(f"⚠️  {rel}: table after '{marker}' is empty or missing — skipping")
            continue
        violations = find_sort_violations(rows)
        if violations:
            exit_code = 1
            print(f"❌ {rel}: {len(violations)} sort violation(s) under '{marker}'")
            for line_no, current, previous in violations:
                print(f"   line {line_no}: '{current}' should come before '{previous}'")
        else:
            print(f"✅ {rel}: {len(rows)} rows under '{marker}' are alphabetically sorted")
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
