from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    target = ROOT / path
    if not target.is_file():
        raise SystemExit(f"missing PHASE-11 full-gate artifact: {path}")
    return target.read_text(encoding="utf-8")


progress = read("docs/implementation/MASTER_PROGRESS.md")

for process in ("P011", "P012", "P013", "P014", "P015", "P016"):
    token = f"{process} = CHECKPOINT_PASS / CLOSED"
    if token not in progress:
        raise SystemExit(f"PHASE-11 cannot enter full gate before {process} closes")

if (
    "PHASE-11 = IN_PROGRESS / READY_FOR_FULL_GATE" not in progress
    and "PHASE-11 = COMPLETE / FULL_CONSTRUCTION_GATE_PASS" not in progress
):
    raise SystemExit("MASTER_PROGRESS is not in a legal PHASE-11 full-gate lifecycle state")

if "P017-P020 = PHASE-12 / NOT_STARTED / LOCKED" not in progress:
    raise SystemExit("PHASE-12 boundary must remain locked during PHASE-11 sealing")

required = [
    "docs/implementation/phases/PHASE-11/IMPACT_MATRIX.md",
    "docs/implementation/phases/PHASE-11/GAP_MATRIX.md",
    "docs/implementation/phases/PHASE-11/PHASE11_WORKFLOW_CONTRACT.json",
    "docs/implementation/phases/PHASE-11/PHASE11_HTTP_PERMISSION_CONTRACT.json",
    "docs/implementation/phases/PHASE-11/PHASE11_PAGE_BINDINGS.json",
    "docs/implementation/phases/PHASE-11/P016_REUSE_REVIEW.md",
    ".github/workflows/phase11-p011-checkpoint.yml",
    ".github/workflows/phase11-p012-checkpoint.yml",
    ".github/workflows/phase11-p013-checkpoint.yml",
    ".github/workflows/phase11-p014-checkpoint.yml",
    ".github/workflows/phase11-p015-checkpoint.yml",
    ".github/workflows/phase11-p016-checkpoint.yml",
    "technical-platform/database/flyway-overlays/oms/V122__phase11_p011_performance.sql",
    "technical-platform/database/flyway-overlays/oms/V123__phase11_p012_promotion.sql",
    "technical-platform/database/flyway-overlays/oms/V124__phase11_p013_reward.sql",
    "technical-platform/database/flyway-overlays/oms/V125__phase11_p014_discipline.sql",
    "technical-platform/database/flyway-overlays/oms/V126__phase11_p015_points.sql",
    "technical-platform/database/flyway-overlays/oms/V127__phase11_p016_welfare.sql",
]
for path in required:
    read(path)

phase11_process = read(
    "technical-platform/backend/modules/workflow/src/main/java/"
    "cn/shangjingu/platform/workflow/phase11/Phase11Process.java"
)
if re.search(r"\bP0(17|18|19|20)\s*\(", phase11_process):
    raise SystemExit("P017-P020 executable workflow drift is forbidden before PHASE-12 preparation")

for process in ("P011", "P012", "P013", "P014", "P015", "P016"):
    if not re.search(rf"\b{process}\s*\(", phase11_process):
        raise SystemExit(f"closed PHASE-11 workflow missing from executable graph: {process}")

print("PHASE11_FULL_GATE_CONTRACT_OK")
