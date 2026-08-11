# PHASE-06 C2 CHECKPOINT — Transactional Outbox / Inbox / Worker Reliability

> State: `COMPLETE`
> Phase: `PHASE-06 = IN_PROGRESS`
> Scope: `PLATFORM/基础工程`
> Completed checkpoint: `C2 = Transactional Outbox/Inbox + generic Worker reliability`
> Next checkpoint: `C3 = File/Attachment + MinIO + scan/SAFE + signed download`
> PHASE-07: `NOT_STARTED`

## 1. C2 完成内容

本 checkpoint 只实现所有后续业务流程共用的可靠事件副作用内核，不实现任何 P021–P025 业务流程。

已完成：

- `TransactionalOutboxService`：强制业务调用方处于活动数据库事务内，业务写入与 `core.outbox_event` 同生共死；
- `(tenant_id,event_key)` 幂等：同 key 同内容返回既有事件，同 key 不同内容 fail-closed；
- `PlatformInboxService`：复用批准的 `core.inbox_event`，用 PostgreSQL transaction-level advisory lock 实现跨 Worker 实例消费防重；
- `PlatformOutboxWorker`：按 ACTIVE tenant 逐租户进入 `TenantTransactionRunner`，RLS 下 `FOR UPDATE SKIP LOCKED` 拉取事件；
- handler 成功时 Inbox `SUCCESS` 与 Outbox `PUBLISHED` 同事务提交；
- handler 失败时处理事务回滚，独立事务累计 `retry_count`；
- 指数退避由 `retry_count + updated_at` 计算，不增加平行 `next_attempt_at` 事实；
- 达到阈值写入批准的 `integration.dead_letter` 并把 Outbox 置为 `DEAD_LETTER`；
- Worker 崩溃/重启后继续以 PostgreSQL 为唯一恢复事实；
- 单次 poll 对同一失败事件最多尝试一次，下一次 poll 才允许按 backoff 再尝试；
- 没有给 Worker `BYPASSRLS`，没有新增平行 Outbox/Inbox 表，也没有修改 PHASE-03 冻结索引基线。

## 2. C2 工程合同

正式合同：

`docs/implementation/contracts/phase-06/OUTBOX_INBOX.md`

该合同明确：C2 证明数据库事务、Inbox 防重、Worker 重启、retry/backoff/DLQ；**不宣称外部 Provider exactly-once**。Provider request/event/webhook 幂等属于后续 C4/C5。

## 3. 真实 PostgreSQL 16 验证

专属 Testcontainers 用例：

`Phase06OutboxInboxDatabaseIT`

覆盖：

1. 调用方事务 rollback 时 Outbox 同步 rollback；
2. 同 event_key 同内容幂等、不同内容冲突；
3. Worker RLS 隔离其他 tenant；
4. 两个并发 Inbox claim 被 PostgreSQL advisory lock 串行化；
5. handler 失败时 Inbox `PROCESSING` 与 handler DB 变更一起回滚；
6. 新 Worker 实例可继续处理失败事件；
7. retry_count / exponential backoff；
8. 达阈值持久化 DLQ 并停止正常 redispatch；
9. PHASE-05 canonical PostgreSQL 回归继续保持 PASS。

## 4. 失败与 forward-fix 证据

历史失败不删除、不隐藏：

- 初始 C2 candidate：`404bd0db5daf6e2d155278e8a15f3c0ef4a40340`；新 PG16 用例暴露 Outbox 唯一键冲突后事务 aborted 与 PgJDBC `Instant` 映射问题；
- forward fix：`f8c742420d7932dc16c3f8ea839a6185ac57bcf4`，改为同事务 advisory lock + 先查后写，并以 `OffsetDateTime.toInstant()` 映射 timestamptz；
- run `31253982900` 再次真实 FAIL：restart/DLQ 用例发现同一次 `runOnce` 会反复重试同一失败事件；
- forward fix：`de290f8f30d4434eed9cab37ce02b9dd788cbf16`，单个 poll 对同一 event id 只尝试一次，不修改测试预期。

## 5. 最终有效 PASS 证据

精确候选：

```text
Commit: de290f8f30d4434eed9cab37ce02b9dd788cbf16
Workflow run: 31254143343
```

五项全部 PASS：

1. `PHASE-06 platform source scope and safety contract` — PASS；
2. `Completed Java regression` — PASS；
3. `PHASE-06 PostgreSQL Outbox Inbox Worker regression` — PASS；
4. `PHASE-05 PostgreSQL canonical regression` — PASS；
5. `Completed Web typecheck test and build` — PASS。

因此 C2 可以正式关闭。

## 6. C2 verdict

```text
PHASE-06 = IN_PROGRESS
C1 = COMPLETE
C2 = COMPLETE
C3 = AUTHORIZED
C3 内容 = File/Attachment + MinIO + SHA256/MIME/size + scan/SAFE + short-lived signed download
P021-P025 = OUT_OF_SCOPE_FOR_PHASE_06
PHASE-07 = NOT_STARTED
```

不得因 C2 完成而跳过 C3–C8；PHASE-06 只有在 C8 全量验证后才能进入 `READY_FOR_GATE`。