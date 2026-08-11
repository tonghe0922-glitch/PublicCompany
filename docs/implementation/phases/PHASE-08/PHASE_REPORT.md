# PHASE-08 PHASE_REPORT — FORMAL GATE PASS

> Repository: `louthison/PublicCompany`
> Branch: `ChatGPT_Version_V0.07`
> Phase state: `COMPLETE / FORMAL_GATE_PASS / INDEPENDENT_RECHECK`
> Scope: `PLATFORM/Portal-Router-Session-API-Client`
> Accepted implementation candidate: `48c3b822ed23f20565e331f3590a5209574f865e`
> Independent recheck workflow: `31290849170 / run_attempt=2 = PASS`
> PHASE-09: `NOT_STARTED`

## 1. 阶段名称

`PHASE-08｜三端 Portal Shell、Router、导航、Session 与 API Client`。

## 2. process_code

本阶段为平台工程范围：`PLATFORM/Portal-Router-Session-API-Client`，含 C0–C7。P001–P126 business implementation=`NO_CHANGE_REVALIDATED`；P001–P005 remain PHASE-09 `NOT_STARTED`。

## 3. 读取的 Knowledge Base 文件

实际解析六份页面 IA Excel：员工首页/员工全层级、中心首页/中心全层级、技术首页/技术全层级；同时读取 AGENT、DESIGN、统一 IA、PHASE-01 page/permission machine contracts、PHASE-04 IAM/OpenAPI 与 MASTER 台账。

## 4. Excel Sheet

六份 XLSX 由 `phase08_page_ia_extract.py` 实际解析：`6/6 parsed / 0 failures / 7,126 page records cross-checked`。导航派生记录 employee 885 / center 1,417 / tech 1,510；Sheet/源行以 `PAGE_IA_EXTRACT.json/.md` 为准。

## 5. Employee 页面

真实登录壳、protected shell、403/404/error UX、IA 导航、移动 BottomNav/更多、当前身份/退出已实现。protected home=`员工工作入口`，不展示 P-code/DB/API 工程证据，不制造业务状态、待办、消息、搜索、KPI 假数据。

## 6. Center 页面

中心端登录壳、protected shell、权限过滤 IA 导航、身份/切换/退出、403/404/error UX 已实现。protected home=`中心管理工作入口`，只展示平台运行壳能力和来源化职责，不伪造中心待办或经营数据。

## 7. Tech 页面

Canonical=`tech`，runtime/build alias=`admin`。protected home=`技术运行工作入口`；无第四 tech runtime；技术端不获得业务超级管理员默认权限。

## 8. API

不新增业务 API，消费批准 IAM 合同：login/refresh/logout/session/session-switch/Step-Up。Unified Client 统一 bearer、problem、timeout、AbortSignal、401 recovery、403 no-refresh、Idempotency-Key、安全 retry 与 stale-response fence。

## 9. Service

前端 Portal Session Runtime + Pinia store；后端继续使用现有 Login/Session/Identity/Permission 服务。SessionView 是身份、permissions、availableIdentities 的最终来源。

## 10. Repository

PHASE-08 不新增业务 Repository；继续使用既有 JDBC identity/session/audit adapters，真实 Testcontainers/live E2E 已验证运行连接。

## 11. Flyway

`NO_CHANGE`。本阶段无新 migration；现有 migrations 在 PostgreSQL16 live fixture 中真实执行。

## 12. 数据库

结构 `NO_CHANGE`；PostgreSQL16 + Redis7.4 作为真实 IAM/session/audit 运行事实源。PHASE-08 不新增 Schema/table。

## 13. Workflow

`NOT_APPLICABLE_NO_NEW_BUSINESS_WORKFLOW`。本阶段不引入 P-code 业务状态机。

## 14. Permission

route/nav/header 只做 UX projection；最终授权由 Spring Security/IAM/data scope/RLS。Identity switch UI 只在 SessionView 含 `platform.session.switch` 时显示。

## 15. ABAC

`NO_CHANGE_REVALIDATED`。身份切换后重新读取服务端授权事实，不复用旧身份权限。

## 16. RLS

`NO_CHANGE_REVALIDATED`。PostgreSQL RLS 仍是最终数据边界，前端不可放宽。

