# PHASE-06 C2｜Transactional Outbox / Inbox / Worker 工程合同

> Scope: `PLATFORM/基础工程`
> Ownership: engineering-owned platform contract derived from approved `core.outbox_event / core.inbox_event / integration.dead_letter` and PHASE-06 DoD.
> This contract defines no business process state, approver, amount, permission or external-provider success semantics.

## 1. Transactional Outbox

Business/application code writes an Outbox event only inside an existing database transaction through `TransactionalOutboxService`.

- The service MUST refuse calls without an active transaction.
- Business write and Outbox insert therefore commit or roll back together.
- `(tenant_id,event_key)` remains the approved database idempotency key.
- Same key + same aggregate/event/version/payload returns the existing event id.
- Same key + different content fails closed with conflict.
- Payload is stored in approved `jsonb`; event content is not kept in memory or browser storage as truth.

## 2. Inbox dedup without schema drift

Approved `core.inbox_event` is reused unchanged. PHASE-03's frozen 1,024-index baseline is not modified just to make Worker coding easier.

The generic `PlatformInboxService` provides cross-process database mutual exclusion with PostgreSQL transaction-level advisory locking. Its lock material is:

```text
tenant_id | consumer_name | event_key
```

For each claim:

1. acquire `pg_advisory_xact_lock(hashtextextended(...))` inside the tenant transaction;
2. read approved `core.inbox_event` evidence;
3. if exactly one `SUCCESS` record already exists, return duplicate/replayed without executing the handler;
4. if no record exists, insert `PROCESSING`;
5. after handler success, update the same row to `SUCCESS` before commit;
6. if the handler fails, the transaction rolls back, including the `PROCESSING` row and advisory lock.

The 64-bit advisory hash may serialize unrelated keys in the extremely unlikely event of a hash collision; that affects throughput only, not correctness. No `BYPASSRLS` or in-memory lock is used.

## 3. Worker/RLS model

The Worker does not use `BYPASSRLS`.

1. Enumerate `core.tenant` rows with `status='ACTIVE'` (the approved tenant root table has no tenant_id column).
2. Enter one `TenantTransactionRunner` transaction per tenant.
3. Select one eligible registered event with `FOR UPDATE SKIP LOCKED`.
4. Acquire Inbox dedup claim.
5. Execute exactly one registered handler for the event type.
6. Mark Inbox `SUCCESS` and Outbox `PUBLISHED` atomically.

Only event types with a registered handler are selected. If no handlers are registered, the generic pump is idle and cannot steal historical P018/P019 events.

## 4. Retry/backoff and Worker restart

C2 does not add a fabricated `next_attempt_at` source field. It reuses approved `retry_count` and `updated_at`:

```text
retry delay = min(max_backoff, base_backoff * 2^(retry_count-1))
```

Operational values are environment/configuration backed (`platform.outbox.*`) and are not business SLA rules.

A handler failure rolls back the processing transaction. A separate tenant transaction then increments `retry_count` and updates `updated_at`. Therefore:

- Worker process crash before commit leaves the event retryable;
- transaction-scoped advisory locks disappear automatically on rollback/disconnect;
- Worker restart can continue from PostgreSQL truth;
- no in-memory claim is required for recovery.

## 5. DLQ

When `retry_count` reaches the configured maximum:

- insert one approved `integration.dead_letter` row with `source_type='OUTBOX'`;
- preserve the event payload and failure evidence;
- transition Outbox `publish_status` to engineering operational state `DEAD_LETTER`;
- the normal dispatcher no longer selects the event.

The prior P018/P019 code already used `DEAD_LETTER`; C2 generalizes the same operational outcome without creating a new business state.

## 6. External side-effect boundary

C2 proves database/idempotency/worker reliability only. It does **not** claim exactly-once execution against an external provider. C4/C5 provider handlers MUST use event/request/provider idempotency evidence so a process crash after remote success cannot duplicate a provider action.

## 7. Required C2 validation

- caller transaction rollback removes its Outbox event;
- same event key replay is idempotent, changed content conflicts;
- Worker RLS hides another tenant's Outbox rows;
- two concurrent Inbox claims for the same consumer/event serialize in PostgreSQL and exactly one becomes the first processor;
- handler failure rolls back Inbox and handler DB effects;
- a new Worker instance can later process the same failed event;
- exponential retry counter is applied;
- retry threshold persists a DLQ row and stops redispatch;
- previous PHASE-05 canonical PostgreSQL regression remains green.
