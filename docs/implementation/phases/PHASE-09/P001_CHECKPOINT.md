# PHASE-09 P001 Checkpoint

> Process: `P001` 统一登录与多岗位身份切换
> Checkpoint status: `PASS / CHECKPOINT_CLOSED / P002_UNLOCKED`
> Evidence branch: `ChatGPT_Version_V0.07`
> Evidence SHA: `efe3ef6b33cdde79c0a406dbcf8961bf18cc497c`
> Closed at: `2026-08-09`

本文件只关闭 PHASE-09 的 P001 checkpoint。`PHASE-09` 仍为 `IN_PROGRESS`；`P002–P005` 尚未完成；`PHASE-10` 继续 `NOT_STARTED / BLOCKED_UNTIL_PHASE09_GATE`。

## 1. 冻结合同与实际落地

P001 按 C0 冻结合同实现并验证：

- 现有 IAM/Redis Session 继续作为唯一会话事实源，不创建第二套认证/session truth；
- TOTP 为冻结 MFA 方法，secret 使用 AES-256-GCM 加密后持久化；缺失合法 master key 时 fail closed；
- 登录请求支持可选 `mfaCode`，账户 `mfa_level > 0` 时无有效 TOTP 必须拒绝登录；
- MFA 状态与 `version_no` 从 PostgreSQL 读取，浏览器不保存第二套 MFA 状态；
- PENDING/DISABLED 凭据允许在同一唯一记录上版本受控重置，ACTIVE 凭据禁止覆盖；
- IAM `user_id` 只表示 MFA 凭据归属；通用幂等记录与 `created_by/updated_by` 使用会话 `employee_id`，避免把 IAM user 与 org employee 混为同一 actor；
- 绑定前执行当前密码重新认证；refresh token 不等价于 recent reauthentication；停用要求当前有效 TOTP；
- 关键写入均要求 `Idempotency-Key`，确认/停用均要求 `expectedVersion`；旧版本、重复/冲突请求由服务端拒绝；
- MFA 业务拒绝使用 typed Problem 响应，不以裸 500 代替 400/403/404/409/503 语义。

## 2. 实际 API

