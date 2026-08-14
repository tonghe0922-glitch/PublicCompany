# PHASE-10 P007 Checkpoint

> Process: `P007` 排班与班次调整  
> State: `CHECKPOINT_PASS / CLOSED`（施工方本地自检）  
> Phase at P007 closure: `PHASE-10 = IN_PROGRESS`; current aggregate state is superseded by `PHASE_REPORT.md`  
> Evidence authority: `I:\PublicCompany_source_codex` current disk; no `.git`, no remote CI claim

## Source and trace closure

- Current Knowledge Base is present on disk. Raw contract extraction covers 15/15 P006–P010 workbooks, 90 sheets, 4,745 non-empty rows, zero fallback and zero failures.
- Exact sequence: S01业务量与活动需求输入 → S02班次模板匹配 → S03资格与连续工时校验 → S04主管发布排班 → S05员工确认 → S06换班/替班申请 → S07变更审批 → S08考勤与餐饮/班车联动 → S09日结 → END.
- Exact routes: employee `/employee/04/01/01`, `/employee/03/01/09`, `/employee/03/01/10`; center `/center/04/01/01`, `/center/04/07/04`, `/center/04/07/05`; tech shared workflow monitor `/tech/05/03/01`.
- Canonical facts: `attendance.shift_change_request` and `attendance.shift_change_request_item`; qualification reads the canonical `learning.learning_assignment` fact.

## Implemented business closure

- New attendance application module provides server-side create/list/get/action behavior with tenant transaction, idempotency, business number, published workflow/form/task, audit and Outbox.
- Continuous work is calculated on the server and capped at 12 hours. S03 rechecks an effective qualification and time overlap. Approved proposals are revalidated before application.
- Employee confirmation and change request are employee-only. The requesting employee cannot review their own change. Reviewer approval persists before/after snapshots and handover items; S08 persists integration receipt and S09 requires actual-attendance and evidence facts.
- Expected-version optimistic concurrency, exact idempotent replay, center/SELF scope, workflow candidates and tech field masking are enforced server-side.
- Worker consumes `P007_SHIFT_EVENT`, deduplicates recipients and creates a rendered in-app message without copying change reason, handover, snapshots or attendance detail.

## Ledger

| Dimension | P007 fact |
|---|---|
| Process | published S01–S09 + END; 15 controlled transitions |
| Page | 7 frozen source-key routes; employee/center/tech real Router bindings |
| API | schedules plus create/list/get/action under `/api/v1/processes/P007` |
| Permission | `p007.schedule.read/manage/change/review/monitor`; server authorization/data scope |
| Database | canonical shift-change master/item + V116; immutable evidence; optimistic version |
| Async | `P007_SHIFT_EVENT` → Outbox → Worker handler → NotificationService |
| Audit | list/read/create/action attempts and decisions persisted in the audit database |

## Reproducible local gates

| Gate | Result | Evidence |
|---|---|---|
| Attendance/API/Worker compile | Maven reactor compiles and API test fixture compiles; BUILD SUCCESS | `.runlogs/phase10-p007-*-compile.log` |
| PostgreSQL migration | PostgreSQL 16 applies 73 migrations through V116; validate and no-op rerun pass | `.runlogs/phase10-p007-database-it.log` |
| Worker projection | exact replay, sanitization and invalid-node rollback; 2 tests, 0 failures | `.runlogs/phase10-p007-notification-database-it.log` |
| HTTP integration | full lifecycle plus negative paths; 1 test, 0 failures, BUILD SUCCESS | `.runlogs/phase10-p007-api-integration-rerun.log` |
| Frontend unit/type/lint | 17 files / 82 tests; typecheck and lint exit 0 | `.runlogs/phase10-p007-web-*.log` |
| Chromium E2E | real API + PG16 + Redis + three Vite portals; 1 passed (17.7s) | `.runlogs/phase10-p007-playwright-pass-final.log` |

The initial API run exposed a final JDBC repository incompatible with Spring transactional CGLIB proxying; the repository proxy contract was fixed and the full integration passed. Early browser runs exposed an explicit proxy-port omission and same-origin role-session isolation issue; both failed attempts retain screenshot/video/trace, and the final run starts from a fresh database and passes.

## Normal and negative paths proved

Normal: demand → template → qualification/hours validation → publish → employee confirm → change request with handover → independent review → integration receipt → attendance day close.  
Negative: unauthenticated create, >12-hour interval, stale version, cross-center list/detail, tech sensitive-field masking, manager employee-confirm attempt, requester self-review, qualification/overlap guards, immutable item update/delete, exact event replay and invalid notification node.

## Boundary

P007 is locally self-verified and closed. P008–P010 were subsequently closed; current aggregate state is in `PHASE_REPORT.md`. This checkpoint itself did not declare an independent PASS; the later independent PHASE-10 PASS is authoritative in `PHASE_GATE.md`.
