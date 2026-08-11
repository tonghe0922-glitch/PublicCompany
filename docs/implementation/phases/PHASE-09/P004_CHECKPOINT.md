# PHASE-09 P004 Checkpoint

> Process: `P004` 通用申请与审批
> Checkpoint status: `PASS / CHECKPOINT_CLOSED / P005_UNLOCKED`
> Evidence branch: `ChatGPT_Version_V0.07`
> Gate head SHA: `baf7b29f1b2796b4017e4f1e0cf2c13407e18c35`
> Closed at: `2026-08-10`

本文件只关闭 PHASE-09 的 P004 checkpoint。`PHASE-09` 仍为 `IN_PROGRESS`；P001–P004 已关闭；P005 尚未完成；`PHASE-10` 继续 `NOT_STARTED / BLOCKED_UNTIL_PHASE09_GATE`。

## 1. 冻结流程与实际状态机

```text
S02 填写申请与附件
 → S03 前置规则校验
 → S04 提交审批
 → S05 动态审批与会签
 → S06 批准后生成执行任务
 → S07 执行人提交结果
 → S08 独立验收
 → S09 异常补偿
 → S10 归档
 → END 已关闭
```

P004 复用 published `WorkflowRuntimeService`、`WorkflowFormService` 与 task assignment，不建立第二套自由状态机。客户端只能提交 `actionCode`，不能提交目标状态。主单使用既有 canonical `workflow.generic_request`；业务投影与 workflow instance/version 均由服务端维护。

初始表单固定为 `EMP-P004-F01`，绑定 P004/S02/version 1。表单提交会在 `wf_action_log` 记录独立的 `FORM_SUBMIT`；Gate 将其与 9 条源业务迁移分开核验。

## 2. API、权限与三端路由

API：

- `POST /api/v1/processes/P004/generic-requests`
- `GET /api/v1/processes/P004/generic-requests`
- `GET /api/v1/processes/P004/generic-requests/{id}`
- `POST /api/v1/processes/P004/generic-requests/{id}/actions/{actionCode}`

服务端权限：`p004.request.submit / p004.request.read / p004.request.act`。deny-by-default `SecurityFilterChain` 仅将 `/api/v1/processes/P004/**` 放入 authenticated API boundary；细粒度 permission 与 data scope 仍由 Controller/AuthorizationService 执行。

冻结路由：

- Employee：`/employee/03/07/01`
- Center：`/center/02/01/01`
- Tech：`/tech/05/03/01`

Employee 为 SELF 申请/读取；Center 在授权中心范围处理业务任务；Tech 仅监控/配置读取，不自动获得业务审批权。真实 Gate 后验验证 `TECH_ACTIONS=0`。

## 3. 职责分离、幂等与并发

- applicant 不得处理自己的 S03–S10 业务任务；
- S04 `SUBMIT_APPROVAL` 与 S05 `APPROVE` 必须由不同 employee 完成；
- S07 `SUBMIT_RESULT` 与 S08 `ACCEPT_RESULT` 必须由不同 employee 完成；
- workflow task candidate/assignee 由服务端解析，客户端不能指定审批人绕过规则；
- 每个写操作使用 `Idempotency-Key`，精确重放返回原资源；
- projection 使用 `version_no` 乐观并发控制，stale version 返回冲突，不允许换新 key 绕过职责分离；
- closed request 不允许继续迁移。

## 4. 隐私、Audit、Outbox 与 Notification

Tech metadata-only 响应在服务端将 `reason / requestedResult / resultSummary` 置为 `null`，不是只在 Vue 隐藏。P004 outbox payload 仅包含业务号、事件、action/node 与 recipient ids，不写自由文本 reason/result；Gate 使用私密哨兵值验证 outbox 命中为 0。

Canonical facts：

- 主单：`workflow.generic_request`
- Workflow：`workflow.wf_instance / wf_task / wf_action_log`
- Form：`workflow.wf_form_definition / wf_submission`
- Event：`core.outbox_event`
- Audit：独立 `sjg_audit.audit.operation_log`
- Notification：P004 worker handler 复用通知内核，不将业务自由文本复制到通知内容
- Session：真实 Redis runtime

## 5. 真实三端 E2E 与负向覆盖

最终 Gate 覆盖：