保留现有 canonical IAM API：

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/session`
- `POST /api/v1/session/switch`

P001 已真实接入：

- `GET /api/v1/processes/P001/mfa/totp` — 服务端 MFA 状态/version 查询；为解决刷新/重登后 version 不可恢复而做的显式契约补充；
- `POST /api/v1/processes/P001/mfa/totp/enroll` — 当前密码重新认证 + Idempotency-Key；
- `POST /api/v1/processes/P001/mfa/totp/confirm` — Idempotency-Key + expectedVersion + TOTP；
- `DELETE /api/v1/processes/P001/mfa/totp` — Idempotency-Key + expectedVersion + 当前 TOTP；
- `GET /api/v1/processes/P001/sessions` — 本人会话或经 `p001.session.monitor` + server data scope 过滤后的目标用户会话。

Spring Security 只放行**已认证**主体进入 `/api/v1/processes/P001/**`；业务权限与数据范围仍由 controller/application IAM 授权层做最终判定。未提前放行 P002–P005，更未施工 P006+。

## 3. 三端真实路由

路由来自 `PHASE09_PAGE_BINDINGS.json` 的显式 source binding：

- 员工端 MFA：`/employee/13/04/04`
- 员工端活动会话：`/employee/13/04/06`
- 中心管理端身份/会话监督：`/center/02/01/01`
- 技术后台端身份/安全监控：`/tech/03/01/01`

所有业务 route 运行在共享 `AuthenticatedPortalLayout` 内，保留统一 SessionHeader、身份切换、退出、侧栏/移动导航；不允许业务页脱离认证壳单独运行。

## 4. 权限与数据范围

- SELF MFA：仅当前已认证用户操作自己的 TOTP；
- `p001.session.monitor`：用于跨用户会话监控；
- Center/Tech 路由前端可见性只作为 UX，后端仍执行 `authorizeAction`；
- 跨用户会话读取继续执行 `authorizeData`；CENTER scope 只返回同中心目标会话；
- 跨中心目标返回空结果，不把无范围数据泄露成可见记录；
- 无 `p001.session.monitor` 的身份直接访问跨用户会话接口返回 403；
- 技术端没有因此自动获得后续业务审批权限。

## 5. PostgreSQL / Redis / Audit

真实 Gate 使用 Spring Boot + PostgreSQL 16 + Redis 7.4 + Audit 数据库：

- `iam.mfa_credential`：每用户 TOTP 唯一记录，状态 `PENDING / ACTIVE / DISABLED`，乐观 `version_no`；
- TOTP secret 只保存 AES-256-GCM ciphertext；CI 每次随机生成 32-byte master key、mask 后仅注入当前 fixture，不在仓库写默认密钥；
- Redis 继续保存真实 session family/access/refresh runtime；
- 审计记录 P001 reauthentication、MFA confirm/disable、session list 等动作；
- 测试密码不得出现在 `audit.operation_log` 或 `audit.security_event`。

最新 P001 live Gate 的数据库/审计/Redis最终事实：

```text
mfa_rows=1
active=1
level=1
reauth=3
confirmed=2
disabled=1
session_lists=8
rejected=1
password_hits=0
redis_keys=30
```

## 6. Workflow / History / Outbox / Notification 判定

P001 是 IAM 登录、MFA 与会话安全生命周期，不是需要业务审批状态机的申请流程：

- `WorkflowRuntimeService / workflow task / business_no / process_instance_id`：`N/A by P001 semantics`，未为了满足形式要求平行造第二套 workflow；
- Outbox/Worker/Notification：P001 当前冻结合同没有业务通知副作用，`N/A by P001 semantics`；
- Audit：适用且已真实接入并由 Gate 验证。

这属于“按流程语义不适用”，不是跳过应做能力。P002–P005 仍必须按各自冻结合同接入 Workflow/History/Outbox/Notification（适用时）。

## 7. Unit / Integration / Negative / Idempotency / Concurrency / E2E

最终真实 E2E 已覆盖：

1. 错误当前密码重新认证返回 401，且不创建 TOTP 凭据；
2. 员工端创建 TOTP → `PENDING`；
3. 正确 TOTP 确认 → `ACTIVE`；
4. 退出后无 MFA code 登录被拒绝；带当前 TOTP 登录成功；
5. 活动会话由真实 Redis Session runtime 返回；
6. 旧 `expectedVersion` 返回 409；
7. 错误 TOTP 返回 403；
8. ACTIVE 凭据禁止覆盖；
9. 同中心 monitor 可以读取目标会话；
10. 跨中心目标不可见；
11. 无 monitor 权限跨用户读取返回 403；
12. 停用 → `DISABLED` 且 version 增长；
13. 停用后在同一 credential row 重新绑定新 secret，并再次确认 ACTIVE；
14. 员工/中心/技术三端真实路由均在认证共享壳内回显；
15. PostgreSQL/Audit/Redis hygiene 检查通过，密码审计命中为 0。

## 8. 最终 Gate 证据

### PHASE-09 Full Construction Gate

- Run: `31313100002`
- Head SHA: `efe3ef6b33cdde79c0a406dbcf8961bf18cc497c`
- Scope/source contract: `SUCCESS`
- Vue TypeScript/lint/unit/build: `SUCCESS`
- Java unit + real PostgreSQL16/Redis IAM integration: `SUCCESS`
- P001 real MFA PostgreSQL Redis three-portal E2E: `SUCCESS`
- P001 live job: `93243949026`
- P001 live artifact: `9037962483`
- Final construction verdict: `SUCCESS`

### PHASE-08 completed-phase independent regression

- Run: `31313099992`
- Head SHA: `efe3ef6b33cdde79c0a406dbcf8961bf18cc497c`
- source contract: `SUCCESS`
- typecheck/lint/unit/duplicates/deadcode/build/artifact/static Playwright: `SUCCESS`
- real PostgreSQL16/Redis IAM regression: `SUCCESS`
- real Vite → Spring Boot → PostgreSQL → Redis → Audit three-portal E2E: `SUCCESS`
- final C7 construction verdict: `SUCCESS`

## 9. 真 E2E 发现并关闭的缺陷链

P001 checkpoint 不是一次“绿灯假验收”，专属 live Gate 连续暴露并关闭了真实缺陷：

- `068543b715...`：修复 PHASE-04 合成账号旧 MFA baseline；
- `faa20a8f0d...`：修复 PHASE-08 live fixture 与 P001 MFA 兼容；
- `d463c3ac47...`：补齐浏览器 MFA 登录入口；
- `90422171bc...`：MFA 状态/version 服务端恢复、刷新中断与停用后重绑；
- `172f97e299...`：当前密码重新认证与 typed MFA failure；
- `2585334866...`：加入真实 P001 三端 live Gate；
- `339bd64b3b...`：修复 P001 API 被 `/api/** denyAll` 提前 403 拦截；
- `2e651317d4...`：分离 IAM user ownership 与 employee audit/idempotency actor；
- `cc2ebc0204...`：Gate 注入临时随机 AES master key，不提供不安全默认值；
- `7c4d3ca07b...`：业务 route 纳入共享认证 Portal Shell；
- `ea53994366...`：PHASE-08 contract regression 适配共享认证布局但不降低检查；
- `d88c59b5d3...`：knip 纳入 P001 Playwright config 真实入口；
- `efe3ef6b33...`：默认静态 Playwright 与 PHASE-08/P001 专属 live suite 正确隔离，live tests 仍由独立真实后端 Gate 强制执行。

## 10. Checkpoint verdict

```text
P001 = CHECKPOINT_PASS / CLOSED
P002 = NEXT / NOT_STARTED at P001 close time
P003 = NOT_STARTED
P004 = NOT_STARTED
P005 = NOT_STARTED
PHASE-09 = IN_PROGRESS
PHASE-10 = NOT_STARTED / BLOCKED_UNTIL_PHASE09_GATE
```

P001 checkpoint 已满足本阶段对真实页面、API、server permission/data scope、IAM application/repository、PostgreSQL、Redis、Audit、幂等、并发/版本、负向验证和三端 E2E 的要求。允许进入 P002；不得因此宣告 PHASE-09 COMPLETE，也不得进入 P006+。
