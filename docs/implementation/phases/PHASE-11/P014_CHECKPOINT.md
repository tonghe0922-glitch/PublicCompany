# PHASE-11 P014 Checkpoint

> Process: `P014` 纪律、责任与申诉  
> State: `CHECKPOINT_PASS / CLOSED`（施工方本地自检）  
> Next allowed process: `P015`  
> This is not an independent PHASE-11 PASS.

## Source-backed scope and invariants

- Deterministic PHASE-11 source snapshot: 18/18 XLSX, 108 sheets, 5,655 non-empty rows, SHA-256 `D21D758B6CCE42A68659A2D1711C977FFE8DAFDF56DB57234C775074F3A36C55`.
- Published workflow: S01 clue registration → S02 temporary safeguard → S03 formal investigation → S04 employee statement → S05 responsibility review → S06 external human-authorized decision record → S07 service confirmation → S08 downstream impact receipts → S09 independent appeal review → S10 core close → S11 independent remediation observation → S12 supplementary archive → END.
- The platform records source facts, externally authorized human decisions, downstream instructions and authoritative receipts as separate immutable facts. It does not automatically decide sanctions or legal liability.
- P014 never writes `reward.point_transaction`, changes salary/grade/payment, or directly executes a sanction. A `POINT_ADJUSTMENT` instruction is complete only after a matching external `P015_POINT_LEDGER` receipt.
- Affected employee, investigator, responsibility reviewer, decider and appeal reviewer duties are separated. The decider cannot review the appeal against their own decision.

## Delivered ledger

| Dimension | Closed evidence |
|---|---|
| Trace/page | Exact routes: employee `/employee/02/03/09`; center `/center/02/04/04`, `/center/06/03/09`; shared tech `/tech/05/03/01` |
| Process/form | V123 publishes S01–S12 + END, 15 transitions and `CTR-P014-F01` |
| API | `/api/v1/processes/P014/discipline-cases` create/list/get/action with idempotency, optimistic locking, workflow tasks, data scope, audit and normalized persistence conflicts |
| Permission | `read/manage/investigate/decide/appeal/monitor`; employee statement/service/appeal, center investigation/review/decision/execution and metadata-only tech monitoring are separated |
| Database | canonical `reward.discipline_case`; immutable event/decision/impact/receipt facts; source uniqueness, receipt linkage/type checks, RLS, tenant guards, append-only controls and least-privilege grants |
| Async | `P014_DISCIPLINE_EVENT` notification handler rejects invalid payload/recipient UUIDs, deduplicates recipients and renders only business number/event/node; private facts, decisions, evidence, instructions and receipts are excluded |

## Reproducible gates

| Gate | Result | Log |
|---|---|---|
| Source contract | 18/18 XLSX, 108 sheets, 5,655 rows, deterministic check PASS | `.runlogs/phase11-p014-source-check-final.log`, `.runlogs/phase11-c0-snapshot-sha256.log` |
| 19-module compile | PASS | `.runlogs/phase11-p014-compile-final.log` |
| Empty PostgreSQL 16.14 → V123, validate/no-op, DB negatives and Worker replay/sanitization/rollback | 6/6 PASS, process exit 0 | `.runlogs/phase11-p014-db-worker-final-exit0.log` |
| Spring API + PostgreSQL 16.14 + Redis 7.4 lifecycle | 1/1 PASS, 19-module build, process exit 0 | `.runlogs/phase11-p014-api-final.log` |
| Web lint/typecheck | PASS / PASS | `.runlogs/phase11-p014-web-lint-final.log`, `.runlogs/phase11-p014-web-typecheck-final.log` |
| Web unit/router | 24 files / 103 tests PASS | `.runlogs/phase11-p014-web-test-final.log` |
| Three portal builds | PASS; existing ~2.034 MB chunk warning retained | `.runlogs/phase11-p014-web-build-final.log` |
| Knip | PASS, process exit 0 | `.runlogs/phase11-p014-web-deadcode-final.log` |
| Real Chromium | desktop-chromium 1/1 PASS, test 17.4s / total 22.4s | `.runlogs/phase11-p014-browser-fixture-final-success.log`, `.runlogs/phase11-p014-playwright-final-success.log` |
| Static negative scan | empty catch CLEAN; candidate/notification UUID parsing fail-closed | `.runlogs/phase11-p014-static-negative-scan-final.log` |
| Fixture cleanup | exact PostgreSQL and Redis IDs both `ABSENT` | `.runlogs/phase11-p014-fixture-cleanup-final.log` |

## Normal and negative paths

Normal paths cover center creation, all S01–S12 transitions, employee statement/service/appeal actions, independent investigation/review/decision/appeal actors, one point-adjustment instruction with an external P015 receipt, core close, remediation observation, archive, both center routes, employee route and shared tech monitor. Final assertions include two immutable human-decision facts, one impact instruction, one receipt, complete audit, and zero P015 point-ledger rows.

Negative paths cover unauthenticated creation, idempotent replay, duplicate source facts, stale versions, cross-center list/detail isolation, monitor-only masking/no buttons, affected-employee self-investigation/decision rejection, investigator self-review rejection, decider self-appeal-review rejection, missing receipt, mismatched receipt type, cross-tenant/type linkage, append-only UPDATE/DELETE/TRUNCATE, invalid notification JSON/recipient UUID, duplicate delivery and unsupported-node rollback.

The final real-browser PostgreSQL and Redis container IDs were verified `ABSENT` after fixture shutdown. Existing non-blocking warnings remain: Maven's historical unpinned Spring Boot plugin warning, JDK Mockito dynamic-agent warning and the Vite chunk-size warning. `P014 = CHECKPOINT_PASS / CLOSED`; construction may proceed only to P015.

## Stable remediation Browser revalidation（2026-08-13）

全新 Spring/PG16.14→V125/Redis7.4 fixture 下 desktop Chromium `1/1 PASS`（17.9s / 22.8s）。受控停止后 PostgreSQL `5aaf2f18e30f354fa169d3eb6beaba0feaffbc823e674f5c391645a45ca43cbf`、Redis `56af3a91d56acdeb6cf27f64ea8baef9c2fd89ab62a7232c4cf528f01c34db00` 均 `ABSENT`，Ryuk、workspace gate process、端口均为 0。证据：`.runlogs/phase11-remediation-stable-p014-*`。
