# PHASE-11 P016 Checkpoint

> Process: `P016` 员工福利与关怀  
> State: `CHECKPOINT_PASS / CLOSED`（施工方本地自检）  
> Next allowed work: `PHASE-11 FULL CONSTRUCTION GATE`  
> This is not an independent PHASE-11 PASS. PHASE-12 remains blocked.

## Source-backed scope and invariants

- Deterministic PHASE-11 source snapshot: 18/18 XLSX, 108 sheets, 5,655 non-empty rows, SHA-256 `D21D758B6CCE42A68659A2D1711C977FFE8DAFDF56DB57234C775074F3A36C55`.
- Published workflow: S01 trigger/application → S02 eligibility validation → S03 materials/privacy authorization → S04 approval → S05 external execution receipt → S06 affected-employee confirmation → S07 independent reconciliation → S08 archive → END.
- The platform never initiates or calculates payment. It records a human-authorized decision and an immutable receipt produced by an external payment, goods-delivery or service-execution system.
- Eligibility, approval, external execution and reconciliation actors are separated. The affected employee alone authorizes privacy material and confirms receipt; technical monitoring is metadata-only.
- Source fact, external receipt and invoice references are tenant-scoped and fail closed on duplicates. Evidence/facts are append-only and the projection uses optimistic versioning.

## Delivered ledger

| Dimension | Closed evidence |
|---|---|
| Trace/page | Employee `/employee/03/06/01`, `/employee/03/06/05`; center shared supervision `/center/06/03/09` and receipt `/center/08/08/05`; shared tech monitor `/tech/05/03/01` |
| Process/form | V125 publishes S01–S08 + END, action-only transitions and `CTR-P016-F01`; S02/S08 initiator allowance remains bounded by candidate permissions, data scope and lifecycle completeness |
| API | `/api/v1/processes/P016/care-cases`; idempotency, optimistic locking, workflow task claim, data-scope authorization, audit and persistence conflict normalization |
| Permission | `read/manage/approve/execute/reconcile/monitor`; monitor cannot perform business actions; read/self and center scopes are enforced server-side |
| Database | Canonical `welfare.care_case` plus immutable eligibility, consent, approval, external execution, confirmation, reconciliation and event facts; RLS/tenant/linkage/append-only constraints |
| Async | `P016_CARE_EVENT` handler validates JSON, UUID, event/node vocabulary, recipient linkage and replay, sanitizes notification content and rolls back unsupported payloads |

## Reproducible gates

| Gate | Result | Log |
|---|---|---|
| Source contract | 18/18 XLSX, 108 sheets, 5,655 rows, deterministic snapshot frozen | `docs/implementation/phases/PHASE-11/P011_P016_SOURCE_SNAPSHOT.json` |
| Empty PostgreSQL 16.14 → V125, validate/no-op, DB negatives and Worker notification replay/sanitization/rollback | 6/6 PASS | `.runlogs/phase11-p016-db-worker-it-6.log` |
| Spring API + PostgreSQL 16.14 + Redis 7.4 lifecycle | 1/1 PASS, 19-module BUILD SUCCESS | `.runlogs/phase11-p016-api-it-4.log` |
| Browser fixture compile | 19-module BUILD SUCCESS | `.runlogs/phase11-p016-browser-fixture-compile-1.log` |
| Web lint/typecheck | PASS / PASS after retained first lint failure | `.runlogs/phase11-p016-web-lint-3.log`, `.runlogs/phase11-p016-web-typecheck-3.log` |
| Web unit/router | 26 files / 109 tests PASS | `.runlogs/phase11-p016-web-test-1.log` |
| Three portal builds | PASS; existing ~2.057 MB chunk warning retained | `.runlogs/phase11-p016-web-build-1.log` |
| Knip | PASS | `.runlogs/phase11-p016-web-deadcode-1.log` |
| Real Chromium | desktop-chromium 1/1 PASS, test 11.6s / total 16.4s | `.runlogs/phase11-p016-browser-fixture-2.log`, `.runlogs/phase11-p016-playwright-4.log` |
| Fixture cleanup | Exact PostgreSQL and Redis IDs both `ABSENT` | `.runlogs/phase11-p016-fixture-cleanup-1.log` |

## Normal and negative paths

Normal paths cover manager creation/submission, independent eligibility validation, employee privacy authorization, independent approval, externally authorized receipt recording, employee confirmation, independent reconciliation and manager archive. The same persisted case is presented through all five source-bound routes, with shared center/tech routes retaining least privilege.

Negative paths cover unauthenticated creation, technical-monitor business denial and masking, cross-center list/detail isolation, invalid UUID, stale version, duplicate source fact, manager privacy/receipt self-action rejection, eligibility actor approval rejection, approver execution rejection, executor reconciliation rejection, invalid candidate UUID fail-closed behavior, append-only/RLS/tenant linkage, replay-safe notification and unsupported-node rollback. Tests also assert no payment aggregate/outbox is created.

The first lint failure, first fixture classpath failure and first three Playwright failures are retained. They were corrected without rule suppression or production-boundary weakening: the current reactor snapshot was installed for the fixture, and E2E identifiers/refresh behavior were made repeatable. Final Testcontainers are absent. `P016 = CHECKPOINT_PASS / CLOSED`; PHASE-11 remains `IN_PROGRESS / FULL_GATE_PENDING` until independent review.

## Stable remediation Browser revalidation（2026-08-13）

全新 Spring/PG16.14→V125/Redis7.4 fixture 下 desktop Chromium `1/1 PASS`（13.7s / 18.4s）。PostgreSQL `d9812cb2719d873e5b651c35468e5aff2f69649b43e2be8fdb31427c7ef52fa5`、Redis `daca6712a910e02a22cd9aa23dc8fc83ae0bfc10f3af1adf201ae31eb85edbb0` 均 `ABSENT`；首次 cleanup 快照保留 Ryuk=1，5 秒后 `runtime-rerun2` 复核全 0。证据：`.runlogs/phase11-remediation-stable-p016-*`。阶段状态保持 `CONSTRUCTION_COMPLETE / INDEPENDENT_GATE_PENDING`。