## 17. Step-Up

Unified Client 仅支持显式批准的 ticket/header 注入；没有来源化业务 Step-Up 页面动作时不制造假 UX。

## 18. Audit

独立 recheck live 链直接查询 audit DB：`actions=22`、`SESSION_SWITCH=1`、`AUTHORIZATION_DENIED=1`、`credential_hits=0`。

## 19. Outbox

`NOT_APPLICABLE_NO_NEW_OUTBOX`。

## 20. Worker

`NOT_APPLICABLE_NO_NEW_WORKER`。

## 21. Integration

真实验证 Browser → employee/center/admin Vite → same-origin `/api` → Spring Boot → PostgreSQL16/Redis7.4 → Audit DB。Synthetic password 每次运行随机生成并 mask。

## 22. 正常测试

独立 Formal Gate recheck：`31290849170 / run_attempt=2 PASS`。Source、static/unit/build/browser、PostgreSQL/Redis、live browser/audit、final verdict 全部 PASS。

## 23. 权限负向测试

未登录进入 login；refresh/switch 后旧 access token HTTP 401；无 switch permission identity 再切换 HTTP 403；planned/无权限/mobile=no 导航不出现；无第四 tech runtime。

## 24. 幂等

API Client unit test：非幂等写无 Idempotency-Key 不自动 replay；显式幂等请求才允许受控 replay。PHASE-08 无业务写入，不伪造业务幂等记录。

## 25. 并发

Session refresh single-flight；API client stale-response fence。业务数据库并发写=`NOT_APPLICABLE`。

## 26. E2E

Static Playwright：16 PASS。Live Playwright：7 PASS / 1 intentional duplicate mobile skip；覆盖三端真实 login/refresh/restore/logout，以及 desktop 深度 refresh rotation/switch/401/403/revoke。

## 27. 未运行测试

`NOT_RUN`：生产/预发布部署 E2E（PHASE-33）、真实生产凭据/个人敏感数据、性能/长稳与备份恢复（PHASE-34）、126 流程全量 UAT（PHASE-35）、todo/search/messages 真实集成（无批准 API contract）。

## 28. 未完成事项

PHASE-08 自有 DoD：无未完成项。todo/search/messages 是安全省略，保持 BLOCKED 而非 fake。P001–P126 业务施工属于 PHASE-09 onward。

## 29. 风险

- Vite 存在大 chunk 性能提示，留给后续性能/部署阶段；
- Actions Node runtime 与 Spring `@MockBean` 存在 deprecation warning，当前不影响正确性；
- 大量 business page records 仍 planned，只有后续真实业务闭环完成后才能激活；
- todo/search/messages 继续等待批准真实 API。

## 30. 回滚方式

通过正常 `git revert` 回退 PHASE-08 commits；禁止 force push/reset hard 覆盖他人历史。PHASE-08 无新数据库 migration，无数据库结构回滚。回退 Session/API Client 后必须重新执行 C0–C7 相关回归。

## Formal Gate history

```text
Initial candidate = 16171f3294aa03306618bc8e1207feb0683e482e
Initial Formal Gate = FAIL
Failures = GATE-F08-001 / 002 / 003
Gate fix code checkpoint = 8574ec9ac6f01bd51feddce34e22dc7831571301
Gate fix closeout / recheck candidate = 48c3b822ed23f20565e331f3590a5209574f865e
Independent recheck workflow = 31290849170 / attempt 2 / PASS
Formal Gate recheck = PASS
```

## Definition of Done

```text
employee/center/tech three builds = PASS
shared unique session/api-client = PASS
no fourth portal = PASS
three portal protected-home responsibilities = PASS
no static PHASE-05 engineering/business-state evidence in formal home = PASS
unimplemented pages no fake entry/data = PASS
MobileBottomNav/More = PASS
source/fake-completion gate = PASS
67 unit/component tests = PASS
static Playwright = 16 PASS
real backend live Playwright = PASS
PostgreSQL/Redis IAM = PASS
audit/redaction = PASS
PHASE-09 NOT_STARTED = PASS
PHASE-08 = COMPLETE / FORMAL_GATE_PASS
```
