# PHASE-08 SOURCE_CONTRACT_DRAFT

> Phase: `PHASE-08`
> Scope: `PLATFORM/Portal-Router-Session-API-Client`
> Status: `PREPARATION_ONLY / DRAFT / NOT_STARTED`
> Baseline: `051893f7b47a35258eb03e04d1da94fa712cc93e`
> 说明：本文件只冻结已验证事实、待决 ADR 与禁止项。正式施工前必须再次读取最新代码/KB，并把本 Draft 提升为施工 SOURCE_CONTRACT。

## 1. 权威优先级

```text
AGENT.md
→ 已批准 ADR / OpenAPI / 已 Gate 的 PHASE-04 IAM 内核
→ Knowledge Base 六份三端页面 IA + 统一 IA 规范
→ DESIGN.md
→ 当前 Vue / Java 实现
```

不得从页面标题、旧原型、当前单一路由或前端偏好自行发明权限、API、身份、状态或数据范围。

## 2. Portal 编码事实

```text
canonical: employee / center / tech
runtime/build: employee / center / admin
tech = admin runtime alias
```

禁止新建第四套 `tech` runtime 应用。

## 3. 当前后端认证/会话 HTTP 合同

以 `docs/implementation/contracts/phase-04/openapi.yaml` + 当前 Java Controller 为事实源：

### POST /api/v1/auth/login

Request：

```ts
interface LoginRequest {
  tenantCode: string
  loginName: string
  password: string
  identityId?: string | null
}
```

Response 200：

```ts
interface SessionTokenResponse {
  accessToken: string
  refreshToken: string
  accessExpiresAt: string
  refreshExpiresAt: string
  tenantId: string
  userId: string
  identityId: string
  employeeId: string
  appointmentId: string
  orgId: string
  positionId: string
}
```

### POST /api/v1/auth/refresh

Request：

```ts
interface RefreshRequest {
  refreshToken: string
}
```

Response：`SessionTokenResponse`。

### POST /api/v1/auth/logout

- Bearer required；
- no request body；
- 204 success；
- 服务端撤销 session。

### GET /api/v1/session

Response：

```ts
interface SessionView {
  tenantId: string
  userId: string
  identityId: string
  employeeId: string
  appointmentId: string
  orgId: string
  positionId: string
  permissions: string[]
}
```

### POST /api/v1/session/switch

Request：

```ts
interface SwitchRequest {
  identityId: string
}
```

Response：`SessionTokenResponse`。

服务端行为事实：切换后重新解析 active identity/appointment 并签发新 session；旧 session family 失效，前端不得继续复用旧 token/permission/data。

### POST /api/v1/step-up/tickets

Request：

```ts
interface StepUpRequest {
  purpose: string
  requiredMfaLevel: number
  assertion: string
}
```

Response：

```ts
interface StepUpResponse {
  ticket: string
  purpose: string
  requiredMfaLevel: number
  expiresAt: string
}
```

生产 MFA provider 未配置时服务端 fail-closed；前端不得提供绕过路径。

## 4. Security Problem 合同

当前 SecurityProblemHandler / ApiSecurityExceptionHandler 均输出：

```ts
interface ApiProblem {
  status: number
  code: string
  detail: string
  requestId: string
}
```

已出现稳定 code：

```text
unauthorized
forbidden
authentication_rejected
session_rejected
step_up_rejected
process_rejected
security_audit_unavailable
invalid_request
```

API Client 必须把未知/非 problem response 映射为明确 transport/protocol error，不得静默当成功。

## 5. HTTP 状态处理合同

```text
401 = Authentication/session invalid/expired/replay；不得解释为“无业务权限”
403 = 当前身份/permission/MFA 不允许；不得自动 logout 后伪装成 401
409 = session/process/step-up conflict；刷新服务端事实后再决定 UX
503 = 安全审计或依赖不可用；必须显示可恢复/重试边界，不得伪成功
```

## 6. API Client 强制合同

统一 client 必须具备：

- configurable same-origin/API base；
- Bearer header 注入；
- Step-Up ticket 注入能力，但只能由调用方显式提供；
- `Accept: application/json`，problem json 解析；
- request/correlation ID 传递策略（若后端批准 header）；
- AbortSignal；
- timeout；
- response body parsing boundary；
- 401/403/409/5xx typed mapping；
- refresh single-flight；
- stale response protection；
- safe retry policy；
- Idempotency-Key hook；
- 不在 log/error 中记录 access/refresh/password/assertion/ticket。

### Retry 禁止项

```text
POST/PUT/PATCH/DELETE 非幂等写：默认不自动重试
没有显式 Idempotency-Key：禁止把失败写请求自动重放
401：最多通过统一 session recovery path 处理，不允许每个页面独立 refresh
403：禁止 refresh 循环
```

## 7. Session 前端强制合同

`portal-session.ts` / capability store 至少覆盖：

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

必须具备：

- login；
- restore；
- current session fetch；
- refresh；
- refresh single-flight；
- logout；
- identity switch；
- permission refresh；
- stale/old session rejection；
- cache corruption fail-closed；
- route change/request cancellation integration；
- `can(permission)` 仅作 UI capability，API 仍服务端鉴权。

