from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    target = ROOT / path
    if not target.is_file():
        raise SystemExit(f"missing required P016 file: {path}")
    return target.read_text(encoding="utf-8")


workflow = json.loads(read("docs/implementation/phases/PHASE-11/PHASE11_WORKFLOW_CONTRACT.json"))
http = json.loads(read("docs/implementation/phases/PHASE-11/PHASE11_HTTP_PERMISSION_CONTRACT.json"))
pages = json.loads(read("docs/implementation/phases/PHASE-11/PHASE11_PAGE_BINDINGS.json"))
progress = read("docs/implementation/MASTER_PROGRESS.md")

expected_nodes = ["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08", "END"]
expected_actions = [
    "REGISTER_CARE_CASE", "VERIFY_ELIGIBILITY", "AUTHORIZE_PRIVACY", "APPROVE_CARE",
    "EXECUTE_BENEFIT", "CONFIRM_RECEIPT", "RECONCILE", "ARCHIVE",
]
expected_permissions = [
    "p016.care.create", "p016.care.read", "p016.care.review", "p016.care.execute",
    "p016.care.confirm", "p016.care.reconcile", "p016.care.monitor",
]

p016 = workflow.get("processes", {}).get("P016")
if not p016 or p016.get("nodes") != expected_nodes:
    raise SystemExit(f"P016 frozen nodes drifted: {None if not p016 else p016.get('nodes')}")
if [item.get("action") for item in p016.get("transitions", [])] != expected_actions:
    raise SystemExit("P016 frozen action order drifted")
if p016.get("form_codes", {}).get("initial") != "EMP-P016-F01":
    raise SystemExit("P016 frozen form drifted")

p016_http = http.get("processes", {}).get("P016", {})
if p016_http.get("base") != "/api/v1/processes/P016/care-cases":
    raise SystemExit("P016 HTTP base drifted")
if p016_http.get("permissions") != expected_permissions:
    raise SystemExit("P016 permission set drifted")

bindings = {item.get("portal"): item for item in pages.get("bindings", []) if item.get("process_code") == "P016"}
for portal, route, scope in (
    ("employee", "/employee/03/06/05", "SELF"),
    ("center", "/center/06/03/09", "CENTER"),
    ("tech", "/tech/01/11/04", "METADATA_ONLY"),
):
    item = bindings.get(portal)
    if not item or item.get("route_path") != route or item.get("data_scope") != scope:
        raise SystemExit(f"P016 {portal} page binding drifted: {item}")

required_files = [
    "docs/implementation/phases/PHASE-11/P016_REUSE_REVIEW.md",
    "technical-platform/database/flyway-overlays/oms/V127__phase11_p016_welfare.sql",
    "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/Phase11CareCaseService.java",
    "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/Phase11CareCaseView.java",
    "technical-platform/backend/apps/api/src/main/java/cn/shangjingu/platform/api/phase11/P016CareCaseController.java",
    "technical-platform/backend/modules/database-baseline/src/test/java/cn/shangjingu/platform/database/Phase11P016DatabaseIT.java",
    "technical-platform/web/src/platform/phase11/p016/P016CareWorkspace.vue",
    "technical-platform/web/src/router/p016-route-specs.ts",
    "technical-platform/web/src/router/p016-router.test.ts",
]
for path in required_files:
    read(path)

migration = read("technical-platform/database/flyway-overlays/oms/V127__phase11_p016_welfare.sql")
if re.search(r"create\s+table\s+(if\s+not\s+exists\s+)?welfare\.care_case\b", migration, re.I):
    raise SystemExit("V127 must not recreate welfare.care_case")
if re.search(r"create\s+table\s+[^;]*(care_case_v2|phase11_care_case|p016_case|care_case_shadow)", migration, re.I):
    raise SystemExit("P016 shadow primary table is forbidden")
for token in (
    "ALTER TABLE welfare.care_case", "current_node_code", "welfare.care_case_fact",
    "p_tenant_care_case_fact", "phase11-p016-c0-v1", "EMP-P016-F01",
    *expected_permissions,
):
    if token not in migration:
        raise SystemExit(f"V127 P016 contract is incomplete: {token}")

process = read("technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/Phase11Process.java")
if not re.search(r"\bP016\s*\(", process):
    raise SystemExit("Phase11Process.P016 is missing")
for action in expected_actions:
    if f'"{action}"' not in process:
        raise SystemExit(f"P016 executable graph missing action: {action}")

service = read("technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/Phase11CareCaseService.java")
for token in (
    "CareCaseService careCases", "Phase11WorkflowCoordinator workflow", "TransactionalOutboxService outbox",
    "executeBenefit(actor, caseId", "reconcileBenefit(actor, caseId", "REQUIRED_CLOSE_FACTS",
):
    if token not in service:
        raise SystemExit(f"P016 adapter reuse invariant missing: {token}")

controller = read("technical-platform/backend/apps/api/src/main/java/cn/shangjingu/platform/api/phase11/P016CareCaseController.java")
if '@RequestMapping("/api/v1/processes/P016/care-cases")' not in controller:
    raise SystemExit("P016 controller base drifted")
if "requestedStatus" in controller or "targetStatus" in controller:
    raise SystemExit("P016 PHASE-11 controller must never accept client target status")
for permission in expected_permissions:
    if permission not in controller:
        raise SystemExit(f"P016 controller missing frozen permission: {permission}")

routes = read("technical-platform/web/src/router/p016-route-specs.ts")
for token in (
    "/employee/03/06/05", "/center/06/03/09", "/tech/01/11/04",
    "p016.care.create", "p016.care.read", "p016.care.review", "p016.care.execute",
    "p016.care.confirm", "p016.care.reconcile", "p016.care.monitor",
):
    if token not in routes:
        raise SystemExit(f"P016 route contract missing: {token}")

workspace = read("technical-platform/web/src/platform/phase11/p016/P016CareWorkspace.vue")
for token in (
    "/api/v1/processes/P016/care-cases", "REGISTER_CARE_CASE", "VERIFY_ELIGIBILITY",
    "AUTHORIZE_PRIVACY", "APPROVE_CARE", "EXECUTE_BENEFIT", "CONFIRM_RECEIPT", "RECONCILE", "ARCHIVE",
):
    if token not in workspace:
        raise SystemExit(f"P016 web closed loop missing: {token}")
if re.search(r"localStorage|mock.*P016|requestedStatus|targetStatus", workspace, re.I):
    raise SystemExit("P016 web contains forbidden fake/target-state behavior")

if "P016_CONSTRUCTION_AUTHORIZED" not in progress and "P016 = CHECKPOINT_PASS / CLOSED" not in progress:
    raise SystemExit("MASTER_PROGRESS does not authorize or close P016")
if "PHASE-11 = COMPLETE" not in progress and re.search(r"\bP0(17|18|19|20)\s*\(", process):
    raise SystemExit("P017+ executable process introduced before PHASE-11 completion")

print("PHASE11_P016_CONTRACT_OK")
