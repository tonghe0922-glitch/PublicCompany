# PHASE-03 GAP MATRIX

> Phase: `PHASE-03｜数据库三库、Schema、Flyway 与基础角色`
> Status vocabulary: `EXISTING / PARTIAL / MISSING / CONFLICT / BLOCKED`.
> Final construction snapshot before Formal Phase Gate. `READY_FOR_GATE` is not `COMPLETE` and does not authorize PHASE-04.

| ID | Area | Status | Final PHASE-03 fact | Boundary / follow-up |
|---|---|---|---|---|
| G01 | Repository / branch | EXISTING | `louthison/NEWSTART` / `agent/full-build` / Draft PR #2，所有推进均 fast-forward，无 force push | Formal Gate 继续核验 current Remote HEAD |
| G02 | Previous gate | EXISTING | PHASE-02 = `COMPLETE`；最新 completed-phase regression run `31173720739` 全部 job success | 不回退 PHASE-02 |
| G03 | PostgreSQL runtime | EXISTING | PostgreSQL 16 Compose + Testcontainers `postgres:16.14-alpine3.24` 均已验证 | 生产拓扑仍需部署阶段决定 |
| G04 | Core databases | EXISTING | `sjg_oms / sjg_audit / sjg_dw` 三库均由正式迁移链安装 | PostgreSQL 为唯一交易事实源 |
| G05 | Schema baseline | EXISTING | 当前批准 DDL 与实际安装均验证 46 个物理 database+Schema | Gate 需复验当前 head |
| G06 | Table baseline | EXISTING | 当前机器重算：表目录 265 = 批准 DDL unique CREATE TABLE 265；catalog-only 0 / DDL-only 0 | 历史“DDL=266”机械扫描口径已被当前确定性报告取代 |
| G07 | Index baseline | EXISTING | 索引目录 1,024；原批准 DDL 1,019；5 个 catalog-only audit tenant 索引已按目录事实纳入 sourced overlay；formal baseline = 1,024 | 原 DDL 包与索引目录的 5 项来源差异继续在 baseline report 中保留 |
| G08 | Approved DDL | EXISTING | KB `03_SQL_DDL` 三库批准 SQL 已确定性纳入 Flyway，KB 原文件未修改 | 后续结构变更必须继续走 Flyway |
| G09 | Flyway formal migrations | EXISTING | `technical-platform/database/flyway/**` + `flyway-overlays/**` 已建立 | 正式结构 SQL 旁路路径由 CI 阻断 |
| G10 | Flyway provenance | EXISTING | `manifest.json` 记录 source path/source SHA-256/generated SHA-256；生成器可重复验证 | V95 compatibility transformation 单独记录 |
| G11 | Database owner role | EXISTING | `sjg_owner` = NOLOGIN/NOSUPERUSER/NOBYPASSRLS；三核心 DB owner 均规范化为 `sjg_owner` | runtime 不可登录 owner |
| G12 | Migration/runtime least privilege roles | EXISTING | `sjg_migration`, `sjg_api_runtime`, `sjg_worker_runtime`, audit/dw writer/reader roles 均建立并有最小权限测试 | 角色密码仅由部署环境提供 |
| G13 | BYPASSRLS protection | EXISTING | 正式 login roles 均 `NOBYPASSRLS`；CI 查询 pg_roles 实测 | 业务层 ABAC/RBAC 仍属于后续 IAM 阶段 |
| G14 | OMS tenant RLS SQL | EXISTING | KB 既有 RLS 被保留，PHASE-03 overlay 补齐统一安全覆盖 | 不重写 KB 原策略 |
| G15 | All-DB tenant RLS proof | EXISTING | 三库所有含 `tenant_id` 的 base table 均实测 `relrowsecurity=true` 且至少有一条 policy | PostgreSQL 16 Testcontainers 自动验证 |
| G16 | Audit immutability | EXISTING | 正式 `sjg_audit_writer` = INSERT/SELECT；`sjg_auditor` = SELECT；旧 `sjg_app` 降为 NOLOGIN compatibility role | 业务代码不得复用 `sjg_app` |
| G17 | Audit negative test | EXISTING | `sjg_audit_writer` UPDATE / DELETE / TRUNCATE 均被真实 PostgreSQL 拒绝 | 继续作为 Gate 回归 |
| G18 | Migration empty-install | EXISTING | 空 PostgreSQL 16 可安装 cluster roles + 三库完整 Flyway | 已经历真实失败→修复→全绿证据链 |
| G19 | Migration rerun | EXISTING | Flyway `validate()` 通过；第二次 migrate = 0 pending |  applied migration 禁止修改 |
| G20 | Flyway checksum validation | EXISTING | deterministic regeneration + source/generated SHA + Flyway validate 均 CI 化 | 无 checksum 绕过 |
| G21 | Testcontainers PostgreSQL 16 | EXISTING | `database-baseline` Maven module 已执行数据库结构、安全、迁移角色集成测试 | PHASE-03 workflow 独立拥有这些测试 |
| G22 | Database baseline report | EXISTING | `DATABASE_BASELINE_REPORT.md` + `PHASE-03_STATIC_BASELINE.json` 可重复生成 | Gate 可机器复核 3/46/265/1024 |
| G23 | Initialization data | PARTIAL | 已批准 SQL seed `V95` 通过部署必填 tenant facts 安装并验证 126 个 workflow definitions；其它 CSV 初始化资料未被擅自转成 SQL | 后续拥有具体主数据/业务初始化职责的 PHASE 再按批准来源施工；非 PHASE-03 blocker |
| G24 | Flyway-only structure gate | EXISTING | CI 扫描 `technical-platform` 下 `.sql`，正式结构 SQL 只允许 Flyway/overlay 目录 | KB 原始来源目录除外 |
| G25 | Business pages/APIs/processes | EXISTING | PHASE-03 新增业务 IMPLEMENTED 数 = 0；7,126 页面/126 流程集合由 ledger hash 保护 | PHASE-04+ 才进入后续范围 |
| G26 | gh CLI local availability | BLOCKED | 当前执行环境无本地 `gh` checkout | 用户已授权 GitHub Connector 等价 fetch/commit/push/CI；如实记录，非工程 DoD blocker |
| G27 | Migration/runtime identity separation | EXISTING | bootstrap=`sjg_bootstrap`；migration=`sjg_migration`；API=`sjg_api_runtime`；Worker=`sjg_worker_runtime`；API/Worker application Flyway disabled and deps removed | API/Worker CREATE TABLE 负向测试必须持续拒绝 |
| G28 | Independent migration runner | EXISTING | Linux `scripts/database/migrate.sh` + Windows `scripts/windows/migrate.bat`；runner migrate/validate/repeatability 三库 | tenant id/code/name 无 Git 默认值 |
| G29 | Windows Chinese path | EXISTING | migration/start contract 在 Windows 中文路径验证；completed PHASE-02 install/verify/start/stop regression 也恢复 success | 交互式生产凭据启动仍非 CI 场景 |
| G30 | PHASE-03 final exact-head CI | PARTIAL | 核心 implementation/ledger checkpoints 已全部绿；最终 PHASE_REPORT/evidence commit 仍需再次触发 Database + Runtime workflows | 最终回答前必须验证 exact Remote HEAD 两套 CI success |

## Gate interpretation

PHASE-03 当前施工结论为 **PASS / READY_FOR_GATE**。Formal Phase Gate 尚未执行，因此：

```text
PHASE-03 = READY_FOR_GATE
PHASE-04 = NOT_STARTED
```

不得把本矩阵视为 `COMPLETE`，不得自动施工 PHASE-04。
