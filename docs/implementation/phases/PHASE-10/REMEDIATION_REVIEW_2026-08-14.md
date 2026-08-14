# PHASE-10 技术债务复核与整改记录（2026-08-14）

> Branch: `agent/phase-10-public-capabilities-b`
> Review baseline: `fc717ef58e609fa579ab86f9887ac336580a3a38`
> Scope: PHASE-10 封板后的质量维护补丁；不启动 PHASE-11。

## 1. 复核结论

上传的旧评估报告基于 `6bd3b80`。其中“19 条路由复用通用页、PHASE-10 无 Live E2E、技术端 raw JSON、台账脱节、自封板工作流”等问题，已在 `fc717ef...` 之前完成整改，不重复施工。

本轮确认并整改以下真实问题：

1. P007/P010 核心 INSERT 仍依赖大量 JDBC 位置占位符；
2. `GuardedShiftChangeRepository`、`GuardedLeaveRepository`、`GuardedOvertimeRepository` 可读性不足；
3. PHASE-10 控制器抛出的业务拒绝、旧版本和资源不存在异常缺少统一 Problem JSON 收敛；
4. P008/P009/P010 Composable 成功后保留旧表单，并通过 `splice` 原地刷新列表。

## 2. 已实施整改

- P007、P010 核心 INSERT 改为 `NamedParameterJdbcTemplate` + `MapSqlParameterSource`；
- 增加具名参数单元测试，逐项断言 UUID、业务字段与参数名称；
- 三个 Guarded 仓储只做等价格式化，不改变状态机、权限或数据库事实；
- 新增 PHASE-10 专属 `@RestControllerAdvice`：
  - `ProcessRejectedException` → 409 / `PROCESS_REJECTED`；
  - `OptimisticLockingFailureException` → 409 / `STALE_VERSION`；
  - `IllegalArgumentException` 中 `not found` → 404 / `NOT_FOUND`；
  - 其余非法参数 → 400 / `INVALID_ARGUMENT`；
- P008/P009/P010 刷新改为 `rows.value = ...`，P008 额度账本改为 `ledger.value = ...`；
- 所有成功提交/动作完成后执行 `resetForm()`；失败发生在 reset 之前，因此保留用户输入供修正；
- Live E2E 增加员工端 P008/P009、中心端 P010 成功提交后的表单清空验证；
- Spotless 空白/导入 ratchet 绑定 Maven `validate`，现有 Full Gate 后端作业会自动执行；前端合同同时调用后端整改合同，并保留 120 列可读性与前端状态门禁。

## 3. 未采纳项及原因

### 3.1 不执行 varchar(32) → UUID 迁移

`issuer_host_id`、`handover_agent_id` 等字段的 canonical 契约允许业务引用值，不保证全部为 UUID；现有测试还明确保护 `HOST-001` 等非 UUID 标识。未经数据字典、全量历史值扫描和迁移 ADR 批准，直接改成 UUID 会破坏合法数据。本轮保留兼容规范化逻辑，不新增 V122 类型迁移。

### 3.2 不在本补丁拆分 LearningService / ShiftChangeService

两类 Service 体积过大属于真实 P2 技术债，但拆分会影响工作流、Outbox、审计、幂等和事务边界。应在独立 ADR、特征测试和单独 PR 中实施，不能混入封板后的低风险维护补丁。


### 3.3 不在封板补丁中执行全仓 Google Java Format

全仓 Java 当前包含大量历史格式，直接运行 Google Java Format 会产生与业务无关的大面积 diff，并显著放大合并冲突。此次采用可验证的渐进式 ratchet：Spotless 负责无用导入、尾随空格和文件结尾，Python 合同强制本轮 Guarded 仓储不超过 120 列。全仓 Google Java Format 应在独立格式化 PR 中实施，且不得与业务修复混合。

## 4. 验证要求

本补丁必须继续通过 PHASE-10 Full Construction Gate 的全部 required jobs，包括 Java 单测、API 安全集成、PHASE-03/05/06/09/10 PostgreSQL 回归、TypeScript、ESLint、Vitest、jscpd、knip、三端构建和真实 PostgreSQL16 + Redis + Chromium Live E2E。任何一项失败均不得宣称整改完成。
