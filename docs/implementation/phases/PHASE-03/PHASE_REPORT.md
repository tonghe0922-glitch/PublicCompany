# PHASE-03 REPORT

## 1. 阶段名称

`PHASE-03｜数据库三库、Schema、Flyway 与基础角色`

阶段范围仅为 `PLATFORM/基础工程` 数据库基线，不实现 P001–P126 领域业务，不提前施工 PHASE-04。

## 2. process_code

`PLATFORM/基础工程`。

- 本阶段实现的业务 process_code：**0**。
- 本阶段标记 IMPLEMENTED 的业务页面：**0**。
- 7,126 页面 / 126 流程业务集合由 PHASE-03 ledger finalizer 前后哈希保护，不因数据库阶段被改写。

## 3. 读取的 Knowledge Base 文件

本阶段重新读取并以当前仓库事实为准：

- `/AGENT.md` V1.2；
- `/DESIGN.md` V2.0；
- `Knowledge Base/03 数据库需求规则/01_架构设计/01_数据库总体架构.md`；
- `Knowledge Base/03 数据库需求规则/01_架构设计/02_数据源分库分域.md`；
- `Knowledge Base/03 数据库需求规则/01_架构设计/05_权限敏感与审计规则.md`；
- `Knowledge Base/03 数据库需求规则/01_架构设计/07_实施迁移验收方案.md`；
- `Knowledge Base/03 数据库需求规则/02_数据字典/01_数据源规划.csv`；
- `Knowledge Base/03 数据库需求规则/02_数据字典/02_Schema业务域.csv`；
- `Knowledge Base/03 数据库需求规则/02_数据字典/03_全量表清单.csv`；
- `Knowledge Base/03 数据库需求规则/02_数据字典/04_全量字段字典.csv`；
- `Knowledge Base/03 数据库需求规则/02_数据字典/05_主外键关系.csv`；
- `Knowledge Base/03 数据库需求规则/02_数据字典/06_索引设计.csv`；
- `Knowledge Base/03 数据库需求规则/03_SQL_DDL/01_sjg_oms/*.sql`；
- `Knowledge Base/03 数据库需求规则/03_SQL_DDL/02_sjg_audit/*.sql`；
- `Knowledge Base/03 数据库需求规则/03_SQL_DDL/03_sjg_dw/*.sql`；
- `Knowledge Base/03 数据库需求规则/04_初始化数据/**`；
- `Knowledge Base/03 数据库需求规则/06_规则与验收/**`；
- PHASE-01 机器合同；
- PHASE-02 工程骨架、Formal Gate 与 completed-phase 回归控制面。

Knowledge Base 原始 SQL/CSV 未被 PHASE-03 修改。

## 4. Excel Sheet

`NOT_RUN / NOT_APPLICABLE_BY_SCOPE`。

PHASE-03 是数据库基础设施阶段，不以业务流程 XLSX 生成领域规则。本阶段实际解析/比较的是数据库 CSV、SQL DDL 与既有 PHASE-01 机器合同；没有根据 Excel 文件名猜业务。

## 5. Employee 页面

无业务页面改动。Employee 页面 IMPLEMENTED 新增数：**0**。

## 6. Center 页面

无业务页面改动。Center 页面 IMPLEMENTED 新增数：**0**。

## 7. Tech 页面

无业务页面改动。canonical `tech → admin` runtime/build alias 保持 PHASE-02 已批准事实，不在 PHASE-03 修改。

## 8. API

无新业务 HTTP API。

数据库运行身份改为：

```text
SJG_API_DB_USERNAME = sjg_api_runtime
spring.flyway.enabled = false
```

API app 已移除 Flyway 依赖；结构迁移不再由 API 启动隐式执行。

## 9. Service

业务 Application Service：`NOT_IMPLEMENTED_IN_PHASE_03`。

新增的是技术迁移执行器 `Phase03DatabaseMigrator`：

- cluster role migration 使用 bootstrap 数据库身份；
- OMS/Audit/DW 使用 `sjg_migration`；
- DDL 通过受控 `SET ROLE sjg_owner` 执行；
- 每库执行 migrate → validate → 再次 migrate=0。

它不是领域 Use Case。

## 10. Repository

业务 Repository：`NOT_IMPLEMENTED_IN_PHASE_03`。

API/Worker 继续使用 Spring JDBC 技术基础；本阶段仅建立数据库身份、Schema/表/权限与迁移基础，不创建领域 Repository/SQL 实现。

## 11. Flyway

已建立正式、可重复、可追溯的 Flyway 基线：

```text
technical-platform/database/flyway/cluster
technical-platform/database/flyway/oms
technical-platform/database/flyway/audit
technical-platform/database/flyway/dw
technical-platform/database/flyway-overlays/oms
technical-platform/database/flyway-overlays/audit
technical-platform/database/flyway-overlays/dw
```

