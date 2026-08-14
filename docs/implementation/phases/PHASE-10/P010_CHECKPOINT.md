# PHASE-10 P010 Checkpoint

> Process: `P010` Employee learning, examination and qualification  
> State: `CHECKPOINT_PASS / CLOSED` (constructor local self-verification)  
> Phase at local closure: `LOCAL_CONSTRUCTION_COMPLETE / INDEPENDENT_REVIEW_PENDING`; superseded by independent PASS in `PHASE_GATE.md`  
> Evidence authority: `I:\PublicCompany_source_codex` current disk; `.git` is absent and no remote CI result is claimed

## Source and trace closure

- The supplied Knowledge Base is present and authoritative. After the Knowledge Base refresh, the deterministic P006–P010 snapshot remains 15 raw workbooks, 90 sheets, 4,745 non-empty rows, zero cache fallback/parse failures, SHA-256 `FCA53ED8312206218B0020315D5A16A41A9C5EB1490958771463A381888FFB26`; the refreshed `--check` passed.
- Exact source flow is S01 version publication → S02 risk-based assignment → S03 employee learning → S04 1000-point exam → S05 offline practical → S06 supervisor/professional certification → S07 qualification effective → S08 position permission linkage → S09 expiry retraining/recertification → S10 archive → END.
- Exact routes are employee `/employee/07/01/01`, `/employee/07/04/02`, `/employee/07/05/01`, `/employee/07/06/01`; center `/center/06/03/07`, `/center/10/08/03`, `/center/10/08/07`; tech `/tech/05/03/01`, `/tech/03/03/09`.
- Canonical persistence remains `learning.learning_assignment`. V119 adds only missing immutable history, pre-approved policy and executed-grant facts.

## Implemented business closure

- A real `platform-learning` module provides tenant transactions, idempotency, server business numbers, published Workflow/Form/Task runtime, optimistic versioning, audit and Outbox.
- Learning completion, 0–1000 examination, offline practical, independent professional certification, dated qualification, permission linkage, recertification scheduling and archive are separate server facts. The practical assessor cannot certify the same assignment; the learner and technical monitor cannot certify.
- Permission linkage is fail-closed: an API caller cannot name an arbitrary permission. S08 reads an enabled course-version policy with approval reference/approver/timestamp and writes an immutable per-user/identity grant bounded by qualification dates. Unified authorization reads only active, in-date qualification grants. No policy or an expired qualification rejects linkage/authorization.
- P010 events and executed qualification grants reject UPDATE/DELETE at PostgreSQL trigger and runtime-grant level. Database guards also reject cross-tenant event/policy/grant references and require an executed grant to match the enabled policy, course version, permission, data scope, identity and qualification dates. Worker replay is idempotent; notifications contain workflow metadata only. Technical projections omit reason, learner profile, score, practical result, qualification dates and events.

## Trace / page / process / API / permission / database ledger

| Dimension | Closed fact | Reproducible location |
|---|---|---|
| Trace | deterministic XLSX snapshot and exact coordinate bindings | `P006_P010_SOURCE_SNAPSHOT.json`, `PHASE10_PAGE_BINDINGS.json` |
| Page | 4 employee + 3 center + 2 tech exact routes; shared workflow monitor preserves per-process permissions | `P010LearningPage.vue`, `portal-router.ts`, `Phase09TechWorkflowMonitorPage.vue` |
| Process | published S01–S10 + END, 10 forward transitions and `CTR-P010-F01` | `V119__phase10_p010_learning_qualification_flow.sql` |
| API | create/list/get/action at `/api/v1/processes/P010/learning-assignments` | `P010LearningController.java`, `LearningAssignmentService.java` |
| Permission | `read/manage/complete/exam/certify/link/monitor`; action + data-scope enforcement server-side | migration, controller, API/route tests |
| Database | canonical master plus immutable event, approved policy and dated executed grant | V119, `JdbcLearningAssignmentRepository`, database IT |
| Authorization | active dated qualification grants participate in the unified authorization snapshot | `JdbcIdentityDirectoryAdapter.java`, API integration assertion |
| Async/Audit | `P010_LEARNING_EVENT` → Worker → sanitized notification; create/read/action audit | handler, notification database IT, API IT |

## Reproducible local gates

| Gate | Result | Evidence |
|---|---|---|
| Source check | deterministic/current after Knowledge Base refresh | `.runlogs/phase10-source-contract-check-p010-kb-refresh.log` |
| Backend compile/install/regression | 17-module compile/install success; API+Worker reactor unit tests success | `.runlogs/phase10-p010-compile.log`, `phase10-p010-reactor-install.log`, `phase10-p010-backend-unit-regression.log` |
| Database + Worker | PG 16.14, V119, validation/no-op; 6/6 DB and notification tests pass | `.runlogs/phase10-p010-database-notification-final.log` |
| HTTP integration | real Spring + PG 16.14 + Redis 7.4 full lifecycle pass after the final V119 guards | `.runlogs/phase10-p010-api-integration-final.log` |
| Frontend | lint/type pass; 20 files/91 tests; three production builds; Knip pass | `.runlogs/phase10-p010-web-lint.log`, `phase10-p010-web-typecheck.log`, `phase10-p010-web-unit.log`, `phase10-p010-web-build.log`, `phase10-p010-web-deadcode.log` |
| Chromium E2E | real API + PG16 + Redis + employee/center/tech Vite portals; one full lifecycle pass | `.runlogs/phase10-p010-browser-fixture.log`, `.runlogs/phase10-p010-playwright.log` |

## Normal and negative paths proved

Normal: center publication/create → publish → risk assignment → employee learning → 886/1000 exam → independent offline practical → different professional certifier → qualification effective/current+365 days → server executes approved `qualified.safety.access` policy → session authorization contains that permission → recertification scheduled before expiry → archive → END. Eleven immutable P010 event rows, one active dated qualification grant and eleven outbox events are asserted.

Negative: unauthenticated create; stale version; cross-center list/detail; tech field masking; center attempting learner action; score 1001; assessor self-certification; tech certification; learner performing protected stages; disabled/no approved policy; notification duplicate replay and unsupported node rollback; evidence/grant UPDATE/DELETE; inverted grant dates; cross-tenant event and executed-grant references.

Initial failures are retained as evidence: a final JDBC repository could not be proxied by Spring, an overlong canonical status was rejected by PostgreSQL, the sole workflow initiator was excluded from manager tasks, and the notification test expected the wrong exception family. Each was fixed at its contract boundary and rerun successfully.

## Boundary

P010 is locally closed. This checkpoint itself was not an independent PASS; the independent reviewer subsequently accepted the full P006–P010 package in `PHASE_GATE.md`, authorizing PHASE-11 to start in sequence.
