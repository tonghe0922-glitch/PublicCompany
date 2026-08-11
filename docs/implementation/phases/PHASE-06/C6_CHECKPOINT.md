# PHASE-06 C6 CHECKPOINT — Immutable Audit / Correlation / Trace

> State: `COMPLETE`
> Candidate SHA: `14032c4047302cc71cf51d19cfeb5e9f81d6ca9c`
> PHASE-06 workflow run: `31258767713` — six jobs PASS
> Historical PHASE-05 workflow run: `31258767731` — five jobs PASS
> Next checkpoint: `C7 = IN_PROGRESS`

## Delivered

- OMS V105 persists `correlation_id / trace_id` in Outbox, Inbox, Integration request log, webhook event and dead-letter evidence; pair constraints reject half-populated trace facts.
- Audit V100 adds the same technical trace pair to all five approved immutable `sjg_audit.audit.*` tables without creating a parallel audit truth store.
- `PlatformTraceContext` is immutable; `PlatformTraceContextHolder` is only in-process propagation. Durable recovery truth is the database evidence pair.
- Transactional Outbox captures the active pair. Worker reloads the pair after polling/restart and opens it before Inbox claim and handler execution.
- Inbox, external HTTP request evidence, webhook evidence, webhook-created Outbox and DLQ preserve the same trace pair.
- `IntegrationHttpClient` sends `X-Correlation-Id` / `X-Trace-Id` to providers and persists the pair in `integration.request_log`.
- `PlatformAuditWriter` appends to approved immutable audit tables. Critical append methods propagate failures; only the explicitly named `tryAppendOperation` offers opt-in noncritical best effort.

## Real validation

`Phase06AuditTraceDatabaseIT` used a real PostgreSQL 16 Testcontainers instance with separate `sjg_oms` and `sjg_audit` databases and real runtime principals:

- `sjg_worker_runtime` created/published an Outbox event;
- Worker recovered persisted trace, wrote Inbox, called a real local HTTP provider, and provider observed the exact correlation/trace headers;
- `integration.request_log` and `audit.operation_log` carried the exact same pair;
- webhook evidence and the webhook-created Outbox carried the same pair;
- `sjg_audit_writer` had no UPDATE/DELETE privilege and an actual UPDATE was rejected;
- `sjg_auditor` could not INSERT; `appendCriticalOperation` surfaced the failure while `tryAppendOperation` returned false only through the explicit noncritical path.

## CI evidence

Run `31258767713` PASS:

1. PHASE-06 source/safety contract
2. Completed Java regression
3. PHASE-06 PostgreSQL C2-C6 side-effect and audit trace regression
4. PHASE-06 real MinIO Document storage regression
5. PHASE-05 PostgreSQL canonical regression
6. Completed Web typecheck/test/build

Run `31258767731` PASS retained all five historical PHASE-05 source/API/Java/PG/UI checks.

## Boundary

C6 does not add business workflow semantics, does not implement P021–P025, does not merge `main`, and does not start PHASE-07. C7 is limited to PHASE-06 API/Worker/security/Step-Up cross-module integration.
