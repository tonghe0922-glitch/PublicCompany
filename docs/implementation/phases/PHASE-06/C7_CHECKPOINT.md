# PHASE-06 C7 CHECKPOINT — Platform API / Worker / Security / Step-Up Integration

> State: `COMPLETE`
> Final candidate SHA: `1b50ba7dd8f93c574f812c1086f6f9a61974f817`
> PHASE-06 run: `31259948638` — seven jobs PASS
> Historical PHASE-05 run: `31259948630` — five jobs PASS
> Next checkpoint: `C8 = IN_PROGRESS`

## Delivered

- Engineering-only file download and webhook routes were added without inventing P001–P126 business APIs; `MASTER_API_CATALOG` keeps business API-like records at 0.
- API requests establish server correlation/trace context and return `X-Correlation-Id` / `X-Trace-Id`; C6 durable evidence remains authoritative across async boundaries.
- Signed file download requires Spring authority plus server `AuthorizationService.authorizeAction`, authoritative data-scope resolution, single-use Step-Up with minimum MFA level 2, immutable sensitive-access audit and the existing SAFE/signed-MinIO gate.
- The default file authorization target resolver is empty/fail-closed; PHASE-06 does not fabricate SELF/OWNER/ORG/POSITION ownership.
- Step-Up ticket consume now validates the stored required MFA level atomically. Legacy stores that cannot prove a positive minimum fail closed.
- Webhook HTTP ingress is session-permit-all only because provider signature is the authentication mechanism. The default signature verifier is explicitly fail-closed; valid first delivery writes evidence + Transactional Outbox, exact duplicate does not enqueue again, invalid signature returns 401 after evidence commits.
- `WebhookReceiptHandler` performs `RECEIVED -> PROCESSED` in the Worker process; HTTP ingress does not perform downstream work inline.
- Outbox/notification/webhook Worker configurations are guarded by `@ConditionalOnNotWebApplication`; API cannot start Worker pumps even if Worker properties are accidentally enabled.
- Undefined `/api/**` remains deny-by-default and runtime applications remain Flyway-free.

## Focused proof

C7 focused tests proved:

1. minimum MFA level is checked at Step-Up consume time;
2. API trace context spans the request and is cleared afterwards;
3. file guard requires permission + data scope + MFA2 + immutable audit;
4. missing authoritative file scope fails before Step-Up/audit;
5. audit failure escapes and therefore blocks signed URL issuance;
6. Worker webhook handler is the component that marks evidence processed and rejects mismatched aggregate types.

## Forward-fix history

Initial C7 candidate `dccf51319cef1f741d06a0c5ad6f3d5e143b6ec1` exposed an HTTP contract drift: a new global controller `AccessDeniedException` handler changed the established 403 code. Forward fix `b2b3c6c90081a8f47f78f0667906e97377c6b2c2` restored the `forbidden` code but still intercepted the existing Spring Security denial/audit chain. Final forward fix `1b50ba7dd8f93c574f812c1086f6f9a61974f817` removed that competing handler so the existing `SecurityProblemHandler` again owns 403 mapping and `AUTHORIZATION_DENIED` audit evidence. No test was weakened or removed.

## CI evidence

Run `31259948638` PASS:

1. PHASE-06 source/safety contract
2. Completed Java regression
3. PHASE-05 PostgreSQL canonical regression
4. PHASE-06 PostgreSQL C2–C6 side-effect/audit trace regression
5. real MinIO Document storage regression
6. C7 API/Worker/security/Step-Up focused regression
7. Completed Web typecheck/test/build

Historical PHASE-05 run `31259948630` also passed source, Java, API/Spring Security, PostgreSQL canonical+historical, and UI regression.

## Boundary

C7 closes cross-module security/API/Worker integration only. P021–P025 remain outside PHASE-06. PHASE-07 remains NOT_STARTED. C8 must perform final complete real regression and prepare the exact READY_FOR_GATE candidate.
