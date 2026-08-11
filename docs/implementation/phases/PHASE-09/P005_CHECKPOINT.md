# PHASE-09 P005 Checkpoint

> Process: `P005` 制度、通知与执行回执
> Checkpoint status: `PASS / CHECKPOINT_CLOSED / PHASE09_GATE_PASS / PHASE10_UNLOCKED`
> Evidence branch: `ChatGPT_Version_V0.07`
> Accepted implementation candidate SHA: `2eb9f646bf4477d4a4d82f605a1c7bc8e6cadd00`
> Closed at: `2026-08-10`

本文件关闭 PHASE-09 的最后一个业务 checkpoint。P001–P005 均已关闭；`PHASE-09 = COMPLETE / FULL_CONSTRUCTION_GATE_PASS`。`PHASE-10` 仅解除前置阻塞并保持 `NOT_STARTED`，本次不施工 P006–P010；PHASE-11+ 继续禁止提前施工。

## 1. 冻结流程与实际状态机

```text
S01 制度/通知版本发布
 → S02 按组织岗位确定范围
 → S03 消息送达
 → S04 员工阅读
 → S05 确认/阅签
 → S06 考试或理解验证
 → S07 执行任务
 → S08 责任人验收
 → S09 未完成催办升级
 → S10 档案移交
 → END 已关闭
```

P005 复用 published `WorkflowRuntimeService`、表单、任务、Audit、Outbox、Worker、Notification、IAM 与 Redis Session，不建立第二套自由状态机。业务主事实落 canonical `collaboration.notice`；收件人及回执事实落 `collaboration.notice_recipient / notice_receipt_event`。

已发布制度/通知版本受数据库不可变约束保护；需要修改正式内容或受众时必须发布新版本，不允许原地改写既有已发布事实。

## 2. API、权限与三端路由

API：

- `POST /api/v1/processes/P005/notices`
- `GET /api/v1/processes/P005/notices`
- `GET /api/v1/processes/P005/notices/{id}`
- `POST /api/v1/processes/P005/notices/{id}/read`
- `POST /api/v1/processes/P005/notices/{id}/confirm`
- `POST /api/v1/processes/P005/notices/{id}/understanding`
- `POST /api/v1/processes/P005/notices/{id}/execution`
- `POST /api/v1/processes/P005/notices/{id}/actions/{actionCode}`

服务端权限：`p005.notice.publish / p005.notice.read / p005.notice.receipt / p005.notice.manage / p005.notice.monitor`。`SecurityFilterChain` 只开放 authenticated P005 API boundary，细粒度 permission 与 data scope 仍由 Controller/AuthorizationService 强制执行。

冻结路由：

- Employee：`/employee/13/01/05`
- Center：`/center/13/01/05`
- Tech：`/tech/05/03/01`

Employee 只能读取自身服务端解析的收件记录并提交本人回执；Center 负责发布与验收/归档；Tech 为监控视图，不自动获得业务发布、回执或验收权限。

## 3. 服务端受众、职责与幂等

- 收件范围由服务端按 tenant / center / position 解析，客户端不能提交任意员工列表绕过范围；
- Live Gate 固定解析同中心 `P005_RECIPIENT` 精确 2 人；
- P005 workflow v2 显式允许发布人承担需要的 manager task，避免默认“排除 initiator”把唯一合法 manager 过滤为空；
- 每个写操作使用 `Idempotency-Key`；同 key 重放必须返回相同业务结果，不重复推进 workflow、receipt event 或 outbox；
- 回执顺序受数据库约束：READ → CONFIRM → UNDERSTANDING → EXECUTION → ACCEPTANCE；
- stale version / 越权 / 非收件人 / 跨范围访问均 fail-closed。

## 4. Canonical Schema、Worker、Audit、Outbox 与隐私

P005 Repository 已对齐 canonical `collaboration.notice`：有效期使用 `planned_start_at / planned_finish_at` 映射业务 effective range，不依赖不存在的旧列；附件与动态 recipient scope 不伪造主表字段。

真实 Worker 链路：

`P005 stage event → core.outbox_event → PlatformOutboxPump → Phase09P005NotificationHandler → NotificationService → notice_recipient DELIVERED / durable notification`

Worker 配置已移除会因 Spring Bean 注册时序导致整组配置被跳过的脆弱类级/方法级 `@ConditionalOnBean` 依赖；真实 P005 Gate 验证 Worker 不是“应用启动但不消费”的假运行状态。

隐私与审计：

- P005 业务 outbox 不复制正式标题/正文私密哨兵文本；
- Tech 只取得允许的 metadata projection；
- 密码/临时凭据不得进入 OMS/Audit 日志；
- HTTP 幂等重放仍保留独立审计记录，但不重复业务副作用。

## 5. 真实三端 E2E 与最终数据库事实

最终 Gate 覆盖：

