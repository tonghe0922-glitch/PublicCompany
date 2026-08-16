from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    target = ROOT / path
    if not target.is_file():
        raise SystemExit(f"missing required P013 file: {path}")
    return target.read_text(encoding="utf-8")


workflow_contract = json.loads(read("docs/implementation/phases/PHASE-11/PHASE11_WORKFLOW_CONTRACT.json"))
http_contract = json.loads(read("docs/implementation/phases/PHASE-11/PHASE11_HTTP_PERMISSION_CONTRACT.json"))
page_contract = json.loads(read("docs/implementation/phases/PHASE-11/PHASE11_PAGE_BINDINGS.json"))

expected_actions = [
    "REGISTER_CONTRIBUTION",
    "VERIFY_EVIDENCE",
    "RECOMMEND_REWARD",
    "APPROVE_REWARD",
    "CHECK_DUPLICATE_IMPACT",
    "EXECUTE_REWARD",
    "NOTIFY_EMPLOYEE",
    "RECORD_RECEIPTS",
    "ARCHIVE",
]
contract_text = json.dumps(workflow_contract, ensure_ascii=False)
for action in expected_actions:
    if action not in contract_text:
        raise SystemExit(f"P013 frozen action missing from workflow contract: {action}")

required = {
    "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/RewardService.java": [
        "TransactionalOutboxService", "IdempotencyRegistry", "paidFinanceReference", "createPointEffect"
    ],
    "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/RewardRepository.java": [
        "reward.reward_case", "reward.point_transaction", "source_reward_case_id", "finance.budget_request"
    ],
    "technical-platform/backend/apps/api/src/main/java/cn/shangjingu/platform/api/phase11/P013RewardController.java": [
        "/api/v1/processes/P013/rewards", "p013.reward.create", "p013.reward.monitor"
    ],
    "technical-platform/database/flyway-overlays/oms/V124__phase11_p013_reward.sql": [
        "phase11-p013-c0-v1", "uq_p013_source_fact", "uq_p013_point_effect", "p013.reward.execute"
    ],
    "technical-platform/web/src/router/portal-route-specs.ts": [
        "/employee/08/07/02", "/center/10/10/02", "/tech/06/06/01"
    ],
}
for path, tokens in required.items():
    text = read(path)
    for token in tokens:
        if token not in text:
            raise SystemExit(f"P013 contract token missing: {path}: {token}")

migration = read("technical-platform/database/flyway-overlays/oms/V124__phase11_p013_reward.sql")
if re.search(r"(?i)CREATE\s+TABLE", migration):
    raise SystemExit("P013 shadow business table is forbidden")
if "targetStatus" in read("technical-platform/web/src/platform/phase11/p013/p013-config.ts"):
    raise SystemExit("client target status is forbidden")
if "P014" in read("technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/Phase11Process.java"):
    raise SystemExit("P014 executable process was introduced before P013 closure")

http_text = json.dumps(http_contract, ensure_ascii=False)
for permission in (
    "p013.reward.create", "p013.reward.read", "p013.reward.review",
    "p013.reward.execute", "p013.reward.monitor",
):
    if permission not in http_text:
        raise SystemExit(f"P013 permission is not frozen: {permission}")
page_text = json.dumps(page_contract, ensure_ascii=False)
for route in ("/employee/08/07/02", "/center/10/10/02", "/tech/06/06/01"):
    if route not in page_text:
        raise SystemExit(f"P013 page route is not frozen: {route}")

print("PHASE11_P013_CONTRACT_OK")
