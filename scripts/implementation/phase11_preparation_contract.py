#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
PHASE_DIR = ROOT / "docs" / "implementation" / "phases" / "PHASE-11"
CONTRACT_DIR = ROOT / "docs" / "implementation" / "contracts" / "phase-11"
BASELINE_SHA = "79edc420802bfb9d2e47a0976b6198a67e80c4c2"
BRANCH = "agent/phase-11-performance-growth-welfare"
CODES = ("P011", "P012", "P013", "P014", "P015", "P016")
PORTALS = ("employee", "center", "tech")
EXPECTED_CANDIDATES = {
    "P011": {"employee": 0, "center": 0, "tech": 0},
    "P012": {"employee": 0, "center": 0, "tech": 0},
    "P013": {"employee": 126, "center": 24, "tech": 19},
    "P014": {"employee": 0, "center": 0, "tech": 0},
    "P015": {"employee": 0, "center": 0, "tech": 0},
    "P016": {"employee": 0, "center": 0, "tech": 0},
}
EXPECTED_IMPLEMENTATION = {
    "P011": "BASELINE_TABLE_ONLY",
    "P012": "BASELINE_TABLE_ONLY",
    "P013": "BASELINE_TABLE_ONLY",
    "P014": "BASELINE_TABLE_ONLY",
    "P015": "BASELINE_TABLE_ONLY",
    "P016": "EXECUTABLE_MARKER_PRESENT",
}
REQUIRED_FILES = (
    "README.md",
    "PREPARATION_REPORT.md",
    "IMPACT_MATRIX.md",
    "GAP_MATRIX.md",
    "START_CHECKLIST.md",
)


def fail(message: str) -> None:
    raise SystemExit(f"PHASE-11 preparation contract FAIL: {message}")


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"cannot read JSON {path.relative_to(ROOT)}: {exc}")
    if not isinstance(value, dict):
        fail(f"{path.relative_to(ROOT)} must contain a JSON object")
    return value


def require_text(path: Path, *fragments: str) -> str:
    if not path.is_file():
        fail(f"missing {path.relative_to(ROOT)}")
    text = path.read_text(encoding="utf-8-sig")
    for fragment in fragments:
        if fragment not in text:
            fail(f"{path.relative_to(ROOT)} missing {fragment!r}")
    return text


