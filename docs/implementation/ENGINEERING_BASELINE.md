# ENGINEERING_BASELINE

> 来源：当前 `agent/full-build` 分支根 `AGENT.md` V1.2（baseline 2026-08-07）。本文件是执行摘要，不替代原文。

## 1. 项目事实基线

- 平台：上金谷景区一体化运营管理平台。
- Canonical portal：`employee / center / tech`。
- 当前 runtime alias：`tech = admin`，不得新增第四端。
- 三端共享同一 `business_id`、`business_no`、`process_instance_id`、流程版本、服务端状态和权威业务事实。
- 规范声明规模：126 个业务流程、3 个端、2,164 个表单、90,124 行原始字段定义、3 个核心数据库、46 个物理 Schema、265 张物理表。
- 上述数量在后续资料解析阶段必须重新统计；不得把声明数量冒充本阶段重新核算结果。

## 2. 批准技术栈

| 层级 | 基线 |
|---|---|
| 前端 | Vue 3.5.x + Composition API + `<script setup lang="ts">` |
| 语言 | TypeScript 5.9.x，`strict: true` |
| 构建 | Vite 官方受支持稳定版；目标基线 8.2.x |
| 状态 | Pinia |
| 路由 | Vue Router 4.x |
| 样式 | 现有 CSS + Design Tokens，不引入 Tailwind 平行体系 |
| 图标 | 现有 Lucide 依赖与适配方式 |
| 后端 | Java 21 + Spring Boot 3.5.x |
| Web | Spring MVC REST API |
| 数据访问 | Spring JDBC / JdbcTemplate / NamedParameterJdbcTemplate |
| 数据库 | PostgreSQL 16 |
| 迁移 | Flyway |
| 架构 | 前后端分离 + 模块化单体 |
| 异步可靠性 | 领域事件 + Transactional Outbox + 独立 Worker |
| 会话/缓存/锁 | Redis，仅非事实状态 |
| 文件 | S3/MinIO；本地默认 MinIO |
| 消息 | RabbitMQ 或 Kafka 单一主总线；绿色项目无反向要求时优先 RabbitMQ并 ADR 化 |
| 搜索 | OpenSearch 可选，不作为审批事实源 |
| 部署 | Docker；本地 Docker Compose |

未经 ADR 禁止引入 React/Next.js、Node 后端、JPA/Hibernate、WebFlux 平行栈、MySQL/MongoDB、微服务大拆分、第二套路由/状态管理或 Tailwind 平行体系。

## 3. 权威资料与冲突优先级

实现前必须读取当前批准版本的：

- `AGENT.md`；
- PRD/SRS（如存在）；
- `S0 全部业务流程简表.xlsx`；
- 三端流程表单字段包；
- 数据库 machine-readable JSON、表/字段/流程映射 CSV、初始化状态/规则/接口/三端联动目录、SQL DDL；
- `DESIGN.md` 与六份三端页面架构 Excel；
- 当前代码、迁移、OpenAPI、测试、ADR、发布与质量报告。

冲突按：法律/安全底线 → 用户最新明确决定 → 根 AGENT → 已批准 PRD/SRS/ADR/验收 → 流程/字段/状态/规则/接口 → 数据库包 → DESIGN/页面 IA → 当前代码 → 历史资料 → 智能体经验。

## 4. 架构与数据红线

- PostgreSQL 16 是唯一交易事实源。
- 首期模块化单体，不为了“先进”提前拆微服务。
- `sjg_oms`：核心交易、主数据、流程和业务事实。
- `sjg_audit`：只增不改审计。
- `sjg_dw`：CDC/ETL 驱动分析，不反写交易事实。
- Redis、消息队列、Excel、浏览器存储不是长期唯一事实源。
- 一个业务对象只能有一个 System of Record 和一个权威主表。
- 跨域写入调用所属领域接口/命令/事件，不直接更新对方表。
- 禁止“一端一套表”“一流程一表”“一表单一表”。
- 禁止脱离数据字典创造近义字段、枚举、唯一键或新表。

## 5. 状态与闭环

标准业务闭环：

```text
发起/触发
→ 身份/权限/范围/幂等/完整性/前置条件
→ 受理/审核/复核/批准
→ 资源锁定与子任务
→ 真实执行结果与证据
→ 独立验收/专业确认
→ 金额/库存/积分/权限/票务/档案等影响回写
→ 通知/回执/后续义务
→ 归档包完整性
→ 关闭
```

必须覆盖退回、驳回、撤回、取消、暂停、部分失败、重试、死信、人工接管、冲销、反向单、补偿、申诉、更正和补充归档等适用异常路径。

禁止用单一 `status` 混淆：

- `workflow_status`；
- `business_status`；
- `validity_status`；
- `archive_status`；
- `domain_stage`。

具体枚举必须取自权威状态目录。

## 6. 关键写事务顺序

```text
认证/当前岗位/租户/范围/MFA
→ Idempotency-Key
→ version_no / 锁
→ 字段/字典/金额/日期/附件/规则/流程版本校验
→ 同一事务写领域事实 + 明细 + 流程动作 + Outbox
→ commit
→ Worker 异步通知/外部同步/审计/分析
→ retry
→ DLQ
→ 人工补偿
```

- 重复请求返回首次成功结果，不产生重复副作用。
- 并发更新使用乐观锁、条件更新、唯一约束或明确行锁。
- 外部回调使用 `provider + external_event_id` 防重。
- 金额、库存、积分、餐卡、票务核销、电子签署、权限授予/回收、关键状态历史和审计使用不可变流水/版本链；纠错新增冲销或更正，不覆盖历史。

