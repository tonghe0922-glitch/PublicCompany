# PHASE-11 继承回归修复记录

## 范围

本记录仅说明 PHASE-11 在 P011 checkpoint 中发现的已完成阶段回归合同问题，不改变 P011–P016 的业务验收标准，不放宽测试，不启动 PHASE-12。

## 已修复事实

1. PHASE-04 源合同改为读取当前 Knowledge Base 中实际存在的脱敏工作簿：
   - `00 企业架构及员工/01 企业组织架构数据表_TM.xlsx`
   - `00 企业架构及员工/02 员工的工号_TM.xlsx`
2. 重新生成 PHASE-04 source contract evidence，并继续执行物理 XLSX 校验。
3. PHASE-10 completed-phase contract 继续强制 PHASE-10 为 `COMPLETE / FULL_CONSTRUCTION_GATE_PASS`，但不再错误地永久要求 PHASE-11 为 `NOT_STARTED`；PHASE-11 只允许处于合法生命周期状态。
4. P011 的 C0、Java 单元、PostgreSQL 16、Vue/TypeScript、ESLint、Vitest、jscpd、knip 和三端构建仍由原 checkpoint 强制执行。
5. `JdbcPhase11Repository` 已允许 Spring 对 `@Repository` 创建异常转换代理；修复前完整 API 上下文因 `final` 类无法生成 CGLIB 子类而启动失败。修复后已在独立发布门禁中通过后端单元测试和 PHASE-04 API 安全集成回归。

## 禁止事项

- 不删除或跳过 PHASE-03、PHASE-04、PHASE-10 回归；
- 不删除 P011 业务测试；
- 不扩大 ignore；
- 不把静态页面、Mock API、内存数据或 localStorage 视为正式实现；
- 不将 P012–P016 或 PHASE-12 伪标为完成。

## 正式 checkpoint

本次普通提交用于在正式分支精确 HEAD 上重新触发 `PHASE-11 P011 Checkpoint`。只有 C0、后端、API 安全、PostgreSQL 16、前端质量和最终 verdict 全部为 `success`，P011 才能进入 `CHECKPOINT_PASS / CLOSED`。
