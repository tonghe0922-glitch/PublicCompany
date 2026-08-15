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


def main() -> None:
    process = text("process")
    require(process, 'P011(', '"performance.performance_cycle"', label="process")
    if re.search(r"\bP0(12|13|14|15|16|17|18|19|20)\b", process):
        fail("P011 checkpoint exposes a later executable process")
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
    if "P011 = CHECKPOINT_PASS / CLOSED" in progress:
        fail("P011 cannot be closed before the checkpoint and live E2E gates pass")
    require(
        progress,
        "P011 = IN_PROGRESS / CHECKPOINT_GATE_PENDING / IMPLEMENTATION_CANDIDATE",
        "PHASE-12 = NOT_STARTED / LOCKED",
        label="MASTER_PROGRESS",
    )

    print(
        "PHASE-11 P011 contract PASS: independent score facts, canonical workflow, "
        "server authorization, RLS, outbox, three-portal pages and tests are present"
    )


if __name__ == "__main__":
    main()
