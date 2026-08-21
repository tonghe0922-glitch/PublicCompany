#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

REQUIRED = {
    "process": "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/Phase11Process.java",
    "service": "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/Phase11LifecycleService.java",
    "performance": "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/PerformanceService.java",
    "repository": "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/JdbcPhase11Repository.java",
    "controller": "technical-platform/backend/apps/api/src/main/java/cn/shangjingu/platform/api/phase11/P011PerformanceController.java",
    "migration": "technical-platform/database/flyway-overlays/oms/V122__phase11_p011_performance.sql",
    "employee": "technical-platform/web/src/platform/pages/phase11/P011EmployeePage.vue",
    "center": "technical-platform/web/src/platform/pages/phase11/P011CenterPage.vue",
    "tech": "technical-platform/web/src/platform/pages/phase11/P011TechPage.vue",
    "workspace": "technical-platform/web/src/platform/phase11/p011/P011PerformanceWorkspace.vue",
    "operations": "technical-platform/web/src/platform/phase11/p011/usePerformanceOperations.ts",
    "router_test": "technical-platform/web/src/router/p011-router.test.ts",
    "service_test": "technical-platform/backend/modules/workflow/src/test/java/cn/shangjingu/platform/workflow/phase11/Phase11LifecycleServiceTest.java",
    "database_test": "technical-platform/backend/modules/database-baseline/src/test/java/cn/shangjingu/platform/database/Phase11P011DatabaseIT.java",
}

ACTIONS = (
    "SET_TARGETS",
    "CONFIRM_TARGETS",
    "RECORD_COACHING",
    "COLLECT_FACTS",
    "SUBMIT_REVIEWS",
    "CALCULATE_SCORE",
    "CALIBRATE",
    "SUBMIT_APPEAL_DECISION",
    "RESOLVE_APPEAL",
    "EXECUTE_IMPACT",
    "ARCHIVE",
)

CHECKPOINT_RUN = "31871437974"
CHECKPOINT_EVIDENCE = ROOT / "docs/implementation/phases/PHASE-11/P011_CHECKPOINT_EVIDENCE.md"
CHECKPOINT_JOBS = (
    "P011 C0, scope and repository contract | SUCCESS",
    "Java 21 P011 application and API behavior | SUCCESS",
    "PHASE-04 API security regression | SUCCESS",
    "PostgreSQL 16 P011 canonical facts and immutability | SUCCESS",
    "P011 Vue TypeScript lint unit quality and three builds | SUCCESS",
    "P011 checkpoint verdict | SUCCESS",
)


def fail(message: str) -> None:
    raise SystemExit("PHASE-11 P011 contract FAIL: " + message)


def text(key: str) -> str:
    path = ROOT / REQUIRED[key]
    if not path.is_file() or path.stat().st_size == 0:
        fail(f"missing {path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8")


def require(content: str, *fragments: str, label: str) -> None:
    for fragment in fragments:
        if fragment not in content:
            fail(f"{label} missing {fragment!r}")


def verify_checkpoint_evidence(progress: str) -> None:
    if not CHECKPOINT_EVIDENCE.is_file():
        fail(f"missing {CHECKPOINT_EVIDENCE.relative_to(ROOT)}")
    evidence = CHECKPOINT_EVIDENCE.read_text(encoding="utf-8")
    require(evidence, f"Run | {CHECKPOINT_RUN}", label="P011 checkpoint evidence")
    for job in CHECKPOINT_JOBS:
        require(evidence, job, label="P011 checkpoint evidence")
    require(
        progress,
        f"P011 = CHECKPOINT_PASS / CLOSED / run {CHECKPOINT_RUN}",
        label="MASTER_PROGRESS",
    )


def verify_lifecycle_state(progress: str) -> str:
    candidate = "P011 = IN_PROGRESS / CHECKPOINT_GATE_PENDING / IMPLEMENTATION_CANDIDATE"
    closed = "P011 = CHECKPOINT_PASS / CLOSED"
    if candidate in progress:
        return "CANDIDATE"
    if closed in progress:
        verify_checkpoint_evidence(progress)
        return "CLOSED"
    fail("MASTER_PROGRESS must contain the P011 candidate or evidence-backed CLOSED state")
    raise AssertionError("unreachable")


def main() -> None:
    process = text("process")
    require(process, 'P011(', '"performance.performance_cycle"', label="process")
    # P012-P016 are legal later checkpoints in PHASE-11. Only PHASE-12/P017+ drift is forbidden here.
    if re.search(r"\bP0(17|18|19|20)\b", process):
        fail("P011 regression contract exposes a PHASE-12 executable process")
    for action in ACTIONS:
        require(process, f'"{action}"', label="process graph")

    service = text("service")
    require(
        service,
        "IdempotencyRegistry",
        "expectedVersion",
        "validateScoreActor",
        "employee, supervisor and authoritative score facts are required",
        "TransactionalOutboxService.Command",
        label="lifecycle service",
    )
    repository = text("repository")
    require(
        repository,
        "NamedParameterJdbcTemplate",
        "performance.performance_score_entry",
        "on conflict (tenant_id,cycle_id,score_type)",
        "current_node_code=:requiredNode",
        "employee_event_type='P011_PERFORMANCE'",
        label="repository",
    )

    controller = text("controller")
    require(
        controller,
        '@RequestMapping("/api/v1/processes/P011/performance-cycles")',
        "support.requireAction",
        "support.requireData",
        "p011.performance.self",
        "p011.performance.evaluate",
        "p011.performance.calibrate",
        "p011.performance.appeal",
        "p011.performance.impact",
        "p011.performance.monitor",
        "metadataOnly()",
        label="controller",
    )

    migration = text("migration")
    require(
        migration,
        "performance.performance_score_entry",
        "score_type IN ('EMPLOYEE','SUPERVISOR','AUTHORITATIVE','CALIBRATED')",
        "score_1000 BETWEEN 0 AND 1000",
        "P011 performance score facts are append-only",
        "ENABLE ROW LEVEL SECURITY",
        "phase11-p011-c0-v1",
        "EMP-P011-F01",
        label="migration",
    )
    if "CREATE TABLE" in migration and "performance.performance_score_entry" not in migration:
        fail("P011 migration creates an unapproved shadow table")

    workspace = text("workspace")
    operations = text("operations")
    require(
        workspace,
        "我的绩效周期",
        "绩效管理工作台",
        "绩效流程运行监控",
        "独立分数事实",
        label="workspace",
    )
    require(
        operations,
        "/api/v1/processes/P011/performance-cycles",
        "rows.value = records",
        "0–1000",
        "expectedVersion",
        label="operations",
    )
    if "localStorage" in workspace + operations or re.search(r"mock.*P011", workspace + operations, re.I):
        fail("P011 frontend contains local or mock business truth")

    for key in ("employee", "center", "tech", "router_test", "service_test", "database_test"):
        text(key)

    progress = (ROOT / "docs/implementation/MASTER_PROGRESS.md").read_text(encoding="utf-8")
    state = verify_lifecycle_state(progress)
    require(progress, "PHASE-12 = NOT_STARTED / LOCKED", label="MASTER_PROGRESS")

    print(
        "PHASE-11 P011 contract PASS: state="
        + state
        + "; independent score facts, canonical workflow, server authorization, RLS, "
        "outbox, three-portal pages and tests are present"
    )


if __name__ == "__main__":
    main()
