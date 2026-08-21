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
decision_log = read("docs/implementation/contracts/phase-11/C0_DECISION_LOG.md")
progress = read("docs/implementation/MASTER_PROGRESS.md")
p014_closed = "P014 = CHECKPOINT_PASS / CLOSED" in progress

expected_nodes = [
    "S01", "S02", "S03", "S04", "S05", "S06", "S07",
    "S08", "S09", "S10", "S11", "S12", "END",
]
expected_actions = [
    "REGISTER_LEAD",
    "APPLY_SAFETY_MEASURE",
    "COMPLETE_INVESTIGATION",
    "SUBMIT_DEFENSE",
    "COMPLETE_RESPONSIBILITY_REVIEW",
    "APPROVE_DECISION",
    "ACKNOWLEDGE_SERVICE",
    "EXECUTE_IMPACTS",
    "RESOLVE_APPEAL",
    "CLOSE_CORE_CASE",
    "COMPLETE_OBSERVATION",
    "ARCHIVE",
]
p014_contract = workflow_contract.get("processes", {}).get("P014")
if not p014_contract:
    raise SystemExit("P014 workflow contract is missing")
if p014_contract.get("nodes") != expected_nodes:
    raise SystemExit(f"P014 frozen node order drifted: {p014_contract.get('nodes')}")
actual_actions = [transition.get("action") for transition in p014_contract.get("transitions", [])]
if actual_actions != expected_actions:
    raise SystemExit(f"P014 frozen action order drifted: {actual_actions}")
if p014_contract.get("form_codes", {}).get("initial") != "CTR-P014-F01":
    raise SystemExit("P014 initial form must remain CTR-P014-F01")

for decision in (
    "仅客户来源案件可选关联",
    "来源事实键和影响项必须防重复",
    "调查、决定、申诉复核必须执行回避",
    "被调查人、原决定人不得担任对应独立复核人",
):
    if decision not in decision_log:
        raise SystemExit(f"P014 C0 decision missing: {decision}")

required = {
    "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/DisciplineService.java": [
        "IdempotencyRegistry",
        "expectedVersion",
        "validateInvestigator",
        "validateDecisionMaker",
        "validateAppealReviewer",
        "serviceProof",
        "appealDecisionEvidence",
    ],
    "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/DisciplineRepository.java": [
        "reward.discipline_case",
        "source_fact_key",
        "investigator_employee_id",
        "decision_employee_id",
        "appeal_reviewer_employee_id",
        "observation_completed_at",
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
        "phase11-p014-c0-v2",
        "CTR-P014-F01",
        "uq_p014_source_fact",
        "ck_p014_investigator_sod",
        "ck_p014_decision_sod",
        "ck_p014_appeal_reviewer_sod",
        "p_tenant_discipline_case",
    ],
    "technical-platform/web/src/platform/phase11/p014/P014DisciplineWorkspace.vue": [
        "/api/v1/processes/P014/discipline-cases",
        "expectedVersion",
        "idempotencyKey",
        "SUBMIT_DEFENSE",
        "ACKNOWLEDGE_SERVICE",
        "RESOLVE_APPEAL",
        "portal !== 'tech'",
    ],
}
for path, tokens in required.items():
    text = read(path)
    for token in tokens:
        if token not in text:
            raise SystemExit(f"P014 contract token missing: {path}: {token}")

process_text = read(
    "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/Phase11Process.java"
)
for action in expected_actions:
    if f'"{action}"' not in process_text:
        raise SystemExit(f"P014 executable action missing from Phase11Process: {action}")
if not p014_closed and re.search(r"\bP015\s*\(", process_text):
    raise SystemExit("P015 executable process was introduced before P014 closure")

migration = read("technical-platform/database/flyway-overlays/oms/V125__phase11_p014_discipline.sql")
if re.search(r"(?i)CREATE\s+TABLE", migration):
    raise SystemExit("P014 shadow business table is forbidden")
for action in expected_actions:
    if f"'{action}'" not in migration:
        raise SystemExit(f"P014 migration workflow action missing: {action}")

p014_http = http_contract.get("processes", {}).get("P014", {})
if p014_http.get("base") != "/api/v1/processes/P014/discipline-cases":
    raise SystemExit("P014 API base drifted")
expected_permissions = [
    "p014.discipline.create",
    "p014.discipline.read",
    "p014.discipline.investigate",
    "p014.discipline.decide",
    "p014.discipline.appeal",
    "p014.discipline.remediate",
    "p014.discipline.monitor",
]
if p014_http.get("permissions") != expected_permissions:
    raise SystemExit(f"P014 permission contract drifted: {p014_http.get('permissions')}")

page_text = json.dumps(page_contract, ensure_ascii=False)
route_spec = read("technical-platform/web/src/router/p014-route-specs.ts")
router = read("technical-platform/web/src/router/portal-router.ts")
for route, name in (
    ("/employee/02/03/09", "p014-discipline-self-service"),
    ("/center/12/02/04", "p014-discipline-management"),
    ("/tech/06/06/02", "p014-discipline-monitor"),
):
    if route not in page_text:
        raise SystemExit(f"P014 page route is not frozen: {route}")
    if route not in route_spec or name not in route_spec:
        raise SystemExit(f"P014 executable route binding missing: {route} -> {name}")
if "p014.discipline.monitor" not in route_spec:
    raise SystemExit("P014 technical metadata route must require monitor permission")
if "P014_ROUTE_SPECS" not in router or "...P014_ROUTE_SPECS" not in router:
    raise SystemExit("P014 executable route specs are not registered by portal router")

web_root = ROOT / "technical-platform/web/src/platform/phase11/p014"
for target in web_root.rglob("*"):
    if target.is_file() and "targetStatus" in target.read_text(encoding="utf-8"):
        raise SystemExit(f"client target status is forbidden: {target.relative_to(ROOT)}")

print("PHASE11_P014_CONTRACT_OK")
