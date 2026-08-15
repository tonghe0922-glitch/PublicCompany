# PHASE-11 GAP MATRIX

> 判定基线：`79edc420802bfb9d2e47a0976b6198a67e80c4c2`。`EXISTING_BASELINE_DDL` 只表示主表存在；没有可执行行为、三端页面和测试证据时不得标记实现完成。

## 1. 总体差距

| Gate item | Current | Required before construction/closure | Verdict |
|---|---|---|---|
| PHASE-10 prerequisite | COMPLETE，封板后整改 CI 绿色 | 持续回归 | EXISTING |
| PHASE-11 source parse | 18/18 XLSX、108 sheets、5,655 rows、0 failure | 确定性解析 | EXISTING |
| Source contract | Preparation contract generated | C0 逐流程冻结 | EXISTING |
| Page bindings | P013 候选过宽；其余精确候选 0 | 物理 XLSX source_key + route 的人工冻结 | EXISTING |
| Business API source | 0 records | 显式工程合同并标注非 XLSX 原始事实 | EXISTING |
| Permission/data scope | 未冻结 | 每动作 action + data scope + field projection | EXISTING |
| Workflow version | 未冻结 | published version/node/action/form contract | EXISTING |
| Production implementation | P011–P015 无；P016 只有旧内核 | 六流程服务端、三端、数据库、测试闭环 | MISSING/PARTIAL |
| PHASE-12 boundary | NOT_STARTED | 保持锁定 | PASS |

## 2. 流程差距

| Process | DDL | Backend | API | Employee | Center | Tech | Tests/E2E | C0 blockers | Next legal action |
|---|---|---|---|---|---|---|---|---|---|
| P011 绩效管理 | EXISTING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | 领域规则完整性、联动 S11、页面 0 候选、HTTP/permission/workflow | **P011 executable implementation** |
| P012 晋升与任职发展 | EXISTING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | R11/R12 来源语义、预算/薪酬边界、页面 0 候选 | NOT_STARTED_CHECKPOINT |
| P013 奖励 | EXISTING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | 规则完整性、联动 S08/S09、页面候选 126/24/19 人工消歧 | NOT_STARTED_CHECKPOINT |
| P014 纪律责任与申诉 | EXISTING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | 规则完整性、I08 CRM、联动 S03/S10/S11/S12、独立申诉、页面 0 候选 | NOT_STARTED_CHECKPOINT |
| P015 成长/荣誉积分 | EXISTING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | R11/R12 来源语义、不可变流水/冲销/重算、页面 0 候选 | NOT_STARTED_CHECKPOINT |
| P016 福利与关怀 | EXISTING | PARTIAL PHASE-05 | PARTIAL `/api/v1/phase05/...` | MISSING BUSINESS PAGE | MISSING BUSINESS PAGE | MISSING MONITOR/CONFIG PAGE | UNIT/DB PARTIAL；Live E2E MISSING | 旧内核复用、phase05 permission/API、canonical workflow/outbox/audit、联动 S06/S08、页面 0 候选 | NOT_STARTED_CHECKPOINT / REUSE_REVIEW |

## 3. P016 复用差距

**可复用候选**：`CareCaseService`、`JdbcCareCaseRepository`、`WelfareCareCaseController`、现有单元/数据库测试、`phase05-processes.ts` 状态和风险定义、`welfare.care_case` 主表。

**不能直接视为完成**：

- 现有 API/permission 仍命名为 `phase05`，未与 PHASE-11 C0 工程合同对齐；
- 现有服务使用本地顺序状态机，需要确认是否接入 canonical workflow/task/form/outbox；
- 没有员工端、中心端、技术端独立业务页面和字段投影；
- 没有按 PHASE-11 来源验证资格、隐私授权、发放执行、员工确认、对账和归档全链路；
- 没有三端权限负向、幂等、并发旧版本、真实 PostgreSQL/Redis/浏览器闭环证据；
- 不允许创建第二张福利主表或第二套并行 P016 状态事实。

## 4. 准备阶段完成条件

- `IMPACT_MATRIX`、`GAP_MATRIX`、来源合同、页面候选和实现探针提交；
- MASTER_PROGRESS=PHASE-11 IN_PROGRESS，MASTER_PAGE_CATALOG 当前阶段同步；
- Preparation Gate 最终 SHA 绿色；
- P011 仍为 C0_GATE_PASS / NOT_IMPLEMENTED，P012–P016 不被伪标施工完成；
- 生产目录相对 PHASE-10 基线无改动；
- P017+ 保持锁定。

## 5. C0 closeout

C0-01～C0-08 已在 `docs/implementation/contracts/phase-11/C0_DECISION_LOG.md` 处理。页面、HTTP/permission、workflow、database 和 test contracts 已冻结为工程事实；业务实现状态仍保持 P011–P015 MISSING、P016 PARTIAL。
