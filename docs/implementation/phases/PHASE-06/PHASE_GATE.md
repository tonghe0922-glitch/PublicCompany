# PHASE-06 PHASE_GATE — Independent Formal Acceptance

> Current Gate state: `PASS`
> Repository: `louthison/PublicCompany`
> Construction branch: `ChatGPT_Version_V0.05`
> Audited completed HEAD before this report-only commit: `a49c44b6c13e138e3ebe89602b96dca2b90b517f`
> Exact implementation / READY_FOR_GATE candidate: `d9a953c2da9bb560ed6c284a2adf1451ed09a7a4`
> Construction run: `31260482194 = PASS`
> Independent Gate run: `31260482190 = PASS`
> Completed-head regression run: `31260752191 = PASS`
> Historical PHASE-05 regression on completed head: `31260752187 = PASS`
> PHASE-06: `COMPLETE`
> PHASE-07: `NOT_STARTED`

## 1. Independent acceptance basis

This document records a second, independent acceptance review after construction closeout. The reviewer did **not** rely only on `PHASE_REPORT.md` or the construction AI's completion statement.

The review re-read the current `AGENT.md`, `DESIGN.md`, `MASTER_PROGRESS.md`, PHASE-06 `SOURCE_CONTRACT.md`, `IMPACT_MATRIX.md`, `GAP_MATRIX.md`, `PHASE_REPORT.md`, C8 checkpoint, current Actions workflow and selected production/test source files.

Direct source inspection included, among others:

- `TransactionalOutboxService` — caller-transaction requirement, advisory locking, content-safe `event_key` replay/conflict handling;
- `PlatformOutboxWorker` / `PlatformInboxService` — tenant transaction, `FOR UPDATE SKIP LOCKED`, Inbox dedup, retry/backoff, restart recovery and persistent DLQ;
- `FileObjectService` / `MinioFileObjectStorage` — database file facts, SHA256, scan-state machine, SAFE gate, real MinIO put/stat/presign/remove;
- `PlatformFileDownloadGuard` / `StepUpService` — permission, authoritative data-scope, minimum MFA2 Step-Up, replay-safe consume and audit boundary;
- `WebhookIngressService` — signature verification, provider-event/content dedup, persistent webhook evidence and Transactional Outbox handoff;
- `NotificationDeliveryHandler` — provider acceptance required before `SENT`; no fake delivered/read success;
- `PlatformAuditWriter` — append-only critical audit writes with fail-closed propagation and correlation/trace evidence;
- PHASE-06 PostgreSQL/Testcontainers suites — actual rollback/idempotency/concurrency/restart/DLQ/RLS/file/notification/integration/audit-trace assertions.

The current completed-head workflow `31260752191` independently reran source/safety, full Java, PHASE-05 PostgreSQL, PHASE-06 PostgreSQL, real MinIO, C7 API/Worker/security/Step-Up, Web typecheck/test/build and a final COMPLETE verdict; all 8 jobs passed.

## 2. Formal requirement-by-requirement result

