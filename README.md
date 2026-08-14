
本仓库用于从零建设“景区一体化运营管理平台”（上金谷景区）。当前处于 **PHASE-11：全员公共能力 P011–P016（绩效 / 晋升 / 奖励 / 纪律申诉 / 积分 / 福利）施工完成、独立门禁待批**；PHASE-00 至 PHASE-10 已封板。

> 真实进度以 `docs/implementation/MASTER_PROGRESS.md` 与 `docs/implementation/phases/` 证据为准。本文件仅描述可验证的已落地状态，不把文档、静态内容或 Knowledge Base 描述为“业务系统已完成”。

## 当前真实状态（截至 2026-08-13）

**已封板阶段（PHASE-00 → PHASE-10，均 COMPLETE / INDEPENDENT_GATE_PASS）**
- PHASE-00：施工控制面、基线、台账、ADR、安全约束初始化。
- PHASE-01：Knowledge Base 机器合同（126 流程 / 2164 表单 / 90124 源字段索引）。
- PHASE-02：工程骨架 / 基础设施（三端 Vite 工程、Maven 多模块）。
- PHASE-03：PostgreSQL 16 / Flyway / RLS / 角色基线。
- PHASE-04：IAM / RBAC / ABAC / Step-Up / 审计安全。
- PHASE-05：canonical workflow 内核；Formal Gate PASS。
- PHASE-06：平台副作用 / 证据内核；Formal Gate PASS。
- PHASE-07：Cycle 3 完整度复核；独立 Formal Gate PASS。
- PHASE-08：Portal Runtime（employee / center / admin）正式收口。
- PHASE-09：公共能力 P001–P005（登录 / 权限 / 资料 / 通用审批 / 制度通知）CLOSED；Full Construction Gate PASS；CI 门禁全绿。
- PHASE-10：公共能力 P006–P010（会议 / 排班 / 请假 / 加班 / 学习考试）CLOSED；独立 DB/Worker 22 测试、API 5 生命周期、Web 20 文件 / 91 测试 / 构建 / Knip / lint / 真实 Chromium 全绿。

**当前阶段（PHASE-11，CONSTRUCTION_COMPLETE / INDEPENDENT_GATE_PENDING）**
- 公共能力 P011–P016（绩效 / 晋升与任职 / 奖励 / 纪律责任与申诉 / 成长积分 / 员工福利与关怀）本地 CHECKPOINT_PASS / CLOSED，全量施工 Gate 通过。
- 独立 Phase Gate 尚未正式授予；按规则 PHASE-12 仍被其阻塞，不得提前施工。

**已落地的真实代码资产（实测）**
- 后端：18 个模块（`core`、`iam`、`org`、`mdm`、`workflow`、`document`、`notification`、`integration`、`audit`、`hr`、`attendance`、`learning`、`performance`、`reward`、`welfare`、`collaboration` + `apps/api`、`apps/worker`），约 337 个 Java 文件。
- 前端：三端 `employee` / `center` / `admin` 工程，约 145 个 `ts` / `vue` 文件。
- 数据库：96 个 Flyway 迁移（V1 → V125），覆盖 `oms` / `audit` / `dw` / `cluster` 四库，含租户 RLS 基线。
- 测试：约 110 个测试类，含本地 PG16 + Redis 集成测试、真实 Chromium 验证。

**尚未开始（核心缺口）**
- 流程：P017–P126 共 110 个业务流程未启动（电子签署 / 敏感导出 / 数据质量 P017–020 起，至各业务中心与跨中心黄金路径）。
- 阶段：PHASE-12 ~ PHASE-35 全部 `NOT_STARTED`，含全页面逐行对账、安全硬化、全系统测试 / CI 总门禁、部署监控、性能 / 备份恢复、最终 UAT。
- 完整业务系统（业务中心级流程、跨中心编排）尚未建成。

## 权威资料

发生冲突时按根 `AGENT.md` 定义的优先级处理。核心入口：

1. `AGENT.md`：全仓库最高工程执行约束；
2. `DESIGN.md`：三端视觉、交互、响应式与 Vue 实现基线；
3. `Knowledge Base/`：组织、页面、126 个流程、字段、状态、规则、接口与数据库事实源；
4. `docs/implementation/`：分阶段施工台账与证据。

## 固定施工分支

> 本地当前无 `.git`，旧的 `agent/full-build` / `main` 分支标识为历史记录，不作为当前验收证据；所有 checkpoint / gate 以本地台账与 `phases/` 证据为准。

从历史目标看，PHASE-00 到 PHASE-35 默认持续使用：

```text
agent/full-build
```

目标分支为 `main`。PHASE-35 全量验收之前，Draft PR 不自动合并。

## 分阶段施工

- 每次只执行当前 PHASE；
- 当前阶段 Definition of Done 未 PASS，不进入下一阶段；
- 优先完成真实可验证的小闭环；
- 不批量生成空 Vue 页面、假 API、Mock 持久化或 TODO 伪装进度；
- 每阶段更新 `docs/implementation/MASTER_PROGRESS.md` 和对应证据。

## 如何启动

**基础运行时已建立，可本地启动；完整业务系统尚未建成。** 三端工程（`employee` / `center` / `admin`）、后端 API / Worker、PostgreSQL 16 + Redis 基础已在本地验证（PG16 + Redis + Chromium 证据）。具体安装 / 启动 / 停止 / 自检 / 备份 / 恢复命令将在后续阶段（部署与监控 PHASE-33、性能 / 备份 / 恢复 PHASE-34）随真实基础工程补齐后在此补充。

> 注意：当前仓库本地无 `.git`，无法执行 `git` 提交 / 推送类 checkpoint；启动前请确认本地已具备 PostgreSQL 16 与 Redis 7.4 运行环境。

## 当前导航

- `docs/implementation/KB_FILE_INDEX.md`：Knowledge Base 完整文件索引；
- `docs/implementation/ENGINEERING_BASELINE.md`：工程技术与质量基线；
- `docs/implementation/DESIGN_BASELINE.md`：三端设计基线；
- `docs/implementation/MASTER_PROGRESS.md`：PHASE-00 至 PHASE-35 总进度；
- `docs/implementation/CONSTRUCTION_RULES.md`：阶段施工硬规则；
- `docs/implementation/ADR/ADR-TEMPLATE.md`：架构决策模板。
