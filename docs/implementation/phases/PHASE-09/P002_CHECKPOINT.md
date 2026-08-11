# PHASE-09 P002 Checkpoint

> Process: `P002` 权限申请、复核与回收
> Checkpoint status: `PASS / CHECKPOINT_CLOSED / P003_UNLOCKED`
> Evidence branch: `ChatGPT_Version_V0.07`
> Evidence SHA: `cdd58b3e7d93326ad4e48bc9c3b4f3460efaf6a6`
> Closed at: `2026-08-10`

本文件只关闭 PHASE-09 的 P002 checkpoint。`PHASE-09` 仍为 `IN_PROGRESS`；P001、P002 已关闭；P003–P005 尚未完成；`PHASE-10` 继续 `NOT_STARTED / BLOCKED_UNTIL_PHASE09_GATE`。

## 1. 冻结流程与实际状态机

P002 按 C0 冻结合同接入现有 Workflow/IAM 核心，不创建第二套权限申请状态事实源：

```text
S02 填写申请
 → S03 业务负责人确认
 → S04 数据责任人复核
 → S05 高风险权限审批（仅 HIGH）
 → S06 权限生效
 → S07 定期复核
 → S08 到期/调岗/离职回收
 → END 已关闭
```

实现约束：

- 业务状态由服务端 P002 application service + published workflow version 驱动，前端不得传任意目标状态；
- `business_id / business_no / workflow_instance_id / version_no / grant_status` 均以 PostgreSQL 为唯一事实；
- HIGH 风险来自 requested role 实际 permission risk 聚合，不接受申请人自报风险降级；
- S03/S04/S05 的审批动作受服务端 workflow node 与 permission/data scope 双重限制；
- S04/S05 关键复核要求不同 employee；同一个 HTTP `Idempotency-Key` 的精确重放仍由业务幂等返回原结果，换新 key 不能绕过 reviewer separation；
- S06 才真正写 `iam.user_role`；审批通过不等于提前授权；
- S07 可进入回收，S08 完成权威撤销并关闭流程；
- 临时授权到期由 Worker 自动回收，失败进入 retry/DLQ，不能静默跳过。

## 2. 实际 API 与权限

P002 已真实接入冻结工程 HTTP 合同：

- `POST /api/v1/processes/P002/permission-requests`
- `GET /api/v1/processes/P002/permission-requests/{id}`
- `GET /api/v1/processes/P002/permission-requests`
- `POST /api/v1/processes/P002/permission-requests/{id}/actions/review`
- `POST /api/v1/processes/P002/permission-requests/{id}/actions/execute`
- `POST /api/v1/processes/P002/permission-requests/{id}/actions/revoke`

服务端权限：

- `p002.request.submit`
- `p002.request.read`
- `p002.request.review`
- `p002.request.execute`
- `p002.request.revoke`

所有写入要求 `Idempotency-Key` 与服务端版本/当前节点约束；过期版本、非法节点、越权 reviewer、重复但 body 不一致的幂等请求均 fail closed。

## 3. 三端真实路由

冻结 source binding 已真实落地：

- 员工端临时权限申请：`/employee/03/07/04`
- 员工端项目权限申请：`/employee/03/07/05`
- 中心管理端审批收件箱：`/center/02/01/01`
- 技术后台授权执行/回收：`/tech/03/01/04`

员工、中心、技术三端共用同一业务记录与 workflow/grant 事实；浏览器只显示服务端状态，不保存第二套审批或授权状态。

## 4. 数据范围、风险与职责分离

- Employee：SELF，只能看到/提交本人权限申请；
- Center：CENTER/冻结资源范围，跨中心对象不可读取；
- Tech：只获得授权执行/回收所需能力，不因技术身份自动获得业务审批权；
- applicant 无 `p002.request.review` 时直接审批返回 403；
- S04 与 S05 reviewer separation 以 `employee_id` 为主体执行，而不是只看账号/login；
- HIGH role 必须经过 S05；NORMAL 分支仍由服务端 workflow 条件决定，不允许客户端跳节点；
- stale `expectedVersion` 返回 409；已经关闭的申请不能再次 execute/revoke 产生第二份授权事实。

