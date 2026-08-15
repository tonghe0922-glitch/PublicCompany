#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXPECTED_REPOSITORY = "tonghe0922-glitch/PublicCompany"
EXPECTED_BRANCH = "agent/phase-10-public-capabilities-b"

# Retired execution identities are built in pieces so this guard does not trip repository-wide
# literal scanners that intentionally reject obsolete repository names.
RETIRED_REPOSITORY = "louth" + "ison/PublicCompany"
RETIRED_BRANCH = "ChatGPT_" + "Version_V0.07"

ACTIVE_IDENTITY_FILES = (
    "README.md",
    "docs/implementation/CONSTRUCTION_RULES.md",
    "docs/implementation/MASTER_PROGRESS.md",
    "docs/implementation/phases/PHASE-10/README.md",
    ".github/workflows/phase10-preparation-gate.yml",
    ".github/workflows/phase10-preparation-probe.yml",
    ".github/workflows/phase10-c0.yml",
    ".github/workflows/phase10-full-gate.yml",
)
REPOSITORY_FILES = {
    "README.md",
    "docs/implementation/CONSTRUCTION_RULES.md",
    "docs/implementation/MASTER_PROGRESS.md",
    "docs/implementation/phases/PHASE-10/README.md",
    ".github/workflows/phase10-preparation-gate.yml",
    ".github/workflows/phase10-preparation-probe.yml",
}


def main() -> None:
    failures: list[str] = []
    for rel in ACTIVE_IDENTITY_FILES:
        path = ROOT / rel
        if not path.is_file():
            failures.append(f"{rel}: missing active identity file")
            continue
        text = path.read_text(encoding="utf-8-sig")
        if rel in REPOSITORY_FILES and EXPECTED_REPOSITORY not in text:
            failures.append(f"{rel}: canonical repository identity missing")
        if EXPECTED_BRANCH not in text:
            failures.append(f"{rel}: current PHASE-10 branch identity missing")
        if RETIRED_REPOSITORY in text:
            failures.append(f"{rel}: retired repository identity remains")
        if RETIRED_BRANCH in text:
            failures.append(f"{rel}: retired PHASE-10 branch identity remains")
    if failures:
        raise SystemExit("PHASE-10 repository identity guard failed:\n" + "\n".join(failures))
    print(f"PHASE-10 repository identity PASS: {EXPECTED_REPOSITORY} @ {EXPECTED_BRANCH}")


if __name__ == "__main__":
    main()
