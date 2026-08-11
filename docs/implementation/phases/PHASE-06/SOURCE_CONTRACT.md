# PHASE-06 SOURCE_CONTRACT

> Phase: `PHASE-06`
> Current state: `COMPLETE`
> process_code: `PLATFORM/基础工程`
> Scope: `文档/附件、通知、审计、Integration、Transactional Outbox/Inbox 内核`
> Previous phase: `PHASE-05 = COMPLETE`
> Next phase: `PHASE-07 = NOT_STARTED`
> Exact READY_FOR_GATE candidate: `d9a953c2da9bb560ed6c284a2adf1451ed09a7a4`
> Construction run: `31260482194 = PASS`
> Independent Formal Gate run: `31260482190 = PASS`

## 1. 范围纠偏与权威关系

用户在 PHASE-05 Formal Gate PASS 后明确授权进入 PHASE-06，并进一步明确：**本阶段主要内容是所有流程共用的可靠副作用和证据能力，不是 P021–P025 业务流程。**

根目录 `Construction Master Schedule.csv` 与对齐后的 worklist 固定 PHASE-06=`Document/Outbox/Worker`；P021–P023 归 PHASE-13，P024–P027 归 PHASE-14。P021–P025 不在本阶段施工。

此前错误范围提交 `4206cb9216493b9617644ad701e0f36e65560166` 至 `f4e54f9ab4c0c838cf78b5530c5907bfe3ccaca6` 未提交 P021–P025 业务运行时代码，只留下控制文档/validator/workflow；全部保留为范围纠偏历史，不作为 PHASE-06 PASS 证据。

## 2. Definition of Work — 已完成

PHASE-06 已完成并验证：

1. 文件对象与附件关联：SHA256、MIME、字节大小、敏感等级、版本与证据关联；
2. MinIO 对象存储真实适配；上传安全扫描状态机；正式业务只能绑定 `SAFE` 文件；
3. 短时签名下载；权限、authoritative data-scope、MFA2 Step-Up 与 immutable audit fail-closed；
4. 通知模板、消息实例、计划发送、Provider acceptance evidence；
5. Transactional Outbox 与调用方业务事务原子提交；
6. 独立 Worker 消费 Outbox；Inbox 防重；重试、指数退避、DLQ、重启恢复；
7. Integration endpoint / request log / request id / provider event id / webhook receiver；重复 webhook 幂等；
8. `sjg_audit` immutable audit；关键审计失败 fail closed；
9. `correlation_id / trace_id` 贯穿 API → DB/outbox → Worker → provider/webhook → audit；
10. 真实 PostgreSQL16、MinIO、HTTP、Redis、Windows 中文路径与 Web 回归覆盖完整阶段证据。

## 3. 已批准物理事实源与最小 overlay provenance

### Core

批准 DDL 已包含 `core.idempotency_record`、`core.outbox_event`、`core.inbox_event`。PHASE-06 没有建立平行 outbox/inbox 真值表。C6 V105 仅补平台 `correlation_id / trace_id` 技术证据字段。

### Document

批准 DDL 已包含 `document.file_object`、`document.attachment_link`。原 DDL 已有 object_key/original_name/content_type/size_bytes/sha256/storage_bucket/encryption_key_ref/virus_scan_status/retention_until/legal_hold。来源缺失的 `sensitive_level / version_no` 按 GAP 形成最小 V103 overlay，并通过 PostgreSQL16 验证；未伪装成原 DDL 已有字段。

### Notification

批准 DDL 已包含 `notification.template`、`notification.message`。C4 将 `SENT` 明确定义为 Provider accepted/submitted，而非伪造 delivered/read；Provider request/receipt 事实与 C5 Integration 协同。

### Integration

批准 DDL 已包含 `integration.endpoint`、`integration.request_log`、`integration.dead_letter`。原 DDL 缺失 `provider_event_id / webhook_event / correlation_id / trace_id`，C5 V104 与 C6 V105 以最小工程 overlay 补齐，并保留 RLS/唯一约束/trace evidence。

