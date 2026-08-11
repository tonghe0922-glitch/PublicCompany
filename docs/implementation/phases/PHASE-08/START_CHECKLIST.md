# PHASE-08 START_CHECKLIST

> 用途：PHASE-08 正式开工硬门槛与 C0 关闭记录。
> 当前状态：`C0_COMPLETE / PHASE-08 ENTERING_IN_PROGRESS`
> C0 workflow：`31271339605 = PASS`

## A. Git / Phase 前置

- [x] Repository = `louthison/PublicCompany`
- [x] Branch = `ChatGPT_Version_V0.07`
- [x] PHASE-07 = `COMPLETE / FORMAL_GATE_PASS`
- [x] PR #2 remains Draft / unmerged
- [x] PHASE-09 = `NOT_STARTED`
- [x] 最新远端分支已重新核验并使用 fast-forward 提交

## B. Source 重新读取

- [x] `/AGENT.md`
- [x] `/DESIGN.md`
- [x] `/Construction Master Schedule.csv`
- [x] `docs/implementation/MASTER_PROGRESS.md`
- [x] `MASTER_TRACEABILITY.md`
- [x] `MASTER_PAGE_CATALOG.json` / PHASE-01 pages contract
- [x] `MASTER_PROCESS_CATALOG.json`
- [x] `MASTER_API_CATALOG.md`
- [x] `MASTER_PERMISSION_MATRIX.md`
- [x] `MASTER_DATABASE_MAPPING.md`
- [x] `MASTER_GAPS.md`
- [x] PHASE-04 IAM/Session contracts
- [x] PHASE-07 Design System final contracts

## C. Knowledge Base / XLSX

- [x] `1-1 员工首页.xlsx`
- [x] `1-2员工全层级页面.xlsx`
- [x] `2-1 中心首页.xlsx`
- [x] `2-2中心全层级页面.xlsx`
- [x] `3-1技术-首页.xlsx`
- [x] `3-2技术-全层级页面.xlsx`
- [x] Sheet 名称实际解析
- [x] source row/header/column 证据生成
- [x] level/page taxonomy 与 PHASE-01 page records 交叉验证
- [x] 7,126 page records cross-check
- [x] 禁止通过页面中文名猜 permission/process/data scope

证据：`PAGE_IA_EXTRACT.json/.md`；GitHub Actions `31270743856 = PASS`。

## D. C0 Contract Freeze

### D1 OpenAPI

- [x] login/refresh/logout/session/switch/step-up request/response schema
- [x] `ApiProblem` schema
- [x] 保持原 `/api/v1/*` namespace
- [x] SessionView 增加 `availableIdentities[]`
- [x] OpenAPI/source contract gate PASS

### D2 Identity discovery ADR

- [x] 采用扩展 `GET /session`，不新增平行 endpoint
- [x] 来源仅为当前 user 的 active `IdentityRecord`
- [x] 最小字段已冻结
- [x] switch 继续服务端重新校验并撤销旧 session
- [x] tech/admin alias 不扩大业务权限

### D3 Token storage ADR

- [x] access token = memory only
- [x] refresh token = current-tab `sessionStorage`
- [x] `localStorage` credential 禁止
- [x] logout/switch 清理规则冻结
- [x] cache corruption fail-closed
- [x] concurrent refresh single-flight 要求冻结
- [x] expiry/replay 处理要求冻结
- [x] HttpOnly cookie 留待完整 CSRF/CORS 安全 ADR，不半套迁移

### D4 API origin ADR

- [x] browser same-origin `/api`
- [x] local Vite `/api -> 127.0.0.1:8080`
- [x] Node-only `SJG_LOCAL_API_PROXY_TARGET`
- [x] production 默认同源反向代理
- [x] 构建产物继续 secret/source-map/test-credential scan

### D5 Route source ADR

- [x] raw XLSX current-head evidence
- [x] PHASE-01 normalized page records
- [x] 只为真正实现页面创建 active route
- [x] planned 业务 IA 不制造假页面
- [x] permission/process inference forbidden

## E. C0 验证

- [x] deterministic XLSX check PASS
- [x] C0 Python source contract PASS
- [x] Java API compile PASS
- [x] SessionController unit contract PASS
- [x] PostgreSQL16 + Redis7.4 PHASE-04 IAM integration PASS
- [x] frontend strict typecheck PASS
- [x] ESLint PASS
- [x] employee/center/admin build PASS
- [x] artifact scan PASS
- [x] C0 final verdict PASS

GitHub Actions：`31271339605 = PASS`。

## F. 正式施工顺序

```text
C1 Unified API Client
C2 Portal Session
C3 Router / Guard / Error Boundary
C4 Navigation Projection
C5 Header / Identity / Session UX
C6 Three-Portal Login Shell
C7 Full Quality / Integration / E2E
```

## G. 明确禁止

- [x] 不新建第四套 `tech` runtime
- [x] 不从中文页面名自动生成 permission/process
- [x] 不把 route guard 当安全授权
- [x] 不把 token/password/Step-Up assertion 写 localStorage/log
- [x] 不在三个 portal 各复制 API client/session
- [x] 不显示假待办、假消息、假搜索结果、假 KPI
- [x] 不创建 P001–P126 正式业务页面并标 implemented
- [x] 不提前进入 PHASE-09

## H. 正式开工条件

```text
latest remote synced = YES
PHASE-07 COMPLETE = YES
6 XLSX actual parse = YES
OpenAPI DTO schema = ACCEPTED / TESTED
identity discovery ADR = ACCEPTED / TESTED
token persistence ADR = ACCEPTED
API origin ADR = ACCEPTED / BUILD-TESTED
IMPACT_MATRIX = CONSTRUCTION VERSION
GAP_MATRIX = CONSTRUCTION VERSION
C0 = PASS
PHASE-09 = NOT_STARTED
```

结论：**允许 PHASE-08 进入 `IN_PROGRESS` 并施工 C1。**
