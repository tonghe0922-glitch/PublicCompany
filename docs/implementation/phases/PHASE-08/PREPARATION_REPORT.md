# PHASE-08 PREPARATION_REPORT

> 阶段：`PHASE-08｜三端 Portal Shell、Router、导航、Session 与 API Client`
> 状态：`PREPARATION_ONLY / NOT_STARTED`
> Repository：`tonghe0922-glitch/PublicCompany`
> Branch：`ChatGPT_Version_V0.07`
> Preparation fact baseline：`051893f7b47a35258eb03e04d1da94fa712cc93e`
> Previous phase：`PHASE-07 = COMPLETE / FORMAL_GATE_PASS`
> 禁止：本准备包不代表 PHASE-08 已开工，不修改 `MASTER_PROGRESS` 为 `IN_PROGRESS`，不提前施工 PHASE-09。

## 1. 阶段范围事实

根 `Construction Master Schedule.csv` 对 PHASE-08 的正式定义：

```text
名称：三端 Portal Shell、Router、导航、Session 与 API Client
范围：三端壳
核心门槛：三端可 build / login 壳
```

因此本阶段只建立三端运行壳与前端平台能力，不实现 P001–P126 的正式业务页面闭环。

## 2. 已核验前置条件

```text
PHASE-07 final fact baseline = 051893f7b47a35258eb03e04d1da94fa712cc93e
PHASE-07 final Formal Gate = 31268827178 SUCCESS
PHASE-07 = COMPLETE
PHASE-08 = NOT_STARTED
Draft PR #2 = OPEN / DRAFT / NOT_MERGED
```

## 3. 权威来源已定位

### 工程/设计

- `/AGENT.md` V1.2；
- `/DESIGN.md` V2.0；
- `/Construction Master Schedule.csv`；
- `docs/implementation/MASTER_*`；
- `docs/implementation/phases/PHASE-04/**` IAM/Session/HTTP security；
- `docs/implementation/phases/PHASE-07/**` Design System 最终合同。

### 页面 IA

- `Knowledge Base/01 完整的页面架构/00_三端页面IA统一规范.md`；
- `1-1 员工首页.xlsx`；
- `1-2员工全层级页面.xlsx`；
- `2-1 中心首页.xlsx`；
- `2-2中心全层级页面.xlsx`；
- `3-1技术-首页.xlsx`；
- `3-2技术-全层级页面.xlsx`；
- `01_portal_aliases.json` / page catalog schema / MASTER_PAGE_CATALOG。

本次准备已确认六份 XLSX 的 Git blob 与 IA 统一规范，但当前 GitHub Connector 对二进制 XLSX 不能直接完整解码。因此**正式把 PHASE-08 改为 IN_PROGRESS 前，必须再实际解析六份 XLSX 的 Sheet/层级列**；禁止只看文件名生成 Router。

## 4. 当前前端真实现状

### 4.1 三端入口

```text
src/portals/employee/main.ts
src/portals/center/main.ts
src/portals/admin/main.ts   # canonical tech 的 runtime alias
```

三端都通过共享 `createPortalApp(PORTALS.xxx)` 启动，没有第四套 tech 应用。

### 4.2 当前 Router

`src/platform/create-portal-app.ts` 已存在 Vue Router，但只有一个根路由 `/`，渲染 `PlatformShell`。这是工程骨架，不是 Knowledge Base 的正式 IA Router。

### 4.3 当前 Shell

`src/platform/PlatformShell.vue` 已真实消费 PHASE-07 的 `SgjPortalShell`，但正文仍是 PHASE-05 P016–P020 施工展示内容，并明确写着 Router / Session / API Client 尚未接入。

PHASE-08 应当**渐进拆分**：保留历史流程证据，不直接删除前序阶段成果；真正运行 Shell 改为 RouterView + Session/导航组合，旧 PHASE-05 展示可迁到明确的工程 evidence/dev 组件或受控页面。

### 4.4 当前缺失目录/能力

当前 `src` 顶层未发现正式的：

```text
session/
api/
contracts/
router/
validation/
```

所以 PHASE-08 不能在三个 portal 里分别复制实现；共享 Session/API/Contracts/Router infrastructure 应进入共享层。

## 5. 已存在的真实后端 Session / IAM 能力

PHASE-04 已经施工并 Gate PASS，PHASE-08 必须复用，不得另造登录真值。

### 已批准 HTTP 工程合同

```text
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/session
POST /api/v1/session/switch
POST /api/v1/step-up/tickets
```

认证使用 opaque Bearer token；Redis 只存 token digest；refresh rotation/replay protection、logout 撤销、身份切换后旧 session family 失效都已经由服务端实现。

### 当前 DTO 事实

Login request：

```text
tenantCode
loginName
password
identityId?
```

Session token response：

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

Current session response：

```text
tenantId
userId
identityId
employeeId
appointmentId
orgId
positionId
permissions[]
```

统一 security problem 基础：

```text
status
code
detail
requestId
```

## 6. 开工前已发现的关键合同缺口

### GAP-A：OpenAPI schema 不完整

`contracts/phase-04/openapi.yaml` 已有 6 个路径和安全定义，但主要只有 response description，没有把 Java 已存在的 request/response/problem DTO schema 完整机器化。

PHASE-08 的 API Client 必须类型化，因此第一小闭环应先根据**现有 Java DTO**补齐 OpenAPI/前端 contracts，而不是页面自己定义重复响应类型。

