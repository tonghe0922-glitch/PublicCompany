# 上金谷景区一体化运营管理平台

> Canonical repository: `tonghe0922-glitch/PublicCompany`
> Current construction branch: `agent/phase-10-public-capabilities-b`
> Target branch: `main`
> Current phase: `PHASE-10 = IN_PROGRESS`

本仓库是“上金谷景区一体化运营管理平台”的当前唯一施工仓库。所有 AI、CI、人工施工、代码审查和阶段台账必须以本仓库当前分支中的文件为事实源，不得回退到已停用仓库或旧施工分支。

## 当前真实状态

- PHASE-00 至 PHASE-09 已完成并保留回归门禁；
- PHASE-10 当前范围固定为 `P006–P010 公共能力 B`；
- P006 会议与行动项、P007 排班与班次调整已存在代码 checkpoint，但仍以真实 CI/E2E 通过作为 CLOSED 门槛；
- P008 请假与考勤、P009 加班与调休、P010 员工学习/考试/资格是当前剩余施工范围；
- PHASE-11 及以后阶段保持 `NOT_STARTED`，不得提前施工。

## 权威资料

发生冲突时按根 `AGENT.md` 定义的优先级处理。核心入口：

1. `AGENT.md`：全仓库最高工程执行约束；
2. `DESIGN.md`：三端视觉、交互、响应式与 Vue 实现基线；
3. `Construction Master Schedule.csv`：阶段范围与主计划；
4. `Knowledge Base/`：组织、页面、126 个流程、字段、状态、规则、接口与数据库事实源；
5. `docs/implementation/MASTER_PROGRESS.md`：当前阶段和 checkpoint 总台账；
6. `docs/implementation/phases/PHASE-10/`：PHASE-10 冻结合同、页面绑定、缺口与施工证据。

## Git 与施工规则

- 当前 PHASE-10 只在 `agent/phase-10-public-capabilities-b` 施工；
- 默认目标分支为 `main`；
- 禁止 force push、重写历史、覆盖无关提交；
- 每个可验证小闭环形成 checkpoint；
- 当前阶段 Formal Gate 未 PASS 前，不进入下一阶段；
- GitHub Connector 可用于当前环境中的 fetch/read/commit/push/CI 查询等价操作；
- 远端分支 HEAD 必须与预期 commit SHA 核对一致。

## 技术栈

- Frontend: Vue 3.5 + TypeScript 5.9 + Vite + Pinia + Vue Router
- Backend: Java 21 + Spring Boot 3.5 + Spring MVC
- Data access: Spring JDBC / JdbcTemplate
- Database: PostgreSQL 16 + Flyway
- Architecture: 前后端分离、模块化单体
- Deployment: Docker

## 当前导航

- `docs/implementation/CONSTRUCTION_RULES.md`：阶段施工规则；
- `docs/implementation/ENGINEERING_BASELINE.md`：工程技术与质量基线；
- `docs/implementation/DESIGN_BASELINE.md`：三端设计基线；
- `docs/implementation/MASTER_PROGRESS.md`：PHASE-00 至 PHASE-35 总进度；
- `docs/implementation/phases/PHASE-10/README.md`：当前阶段范围与施工顺序；
- `docs/implementation/contracts/phase-10/PHASE10_HTTP_PERMISSION_CONTRACT.md`：PHASE-10 HTTP/权限工程合同。
