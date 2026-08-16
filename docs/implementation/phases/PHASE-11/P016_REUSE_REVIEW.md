# P016 PREEXISTING KERNEL REUSE REVIEW

> process_code: `P016`
> phase: `PHASE-11`
> state: `REUSE_REVIEW_CANDIDATE`
> canonical branch: `agent/phase-11-performance-growth-welfare`

## 1. 结论

P016 必须复用 PHASE-05 已存在的福利关怀事实内核，不允许建立第二业务真相源。当前冻结的 PHASE-11 合同与旧内核存在接口/状态机差异，因此施工形态固定为：

`welfare.care_case` 稳定业务事实主表 + PHASE-11 canonical workflow 适配层 + 既有租户事务/幂等/业务号/财务 fail-closed/证据能力。

不得把旧 `WelfareCareCaseController.advance(requestedStatus)` 直接暴露为 PHASE-11 API；PHASE-11 写接口只能接受 action code，动作请求必须包含 `expectedVersion`，并要求 `Idempotency-Key`。

## 2. 冻结 P016 合同

- API base: `/api/v1/processes/P016/care-cases`
- initial form: `EMP-P016-F01`
- actions:
  1. `REGISTER_CARE_CASE`
  2. `VERIFY_ELIGIBILITY`
  3. `AUTHORIZE_PRIVACY`
  4. `APPROVE_CARE`
  5. `EXECUTE_BENEFIT`
  6. `CONFIRM_RECEIPT`
  7. `RECONCILE`
  8. `ARCHIVE`
- employee route: `/employee/03/06/05`
- center route: `/center/06/03/09`
- tech route: `/tech/01/11/04`

## 3. 复用/补齐/禁止清单

| 能力 | 决策 | 施工要求 |
|---|---|---|
| `welfare.care_case` | REUSE | 唯一稳定业务事实主表；V44 禁止回写 |
| `CareCaseService` 创建校验 | REUSE | 复用必要字段、金额非负、幂等、业务号和财务 fail-closed 语义 |
| `JdbcCareCaseRepository` | REUSE/ADAPT | 继续落 `welfare.care_case`；PHASE-11 适配必须保持 tenant + optimistic lock |
| 旧 `SequentialStateMachine` | DO_NOT_EXPOSE | 旧 `requestedStatus` 仅视为历史实现；PHASE-11 由 canonical workflow 驱动 |
| `WelfareCareCaseController` PHASE-05 endpoint | LEGACY_COMPAT | 不作为 PHASE-11 正式 API，不得新增调用依赖 |
| PHASE-11 canonical workflow | ADD ADAPTER | `Phase11Process.P016` + `Phase11WorkflowCoordinator`，严格按冻结 action 顺序 |
| 资格/隐私/执行/确认/对账事实 | ADDITIVE | V127 仅加 supporting facts/必要兼容字段，全部 tenant-scoped/RLS |
| 执行副作用/outbox | REUSE PLATFORM | 复用 PHASE-06 事务 outbox/worker；不可在 controller 内同步伪完成 |
| 审计/证据/回执 | REUSE PLATFORM | 复用平台审计与证据能力；敏感福利事实保持最小披露 |
| 第二 `care_case`/shadow table | FORBIDDEN | 禁止 `care_case_v2`、`phase11_care_case`、`p016_case` 等第二真相源 |
| 客户端 target status | FORBIDDEN | PHASE-11 API 只能提交 action；状态由服务端决定 |
| P017+ | LOCKED | P016 Checkpoint 关闭前不得施工 |

## 4. 旧内核差异

PHASE-05 `CareCaseService` 已存在 P016 标记、8 个序列节点、财务执行/对账、发票证据校验、租户事务和幂等；但其 `advance()` 接受 `requestedStatus`，且旧节点仅表达历史 PHASE-05 顺序，并未实现当前 C0 冻结的 action contract、7 项 PHASE-11 permission、三端页面绑定和 canonical workflow。因此旧内核不能直接标记 P016 CLOSED。

## 5. V127 施工约束

V127 只能是 additive migration：

1. 不修改 V44；
2. 不重建 `welfare.care_case`；
3. 资格、隐私授权、福利执行、员工确认、对账事实必须可审计且独立留痕；
4. supporting table 必须包含 `tenant_id`、RLS 和租户唯一约束；
5. 不发明金额、等级、福利标准、时限或自动审批阈值；
6. 财务/服务能力不可用必须 fail-closed；
7. 技术端仅监控运行元数据，不获得福利审批业务决定权。

## 6. Gate 通过后的唯一下一步

Reuse Review Gate 通过后，才允许把 `MASTER_PROGRESS` 切换到 `P016_CONSTRUCTION_AUTHORIZED`，随后实施 V127、PHASE-11 adapter、API、三端页面、数据库/API/安全/Web 测试。P016 Checkpoint 全绿并关闭前，P017+ 继续锁定。
