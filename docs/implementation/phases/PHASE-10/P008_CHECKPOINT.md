# PHASE-10 P008 Checkpoint

> Process: `P008` 请假与考勤  
> State: `CHECKPOINT_PASS / CLOSED`（施工方本地自检）  
> Phase at P008 closure: `PHASE-10 = IN_PROGRESS`; current aggregate state is superseded by `PHASE_REPORT.md`  
> Evidence authority: `I:\PublicCompany_source_codex` current disk; `.git` is absent and no remote CI result is claimed

## Source and trace closure

- The current Knowledge Base on disk is authoritative. `phase10_preparation_extract.py` was rerun after the source files were supplied: 15/15 P006–P010 XLSX files, 90 sheets, 4,745 non-empty rows, zero fallback and zero parse failures. The resulting JSON is parseable and deterministic under `--check`; SHA-256 at closure was `FCA53ED8312206218B0020315D5A16A41A9C5EB1490958771463A381888FFB26`.
- Exact source sequence: S01 请假申请 → S02 假期额度预占 → S03 工作交接与代理 → S04 审批 → S05 预占转扣减/驳回释放 → S06 排班与考勤标记 → S07 实际休假 → S08 销假/提前返岗/变更 → S09 差额账本调整 → S10 考勤日结与归档 → END.
- Exact routes: employee `/employee/03/01/01`, `/employee/04/03/02`, `/employee/03/01/02`; center `/center/04/04/01`, `/center/04/04/03`, `/center/04/04/06`; tech `/tech/07/11/01` plus shared workflow monitor `/tech/05/03/01`.
- Canonical facts are `attendance.leave_request`, `attendance.leave_request_item`, and additive `attendance.leave_quota_ledger`. External HR `GRANT` is a prerequisite; P008 never self-grants entitlement.

## Implemented business closure

- Attendance application, JDBC repository and API provide tenant transactions, idempotent create/actions, server business numbers, published workflow/form/task execution, optimistic versioning, immutable audit, Outbox and Worker notification projection.
- The server calculates duration, rejects effective time overlap, preserves employee-only submit/handover/return actions, forbids employee self-review, and requires a separately authorized reviewer at S04.
- Quota changes only through append-only `GRANT / RESERVE / RELEASE / DEDUCT / ADJUST` rows. SQL constraints enforce legal delta shapes, conservation and non-negative balances; an advisory transaction lock serializes an employee/account ledger.
- PostgreSQL trigger and RLS rules enforce tenant/employee linkage, immutable quota/evidence rows, tenant isolation and runtime least privilege. Tech projections hide reason, handover, account ID, return time and attendance facts.
- Worker consumes `P008_LEAVE_EVENT`, accepts only controlled node events, deduplicates recipients/replay, and emits sanitized in-app notification/outbox facts without private leave content.

## Trace / page / process / API / permission / database ledger

| Dimension | P008 closed fact | Reproducible location |
|---|---|---|
| Trace | Current XLSX source, hashes, rows and sheets parsed with no fallback; exact page source keys frozen | `P006_P010_SOURCE_SNAPSHOT.json`, `PHASE10_PAGE_BINDINGS.json` |
| Page | 3 employee + 3 center + 1 dedicated tech route; shared tech workflow monitor; all real Router bindings | `technical-platform/web/src/router/portal-router.ts`, `P008LeavePage.vue` |
| Process | Published S01–S10 + END workflow with 17 controlled transitions and published `EMP-P008-F01` | `V117__phase10_p008_leave_quota.sql` |
| API | create/list/get/quota-ledger/action namespace under `/api/v1/processes/P008` | `P008LeaveController.java`, phase-10 HTTP contract |
| Permission | `p008.leave.submit/read/review/manage/monitor`; authoritative action and data-scope checks | controller, migration and router tests |
| Database | canonical leave master/item plus append-only quota ledger; RLS, shape/conservation constraints, tenant guard | V117 and `Phase10P008DatabaseIT` |
| Async | `P008_LEAVE_EVENT` → Outbox → Worker handler → sanitized NotificationService message | `Phase10P008NotificationHandler`, database IT |
| Audit | create/list/read/quota/action attempt and completion records in immutable audit database | API integration and browser lifecycle |

## Reproducible local gates

| Gate | Result | Evidence |
|---|---|---|
| Source regeneration/check | 15 XLSX, 90 sheets, 4,745 rows, 0 failures; deterministic/current | `.runlogs/phase10-source-contract-regenerate.log`, `.runlogs/phase10-source-contract-check.log` |
| Backend reactor compile | 16 modules BUILD SUCCESS | `.runlogs/phase10-p008-backend-compile-initial.log`, `.runlogs/phase10-p008-browser-fixture-compile.log` |
| PostgreSQL migration | PostgreSQL 16.14 applies 74 migrations through V117; validate and no-op rerun pass | `.runlogs/phase10-p008-v117-migration-probe-pass.log` |
| Database + Worker | 4 tests, 0 failures/errors; RLS/tamper/conservation/replay/sanitization | `.runlogs/phase10-p008-database-notification-pass.log` |
| HTTP integration | real Spring API + PostgreSQL16 + Redis7.4; 1 P008 integration and 17 API unit tests; reactor BUILD SUCCESS | `.runlogs/phase10-p008-api-integration-pass-final.log` |
| Frontend lint/type/unit | lint/type exit 0; 18 files / 85 tests pass | `.runlogs/phase10-p008-web-lint.log`, `phase10-p008-web-typecheck.log`, `phase10-p008-web-unit.log` |
| Frontend build/dead-code | employee/center/admin production builds and Knip pass; bundle-size warning retained | `.runlogs/phase10-p008-web-build.log`, `.runlogs/phase10-p008-web-deadcode.log` |
| Chromium E2E | real API + PG16.14 + Redis7.4 + three Vite portals; 1 passed in 18.4s | `.runlogs/phase10-p008-browser-fixture-pass.log`, `.runlogs/phase10-p008-playwright-rerun.log` |

## Normal and negative paths proved

Normal: employee create → submit → manager reserve → employee handover → independent reviewer approve → manager deduct → attendance mark → actual leave start → employee early return → manager quota adjustment → day close → END. The external 16-hour grant finishes at available 10, reserved 0, consumed 6 after an actual six-hour leave.

Negative: unauthenticated create; interval overlap; stale version; cross-center list/detail isolation; tech private-field masking; employee self-review; insufficient/non-negative quota protection; forged cross-tenant/cross-employee ledger link; ledger/evidence UPDATE/DELETE; illegal quota delta shape; duplicate notification replay and invalid notification node.

The first migration probe found a composite-FK assumption unsupported by the canonical master key and was corrected to a single-key FK plus explicit tenant/employee trigger. The first Worker database run found a notification-template column mismatch and was corrected against the canonical schema. The first browser attempt found only a strict locator ambiguity before any business row was created; its screenshot/video/trace remain in `technical-platform/web/test-results`, and the narrowed locator passed against a real lifecycle.

## Boundary

P008 is locally self-verified and closed. P009 and P010 were subsequently closed; current aggregate state is in `PHASE_REPORT.md`. This checkpoint itself did not declare an independent PASS; the later independent PHASE-10 PASS is authoritative in `PHASE_GATE.md`.
