# PHASE-08 SOURCE_CONTRACT

> Phase: `PHASE-08｜三端 Portal Shell、Router、导航、Session 与 API Client`
> process_code: `PLATFORM/Portal-Router-Session-API-Client`
> Repository: `louthison/PublicCompany`
> Branch: `ChatGPT_Version_V0.07`
> Contract state: `C0_FROZEN / PRE_START_VALIDATION`
> Previous phase: `PHASE-07 = COMPLETE / FORMAL_GATE_PASS`
> Next business phase: `PHASE-09 = NOT_STARTED`

## 1. Authority order

```text
AGENT.md
→ accepted ADR / OpenAPI / Gate-passed PHASE-04 IAM kernel
→ six Knowledge Base portal IA XLSX + unified IA governance
→ DESIGN.md
→ current Vue/Java implementation
```

No page title, existing placeholder shell, old prototype, or browser cache may invent permission, process, identity, business status, API path, or data scope.

## 2. Phase scope

Construction Master Schedule fixes PHASE-08 as:

```text
三端 Portal Shell、Router、导航、Session 与 API Client
scope = 三端壳
core gate = 三端可 build / login 壳
```

PHASE-08 builds shared front-end runtime infrastructure. It does **not** implement P001–P126 business closed loops and does not mass-promote page catalog records to IMPLEMENTED.

## 3. Portal identity

```text
canonical portal = employee / center / tech
runtime/build    = employee / center / admin
tech runtime alias = admin
```

No fourth `tech` runtime may be introduced.

## 4. Page IA actual parse contract

Current-head deterministic evidence:

```text
6 / 6 XLSX parsed
0 parse failures
7,126 PHASE-01 page records cross-checked
permission inference = FORBIDDEN
process inference = FORBIDDEN
```

Key parsed sources:

| portal | source | sheets | nonempty rows | normalized page records |
|---|---|---:|---:|---:|
| employee | `1-1 员工首页.xlsx` | 3 | 36 | 13 |
| employee | `1-2员工全层级页面.xlsx` | 5 | 1,875 | 1,630 |
| center | `2-1 中心首页.xlsx` | 3 | 40 | 15 |
| center | `2-2中心全层级页面.xlsx` | 7 | 2,894 | 2,620 |
| tech | `3-1技术-首页.xlsx` | 3 | 41 | 15 |
| tech | `3-2技术-全层级页面.xlsx` | 7 | 2,922 | 2,833 |

Evidence: `PAGE_IA_EXTRACT.json/.md`.

## 5. Router / navigation source contract

Accepted ADR: `ADR_004_ROUTE_CATALOG_STRATEGY.md`.

- Raw XLSX parse is the current source evidence.
- PHASE-01 page records provide normalized source keys/levels/metadata.
- Only pages actually implemented by PHASE-08 get real route implementation records.
- Business IA may be represented as planned taxonomy, never as clickable fake pages.
- `permission_codes` and `process_codes` require canonical sources; no source means empty/blocked.
- Router guard is UX only; API/RLS remains security authority.

## 6. Existing IAM HTTP contract

PHASE-08 consumes the existing PHASE-04 namespace; no parallel auth API is created:

```text
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/session
POST /api/v1/session/switch
POST /api/v1/step-up/tickets
```

OpenAPI is machine-completed in `docs/implementation/contracts/phase-04/openapi.yaml` with request/response/problem schemas derived from current Java records/controllers.

## 7. Session DTO contract

### LoginRequest

```text
tenantCode
loginName
password
identityId? nullable
```

### SessionTokenResponse

```text
accessToken
refreshToken
accessExpiresAt
refreshExpiresAt
tenantId
userId
identityId
employeeId
appointmentId
orgId
positionId
```

### SessionView

```text
tenantId
userId
identityId
employeeId
appointmentId
orgId
positionId
permissions[]
availableIdentities[]
```

### AvailableIdentityView

```text
identityId
identityType
identityName
orgId
positionId
primary
effectiveStartAt
effectiveEndAt
```

Candidate identities are read only through `IdentityDirectoryService.activeIdentities(currentTenant,currentUser)` and do not expose candidate permission grants or sensitive business data.

### ApiProblem

```text
status
code
detail
requestId
```

401/403/409/503 stay semantically distinct.

