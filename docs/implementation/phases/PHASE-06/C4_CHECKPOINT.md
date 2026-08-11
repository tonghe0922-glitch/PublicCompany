# PHASE-06 C4 CHECKPOINT — Notification Template / Message / Delivery

> State: `COMPLETE`
> Phase: `PHASE-06 = IN_PROGRESS`
> Scope: `PLATFORM/基础工程`
> Next checkpoint: `C5 = Integration endpoint/request/provider event/webhook/dedup`

## 完成内容

- 复用批准的 `notification.template / notification.message`，没有新增通知事实表。
- 模板仅支持字面 `{{variable}}`，不执行表达式/脚本；`variables_schema` 的 required/properties 做 fail-closed 校验。
- caller request key 生成确定性 `message_no`，事务 advisory lock + 批准唯一索引实现并发幂等；同 key 改内容冲突。
- 立即消息与 `NOTIFICATION_SEND` Outbox 在同一数据库事务内产生。
- 未来 `scheduled_at` 消息先保持 PENDING；独立 Worker pump 到期后按 tenant/RLS 事务写 Outbox，不用 retry backoff 冒充调度器。
- `NotificationDeliveryHandler` 复用 C2 Inbox/Worker；Provider 收到稳定 Outbox `event_key` 作为外部幂等键。
- 只有 Provider 明确 `accepted=true` 后，消息才更新为 `SENT/sent_at`；拒绝/异常保持 PENDING，并进入 C2 retry/DLQ。
- 平台不提供固定成功/default Provider。
- `SENT` 仅表示 Provider 接受/提交发送，**不是送达/已读回执**；批准 C4 DDL 无 dedicated receipt，真实 request/provider-event/receipt 证据留给 C5 Integration。

## 失败与 forward-fix

- 初始候选 `a8a14cb62e992fa8a2504dff49f17b40e29f1b41`：source validator 对合同短语大小写过严；`NotificationDeliveryHandler` 构造器漏 `this.jdbc = jdbc`，Java/PG reactor 在 notification compile 阶段失败。
- forward fix `518060631d84518cd8deeed1017a969be08ad507`：只修初始化与机器合同文本断言，不删/放宽测试。

## 最终有效证据

```text
Commit: 518060631d84518cd8deeed1017a969be08ad507
Workflow: Phase 06 Platform Side Effects Kernel
Run: 31255777877
```

六项全部 PASS：source/safety、Java、PHASE-06 PostgreSQL16（含 C2/C3/C4）、真实 MinIO、PHASE-05 PostgreSQL16、Web。

PG16 C4 用例证明：立即消息幂等 + Outbox、Provider 接受后 SENT + Inbox SUCCESS + Outbox PUBLISHED、重放不重复调用 Provider、Provider 拒绝不伪写 sent_at/回执、计划消息仅到期入 Outbox、跨租户 RLS 隔离。

## Verdict

```text
PHASE-06 = IN_PROGRESS
C1 = COMPLETE
C2 = COMPLETE
C3 = COMPLETE
C4 = COMPLETE
C5 = AUTHORIZED
P021-P025 = OUT_OF_SCOPE_FOR_PHASE_06
PHASE-07 = NOT_STARTED
```
