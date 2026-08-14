# PHASE-11 P011 Checkpoint

> Process: `P011` 绩效管理  
> State: `CHECKPOINT_PASS / CLOSED`（施工方本地自检）  
> Next allowed process: `P012`  
> Evidence authority: `I:\PublicCompany_source_codex` 当前磁盘；本目录无 `.git`，不声明远端 CI 或独立 PASS

## 来源与业务边界

- PHASE-11 确定性来源快照：18/18 个原始 XLSX、108 个 sheet、5,655 个非空行、0 个解析失败，SHA-256 `D21D758B6CCE42A68659A2D1711C977FFE8DAFDF56DB57234C775074F3A36C55`。
- 权威流程：S01 目标制定 → S02 员工确认 → S03 过程记录与辅导 → S04 权威数据归集 → S05 员工自评/主管评价 → S06 千分制计算 → S07 独立校准 → S08 结果反馈确认 → S09 申诉复核 → S10 绩效影响执行登记 → S11 归档 → END。
- canonical 主事实保持 `performance.performance_cycle`；V120 只增加不可变的分数、事件和执行回执事实，不复制主记录。
- 员工自评、主管评价、系统计算、校准结果是四种独立、不可覆盖的分数事实。绩效影响只登记外部人事执行引用，平台不直接计算薪资或执行付款。

## 已实现闭环

- 新增 `platform-performance` 模块，使用租户事务、服务端业务编号、幂等登记、已发布 Workflow/Form/Task、乐观锁、审计和 Transactional Outbox。
- 四类分数限定在 0–1000，员工必须先自评，主管评价后才可计算；校准人必须与主管评价人不同。
- 目标确认、自评和反馈确认只能由目标员工执行；目标员工不能评价自己、校准、复核申诉、执行影响或归档。
- 提出申诉后禁止走 `NO_APPEAL`，必须由有权且非本人角色复核；影响执行必须使用批准类型和非空外部回执引用。
- PostgreSQL 对分数、事件、执行回执启用 RLS、跨租户引用守卫、append-only trigger 和运行角色 UPDATE/DELETE/TRUNCATE 撤权。
- Worker 通知只渲染业务号、事件和节点标签；分数、申诉原因、证据和外部执行引用不会进入通知。
- 技术端只能读取元数据投影，服务端将原因、分数、申诉状态、分数明细、事件和执行回执全部置空/隐藏，也不暴露业务操作按钮。

## Trace / page / process / API / permission / database 台账

| 维度 | 已闭环事实 | 可复现位置 |
|---|---|---|
| Trace | 确定性 XLSX 快照与 7 个精确 source key | `P011_P016_SOURCE_SNAPSHOT.json`、`PHASE11_PAGE_BINDINGS.json` |
| Page | employee 2、center 3、tech 2 条精确路由；共享技术监控按 P011 权限接入 | `P011PerformancePage.vue`、`portal-router.ts`、`Phase09TechWorkflowMonitorPage.vue` |
| Process | 已发布 S01–S11 + END、13 条迁移（含 S05 自评自环）、`CTR-P011-F01` | `V120__phase11_p011_performance_cycle.sql` |
| API | create/list/get/action：`/api/v1/processes/P011/performance-cycles` | `P011PerformanceController.java`、`PerformanceCycleService.java` |
| Permission | `read/manage/evaluate/calibrate/appeal/execute/monitor`；服务端 action + data scope 双校验 | V120、Controller、API IT、路由测试 |
| Database | canonical 主表 + immutable score/event/effect facts；RLS、租户完整性和 append-only | V120、`JdbcPerformanceCycleRepository.java`、DB IT |
| Async/Audit | `P011_PERFORMANCE_EVENT` → Worker → 脱敏通知；创建/读取/动作均写审计 | Handler、通知 DB IT、API IT |

## 可复现本地门禁

| 门禁 | 结果 | 证据 |
|---|---|---|
| Source contract | 18/18、108 sheets、5,655 rows、SHA 校验通过 | `.runlogs/phase11-c0-source-check.log`、`phase11-c0-snapshot-sha256.log` |
| Backend compile/install | 18 模块编译通过；受影响 reactor install 通过 | `.runlogs/phase11-p011-compile-2.log`、`phase11-p011-reactor-install.log` |
| Migration + DB + Worker | PostgreSQL 16.14 空库到 V120、validate；6 tests，0 fail/error/skip | `.runlogs/phase11-p011-v120-migration-probe.log`、`phase11-p011-db-worker-final.log` |
| HTTP integration | Spring + PostgreSQL 16.14 + Redis 7.4；完整生命周期 1/1 通过 | `.runlogs/phase11-p011-api-it-4.log` |
| Frontend | lint/typecheck 通过；21 files/94 tests；三端 build 通过；Knip 通过 | `.runlogs/phase11-p011-web-lint-4.log`、`phase11-p011-web-typecheck-3.log`、`phase11-p011-web-test-final.log`、`phase11-p011-web-build-final.log`、`phase11-p011-web-deadcode-final-2.log` |
| Chromium | real API + PG16.14 + Redis7.4 + 三 Vite 门户；desktop Chromium 1/1，12.8s | `.runlogs/phase11-p011-browser-fixture.log`、`phase11-p011-playwright-1.log` |

三端构建保留既有约 2.003 MB bundle warning；未关闭或调高阈值。Chromium fixture 结束后 PostgreSQL/Redis 容器均已由 shutdown hook 删除。

## 正常与负向路径

正常路径：中心创建 → 目标设定 → 员工确认 → 辅导 → 权威数据归集 → 员工 860 分自评 → 主管 900 分评价 → 系统计算 880 → 独立校准 885 → 员工提出申诉 → 独立复核 → 登记外部发展计划回执 → 归档。最终断言 13 条事件、4 种独立分数、1 条外部执行回执、13 条 P011 Outbox 和完整审计。

负向路径：未认证创建；相同幂等键重放；过期版本；跨中心列表过滤/详情拒绝；技术端字段掩码和业务动作拒绝；非目标员工确认；1001 分；员工冒充主管评价；主管冒充校准人；已申诉走无申诉分支；缺失外部回执；通知重复消费；未知节点回滚；跨租户引用；append-only UPDATE/DELETE。

初次实测发现并保留了三个真实缺陷证据：final JDBC Repository 导致 Spring 代理启动失败、过长节点标签写入 `varchar(32)` 失败、测试将业务回避拒绝误断言为权限拒绝。均在契约边界最小修复并成功重跑。

## Checkpoint 结论

`P011 = CHECKPOINT_PASS / CLOSED`。该结论仅授权按顺序开始 P012，不代表 PHASE-11 独立 PASS；P012–P016 全部关闭并通过阶段全量门禁后才能向独立审查员正式提审。

## Stable remediation Browser revalidation（2026-08-13）

共享 UI 稳定后以全新 Spring API、PostgreSQL 16.14 空库至 V125、Redis 7.4 与三 Vite 门户重跑：desktop Chromium `1/1 PASS`（14.8s / 20.8s）。受控停止后 PostgreSQL `1cd575687a795a15d559dc29112b90c79537d6a8a1b70fe8942a4d35a4871090`、Redis `802dbe78168ad85b0e2df084ce3d9052dca6abf3110d7fc0135701e1f2b349cb` 均 `ABSENT`，Ryuk、workspace gate process、端口均为 0。证据：`.runlogs/phase11-remediation-stable-p011-{fixture,playwright,runtime}.*`。