### GAP-B：身份切换缺“可选择身份”读取合同

服务端已有 `/api/v1/session/switch`，但当前 `GET /api/v1/session` 只返回当前身份与 permissions；前端无法从这个合同得到“有哪些可切换 identity”。

`IdentityRecord` 已有：

```text
id / identityType / identityName / orgId / positionId / primary / effectiveStartAt / effectiveEndAt
```

开工 C0 必须形成 ADR：扩展 current session response 或新增只读 session identity endpoint。只能暴露服务端已有事实，不自行发明岗位/组织权限。

### GAP-C：Token 持久化策略需要 ADR

规则明确禁止把 Token 放入 `localStorage`。后端当前返回 access/refresh token JSON，而 AGENT 又要求 `portal-session.ts` 覆盖刷新恢复、过期、损坏缓存和并发恢复。

因此开工前必须明确：

- access token 的内存生命周期；
- refresh token 的受控 tab/session 持久化方式，或是否调整后端为 HttpOnly cookie；
- logout/switch 时清理；
- 多 tab/并发 refresh 的单飞/冲突策略；
- 任何方案都不得把凭据写入 localStorage。

### GAP-D：API Origin / 开发代理未定

Web dev ports 为 5173/5174/5175，API 默认 8080；当前 Vite config 未形成 PHASE-08 的统一 API origin/proxy contract。正式施工必须确认：

- 本地开发是否以 Vite `/api` proxy 到 8080；
- 部署是否统一同源 `/api`；
- 如需公开 `VITE_*` 配置，只允许非敏感公开值；
- 不把 DB 地址、Token、服务凭据写入前端 env/build。

### GAP-E：正式 IA 路由必须实际解析 XLSX

`00_三端页面IA统一规范.md` 已明确 root legacy router 不是三端正式 IA 的唯一 Router。正式 route/menu 生成前必须实际解析六份 XLSX，并建立：

```text
portal_code
source_file / source_sheet / source_key
level_1 / level_2 / level_3
display_name
route_name / route_path
permission_code
process_codes
data_scope / sensitive_level
mobile_access
implementation_path / status
```

禁止中文标题自动转换 permission/process。

## 7. 推荐共享目录（开工候选，不是既成事实）

在当前 `technical-platform/web/src` 下优先渐进建立：

```text
contracts/       # 从现有 OpenAPI/服务端 contract 派生的稳定类型
session/         # portal-session / Pinia capability store / restore/switch/logout
api/             # unified client / problem mapping / retry / cancellation / idempotency
router/          # portal router factory / route meta / navigation projection
platform/        # app bootstrap / shell composition / error boundary
portals/
  employee/      # 端侧 route composition/策略
  center/
  admin/         # tech runtime alias，禁止再建第四套 tech
```

如果实施时决定改成 `frontend/packages/*`，必须先 ADR，并证明不造成第二套平行工程结构。

## 8. 建议施工小闭环顺序

### C0｜Contract Freeze

- 实际解析 6 份 XLSX；
- 补齐 IAM OpenAPI schema；
- 决定 identity discovery contract；
- 决定 token persistence ADR；
- 决定 API origin/dev proxy；
- 固化 route/session/api 错误模型。

### C1｜Unified API Client

真实验证：Bearer auth、Step-Up hook、problem mapping、401/403/409/503、timeout、AbortController、stale response protection、safe retry、Idempotency-Key。

### C2｜Portal Session

真实验证：login、current session、restore、refresh rotation、damaged cache、expiry、logout、concurrent refresh single-flight、identity switch、permission refresh。

### C3｜Router / Guard / Error Boundary

- 每端 router factory；
- route meta 从 IA catalog；
- 未登录跳登录；
- 登录后 restore intended route；
- guard 只做 UX，不替代 API auth；
- router/global/component error boundary；
- route change 取消请求。

### C4｜Navigation Projection

- 一级/二级 IA 来自 KB；
- route highlight；
- mobile full/limited/no；
- permission 只使用服务端 session permission contract；
- 待办 badge 只有真实服务端数据后才显示；
- 不因 tech/admin 赋予超级业务权限。

### C5｜TopHeader / Identity Switch / Session UX

当前 portal、当前 identity、switch、logout、401/403/expired 提示；switch 后刷新 permissions/navigation/data。搜索/消息没有真实合同则只保留受控槽位。

### C6｜Three-Portal Login Shell

核心 Gate：employee / center / admin(tech alias) 均可 build，均使用同一 API/session infrastructure，并有真实 login/protected-shell 路径。

### C7｜Quality / E2E / Artifact Gate

沿用 PHASE-07 的 vue-tsc、ESLint、complexity/max-depth、jscpd、knip、cycle、Vitest+VTU、Playwright、三端 build、artifact scan，并新增 login/restore/expired/401/403/switch/double-click/race/refresh consistency。

## 9. 前期准备结论

```text
PHASE-07 = COMPLETE / FORMAL_GATE_PASS
PHASE-08 = NOT_STARTED
PREPARATION = READY

Start blockers before IN_PROGRESS:
1. 六份 IA XLSX 实际 Sheet 解析
2. IAM OpenAPI DTO schema 补齐方案
3. identity discovery ADR
4. token persistence ADR
5. API origin/dev proxy ADR
```

上述 5 项完成并把 IMPACT/GAP 从“准备版”转为“施工版”后，才允许按固定开工提示词把 PHASE-08 改成 `IN_PROGRESS`。
