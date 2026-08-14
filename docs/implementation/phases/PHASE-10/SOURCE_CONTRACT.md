# PHASE-10 SOURCE CONTRACT

> Status: `FROZEN / C0_CONSTRUCTION_CONTRACT`
> Scope: `P006–P010 公共能力 B`
> Canonical portals: `employee / center / tech`; runtime alias `tech=admin`.

## 1. Source set

- `AGENT.md`, `DESIGN.md`, `Construction Master Schedule.csv`；
- PHASE-01 master process/page/API/database facts；
- P006–P010 三端 XLSX：15/15、90 sheets、4,745 non-empty rows、0 failures；
- preparation run `31460657430` / artifact `9089655303`；
- current Java/Vue/Flyway；
- shared kernels from PHASE-04/05/06/08/09。

## 2. Process ownership and source state machines

| Process | Canonical table | Source stages |
|---|---|---|
| P006 会议与行动项 | `collaboration.meeting` | S01议题征集 → S02材料完整性检查 → S03会议发布 → S04签到与请假 → S05会议召开 → S06主持人确认纪要 → S07行动项生成 → S08责任人执行 → S09验收与返工 → S10逾期升级 → S11归档复盘 |
| P007 排班与班次调整 | `attendance.shift_change_request` | S01业务量与活动需求输入 → S02班次模板匹配 → S03资格与连续工时校验 → S04主管发布排班 → S05员工确认 → S06换班/替班申请 → S07变更审批 → S08考勤与餐饮/班车联动 → S09日结 |
| P008 请假与考勤 | `attendance.leave_request` | S01请假申请 → S02假期额度预占 → S03工作交接与代理 → S04审批 → S05预占转扣减/驳回释放 → S06排班与考勤标记 → S07实际休假 → S08销假/提前返岗/变更 → S09差额账本调整 → S10考勤日结与归档 |
| P009 加班与调休 | `attendance.overtime_request` | S01事前申请/紧急事实登记 → S02必要性与任务校验 → S03主管审批 → S04实际考勤与劳动事实 → S05成果验收 → S06人事复核 → S07法定工资/调休方案 → S08薪酬回执 → S09归档 |
| P010 员工学习、考试与资格 | `learning.learning_assignment` | S01课程/制度版本发布 → S02按岗位风险指派 → S03员工学习 → S04 1000分制考试 → S05线下实操 → S06主管/专业人员认证 → S07资格生效 → S08岗位权限联动 → S09到期复训/复证 → S10归档 |

任何 Controller/Vue 不得创建新业务状态或允许客户端自由指定 target status。

## 3. Cross-portal truth

Employee、Center、Tech 只对同一个 `business_id/business_no/workflow_instance_id/server_state/version` 做不同 projection/action。Tech 是配置、监控、集成与审计支撑，不是默认业务审批人；P010 技术端不得替代主管/专业人员认证。

## 4. Page binding

PHASE-01 `process_codes` 对 P006–P010 为 0 是保留事实。正式 C0 通过 `PHASE10_PAGE_BINDINGS.json` 选择已批准 page IA 的精确 `source_key + route_path`；这是设计期显式绑定，不是 fuzzy runtime matching。页面只有在真实 Router/API/permission/server-backed behavior/E2E 通过相应 checkpoint 后才能从 PLANNED 提升为 IMPLEMENTED。

## 5. HTTP / Permission

PHASE-01 没有业务 HTTP path。XLSX `04_规则与接口` 给出能力、幂等、重试、补偿、审计和角色规则，而非 REST 地址。因此工程标识由本文件、各 P006–P010 checkpoint、V115–V119 migrations、控制器及路由共同冻结；仓库当前不存在旧说明曾引用的 `contracts/phase-10` 路径，不得虚构该路径或反向声称工程字符串来自业务源。

## 6. Shared runtime contract

必须复用：
- IAM / session / Step-Up / AuthorizationService / immutable Audit；
- published `WorkflowRuntimeService` / Form / Task / history / version；
- Transactional Outbox / Worker / Notification / retry / DLQ；
- unified Vue Router / session / API client / Design System。

每个写操作：authenticated identity + server permission/data scope + `Idempotency-Key` + request hash + optimistic/stale guard。

## 7. Process invariants

### P006
行动项必须由已确认会议/纪要产生并绑定责任人、计划时点、执行证据；验收不通过进入受控返工；逾期必须留升级事实；纪要/行动项与会议主事实可追溯。

### P007
资格、连续工时和时间冲突必须在服务端校验；换班/替班不得只改前端日历；发布/变更后的排班事实与考勤联动可追踪。

### P008
额度只允许通过 **预占、扣减、释放、差额调整流水** 变化；主表额度字段不能替代 append-only ledger。假勤、排班、加班时间冲突必须 fail-closed 或进入 source-backed 例外路径。

### P009
审批不能替代实际出勤/劳动事实；成果验收、人事复核、法定工资/调休方案、薪酬回执是独立节点证据；不得只写一个“approved”状态。

### P010
考试分值为 0–1000；线上考试、线下实操、专业认证、资格生效与岗位权限联动是不同事实。资格到期需支持复训/复证。权限联动由服务端系统执行；Tech 只能按最小权限监控/保障。

## 8. Shared source rules

P006–P009 R11/R12：时间重叠校验；额度只通过预占/扣减/释放/差额调整流水。P010 R11/R12：人员安全优先，重大事件允许先处置后补单但证据不可删除；同一事件一个主案件，相关单据为子单/关联单。以上按源文件原样保留，不静默“纠正”。

## 9. Database rule

V5/V10/V28 是已发布 baseline，禁止直接修改。新增结构必须从 V115+ additive migration 开始，且只有真实缺口才新增；禁止 `phase10_*` shadow business tables。PostgreSQL 为最终业务事实源，Redis 不可承担五流程唯一业务真相。

## 10. Completion definition

每个 P006–P010 只有同时具备真实三端页面/动作、API、权限/data scope、Application/Domain/JdbcRepository、canonical PostgreSQL、published workflow/form/task、Audit、Outbox/Worker/Notification/Integration（按需）、刷新/重登持久化、幂等/并发/负向测试及真实 E2E，才可 `CHECKPOINT_PASS / CLOSED`。静态 UI、mock 200、文档自报均不算完成。
