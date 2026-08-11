# PHASE-09 Engineering HTTP / Permission Contract

> Status: C0 FROZEN + A1/A2 P001 SECURITY AMENDMENTS
> Scope: P001–P005 only. These are engineering HTTP identifiers mapped to source-backed process actions. They do not add new business states, approvers, or data scope.

## 1. Rules

- All business routes remain same-origin `/api/v1/processes/{processCode}/...` and require an authenticated server session unless explicitly noted.
- Every write requires `Idempotency-Key`; replay with the same business body returns the original business result, while a mismatched business body returns conflict. Authentication credentials used only for reauthentication are not persisted as idempotency facts.
- Every update/action requires an expected version/current-node guard. Stale writes return `409`.
- Server permission/data-scope checks are final; portal visibility is UX only.
- `business_id`, `business_no`, `process_instance_id` and server state are shared across employee/center/tech.
- No endpoint accepts arbitrary target status. Actions are process-specific and resolved by server-side workflow/domain rules.

## 2. P001

Existing contracts are retained as canonical runtime endpoints:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/session`
- `POST /api/v1/session/switch`

Phase-09 adds MFA enrollment/verification and security-monitoring endpoints:

- `GET /api/v1/processes/P001/mfa/totp` — SELF read-only status/version; never returns the TOTP secret.
- `POST /api/v1/processes/P001/mfa/totp/enroll`
- `POST /api/v1/processes/P001/mfa/totp/confirm`
- `DELETE /api/v1/processes/P001/mfa/totp`
- `GET /api/v1/processes/P001/sessions`

Login request gains optional `mfaCode`; accounts with `mfa_level > 0` fail closed when no valid code is supplied.

Permissions:
- self login/session view/switch: authenticated identity + existing IAM scope;
- `p001.session.monitor`: technical security monitoring only;
- MFA enrollment/disable: SELF + recent reauthentication/Step-Up policy.

### A1 read-only amendment — 2026-08-09

C0 remains frozen for business meaning, authority, scope and state. During P001 executable verification, restart-safe optimistic concurrency exposed a missing read path: after refresh/re-login the client could not recover the authoritative MFA `versionNo`, making the frozen `expectedVersion` guard unusable without browser-side state. A1 therefore adds only `GET /api/v1/processes/P001/mfa/totp` for SELF status/version recovery. It adds no business state, approver, write action, permission authority or data scope and never returns the TOTP secret. PENDING/DISABLED re-enrollment reuses the same unique credential row with a guarded version update; ACTIVE credentials cannot be overwritten.

### A2 reauthentication and rejection amendment — 2026-08-09

Executable security review showed that an ordinary access/refresh session timestamp cannot prove recent reauthentication because refresh-token rotation also creates a newly issued session context. P001 therefore does not treat session age or refresh possession as reauthentication.

For `POST /api/v1/processes/P001/mfa/totp/enroll` and any PENDING/DISABLED restart, the request includes the current account password only as an immediate reauthentication credential. The server resolves the authenticated `tenantId/userId`, verifies the password hash against that same active account, audits success/rejection, never stores or logs the raw password, and excludes the password from the business idempotency fingerprint. A bad/missing password fails closed with `401` before any credential row or secret is changed.

`POST .../confirm` proves possession of the newly issued TOTP secret. `DELETE .../mfa/totp` requires a valid code from the currently ACTIVE TOTP credential, so disable is itself protected by fresh MFA reauthentication. No refresh token or client-side timestamp can substitute for these checks.

MFA service rejections use the common Problem contract: invalid request `400`, rejected TOTP assertion `403`, scoped missing credential `404`, stale version/illegal state/concurrent mutation `409`, and cryptographic/runtime dependency failure `503`. Unhandled MFA failures must not fall through as `500`.

## 3. P002 permission request

- `POST /api/v1/processes/P002/permission-requests` — employee submit/draft start.
- `GET /api/v1/processes/P002/permission-requests/{id}` — scoped read.
- `GET /api/v1/processes/P002/permission-requests` — scoped list.
- `POST /api/v1/processes/P002/permission-requests/{id}/actions/review` — center review; action is server-allowed only.
- `POST /api/v1/processes/P002/permission-requests/{id}/actions/execute` — tech execution after approved workflow node.
- `POST /api/v1/processes/P002/permission-requests/{id}/actions/revoke` — authoritative revoke.

Permissions: `p002.request.submit`, `p002.request.read`, `p002.request.review`, `p002.request.execute`, `p002.request.revoke`.
Source scope: employee SELF; center CENTER/PROJECT/RESOURCE_SCOPE; tech execution/monitoring does not confer business approval power.

## 4. P003 profile change

- `POST /api/v1/processes/P003/profile-changes`
- `GET /api/v1/processes/P003/profile-changes/{id}`
- `GET /api/v1/processes/P003/profile-changes`
- `POST /api/v1/processes/P003/profile-changes/{id}/actions/review`
- `POST /api/v1/processes/P003/profile-changes/{id}/actions/apply`

Permissions: `p003.change.submit`, `p003.change.read`, `p003.change.review`, `p003.change.apply`.
Employee scope is SELF. Sensitive P2/P3 proposed values are masked outside minimum necessary roles and are never logged in plaintext.

## 5. P004 generic request

- `POST /api/v1/processes/P004/generic-requests`
- `GET /api/v1/processes/P004/generic-requests/{id}`
- `GET /api/v1/processes/P004/generic-requests`
- `POST /api/v1/processes/P004/generic-requests/{id}/actions/{actionCode}`

Permissions: `p004.request.submit`, `p004.request.read`, `p004.request.act`.
`actionCode` is not a free target status: it must be one of the actions on the bound published workflow transition and must pass task assignment/anti-self-approval rules.

## 6. P005 notice / policy receipt

- `POST /api/v1/processes/P005/notices` — center authorized draft/create.
- `GET /api/v1/processes/P005/notices/{id}`
- `GET /api/v1/processes/P005/notices`
- `POST /api/v1/processes/P005/notices/{id}/actions/publish`
- `POST /api/v1/processes/P005/notices/{id}/receipts` — employee read/confirm/receipt; read and confirm are distinct facts.
- `POST /api/v1/processes/P005/notices/{id}/actions/archive`

Permissions: `p005.notice.create`, `p005.notice.publish`, `p005.notice.read`, `p005.notice.receipt`, `p005.notice.archive`.
Notice audience is server-resolved; old versions remain immutable/history-visible. Notification delivery is a side effect and never substitutes for receipt or business completion.

## 7. Error contract

Use RFC7807-style typed Problem responses already consumed by the PHASE-08 unified API client:
- 400 invalid request / illegal attachment metadata
- 401 unauthenticated/expired credential or failed explicit reauthentication
- 403 permission/data-scope/Step-Up/MFA assertion failure
- 404 scoped not found
- 409 stale version, idempotency mismatch, illegal state/action, self-approval conflict
- 422 source-backed business validation failure
- 503 required dependency/audit/outbox unavailable when fail-closed is required

## 8. Engineering-identifier rationale

PHASE-01 `api_records.jsonl` is empty and the XLSX interface sheets provide interface capabilities (`I01...`) rather than HTTP paths. Therefore the `/api/v1/processes/P00X/...` paths and `p00x.*` permission-code strings are explicit PHASE-09 engineering identifiers. The business meaning, role boundary, data scope, state/action semantics and sensitive handling remain sourced from the 15 XLSX workbooks and canonical database mapping; no permission scope or approval authority is inferred from the identifier text.
