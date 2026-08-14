# PHASE-10 Independent Review Request

> Requested gate: `PHASE-10 / P006–P010`
> Constructor state: `LOCAL_CONSTRUCTION_COMPLETE / INDEPENDENT_REVIEW_PENDING`
> Reviewer authority: only the independent reviewer may issue PASS/FAIL
> Evidence root: `I:\PublicCompany_source_codex`

## Local source authority

- `Get-Location` resolves to `I:\PublicCompany_source_codex`; `.git` is absent. No clone, pull, push, branch, commit, PR or remote CI result is claimed.
- The latest user instruction overrides the historical repository/branch/push text in `docs/implementation/CONSTRUCTION_RULES.md` and `Construction Master Schedule.csv`; the former now records that local override explicitly. Phase order, DoD and quality gates remain applicable.
- The refreshed Knowledge Base is authoritative. `python scripts/implementation/phase10_preparation_extract.py --check` passes against 15/15 raw P006–P010 XLSX workbooks, 90 sheets, 4,745 non-empty rows, zero fallback/failures. Snapshot SHA-256: `FCA53ED8312206218B0020315D5A16A41A9C5EB1490958771463A381888FFB26`.

## Scope and DoD closure

| Process | Implemented closure | Checkpoint |
|---|---|---|
| P006 | Meeting publication, attendance/minutes, action ownership, execute, independent accept/rework, escalation, archive | `P006_CHECKPOINT.md` |
| P007 | Demand/template, qualification/overlap/12-hour guard, publish/confirm, substitute/change, independent review, integration receipt, day close | `P007_CHECKPOINT.md` |
| P008 | Leave, external quota grant prerequisite, reserve/release/deduct/adjust ledger, handover, independent review, early return/change, attendance close | `P008_CHECKPOINT.md` |
| P009 | Overtime fact, overlap/emergency evidence, independent approval/acceptance, HR scheme, employee confirmation, external receipt, archive; no salary/payment calculation | `P009_CHECKPOINT.md` |
| P010 | Versioned learning, 0–1000 exam, offline practical, independent certification, dated qualification, approved-policy permission linkage, recertification, archive | `P010_CHECKPOINT.md` |

Each process uses its canonical PostgreSQL master, published Workflow/Form/Task runtime, tenant transaction, idempotency, server business number, optimistic version, server-side IAM/data scope, immutable audit, durable Outbox, Worker/Notification projection, server-backed Vue routes and real Chromium lifecycle testing. No P011+ implementation was started.

## Key implementation files

- Database overlays: `technical-platform/database/flyway-overlays/oms/V115__phase10_p006_meeting_action.sql` through `V119__phase10_p010_learning_qualification_flow.sql`.
- Domain modules: `technical-platform/backend/modules/collaboration`, `attendance`, and `learning`.
- HTTP: `technical-platform/backend/apps/api/src/main/java/cn/shangjingu/platform/api/phase10/`.
- Worker: `technical-platform/backend/apps/worker/src/main/java/cn/shangjingu/platform/worker/Phase10P006NotificationHandler.java` through `Phase10P010NotificationHandler.java`.
- Authorization linkage: `technical-platform/backend/modules/iam/src/main/java/cn/shangjingu/platform/iam/infrastructure/JdbcIdentityDirectoryAdapter.java`.
- Pages/router: `technical-platform/web/src/platform/pages/P006MeetingPage.vue`, `P007ShiftPage.vue`, `P008LeavePage.vue`, `P009OvertimePage.vue`, `P010LearningPage.vue`, shared tech monitors, and `technical-platform/web/src/router/portal-router.ts`.
- Integration/E2E: `Phase10P006*IT` through `Phase10P010*IT`, API integration/fixture classes, and `technical-platform/web/e2e/phase10-*-live.spec.ts`.

## Reproducible gates actually run

