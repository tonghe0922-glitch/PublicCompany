# PHASE-10 P009 Checkpoint

> Process: `P009` 加班与调休  
> State: `CHECKPOINT_PASS / CLOSED`（施工方本地自检）  
> Phase at P009 closure: `PHASE-10 = IN_PROGRESS`; current phase state is superseded by `PHASE_REPORT.md`  
> Evidence authority: `I:\PublicCompany_source_codex` current disk; `.git` is absent and no remote CI result is claimed

## Source and trace closure

- The supplied Knowledge Base is now present and is the source authority. `phase10_preparation_extract.py` produced a parseable deterministic snapshot from 15 P006–P010 workbooks, 90 sheets and 4,745 non-empty rows with zero fallbacks/parse failures. `--check` remains current after P009 closure; snapshot SHA-256 is `FCA53ED8312206218B0020315D5A16A41A9C5EB1490958771463A381888FFB26`.
- Source sequence is S01 事前申请/紧急事实登记 → S02 必要性与任务校验 → S03 主管审批 → S04 实际考勤与劳动事实 → S05 成果验收 → S06 人事复核 → S07 法定工资/调休方案 → S08 薪酬回执 → S09 归档 → END.
- Exact routes are employee `/employee/03/01/06`, `/employee/03/01/07`, `/employee/04/04/02`; center `/center/04/05/01`, `/center/04/05/05`, `/center/04/05/06`; tech `/tech/07/09/01`, `/tech/07/11/01`.
- Canonical persistence is `attendance.overtime_request` and `attendance.overtime_request_item`. The platform records an externally determined payroll/time-off receipt. It does not calculate salary, create a payment instruction or initiate payment.

## Implemented business closure

- Real service/repository/API implement tenant transactions, idempotent create/actions, server business numbers, published workflow/form/task execution, optimistic versioning, audit and Outbox.
- Create and S02 validation reject effective overlap across leave, effective shift-change and overtime. Emergency factual registration requires immutable evidence. The employee cannot approve, accept, perform HR review or enter their own receipt.
- S04 records the actual interval and labor/attendance fact; S05 records independent result acceptance; S06 records HR evidence and only accepts `PAYROLL`/`TIME_OFF`; S07 requires employee confirmation; S08 stores an externally supplied reference (1–32 characters) and external amount without calculation; S09 archives with evidence.
- All review, labor-fact, scheme, receipt and archive evidence is append-only at PostgreSQL trigger/grant level. Worker replay is idempotent and notifications omit private reason, labor facts, scheme, receipt and amount. Technical projections expose metadata only.

## Trace / page / process / API / permission / database ledger

| Dimension | P009 closed fact | Reproducible location |
|---|---|---|
| Trace | Current XLSX source is parsed deterministically with exact coordinate bindings | `P006_P010_SOURCE_SNAPSHOT.json`, `PHASE10_PAGE_BINDINGS.json` |
| Page | 3 employee + 3 center + 2 tech source routes; `/tech/07/11/01` safely combines P008/P009 monitors by permission | `portal-router.ts`, `P009OvertimePage.vue`, `Phase10AttendanceMonitorPage.vue` |
| Process | Published S01–S09 + END workflow with 14 controlled transitions and `EMP-P009-F01` | `V118__phase10_p009_overtime_flow.sql` |
| API | create/list/get/action under `/api/v1/processes/P009/overtime-requests` | `P009OvertimeController.java`, `OvertimeService.java` |
| Permission | `p009.overtime.submit/read/review/hr/manage/monitor`; action and data-scope checks are server-side | migration, controller, router/API tests |
| Database | canonical overtime master/item, interval index, append-only evidence trigger and runtime revokes | V118, `JdbcOvertimeRepository`, database IT |
| Async | `P009_OVERTIME_EVENT` → Outbox → Worker → sanitized in-app NotificationService message | `Phase10P009NotificationHandler`, notification database IT |
| Audit | create/list/read/action attempt and completion records written to immutable audit database | API integration test |

## Reproducible local gates

| Gate | Result | Evidence |
|---|---|---|
| Source check | deterministic/current; 15 workbooks, 90 sheets, 4,745 rows | `.runlogs/phase10-source-contract-check-p009.log` |
| Backend compile/install | 16-module compile and local dependency install BUILD SUCCESS | `.runlogs/phase10-p009-compile-rerun.log`, `.runlogs/phase10-p009-reactor-install.log` |
| Database + Worker | PostgreSQL 16.14, V118 + validate + no-op rerun; 4 tests pass | `.runlogs/phase10-p009-database-notification-rerun.log` |
| HTTP integration | real Spring + PostgreSQL 16.14 + Redis 7.4; one full lifecycle test pass | `.runlogs/phase10-p009-api-integration-rerun2.log` |
| Frontend lint/type/unit | lint/type exit 0; 19 files / 88 tests pass; exact route rerun 2 files / 6 tests | `.runlogs/phase10-p009-web-lint-final.log`, `phase10-p009-web-typecheck-rerun.log`, `phase10-p009-web-unit.log`, `phase10-p009-router-unit-final.log` |
| Frontend build/dead-code | employee/center/admin production builds pass; Knip passes; existing bundle-size warning retained | `.runlogs/phase10-p009-web-build-final.log`, `.runlogs/phase10-p009-web-deadcode.log` |
| Chromium E2E | real API + PostgreSQL 16.14 + Redis 7.4 + three Vite portals; final post-route-adjustment lifecycle passed | `.runlogs/phase10-p009-browser-fixture-final.log`, `.runlogs/phase10-p009-playwright-final.log` |

## Normal and negative paths proved

Normal: employee create/submit → manager necessity validation → independent reviewer approval → manager actual labor/attendance fact → independent result acceptance → HR review and PAYROLL route → employee scheme confirmation → HR external receipt (`PAY-EXT-*`, externally determined `125.50`) → manager archive → END. Seven immutable evidence rows and ten P009 outbox facts are asserted.

Negative: unauthenticated create; effective interval overlap; emergency record without evidence; stale version; cross-center list/detail isolation; tech private-field masking; employee self-approval, self-HR and self-receipt; unsupported notification node rollback; duplicate notification replay; evidence UPDATE/DELETE; receipt reference bounds and payment boundary.

The first database test seed used a non-canonical item column and was corrected against `attendance.overtime_request_item.master_id/item_value_json`; the first direct API test command exposed PowerShell Maven property quoting and was rerun with quoted properties; the first browser fixture exposed a stale locally installed attendance JAR, then passed after the current 16-module reactor install. All initial failures and corrected runs remain under `.runlogs`.

## Boundary

P009 is locally self-verified and closed. P010 was subsequently closed; current aggregate state is in `PHASE_REPORT.md`. This checkpoint does not declare an independent PHASE-10 PASS.
