# PHASE-09 CI 生命周期门禁修复记录

> Scope: PHASE-09 / P001–P005
> Branch: `ChatGPT_Version_V0.07`
> Purpose: 修复正式封板后仍被准备期/C0 旧状态断言误判为失败的问题；不降低任何业务、权限、数据库、隐私或真实 E2E 门槛。

## 发现的红灯

在正式收口提交 `7b9e5fb196c1bb44b8c13e4daddd3bda43400f2c` 上，`PHASE-09 Full Construction Gate` 已全量 SUCCESS，但同时存在两个真实失败的 GitHub Actions workflow：

- `PHASE-09 Preparation Gate` / run `31414790457`：旧逻辑只接受准备期 README 或 `PHASE-09 = IN_PROGRESS`，导致合法 `COMPLETE` 状态必然失败；
- `PHASE-09 C0 Contract Freeze` / run `31414790433`：旧逻辑硬编码要求 `| PHASE-09 | IN_PROGRESS |`，因此正式封板后必然失败。

这两个失败属于 CI 生命周期状态机缺陷，不能通过忽略红灯、删除 workflow、`continue-on-error`、跳过测试或把主台账改回 IN_PROGRESS 来规避。

## 修复原则

1. `NOT_STARTED / IN_PROGRESS` 时，Preparation Gate 保留原“禁止准备期假完成”检查；
2. `COMPLETE` 时，Preparation Gate 转为“冻结来源回归门禁”：继续检查 deterministic source/page trace，并强制 README、PHASE_REPORT、PHASE_GATE、P001–P005 checkpoint、PHASE-10 NOT_STARTED 等正式收口证据存在；
3. C0 Contract Freeze 接受合法生命周期 `IN_PROGRESS / READY_FOR_GATE / COMPLETE`，但始终要求 PHASE-08 COMPLETE、PHASE-10 NOT_STARTED、C0 deterministic contracts、无 P006–P010 executable coupling、无凭据泄漏；
4. `COMPLETE` 不代表降低 C0 门槛，而是要求正式报告/Gate/P001–P005 checkpoint 一并存在；
5. 本记录位于 `docs/implementation/phases/PHASE-09/**`，因此修复提交仍会触发 `PHASE-09 Full Construction Gate`，必须在同一新 HEAD 上重新执行 Java21、PostgreSQL16、Redis、Vue 和 P001–P005 real three-portal E2E。

## 验收规则

只有当修复后的最终 HEAD 同时满足以下条件时，PHASE-09 才可视为 CI 全绿：

```text
PHASE-09 Preparation Gate = SUCCESS
PHASE-09 C0 Contract Freeze = SUCCESS
PHASE-09 Full Construction Gate = SUCCESS
Full Gate final construction verdict = SUCCESS
Current HEAD has no GitHub Actions workflow conclusion=failure
PHASE-10 = NOT_STARTED
```

历史失败记录保留，不通过改写 Git 历史隐藏。
