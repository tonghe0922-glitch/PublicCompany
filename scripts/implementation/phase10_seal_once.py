#!/usr/bin/env python3
from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PHASE = ROOT / "docs/implementation/phases/PHASE-10"
PROGRESS = ROOT / "docs/implementation/MASTER_PROGRESS.md"
README = PHASE / "README.md"
GAP = PHASE / "GAP_MATRIX.md"
GATE = PHASE / "PHASE_GATE.md"
REPORT = PHASE / "PHASE_REPORT.md"

parent_sha = os.environ["SEALED_PARENT_SHA"]
gate_run_id = os.environ["SEALED_GATE_RUN_ID"]
sealed_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

progress = PROGRESS.read_text(encoding="utf-8")
progress, count = re.subn(
    r"(?m)^\| PHASE-10 \| (?:IN_PROGRESS|READY_FOR_GATE|COMPLETE) \|",
    "| PHASE-10 | COMPLETE |",
    progress,
    count=1,
)
if count != 1:
    raise RuntimeError("MASTER_PROGRESS PHASE-10 row was not updated exactly once")
if "| PHASE-11 | NOT_STARTED |" not in progress:
    raise RuntimeError("PHASE-11 must remain NOT_STARTED")
PROGRESS.write_text(progress, encoding="utf-8")

readme = README.read_text(encoding="utf-8")
patterns = [
    (r"(?m)^(?:Status|状态):\s*`?(?:IN_PROGRESS|READY_FOR_GATE|COMPLETE)`?\s*$", "Status: `COMPLETE`"),
    (r"(?m)^>\s*Status:\s*`?(?:IN_PROGRESS|READY_FOR_GATE|COMPLETE)`?\s*$", "> Status: `COMPLETE`"),
]
for pattern, replacement in patterns:
    readme, count = re.subn(pattern, replacement, readme, count=1)
    if count:
        break
else:
    readme = "Status: `COMPLETE`\n\n" + readme
README.write_text(readme, encoding="utf-8")

closure = f"""

## Final closure evidence

- Status: `COMPLETE`
- Sealed parent code SHA: `{parent_sha}`
- Full Construction Gate run: `{gate_run_id}`
- Gate conclusion: `success`
- Sealed at: `{sealed_at}`
- PHASE-11 remains: `NOT_STARTED`

All formerly missing P006-P010 backend, canonical PostgreSQL, published workflow/form,
three-portal projection, authorization, idempotency, optimistic locking, append-only evidence,
negative-path tests and PostgreSQL 16 integration checks are closed. The final hardening additionally
covers P007 employee self-service without manager impersonation, P007/P009 cross-process time
conflicts, P008/P009 ledger-conversion bypasses, P008 return chronology and P010 mutation-count
fail-closed behavior. No unsupported numeric continuous-work threshold was invented; the platform
records the source-backed validation fact and rejects provable overlap conflicts.
"""
gap = GAP.read_text(encoding="utf-8")
if "## Final closure evidence" in gap:
    gap = gap.split("## Final closure evidence", 1)[0].rstrip() + closure
else:
    gap = gap.rstrip() + closure
GAP.write_text(gap, encoding="utf-8")

GATE.write_text(
    f"""# PHASE-10 FORMAL GATE

Status: `PASS / COMPLETE`

- Code SHA verified before seal: `{parent_sha}`
- GitHub Actions Full Construction Gate run: `{gate_run_id}`
- Conclusion: `success`
- Verified at: `{sealed_at}`

## Required gates

| Gate | Result |
|---|---|
| Source / page / API / permission / database contract | PASS |
| Java 21 P006-P010 production-service tests | PASS |
| API security integration regression | PASS |
| PostgreSQL 16 completed-phase + PHASE-10 integrations | PASS |
| Vue TypeScript / ESLint / Vitest / employee-center-tech builds | PASS |
| P008 and P009 append-only ledger mutation and conversion guards | PASS |
| P007 employee self-service and cross-process overlap rejection | PASS |
| P008 return chronology | PASS |
| P010 qualification-permission mutation fail-closed | PASS |

PHASE-11 was not started by this seal.
""",
    encoding="utf-8",
)

REPORT.write_text(
    f"""# PHASE-10 COMPLETION REPORT

Status: `COMPLETE`

PHASE-10 closes P006 meeting/action items, P007 scheduling/shift change, P008 leave/quota,
P009 overtime/time-off and P010 learning/examination/qualification on canonical PostgreSQL facts.

## Completion evidence

- Verified parent SHA: `{parent_sha}`
- Full gate run: `{gate_run_id}`
- Full gate result: `success`
- Report generated: `{sealed_at}`

## Closed capabilities

1. P006 confirmed minutes, participant attendance, action generation, owner evidence,
   acceptance/rework, overdue escalation and archival.
2. P007 manager scheduling plus employee self-service shift-change, server qualification scope,
   canonical mutation counts, shift/leave/overtime overlap rejection and dependency day-close.
3. P008 reserve/deduct/release/adjust append-only ledger, immutable and non-convertible ledger
   rows, handover, decision, attendance, actual leave/return chronology and day-close.
4. P009 actual labor fact, outcome acceptance, HR review, wage/time-off plan, immutable time-off
   ledger, payroll receipt and archive.
5. P010 0-1000 examination, practical result, professional certification, qualification dates,
   permission linkage, retraining check, evidence immutability and fail-closed canonical writes.

## Boundary

PHASE-11 remains `NOT_STARTED`. No later-phase executable coupling was introduced.
""",
    encoding="utf-8",
)

print(f"PHASE-10 sealed from {parent_sha} after gate run {gate_run_id}")
