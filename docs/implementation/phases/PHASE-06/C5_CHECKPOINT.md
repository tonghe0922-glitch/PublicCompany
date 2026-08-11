# PHASE-06 C5 CHECKPOINT — Integration / Provider Event / Webhook

> State: `COMPLETE`
> Phase: `PHASE-06 = IN_PROGRESS`
> Scope: `PLATFORM/基础工程`
> Next checkpoint: `C6 = immutable audit + critical fail-closed + correlation/trace`

## 完成内容

- 复用批准的 `integration.endpoint / integration.request_log / integration.dead_letter`；
- V104 最小 overlay：`request_log.provider_reference` + `integration.webhook_event`；
- 新 webhook evidence 使用 `(tenant_id,endpoint_id,provider_event_id)` 唯一事实、payload SHA256、签名结果与处理状态；
- 新表显式 `ENABLE/FORCE RLS`，runtime DELETE 被撤销；
- outbound `IntegrationHttpClient` 使用 Java HTTP client、endpoint timeout、显式 auth SPI，无默认凭据；
- outbound attempt 在 `REQUIRES_NEW` tenant transaction 写 `request_log`，外层 Worker 回滚不能抹掉 provider request evidence；
- stable `business_key` 作为 `Idempotency-Key`；成功的同 business-key+payload replay 不重复访问 Provider，改内容 fail-closed；
- failed HTTP attempt 持久化为 `success=false`，允许新 request_id + 同一 provider idempotency key 重试；
- inbound `WebhookIngressService` 必须显式 SignatureVerifier；有效首次事件写 `webhook_event + INTEGRATION_WEBHOOK_RECEIVED Outbox` 同事务；精确 replay 不重复；改内容冲突；无效签名写 REJECTED 且无下游 Outbox；
- C5 不添加 correlation_id/trace_id，它们属于 C6。

## 有效验证

```text
Commit: 67a9ce7d5dd187a438cc582c3ad0fe8dbe5ffe2d
Run: 31256339109
```

六项全部 PASS：source/safety、Java、PHASE-06 PostgreSQL16 C2–C5、真实 MinIO、PHASE-05 PostgreSQL16、Web。

`Phase06IntegrationDatabaseIT` 真实启动本地 HTTP socket + PostgreSQL16，证明 Provider 接收到 Idempotency-Key、provider_reference/request_log 持久化、成功 replay 抑制重复远程调用、失败 attempt 可重试、webhook provider-event 去重、签名拒绝、Outbox 一次性、RLS 与 runtime DELETE deny。

## Verdict

```text
C1-C5 = COMPLETE
C6 = AUTHORIZED
PHASE-06 = IN_PROGRESS
PHASE-07 = NOT_STARTED
P021-P025 = OUT_OF_SCOPE_FOR_PHASE_06
```