1. Employee 真实登录、填写 `EMP-P004-F01` 并创建申请；
2. cross-center list/get 受 data scope 隔离；
3. Tech 能看 metadata，但三个自由文本字段均为 `null`；
4. stale version action 返回 409；
5. applicant 无法处理自己的审批/执行任务；
6. actor1 完成 S03、S04；actor1 换新 key 尝试 S05 被职责分离拒绝；
7. actor2 完成 S05/S06/S07；
8. S08 验收必须由不同于 S07 执行人的 actor 完成；
9. S09/S10 继续按 published transition 完成并进入 END；
10. exact idempotency replay 不重复迁移/事件；
11. Tech 全流程 business action 数为 0；
12. PostgreSQL 后验核验 workflow/form/outbox/audit/privacy；Redis 为真实 session runtime。

## 6. 最终 Gate 证据

### 独立 P004 Live Gate

- Run number: `6`
- Run ID: `31362796230`
- Job: `93374896402 / SUCCESS`
- Artifact: `9053030760`
- Playwright: `1 passed`
- Final facts: `status=已关闭 / workflow=COMPLETED / actualAmount=111.11 / START=1 / businessActions=9 / FORM_SUBMIT=1 / approvalActors=2 / execAccept=2 / applicantActions=0 / techActions=0 / outbox=9 / privateHits=0 / form=1 / auditCreated=1 / auditActions=22 / passwordHits=0 / redis=30`

### PHASE-09 Full Construction Gate（P004 已成为 verdict 必需依赖）

- Run number: `100`
- Run ID: `31363467215`
- Head SHA: `baf7b29f1b2796b4017e4f1e0cf2c13407e18c35`
- Scope/source contract: `SUCCESS`
- Vue TypeScript/lint/unit/build: `SUCCESS`
- Java unit + PostgreSQL16/Redis IAM + PHASE-09 worker/notification integration: `SUCCESS`
- P001 real live regression: `SUCCESS`
- P002 real live regression: `SUCCESS`
- P003 reusable live regression: `SUCCESS`
- P004 reusable live job: `93376861706 / SUCCESS`
- P004 reusable artifact: `9053276684`
- Final construction verdict: `93377476140 / SUCCESS`

## 7. 真 Gate 发现并关闭的缺陷链

- Vue amount 输入可能是 number，原转换路径直接 `.trim()`；改为兼容 string/number；
- deny-by-default SecurityFilterChain 初始未登记 P004 authenticated boundary；补齐后仍由细粒度权限/data scope 控制；
- Tech metadata-only 初始漏清 `resultSummary`；改为服务端三字段全部脱敏；
- PostgreSQL JSONB `?` 运算符被 JDBC 当作第 3 个 bind 参数；改用 `->>` + `nullif`；
- nullable action payload 在 `CASE WHEN ? IS NULL` 中无法由 PostgreSQL 推断参数类型；改为显式 typed expression；
- P004 Playwright 单场景复杂度超过 lint 阈值；抽取 helper，不使用 eslint bypass；
- Gate 初始把合法 `FORM_SUBMIT` 与业务迁移混算为 10；修正为严格核验 `businessActions=9` 与 `FORM_SUBMIT=1`；
- Full Construction Gate 初始 verdict 只要求 P001–P003；已将 reusable P004 Gate 加入 required dependency；
- 一次 P003 回归曾因 GitHub runner 拉取 `testcontainers/ryuk:0.12.0` 时 Docker Hub 超时失败；后续 run 100 在不修改 P003 业务代码情况下恢复 SUCCESS，确认是外部网络瞬态故障。

## 8. Checkpoint verdict

```text
P001 = CHECKPOINT_PASS / CLOSED
P002 = CHECKPOINT_PASS / CLOSED
P003 = CHECKPOINT_PASS / CLOSED
P004 = CHECKPOINT_PASS / CLOSED
P005 = NEXT / NOT_STARTED
PHASE-09 = IN_PROGRESS / NOT COMPLETE
PHASE-10 = NOT_STARTED / BLOCKED_UNTIL_PHASE09_GATE
```

P004 已满足真实页面、API、server permission/data scope、Workflow/Form/Task、PostgreSQL、Redis、Audit、Outbox/Notification、幂等、版本/并发、职责分离、隐私最小化、负向验证和三端真实 E2E。允许进入 P005；不得因此宣告 PHASE-09 COMPLETE，也不得施工 P006+。
