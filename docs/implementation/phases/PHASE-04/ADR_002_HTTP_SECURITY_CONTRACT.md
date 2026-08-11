# ADR-002 — PHASE-04 HTTP security contract

## Status

Accepted for PHASE-04 engineering implementation.

## Source boundary

The current Knowledge Base `interface_catalog` and P001/P002/P003 workbooks define semantic system interactions, permissions, identity switching, MFA and audit requirements, but they do **not** define canonical HTTP methods or URL paths. Therefore PHASE-04 must not present implementation URLs as source facts.

## Decision

The platform defines the following technical API namespace as an engineering contract:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/session`
- `POST /api/v1/session/switch`
- `POST /api/v1/step-up/tickets`

The machine-readable contract is `docs/implementation/contracts/phase-04/openapi.yaml`.

## Security decision

1. Access and refresh credentials are opaque; Redis stores SHA-256 digests, not raw credentials.
2. Only login and refresh are public API operations. Health/info remain operational public endpoints.
3. Every other `/api/**` request is denied unless a more specific server-side permission matcher explicitly authorizes it.
4. HTTP authorization consumes server-side permission facts for the active identity. Appointment switching issues a new session and the prior session family is revoked.
5. Permission reads at the HTTP boundary execute with the full tenant/user/identity/employee/appointment/org/position transaction context so PostgreSQL RLS remains fail-closed.
6. 401 and 403 are distinct. A route guard or hidden UI element is never an authority source.
7. Security events and critical IAM operations write to the separate immutable `sjg_audit` database through `sjg_audit_writer`; critical audit persistence failure blocks or compensates the operation.
8. The application does not create a default local user, default password, demo bypass or production MFA secret.
9. The production MFA capability remains fail-closed until an approved provider is integrated; no secret schema or OTP algorithm is invented in PHASE-04.

## Scope boundary

This ADR provides the shared IAM/security API boundary only. It does not implement P001/P002/P003 workflow pages or PHASE-05 workflow runtime.
