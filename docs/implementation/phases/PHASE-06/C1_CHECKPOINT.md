# PHASE-06 C1 CHECKPOINT — 范围/来源/机器门禁纠偏

> State: `COMPLETE`
> Phase: `PHASE-06 = IN_PROGRESS`
> Scope: `PLATFORM/基础工程｜文档/附件、通知、审计、Integration、Transactional Outbox/Inbox 内核`
> Next checkpoint: `C2 = Transactional Outbox/Inbox + generic Worker reliability`
> PHASE-07: `NOT_STARTED`

## 1. 正确阶段权威已恢复

根目录 `Construction Master Schedule.csv` 与用户明确 PHASE-06 施工提示词共同定义：

```text
PHASE-06
文档、附件、通知、审计、Integration、Outbox/Inbox 内核
范围：Document/Outbox/Worker
核心门槛：Outbox/Inbox/DLQ/文件证据
```

总施工计划同时将：

```text
PHASE-13 = P021–P023
PHASE-14 = P024–P027
```

提交 `a3bdeda96d400770ca0f8e4ce1856f98a003706a` 已将 `docs/implementation/PHASE_02_29_WORKLIST.md` 与该总施工计划对齐，因此仓库当前阶段资料不再把 P021–P025 分配给 PHASE-06。

## 2. 范围误判历史保留

此前 `4206cb9216493b9617644ad701e0f36e65560166` 至 `f4e54f9ab4c0c838cf78b5530c5907bfe3ccaca6` 按旧派生 worklist 误把 PHASE-06 当成 P021–P025。该序列只修改控制文档、validator 与 workflow，没有提交 P021–P025 业务 runtime 代码。

失败和成功记录均保留，不改写历史。其中 `31252207971` 虽然四项绿，但验证的是错误 PHASE-06 合同，因此不作为当前阶段 C1 PASS 证据。

## 3. 正确 C1 完成内容

- `MASTER_PROGRESS.md` 恢复 PHASE-06=`PLATFORM/基础工程`。
- PHASE-06 `SOURCE_CONTRACT / IMPACT_MATRIX / GAP_MATRIX / PHASE_REPORT` 全部按可靠副作用/证据内核重建。
- 删除当前树中错误的 `phase06-business-processes.yml`，Git 历史继续保留。
- 建立 `.github/workflows/phase06-platform-side-effects.yml`。
- `phase06_source_contract.py` 校验 approved Core/Document/Notification/Integration/Audit DDL、MinIO 基础设施与 PHASE-05/07 边界。
- 机器合同直接绑定 `Construction Master Schedule.csv` 和已对齐的 `PHASE_02_29_WORKLIST.md`，禁止 P021–P025 再泄漏到 PHASE-06。

## 4. 已验证批准物理事实

C1 仅证明事实源和基础设施存在，并不把后续 runtime 能力提前标完成：

- `core.idempotency_record / outbox_event / inbox_event`；
- `document.file_object / attachment_link`；
- `notification.template / message`；
- `integration.endpoint / request_log / dead_letter`；
- `sjg_audit` append-only access/data-change/operation/rule/security logs；
- PHASE-02 MinIO development service。

Java/Worker/MinIO adapter/通知/Webhook/审计联调缺口继续留在 GAP_MATRIX 中，由 C2–C8 关闭。

## 5. 有效验证证据

正确范围首个候选：

```text
Scope correction commit: 8f199ff911e36e9bc74f0fe0470ee5cb87358729
Initial correct-scope run: 31252676879
Result: source-contract FAIL; Java/PG16/Web PASS
```

失败原因只是 C1 validator 对 `Webhook` 文本做了大小写敏感匹配。未删除测试、未降低 DDL/安全断言。

Forward fix：

```text
Commit: 165f48d2cc5d40980da70a9e63a496322273214c
Run: 31252708806
```

Run `31252708806` 四项全部 PASS：

1. PHASE-06 PLATFORM source/scope + fake-completion/secret safety — PASS；
2. complete Java regression — PASS；
3. PHASE-05 PostgreSQL 16 canonical regression — PASS；
4. completed Web typecheck/test/build — PASS。

随后 `a3bdeda96d400770ca0f8e4ce1856f98a003706a` 又把旧派生 worklist 与总施工计划正式对齐；本 C1 closeout 对两者增加机器一致性断言并重新回归。

## 6. C1 verdict

```text
C1 = COMPLETE
PHASE-06 = IN_PROGRESS
C2 = AUTHORIZED
C2 内容 = Transactional Outbox/Inbox + 独立 Worker + retry/backoff/DLQ/restart
P021-P025 = OUT_OF_SCOPE_FOR_PHASE_06
PHASE-07 = NOT_STARTED
```

本 checkpoint 仍然只处理控制面/来源/CI，不包含 C2 runtime 实现。