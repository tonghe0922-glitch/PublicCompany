# PHASE-11 P012 Checkpoint

> Process: `P012` 晋升与任职发展  
> State: `CHECKPOINT_PASS / CLOSED`（施工方本地自检）  
> Next allowed process: `P013`  
> This is not an independent PHASE-11 PASS.

## Source-backed scope and invariants

- Deterministic PHASE-11 source snapshot: 18/18 XLSX, 108 sheets, 5,655 non-empty rows, SHA-256 `D21D758B6CCE42A68659A2D1711C977FFE8DAFDF56DB57234C775074F3A36C55`.
- Published workflow: S01 application/nomination → S02 eligibility/freeze → S03 1000-point assessment → S04 vacancy/budget → S05 competition review → S06 approval → S07 notice → S08 appointment/salary confirmation → S09 validation → S10 effective/rollback → END.
- Approval is not effective appointment. `APPROVE` leaves `org.employee_position` and `org.employee.primary_position_id` unchanged.
- `MAKE_EFFECTIVE` atomically closes the old primary appointment, creates the new primary appointment, synchronizes the employee projection, and appends an immutable execution fact.
- Salary and budget are external authority references only. The platform does not calculate salary or budget.

## Delivered ledger

| Dimension | Closed evidence |
|---|---|
| Trace/page | Exact routes: employee `/employee/03/03/05`, `/employee/08/09/03`; center `/center/03/08/05`, `/center/03/08/06`; shared tech `/tech/05/03/01` |
| Process/form | V121 publishes S01–S10 + END, 12 transitions and `EMP-P012-F01` |
| API | `/api/v1/processes/P012/promotion-requests` create/list/get/action with idempotency, optimistic lock, workflow tasks, data scope and audit |
| Permission | `read/manage/review/approve/appoint/monitor`; personal application and organization nomination are separated; monitor is metadata-only |
| Database | canonical `hr.promotion_request`; immutable event/execution facts; 0–1000 constraint; RLS, tenant guards, append-only and runtime grant restrictions |
| Async | `P012_PROMOTION_EVENT` notification handler only renders business number/event/node; score, salary reference and evidence are excluded |

## Reproducible gates

| Gate | Result | Log |
|---|---|---|
| 18-module compile | PASS | `.runlogs/phase11-p012-compile-3.log` |
| Empty PostgreSQL 16.14 → V121, validate/no-op and DB negatives | 3/3 PASS | `.runlogs/phase11-p012-db-2.log` |
| Worker replay, sanitization, rollback | 2/2 PASS | `.runlogs/phase11-p012-worker-it-1.log` |
| Spring API + PostgreSQL 16.14 + Redis 7.4 lifecycle | 1/1 PASS | `.runlogs/phase11-p012-api-it-2.log` |
| Web lint/typecheck | PASS / PASS | `.runlogs/phase11-p012-web-lint-final.log`, `.runlogs/phase11-p012-web-typecheck-final.log` |
| Web unit/router | 22 files / 97 tests PASS | `.runlogs/phase11-p012-web-test-final.log` |
| Three portal builds | PASS; existing ~2.013 MB chunk warning retained | `.runlogs/phase11-p012-web-build-final.log` |
| Knip | PASS | `.runlogs/phase11-p012-web-deadcode-final.log` |
| Real Chromium | desktop-chromium 1/1 PASS, test 13.0s / total 18.8s | `.runlogs/phase11-p012-browser-fixture.log`, `.runlogs/phase11-p012-playwright-1.log` |

## Normal and negative paths

Normal path covers organization nomination, all S01–S10 transitions, employee appointment confirmation, passed validation, external salary/appointment receipts and atomic effective assignment. Negative paths cover unauthenticated create, idempotent replay, stale version, cross-center list/detail isolation, tech masking/no mutation, frozen employee, score 1001, assessor/reviewer and reviewer/approver recusal, missing salary authority receipt, non-owner confirmation, cross-tenant actor/appointment references, append-only tamper, notification replay and unsupported-node rollback.

The real browser fixture containers were verified absent after shutdown. `P012 = CHECKPOINT_PASS / CLOSED`; construction may proceed only to P013.

## Stable remediation Browser revalidation（2026-08-13）

全新 Spring/PG16.14→V125/Redis7.4 fixture 下 desktop Chromium `1/1 PASS`（14.1s / 19.1s）。受控停止后 PostgreSQL `c98652fdad1e272e09195c108532b834f4c9356fcae4b8e7844ea16a4423d0c3`、Redis `c5653255f87e562c51be80c5f259f33fe73ff3d09f57b83e257a33299c62f9a9` 均 `ABSENT`，Ryuk、workspace gate process、端口均为 0。证据：`.runlogs/phase11-remediation-stable-p012-{fixture,playwright,runtime}.*`。
