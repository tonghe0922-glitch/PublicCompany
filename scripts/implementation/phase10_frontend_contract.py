#!/usr/bin/env python3
"""Fail closed when the audited PHASE-10 frontend regresses to generic or unreadable pages."""
from __future__ import annotations

import re
from pathlib import Path

from phase10_remediation_contract import verify as verify_remediation

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "technical-platform" / "web" / "src"
ROUTE_SPECS = WEB / "router" / "portal-route-specs.ts"
OLD_GENERIC_PAGE = WEB / "platform" / "pages" / "Phase10OperationsPage.vue"
TECH_MONITOR = WEB / "platform" / "pages" / "Phase10TechMonitorPage.vue"
SHARED_TECH_MONITOR = WEB / "platform" / "pages" / "Phase09TechWorkflowMonitorPage.vue"

BUSINESS_ROUTES = {
    "p008-leave-request": "P008LeaveRequestPage",
    "p008-quota-ledger": "P008LeaveQuotaLedgerPage",
    "p008-leave-change": "P008LeaveChangePage",
    "p008-leave-review": "P008LeaveReviewPage",
    "p008-quota-management": "P008QuotaManagementPage",
    "p008-leave-change-center": "P008LeaveChangeCenterPage",
    "p009-overtime-request": "P009OvertimeRequestPage",
    "p009-time-off-request": "P009TimeOffRequestPage",
    "p009-result-acceptance": "P009ResultAcceptancePage",
    "p009-overtime-management": "P009OvertimeManagementPage",
    "p009-hr-review": "P009HrReviewPage",
    "p009-payroll-basis": "P009PayrollBasisPage",
    "p010-learning-tasks": "P010LearningTasksPage",
    "p010-online-exam": "P010OnlineExamPage",
    "p010-practical-task": "P010PracticalTaskPage",
    "p010-qualifications": "P010QualificationsPage",
    "p010-learning-management": "P010LearningManagementPage",
    "p010-practical-certification": "P010PracticalCertificationPage",
    "p010-permission-linkage": "P010PermissionLinkagePage",
}

AUDITED_FILES = [
    WEB / "platform" / "pages" / "P006MeetingPage.vue",
    WEB / "platform" / "pages" / "P007ShiftPage.vue",
    TECH_MONITOR,
    SHARED_TECH_MONITOR,
    WEB / "router" / "portal-router.ts",
    ROUTE_SPECS,
    WEB / "router" / "p008-p010-router.test.ts",
]
AUDITED_DIRS = [
    WEB / "platform" / "pages" / "phase10",
    WEB / "platform" / "phase10",
]

COMPOSABLES = {
    "P008": WEB / "platform" / "phase10" / "p008" / "useLeaveOperations.ts",
    "P009": WEB / "platform" / "phase10" / "p009" / "useOvertimeOperations.ts",
    "P010": WEB / "platform" / "phase10" / "p010" / "useLearningOperations.ts",
}


def audited_files() -> list[Path]:
    result = list(AUDITED_FILES)
    for directory in AUDITED_DIRS:
        result.extend(path for path in directory.rglob("*") if path.suffix in {".ts", ".vue", ".css"})
    return sorted(set(result))


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def verify_route_binding(text: str, route_name: str, component: str) -> None:
    pattern = re.compile(
        rf"name:\s*['\"]{re.escape(route_name)}['\"][\s\S]{{0,240}}?"
        rf"component:\s*{re.escape(component)}\b"
    )
    require(pattern.search(text) is not None, f"route {route_name} is not bound to {component}")


def verify_routes() -> None:
    require(not OLD_GENERIC_PAGE.exists(), "retired Phase10OperationsPage.vue must not return")
    text = ROUTE_SPECS.read_text(encoding="utf-8")
    require("Phase10OperationsPage" not in text, "PHASE-10 routes must not reuse the retired generic page")
    for route_name, component in BUSINESS_ROUTES.items():
        verify_route_binding(text, route_name, component)
    require(
        len(set(BUSINESS_ROUTES.values())) == len(BUSINESS_ROUTES),
        "P008-P010 semantic route components must be one-to-one",
    )


def verify_monitor() -> None:
    text = TECH_MONITOR.read_text(encoding="utf-8")
    require("<pre" not in text, "PHASE-10 tech monitor must not render raw preformatted JSON")
    require("JSON.stringify" not in text, "PHASE-10 tech monitor must not stringify raw aggregates")
    for token in ("SgjDashboardPageTemplate", "SgjTable", "SgjStatusChip"):
        require(token in text, f"PHASE-10 tech monitor lost design-system control {token}")
    shared = SHARED_TECH_MONITOR.read_text(encoding="utf-8")
    for token in ("Phase10TechMonitorPage", "p006.meeting.monitor", "p007.schedule.monitor"):
        require(token in shared, f"shared tech monitor lost PHASE-10 binding {token}")
    require("JSON.stringify" not in shared, "shared tech monitor must not stringify raw aggregates")


def verify_design_system_and_native_controls() -> None:
    pages = [
        WEB / "platform" / "pages" / "P006MeetingPage.vue",
        WEB / "platform" / "pages" / "P007ShiftPage.vue",
        TECH_MONITOR,
        *sorted((WEB / "platform" / "pages" / "phase10").glob("*.vue")),
    ]
    for path in pages:
        text = path.read_text(encoding="utf-8")
        require("design-system" in text, f"business page bypasses design system: {path.relative_to(ROOT)}")
    native = re.compile(r"<(?:button|input|select|textarea)\b", re.IGNORECASE)
    for path in audited_files():
        if path.suffix != ".vue":
            continue
        text = path.read_text(encoding="utf-8")
        require(native.search(text) is None, f"native control found in audited PHASE-10 file: {path.relative_to(ROOT)}")


def verify_composable_state_flow() -> None:
    for process, path in COMPOSABLES.items():
        text = path.read_text(encoding="utf-8")
        require(".splice(" not in text, f"{process} composable must replace ref arrays instead of splicing")
        require("const resetForm" in text, f"{process} composable must expose a resetForm helper")
        require("resetForm()" in text, f"{process} successful actions must reset stale form state")
        require("rows.value =" in text, f"{process} list refresh must assign rows.value")
    leave = COMPOSABLES["P008"].read_text(encoding="utf-8")
    require("ledger.value =" in leave, "P008 ledger refresh must assign ledger.value")


def verify_readability() -> None:
    violations: list[str] = []
    for path in audited_files():
        for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            if len(line) > 120:
                violations.append(f"{path.relative_to(ROOT)}:{line_no}:{len(line)}")
    require(not violations, "PHASE-10 audited source exceeds 120 columns:\n" + "\n".join(violations[:40]))


def verify() -> None:
    for path in audited_files():
        require(path.is_file(), f"required PHASE-10 frontend file missing: {path.relative_to(ROOT)}")
    verify_routes()
    verify_monitor()
    verify_design_system_and_native_controls()
    verify_composable_state_flow()
    verify_readability()
    verify_remediation()


def main() -> None:
    verify()
    print("PHASE-10 frontend contract is semantic, design-system based and human-readable")


if __name__ == "__main__":
    main()
