# PHASE-01 IMPACT MATRIX

> Phase: `PHASE-01`  
> Scope: `PLATFORM/基础工程`  
> Purpose: 全量 Knowledge Base 机器化解析与需求追溯。  
> Rule: 本阶段只生成来源化工程合同、台账、解析工具与验证证据，不实现任何业务页面/API/数据库迁移。

| Dimension | PHASE-01 impact | Authoritative source / rule | Implementation in this phase |
|---|---|---|---|
| process_code | P001–P126 全量核验；要求无缺号、重复、孤儿 | S0、S1 总索引、三端工作簿、process_catalog.csv | 生成机器 catalog 与校验证据 |
| Employee 页面 | 实际解析员工首页 + 全层级页面 Excel | `1-1 员工首页.xlsx`、`1-2员工全层级页面.xlsx` | 只生成 page catalog；不写 Vue |
| Center 页面 | 实际解析中心首页 + 全层级页面 Excel | `2-1 中心首页.xlsx`、`2-2中心全层级页面.xlsx` | 只生成 page catalog；不写 Vue |
| Tech 页面 | 实际解析技术首页 + 全层级页面 Excel | `3-1技术-首页.xlsx`、`3-2技术-全层级页面.xlsx` | 只生成 page catalog；不写 Vue |
| Route | 只提取源文件明确存在的 route；无来源则 `UNKNOWN/null` | 页面 Excel + IA 统一规范 | 不生成 Vue Router |
| Permission | 解析源权限字段、状态/审批与权限相关片段 | 三端工作簿、AGENT、数据库权限资料 | 更新 permission matrix；不创造权限码 |
| Data Scope | 只提取可来源化 SELF/ORG/TECH 等范围；无法来源化标 UNKNOWN | 页面/流程工作簿 + 权限资料 | 机器矩阵 |
| Sensitive Level | 解析 P0–P3 / DATA-L1–L4；未知保持 UNKNOWN | 字段包、AGENT 映射 | 机器矩阵 |
| API | 解析 interface_catalog 与工作簿规则/接口；仅源明确 HTTP method/path 才形成 API 记录 | interface_catalog.csv、三端规则与接口 sheet | 更新 API catalog；不实现 API |
| Application Service | 无业务实现 | N/A | `NOT_IMPLEMENTED_IN_PHASE_01` |
| Domain | 无业务实现 | N/A | `NOT_IMPLEMENTED_IN_PHASE_01` |
| Repository | 无业务实现 | N/A | `NOT_IMPLEMENTED_IN_PHASE_01` |
| 数据库 | 实际统计 3 库/Schema/表/字段/关系/索引/流程落表映射 | machine_readable JSON、CSV、DDL | 生成 database mapping 与统计 |
| Flyway | 不创建应用迁移 | AGENT | `NOT_IMPLEMENTED_IN_PHASE_01` |
| Workflow | 解析流程状态/审批/规则/三端联动来源 | 三端 P001–P126 工作簿、state/rule/linkage catalogs | 生成合同；不运行流程引擎 |
| Outbox | 仅记录 AGENT 技术基线，不实现 | AGENT | `NOT_IMPLEMENTED_IN_PHASE_01` |
| Worker | 仅 GitHub Actions 解析任务，不是业务 Worker | PHASE-01 施工协议 | 解析 CI，可重复执行 |
| Audit | 记录来源、sheet、row、hash、commit 作为派生证据 | PHASE-01 要求 | 派生合同追溯字段 |
| Notification | 无业务实现 | N/A | `NOT_IMPLEMENTED_IN_PHASE_01` |
| Integration | 解析 interface catalog；不调用业务外部系统 | interface_catalog.csv | 机器合同 |
| Unit Test | 解析器语法/纯函数验证 | 解析脚本 | py_compile + parser internal checks |
| Integration Test | GitHub Actions checkout 当前仓库并读取真实 524 个 KB 文件 | 当前施工分支 | 全量解析 run |
| E2E | 本阶段无业务页面，E2E 不适用 | PHASE-01 边界 | `NOT_APPLICABLE` |

## Machine outputs required

```text
docs/implementation/MASTER_PAGE_CATALOG.json
docs/implementation/MASTER_PAGE_CATALOG.md
docs/implementation/MASTER_PROCESS_CATALOG.json
docs/implementation/MASTER_PROCESS_CATALOG.md
docs/implementation/MASTER_TRACEABILITY.md
docs/implementation/MASTER_PERMISSION_MATRIX.md
docs/implementation/MASTER_PERMISSION_MATRIX.json
docs/implementation/MASTER_DATABASE_MAPPING.md
docs/implementation/MASTER_DATABASE_MAPPING.json
docs/implementation/MASTER_API_CATALOG.md
docs/implementation/MASTER_GAPS.md
docs/implementation/MASTER_GAPS.json
docs/implementation/PHASE_02_29_WORKLIST.md
docs/implementation/PHASE_02_29_WORKLIST.json
docs/implementation/contracts/phase-01/**
docs/implementation/evidence/PHASE-01_VALIDATION.json
```