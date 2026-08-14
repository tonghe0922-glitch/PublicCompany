# PHASE-11 P015 Checkpoint

> Process: `P015` 成长积分与荣誉积分  
> State: `CHECKPOINT_PASS / CLOSED`（施工方本地自检）  
> Next allowed process: `P016`  
> This is not an independent PHASE-11 PASS.

## Source-backed scope and invariants

- Deterministic PHASE-11 source snapshot: 18/18 XLSX, 108 sheets, 5,655 non-empty rows, SHA-256 `D21D758B6CCE42A68659A2D1711C977FFE8DAFDF56DB57234C775074F3A36C55`.
- Published workflow: S01 business event → S02 person/source validation → S03 exception/deduplication → S04 published rule-version match → S05 calculation/cap → S06 risk classification → S07 automatic posting or independent review → S08 employee notification → S09 appeal/adjustment/reversal → S10 effective balance/rank recalculation → END.
- `reward.point_transaction` is append-only. Correction, appeal and reversal append linked ledger rows; no business role can UPDATE, DELETE or TRUNCATE the original fact.
- Rules and ranks are versioned and immutable after publication. The service uses the rule effective at the business timestamp, records the exact rule version and recalculates balance/rank only from effective ledger rows.
- Tech can configure published rule metadata and inspect masked monitor data, but cannot create, review, self-certify or adjust a business transaction without the corresponding business/read authority.

## Delivered ledger

| Dimension | Closed evidence |
|---|---|
| Trace/page | Employee `/employee/08/06/04`, `/employee/08/06/06`; center `/center/10/09/01`, `/center/10/09/06`; tech `/tech/06/06/09` |
| Process/form | V124 publishes S01–S10 + END, action-only transitions and `CTR-P015-F01` |
| API | `/api/v1/processes/P015/point-transactions` plus versioned rule endpoints; idempotency, optimistic locking, workflow tasks, data scope, audit and persistence-conflict normalization |
| Permission | `read/manage/review/adjust/monitor`; read linkage is mandatory for workflow candidates; tech monitoring remains metadata-only |
| Database | Canonical `reward.point_transaction`; rule/rank/event/posting/balance facts; tenant guards, RLS, rule/employee/workflow/original linkage, reversal exact-negation checks, published immutability and append-only grants |
| Async | `P015_POINT_EVENT` handler rejects invalid JSON/UUID/node, deduplicates recipients, limits notification content and rolls back unsupported events |

## Reproducible gates

| Gate | Result | Log |
|---|---|---|
| Source contract | 18/18 XLSX, 108 sheets, 5,655 rows, deterministic snapshot frozen | `docs/implementation/phases/PHASE-11/P011_P016_SOURCE_SNAPSHOT.json` |
| 19-module compile | PASS | `.runlogs/phase11-p015-backend-compile.log` |
| Empty PostgreSQL 16.14 → V124, validate/no-op, DB negatives and Worker replay/sanitization/rollback | 6/6 PASS, process exit 0 | `.runlogs/phase11-p015-db-worker-it.log` |
| Spring API + PostgreSQL 16.14 + Redis 7.4 lifecycle | 1/1 PASS, 19-module BUILD SUCCESS | `.runlogs/phase11-p015-api-it-rerun.log` |
| Web lint/typecheck | PASS / PASS | `.runlogs/phase11-p015-web-lint.log`, `.runlogs/phase11-p015-web-typecheck.log` |
| Web unit/router | 25 files / 106 tests PASS | `.runlogs/phase11-p015-web-test.log` |
| Three portal builds | PASS; existing ~2.046 MB chunk warning retained | `.runlogs/phase11-p015-web-build.log` |
| Knip | PASS, process exit 0 | `.runlogs/phase11-p015-web-knip.log` |
| Real Chromium | desktop-chromium 1/1 PASS, test 15.3s / total 20.2s | `.runlogs/phase11-p015-browser-fixture-rerun.log`, `.runlogs/phase11-p015-playwright.log` |
| Static negative scan | Source-only empty catch CLEAN; production candidate/recipient UUID parsing fails closed | `.runlogs/phase11-p015-static-negative-scan.log` |
| Fixture cleanup | Exact PostgreSQL and Redis IDs both `ABSENT` | `.runlogs/phase11-p015-fixture-cleanup.log` |

## Normal and negative paths

Normal paths cover rule draft/publication, business transaction creation, source/person validation, duplicate/exception handling, effective rule matching, calculation/cap, risk classification, independent review, immutable posting, employee notice, persisted adjustment request, independent approval, linked correction row, effective balance/rank recomputation and archive. The same persisted fact is rendered through all five bound routes.

Negative paths cover unauthenticated access, idempotent replay, invalid/stale rule versions, duplicate source events, stale versions, cross-center/tenant isolation, monitor-only masking, tech business action denial, self-review/self-certification denial, missing read permission in dynamic candidates, invalid/mismatched original linkage, non-exact reversal, published rule/rank mutation, ledger UPDATE/DELETE/TRUNCATE, malformed notification payload/recipient UUID, duplicate delivery and unsupported-node rollback.

The first API attempt and first browser-fixture startup failure are retained in `.runlogs/phase11-p015-api-it.log` and `.runlogs/phase11-p015-browser-fixture.log`; both causes were corrected and the named rerun evidence is authoritative. Final fixture container IDs were verified absent. Existing non-blocking warnings remain: historical Maven plugin pinning, Mockito dynamic-agent, Vite chunk size and Playwright `NO_COLOR`/`FORCE_COLOR`. `P015 = CHECKPOINT_PASS / CLOSED`; construction may proceed only to P016.

## Stable remediation Browser revalidation（2026-08-13）

全新 Spring/PG16.14→V125/Redis7.4 fixture 下 desktop Chromium `1/1 PASS`（16.5s / 21.2s）。PostgreSQL `3884864ec827d92a58cfb7fb205695b52b9d4fc0a287bc79f225a823831a5b12`、Redis `c2e874a9990646d8dc21770ec73642f03711c2d8005671e8f065633b405f69bd` 均 `ABSENT`；首次 cleanup 快照保留 Ryuk=1，5 秒后 `runtime-rerun2` 复核全 0。证据：`.runlogs/phase11-remediation-stable-p015-*`。