关键合同：

1. `scripts/implementation/phase03_prepare_flyway.py` 从批准 KB DDL 确定性生成正式 migration；
2. `manifest.json` 保存 source path / source SHA-256 / generated SHA-256；
3. V95 的 psql `\set tenant_id` 仅通过明确兼容层转换为 Flyway 部署 placeholder；其它 psql 元命令直接令生成失败；
4. tenant bootstrap 使用部署必填 `sjg_tenant_id / sjg_tenant_code / sjg_tenant_name`，仓库不保存虚构生产租户；
5. 数据库 owner guard 保证三库 owner 为 `sjg_owner`；
6. applied migration 不依赖 API/Worker runtime；
7. 正式结构 SQL 在 `technical-platform` 下只能存在于 Flyway/overlay 目录；
8. Flyway version uniqueness、checksum provenance、validate、二次 migrate=0 均由 CI 验证。

## 12. 数据库

正式数据库：

```text
sjg_oms
sjg_audit
sjg_dw
```

当前确定性基线：

| 指标 | 实际结果 |
|---|---:|
| 核心数据库 | 3 |
| 物理 database+Schema | 46 |
| 表目录 | 265 |
| 当前批准 DDL unique CREATE TABLE | 265 |
| 表 catalog-only | 0 |
| 表 DDL-only | 0 |
| 索引目录 | 1,024 |
| 原批准 DDL CREATE INDEX | 1,019 |
| catalog-sourced audit overlay | 5 |
| 正式索引基线 | 1,024 |

原历史“表目录 265 vs DDL 266”已由当前确定性源重算证明为 265/265；没有通过删表强行对齐。

5 个索引差异均来自权威索引目录，已形成 `audit/V91__catalog_index_gap_closure.sql`，且 CI 断言 overlay 对象集合必须与 catalog-only 5 项完全相等。

## 13. Workflow

业务 Workflow runtime / 状态机：`NOT_IMPLEMENTED_IN_PHASE_03`。

数据库层已安装批准 workflow Schema/表和批准 V95 流程定义 seed。通过显式测试 tenant facts，验证写入 `workflow.wf_definition` 的 126 个流程定义。该 seed 不等于后续 Workflow 运行时实现。

## 14. Permission

本阶段只实现**技术数据库角色权限**，不创建业务 `permission_code`：

| Role | Purpose |
|---|---|
| `sjg_owner` | NOLOGIN 数据库/Schema/表 owner |
| `sjg_migration` | 独立 Flyway migration identity |
| `sjg_api_runtime` | OMS API runtime |
| `sjg_worker_runtime` | OMS Worker runtime |
| `sjg_audit_writer` | Audit append/read |
| `sjg_auditor` | Audit read-only |
| `sjg_dw_writer` | DW load/write |
| `sjg_dw_reader` | DW read-only |

所有正式 login role 均实测：

```text
NOSUPERUSER
NOCREATEDB
NOCREATEROLE
NOREPLICATION
NOBYPASSRLS
```

`sjg_app` 仅因批准 audit DDL 兼容保留，已设 `NOLOGIN`，新 runtime 不得使用。

## 15. ABAC

业务 ABAC：`NOT_IMPLEMENTED_IN_PHASE_03`。

本阶段建立的是 PostgreSQL tenant RLS 基础，不等同于完整 SELF/CENTER/PROJECT/岗位 ABAC。后续 IAM/业务阶段必须在此基础上继续实现服务端 RBAC/ABAC/field permission。

## 16. RLS

三库所有**实际安装且含 `tenant_id` 的 base table**均通过 Testcontainers 查询验证：

- `relrowsecurity = true`；
- 至少存在一条 PostgreSQL policy；
- 表 owner = `sjg_owner`；
- runtime roles = `NOBYPASSRLS`。

OMS 批准 RLS 原 SQL保留；Audit/DW 及任何漏项通过 PHASE-03 安全 overlay 补齐，不修改 KB 原文件。

## 17. Step-Up

`NOT_RUN / NOT_APPLICABLE_BY_SCOPE`。

PHASE-03 不实现业务高风险动作认证或 MFA/Step-Up。

## 18. Audit

Audit 数据库基线已真实验证：

- `sjg_audit_writer`: INSERT + SELECT；
- `sjg_auditor`: SELECT；
- runtime roles无 Schema CREATE；
- `sjg_audit_writer` UPDATE：数据库拒绝；
- DELETE：数据库拒绝；
- TRUNCATE：数据库拒绝；
- tenant RLS 可隐藏其它 tenant 的 audit row。

