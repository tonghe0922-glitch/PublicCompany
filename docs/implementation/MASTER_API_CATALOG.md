# MASTER_API_CATALOG

> 只记录 interface catalog 中明确给出的业务 HTTP method/path；不从流程名猜业务 API。经阶段合同批准的 engineering-only 平台/流程端点单独列示，不计入 PHASE-01 source business API-like records。

- Source Business API-like records: **0**
- Source machine: `contracts/phase-01/api_records.jsonl`

## PHASE-02 platform endpoints

- Source business HTTP API records remain **0**; PHASE-02 does not invent P001–P126 REST paths.
- Engineering-only Spring Boot Actuator endpoints are enabled for `health` and `info` on the API application; they have no `process_code` and are not business APIs.

## PHASE-03 API database runtime status

- Source business HTTP API records remain unchanged.
- API application database identity is `sjg_api_runtime`; Worker identity is `sjg_worker_runtime`.
- Runtime applications do not own Flyway migration capability; structure changes remain migration-runner work.

## PHASE-06 engineering-owned HTTP contracts

Approved by `docs/implementation/contracts/phase-06/PLATFORM_HTTP_SECURITY.md`; these have no P001–P126 `process_code` and do not change the source business API count.

| Method | Path | Purpose | Security truth |
|---|---|---|---|
| GET | `/api/v1/platform/files/{fileId}/download` | SAFE file short-lived signed download | session + `platform.file.download` + authoritative data scope + MFA2 Step-Up + immutable audit |
| POST | `/api/v1/platform/webhooks/{tenantId}/{endpointCode}` | provider webhook ingress to evidence + Transactional Outbox | provider signature + provider_event_id dedup; default verifier fail-closed |

The webhook route does not perform downstream work inline; Worker consumes the emitted Outbox event. All other undefined `/api/**` routes remain deny-by-default.

## PHASE-07 Design System API status

- Source Business API-like records remain **0**; PHASE-07 introduces no HTTP route and does not guess endpoints from page/component names.
- `StepUpReveal` is a front-end presentation/event contract only: it emits `requestReveal`/`conceal`; it never calls an API, creates a session, stores a token, or decides authorization.
- Router/Session/API Client were PHASE-08 scope and are now implemented by PHASE-08.

## PHASE-08 Portal Runtime API status

Source Business API-like records remain **0**. PHASE-08 consumes existing IAM/platform contracts and introduces no guessed P001–P126 business endpoint.

| Method | Path | PHASE-08 use | Final authority |
|---|---|---|---|
| POST | `/api/v1/auth/login` | Login shell establishes server session | backend LoginService/IAM |
| POST | `/api/v1/auth/refresh` | refresh rotation / restore | backend session store |
| POST | `/api/v1/auth/logout` | revoke server session then clear browser credential | backend IAM + audit |
| GET | `/api/v1/session` | authoritative SessionView + available identities + permissions | backend IAM/ORG |
| POST | `/api/v1/session/switch` | switch to a server-authorized identity and issue new credentials | backend permission/data scope |
| POST | `/api/v1/step-up/tickets` | approved Step-Up contract available to unified client; no fabricated business use | backend Step-Up policy |

### Unified API Client contract

- Browser paths are same-origin `/api/**`; no arbitrary external API path is accepted.
- Bearer access token injection is centralized; access token remains memory-only.
- Request cancellation uses `AbortController`; timeout and caller cancellation are distinct typed failures.
- 401 may enter one shared safe session-recovery path; 403 does not trigger refresh.
- Unsafe/non-idempotent writes are not replayed unless explicitly marked and supplied an `Idempotency-Key`.
- Problem responses are mapped to typed `ApiClientError` including status/code/requestId/retryable facts when available.
- Last-request-wins fencing prevents stale request completion from overwriting newer state.
- Step-Up header injection requires an explicit approved header name/ticket; PHASE-08 does not invent an `X-Step-Up-*` header convention.

### C7 proof

`31287803627 = PASS` proved the browser request chain through Vite `/api` proxy → real Spring Boot → PostgreSQL16/Redis7.4 and verified live login/refresh/switch/logout plus 401/403 negative paths.

## PHASE-09 approved engineering process HTTP contracts

PHASE-01 source API records remain **0**. The paths below are engineering identifiers explicitly approved and frozen by `docs/implementation/contracts/phase-09/PHASE09_HTTP_PERMISSION_CONTRACT.md`; they do not claim to be XLSX-origin HTTP paths. Business meaning, approval authority, data scope and state semantics remain source-backed.

### P001 — implemented / checkpoint closed

| Method | Path | Purpose | Authority |
|---|---|---|---|
| GET | `/api/v1/processes/P001/mfa/totp` | SELF TOTP status/version recovery | authenticated user + P001 MFA service |
| POST | `/api/v1/processes/P001/mfa/totp/enroll` | current-password reauth + enroll/re-enroll | SELF + reauthentication + idempotency |
| POST | `/api/v1/processes/P001/mfa/totp/confirm` | confirm TOTP | SELF + expectedVersion + TOTP |
| DELETE | `/api/v1/processes/P001/mfa/totp` | disable active TOTP | SELF + expectedVersion + current TOTP |
| GET | `/api/v1/processes/P001/sessions` | own or scoped monitored sessions | SELF or `p001.session.monitor` + server data scope |

P001 evidence: `P001_CHECKPOINT.md`, evidence SHA `efe3ef6b33cdde79c0a406dbcf8961bf18cc497c`.

### P002 — implemented / checkpoint closed

| Method | Path | Purpose | Authority |
|---|---|---|---|
| POST | `/api/v1/processes/P002/permission-requests` | submit permission request | `p002.request.submit` + SELF + Idempotency-Key |
| GET | `/api/v1/processes/P002/permission-requests/{id}` | scoped request read | `p002.request.read` + server data scope |
| GET | `/api/v1/processes/P002/permission-requests` | scoped request list | `p002.request.read` + server data scope |
| POST | `/api/v1/processes/P002/permission-requests/{id}/actions/review` | S03/S04/S05 server-allowed review | `p002.request.review` + workflow node + reviewer separation + expectedVersion |
| POST | `/api/v1/processes/P002/permission-requests/{id}/actions/execute` | S06 role grant execution | `p002.request.execute` + approved workflow node + expectedVersion |
| POST | `/api/v1/processes/P002/permission-requests/{id}/actions/revoke` | S07/S08 authoritative revoke | `p002.request.revoke`/review contract as applicable + workflow node + expectedVersion |

P002 does not accept arbitrary target status or client-declared risk. Requested-role risk, workflow transition, grant state and reviewer separation are resolved server-side. Exact idempotent replay is allowed; changing the key does not bypass separation or stale-version checks.

P002 evidence: `P002_CHECKPOINT.md`, run `31332029201 / SUCCESS`, evidence SHA `cdd58b3e7d93326ad4e48bc9c3b4f3460efaf6a6`.

### P003–P005 — contracted, not yet implemented at P002 close

The PHASE-09 contract already freezes engineering identifiers for P003–P005, but this catalog does **not** mark them implemented before their own checkpoints. Current legal next target is P003; P004/P005 remain NOT_STARTED.
