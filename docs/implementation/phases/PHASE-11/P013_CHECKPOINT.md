# PHASE-11 P013 Checkpoint

> Process: `P013` 奖励  
> State: `CHECKPOINT_PASS / CLOSED`（施工方本地自检）  
> Next allowed process: `P014`  
> This is not an independent PHASE-11 PASS.

## Source-backed scope and invariants

- Deterministic PHASE-11 source snapshot: 18/18 XLSX, 108 sheets, 5,655 non-empty rows, SHA-256 `D21D758B6CCE42A68659A2D1711C977FFE8DAFDF56DB57234C775074F3A36C55`.
- Published workflow: S01 contribution fact → S02 evidence verification → S03 reward-level recommendation → S04 independent approval → S05 independent duplicate check → S06 impact instructions → S07 employee notice → S08 authoritative receipts → S09 archive → END.
- Contribution facts, approval facts, impact instructions and authoritative execution receipts are separate immutable facts. A source contribution may have only one active reward case.
- P013 never writes `reward.point_transaction` and never executes payment. It records an `HONOR_POINTS`, `BONUS` or `DEVELOPMENT` instruction; completion requires the matching P015, finance or HR receipt.
- The affected employee cannot manage, review, approve, execute or archive their own case. Recommender, approver and duplicate checker separation is enforced.

## Delivered ledger

| Dimension | Closed evidence |
|---|---|
| Trace/page | Exact routes: employee `/employee/08/10/05`; center `/center/10/10/03`, `/center/10/10/04`; dedicated tech `/tech/06/06/01`; shared tech `/tech/05/03/01` |
| Process/form | V122 publishes S01–S09 + END, 11 transitions and `CTR-P013-F01` |
| API | `/api/v1/processes/P013/reward-cases` create/list/get/action with idempotency, optimistic locking, workflow tasks, data scope, audit and normalized persistence conflicts |
| Permission | `read/manage/review/approve/execute/monitor`; employee self-notice, center review/approval/execution and metadata-only tech monitoring are separated |
| Database | canonical `reward.reward_case`; immutable event/instruction/receipt facts; source uniqueness, receipt-shape/linkage checks, RLS, tenant guards, append-only controls and least-privilege grants |
| Async | `P013_REWARD_EVENT` notification handler deduplicates recipients and only renders business number/event/node; contribution, amount, points, evidence and receipts are excluded |

## Reproducible gates

| Gate | Result | Log |
|---|---|---|
| 19-module compile | PASS | `.runlogs/phase11-p013-compile-final.log` |
| Empty PostgreSQL 16.14 → V122, validate/no-op and DB negatives | 4/4 PASS | `.runlogs/phase11-p013-db-final.log` |
| Worker replay, sanitization and rollback | 2/2 PASS | `.runlogs/phase11-p013-worker-final.log` |
| Spring API + PostgreSQL 16.14 + Redis 7.4 lifecycle | 1/1 PASS | `.runlogs/phase11-p013-api-final.log` |
| Web lint/typecheck | PASS / PASS | `.runlogs/phase11-p013-web-lint-final.log`, `.runlogs/phase11-p013-web-typecheck-final.log` |
| Web unit/router | 23 files / 100 tests PASS | `.runlogs/phase11-p013-web-test-final.log` |
| Three portal builds | PASS; existing ~2.023 MB chunk warning retained | `.runlogs/phase11-p013-web-build-final.log` |
| Knip | PASS | `.runlogs/phase11-p013-web-deadcode-final.log` |
| Real Chromium | desktop-chromium 1/1 PASS, test 14.6s / total 19.5s | `.runlogs/phase11-p013-browser-fixture-final.log`, `.runlogs/phase11-p013-playwright-final.log` |

## Normal and negative paths

Normal paths cover center creation, all S01–S09 transitions, two independent impact instructions, employee notice confirmation, matching P015/finance receipts, archive, both center routes, the employee route and dedicated/shared tech monitors. Negative paths cover stale versions, duplicate source facts, cross-center list/detail isolation, monitor-only masking/no buttons, employee self-review rejection, recommender/approver and approver/duplicate-checker separation, missing receipts, mismatched receipt type, append-only tamper, cross-tenant linkage, replay-safe notification and unsupported-node rollback. Both database and API tests assert that P013 creates no P015 point ledger row.

The final real-browser PostgreSQL and Redis container IDs were verified `ABSENT` after fixture shutdown. Existing non-blocking warnings remain: Maven's historical unpinned Spring Boot plugin warning, JDK Mockito dynamic-agent warning and the Vite chunk-size warning. `P013 = CHECKPOINT_PASS / CLOSED`; construction may proceed only to P014.

## Stable remediation Browser revalidation（2026-08-13）

全新 Spring/PG16.14→V125/Redis7.4 fixture 下 desktop Chromium `1/1 PASS`（14.3s / 19.3s）。PostgreSQL `6c582bc92c193a1d17251ca2dc5c1f76720658b90d3fe09685c3d480888dc36e`、Redis `e279d4a69b33ec931e54092b27a4493a1bd58dc862d156678478b550b615c7c0` 均 `ABSENT`；首次 cleanup 快照如实保留 Ryuk=1，5 秒后 `runtime-rerun2` 复核 Ryuk、workspace gate process、端口均为 0。证据：`.runlogs/phase11-remediation-stable-p013-*`。
