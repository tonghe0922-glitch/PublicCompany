# PHASE-04 C5 CHECKPOINT

> Closure: `C5 Step-Up + MFA capability interface`
> Phase state remains `IN_PROGRESS`; PHASE-05 remains `NOT_STARTED`.

## Implementation evidence

Primary implementation commit: `af306ef8a3bf08daf0b17d96967110ba6a63c854`.
Audit-hardening commit: `83c4108c2b251a75081774f3334047dd269a8a0d`.

Workflow: `Phase 04 IAM Kernel`.
Primary implementation run: `31196712898` = `completed / success`.
Audit-hardening run: `31197100855` = `completed / success`.

Verified with real PostgreSQL 16 + Redis 7.4 and synthetic identities:

- Step-Up uses a 256-bit opaque ticket; Redis stores only its SHA-256 digest;
- ticket state is short-lived, one-time, replay-protected, and atomically consumed;
- ticket is bound to tenant/user/identity/employee/appointment/org/position plus purpose;
- expiry, replay, wrong identity/context and wrong purpose are fail-closed;
- authoritative `iam.user_account.mfa_level` must satisfy the requested level;
- MFA verification is an injected capability contract; the default capability implementation is fail-closed;
- no MFA secret table, secret field, OTP algorithm, default code, or production credential was invented;
- Step-Up success/failure/consume events require an audit sink;
- if critical audit persistence fails after ticket creation, the Redis ticket is revoked as compensation and the operation returns `AUDIT_UNAVAILABLE`;
- no raw ticket or MFA assertion is written into the audit event contract.

## Boundary

C5 does not implement P002 approval workflow or its business pages. HTTP endpoints, Spring Security filter-chain wiring, immutable audit-database adapter and OpenAPI are C6 responsibilities.

## Closure rule

This checkpoint commit must itself pass the same `Phase 04 IAM Kernel` workflow. After that success is observed, `C5 = CLOSED` and C6 may start.
