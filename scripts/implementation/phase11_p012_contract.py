#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REQUIRED = {
    "process": "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/Phase11Process.java",
    "service": "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/PromotionService.java",
    "repository": "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/PromotionRepository.java",
    "controller": "technical-platform/backend/apps/api/src/main/java/cn/shangjingu/platform/api/phase11/P012PromotionController.java",
    "migration": "technical-platform/database/flyway-overlays/oms/V123__phase11_p012_promotion.sql",
    "employee": "technical-platform/web/src/platform/pages/phase11/P012EmployeePage.vue",
    "center": "technical-platform/web/src/platform/pages/phase11/P012CenterPage.vue",
    "tech": "technical-platform/web/src/platform/pages/phase11/P012TechPage.vue",
    "workspace": "technical-platform/web/src/platform/phase11/p012/P012PromotionWorkspace.vue",
    "operations": "technical-platform/web/src/platform/phase11/p012/usePromotionOperations.ts",
    "routes": "technical-platform/web/src/router/portal-route-specs.ts",
    "router_test": "technical-platform/web/src/router/p012-router.test.ts",
    "service_test": "technical-platform/backend/modules/workflow/src/test/java/cn/shangjingu/platform/workflow/phase11/PromotionServiceTest.java",
    "database_test": "technical-platform/backend/modules/database-baseline/src/test/java/cn/shangjingu/platform/database/Phase11P012DatabaseIT.java",
}
ACTIONS = (
    "SUBMIT_NOMINATION",
    "PASS_ELIGIBILITY",
    "SUBMIT_ASSESSMENT",
    "VERIFY_POSITION_BUDGET",
    "COMPLETE_REVIEW",
    "APPROVE_PROMOTION",
    "COMPLETE_NOTICE",
    "CONFIRM_APPOINTMENT",
    "COMPLETE_VALIDATION",
    "ACTIVATE_APPOINTMENT",
)


def fail(message: str) -> None:
    raise SystemExit("PHASE-11 P012 contract FAIL: " + message)


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
    progress = (ROOT / "docs/implementation/MASTER_PROGRESS.md").read_text(encoding="utf-8")
    candidate = "P012 = IN_PROGRESS / CHECKPOINT_GATE_PENDING / IMPLEMENTATION_CANDIDATE"
    closed = "P012 = CHECKPOINT_PASS / CLOSED"
    p012_candidate = candidate in progress
    p012_closed = closed in progress
    if not p012_candidate and not p012_closed:
        fail("MASTER_PROGRESS must contain the P012 candidate or CLOSED state")

    process = text("process")
    require(process, "P011(", "P012(", '"hr.promotion_request"', label="process")
    for action in ACTIONS:
        require(process, f'"{action}"', label="P012 process graph")
    if p012_candidate and re.search(r"\bP0(13|14|15|16|17|18|19|20)\b", process):
        fail("P012 candidate exposes a later executable process before P012 closure")

    service = text("service")
    require(
        service,
        "IdempotencyRegistry",
        "expectedVersion",
        "validatePromotionGuard",
        '"FSM_NOT_CLOSED"',
        '"TIMEBOX_NOT_READY"',
        '"NO_REVIEW_FACET"',
        '"REVIEW_SCORE_BELOW_THRESHOLD"',
        'reason.contains("[ceo_mode]")',
        "activateAppointment",
        "TransactionalOutboxService.Command",
        label="promotion service",
    )
    repository = text("repository")
    require(
        repository,
        "performance.performance_cycle",
        "performance.performance_score_entry",
        "hr.promotion_request",
        "org.employee_position",
        "source_promotion_request_id",
        "on conflict (tenant_id,source_promotion_request_id)",
        "primary_position_id=:positionId",
        label="promotion repository",
    )

    controller = text("controller")
    require(
        controller,
        '@RequestMapping("/api/v1/processes/P012/promotions")',
        "support.requireAction",
        "support.requireData",
        "p012.promotion.create",
        "p012.promotion.read",
        "p012.promotion.review",
        "p012.promotion.appoint",
        "p012.promotion.activate",
        "p012.promotion.monitor",
        "metadataOnly()",
        label="controller",
    )

    migration = text("migration")
    require(
        migration,
        "ALTER TABLE hr.promotion_request",
        "source_performance_cycle_id",
        "promotion_threshold_score",
        "source_promotion_request_id",
        "uq_employee_position_promotion_effect",
        "ENABLE ROW LEVEL SECURITY",
        "phase11-p012-c0-v1",
        "EMP-P012-F01",
        label="migration",
    )
    if re.search(r"CREATE TABLE\s+(IF NOT EXISTS\s+)?hr\.promotion_request", migration, re.I):
        fail("P012 migration creates an unapproved shadow promotion table")

    workspace = text("workspace")
    operations = text("operations")
    routes = text("routes")
    require(
        workspace,
        "我的晋升与任职发展",
        "晋升与任职发展工作台",
        "晋升流程运行监控",
        "服务端晋升与任职事实",
        label="workspace",
    )
    require(
        operations,
        "/api/v1/processes/P012/promotions",
        "rows.value = records",
        "expectedVersion",
        "promotionThresholdScore",
        label="operations",
    )
    require(
        routes,
        "/employee/03/03/05",
        "/center/10/06/01",
        "/tech/01/11/07",
        "p012.promotion.monitor",
        label="routes",
    )
    if "localStorage" in workspace + operations or re.search(r"mock.*P012", workspace + operations, re.I):
        fail("P012 frontend contains local or mock business truth")

    for key in ("employee", "center", "tech", "router_test", "service_test", "database_test"):
        text(key)

    require(
        progress,
        "P011 = CHECKPOINT_PASS / CLOSED",
        "PHASE-12 = NOT_STARTED / LOCKED",
        label="MASTER_PROGRESS",
    )
    if p012_candidate:
        require(progress, "P013 = NOT_STARTED_CHECKPOINT", label="MASTER_PROGRESS")

    print(
        "PHASE-11 P012 contract PASS: authoritative P011 eligibility, canonical promotion aggregate, "
        "server authorization, idempotency, optimistic lock, exactly-once appointment effect, "
        "outbox, RLS, three-portal pages and tests are present"
    )


if __name__ == "__main__":
    main()