| Requirement | Expected | Actual | Evidence | PASS/FAIL |
|---|---|---|---|---|
| Repository identity | Only `louthison/PublicCompany` | Correct repository | `MASTER_PROGRESS.md`; Actions repository metadata | PASS |
| Construction branch | Use actual work branch, never assume old branch | `ChatGPT_Version_V0.05` | remote ref / Actions `head_branch` | PASS |
| Completed remote HEAD | Completed phase report/code pushed and remote HEAD known | audited completed HEAD=`a49c44b6...`; this acceptance report is a report-only follow-up commit | remote ref; run `31260752191` bound to `a49c44b6...` | PASS |
| Canonical rules reread | Re-read AGENT/DESIGN/current phase/control docs | Re-read; no conflicting later authorization found | `AGENT.md`, `DESIGN.md`, PHASE-06 control docs | PASS |
| Scope correctness | PHASE-06 only platform side-effects/evidence kernel | Document/Outbox/Worker/Notification/Integration/Audit; P021–P025 excluded | `SOURCE_CONTRACT.md`, `IMPACT_MATRIX.md`, `GAP_MATRIX.md` | PASS |
| Employee / Center / Tech pages | Do not claim unrelated pages complete | No PHASE-06 business-page completion claim; business pages remain later phases | `MASTER_PROGRESS.md`; PHASE-06 scope | PASS |
| Router / frontend fact source | Browser must not become business truth | no `localStorage` / `sessionStorage` business truth allowed by gate scan | completed-head source/safety job | PASS |
| API / Controller boundary | Server-side authentication/authorization; engineering-owned platform API only | signed-download and webhook contracts are explicitly engineering-owned; server guard enforced | `PlatformFileDownloadGuard`; phase-06 API contracts | PASS |
| Permission negative path | Deny missing permission/data scope; no hidden-button security | `AuthorizationService` action + authoritative data-scope both required; deny throws | `PlatformFileDownloadGuard`; C7 tests | PASS |
| Step-Up high-risk path | Sensitive download requires sufficient MFA and one-time ticket semantics | minimum MFA level 2 enforced at consume time; replay/context/expiry fail closed | `StepUpService`; C7 regression | PASS |
| Transactional Outbox | Business write and outbox must share caller transaction | enqueue refuses operation without active transaction; rollback removes outbox fact | `TransactionalOutboxService`; `Phase06OutboxInboxDatabaseIT` | PASS |
| Idempotency / duplicate event | Same event replay stable; changed content conflicts | same-key/same-content returns existing id; changed content raises conflict | `TransactionalOutboxService`; PG16 IT | PASS |
| Concurrent Inbox dedup | Duplicate concurrent consumer must execute once | advisory lock + persisted Inbox; concurrency IT proves one first processor | `PlatformInboxService`; `Phase06OutboxInboxDatabaseIT` | PASS |
| Worker restart | Failed transaction must be resumable without duplicated side effect | failed handler rolls back Inbox/handler DB work; new worker resumes once | `PlatformOutboxWorker`; PG16 restart IT | PASS |
| Retry / backoff | Retry is durable and bounded | exponential retry derived from persisted retry count | `PlatformOutboxWorker`; PG16 IT | PASS |
| DLQ | Terminal failures must persist, not only log | writes `integration.dead_letter`, moves outbox to `DEAD_LETTER`, no redispatch | `PlatformOutboxWorker`; PG16 IT | PASS |
| PostgreSQL / RLS | Durable facts in PostgreSQL16 with tenant isolation and runtime roles | Testcontainers PostgreSQL16 runs with `sjg_api_runtime` / `sjg_worker_runtime`; cross-tenant read hidden | phase06 PG16 suite; run `31260752191` | PASS |
| Flyway ownership | Migrations outside API/Worker runtime | runtime POM scan rejects Flyway; database-baseline owns integration migrations | completed-head source/safety job; DB profile POM | PASS |
| File metadata facts | SHA256/MIME/size/sensitivity/version persisted | persisted in `document.file_object`; tenant-scoped queries | `FileObjectService`; V103/PG16 tests | PASS |
| SAFE gate | Unscanned/unsafe file cannot bind or download | only `SAFE` passes `bindAttachment` and `presignDownload` | `FileObjectService`; file PG16 tests | PASS |
| Real object storage | No mock storage presented as production proof | real MinIO SDK adapter; independent real MinIO job PASS | `MinioFileObjectStorage`; run `31260482190`; run `31260752191` | PASS |
| Signed download | Short TTL and server security gate | TTL capped at 15 minutes, SAFE + permission + data-scope + MFA2 + audit | `FileObjectService`; `PlatformFileDownloadGuard` | PASS |
| Notification semantics | Do not equate request with delivery/read success | `SENT` only after configured provider explicitly accepts send; no delivered/read fabrication | `NotificationDeliveryHandler` | PASS |
| Webhook authenticity | Verify signature before business handoff | invalid signature persists rejected evidence; valid event alone enqueues outbox | `WebhookIngressService` | PASS |
| Webhook duplicate | Same provider event must be idempotent; changed content must conflict | provider event + payload hash dedup; changed replay conflicts | `WebhookIngressService`; integration PG16 tests | PASS |
| API → Worker boundary | Web request records evidence/outbox; independent Worker handles async side effect | webhook ingress produces durable evidence/outbox; Worker consumes later | `WebhookIngressService`; `WebhookReceiptHandler`; C7 regression | PASS |
| Audit immutability | Security/sensitive/state evidence must be append-only | critical audit inserts into `sjg_audit`; runtime mutation permissions independently regressed | `PlatformAuditWriter`; PHASE-04 + PHASE-06 audit tests | PASS |
| Critical audit fail closed | Critical action must stop if mandatory audit cannot persist | critical writer propagates DB failures; security regressions PASS | `PlatformAuditWriter`; run `31260482190` | PASS |
| Correlation / trace | Trace survives API → outbox/worker → integration/audit | persisted correlation/trace columns and worker trace restoration | C6 V105/audit V100; `PlatformOutboxWorker`; audit PG16 tests | PASS |
| Fake-completion scan | Reject TODO/FIXME/disabled tests/browser truth/temp credentials/secret patterns in scoped source | current completed-head safety job passed | job `PHASE-06 completed source scope and Gate contract`, run `31260752191` | PASS |
| Full Java regression | All Java unit/smoke tests pass | PASS | run `31260752191` | PASS |
| PHASE-06 integration suite | Outbox/File/Notification/Integration/AuditTrace PG16 suites pass | PASS | Maven `phase06-integration`; run `31260752191` | PASS |
| Historical PHASE-05 regression | Previous workflow kernel remains green | PASS | run `31260752187`; also PHASE-05 PG16 job in `31260752191` | PASS |
| Web regression | TypeScript/typecheck/test/build pass | PASS | run `31260752191` | PASS |
| Windows Chinese path | Completed-stage scripts work in Chinese path | install/verify/migrate/start/stop PASS | independent Gate run `31260482190` | PASS |
| Exact Gate candidate | Independent Gate must bind to exact READY candidate and remote ref | candidate `d9a953c2...` preflight PASS | independent Gate run `31260482190` | PASS |
| Formal Gate | Every independent gate prerequisite must pass | 9/9 independent Gate jobs PASS | run `31260482190` | PASS |
| Main branch boundary | Do not merge during phase acceptance | `main` remains at imported baseline `4d99a9e6...` | GitHub main ref / Draft PR | PASS |
| Next phase boundary | Do not auto-start next phase | `PHASE-07 = NOT_STARTED` | `MASTER_PROGRESS.md` | PASS |

