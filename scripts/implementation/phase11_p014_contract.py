from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    target = ROOT / path
    if not target.is_file():
        raise SystemExit(f"missing required P014 file: {path}")
    return target.read_text(encoding="utf-8")


workflow_contract = json.loads(read("docs/implementation/phases/PHASE-11/PHASE11_WORKFLOW_CONTRACT.json"))
http_contract = json.loads(read("docs/implementation/phases/PHASE-11/PHASE11_HTTP_PERMISSION_CONTRACT.json"))
page_contract = json.loads(read("docs/implementation/phases/PHASE-11/PHASE11_PAGE_BINDINGS.json"))
progress = read("docs/implementation/MASTER_PROGRESS.md")
p014_closed = "P014 = CHECKPOINT_PASS / CLOSED" in progress

expected_actions = [
    "REGISTER_LEAD",
    "OPEN_INVESTIGATION",
    "RECORD_STATEMENT",
    "HEARING_DECISION",
    "SERVE_DECISION",
    "OPEN_APPEAL",
    "ASSIGN_APPEAL_REVIEWER",
    "RESOLVE_APPEAL",
    "CLOSE_NO_APPEAL",
    "CLOSE_AFTER_APPEAL",
    "REOPEN_FOR_DEFECT",
    "ARCHIVE",
]
p014_contract = workflow_contract.get("processes", workflow_contract).get("P014")
if not p014_contract:
    raise SystemExit("P014 workflow contract is missing")
contract_text = json.dumps(p014_contract, ensure_ascii=False)
for action in expected_actions:
    if action not in contract_text:
        raise SystemExit(f"P014 frozen action missing from workflow contract: {action}")
for sod in (
    "subject employee cannot investigate own case",
    "original decision maker cannot be appeal reviewer",
):
    if sod not in contract_text:
        raise SystemExit(f"P014 frozen separation-of-duty rule missing: {sod}")

required = {
    "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/DisciplineService.java": [
        "IdempotencyRegistry",
        "expectedVersion",
        "validateInvestigator",
        "validateAppealReviewer",
        "serviceProof",
        "appealEvidence",
    ],
    "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/DisciplineRepository.java": [
        "reward.discipline_case",
        "source_fact_key",
        "investigator_employee_id",
        "decision_employee_id",
        "appeal_reviewer_employee_id",
    ],
    "technical-platform/backend/apps/api/src/main/java/cn/shangjingu/platform/api/phase11/P014DisciplineController.java": [
        "/api/v1/processes/P014/discipline-cases",
        "p014.discipline.investigate",
        "p014.discipline.decide",
        "p014.discipline.appeal",
        "p014.discipline.remediate",
        "p014.discipline.monitor",
    ],
    "technical-platform/database/flyway-overlays/oms/V125__phase11_p014_discipline.sql": [
        "phase11-p014-c0-v1",
        "uq_p014_source_fact",
        "ck_p014_investigator_sod",
        "ck_p014_appeal_reviewer_sod",
        "p_tenant_discipline_case",
    ],
}
for path, tokens in required.items():
    text = read(path)
    for token in tokens:
        if token not in text:
            raise SystemExit(f"P014 contract token missing: {path}: {token}")

migration = read("technical-platform/database/flyway-overlays/oms/V125__phase11_p014_discipline.sql")
if re.search(r"(?i)CREATE\s+TABLE", migration):
    raise SystemExit("P014 shadow business table is forbidden")

process_text = read(
    "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/Phase11Process.java"
)
if not p014_closed and re.search(r"\bP015\s*\(", process_text):
    raise SystemExit("P015 executable process was introduced before P014 closure")

http_text = json.dumps(http_contract, ensure_ascii=False)
for permission in (
    "p014.discipline.create",
    "p014.discipline.read",
    "p014.discipline.investigate",
    "p014.discipline.decide",
    "p014.discipline.appeal",
    "p014.discipline.remediate",
    "p014.discipline.monitor",
):
    if permission not in http_text:
        raise SystemExit(f"P014 permission is not frozen: {permission}")

page_text = json.dumps(page_contract, ensure_ascii=False)
for route in ("/employee/02/03/09", "/center/12/02/04", "/tech/06/06/02"):
    if route not in page_text:
        raise SystemExit(f"P014 page route is not frozen: {route}")

web_config = ROOT / "technical-platform/web/src/platform/phase11/p014/p014-config.ts"
if web_config.is_file() and "targetStatus" in web_config.read_text(encoding="utf-8"):
    raise SystemExit("client target status is forbidden")

print("PHASE11_P014_CONTRACT_OK")