这不是文档声明，而是 PostgreSQL 16 集成负向测试结果。

## 19. Outbox

批准 DDL 中已有的相关表结构由 Flyway 安装，但**业务 Outbox Publisher/consumer 行为未在 PHASE-03 实现**。

状态：`NOT_IMPLEMENTED_IN_PHASE_03`。

## 20. Worker

Worker 仍为 PHASE-02 的独立非 Web Spring Boot 应用；PHASE-03 将数据库身份收紧为：

```text
SJG_WORKER_DB_USERNAME = sjg_worker_runtime
spring.flyway.enabled = false
```

Worker app 移除 Flyway 依赖；CI 真实验证 `sjg_worker_runtime` 可连接 OMS，但执行 `CREATE TABLE` 被拒绝。

## 21. Integration

本阶段实际联调：

- PostgreSQL 16 Compose；
- PostgreSQL 16 Testcontainers；
- Flyway；
- Linux migration runner；
- Windows 中文路径 migration BAT；
- API/Worker runtime DB identities。

Redis / MinIO / RabbitMQ 未被本阶段改为业务事实源；PHASE-02 Compose 回归仍通过。

## 22. 正常测试

关键成功验证：

### A. PHASE-03 Database Baseline

```text
Workflow: Phase 03 Database Baseline
Run: 31173547265
Validated implementation head: f63249fdbec828d6178308b42d6a3900653ec077
Conclusion: success
```

覆盖：

- deterministic Flyway/source hash；
- 版本唯一；
- Flyway-only SQL gate；
- 3 databases；
- 46 Schema；
- 265 installed approved tables；
- 1,019 + 5 = 1,024 index closure；
- PostgreSQL 16 empty install；
- Flyway validate；
- second migrate = 0；
- tenant bootstrap / 126 workflow definitions；
- all tenant-table RLS；
- audit immutability；
- migration role；
- database ownership。

### B. PHASE-03 Runtime Database Identity

```text
Workflow: Phase 03 Runtime Database Identity
Run: 31173547048
Validated implementation head: f63249fdbec828d6178308b42d6a3900653ec077
Conclusion: success
```

覆盖：

- ephemeral CI secrets；
- Compose PostgreSQL role provisioning；
- independent migration runner；
- API runtime真实登录；
- Worker runtime真实登录；
- API/Worker DDL negative；
- database owners；
- role forbidden cluster privileges；
- Windows Chinese path migration/start contract。

### C. PHASE-02 completed-phase regression

```text
Workflow: Phase 02 Build
Run: 31173720739
Head: cc7612b722b951cb49ab8b89a2457ae1660c79f9
Conclusion: success
```

quality / Java / Vue / Compose / Windows Chinese-path 五个 job 全部 success，证明 PHASE-03 数据库改造未破坏已完成的 PHASE-02 工程骨架。

### D. Deterministic baseline report

```text
Workflow: Phase 03 Database Baseline Report
Run: 31171230996
Conclusion: success
```

### E. Ledger finalize

```text
Workflow: Phase 03 Ledger Finalize
Run: 31174051036
Conclusion: success
Generated ledger commit: 6a847a023cbf4a4293ebed05a770384e23c418d6
```

## 23. 权限负向测试

已真实运行数据库技术权限负向：

- `sjg_api_runtime` 尝试 `CREATE TABLE core...` → DENIED；
- `sjg_worker_runtime` 尝试 `CREATE TABLE workflow...` → DENIED；
- API runtime 对 Audit/DW 无 CONNECT；
- API/Worker 无 database CREATE；
- runtime roles 无 Schema CREATE；
- 所有正式 login roles 无 BYPASSRLS；
- audit writer UPDATE/DELETE/TRUNCATE → DENIED。

业务层 employee→center API、跨中心、本人审批本人等：`NOT_RUN / NOT_APPLICABLE_BY_SCOPE`，因为 PHASE-03 不实现业务 API/审批权限。

## 24. 幂等

数据库迁移幂等：**PASS**。

- 每个数据库首次 `migrate()` 成功；
- `validate()` 成功；
- 第二次 `migrate()` 的 `migrationsExecuted = 0`；
- Flyway generated tree 可重复生成；
- baseline report 可重复生成；
- ledger finalizer 可重复执行且不修改 7,126 页面/126 流程集合。

业务写请求幂等：`NOT_RUN / NOT_APPLICABLE_BY_SCOPE`。

## 25. 并发

业务并发/optimistic locking：`NOT_RUN / NOT_APPLICABLE_BY_SCOPE`。

PHASE-03 不提供领域写 API；本阶段不伪造重复提交/旧 version/并发扣减测试结果。数据库 DDL 并发迁移也不作为允许场景，正式发布应由单一 migration runner 串行执行。