### Audit

批准 `sjg_audit` DDL包含 `audit.access_log`、`audit.data_change_log`、`audit.operation_log`、`audit.rule_execution_log`、`audit.security_event`。C6 audit V100 只增加 correlation/trace 技术字段；`sjg_audit_writer` 仍只有 INSERT/SELECT，UPDATE/DELETE/TRUNCATE 继续拒绝。没有建立可变审计替代表。

## 4. 最终实现真相

- C2：Transactional Outbox/Inbox/Worker、retry/backoff/restart/DLQ 真实 PG16 闭环；
- C3：File/Attachment、SHA256、SAFE gate、RLS、真实 MinIO put/stat/presign/GET/remove；
- C4：Notification template/message/schedule/Provider acceptance 与幂等；
- C5：outbound HTTP evidence、稳定业务幂等键、provider_event/webhook signature/dedup；
- C6：durable correlation/trace、双库 `sjg_oms + sjg_audit`、real runtime roles、immutable audit、critical fail-closed；
- C7：engineering-only file/webhook HTTP，permission + authoritative data-scope + minimum MFA2 Step-Up + immutable audit，API trace，Webhook API→Outbox→Worker 边界，Worker non-Web hard isolation；
- C8：exact candidate `d9a953c2da9bb560ed6c284a2adf1451ed09a7a4` 的 Construction 8/8 PASS 与 independent Formal Gate 9/9 PASS。

Knowledge Base business HTTP source catalog 仍为 0；PHASE-06 仅登记两条 engineering-owned platform HTTP contract，不宣称为源资料原生业务 API。

## 5. 安全与一致性红线 — 保持有效

- API 与 Worker 独立进程/模块；runtime app 不执行 Flyway；
- DB 操作带 tenant context 并复用 RLS；
- 浏览器/localStorage/sessionStorage 不是业务或副作用事实源；
- 不以 Mock provider、固定成功响应、内存队列冒充生产实现；
- 文件在 `SAFE` 前不得绑定或下载，失败状态 fail closed；
- 敏感下载不得因为“已登录”自动放行；必须有 permission、真实 data-scope、Step-Up、immutable audit；
- Transactional Outbox 必须与业务写入同事务；
- Worker 消费必须有 Inbox/唯一事件键防重；重启/重试不得重复外部副作用；
- DLQ 必须持久化；
- Webhook 必须验证来源并基于 provider event/request key 防重；
- 关键审计失败 fail closed；
- Integration/Worker 能力不得绕过业务批准、支付、库存、积分、核销等业务真相源；
- P021–P025 保持 OUT_OF_SCOPE_FOR_PHASE_06；PHASE-07 保持 NOT_STARTED。

## 6. API / 事件合同边界

Source HTTP catalog 的 business API-like records 仍为 0。PHASE-06 新增的 signed download 与 webhook 仅为 **engineering-owned contract**，已在 `docs/implementation/contracts/phase-06/**` 与 `MASTER_API_CATALOG.md` 明示。事件名、header、provider adapter SPI 同样只承载平台工程能力，不引入业务审批语义。

## 7. Checkpoint closure

```text
C1 = COMPLETE
C2 = COMPLETE
C3 = COMPLETE
C4 = COMPLETE
C5 = COMPLETE
C6 = COMPLETE
C7 = COMPLETE
C8 = COMPLETE / GATE_PASSED
```

每个 checkpoint 均经过测试 → commit → normal push → exact remote SHA/CI；C8 的 exact candidate additionally 通过独立 Formal Gate。

## 8. Exit Result

PHASE-06 的 construction candidate `d9a953c2da9bb560ed6c284a2adf1451ed09a7a4` 已通过 Construction run `31260482194` 与 Independent Gate run `31260482190`。因此允许本次**纯台账 closeout**将 PHASE-06 标记 `COMPLETE`。

本 closeout 不启动 PHASE-07、不合并 main、不修改 Gate candidate runtime。PHASE-07 仍为 `NOT_STARTED`，等待后续独立授权。
