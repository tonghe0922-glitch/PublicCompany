# PHASE-11 IMPACT MATRIX

> 状态：PREPARATION。影响面是预计施工边界，不等于已批准设计；所有具体 route、permission、HTTP、状态迁移和数据库 overlay 必须在每个流程 C0 冻结。

## 1. 流程级影响

| Process | 来源规模 | 状态/表单 | 数据敏感性 | Canonical 表 | 现有可复用资产 | 预计主要影响 |
|---|---|---|---|---|---|---|
| P011 绩效管理 | 字段 208/282/223；P3=0 | 11 states；5/6/6 forms | P1/P2 | `performance.performance_cycle` | 仅基线 DDL/共享平台内核 | 绩效周期、目标确认、权威数据归集、1000分、校准、反馈与申诉；HR/考勤投影。 |
| P012 晋升与任职发展 | 字段 208/282/223；P3=11 | 10 states；5/6/6 forms | P1/P2/P3 | `hr.promotion_request` | 仅基线 DDL/共享平台内核 | 资格冻结、1000分评估、岗位/预算、竞聘审批、任命薪酬、验证期和回退。 |
| P013 奖励 | 字段 208/264/223；P3=22 | 9 states；5/6/6 forms | P1/P2/P3 | `reward.reward_case` | 仅基线 DDL/共享平台内核 | 贡献证据、奖励等级、奖金/积分/发展影响防重、财务人事回执。 |
| P014 纪律、责任与申诉 | 字段 208/282/223；P3=22 | 12 states；5/6/6 forms | P1/P2/P3 | `reward.discipline_case` | 仅基线 DDL/共享平台内核 | 止险、调查、申辩、责任评审、送达、影响执行、独立申诉和观察整改。 |
| P015 成长积分与荣誉积分 | 字段 249/282/223；P3=24 | 10 states；6/6/6 forms | P1/P2/P3 | `reward.point_transaction` | 仅基线 DDL/共享平台内核 | 事件来源、规则版本、计算封顶、风险分级、append-only 入账/调整/冲销、段位重算。 |
| P016 员工福利与关怀 | 字段 208/282/223；P3=22 | 8 states；5/6/6 forms | P1/P2/P3 | `welfare.care_case` | PHASE-05 welfare kernel | 资格、隐私授权、预算票据、付款/实物/服务、员工确认与对账；既有内核对齐。 |


字段数量按员工端/中心端/技术端排列。P3 只表示来源标注，不代表可直接展示；必须由 ABAC、字段级投影、导出控制和审计共同约束。

## 2. 共享模块影响

| Area | Impact | Preparation decision |
|---|---|---|
| Workflow | 六个流程必须复用 canonical workflow/version/task/form，不得再用各自影子状态真相 | P011 C0 先冻结 workflow code/version/node/action；P016 审查现有 SequentialStateMachine 与 canonical workflow 的收敛方案 |
| IAM / ABAC | 员工本人、中心经办/评审、人事/财务、独立申诉人、技术只读/配置职责并存 | permission 与 data scope 逐动作冻结；tech 不得自动拥有业务决定权 |
| Audit / evidence | 绩效、晋升、奖励、纪律、积分、福利均要求前后值、证据、审批和执行回执 | 复用 audit/file/evidence；P014/P015/P016 的敏感证据禁止普通导出 |
| Idempotency / Outbox | 创建、审批、执行、调整/冲销、财务回执和通知需要幂等与可靠事件 | 复用 IdempotencyRegistry、TransactionalOutbox；每个动作单独 key/hash |
| Org / HR / Attendance | 在职、岗位、任职、考勤、人员与中心范围是多流程服务端事实 | 不信任前端传入；跨中心默认拒绝 |
| Finance | P012/P013/P016 涉及预算、奖金、薪酬或支付；P015 来源规则需确认是否涉及财务 | 财务能力不可用时 fail-closed；不在流程服务内伪造支付成功 |
| Notification | 员工确认、反馈、申诉、超时升级、结果与回执 | 模板与收件范围 C0 冻结；敏感正文最小披露 |
| Database | 六张 canonical 主表已存在，仍可能需要 additive overlay、约束、索引、RLS、不可变账本 | 禁止 shadow table；迁移只能向前；P016 先核对旧数据兼容 |
| Employee portal | 发起、补充、确认、回执、申诉/调整等语义页 | 每个 IA 语义使用独立页面或明确组合组件；禁止一个万能页承载所有流程 |
| Center portal | 受理、评审、资源计划、跟踪、验收关闭、复盘 | 权限、批量操作、敏感字段与导出独立设计 |
| Tech portal | 状态/表单/权限/规则/SLA/接口/监控/审计/修复配置 | 只读监控与受控配置；禁止 raw JSON 作为交付页面 |
| Tests / CI | 服务行为、PostgreSQL 约束、权限负向、并发/旧版本、三端 Live E2E | 每个小闭环测试后 checkpoint；最终保持 PHASE-03/04/05/06/09/10 回归全绿 |

## 3. 来源与页面影响

- 18 份流程工作簿已解析，但业务 API 来源记录为 0；API 路径只能作为显式工程合同，并标明来源类别。
- P013 页面候选过宽；其余流程精确名称候选为 0。准备阶段不修改 canonical page records，也不将 PLANNED 页面改成 IMPLEMENTED。
- 三端联动差异必须在 C0 中选择权威物理坐标，不能按“员工端为准”或“技术端为准”静默处理。

## 4. 禁止影响

- 不修改 P017–P020 及 PHASE-12 生产代码。
- 不降低 PHASE-10 已有安全、数据库、前端质量或 Live E2E 门槛。
- 不复制 workflow、IAM、audit、notification、file、finance 等平台内核。
- 不因 P016 已有代码而跳过来源、页面、权限、数据库和真实闭环验收。
