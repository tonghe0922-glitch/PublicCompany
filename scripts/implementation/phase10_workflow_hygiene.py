#!/usr/bin/env python3
"""Fail closed when retired workflows or stale repository wiring reappear."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / ".github" / "workflows"
CURRENT_REPOSITORY = "tonghe0922-glitch/PublicCompany"
CURRENT_BRANCH = "agent/phase-10-public-capabilities-b"

RETIRED = {
    "phase03-baseline-report.yml",
    "phase03-database.yml",
    "phase03-flyway-generate.yml",
    "phase03-gate.yml",
    "phase03-ledger-finalize.yml",
    "phase03-runtime.yml",
    "phase04-gate.yml",
    "phase04-iam-kernel.yml",
    "phase04-source-contract.yml",
    "phase05-gate.yml",
    "phase05-process-kernel.yml",
    "phase06-gate.yml",
    "phase06-platform-side-effects.yml",
    "phase07-design-system.yml",
    "phase07-formal-gate.yml",
    "phase08-c0-contract.yml",
    "phase08-full-gate.yml",
    "phase08-ia-extract.yml",
    "phase08-navigation-extract.yml",
    "phase08-portal-runtime.yml",
    "phase09-c0.yml",
    "phase09-full-gate.yml",
    "phase09-p003-live-gate.yml",
    "phase09-p004-live-gate.yml",
    "phase09-p005-live-gate.yml",
    "phase09-preparation-gate.yml",
    "phase10-seal-once.yml",
    "repository-migration-rewrite.yml",
}

OLD_OWNER = "louth" + "ison"
FORBIDDEN = {
    "ChatGPT_Version_V0.05": "removed phase-05/06 branch",
    "ChatGPT_Version_V0.07": "removed phase-07/08/09 branch",
    f"{OLD_OWNER}/NEWSTART": "pre-migration repository",
    f"{OLD_OWNER}/PublicCompany": "pre-migration repository",
}


def verify() -> None:
    existing = {path.name for path in WORKFLOWS.glob("*.yml")}
    resurrected = sorted(existing & RETIRED)
    if resurrected:
        raise RuntimeError(f"retired workflows must stay retired: {resurrected}")

    violations: list[str] = []
    for path in sorted(WORKFLOWS.glob("*.yml")):
        text = path.read_text(encoding="utf-8")
        for token, reason in FORBIDDEN.items():
            if token in text:
                violations.append(f"{path.relative_to(ROOT)}: {reason}: {token}")
        if "phase10" in path.name and re.search(r"(?m)^\s*(?:contents|actions):\s*write\s*$", text):
            violations.append(f"{path.relative_to(ROOT)}: PHASE-10 workflows are read-only")
    if violations:
        raise RuntimeError("stale workflow wiring detected:\n" + "\n".join(violations))

    full_gate = WORKFLOWS / "phase10-full-gate.yml"
    text = full_gate.read_text(encoding="utf-8")
    required = (
        CURRENT_REPOSITORY,
        CURRENT_BRANCH,
        "phase10_workflow_hygiene.py",
        "phase10_frontend_contract.py",
        "quality:duplicates",
        "quality:deadcode",
        "playwright.phase10-live.config.ts",
        "Phase10BrowserBackendFixture",
        "needs.e2e.result",
        "Phase10WorkflowServiceTest",
        "WorkflowCandidateResolverTest",
        'phase: ["03", "05", "06", "09", "10"]',
        'PROFILE="phase${{ matrix.phase }}-integration"',
    )
    missing = [token for token in required if token not in text]
    if missing:
        raise RuntimeError(f"PHASE-10 full gate lost executable closure checks: {missing}")

    for one_shot in (
        "repository-migration-rewrite.yml",
        "phase10-seal-once.yml",
        "phase10-source-snapshot.yml",
        "phase10-toolchain-cache.yml",
    ):
        if (WORKFLOWS / one_shot).exists():
            raise RuntimeError(f"one-shot workflow must not be active: {one_shot}")


def main() -> None:
    verify()
    print("PHASE-10 workflow lifecycle and repository identity are current")


if __name__ == "__main__":
    main()