## 8. Identity switch contract

Accepted ADR: `ADR_001_SESSION_IDENTITY_CONTRACT.md`.

- `GET /session` exposes server-authorized active identity candidates.
- `POST /session/switch` remains the only switch command.
- Server revalidates identity + active appointment, issues a new session, and revokes the old family.
- Frontend must discard old token, permissions, navigation projection, and stale requests after a switch.

## 9. Browser credential contract

Accepted ADR: `ADR_002_BROWSER_TOKEN_PERSISTENCE.md`.

```text
access token  = memory only
refresh token = tab-scoped sessionStorage only
localStorage  = forbidden for credentials
```

Stored envelope contains only version + refreshToken + refreshExpiresAt. Password, access token, Step-Up assertion/ticket, complete SessionView, and sensitive business data are never persisted.

Restore is fail-closed on corrupt/unknown/expired data and uses one refresh single-flight path. No cross-tab token sharing.

## 10. API origin contract

Accepted ADR: `ADR_003_API_ORIGIN_PROXY.md`.

Browser requests use same-origin relative paths `/api/v1/...`.

Local portal dev servers proxy `/api` to `http://127.0.0.1:8080` by default; Node-only `SJG_LOCAL_API_PROXY_TARGET` may override the local target and is not exposed through client `import.meta.env`.

Production assumes same-origin reverse proxy until a future deployment/security ADR explicitly approves cross-origin behavior.

## 11. Unified API Client requirements

C1 must implement one shared client for all portals with:

- Bearer injection from in-memory access credential;
- optional explicit Step-Up ticket injection;
- typed `ApiProblem` mapping;
- 401/403/409/503 distinction;
- timeout + AbortSignal;
- request cancellation and stale-response protection integration;
- refresh single-flight integration point;
- retry only for safe/idempotent operations;
- non-idempotent write retry forbidden without explicit Idempotency-Key;
- no credential logging.

Pages may not concatenate API URLs or perform their own refresh loops.

## 12. Portal Session requirements

C2 must cover:

```text
anonymous
restoring
authenticated
refreshing
switching
expired
signed_out
error
```

Required behavior: login, current session, restore, corrupt/expired cache rejection, refresh rotation, single-flight, logout, identity switch, permissions refresh, old-session rejection and `can(permission)` UX helper.

## 13. Router and shell requirements

C3-C6 must evolve the existing `createPortalApp` / `PlatformShell` rather than create a parallel router or fourth portal.

At minimum:

- login route;
- protected shell route;
- forbidden route;
- not-found route;
- intended-route restore;
- router/global/component error handling;
- request cancellation on route/unmount;
- current portal/current identity UI;
- identity switch + logout;
- permission-filtered navigation based only on authoritative session facts and IA source metadata;
- no fake search/message/badge/KPI data.

## 14. Quality contract

PHASE-07 quality ratchet remains mandatory and PHASE-08 adds session/router/api regressions:

```text
vue-tsc / tsc
ESLint + complexity<=10 + max-depth<=3
jscpd
knip
circular dependency
Vitest + Vue Test Utils
three portal build
artifact secret/source-map/test-credential scan
Playwright desktop/mobile
backend IAM contract/integration regression
```

Key tests: login, restore, corrupt cache, expiry, concurrent refresh, 401/403, identity switch, old-session rejection, logout, intended-route, repeated action, request race/cancel, mobile/desktop shell.

## 15. Explicit exclusions

- no P001–P126 business page completion claims;
- no new business states/approvers/amounts/data scopes;
- no new DB/Flyway unless a separately approved platform contract proves necessity;
- no default/demo production account or login bypass;
- no localStorage token;
- no fake notification/search/todo/KPI;
- no automatic PHASE-09 work.

## 16. C0 exit criteria

```text
6 XLSX actual parse = PASS
OpenAPI DTO schema = FROZEN
identity discovery ADR = ACCEPTED
browser credential ADR = ACCEPTED
API origin ADR = ACCEPTED
route catalog ADR = ACCEPTED
backend session contract test = PASS
frontend typecheck/build after proxy change = PASS
C0 source contract gate = PASS
```

Only after these checks pass may `MASTER_PROGRESS` promote PHASE-08 from `NOT_STARTED` to `IN_PROGRESS` and C1 begin.
