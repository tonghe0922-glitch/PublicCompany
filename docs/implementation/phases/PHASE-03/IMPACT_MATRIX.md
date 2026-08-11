# PHASE-03 IMPACT MATRIX

> Phase: `PHASE-03`
> Name: `数据库三库、Schema、Flyway 与基础角色`
> Scope/process_code: `PLATFORM/基础工程`
> Boundary: 仅施工数据库基线与迁移/权限基础，不实现 P001–P126 业务流程、页面、业务 API 或领域状态机。

| process_code | Employee 页面 | Center 页面 | Tech 页面 | Route | Permission | Data Scope | Sensitive Level | API | Application Service | Domain | Repository | 数据库 | Flyway | Workflow | Outbox | Worker | Audit | Notification | Integration | Unit Test | Integration Test | E2E |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PLATFORM/基础工程 | 无业务页面变更 | 无业务页面变更 | 无业务页面变更 | 无业务路由变更 | 建数据库 cluster/group role 最小权限基线；不创建业务 permission_code | tenant RLS 基础；不定义 SELF/CENTER 等业务 ABAC | 沿用 KB P1/P2/P3 规则；本阶段不新建字段敏感分类 | 无业务 API；Actuator 不变 | 无业务 Use Case | 仅数据库基础设施边界 | 仅迁移验证访问；不新增业务 Repository | `sjg_oms` / `sjg_audit` / `sjg_dw` | 将批准 KB DDL 纳入 versioned Flyway；Flyway 为唯一正式结构变更通道 | 不实现状态机 | 不实现业务 Outbox 行为；仅安装现有 KB 表 | Worker 仅复用连接基础；不新增 handler | 审计库 INSERT/SELECT-only 应用角色；禁止 UPDATE/DELETE/TRUNCATE | 无业务通知 | PostgreSQL 16 / Testcontainers；Redis/MinIO/RabbitMQ 不改 | migration naming/checksum/static verifier | Testcontainers PG16 空库迁移、重复迁移、角色/RLS/审计权限 | NOT_APPLICABLE_BY_SCOPE |

## Database impact

### sjg_oms
- 纳管 KB `03_SQL_DDL/01_sjg_oms/*.sql`：Schema、领域表、FK、索引、触发器、RLS、视图、流程种子、分区模板。
- 预期业务 Schema：44 个；与 audit/dw 合计 46 个物理 Schema。
- tenant 表必须启用 RLS；应用角色不得 `BYPASSRLS`。

### sjg_audit
- 纳管 KB `03_SQL_DDL/02_sjg_audit/*.sql`。
- `audit` Schema 应用写角色只允许 `INSERT/SELECT`，显式禁止 `UPDATE/DELETE/TRUNCATE`。

### sjg_dw
- 纳管 KB `03_SQL_DDL/03_sjg_dw/*.sql`。
- `analytics` Schema 作为分析库，不接受业务端直接写入；仅数据加载/分析角色按最小权限使用。

## Source-of-truth / provenance

本阶段直接读取并遵循：
- `AGENT.md`；
- `DESIGN.md`；
- `Knowledge Base/03 数据库需求规则/01_架构设计/**`；
- `Knowledge Base/03 数据库需求规则/02_数据字典/**`；
- `Knowledge Base/03 数据库需求规则/03_SQL_DDL/**`；
- `Knowledge Base/03 数据库需求规则/04_初始化数据/**`；
- `Knowledge Base/03 数据库需求规则/06_规则与验收/**`；
- PHASE-01 的机器合同与 PHASE-02 工程骨架。

## Hard boundaries

- 不修改 Knowledge Base 原始 SQL 语义；Flyway 文件必须保留来源路径/hash 追溯。
- 不新造业务表、业务状态、审批人、金额/权限规则。
- 不把静态页面/Mock/内存/browser storage 当业务实现。
- 不在 PHASE-03 实现 IAM 业务授权内核、Workflow 运行时或后续业务流程。