## 7. 权限与敏感数据

必须同时实现：

- RBAC；
- ABAC；
- PostgreSQL RLS；
- 字段级权限；
- 数据范围；
- 职责分离；
- 回避；
- 四眼复核；
- 临时授权与自动回收；
- Step-Up/MFA；
- 审计。

数据分级映射：

| 三端字段包 | 平台口径 |
|---|---|
| P0-公开 | DATA-L1 |
| P1-内部 | DATA-L2 |
| P2-个人 | DATA-L3 |
| P3-高度敏感 | DATA-L4 |

技术管理员默认没有业务审批权、付款决定权或 L3/L4 明文知悉权。

## 8. API 与后端分层

后端层次：

```text
Controller / Transport
→ Application Use Case
→ Domain Aggregate / Domain Service
→ Repository Port
→ Persistence / External Adapter
```

- Controller 不直接操作 Repository/SQL/流程表。
- `@Transactional` 原则放在 Application Service 公共方法。
- Repository 使用 JdbcTemplate/NamedParameterJdbcTemplate，所有 SQL 参数化。
- 集成测试使用 PostgreSQL 16/Testcontainers 或等价真实 PostgreSQL，不用 H2 模拟。
- API 版本 `/api/v1/...`，列表分页，筛选/排序白名单。
- 关键写接口要求 `Idempotency-Key`。
- 使用动作端点，禁止通用 `PATCH status=<任意值>`。
- OpenAPI/契约集中维护或生成，数据库实体不直接暴露为 API DTO。

## 9. 前端质量阈值

新建/修改默认强制阈值：

| 指标 | 上限 |
|---|---:|
| 页面容器 SFC 有效行数 | 300 |
| `<script setup>` 有效行数 | 180 |
| `<template>` 有效行数 | 180 |
| 单函数有效行数 | 40 |
| 控制流/回调嵌套 | 3 |
| 单文件顶层函数 | 15 |
| 单个 `computed` 有效行数 | 25 |
| 圈复杂度 | 10 |

重复治理：

- 两应用间 80% 以上相似文件或 50 行以上相同有效代码，默认应抽取共享实现；
- 全仓库复制率目标 <15%；
- 本次新增/修改代码复制率 ≤5%；
- 跨端精确复制门户文件直接阻断合并。

## 10. 自动质量门禁

前端/工程 CI 最终必须包含或等价覆盖：

1. 锁文件一致性与格式检查；
2. `vue-tsc --noEmit`；
3. ESLint（含空 catch、Promise、生产 console、any 等）；
4. 复杂度门禁；
5. jscpd 或等价重复检测；
6. knip 或等价死代码检测；
7. 循环依赖检查；
8. Vitest；
9. PostgreSQL 集成测试；
10. Flyway 空库/升级迁移校验；
11. OpenAPI/事件契约兼容；
12. Playwright 关键三端 E2E；
13. 依赖/镜像安全扫描；
14. 构建产物 secret/测试账号/环境变量检查。

覆盖目标：核心领域行覆盖率 ≥80%，关键规则分支覆盖率 ≥90%，`DEFECT-S0=0`、`DEFECT-S1=0`。

禁止通过删测试、降低断言、扩大 `any`、全局关闭规则、扩大 ignore、吞异常或伪造成功让 CI 变绿。

## 11. Definition of Done 摘要

功能完成必须同时满足：明确 `process_code` 和业务目标、三端口径一致、真实前后端闭环、正确权威持久化、服务端状态机、RBAC+ABAC+RLS+字段权限、幂等/并发/重复回调、异常/补偿/人工接管、审计/Trace、敏感数据安全、PC/移动/三端一致、测试与迁移通过、性能无明显回退、Windows 中文/空格路径可运行、文档/契约/字典/测试矩阵同步、质量棘轮通过、可回滚可复现、S0/S1 缺陷为 0。

## 12. 不可突破红线

1. 三端重复业务表或重复业务记录；
2. 前端隐藏但 API/搜索/导出/附件可越权；
3. 技术管理员自动拥有业务审批或敏感明文权；
4. 直接改数据库状态、余额、库存、积分、核销或审计；
5. 覆盖/物理删除已签、已付、已核销、已出库、已归档事实；
6. 单一状态字段混淆多状态维度；
7. 缺少幂等造成重复付款/退款/签章/库存/积分/权限副作用；
8. 未审核自动盖章、代签或自动作出重大法律/责任结论；
9. 使用个人账号/邮箱/网盘或公共 AI 处理企业敏感数据；
10. 把 Excel/微信群/截图/Redis/浏览器存储当唯一事实源；
11. 把审议稿、建议值、测试值硬编码为生产规则；
12. 生产保留测试验证码、默认密码、演示通道、假成功；
13. 跳过迁移、RLS、权限、审计、补偿和测试赶进度；
14. 删除测试、扩大 any、关闭规则或忽略错误；
15. 未读取对应流程和数据字典就批量编码；
16. 为视觉牺牲可读性、性能、安全和员工尊严；
17. 未经要求大规模重写可运行架构；
18. 无可运行结果和验证证据却声称全部完成；
19. 三端复制维护同一门户/组件/业务实现而无共享权威实现；
20. 空 catch、只弹错误提示或关闭静态规则掩盖真实失败。
