# PHASE-04 IMPACT MATRIX

> Phase: `PHASE-04`
> Name: `Core IAM、组织、员工、任职、会话与权限内核`
> Scope/process_code: `PLATFORM/基础工程`
> Source processes used as kernel evidence: `P001 / P002 / P003`.
> Boundary: 本阶段只实现后续业务共用的身份、组织、会话、权限、Step-Up 与 RLS context 内核；不实现 P001/P002/P003 的完整业务页面、审批闭环，也不提前施工 PHASE-05。

## 1. Impact matrix

| closure | process_code | Employee 页面 | Center 页面 | Tech 页面 | Route | Permission | Data Scope | Sensitive Level | API | Application Service | Domain | Repository | 数据库 | Flyway | Workflow | Outbox | Worker | Audit | Notification | Integration | Unit Test | Integration Test | E2E |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C1 Source contract reparse | PLATFORM/基础工程；来源 P001/P002/P003 | 不新增业务页 | 不新增业务页 | 不新增业务页 | 无 | 从三端工作簿实际提取；未提取前禁止发明 | 从工作簿/权限规则实际提取 | P1/P2/P3 来源化 | 无 | 无 | 无 | 无 | 读取 IAM/ORG/HR 权威映射 | 无结构变更 | 无 | 无 | 无 | 无 | 无 | XLSX/CSV/DDL source validation | parser unit | source contract CI | N/A |
| C2 Identity + org authoritative model | PLATFORM/基础工程 | 无完整页面 | 无完整页面 | 无完整页面 | 无业务 route | 只使用来源化 role/permission/grant | 当前 employee/position/org scope | 姓名/手机号 P2；证件/密码 P3 | 内核查询接口，HTTP path 作为工程契约需 ADR/OpenAPI | identity/org query | User/Identity/Employee/Organization/Position/Appointment | Spring JDBC | `org.employee`, `org.employee_position`, `org.organization`, `org.position`, `iam.user_account`, `iam.user_identity`, `iam.user_role`, `iam.role*`, `iam.permission*` | 仅必要技术 overlay/seed；不改批准表语义 | 无业务流程 runtime | 无 | 无业务 handler | 所有身份/权限变化审计 | 无业务通知 | PostgreSQL 16 | model/evaluator unit | PG integration | N/A |
| C3 Session + current appointment switch | PLATFORM/基础工程；来源 P001 | 后续页面共享 session client，不做 P001 完整页 | 同左 | 同左 | 仅共享 auth/session guard；不建业务页面 route | endpoint 必须显式授权；public 只限登录/refresh 等明确白名单 | session 内绑定 tenant/employee/current appointment；切换后重算 scope | token/password P3，不写日志 | login/session/refresh/logout/current-appointment switch | SessionApplicationService | SessionContext / CurrentAppointment | JDBC + Redis session store | DB 权威身份；Redis 仅临时 session/refresh，非业务事实源 | 如需索引/技术约束用新 migration | 不实现 P001 业务状态机 | 无 | 无 | 登录、刷新、切换、过期、登出审计 | 无 | Redis + PostgreSQL | token/session unit | Redis+PG integration | auth flow E2E/API test |
| C4 RBAC + ABAC + RLS context | PLATFORM/基础工程；来源 P001/P002/P003 | 前端仅消费服务端权限结论 | 同左 | 技术端不是超级业务管理员 | shared guard only | `iam.permission / role / role_permission / user_role` | org path / center / owner / appointment / rule expr | P2/P3 字段需服务层 field permission | protected API authorization | AuthorizationService | PermissionDecision / DataScope | JDBC | IAM/ORG + PostgreSQL RLS | 仅必要 overlay | 无业务审批 | 无 | 无 | allow/deny 均可审计 | 无 | `SET LOCAL app.tenant_id` 等 transaction context | evaluator unit | 401/403/cross-employee/cross-center PG tests | protected API E2E |
| C5 Step-Up + MFA capability interface | PLATFORM/基础工程；来源 P002/安全规则 | 不做完整权限申请页 | 不做完整复核页 | 不做技术越权入口 | 无业务 route | 高风险权限授予等需 Step-Up | scope 继承当前 session | MFA/credential P3 | Step-Up ticket issue/verify capability | StepUpService | StepUpTicket / MfaCapability | Redis ticket store + JDBC identity read | `iam.user_account.mfa_level` 等批准字段 | 不新增 MFA secret 字段，除非来源明确 | 不实现 P002 审批状态机 | 无 | 无 | Step-Up 申请/通过/失败/过期审计 | 无 | 可插拔 MFA capability；未配置 provider 时 fail-closed | ticket unit | expiry/replay/identity-bound tests | security API E2E |
| C6 API security / contract / regression | PLATFORM/基础工程 | 三端共享 client/contract；无完整业务 UI | 同左 | 同左 | route guard 只做体验门禁 | 所有非 public `/api/**` 显式 permission coverage | 服务端决定 scope | 响应字段过滤 | OpenAPI/Problem Details/401/403 | filter/interceptor/annotation | security boundary | 无业务 Repository | 不新增业务表 | 无 | 无 | 无 | 无 | correlation/request/session/identity audit | 无 | Spring Security + Redis + PostgreSQL | security unit | PG/Redis/API integration | login→switch→authorize→expire/logout |

## 2. Authoritative sources already located

- Formal PHASE-04 prompt: `Core IAM、组织、员工、任职、会话与权限内核`.
- `Knowledge Base/00 企业架构及员工/01 企业组织架构数据表.xlsx`.
- `Knowledge Base/00 企业架构及员工/02 员工的真实工号.xlsx`.
- P001/P002/P003 employee/center/tech workbooks under `S1 三端业务流程表单字段包/*/01_平台公共能力/`.
- P001 → `iam.login_session`; P002 → `iam.permission_request`; P003 → `hr.employee_profile_change` from PHASE-01 parsed mapping.
- `Knowledge Base/03 数据库需求规则/03_SQL_DDL/01_sjg_oms/25_iam_tables.sql`.
- `Knowledge Base/03 数据库需求规则/03_SQL_DDL/01_sjg_oms/35_org_tables.sql`.
- `Knowledge Base/03 数据库需求规则/03_SQL_DDL/01_sjg_oms/24_hr_tables.sql`.
- `Knowledge Base/03 数据库需求规则/01_架构设计/05_权限敏感与审计规则.md`.
- PHASE-03 formal Flyway/RLS/runtime-role baseline.

## 3. Hard boundaries

1. **XLSX reparse gate**: product/runtime code starts only after the 11 relevant workbooks are actually reparsed on the current branch and focused source evidence is generated.
2. 不把 `iam.login_session` 业务过程表误当作 Redis session token store；业务事实与短期安全会话分离。
3. Redis 仅承载可重建的 session/refresh/Step-Up 临时状态，PostgreSQL 继续是身份、组织、任职、角色、权限事实源。
4. 不把技术后台角色当成业务超级管理员。
5. 不为 MFA 擅自新增 secret 表/字段；本阶段只实现来源允许的能力接口和 fail-closed Step-Up 基础。
6. 不把真实员工姓名、工号、手机号、证件信息复制进测试 fixture；测试只用虚构数据。
7. 当前源 `interface_catalog` 没有 HTTP method/path；若 PHASE-04 需要平台技术 API path，必须作为明确工程 ADR/OpenAPI 契约记录，不能伪称为 Knowledge Base 原始 API path。
8. 不进入 PHASE-05 workflow/form/SLA runtime。
