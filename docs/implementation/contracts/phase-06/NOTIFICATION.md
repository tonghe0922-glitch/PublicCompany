# PHASE-06 C4｜Notification Template / Message / Delivery 工程合同

> Scope: `PLATFORM/基础工程`
> Approved truth: `notification.template`, `notification.message`, C2 `core.outbox_event/core.inbox_event`.

## 1. Message creation and idempotency

Message creation requires an active tenant transaction. A caller supplies an engineering request key; the service derives deterministic `message_no = MSG-<SHA256(tenant|requestKey)>`, then acquires a PostgreSQL transaction advisory lock for that identity.

- same request key + same template/recipient/channel/rendered content/schedule returns the existing message id;
- same request key + changed content fails closed;
- the approved `(tenant_id,message_no)` unique index remains the database backstop;
- no browser/in-memory message truth is used.

Immediate messages write `notification.message(status=PENDING)` and `NOTIFICATION_SEND` Outbox evidence in the same database transaction.

## 2. Safe template rendering

Only literal `{{variable}}` placeholders are supported. No expression/script evaluation exists.

`variables_schema` may define JSON Schema-style `properties` and `required` keys. Required/missing placeholders fail closed; when properties are declared, undeclared input variables are rejected. Replacement values use literal regex-safe replacement.

## 3. Scheduled messages

Future `scheduled_at` messages are persisted as PENDING without an Outbox event. `NotificationDueMessagePump` later enumerates ACTIVE tenants, enters the tenant transaction and calls `enqueueDue`, which locks due PENDING rows and writes the same deterministic `notification-send:<messageId>` Outbox event.

This intentionally does not misuse Outbox retry backoff as a long-term scheduler.

## 4. Delivery Worker and provider boundary

`NotificationDeliveryHandler` is a C2 `PlatformOutboxHandler` for `NOTIFICATION_SEND`, consumer `notification-delivery`.

Inside the Worker tenant transaction it locks the message and selects exactly one configured provider by channel. The provider receives the Outbox event key as its external idempotency key.

- no provider configured -> fail/retry/DLQ;
- provider rejects/throws -> fail/retry/DLQ and message stays PENDING;
- provider explicitly accepts -> message changes to `SENT` and gets `sent_at`, then Inbox SUCCESS + Outbox PUBLISHED commit in the same Worker DB transaction.

No fixed-success/default provider is supplied by the platform.

## 5. Important semantic boundary

`SENT` means the delivery provider accepted/submitted the send. It does **not** mean the recipient received/read the message.

Approved C4 DDL has no dedicated provider receipt/evidence table. Therefore C4 does not persist an invented receipt or hide provider truth inside uncontracted JSON. C5 Integration owns generic `endpoint/request_log/provider_event/webhook` evidence and closes the actual receipt/idempotency boundary.

A crash after remote provider acceptance but before PostgreSQL commit can cause a retry; provider implementations must honor the stable event idempotency key. C4 does not claim remote exactly-once.

## 6. Required validation

- immediate create persists PENDING + one Outbox atomically;
- same request replays to the same message, changed content conflicts;
- provider acceptance produces SENT, Inbox SUCCESS and Outbox PUBLISHED once;
- replay after publish does not call provider again;
- provider rejection never fabricates sent_at or receipt truth and follows C2 retry/DLQ;
- future message has no Outbox before due, then exactly one after due scheduling;
- runtime RLS prevents cross-tenant message visibility;
- C2/C3/PHASE-05 regressions remain green.
