#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXPECTED_REPOSITORY = "tonghe0922-glitch/PublicCompany"
EXPECTED_BRANCH = "agent/phase-11-performance-growth-welfare"
ACTIVE_FILES = (
    "README.md",
    "docs/implementation/CONSTRUCTION_RULES.md",
    ".github/workflows/phase11-preparation-probe.yml",
)


def main() -> None:
    failures: list[str] = []
    for relative in ACTIVE_FILES:
        path = ROOT / relative
        if not path.is_file():
            failures.append(f"{relative}: missing")
            continue
        text = path.read_text(encoding="utf-8-sig")
        if EXPECTED_REPOSITORY not in text:
            failures.append(f"{relative}: canonical repository identity missing")
    workflow = (
        ROOT / ".github" / "workflows" / "phase11-preparation-probe.yml"
    ).read_text(encoding="utf-8")
    if EXPECTED_BRANCH not in workflow:
        failures.append("phase11-preparation-probe.yml: PHASE-11 branch identity missing")
    if failures:
        raise SystemExit(
            "PHASE-11 repository identity guard failed:\n" + "\n".join(failures)
        )
    print(f"PHASE-11 repository identity PASS: {EXPECTED_REPOSITORY} @ {EXPECTED_BRANCH}")


if __name__ == "__main__":
    main()
