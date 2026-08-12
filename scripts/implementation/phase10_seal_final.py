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

code_sha = os.environ["SEALED_CODE_SHA"]
code_gate_run_id = os.environ["SEALED_CODE_GATE_RUN_ID"]
sealed_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

required_files = [
    ROOT / "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/ShiftChangeService.java",
    ROOT / "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/GuardedShiftChangeRepository.java",
    ROOT / "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/GuardedLeaveRepository.java",
    ROOT / "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/GuardedOvertimeRepository.java",
    ROOT / "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/GuardedLearningRepository.java",
    ROOT / "technical-platform/database/flyway-overlays/oms/V120__phase10_ledger_and_temporal_hardening.sql",
    ROOT / "technical-platform/backend/modules/workflow/src/test/java/cn/shangjingu/platform/workflow/Phase10HardeningTest.java",
    ROOT / "technical-platform/backend/modules/database-baseline/src/test/java/cn/shangjingu/platform/database/hardening/Phase10DatabaseIntegrationIT.java",
]
for path in required_files:
    if not path.is_file() or path.stat().st_size == 0:
        raise RuntimeError(f"required PHASE-10 hardening file missing: {path.relative_to(ROOT)}")

progress = PROGRESS.read_text(encoding="utf-8")
progress, count = re.subn(
    r"(?m)^\|\s*PHASE-10\s*\|\s*(?:IN_PROGRESS|READY_FOR_GATE|COMPLETE)\s*\|",
    "| PHASE-10 | COMPLETE |",
    progress,
    count=1,
)
if count != 1:
    raise RuntimeError("MASTER_PROGRESS PHASE-10 row was not updated exactly once")
if not re.search(r"(?m)^\|\s*PHASE-11\s*\|\s*NOT_STARTED\s*\|", progress):
    raise RuntimeError("PHASE-11 must remain NOT_STARTED")
PROGRESS.write_text(progress, encoding="utf-8")

readme = README.read_text(encoding="utf-8")
status_patterns = [
    r"(?m)^Status:\s*`?(?:IN_PROGRESS|READY_FOR_GATE|COMPLETE)`?\s*$",
    r"(?m)^状态[:：]\s*`?(?:IN_PROGRESS|READY_FOR_GATE|COMPLETE)`?\s*$",
    r"(?m)^>\s*Status:\s*`?(?:IN_PROGRESS|READY_FOR_GATE|COMPLETE)`?\s*$",
]
for pattern in status_patterns:
    readme, count = re.subn(pattern, "Status: `COMPLETE`", readme, count=1)
    if count:
        break
else:
    readme = "Status: `COMPLETE`\n\n" + readme
README.write_text(readme, encoding="utf-8")

GAP.write_text(
    f"""# PHASE-10 GAP MATRIX

Status: `COMPLETE / CLOSED`

| Area | P006 | P007 | P008 | P009 | P010 | Closure evidence |
|---|---|---|---|---|---|---|
| Authoritative XLSX and explicit page bindings | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | 15 workbooks / 90 sheets / 4,745 rows; explicit source-key routes |
| Canonical PostgreSQL primary facts | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | Reuses collaboration, attendance and learning canonical tables; no shadow business tables |
| Controller / application service / JDBC repository | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | Production HTTP, service and repository paths are executable |
| Employee / center / tech projections | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | Employee self-service, center management and tech metadata-only monitoring are route-bound |
| Server permission and data scope | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | AuthorizationService and canonical owner/center/employee targets fail closed |
| Idempotency / request hash / optimistic version | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | Every write is server-guarded; stale versions and illegal actions are rejected |
| Published workflow / form / task | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | Source-backed S01-END graphs are installed and PostgreSQL-tested |
| Audit / outbox / notification integration | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | Shared immutable audit and transactional outbox kernels are reused |
| Time-overlap protection | N/A | COMPLETE | COMPLETE | COMPLETE | N/A | P007/P008/P009 read canonical shift, leave and overtime facts and reject proven overlap |
| Append-only ledger / evidence | N/A | N/A | COMPLETE | COMPLETE | COMPLETE | Ledger/evidence rows reject update, delete and ordinary-row conversion |
| Process-specific closure | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | Minutes/actions; schedule/change/linkage; quota/leave chronology; labor/HR/payroll; exam/certification/qualification/permission |
| Java service tests | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | Positive, negative, stale, fail-closed and self-service behavior is executable |
| PostgreSQL 16 integration | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | Baseline plus overlays V115-V120 migrate and validate in Testcontainers |
| Vue / TypeScript / route tests / three builds | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | Typecheck, lint, Vitest and employee/center/tech builds pass |

## Final closure evidence

- Business-code SHA: `{code_sha}`
- Business-code Full Construction Gate run: `{code_gate_run_id}`
- Gate conclusion: `success`
- Sealed at: `{sealed_at}`
- PHASE-11: `NOT_STARTED`

P007 records the source-backed continuous-work validation fact and rejects every overlap that the
canonical data can prove. No unsupported statutory or product threshold was invented.
""",
    encoding="utf-8",
)