禁止长期缓存完整敏感档案、薪资、合同正文、身份证或银行卡。

## 8. Token storage — ADR REQUIRED

已确认：

- 后端返回 opaque access/refresh token；
- Redis 仅存 digest；
- AGENT 禁止 Token 放入 `localStorage`；
- portal-session regression 要求 restore/damaged cache/expiry/concurrency。

正式开工前必须形成 ADR，至少比较：

### Option A

```text
access token = memory only
refresh token = tab-scoped session persistence
```

要求：明确 XSS 风险、logout/switch 清理、损坏缓存、expiry 和多并发 refresh 处理；不得使用 localStorage。

### Option B

后端改为批准的 HttpOnly/SameSite cookie refresh 模式。

要求：需同步 Security/CORS/CSRF/OpenAPI/测试，不能在前端单方面假设。

PREPARATION 阶段不静默做不可逆选择。

## 9. Identity discovery — CONTRACT GAP

现有 `POST /session/switch` 只接收 `identityId`；`GET /session` 没有候选 identity 列表。

现有后端 `IdentityRecord` 已有事实：

```text
id
identityType
identityName
orgId
positionId
primary
effectiveStartAt
effectiveEndAt
```

PHASE-08 C0 必须形成 ADR，选择：

1. 扩展 `SessionView.availableIdentities[]`；或
2. 增加只读 `/api/v1/session/identities`。

只能返回当前 user 的 active identities；不能新增真实员工 grant，不得因 `admin` runtime alias 自动扩大权限。

## 10. Route / Navigation 合同

正式 route/menu facts 来自六份 KB Excel 和统一 IA 规范，至少追溯：

```text
portal_code
runtime_portal
source_file
source_sheet
source_key
level_1 / level_2 / level_3
display_name
route_name
route_path
permission_code
process_codes
data_scope
sensitive_level
mobile_access
implementation_path
status
```

### 强制边界

- route path 不表达“超级权限”；
- permission code 不能由 display_name 自动生成；
- guard 只改善体验，不是安全源；
- menu hidden 不代表 API denied；
- tech/admin 不自动看到全部业务；
- home/todo/KPI/badge 必须来自真实 read model/API，合同未具备时不渲染假数字；
- PHASE-08 只建立 shell/router/navigation infrastructure，不把 7,126 个 catalog 页面声明为业务 `IMPLEMENTED`。

## 11. Current Router migration boundary

现有 `createPortalApp`：

```text
createWebHashHistory
one route '/'
PlatformShell
```

PHASE-08 应演进这个真实入口，不另建第二套路由。`00_三端页面IA统一规范.md` 已明确 legacy root router 不能作为正式三端 IA 的唯一事实。

## 12. Global error / async state contract

必须准备：

```text
idle / loading / success / empty / partial / error / cancelled
```

具体 TypeScript 结构施工时确定，但状态语义不得丢失。

同时配置：

- Vue global error handler；
- Router error handler；
- component error boundary；
- request abort on route/unmount；
- last-request-wins or request sequence；
- no empty catch；
- no global one-bit busy for unrelated resources。

## 13. API Origin — ADR REQUIRED

当前事实：

```text
API_PORT=8080
EMPLOYEE_WEB_PORT=5173
CENTER_WEB_PORT=5174
ADMIN_WEB_PORT=5175
```

正式施工前决定：

- local Vite `/api` proxy；
- production same-origin `/api` 或批准的 public API base；
- only approved `VITE_*` public configuration；
- secrets/db credentials never exposed to frontend bundle。

## 14. Test Contract

### Unit/VTU

- api/client auth/error/timeout/cancel/retry/idempotency；
- portal-session login/restore/corrupt/expired/switch/logout/concurrent refresh；
- router guard/redirect/intended-route；
- navigation projection/permission filtering；
- shell current identity/permission UX。

### Integration/E2E

至少：

```text
employee build + login shell
center build + login shell
admin(tech) build + login shell
protected route unauthenticated -> login
login -> current session -> protected shell
401 -> controlled recovery / login
403 -> no-permission, no refresh loop
refresh -> old access invalid
identity switch -> old session invalid + navigation/session refresh
logout -> protected route inaccessible
refresh/reload consistency
double-click/login/switch single-flight
stale response race rejected
mobile + desktop
```

如真实 backend integration fixture 仍只存在于 Java integration suite，则前端 E2E 必须使用显式 synthetic test fixture/controlled test runtime，不得提交默认生产账号、密码或测试绕过。

## 15. Draft Exit Criteria

本 Draft 只有在以下条件满足后才能升级为正式 PHASE-08 `SOURCE_CONTRACT.md`：

```text
6 XLSX actual parse = DONE
identity discovery ADR = ACCEPTED
Token storage ADR = ACCEPTED
API origin ADR = ACCEPTED
OpenAPI DTO schemas = DECIDED/READY
route catalog strategy = DECIDED
PHASE-07 remains COMPLETE
PHASE-08 still NOT_STARTED until fixed start prompt executes
```