def git_lines(*args: str) -> list[str]:
    result = subprocess.run(
        ["git", *args], cwd=ROOT, check=True, capture_output=True, text=True
    )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def main() -> None:
    for relative in REQUIRED_FILES:
        if not (PHASE_DIR / relative).is_file():
            fail(f"missing docs/implementation/phases/PHASE-11/{relative}")
    for relative in ("README.md", "C0_DECISION_LOG.md"):
        if not (CONTRACT_DIR / relative).is_file():
            fail(f"missing docs/implementation/contracts/phase-11/{relative}")

    master = require_text(
        ROOT / "docs" / "implementation" / "MASTER_PROGRESS.md",
        "tonghe0922-glitch/PublicCompany",
        BRANCH,
        "PHASE-10 = COMPLETE / FULL_CONSTRUCTION_GATE_PASS",
        "PHASE-11 = IN_PROGRESS",
        "P011 = NEXT / C0_GATE_PENDING / NOT_IMPLEMENTED",
        "PHASE-12 = NOT_STARTED / LOCKED",
    )
    if "PHASE-11 = COMPLETE" in master or "P011 = CHECKPOINT_PASS" in master:
        fail("preparation must not claim PHASE-11 or P011 completion")
    if not any(
        marker in master
        for marker in ("C0_FROZEN_CANDIDATE", "PREPARATION_GATE_PASS")
    ):
        fail("MASTER_PROGRESS has no preparation-gate state")

    phase_readme = require_text(
        PHASE_DIR / "README.md",
        BRANCH,
        "IN_PROGRESS",
        "P011 executable implementation",
        "PHASE-12: **NOT_STARTED / LOCKED**",
    )
    if "PHASE-11 COMPLETE" in phase_readme:
        fail("README incorrectly claims PHASE-11 complete")
    require_text(
        PHASE_DIR / "PREPARATION_REPORT.md",
        "31818722531",
        "31819889568",
        "Production changes since PHASE-10 baseline | 0",
        "P011 C0 contract freeze",
    )
    require_text(PHASE_DIR / "IMPACT_MATRIX.md", "P016", "禁止 shadow table")
    require_text(PHASE_DIR / "GAP_MATRIX.md", "P011 C0 freeze", "P016 复用差距")
    require_text(PHASE_DIR / "START_CHECKLIST.md", "Construction not started")
    require_text(CONTRACT_DIR / "README.md", "PHASE-11 C0", BRANCH)
    decision_log = require_text(
        CONTRACT_DIR / "C0_DECISION_LOG.md",
        "C0-01",
        "C0-08",
        "FROZEN / READY_FOR_P011_IMPLEMENTATION",
    )
    if "| OPEN |" in decision_log:
        fail("C0 clarification rows must be resolved after the C0 freeze")

    snapshot_path = PHASE_DIR / "P011_P016_SOURCE_SNAPSHOT.json"
    generated_source_path = PHASE_DIR / "P011_P016_SOURCE_CONTRACT.json"
    generated_pages_path = PHASE_DIR / "P011_P016_PAGE_CANDIDATES.json"
    generated_implementation_path = PHASE_DIR / "P011_P016_IMPLEMENTATION_PROBE.json"
    for generated in (snapshot_path, generated_source_path, generated_pages_path, generated_implementation_path):
        if not generated.is_file():
            fail(f"run PHASE-11 generators before preparation contract: {generated.name}")

    import hashlib
    snapshot = load_json(snapshot_path)
    expected_snapshot = {
        "process_codes": list(CODES),
        "process_count": 6,
        "portal_count": 3,
        "workbook_count": 18,
        "sheet_count": 108,
        "nonempty_row_count": 5655,
        "parse_failures": 0,
        "business_api_records": 0,
    }
    for key, expected in expected_snapshot.items():
        if snapshot.get(key) != expected:
            fail(f"source snapshot {key}={snapshot.get(key)!r}, expected {expected!r}")
    if hashlib.sha256(snapshot_path.read_bytes()).hexdigest() != "03828c34ef928b5558d575777784192d1859428a63298f1adbf89ceb99a8c4c0":
        fail("authoritative source snapshot hash changed; preparation review must be repeated")

    source = load_json(generated_source_path)
    if source.get("process_codes") != list(CODES):
        fail("source contract scope mismatch")
    rules = source.get("rules") or {}
    for key in (
        "http_paths_frozen",
        "permission_codes_frozen",
        "page_bindings_frozen",
        "workflow_versions_frozen",
        "source_text_silently_corrected",
        "tech_business_super_admin",
        "p017_plus_in_scope",
    ):
        if rules.get(key) is not False:
            fail(f"source contract rule {key} must be false during preparation")
    processes = source.get("processes")
    if not isinstance(processes, dict) or tuple(processes) != CODES:
        fail("source contract process order/scope mismatch")
    clarification_types = {
        code: {item.get("type") for item in processes[code].get("clarification_items", [])}
        for code in CODES
    }
    if "SOURCE_TEXT_REVIEW_REQUIRED" not in clarification_types["P012"]:
        fail("P012 source-text clarification missing")
    if "SOURCE_TEXT_REVIEW_REQUIRED" not in clarification_types["P015"]:
        fail("P015 source-text clarification missing")
    for code in ("P011", "P013", "P014"):
        if "DOMAIN_RULE_COVERAGE_REVIEW_REQUIRED" not in clarification_types[code]:
            fail(f"{code} domain-rule coverage clarification missing")

    pages = load_json(generated_pages_path)
    if pages.get("state") != "PREPARATION_PAGE_CANDIDATES_NOT_FROZEN":
        fail("page candidate state is not preparation-only")
    if (pages.get("rules") or {}).get("candidate_is_binding") is not False:
        fail("page candidates must not be treated as bindings")
    for code in CODES:
        for portal in PORTALS:
            actual = pages["processes"][code][portal]["candidate_count"]
            expected = EXPECTED_CANDIDATES[code][portal]
            if actual != expected:
                fail(f"{code}/{portal} candidate_count={actual}, expected {expected}")
            for candidate in pages["processes"][code][portal]["candidates"]:
                if candidate.get("selection_status") != "CANDIDATE_ONLY_NOT_FROZEN":
                    fail(f"{code}/{portal} contains a prematurely frozen candidate")

    implementation = load_json(generated_implementation_path)
    if implementation.get("baseline_sha") != BASELINE_SHA:
        fail("implementation probe baseline mismatch")
    if implementation.get("changed_production_files_since_phase10") != []:
        fail("production code changed during preparation")
    for code in CODES:
        item = implementation["processes"][code]
        if item.get("canonical_tables_status") != "EXISTING_BASELINE_DDL":
            fail(f"{code} canonical DDL is not existing baseline")
        if item.get("implementation_status") != EXPECTED_IMPLEMENTATION[code]:
            fail(f"{code} implementation status changed unexpectedly")
    p016_hits = implementation["processes"]["P016"]["exact_process_code_hits"]
    required_p016 = (
        "technical-platform/backend/modules/welfare/src/main/java/cn/shangjingu/platform/welfare/CareCaseService.java",
        "technical-platform/backend/apps/api/src/main/java/cn/shangjingu/platform/api/phase05/WelfareCareCaseController.java",
        "technical-platform/web/src/platform/phase05-processes.ts",
    )
    combined = {item for values in p016_hits.values() for item in values}
    for path in required_p016:
        if path not in combined:
            fail(f"P016 pre-existing kernel evidence missing: {path}")

    catalog = load_json(ROOT / "docs" / "implementation" / "MASTER_PAGE_CATALOG.json")
    current = catalog.get("current_business_phase") or {}
    next_phase = catalog.get("next_business_phase") or {}
    if current.get("phase") != "PHASE-11" or current.get("state") != "IN_PROGRESS_C0_FROZEN":
        fail("MASTER_PAGE_CATALOG current phase is not PHASE-11 C0 frozen")
    if current.get("process_codes") != list(CODES):
        fail("MASTER_PAGE_CATALOG PHASE-11 scope mismatch")
    if current.get("c0_page_bindings") != "docs/implementation/phases/PHASE-11/PHASE11_PAGE_BINDINGS.json":
        fail("MASTER_PAGE_CATALOG PHASE-11 frozen binding path invalid")
    if current.get("canonical_page_records_changed_at_c0") != 0:
        fail("C0 must not reclassify canonical page records")
    if next_phase.get("phase") != "PHASE-12" or next_phase.get("state") != "NOT_STARTED":
        fail("PHASE-12 must remain NOT_STARTED")

    # This contract is preparation/C0 continuity only. Product checkpoints are
    # validated by their own workflows after C0, so production drift is no
    # longer rejected here once the preparation-only workflows stop matching
    # production paths.
    artifact_only_paths = (
        "docs/implementation/phases/PHASE-11/P011_P016_SOURCE_SNAPSHOT.json",
        "docs/implementation/phases/PHASE-11/P011_P016_SOURCE_SNAPSHOT.md",
        "docs/implementation/phases/PHASE-11/P011_P016_SOURCE_CONTRACT.json",
        "docs/implementation/phases/PHASE-11/P011_P016_SOURCE_CONTRACT.md",
        "docs/implementation/phases/PHASE-11/P011_P016_PAGE_CANDIDATES.json",
        "docs/implementation/phases/PHASE-11/P011_P016_PAGE_CANDIDATES.md",
        "docs/implementation/phases/PHASE-11/P011_P016_IMPLEMENTATION_PROBE.json",
        "docs/implementation/phases/PHASE-11/P011_P016_IMPLEMENTATION_PROBE.md",
    )
    for relative in artifact_only_paths:
        if git_lines("ls-files", relative):
            fail(f"large physical evidence must remain artifact-only: {relative}")

    print(
        "PHASE-11 preparation contract PASS: sources, ledgers, gaps, page candidates, "
        "P016 reuse evidence, C0 freeze and PHASE-12 boundary are consistent"
    )


if __name__ == "__main__":
    main()
