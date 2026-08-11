# PHASE-06 C7 — Engineering HTTP / Worker / Security Contract

## Scope

The source interface catalog contains zero business HTTP records. C7 therefore adds only two **engineering-owned PLATFORM routes** with no P001–P126 `process_code`:

1. `GET /api/v1/platform/files/{fileId}/download`
2. `POST /api/v1/platform/webhooks/{tenantId}/{endpointCode}`

These routes are infrastructure capabilities, not inferred business APIs.

## Signed file download

- Spring Security requires `platform.file.download` before controller execution.
- `PlatformFileDownloadGuard` repeats server-side `AuthorizationService.authorizeAction` and authoritative `authorizeData`; coarse HTTP authority is never the only decision.
- `FileDownloadAuthorizationTargetResolver` is an SPI for later business modules to resolve the file's authoritative business scope. PHASE-06's default resolver returns empty and **fails closed**; it never fabricates SELF/OWNER/ORG/POSITION from the caller.
- All PHASE-06 signed downloads require a single-use Step-Up ticket with purpose `platform.file.download` and **minimum MFA level 2**. Approved source material defines internal sensitivity but no reliable public classification, so C7 does not invent a public level to weaken this gate.
- The Step-Up store now atomically checks the ticket's persisted `requiredMfaLevel` at consume time. Legacy stores that cannot prove the level fail closed for a positive minimum.
- Immutable `audit.access_log` persistence is mandatory before MinIO produces a signed URL. Audit failure escapes as service-unavailable and the URL is not issued.
- `platform.file.enabled` is opt-in; MinIO endpoint/access/secret must be explicitly configured. No credential is committed or given a demo default.

## API trace

`OpaqueAccessTokenFilter` establishes a validated/generative `correlation_id` plus a server-generated `trace_id` for the entire request chain, including permit-all webhooks. The IDs are returned in `X-Correlation-Id` / `X-Trace-Id`. C6 durable Outbox/Inbox/Integration/Audit columns remain the truth across async boundaries.

## Webhook ingress

- `POST /api/v1/platform/webhooks/{tenantId}/{endpointCode}` is permit-all at session layer because provider signature is the authentication mechanism.
- The default `WebhookSignatureVerifier` is explicit fail-closed (`false`). A deployment must provide the real verifier; no synthetic secret/default signature exists in source.
- Invalid signatures are persisted as `REJECTED` evidence and receive HTTP 401 after the tenant transaction commits.
- Valid first delivery persists evidence and Transactional Outbox and returns 202. Exact duplicates return 200 without another Outbox event; content-conflicting `provider_event_id` is rejected by the C5 service.

## API / Worker process boundary

HTTP ingress never marks a valid webhook `PROCESSED` inline. It only writes webhook evidence + Outbox. `WebhookReceiptHandler` runs in the Worker process and moves `RECEIVED -> PROCESSED` inside the existing tenant transaction/Inbox boundary.

PHASE-06 Worker configurations use `@ConditionalOnNotWebApplication`, so the API process cannot start an Outbox/notification/webhook Worker pump even if a Worker property is accidentally enabled.

## Deny-by-default

Only the two explicit engineering routes are opened. The existing final `/api/** -> denyAll()` remains. Runtime API/Worker applications remain Flyway-free. P021–P025 and PHASE-07 remain out of scope.
