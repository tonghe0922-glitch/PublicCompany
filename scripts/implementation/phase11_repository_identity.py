#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXPECTED_REPOSITORY = "tonghe0922-glitch/PublicCompany"
EXPECTED_BRANCH = "agent/phase-11-performance-growth-welfare"
REPOSITORY_FILES = (
    "README.md",
    "docs/implementation/CONSTRUCTION_RULES.md",
    "docs/implementation/MASTER_PROGRESS.md",
    "docs/implementation/phases/PHASE-11/README.md",
    "docs/implementation/contracts/phase-11/README.md",
    ".github/workflows/phase11-preparation-probe.yml",
    ".github/workflows/phase11-preparation-analysis.yml",
    ".github/workflows/phase11-preparation-gate.yml",
)
BRANCH_FILES = (
    "docs/implementation/MASTER_PROGRESS.md",
    "docs/implementation/phases/PHASE-11/README.md",
    "docs/implementation/contracts/phase-11/README.md",
    ".github/workflows/phase11-preparation-probe.yml",
    ".github/workflows/phase11-preparation-analysis.yml",
    ".github/workflows/phase11-preparation-gate.yml",
)


def read(relative: str) -> str:
    path = ROOT / relative
    if not path.is_file():
        raise FileNotFoundError(relative)
    return path.read_text(encoding="utf-8-sig")


def main() -> None:
    failures: list[str] = []
    for relative in REPOSITORY_FILES:
        try:
            text = read(relative)
        except FileNotFoundError:
            failures.append(f"{relative}: missing")
            continue
        if EXPECTED_REPOSITORY not in text:
            failures.append(f"{relative}: canonical repository identity missing")
    for relative in BRANCH_FILES:
        try:
            text = read(relative)
        except FileNotFoundError:
            continue
        if EXPECTED_BRANCH not in text:
            failures.append(f"{relative}: PHASE-11 branch identity missing")
    if failures:
        raise SystemExit(
            "PHASE-11 repository identity guard failed:\n" + "\n".join(failures)
        )
    print(f"PHASE-11 repository identity PASS: {EXPECTED_REPOSITORY} @ {EXPECTED_BRANCH}")


if __name__ == "__main__":
    main()