## 5. PostgreSQL / Workflow / Grant / Audit

P002 复用 canonical mapping：

- 主单：`iam.permission_request`
- 扩展项：`iam.permission_request_item`
- 授权链接：`iam.permission_request_grant`
- 实际角色：`iam.user_role`
- 流程实例/任务/动作：`workflow.wf_instance / wf_task / wf_action_log`
- 事件：`core.outbox_event`
- 审计：独立 `sjg_audit.audit.operation_log`

最终 live Gate 数据库事实：

```text
status=已关闭
grant=REVOKED
revoke_source=MANUAL
workflow=COMPLETED
start_actions=1
business_actions=7
approvers=3
outbox=7
audited=1/5/1/1
redis_keys=35
password_hits=0
```

其中 `start_actions=1` 是 WorkflowRuntimeService 创建实例时的 bootstrap START；P002 冻结业务迁移动作仍严格为 7 条，Gate 显式分开计数，禁止用“总数 8”掩盖业务动作漂移。

## 6. 自动过期、重试、DLQ 与通知

P002 temporary grant 的异步能力使用真实 PostgreSQL 与生产 Worker 代码验证：

- 到期 ACTIVE grant 由 `Phase09P002ExpiryWorker` 从 S07 推到 S08；
- 自动回收写 `grant_status=REVOKED`、`revoke_source=AUTO_EXPIRE`，并截断 `iam.user_role.effective_end_at`；
- 成功路径写 Workflow action/task、Audit 与 P002 Outbox，第二次 poll 不重复回收；
- 失败路径递增 `expiry_retry_count`；达到上限写 `integration.dead_letter` OPEN 记录与 critical audit；dead-lettered grant 不再被普通轮询重复消费；
- P002 notification handler 消费真实 `P002_PERMISSION_REQUEST_EVENT`，写 durable IN_APP message 与 `NOTIFICATION_SEND` outbox；精确重放保持幂等；不支持节点 fail closed/rollback；
- Worker 的 PlatformAuditWriter 使用独立 `sjg_audit` datasource/transaction manager，不再错误写入 `sjg_oms`。

## 7. Schema / Flyway 收口

P002 增量结构通过正式 overlay 管理：

- `V107`：P002 grant/expiry 所需结构；
- `V108`：expiry / notification 增量与到期索引；修复了对不存在 `permission_request_grant.is_deleted` 的错误引用；
- `V109`：revoke source guard；有 `revoked_by` 的人工回收归类 `MANUAL`，无 actor 的自动到期归类 `AUTO_EXPIRE`。

`iam.permission_request.target_job_id` 的 source schema 是 `varchar(32)`，语义为岗位编码，不是 UUID。真实 E2E 暴露生产 repository 曾写入 36 字符 `positionId.toString()`；已改为从 `org.position.position_code` 读取权威岗位编码后持久化，并在岗位缺失/停用时 fail closed。没有为迁就错误数据放宽数据库字段。

## 8. Unit / Integration / Negative / Idempotency / E2E

最终 Gate 覆盖：