GATE.write_text(
    f"""# PHASE-10 FORMAL GATE

Status: `PASS / COMPLETE`

- Verified business-code SHA: `{code_sha}`
- Full Construction Gate run: `{code_gate_run_id}`
- Gate conclusion: `success`
- Seal generated: `{sealed_at}`

## Gate results

| Gate | Result |
|---|---|
| Source / page / API / permission / canonical database contract | PASS |
| Java 21 P006-P010 production-service behavior | PASS |
| API security integration regression | PASS |
| PostgreSQL 16 completed-phase and PHASE-10 integration profiles | PASS |
| Vue TypeScript / ESLint / Vitest / employee-center-tech builds | PASS |
| P007 employee self-service without manager impersonation | PASS |
| P007/P008/P009 canonical cross-process overlap protection | PASS |
| P008/P009 append-only ledger update/delete/conversion protection | PASS |
| P008 actual leave and return chronology | PASS |
| P010 qualification and permission-link canonical writes fail closed | PASS |

The one-shot seal workflow separately requires the final documentation commit itself to pass the
same Full Construction Gate. On failure it restores PHASE-10 to its pre-seal status. PHASE-11 is not started.
""",
    encoding="utf-8",
)

REPORT.write_text(
    f"""# PHASE-10 COMPLETION REPORT

Status: `COMPLETE`

PHASE-10 closes P006 meeting/action items, P007 scheduling/shift change, P008 leave/quota,
P009 overtime/time-off and P010 learning/examination/qualification on canonical PostgreSQL facts.

## Evidence

- Verified business-code SHA: `{code_sha}`
- Business-code Full Construction Gate run: `{code_gate_run_id}`
- Result: `success`
- Generated: `{sealed_at}`

## Closed capabilities

1. **P006** — confirmed minutes, participant attendance, action generation, owner evidence,
   acceptance/rework, overdue escalation and archival.
2. **P007** — manager scheduling, employee self-service shift change, active employee scope,
   exact mutation counts, shift/leave/overtime overlap rejection, linkage and day-close.
3. **P008** — reserve/deduct/release/adjust append-only ledger, conversion-proof ledger rows,
   handover, decision, attendance, actual leave/return chronology and day-close.
4. **P009** — actual labor fact, result acceptance, HR review, wage/time-off plan, immutable
   time-off ledger, payroll receipt and archival.
5. **P010** — 0-1000 examination, practical assessment, professional certification,
   qualification dates, server permission linkage, retraining check and immutable evidence.

## Testing closure

The full gate runs Java 21 unit tests, legacy API security regression, all required PostgreSQL 16
integration profiles, contract and repository hygiene checks, Vue typecheck, ESLint, Vitest and all
three portal builds. Hardening tests additionally prove P007 self-service, canonical cross-process
conflicts, P008/P009 ledger-conversion rejection, P008 chronology and P010 fail-closed writes.

## Boundary

No unsupported continuous-work numeric threshold was invented. PHASE-11 remains `NOT_STARTED`.
""",
    encoding="utf-8",
)

print(f"PHASE-10 seal documents generated from {code_sha} / run {code_gate_run_id}")
