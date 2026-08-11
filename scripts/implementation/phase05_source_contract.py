#!/usr/bin/env python3
"""Validate the corrected PHASE-05 canonical workflow-kernel source/control boundary."""
from __future__ import annotations

import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PHASE = ROOT / "docs" / "implementation" / "phases" / "PHASE-05"
DDL = ROOT / "technical-platform" / "database" / "flyway" / "oms" / "V45__workflow_tables.sql"
API_CONTRACT = ROOT / "docs" / "implementation" / "contracts" / "phase-05" / "WORKFLOW_API.md"
CONTROLLER = ROOT / "technical-platform/backend/apps/api/src/main/java/cn/shangjingu/platform/api/workflow/WorkflowRuntimeController.java"
SECURITY_CONFIGURATION = ROOT / "technical-platform/backend/apps/api/src/main/java/cn/shangjingu/platform/api/security/SecurityConfiguration.java"
FINAL_DATABASE_TEST = ROOT / "technical-platform/backend/modules/database-baseline/src/test/java/cn/shangjingu/platform/database/Phase05WorkflowFinalDatabaseIT.java"
DATABASE_POM = ROOT / "technical-platform/backend/modules/database-baseline/pom.xml"
GATE_WORKFLOW = ROOT / ".github/workflows/phase05-gate.yml"

REQUIRED_TABLES = (
    "workflow.wf_definition",
    "workflow.wf_version",
    "workflow.wf_node",
    "workflow.wf_transition",
    "workflow.wf_instance",
    "workflow.wf_task",
    "workflow.wf_action_log",
    "workflow.wf_form_definition",
    "workflow.wf_submission",
    "workflow.wf_submission_value",
    "workflow.wf_sla_policy",
    "workflow.wf_orchestration_instance",
    "workflow.wf_orchestration_instance_item",
    "workflow.wf_orchestration_link",
)

REQUIRED_SOURCE_TERMS = (
    "canonical workflow",
    "published workflow version is immutable",
    "server-side `action_code -> transition -> next node/status`",
    "field-level return",
    "candidate/approver",
    "SLA",
    "P120–P126",
    "PHASE-06 = NOT_STARTED",
)


def phase_state(progress: str) -> str:
    states = [
        state
        for state in ("IN_PROGRESS", "READY_FOR_GATE", "COMPLETE")
        if f"| PHASE-05 | {state} |" in progress
    ]
    assert len(states) == 1, f"expected one canonical PHASE-05 state, found {states}"
    return states[0]