## 26. E2E

已执行数据库基础设施 E2E：

```text
empty PostgreSQL 16
→ cluster/bootstrap roles
→ 3 database creation/ownership
→ independent sjg_migration Flyway
→ migrate/validate/repeatability
→ runtime role login
→ DDL negative
→ RLS/audit negative
```

业务端 Employee/Center/Tech 完整流程 E2E：`NOT_RUN / NOT_APPLICABLE_BY_SCOPE`。

## 27. 未运行测试

明确 `NOT_RUN`：

- 业务发起→审批→执行→验收→回写→归档；
- employee 调 center business API；
- 跨 center / 访问别人业务 / 技术角色审批；
- 业务重复提交 / callback / old version；
- 业务 Outbox retry / DLQ / compensation；
- 业务并发锁；
- Step-Up/MFA；
- 真实生产数据库凭据部署；
- Windows 交互式真实生产密码的持久服务运行；
- 生产备份恢复演练。

这些均不属于 PHASE-03 领域实现范围，未伪装为 PASS。

## 28. 未完成事项

PHASE-03 DoD 范围内无已知代码 blocker；但以下事项明确保留：

1. `G23`：除已批准 V95 SQL seed 外，其它初始化 CSV 未被擅自转换为 SQL；由后续拥有具体主数据/业务初始化职责的阶段按批准来源施工。
2. 生产 `sjg_tenant_id/code/name` 必须由部署事实提供，仓库无默认值。
3. 生产数据库 role passwords 必须由 secret manager/部署环境提供，仓库无默认值。
4. 业务 RBAC/ABAC/field permission、Workflow runtime、Outbox worker、业务 API 均属于后续 PHASE。
5. 当前执行环境无本地 `gh`，继续依据用户授权使用 GitHub Connector 等价完成 GitHub 操作。

## 29. 风险

- V95 批准 seed 原本是 psql 客户端脚本；PHASE-03 只允许这一处显式 compatibility transformation，并由 manifest/CI 防止转换范围扩大。
- 5 个 audit tenant index 来自索引目录而非原 DDL 包；已作为 sourced overlay 实现，原始来源差异仍保留在 baseline report，不冒充原 DDL 本来存在。
- `sjg_owner` membership 是高权限技术能力，只授予 `sjg_migration`；API/Worker 不继承。
- `sjg_bootstrap` 是本地/首次集群管理身份，不能被应用使用。
- `sjg_app` 仅为 NOLOGIN legacy compatibility role；新业务不能恢复为共享超级应用账号。
- RLS 是数据库最后一道 tenant 隔离，不替代后续服务端 RBAC/ABAC/field-level permission。
- 生产 migration 必须单实例/串行执行，禁止多个应用节点同时自动 Flyway。

## 30. 回滚方式

- Git 历史不允许 reset/force rewrite；代码/配置回滚使用新的 revert commit。
- **已应用 Flyway migration 不得修改或删除**；结构纠错使用新的 forward migration。
- 开发/CI 空库可通过销毁 Docker/Testcontainers volume 重新从零安装。
- 生产环境回滚需要结合备份/恢复、forward compensating migration 和正式变更窗口；PHASE-03 不用 `flyway clean` 作为生产回滚。
- tenant seed/关键事实已进入正式 DB 后，不通过覆盖历史记录“回滚”。

## GitHub 阶段施工闭环

```text
Repository: louthison/NEWSTART
Branch: agent/full-build
Draft PR: #2 / OPEN / DRAFT / not merged
PHASE-02 Formal Gate baseline: 496e57801e5df849638d1f91e4423f251f9489d5
Validated PHASE-03 implementation checkpoint: f63249fdbec828d6178308b42d6a3900653ec077
Completed-phase regression checkpoint: cc7612b722b951cb49ab8b89a2457ae1660c79f9
Ledger finalize workflow: 31174051036 / success
Ledger closure commit: 6a847a023cbf4a4293ebed05a770384e23c418d6
GitHub Push: PASS
Force Push: NO
```

本报告 commit 无法在自身正文中自引用自身 SHA。最终 `READY_FOR_GATE` 对外结论必须在本报告/evidence 提交后，重新独立核对：

- current branch Remote HEAD；
- Draft PR #2 head；
- current exact-head `Phase 03 Database Baseline` CI；
- current exact-head `Phase 03 Runtime Database Identity` CI。

若任一最终 exact-head CI 失败，则本阶段必须报告 `NOT_READY`。

## 阶段结论

```text
PHASE-03 = PASS / READY_FOR_GATE
PHASE-04 = NOT_STARTED
```

**本报告不宣布 Formal Phase Gate PASS，也不授权自动开始 PHASE-04。**
