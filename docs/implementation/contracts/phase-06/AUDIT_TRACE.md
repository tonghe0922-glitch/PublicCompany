# PHASE-06 C6 — Immutable Audit / Correlation / Trace Contract

## Durable truth

`PlatformTraceContext` contains a `correlation_id` and `trace_id` pair. Thread-local propagation is only an in-process convenience; durable truth is stored in PostgreSQL evidence so a Worker restart does not lose the chain.

C6 V105 persists the pair in `core.outbox_event`, `core.inbox_event`, `integration.request_log`, `integration.webhook_event` and `integration.dead_letter`. C6 audit V100 persists the same pair in the approved append-only `sjg_audit.audit.*` tables. Pair constraints reject half-populated trace evidence. Historical rows may retain both values as NULL.

## Async/provider propagation

1. An entry point opens a `PlatformTraceContext`.
2. Transactional Outbox stores the pair with the event.
3. Worker reloads the pair from Outbox after restart and opens a scoped context before Inbox claim and handler execution.
4. Inbox stores the same pair.
5. `IntegrationHttpClient` sends `X-Correlation-Id` / `X-Trace-Id` and stores the same pair in `request_log`.
6. `WebhookIngressService` stores the active pair with inbound provider-event evidence; its downstream Outbox inherits the pair.
7. Dead-letter evidence retains the original Outbox pair.
8. `PlatformAuditWriter` stores the active pair in immutable audit evidence.

## Immutable audit and failure policy

The runtime audit principal remains `sjg_audit_writer`: INSERT/SELECT only; UPDATE/DELETE/TRUNCATE remain denied and tenant RLS remains active. No mutable audit table or browser-side audit truth is introduced.

`PlatformAuditWriter.appendCriticalOperation`, `appendCriticalAccess`, and `appendSecurityEvent` are fail-closed: database write failures propagate to the caller. Critical security, sensitive access, export, state-transition and provider side-effect flows must use a critical method and must not continue after an audit write failure.

`tryAppendOperation` is an explicitly named noncritical escape hatch only. It converts a write exception to `false`; callers must opt into this behavior deliberately. It must never be used to weaken a critical action.

## Scope boundary

This contract adds only platform trace/audit engineering metadata. It does not implement P021–P025 business processes, does not create a second audit store, and does not start PHASE-07.
