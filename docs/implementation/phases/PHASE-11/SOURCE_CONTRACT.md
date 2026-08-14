# PHASE-11 SOURCE CONTRACT

> 状态：`FROZEN / C0_CONSTRUCTION_CONTRACT`
> 范围：`P011–P016 绩效成长福利`
> canonical portals：`employee / center / tech`；runtime alias：`tech=admin`

## 来源与归属

- 根 `AGENT.md`、`DESIGN.md`、施工总表、阶段提示词与独立审查反馈。
- Knowledge Base 页面 IA、P011–P016 三端流程/表单/字段工作簿、数据库架构/字段/权限/验收规则。
- `P011_P016_SOURCE_SNAPSHOT.json`：18/18 raw XLSX、108 sheets、5,655 rows、0 failures；SHA-256 为 `D21D758B6CCE42A68659A2D1711C977FFE8DAFDF56DB57234C775074F3A36C55`。

PHASE-01 business API-like baseline 为 0。REST path、permission code 是本阶段显式冻结的工程合同，不能反向宣称来自 XLSX，也不得从标题推断。

| 流程 | 节点 | canonical 表 |
|---|---|---|
| P011 | S01 目标制定；S02 员工确认；S03 过程记录与辅导；S04 权威数据归集；S05 员工自评/主管评价；S06 1000 分计算；S07 校准；S08 结果反馈确认；S09 申诉复核；S10 绩效影响执行；S11 归档 | `performance.performance_cycle` |
| P012 | S01 申请/提名；S02 资格与冻结审查；S03 综合评估；S04 空缺与预算；S05 竞聘/评审；S06 审批；S07 公示；S08 任命与薪酬确认；S09 验证期；S10 生效/回退 | `hr.promotion_request` + `org.employee_position` |
| P013 | S01 贡献事实；S02 证据；S03 级别建议；S04 审批；S05 防重；S06 影响执行；S07 通知；S08 回执；S09 归档 | `reward.reward_case` |
| P014 | S01 线索；S02 止险；S03 调查；S04 申辩；S05 责任评审；S06 决定；S07 送达；S08 执行；S09 申诉；S10 关闭；S11 整改；S12 补充归档 | `reward.discipline_case` |
| P015 | S01 业务事件；S02 人员/来源；S03 例外/防重；S04 规则版本；S05 计算/封顶；S06 风险；S07 入账/复核；S08 通知；S09 调整/冲销；S10 重算 | `reward.point_transaction` |
| P016 | S01 触发/申请；S02 资格；S03 材料/隐私；S04 审批；S05 执行；S06 员工确认；S07 对账；S08 归档 | `welfare.care_case` |

Controller/Vue 不接受自由目标状态，只接受当前节点允许的 action；workflow runtime 与业务投影节点不一致时 fail closed。

## HTTP / permission 冻结

| 流程 | HTTP 根路径 | permissions |
|---|---|---|
| P011 | `/api/v1/processes/P011/performance-cycles` | `p011.performance.read/manage/evaluate/calibrate/appeal/execute/monitor` |
| P012 | `/api/v1/processes/P012/promotion-requests` | `p012.promotion.read/manage/review/approve/appoint/monitor` |
| P013 | `/api/v1/processes/P013/reward-cases` | `p013.reward.read/manage/review/approve/execute/monitor` |
| P014 | `/api/v1/processes/P014/discipline-cases` | `p014.discipline.read/manage/investigate/decide/appeal/monitor` |
| P015 | `/api/v1/processes/P015/point-transactions` | `p015.points.read/manage/review/adjust/monitor` |
| P016 | `/api/v1/processes/P016/care-cases` | `p016.welfare.read/manage/approve/execute/reconcile/monitor` |

所有写操作必须具备 authenticated identity、服务端 action + data-scope 授权、`Idempotency-Key` + request hash、乐观锁版本、不可变 evidence、audit 与 transactional outbox。

## 流程不变量

- P011：`score_type` 独立；员工自评、主管评价、系统计算、校准不得互相覆盖。分数 0–1000；校准、申诉、影响执行分别留证。
- P012：审批不等于生效。正式生效须原子新增/更新 `org.employee_position` 并同步 `org.employee.primary_position_id`，保留旧任职结束日期。薪酬只记外部权威确认引用，不自行计算。
- P013：贡献、审批和积分/奖金/发展影响是不同事实；同源贡献不得重复奖励。奖金只接收外部财务回执；积分只能追加 P015 流水。
- P014：调查、决定、送达、执行、申诉独立留证；调查/评审/决定/复核职责分离并执行利益冲突回避。撤销/变更以新增事件或冲销实现，不删除原记录。
- P015：`reward.point_transaction` append-only，禁止 UPDATE/DELETE/TRUNCATE；纠错、申诉、冲销新增反向/调整流水并引用原流水。余额与段位从有效流水重算。
- P016：资格、隐私授权、审批、执行、员工确认、对账分别留证。付款仅登记外部已授权回执，不计算、不发起支付；发票/执行引用租户内防重。

## 共享运行时、数据库与 DoD

复用 IAM/Session/Step-Up、published Workflow/Form/Task/history、immutable Audit、Outbox/Worker/Notification、统一 Router/API client/Design System。PostgreSQL 是唯一业务真相，Redis 不承担主事实。

V24/V35/V36/V40/V44 与 V90–V99 禁止修改。真实缺口只允许从 V120 起 additive overlay；禁止 `phase11_*` 影子主表。每个流程必须通过真实三端页面、API、服务端权限/data scope、领域/JDBC、canonical PG、workflow/form/task、audit/outbox/worker、刷新持久化、幂等/并发/越权/异常/归档负向路径与真实 Chromium E2E 才能关闭。