1. Center 真实登录并发布 P005 制度通知；
2. 服务端解析精确 2 名收件人；
3. 真实 Outbox Worker 将 2 人从 QUEUED 推到 DELIVERED；
4. Employee 真实登录完成阅读、确认、理解验证、执行回执；
5. 第二名收件人完成同一闭环，并对 READ 执行一次相同 `Idempotency-Key` 重放；
6. Center 完成执行验收、升级收口与归档；
7. Tech 通过监控路由读取允许的最终投影；
8. PostgreSQL 后验核验 workflow/form/receipt/outbox/audit/immutability/privacy；Redis 使用真实 session runtime。

最终事实：

```text
status = 已关闭
workflow = COMPLETED
current_node = END
recipients = 2
delivered = 2
read = 2
confirmed = 2
understanding_passed = 2
executed = 2
accepted = 2
order_violations = 0
receipt_events = 12
delivery_events = 2
workflow_START = 1
workflow_business_actions = 10
FORM_SUBMIT = 1
form_count = 1
P005_business_outbox = 10
private_payload_hits = 0
audit_PUBLISHED = 1
audit_READ = 3   # 2 个真实 READ + 1 个同 key 成功重放审计
audit_CONFIRM = 2
audit_UNDERSTANDING = 2
audit_EXECUTION = 2
audit_MANAGE = 3
password_hits = 0
published_notice_illegal_mutation = REJECTED
```

## 6. Gate 证据

### 独立 P005 Live Gate

- Run number: `8`
- Run ID: `31407271270`
- Head SHA: `55b82ba68786182ddef317fe425ceab5f764af6f`
- Job: `93516540880 / SUCCESS`
- Artifact: `9070179633`
- Browser + PostgreSQL16 + Redis + real Worker + database facts: `SUCCESS`

### PHASE-09 Full Construction Gate（P005 为 verdict 必需依赖）

- Run number: `121`
- Run ID: `31408096251`
- Head SHA: `2eb9f646bf4477d4a4d82f605a1c7bc8e6cadd00`
- Scope/source contract: `SUCCESS`
- Java21 + PostgreSQL16 + Redis backend regression: `SUCCESS`
- Vue TypeScript/lint/unit/build: `SUCCESS`
- P001 real live regression: `SUCCESS`
- P002 real live regression: `SUCCESS`
- P003 reusable live regression: `SUCCESS`
- P004 reusable live regression: `SUCCESS`
- P005 reusable live job: `93519246713 / SUCCESS`
- P005 reusable artifact: `9070482992`
- Final construction verdict: `93520539859 / SUCCESS`

## 7. 本轮真 Gate 发现并关闭的缺陷链

- `knip.json` 未登记 P003/P004/P005 dedicated Playwright configs，导致 `quality:deadcode` 污染；已纳入 entry；
- 主 `playwright.config.ts` 未隔离 P004/P005 dedicated live specs，导致通用 `test:e2e` 混跑真实基础设施用例；已补 `testIgnore`；
- P005 Live E2E 早期访问旧/错误路由；已改为冻结正式路由；
- Repository 曾依赖 canonical `collaboration.notice` 不存在的旧字段；已按 V10 schema 对齐，并使用后续 overlay 修正已发布 trigger/流程合同；
- P005 manager candidates 默认排除 initiator，唯一合法管理人被过滤为空；workflow v2 显式修正候选人规则；
- Worker 配置因 `@ConditionalOnBean` 注册时序可能“启动成功但实际未装载 Outbox/Notification/P005 Handler”；已修复真实 runtime 激活；
- Worker smoke test 使用低优先级 default properties，未真正关闭外部 Worker；已改为高优先级命令行参数；
- Gate 把 8 次不同回执动作与 1 次合法幂等 READ 重放审计误算为 8；已拆分为精确 action 计数，不删除合法审计；
- Playwright `.click()` 不等待 Vue async handler 完成，导致确认/理解/执行后立即读取出现偶发竞态；已等待可观察的持久化结果，不放宽业务断言；
- PHASE-09 Full Gate 原先只把 P001–P004 作为 required dependency；现已把 P005 纳入 paths、边界/secret scan、reusable job、`needs` 与最终 verdict。

## 8. Checkpoint / Phase verdict

```text
P001 = CHECKPOINT_PASS / CLOSED
P002 = CHECKPOINT_PASS / CLOSED
P003 = CHECKPOINT_PASS / CLOSED
P004 = CHECKPOINT_PASS / CLOSED
P005 = CHECKPOINT_PASS / CLOSED
PHASE-09 = COMPLETE / FULL_CONSTRUCTION_GATE_PASS
PHASE-10 = NOT_STARTED / UNLOCKED_BY_PHASE09_GATE
PHASE-11+ = NOT_STARTED / DO_NOT_START_EARLY
```

P005 已满足真实页面、API、server permission/data scope、canonical PostgreSQL、published Workflow/Form/Task、真实 Outbox Worker/Notification、Audit、Redis Session、幂等、版本/并发、顺序约束、不可变发布版本、隐私最小化、负向验证和三端真实 E2E。PHASE-09 的 P001–P005 五流程三端闭环门槛已满足。

本 checkpoint 只解除 PHASE-10 的前置阻塞；**PHASE-10 尚未开始施工**。
