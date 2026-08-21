# PHASE-11｜绩效成长福利（P011–P016）

> Repository: `tonghe0922-glitch/PublicCompany`
> Construction branch: `agent/phase-11-performance-growth-welfare`
> Baseline: `79edc420802bfb9d2e47a0976b6198a67e80c4c2`
> Status: **IN_PROGRESS / P012_CHECKPOINT_CANDIDATE**
> Current legal checkpoint: **P012 executable closure**
> PHASE-12: **NOT_STARTED / LOCKED**

## 1. 阶段边界

根目录 `Construction Master Schedule.csv` 将本阶段固定为 **P011–P016 绩效成长福利**，核心门槛是 **6 流程三端闭环**。本目录只完成开工前来源、影响面、差距和门禁准备；在 P011 C0 冻结前，不新增 P011–P016 生产实现，不得触碰 P017 及后续流程。

| Process | 业务流程 | Canonical primary table | 当前真实状态 |
|---|---|---|---|
| P011 | 绩效管理 | `performance.performance_cycle` | CHECKPOINT_PASS / CLOSED / run `31871437974` |
| P012 | 晋升与任职发展 | `hr.promotion_request` | IN_PROGRESS / CHECKPOINT_GATE_PENDING |
| P013 | 奖励 | `reward.reward_case` | BASELINE_TABLE_ONLY |
| P014 | 纪律、责任与申诉 | `reward.discipline_case` | BASELINE_TABLE_ONLY |
| P015 | 成长积分与荣誉积分 | `reward.point_transaction` | BASELINE_TABLE_ONLY |
| P016 | 员工福利与关怀 | `welfare.care_case` | PHASE-05 既有内核，待复用审查 |

## 2. 已完成的准备证据

- 实际解析 18/18 份员工端、中心端、技术端 XLSX；共 108 个工作表、5,655 条非空来源行，解析失败 0。
- 生成 `P011_P016_SOURCE_CONTRACT`，保留来源中的状态、表单、字段、规则、接口和三端联动文字。
- 生成物理 IA 页面候选；候选不等于绑定，不推断 route 或 permission。
- 生成实现探针；主表存在不等于流程实现，准备期间生产目录相对基线改动为 0。
- 建立 `IMPACT_MATRIX.md`、`GAP_MATRIX.md`、`START_CHECKLIST.md` 和 C0 决策登记表。
- 建立只读 Source Probe、Preparation Analysis 与 Preparation Gate。

完整 5.5 MB 物理来源行快照保留在 GitHub Actions artifact，不作为仓库常驻文件；仓库提交摘要、来源文件 SHA-256、来源合同及候选/差距机器证据。

## 3. C0 前必须处理的澄清

1. P011、P013、P014 的规则表仅含共享 R01–R10，需确认领域规则是否完整。
2. P012 的 R11/R12 是金额预算与票据防重；P015 的 R11/R12 是先行止险与唯一案件。保持来源原文，禁止静默“纠正”。
3. 三端联动工作簿存在 9 处差异，必须选择权威物理坐标并留下决策记录。
4. P013“奖励”在 IA 中命中 126/24/19 条，必须人工消歧；其他五个流程精确名称候选为 0，不能凭名称创造页面。
5. P016 必须先审查 PHASE-05 既有内核的可复用范围，禁止重复建表、重复 Service 或并行真相源。
6. 业务 HTTP 路径来源记录为 0；API、permission、route、workflow version 只能在 C0 作为工程合同显式冻结，不能伪装成 XLSX 原始事实。

## 4. 法定施工顺序

```text
Preparation Gate
→ P011 C0 source/page/API/permission/workflow/database contract freeze
→ P011 small closure + tests + checkpoint push
→ P012 ...
→ P016 reuse-first closure
→ six-process full regression and three-portal Live E2E
→ PHASE_REPORT
→ independent Phase Gate
```

当前停止点：**P011 Checkpoint Gate 已全绿并关闭；当前只施工 P012 晋升与任职发展。P013–P016 与 PHASE-12 不得并行抢跑。**

准备证据候选：`2f3bc41ebb0571d34ac9a75cbef8bedbf19a85ec`；Preparation Gate run `31821929837` / SUCCESS；artifact `9227280256` / `sha256:786f6a5f19a4720066829fef65dc21ddae0be43d2743ad7787a222565d59dacb`。

## 5. C0 frozen evidence

- `PHASE11_PAGE_BINDINGS.json`
- `PHASE11_HTTP_PERMISSION_CONTRACT.json`
- `PHASE11_WORKFLOW_CONTRACT.json`
- `DATABASE_CONTRACT.md`
- `TEST_MATRIX.md`
- `docs/implementation/contracts/phase-11/C0_DECISION_LOG.md`

## 6. P011 checkpoint candidate

- C0 Contract Freeze run `31865754854` / SUCCESS。
- Preparation continuity run `31865754872` / SUCCESS。
- P011 候选包含独立四类分数事实、canonical workflow、权限/数据范围、RLS、Audit、Outbox、三端页面及单元/数据库/前端测试。
- P011 Checkpoint run `31871437974` 的 C0、Java、API 安全、PostgreSQL、前端质量和 verdict 全部成功，已标记 `CHECKPOINT_PASS / CLOSED`。
