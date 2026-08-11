# ADR-001｜PHASE-04 IAM Kernel Engineering Contract

Status: `ACCEPTED_FOR_PHASE_04`

## Context

PHASE-04 的 Knowledge Base 已明确业务语义，但没有提供 HTTP method/path，也没有定义 `iam.data_scope_rule.rule_expr` 的 JSON schema 或 scope code 字符串。PHASE-01 已明确 `interface_catalog.csv` 的 endpoint 是三端语义而不是 HTTP URL，因此不得把工程 API path 伪称为来源事实。

来源已明确：

- P001：统一认证/MFA、自然人与员工关系、当前任职、动作/数据/字段权限、会话持续校验、退出审计；
- R03：仅可访问**授权中心、部门、岗位或本人**数据；
- R07：P2/P3 最小必要展示，高风险查看/导出需要二次认证；
- P002：高风险权限必须经过业务负责人/数据责任人/高风险审批，技术端只做配置支撑/技术保障；
- P003 技术配置明确存在 `data_scope_rule / field_visibility_matrix / field_edit_matrix / step_up_auth_rule / four_eyes_enabled / masking_rules`；
- 数据库已批准 `iam.user_account / user_identity / user_role / role / role_permission / permission / data_scope_rule` 与 `org.*` 权威表。

## Decision

### 1. Source facts vs engineering codes

以下为 PHASE-04 **工程规范化代码**，不是 Knowledge Base 原始 code：

```text
SELF
CENTER
DEPARTMENT
POSITION
```

它们只编码 R03 已明确的四类数据范围语义，不新增业务范围。

允许的 `rule_expr` 最小结构：

```json
{"scope":"SELF"}
{"scope":"CENTER"}
{"scope":"DEPARTMENT"}
{"scope":"POSITION"}
```

任何其它结构、组合表达式、未知 scope、非对象 JSON 一律 `DENY / FAIL_CLOSED`。后续如业务正式批准更复杂 DSL，必须新 ADR + migration/config version，不能静默扩大本解释器。

### 2. Runtime fact sources

- PostgreSQL：账号、员工、组织、岗位、任职、身份、角色、权限、数据范围唯一权威事实源；
- Redis：仅保存可丢失重建的 opaque access/refresh token session 与 Step-Up ticket；
- `iam.login_session` 是 P001 **业务流程主表**，不得拿来冒充 token session store；
- API/Worker 继续使用 PHASE-03 的 NOBYPASSRLS runtime roles。

### 3. Authentication/session

- Bearer token 为 CSPRNG opaque token；Redis key 只使用 SHA-256 token digest，不存原 token；
- access/refresh TTL 配置化；refresh 必须 rotation；旧 refresh replay 拒绝；
- logout 撤销 access + refresh；
- 当前任职切换必须重新从 PostgreSQL验证 identity/employee/appointment 有效性并重新加载权限/范围；旧 access token 立即失效；
- 密码只验证批准字段 `iam.user_account.password_hash`，使用 Spring Security `BCryptPasswordEncoder`；禁止明文/默认密码。

### 4. Authorization

- 后端 deny-by-default；路由守卫只做前端体验；
- 权限来自 `user_role → role → role_permission → permission`；
- identity-specific grant 只对当前 identity 生效；global grant 的 `identity_id IS NULL` 可继承；
- `role_permission.condition_expr` 目前没有批准 schema：只有 NULL 或空对象允许进入 grant；任何非空条件一律 fail-closed，不绕过条件授权；
- ABAC：SELF 可直接按 employee_id 判断；CENTER/DEPARTMENT/POSITION 必须由上述已批准最小 `rule_expr` 和当前有效任职事实共同满足；
- P2/P3 字段访问必须经过 field-access decision，不允许通用 DTO 默认泄露。

### 5. Step-Up / MFA

- Step-Up ticket 存 Redis，短 TTL、绑定 tenant/user/identity/session/action、一次性消费；
- 当前 KB 没有批准 MFA secret 表/算法，本阶段**不新增 MFA secret 字段**；
- 定义 `MfaVerifier` capability interface；生产默认 provider 为 fail-closed；测试可注入显式 TEST_ONLY provider；
- 高风险权限/敏感操作没有 Step-Up 时拒绝，不因技术管理员身份绕过。

### 6. Engineering HTTP contract

以下 path 是 PHASE-04 平台工程 API 契约，**不是 KB 原始 HTTP URL**：

```text
POST /api/platform/auth/login
POST /api/platform/auth/refresh
POST /api/platform/auth/logout
GET  /api/platform/session
POST /api/platform/session/switch-appointment
POST /api/platform/step-up/tickets
POST /api/platform/step-up/tickets/{ticketId}/verify
GET  /api/platform/security/probe/self/{employeeId}
GET  /api/platform/security/probe/center/{centerId}
```

其中 security probe 仅用于 PHASE-04 内核集成验收，后续可由真实业务 API 替代；它不能读取业务敏感内容。

工程权限码同样是 PHASE-04 技术 contract，不是 KB 原始 permission code：

```text
platform.session.read
platform.session.switch
platform.session.logout
platform.stepup.issue
platform.stepup.verify
platform.security.probe
```

生产 grant 不在本阶段擅自分配给真实员工；集成测试只给 synthetic test role 授权。

## Consequences

- 不发明业务审批人、业务状态、真实员工授权或复杂 ABAC DSL；
- 可以在没有完整 P001/P002/P003 页面前先建立真实可测的 IAM kernel；
- 未知条件/范围默认拒绝；安全能力不会因资料缺口而默认放行；
- 后续正式业务 phase 必须使用该 kernel，而不是各模块自建鉴权。
