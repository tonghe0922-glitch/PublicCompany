from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    target = ROOT / path
    if not target.is_file():
        raise SystemExit(f"missing required P015 file: {path}")
    return target.read_text(encoding="utf-8")


workflow = json.loads(read("docs/implementation/phases/PHASE-11/PHASE11_WORKFLOW_CONTRACT.json"))
http = json.loads(read("docs/implementation/phases/PHASE-11/PHASE11_HTTP_PERMISSION_CONTRACT.json"))
pages = json.loads(read("docs/implementation/phases/PHASE-11/PHASE11_PAGE_BINDINGS.json"))
db_contract = read("docs/implementation/phases/PHASE-11/DATABASE_CONTRACT.md")
decisions = read("docs/implementation/contracts/phase-11/C0_DECISION_LOG.md")
progress = read("docs/implementation/MASTER_PROGRESS.md")
p015_closed = "P015 = CHECKPOINT_PASS / CLOSED" in progress

expected_nodes = ["S01","S02","S03","S04","S05","S06","S07","S08","S09","S10","END"]
expected_actions = [
    "REGISTER_EVENT","VALIDATE_SOURCE","CHECK_DUPLICATE","MATCH_RULE_VERSION","CALCULATE_POINTS",
    "CLASSIFY_RISK","POST_OR_REVIEW","NOTIFY_EMPLOYEE","ADJUST_OR_REVERSE","RECALCULATE_BALANCE",
]
p015 = workflow.get("processes", {}).get("P015")
if not p015:
    raise SystemExit("P015 workflow contract is missing")
if p015.get("nodes") != expected_nodes:
    raise SystemExit(f"P015 node order drifted: {p015.get('nodes')}")
actual_actions = [item.get("action") for item in p015.get("transitions", [])]
if actual_actions != expected_actions:
    raise SystemExit(f"P015 action order drifted: {actual_actions}")
if p015.get("form_codes", {}).get("initial") != "CTR-P015-F01":
    raise SystemExit("P015 initial form must remain CTR-P015-F01")

for token in (
    "P015 | `reward.point_transaction` | V126",
    "主流水禁止 UPDATE/DELETE",
    "reversal_of_id",
):
    if token not in db_contract:
        raise SystemExit(f"P015 database contract drifted: {token}")
for token in (
    "积分事实 append-only",
    "ADJUST/REVERSAL",
):
    if token not in decisions:
        raise SystemExit(f"P015 C0 decision missing: {token}")

required = {
    "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/PointLedgerService.java": [
        "originalPostingAbsent", "publishedRule", "Math.negateExact", "ADJUST", "REVERSAL",
        "RECALCULATE_BALANCE", "expectedVersion",
    ],
    "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/PointLedgerRepository.java": [
        "reward.point_transaction", "point_source_guard", "point_rule_version", "point_balance_snapshot",
        "mergeWorkflowContext", "reversal_of_id",
    ],
    "technical-platform/backend/apps/api/src/main/java/cn/shangjingu/platform/api/phase11/P015PointsController.java": [
        "/api/v1/processes/P015/points", "p015.points.create", "p015.points.read", "p015.points.review",
        "p015.points.reverse", "p015.points.monitor",
    ],
    "technical-platform/database/flyway-overlays/oms/V126__phase11_p015_points.sql": [
        "phase11-p015-c0-v1", "CTR-P015-F01", "trg_p015_point_transaction_immutable",
        "uq_p015_source_post", "uq_p015_single_reversal", "point_rule_version", "point_source_guard",
        "point_balance_snapshot",
    ],
}
for path, tokens in required.items():
    text = read(path)
    for token in tokens:
        if token not in text:
            raise SystemExit(f"P015 contract token missing: {path}: {token}")

migration = read("technical-platform/database/flyway-overlays/oms/V126__phase11_p015_points.sql")
if re.search(r"insert\s+into\s+reward\.point_rule_version", migration, re.I):
    raise SystemExit("V126 must not invent or seed point-rule values not frozen by source evidence")
if re.search(r"create\s+table\s+[^;]*(phase11|p015_point_case|point_transaction_shadow)", migration, re.I):
    raise SystemExit("P015 shadow primary table is forbidden")
for action in expected_actions:
    if f"'{action}'" not in migration:
        raise SystemExit(f"P015 migration workflow action missing: {action}")

process = read("technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/Phase11Process.java")
for action in expected_actions:
    if f'"{action}"' not in process:
        raise SystemExit(f"P015 executable action missing: {action}")
if not p015_closed and re.search(r"\bP016\s*\(", process):
    raise SystemExit("P016 executable process introduced before P015 closure")

p015_http = http.get("processes", {}).get("P015", {})
if p015_http.get("base") != "/api/v1/processes/P015/points":
    raise SystemExit("P015 API base drifted")
expected_permissions = [
    "p015.points.create","p015.points.read","p015.points.review","p015.points.reverse","p015.points.monitor",
]
if p015_http.get("permissions") != expected_permissions:
    raise SystemExit(f"P015 permission contract drifted: {p015_http.get('permissions')}")

page_text = json.dumps(pages, ensure_ascii=False)
for route in ("/employee/08/06/04", "/center/10/09/06", "/tech/06/06/03"):
    if route not in page_text:
        raise SystemExit(f"P015 page route is not frozen: {route}")

web_root = ROOT / "technical-platform/web/src/platform/phase11/p015"
if web_root.is_dir():
    for target in web_root.rglob("*"):
        if target.is_file() and "targetStatus" in target.read_text(encoding="utf-8"):
            raise SystemExit(f"client target status is forbidden: {target.relative_to(ROOT)}")

print("PHASE11_P015_CONTRACT_OK")
