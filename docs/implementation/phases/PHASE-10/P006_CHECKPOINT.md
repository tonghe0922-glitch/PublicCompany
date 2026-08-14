# PHASE-10 P006 Checkpoint

> Process: `P006` 会议与行动项  
> State: `CHECKPOINT_PASS / CLOSED`（施工方本地自检）  
> Phase at P006 closure: `PHASE-10 = IN_PROGRESS`; current aggregate state is superseded by `PHASE_REPORT.md`  
> Evidence authority: `I:\PublicCompany_source_codex` current disk; no `.git`, no remote CI claim

## Source and trace closure

- Raw Knowledge Base parse: 15/15 XLSX, 90 sheets, 4,745 non-empty rows, zero cache fallback and zero failures. Machine proof: `P006_P010_SOURCE_SNAPSHOT.json`.
- Exact P006 sequence: S01议题征集 → S02材料完整性检查 → S03会议发布 → S04签到与请假 → S05会议召开 → S06主持人确认纪要 → S07行动项生成 → S08责任人执行 → S09验收与返工 → S10逾期升级 → S11归档复盘 → END.
- Exact page coordinates: employee `/employee/05/01/03`, `/employee/05/07/02`; center `/center/06/09/03`, `/center/05/02/02`; tech shared monitor `/tech/05/03/01`. Ledger: `PHASE10_PAGE_BINDINGS.json`.
- Process trace: source workbook → P006 → published workflow/form → `collaboration.meeting/meeting_item` → six server permissions → `/api/v1/processes/P006/meetings` → three portal routes.
- Generic source R11/R12 text triggers only on leave/schedule/overtime interval and quota mutations. P006 has neither; applying quota/time-off behavior to meetings would invent semantics. P007–P009 retain those gates.

## Implemented business closure

- Canonical PostgreSQL: existing `collaboration.meeting` and `meeting_item`; additive V115 adds only P006 sequence, IAM permissions, published workflow/form and append-only evidence guard.
- Workflow: 12 nodes including END, 18 controlled transitions, published immutable version, form submission, task candidates and action log. Client cannot post a target state.
- Action items can only be generated after confirmed minutes and bind owner, planned interval, acceptance criteria and immutable evidence.
- S08 only the persisted action owner may execute. S09 rejects self-acceptance by the last executor. `REWORK` returns to S08; the second execution has a distinct versioned Outbox key.
- API creation/action requires `Idempotency-Key`, expected version, authentication, permission and data scope. Exact replay succeeds; changed payload, stale version, cross-center access and unauthorized action fail closed.
- Tech monitor has `p006.meeting.monitor` only and receives no meeting reason/body/result/evidence fields or action controls.
- Each lifecycle mutation writes audit and durable P006 Outbox. Worker handler creates idempotent, rendered in-app notification without copying private meeting content.

## Ledger

| Dimension | P006 fact |
|---|---|
| Process | published S01–S11 + END; 18 transitions |
| Page | 5 frozen source-key routes; employee/center/tech real Router bindings |
| API | create/list/get/action under `/api/v1/processes/P006/meetings` |
| Permission | `create`, `read`, `manage`, `action`, `accept`, `monitor`; server authorization/data scope |
| Database | canonical meeting/item + V115; optimistic version; immutable evidence trigger |
| Async | `P006_MEETING_EVENT` → Outbox → Worker handler → NotificationService |
| Audit | create/read/list/action attempt and success/denial persisted in audit database |

## Reproducible local gates

| Gate | Command/result | Evidence |
|---|---|---|
| Source raw parse | `python scripts/implementation/phase10_preparation_extract.py` and `--check`; 15/15, 90, 4,745, 0 failures | generated snapshot JSON/MD |
| Source contract | `python scripts/implementation/phase10_contract.py`; PASS | generated contract/matrices |
| Migration + DB + Worker | `mvnw -pl technical-platform/backend/modules/database-baseline -am -Pphase10-integration -Dit.test=Phase10P006DatabaseIT,Phase10P006NotificationDatabaseIT verify`; 4 tests, 0 failures, BUILD SUCCESS | `.runlogs/phase10-p006-database-worker-it.log` |
| HTTP integration | `mvnw -pl technical-platform/backend/apps/api -Pphase04-integration -Dit.test=Phase10P006IntegrationTest verify`; 1 test, 0 failures, BUILD SUCCESS | `.runlogs/phase10-p006-api-integration.log` |
| Fixture compile | API reactor `test-compile`; BUILD SUCCESS | `.runlogs/phase10-p006-fixture-compile.log` |
| Frontend type/lint | `pnpm typecheck`; `pnpm lint`; both exit 0 | `.runlogs/phase10-p006-web-*.log` |
| Chromium E2E | dedicated config; 1 passed (16.1s) after full P006 lifecycle | `.runlogs/phase10-p006-playwright.log` |

The first browser invocation failed before business execution because the locally locked Playwright browser was absent; `pnpm exec playwright install chromium` installed v1234. Subsequent failures exposed and fixed a missing employee content projection and an unstable test locator; the final full run passed. No failed attempt is hidden.

## Normal and negative paths proved

Normal: create → submit → material accept → publish → attendance → convene → confirmed minutes → action generation → owner execution → independent acceptance → overdue fact → archive.  
Controlled exception: acceptance REWORK → owner second execution → independent acceptance.  
Negative: unauthenticated create, invalid source value, idempotency collision, stale version, cross-center read, manager executing owner action, executor self-acceptance, evidence update/delete, unsupported notification node, private payload leakage.

## Boundary

P006 is locally self-verified and closed. P007–P010 were subsequently closed; current aggregate state is in `PHASE_REPORT.md`. This checkpoint itself did not declare an independent PASS; the later independent PHASE-10 PASS is authoritative in `PHASE_GATE.md`.
