# PHASE-01 GAP MATRIX

> Status vocabulary: `EXISTING / PARTIAL / MISSING / CONFLICT / BLOCKED`.  
> Finalized after PHASE-01 full-machine validation.

| ID | Area | Status | Final PHASE-01 fact | Handling / next boundary |
|---|---|---|---|---|
| G01 | GitHub work branch | EXISTING | `agent/full-build` 已持续施工，未 force push | 继续保留当前施工分支 |
| G02 | Draft PR | EXISTING | PR #2：`agent/full-build → main`，仍为 Draft/未合并 | PHASE-35 前不自动 merge |
| G03 | gh CLI | BLOCKED | 当前执行容器无 `gh` | 用户已明确授权 GitHub Connector 等价远程操作；不影响本阶段已验证结果 |
| G04 | Container direct GitHub network | BLOCKED | 当前执行容器无法直接解析/clone GitHub | 已由 GitHub Actions 在 GitHub 侧 checkout 当前分支并全量解析真实文件 |
| G05 | Six page XLSX machine parse | EXISTING | 6/6 实际解析，7,126 条页面记录 | 来源/SHA/sheet/row 保留在 page catalog/contracts |
| G06 | S0/S1 P001–P126 verification | EXISTING | S0=126 唯一；S1=126 唯一；无缺号、重复或孤儿 | 后续以 catalog 驱动施工 |
| G07 | Three-portal 378 workbooks | EXISTING | Employee/Center/Tech 各126，共378；解析失败0 | 六类 sheet 均来源化入 contracts |
| G08 | Page → process trace | PARTIAL | 7,126 页面均可追溯来源；部分页面源表未给明确 P-code | 不按标题猜 process_code；保持 UNKNOWN 并在 MASTER_GAPS 留痕 |
| G09 | Permission / data scope / sensitive level | PARTIAL | 提取到 94,760 条权限相关来源片段；大量页面没有完整来源化的 scope/sensitive/mobile | 未来源化字段保持 UNKNOWN，业务实施前逐页补证据 |
| G10 | Database actual counts | EXISTING | 核心库3、物理Schema46、物理表目录265、字段7116、关系1335、索引目录1024 | 以 machine contracts 为实施基线 |
| G11 | Process → authoritative table | EXISTING | P001–P126 126/126 均从 `07_流程落表映射.csv` 定位 Schema/主表 | 禁止后续自行换主表 |
| G12 | Interface / HTTP API | PARTIAL | `interface_catalog.csv` 已解析，但其 endpoint 是 portal 语义而非 HTTP path；HTTP API records=0 | 后续 API 阶段按接口事实设计 REST 契约，不伪造 URL |
| G13 | MASTER_GAPS | EXISTING | 17,110 条；WARN 17,109、INFO 1、BLOCKER 0 | UNKNOWN 保留，不静默修正业务 |
| G14 | PHASE-02–29 worklist | EXISTING | 已由实际 126 process catalog 生成工作清单 | 清单是施工排序，不授权提前施工 |
| G15 | Knowledge Base `04 Agents开发规范` | CONFLICT | 根 AGENT 提及 pointer 路径，但当前 KB 树不存在此目录 | 保留事实差异；根 AGENT 仍为 canonical，不自行创建该目录内容 |
| G16 | Business implementation | EXISTING | 本阶段没有 Vue/API/Application Service/Repository/Flyway 业务实现 | 符合 PHASE-01 边界；不得标业务功能 IMPLEMENTED |
| G17 | Form count | CONFLICT | S1 总索引声明 2,164；逐三端工作簿 `表单清单` 实际抽取 1,972 行 | 不修改源文件；后续表单/流程实施前按 process_code 定位差异 |
| G18 | DDL table count vs table catalog | CONFLICT | 数据字典表目录=265；DDL 机械扫描 CREATE TABLE=266 | 进入数据库实施前逐条对齐，不能凭数量删除任一 DDL/目录记录 |
| G19 | DDL index count vs index catalog | CONFLICT | 索引目录=1,024；DDL 机械扫描 CREATE INDEX=1,019 | 进入数据库实施前按表/索引名对齐，当前不自行补删 |
| G20 | Source routes | EXISTING | 源 Excel 明确给出建议路由 7,025 条，已 7,025/7,025 写入 page catalog | 无来源路由保持 null；不自行创造 route |

## Final gate interpretation

PHASE-01 的硬性 DoD 已全部满足，机器 Gate = PASS。G03/G04 是当前对话执行环境工具限制，已经由用户授权的 Connector + GitHub Actions 等价路径解决；G08/G09/G12/G15/G17/G18/G19 是明确保留的资料/契约缺口，不得在 PHASE-01 擅自“修成”业务事实。

```text
PHASE-01 = READY_FOR_GATE
PHASE-02 = NOT_STARTED
```
