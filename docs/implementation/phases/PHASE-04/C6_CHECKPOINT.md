# PHASE-04 C6 CHECKPOINT

> Closure: `C6 API security / contract / regression`
> Construction is complete and the phase is moving to `READY_FOR_GATE`; PHASE-05 remains `NOT_STARTED`.

## Implementation evidence

Primary C6 implementation commit: `c5c754c60b503e0f8901d4920b38b8911591a9ef` (`phase-04: implement C6 HTTP security boundary`).
Current validated construction head: `5ec106e24697e3e61a0e9f588d4fc62048dd1631`.

Workflow: `Phase 04 IAM Kernel`.
Final construction regression run: `31231985822` = `completed / success`, all 3 jobs PASS.

Cross-stage regression on the same head:

- `Phase 02 Build` run `31231985875` = 5/5 success, including Windows Chinese-path BAT smoke;
- `Phase 03 Database Baseline` run `31231985871` = 2/2 success;
- `Phase 03 Runtime Database Identity` run `31231985842` = 2/2 success;
- `Phase 03 Independent Gate` run `31231985837` = 5/5 success.

## C6 runtime facts independently exercised

- Spring Security is wired without Spring Boot's generated default user/password;
- public API surface is limited to login/refresh plus operational health/info; protected `/api/**` is deny-by-default;
- opaque access/refresh tokens are backed by Redis digest state rather than raw credential persistence;
- unauthenticated protected request returns 401 and an authenticated undefined/prohibited route returns 403;
- refresh rotates the session family and invalidates the prior access token;
- identity/appointment switch issues a new authorization context and invalidates the old session;
- access expiry returns 401 while a still-valid refresh can recover the session;
- logout revokes the session;
- production MFA capability is fail-closed when no approved provider is configured;
- security/operation events are appended to `sjg_audit` through `sjg_audit_writer`;
- raw access/refresh credentials are asserted absent from audit rows;
- audit writer UPDATE is rejected, preserving immutable application audit semantics;
- the engineering HTTP paths are documented in ADR/OpenAPI and are not misrepresented as Knowledge Base canonical URLs.

## Boundary

C6 does not implement the complete P001/P002/P003 business pages or approval workflows and does not start PHASE-05 workflow runtime. Business page/process catalogs remain unchanged.

## Closure

**C6 = CLOSED.**

The next action is the independent PHASE-04 Formal Phase Gate. No PHASE-05 construction may start before that Gate records PASS.