## 3. Business-path sampling interpretation

The generic acceptance template asks for an end-user business closure such as “initiate → approve → execute → accept → write-back → archive”. PHASE-06 is deliberately **not** a business-process phase, so inventing such a path would be false evidence.

The equivalent platform closure was therefore sampled instead:

```text
caller transaction
→ durable outbox/file/webhook evidence
→ independent Worker/provider boundary
→ Inbox/idempotency/retry handling
→ result/evidence persistence
→ immutable audit/trace
```

Negative paths sampled or revalidated include permission/data-scope denial, insufficient/replayed Step-Up, non-SAFE file rejection, duplicate event, concurrent Inbox claim, changed-content replay conflict, invalid webhook signature, provider failure, Worker restart and DLQ threshold.

## 4. Actions / test evidence

### Exact implementation candidate

```text
Candidate: d9a953c2da9bb560ed6c284a2adf1451ed09a7a4
Construction run: 31260482194 = PASS
Independent Formal Gate: 31260482190 = PASS
```

Independent Gate `31260482190` passed 9 jobs:

1. exact candidate source/scope/security preflight;
2. Java + C7 API/Worker/security regression;
3. PostgreSQL16 PHASE-06 C2–C7 regression;
4. PostgreSQL16 historical PHASE-05 regression;
5. real MinIO Document regression;
6. PHASE-04 IAM/Redis/HTTP/immutable-audit regression;
7. Web typecheck/test/build;
8. Windows Chinese-path completed-stage scripts;
9. final `PHASE-06 formal gate verdict`.

### Completed ledger HEAD revalidation

```text
Audited completed HEAD: a49c44b6c13e138e3ebe89602b96dca2b90b517f
Current-head regression: 31260752191 = PASS (8/8)
Historical PHASE-05 workflow: 31260752187 = PASS (5/5)
```

Run `31260752191` passed source/safety/fake-completion checks, full Java, PHASE-05 PG16, PHASE-06 PG16, real MinIO, C7 API/Worker/security, Web and final COMPLETE closeout verdict.

## 5. Gate correction provenance

The first READY candidate `e18894b8632e6fb81e52200dd30d8773e1d6102d` failed only the initial independent Gate whitespace preflight because repository-root `Construction Master Schedule.csv` contains pre-existing GB18030 line-ending/trailing-space facts. The follow-up Gate change excluded **only that canonical GB18030 CSV** from the generic whitespace diff while continuing to parse and validate its phase mapping separately. No production/runtime code was changed by that correction.

The corrected exact candidate `d9a953c2...` then passed both Construction and Independent Formal Gate.

## 6. Formal verdict

```text
PHASE GATE: PASS

Repository: louthison/PublicCompany
Branch: ChatGPT_Version_V0.05
Audited implementation / Gate candidate: d9a953c2da9bb560ed6c284a2adf1451ed09a7a4
Audited completed ledger HEAD: a49c44b6c13e138e3ebe89602b96dca2b90b517f
Tests: PASS
CI: PASS

PHASE-06 = COMPLETE
PHASE-07 = NOT_STARTED
```

## 7. Boundary after PASS

This acceptance report does **not** change the tested runtime candidate, does not merge `main`, does not convert the Draft PR to ready, and does not start PHASE-07. The report-only commit that records this independent acceptance must itself be pushed normally and its triggered regressions must remain green before the acceptance is considered fully recorded.
