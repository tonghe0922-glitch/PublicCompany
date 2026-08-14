# PHASE-11：P011–P016 绩效成长福利

> 状态：`COMPLETE / INDEPENDENT_GATE_PASS`  
> Independent review closed on 2026-08-14. PHASE-12 is authorized to start in sequence.
> 唯一施工目录：`I:\PublicCompany_source_codex`
> 上一阶段：`PHASE-10 = COMPLETE / INDEPENDENT_GATE_PASS`
> 下一阶段：`PHASE-12 = NOT_STARTED / AUTHORIZED_TO_START`

## 唯一范围

| 流程 | 名称 | canonical 主事实 |
|---|---|---|
| P011 | 绩效管理 | `performance.performance_cycle` |
| P012 | 晋升与任职发展 | `hr.promotion_request`，生效时联动 `org.employee_position` / `org.employee.primary_position_id` |
| P013 | 奖励 | `reward.reward_case` |
| P014 | 纪律、责任与申诉 | `reward.discipline_case` |
| P015 | 成长积分与荣誉积分 | `reward.point_transaction`，只追加流水 |
| P016 | 员工福利与关怀 | `welfare.care_case` |

禁止施工 P017+。employee、center、tech 只呈现同一服务端事实的不同投影；tech 仅配置、监控、集成和审计支撑，不取得默认业务审批权。

## 权威闭环

- P011：目标制定 → 员工确认 → 过程记录与辅导 → 权威数据归集 → 员工自评/主管评价 → 1000 分计算 → 校准 → 结果反馈确认 → 申诉复核 → 绩效影响执行 → 归档。
- P012：个人申请/组织提名 → 资格与冻结状态审查 → 1000 分综合评估 → 岗位空缺与预算核验 → 竞聘/评审 → 审批 → 公示/告知 → 任命与薪酬确认 → 验证期 → 正式生效/回退安排。
- P013：贡献事实形成 → 证据核验 → 奖励级别建议 → 审批 → 影响项防重复校验 → 荣誉积分/奖金/发展评审影响执行 → 员工通知 → 财务/人事回执 → 归档。
- P014：线索登记 → 临时止险 → 初步核实/正式调查 → 员工陈述申辩 → 责任评审 → 决定审批 → 送达 → 影响项执行 → 申诉复核 → 核心案件关闭 → 独立观察整改 → 补充归档。
- P015：业务事件产生 → 人员与来源校验 → 例外与防重校验 → 规则版本匹配 → 计算与封顶 → 风险分级 → 自动入账/人工复核 → 员工通知 → 申诉/调整/冲销新增流水 → 有效分与段位重算。
- P016：系统触发/员工申请/管理发起 → 资格校验 → 材料与隐私授权 → 审批 → 财务付款/实物发放/服务执行 → 员工确认 → 对账 → 归档。

## 施工顺序

`P011 → 本地可复现 checkpoint → P012 → … → P016 → PHASE-11 全量门禁 → 独立审查`

任一流程未通过自己的数据库、服务、三端页面、权限、负向路径与真实浏览器 checkpoint 前，不进入下一流程。六项全部自检关闭前，不向独立审查员发送正式完成申请。

## Full construction gate closeout

P011-P016 are locally closed and the full source, PostgreSQL/Worker, API, web, static-negative and six-process real-Chromium gates are complete. The reproducible evidence index is `FULL_GATE_REPORT.md`.

This is a construction-side closeout only. PHASE-11 remains `INDEPENDENT_GATE_PENDING`; PHASE-12 remains blocked until the independent reviewer issues PASS.

Independent reviewer supersession (2026-08-14): `PHASE_GATE.md` is now `PASS / INDEPENDENT_GATE_CLOSED`. PHASE-11 is complete and PHASE-12 is unblocked; the construction-only sentence above is retained as historical evidence.

## Remediation closeout（2026-08-13）

独立首轮 FAIL 的六页设计系统、异步状态与复杂度问题已完成施工整改。稳定共享 UI 快照下，全 Web（36 files / 198 tests）与 P011–P016 六套真实 Chromium 均通过；每套 fresh PostgreSQL/Redis 精确 ID 均 `ABSENT`，最终 Ryuk、workspace gate process 与监听端口为 0。状态保持 `CONSTRUCTION_COMPLETE / INDEPENDENT_GATE_PENDING`，PHASE-12 继续 `BLOCKED_BY_PHASE11_GATE`。
