# PHASE-06 C5｜Integration Endpoint / Request Evidence / Webhook 工程合同

> Scope: `PLATFORM/基础工程`
> Approved truth: `integration.endpoint`, `integration.request_log`, `integration.dead_letter`; C2 Outbox/Inbox.

## 1. Minimal schema overlay

Approved V26 has outbound endpoint/request-log facts but no explicit inbound `provider_event_id/webhook` fact. V104 therefore adds:

- nullable `integration.request_log.provider_reference` for an external provider's request/acceptance reference;
- `integration.webhook_event` with tenant+endpoint+provider_event_id unique identity, event type, JSON payload, payload SHA256, signature result and processing status.

V104 enables/FORCEs RLS on the new table, uses a composite tenant+endpoint FK, and revokes runtime DELETE so provider-event evidence cannot be erased through normal API/Worker roles.

No correlation/trace fields are added in C5; those belong to C6.

## 2. Outbound HTTP request evidence

`IntegrationHttpClient` uses the approved endpoint URI/auth/timeout configuration and Java HTTP client. It performs one transport attempt per call; endpoint retry/circuit JSON is loaded/exposed as policy input but the generic transport does not silently invent hidden retry/circuit semantics.

Every transport attempt runs in a `REQUIRES_NEW` tenant transaction so `request_log` survives rollback of an outer notification/worker transaction. The stable `business_key` is sent as `Idempotency-Key`; `request_id` is the approved per-attempt unique identity.

- same request_id with changed endpoint/business/payload hash fails closed;
- a prior successful request with the same endpoint+business_key+payload suppresses a duplicate remote call;
- same business_key with changed payload after success fails closed;
- failed HTTP attempts are durably logged and may be retried with a new request_id while preserving the same provider idempotency key;
- `provider_reference` is evidence of provider acceptance/reference only, not final business delivery.

Non-`NONE` auth requires an explicit `IntegrationAuthProvider`. There is no embedded credential or allow-all auth provider.

## 3. Inbound Webhook/provider-event dedup

`WebhookIngressService` requires a provider-specific `WebhookSignatureVerifier`; the platform supplies no allow-all default.

For each `(tenant, endpoint, provider_event_id)` it takes a PostgreSQL transaction advisory lock and compares `event_type + payload_sha256`:

- first valid event -> `RECEIVED` evidence + one `INTEGRATION_WEBHOOK_RECEIVED` Outbox event in the same transaction;
- exact replay -> returns the existing evidence and creates no second Outbox event;
- same provider_event_id with changed content -> fail closed;
- invalid signature -> durable `REJECTED` evidence and **no** downstream Outbox event.

Valid received events can transition to `PROCESSED` or `FAILED`; REJECTED is terminal for normal processing.

## 4. Relationship to notifications

C4 `SENT` means a provider accepted/submitted the send. C5 now supplies durable outbound `request_log.provider_reference` and inbound webhook/provider-event evidence that real provider adapters can use for receipt state. It still does not equate an arbitrary webhook with a business-specific delivered/read state; later process modules interpret provider event types.

## 5. Required validation

- real HTTP socket receives `Idempotency-Key` and returns provider reference;
- successful business-key replay suppresses duplicate remote call; changed payload conflicts;
- failed attempts produce durable request_log rows and can retry;
- request logs obey runtime RLS;
- valid webhook creates exactly one provider-event row + one Outbox event;
- exact duplicate is suppressed; changed-content replay conflicts;
- invalid signature is REJECTED and never enters Outbox;
- new webhook table is RLS protected and runtime DELETE is denied;
- C2/C3/C4 + PHASE-05 regressions stay green.