1. 员工真实登录并从 employee route 创建 HIGH 权限申请；
2. 跨中心账号列表不可见，直接读取被服务端 data scope 拒绝；
3. applicant 无 review 权限不能审批；
4. stale review version 返回 409；
5. reviewer1 在 Center UI 完成 S03；
6. reviewer1 换新 key 尝试 S04 被 reviewer separation 拒绝；
7. reviewer2 完成 S04，同 key 精确重放返回同一业务结果；
8. reviewer2 换新 key 尝试 S05 被 separation 拒绝；
9. reviewer3 完成 HIGH S05；
10. stale tech execute 被拒绝；
11. Tech UI 在 S06 写真实 `iam.user_role`，进入 S07 ACTIVE；
12. Center UI 从 S07 发起回收进入 S08；
13. Tech UI 完成 S08 revoke，流程进入 END/已关闭；
14. closed request 再 execute 被拒绝；
15. PostgreSQL 后验验证 workflow、grant、user_role、outbox、audit、reviewer separation；
16. 测试密码在 audit 中命中 0；
17. Redis 使用真实 session runtime；
18. 自动到期 success + retry/DLQ + notification 均由真实 PostgreSQL integration checkpoint 验证。

## 9. 最终 Gate 证据

### PHASE-09 Full Construction Gate

- Run number: `63`
- Run ID: `31332029201`
- Head SHA: `cdd58b3e7d93326ad4e48bc9c3b4f3460efaf6a6`
- Scope/source contract: `SUCCESS`
- Vue TypeScript/lint/unit/build: `SUCCESS`
- Java unit + real PostgreSQL16/Redis IAM integration: `SUCCESS`
- P002 automatic-expiry PostgreSQL16 workflow/outbox/DLQ/notification checkpoint: `SUCCESS`
- P001 regression live Gate: `SUCCESS`
- P002 real permission workflow PostgreSQL Redis three-portal E2E: `SUCCESS`
- P002 live job: `93291693294`
- P002 live artifact: `9043215484`
- Final construction verdict: `SUCCESS`

P002 live final facts:

```text
request=34126c71-eb33-4fb5-98b0-6b876198cbf4
status=已关闭
grant=REVOKED
revoke_source=MANUAL
workflow=COMPLETED
start_actions=1
business_actions=7
approvers=3
outbox=7
audited=1/5/1/1
redis_keys=35
```

## 10. 真 Gate 发现并关闭的缺陷链

P002 不是以静态页面或 mock 数据验收。真实 PG/Redis/三端 Gate 连续暴露并关闭了以下问题：

- 修复 V108 expiry index 对不存在 `permission_request_grant.is_deleted` 的引用；
- 修复 `Phase09P002ExpiryWorker` 同类 schema 漂移；
- 增加真实 expiry success 与 retry/DLQ PostgreSQL checkpoint；
- 增加真实 notification PostgreSQL checkpoint；
- 修复 P002 reviewer separation 与精确 idempotency replay 的执行顺序；
- 修复 Worker audit 错用 `sjg_oms` datasource，改为独立 `sjg_audit`；
- 修复 expiry IT 的 workflow FK seed 顺序；
- 补齐真实 browser fixture 的 portal session read/logout 权限；
- `46d242d052...`：修复 expiry IT 把 36 字符 UUID 写进 `target_job_id varchar(32)`；
- `6df151c194...`：修复生产 `JdbcPermissionRequestRepository` 同一字段语义错误，改写权威 `position_code`；
- `cdd58b3e7d...`：修复 Gate 将 workflow bootstrap START 误算进 7 条 P002 业务动作，改为 START=1 + business actions=7 双重严格断言。

## 11. Checkpoint verdict

```text
P001 = CHECKPOINT_PASS / CLOSED
P002 = CHECKPOINT_PASS / CLOSED
P003 = NEXT / NOT_STARTED
P004 = NOT_STARTED
P005 = NOT_STARTED
PHASE-09 = IN_PROGRESS / NOT COMPLETE
PHASE-10 = NOT_STARTED / BLOCKED_UNTIL_PHASE09_GATE
```

P002 checkpoint 已满足真实页面、API、server permission/data scope、Workflow、IAM grant、PostgreSQL、Redis、Audit、Outbox、Worker、Notification、幂等、版本/并发、职责分离、负向验证、自动到期/DLQ 和三端 E2E 要求。允许进入 P003；不得因此宣告 PHASE-09 COMPLETE，也不得进入 P006+。