| Scope | Command/result | Evidence |
|---|---|---|
| Source | `python scripts/implementation/phase10_preparation_extract.py --check`; current/deterministic | `.runlogs/phase10-source-contract-check-p010-kb-refresh.log` |
| P006 DB/Worker | `mvnw -pl technical-platform/backend/modules/database-baseline -am -Pphase10-integration -Dit.test=Phase10P006DatabaseIT,Phase10P006NotificationDatabaseIT verify`; 4 pass | `.runlogs/phase10-p006-database-worker-it.log` |
| P006 API/E2E | API integration 1 pass; Chromium lifecycle 1 pass | `.runlogs/phase10-p006-api-integration.log`, `.runlogs/phase10-p006-playwright.log` |
| P007 DB/Worker/API | PG16 through V116 + no-op; notification 2 pass; API lifecycle 1 pass | `.runlogs/phase10-p007-database-it.log`, `phase10-p007-notification-database-it.log`, `phase10-p007-api-integration-rerun.log` |
| P007 frontend/E2E | 17 files/82 tests, lint/type pass; real three-portal lifecycle 1 pass | `.runlogs/phase10-p007-web-*.log`, `phase10-p007-playwright-pass-final.log` |
| P008 DB/Worker/API | PG16.14 through V117 + no-op; DB/Worker 4 pass; API lifecycle + API units pass | `.runlogs/phase10-p008-v117-migration-probe-pass.log`, `phase10-p008-database-notification-pass.log`, `phase10-p008-api-integration-pass-final.log` |
| P008 frontend/E2E | 18 files/85 tests, lint/type/build/Knip pass; real lifecycle 1 pass | `.runlogs/phase10-p008-web-*.log`, `phase10-p008-playwright-rerun.log` |
| P009 DB/Worker/API | PG16.14 through V118 + validate/no-op, 4 DB/Worker pass; API lifecycle 1 pass | `.runlogs/phase10-p009-database-notification-rerun.log`, `phase10-p009-api-integration-rerun2.log` |
| P009 frontend/E2E | 19 files/88 tests, exact router 6 tests, lint/type/build/Knip pass; real lifecycle pass | `.runlogs/phase10-p009-web-*.log`, `phase10-p009-router-unit-final.log`, `phase10-p009-playwright-final.log` |
| P010 compile/regression | 17-module compile/install and API+Worker reactor tests pass | `.runlogs/phase10-p010-compile.log`, `phase10-p010-reactor-install.log`, `phase10-p010-backend-unit-regression.log` |
| P006–P010 candidate fail-closed regression | all five domain services reject malformed Workflow candidate UUIDs; 17-module API+Worker reactor BUILD SUCCESS | `.runlogs/phase10-candidate-failclosed-regression.log` |
| P010 DB/Worker final | `.\mvnw.cmd -pl :platform-database-baseline -am -Pphase10-integration "-Dit.test=Phase10P010DatabaseIT,Phase10P010NotificationDatabaseIT" "-Dfailsafe.failIfNoSpecifiedTests=false" verify`; PG16.14, V119 validate/no-op, 6/6 pass, BUILD SUCCESS | `.runlogs/phase10-p010-database-notification-final.log` |
| P010 API final | `.\mvnw.cmd -pl :platform-api -am "-Dtest=Phase10P010IntegrationTest" "-Dsurefire.failIfNoSpecifiedTests=false" test`; Spring + PG16.14 + Redis7.4, 1/1 pass, 17-module BUILD SUCCESS | `.runlogs/phase10-p010-api-integration-final.log` |
| P010 frontend | lint/type; 20 files/91 tests; employee/center/admin builds; Knip all pass | `.runlogs/phase10-p010-web-lint.log`, `phase10-p010-web-typecheck.log`, `phase10-p010-web-unit.log`, `phase10-p010-web-build.log`, `phase10-p010-web-deadcode.log` |
| P010 Chromium | real API + PG16 + Redis + three Vite portals; full lifecycle 1 pass in 17.0s | `.runlogs/phase10-p010-browser-fixture.log`, `phase10-p010-playwright.log` |

The two final P010 Maven logs contain PowerShell `NativeCommandError` wrappers because Mockito/JDK warnings were emitted on stderr. Maven completed and records `BUILD SUCCESS`; Failsafe/Surefire XML records zero failures/errors. The warnings and wrapper behavior are retained, not suppressed.

## Normal and negative coverage

- P006 normal/controlled: publish through archive; acceptance rework then second owner execution. Negative: unauthenticated, invalid input, idempotency collision, stale version, cross-center, wrong owner, self-acceptance, evidence tamper, invalid notification node, private leakage.
- P007 normal: demand through day close with qualification and integration facts. Negative: >12 hours, interval overlap, missing qualification, self-review, cross-center, stale version, private masking, evidence tamper, replay/invalid node.
- P008 normal: external grant 16h, leave 6h, reserve/deduct/early return/adjust, final available 10/reserved 0/consumed 6. Negative: overlap, self-review, insufficient quota, negative balance, forged tenant/employee ledger, illegal delta, tamper, replay/invalid node.
- P009 normal: overtime through independent acceptance, HR PAYROLL route, employee confirmation, external `PAY-EXT-*` receipt and archive. Negative: overlap, emergency without evidence, self-approval/HR/receipt, receipt bounds, cross-center, stale, tamper, replay/invalid node. No payment instruction is created.
- P010 normal: create through 886/1000 exam, independent practical/certification, dated qualification, enabled `qualified.safety.access` linkage visible in session authorization, recertification and archive. Negative: unauthenticated, score 1001, assessor=self-certifier, protected action by learner/tech, disabled policy, cross-center, stale, metadata masking, inverted dates, cross-tenant event/grant forgery, tamper, replay/invalid node.
- Cross-process Workflow candidate projection is fail-closed: an invalid candidate UUID rejects the transaction instead of being silently omitted from task recipients or notification facts.

## Trace/page/process/API/permission/database ledgers

- Source and trace: `SOURCE_CONTRACT.md`, `P006_P010_SOURCE_SNAPSHOT.json/.md`, `PHASE10_PAGE_BINDINGS.json`.
- Impact and gap: `IMPACT_MATRIX.md`, `GAP_MATRIX.md`.
- Per-process page/process/API/permission/database/async/audit evidence: `P006_CHECKPOINT.md` through `P010_CHECKPOINT.md`.
- Aggregate state: `PHASE_REPORT.md`, `START_CHECKLIST.md`, `docs/implementation/MASTER_PROGRESS.md`.
- Page binding state: every P006–P010 item is `IMPLEMENTED_LOCAL_VERIFIED`; P011 remains blocked.

## Known risks and deliberately unexecuted items

- Existing Vite warning: approximately 1.996 MB minified portal bundle. All three builds pass; warning is retained.
- P010 permission-policy mutation is deliberately outside the P010 caller API. The flow can execute only an already approved/enabled policy with approver/reference/timestamp and matching qualification; this is fail-closed for a high-risk permission action.
- Production deployment, production backup/restore and UAT are not claimed in PHASE-10; they remain later-phase gates.
- No remote CI/commit evidence is available because the mandated local directory has no `.git`.

## Formal request

Please independently rerun the source check and representative P006–P010 migration, normal/negative API, route, IAM/data-scope/masking, immutable ledger, Worker replay and Chromium gates. Reply with structured PASS/FAIL findings. PHASE-11 remains blocked until your PASS.