def check() -> None:
    progress = (ROOT / "docs/implementation/MASTER_PROGRESS.md").read_text(encoding="utf-8")
    assert "> Repository: `louthison/PublicCompany`" in progress
    assert "> Construction branch: `ChatGPT_Version_V0.05`" in progress
    assert "| PHASE-04 | COMPLETE |" in progress
    state = phase_state(progress)
    if state == "COMPLETE":
        assert any(
            f"| PHASE-06 | {next_state} |" in progress
            for next_state in ("NOT_STARTED", "IN_PROGRESS", "READY_FOR_GATE", "COMPLETE")
        ), "completed PHASE-05 requires a recognized PHASE-06 ledger state"
    else:
        assert "| PHASE-06 | NOT_STARTED |" in progress

    source = (PHASE / "SOURCE_CONTRACT.md").read_text(encoding="utf-8")
    impact = (PHASE / "IMPACT_MATRIX.md").read_text(encoding="utf-8")
    gaps = (PHASE / "GAP_MATRIX.md").read_text(encoding="utf-8")
    report = (PHASE / "PHASE_REPORT.md").read_text(encoding="utf-8")
    gate = (PHASE / "PHASE_GATE.md").read_text(encoding="utf-8")
    c8 = (PHASE / "C8_CHECKPOINT.md").read_text(encoding="utf-8")

    for term in REQUIRED_SOURCE_TERMS:
        assert term in source, f"SOURCE_CONTRACT missing: {term}"

    assert "P016–P020" in source and "early consumers/reference implementations" in source
    assert "| P021 |" not in impact, "PHASE-06 P021 implementation row leaked into PHASE-05 impact matrix"
    assert "G05-02" in gaps and "Canonical Java workflow runtime" in gaps

    if state == "IN_PROGRESS":
        assert "Current state: `IN_PROGRESS / NOT_READY`" in source
        assert "Report state: `IN_PROGRESS / NOT_READY`" in report
        assert "PHASE GATE: NOT_RUN" in gate
    elif state == "READY_FOR_GATE":
        assert "Current state: `READY_FOR_GATE`" in source
        assert "Report state: `READY_FOR_GATE`" in report
        assert "Current canonical Gate state: `READY_TO_RUN / NOT_RUN`" in gate
        assert "PHASE GATE: NOT_RUN" in gate
        assert "Canonical C8 state: `COMPLETE / READY_FOR_GATE`" in c8
        assert "Current state: `READY_FOR_GATE`" in impact
        assert "Current state: `READY_FOR_GATE`" in gaps
    else:
        assert "Current state: `COMPLETE`" in source
        assert "Report state: `COMPLETE`" in report
        assert "Current canonical Gate state: `PASS`" in gate
        assert "PHASE GATE: PASS" in gate
        assert "Canonical C8 state: `COMPLETE / GATE_PASSED`" in c8
        assert "Current state: `COMPLETE`" in impact
        assert "Current state: `COMPLETE`" in gaps

    ddl = DDL.read_text(encoding="utf-8")
    for table in REQUIRED_TABLES:
        assert table in ddl, f"approved V45 missing {table}"

    workflow_main = ROOT / "technical-platform/backend/modules/workflow/src/main/java"
    assert workflow_main.is_dir(), "workflow module missing"

    api_catalog = (ROOT / "docs/implementation/MASTER_API_CATALOG.md").read_text(encoding="utf-8")
    assert "API-like records: **0**" in api_catalog or "HTTP API records" in api_catalog

    assert CONTROLLER.is_file(), "C7 workflow controller missing"
    assert API_CONTRACT.is_file(), "C7 engineering-owned Workflow API contract missing"
    contract = API_CONTRACT.read_text(encoding="utf-8")
    controller = CONTROLLER.read_text(encoding="utf-8")
    security = SECURITY_CONFIGURATION.read_text(encoding="utf-8")
    assert "engineering-owned" in contract
    assert "/api/v1/workflow/**" in contract
    assert "No target node or target status is accepted" in contract
    assert '@RequestMapping("/api/v1/workflow")' in controller
    assert 'targetState' not in controller and 'targetNodeCode' not in controller
    assert '.requestMatchers("/api/v1/workflow/**").authenticated()' in security
    for permission in (
        "workflow.runtime.start",
        "workflow.runtime.read",
        "workflow.runtime.act",
        "workflow.task.claim",
        "workflow.form.submit",
    ):
        assert permission in controller, f"Workflow API controller missing permission {permission}"

    # C8 final proof must remain wired into the real PostgreSQL integration profile.
    assert FINAL_DATABASE_TEST.is_file(), "C8 final PostgreSQL/concurrency test missing"
    final_test = FINAL_DATABASE_TEST.read_text(encoding="utf-8")
    database_pom = DATABASE_POM.read_text(encoding="utf-8")
    assert "competingRuntimeActionsCommitExactlyOneMutationAndRollbackLoserIdempotency" in final_test
    assert "idempotencyReplayHashConflictAndReturnRejectWithdrawEvidenceStayDistinct" in final_test
    assert "canonicalWorkflowTablesUseApprovedRlsAndRuntimeCannotCrossTenant" in final_test
    assert "Phase05WorkflowFinalDatabaseIT.java" in database_pom

    # The corrected Formal Gate retains manual exact-SHA dispatch and an exact-SHA
    # push fallback used only when this Gate workflow itself changes.
    gate_workflow = GATE_WORKFLOW.read_text(encoding="utf-8")
    assert "workflow_dispatch:" in gate_workflow
    assert "candidate_sha:" in gate_workflow
    assert "push:" in gate_workflow
    assert '".github/workflows/phase05-gate.yml"' in gate_workflow
    assert "CANDIDATE_SHA:" in gate_workflow
    assert "github.event.inputs.candidate_sha || github.sha" in gate_workflow
    assert "ref: ${{ env.CANDIDATE_SHA }}" in gate_workflow
    assert 'git rev-parse HEAD' in gate_workflow
    assert "git ls-remote origin refs/heads/ChatGPT_Version_V0.05" in gate_workflow
    assert "PHASE GATE: PASS" in gate_workflow


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.parse_args()
    check()
    print("PHASE-05 canonical workflow source contract: PASS")
