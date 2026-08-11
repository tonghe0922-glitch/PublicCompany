# PHASE-09 SOURCE_CONTRACT_DRAFT

> State: `DRAFT / PREPARATION_ONLY`
> Scope: `P001–P005`
> This document is not yet the formal construction contract. It becomes authoritative only after C0 resolves the recorded source gaps and is promoted to `SOURCE_CONTRACT.md`.

## 1. Authoritative inputs

1. `/AGENT.md`；
2. `/DESIGN.md`；
3. `Construction Master Schedule.csv`；
4. `MASTER_PROCESS_CATALOG.json` P001–P005；
5. `P001_P005_SOURCE_SNAPSHOT.json`：15 XLSX / 90 Sheets / 4,396 source rows；
6. `P001_P005_PAGE_TRACE.json`；
7. database process mapping；
8. current code and approved PHASE-04/05/06/08 contracts.

## 2. Fixed scope

| Process | Canonical name | Authoritative table |
|---|---|---|
| P001 | 统一登录与多岗位身份切换 | `iam.login_session` |
| P002 | 权限申请、复核与回收 | `iam.permission_request` |
| P003 | 个人资料变更 | `hr.employee_profile_change` |
| P004 | 通用申请与审批 | `workflow.generic_request` |
| P005 | 制度、通知与执行回执 | `collaboration.notice` |

P006+ out of scope.

## 3. Source rules

- XLSX 必须以实际 Sheet/row 为依据，不接受文件名推断；
- route_name / route_path / permission_code / API path / approver / data_scope / status 不得按中文名称生成；
- 三端共享同一个业务事实，不建立 employee/center/tech 三份业务实例；
- 业务状态只由服务端 Application/Domain/Workflow command 改变；
- PostgreSQL 是业务最终事实源；Redis 只承担会话/缓存/短期协调，不得成为 P002–P005 唯一事实源；
- `iam.login_session / permission_request / employee_profile_change / generic_request / collaboration.notice` 已存在于数据库基线并不等价于业务闭环完成；
- 技术端不能绕过业务权限直接审批、改状态或改库。

## 4. P001 minimum contract to freeze

实际 XLSX 已读取的最简流程包含：

`访问统一入口 → 身份认证/MFA → 解析自然人与当前员工关系 → 选择或自动解析当前任职身份 → 加载模块/动作/数据/字段权限 → 进入角色化工作台 → 会话持续校验 → 退出与审计`。

正式 C0 必须逐项判断 PHASE-04/08 已有 IAM/Session 能力是否满足对应节点；缺失能力只补差异，不复制第二套登录/Session。

当前明确差异：现有 LoginService 是 password + identity selection + session issue；P001 XLSX 明确包含 MFA，因此 MFA 节点不能因“登录已经能用”而被跳过或伪造 PASS。

## 5. P002–P005 construction contract rule

每个流程正式开工前必须冻结：

```text
source workbook / sheet / row
Employee page/view
Center page/view
Tech page/view
route
permission
data_scope
sensitive_level
request/response contract
business_id / business_no / process_instance_id
state machine + legal transitions
application commands/queries
domain invariants
repository/table
workflow definition/version
Audit
Outbox event
Worker/Integration if required
Notification if required
idempotency/concurrency policy
E2E acceptance path
```

任何 UNKNOWN 都不得静默填充。

## 6. Current blockers before formal contract promotion

### BLOCKER-A — API contract

PHASE-01 business API-like records = 0。正式 C0 必须从 15 XLSX 的 `04_规则与接口`、现有 Controller/Service 和已批准 ADR 中建立 P001–P005 API contract。不得按 REST 习惯自行命名。

### BLOCKER-B — Page/process binding

PHASE-01 7,126 page records 中 `process_codes` 精确匹配 P001–P005 = 0。正式 C0 必须通过流程 XLSX `05_三端联动` 与页面 IA 的 source coordinates 建立可追溯绑定。不得通过 display_name 相似度推断。

## 7. Reuse contracts

必须复用：

- PHASE-08 unified API client / Router / Session runtime；
- PHASE-04 IAM/RBAC/ABAC/Step-Up/Audit；
- PHASE-05 Workflow kernel；
- PHASE-06 Outbox / Worker / Notification / integration side-effect kernel；
- PHASE-07 Design System。

禁止新增第二套 Router、Session、API client、workflow engine、outbox 或 notification infrastructure。

## 8. Promotion condition

本 Draft 只有同时满足以下条件才可改名/升级为 `SOURCE_CONTRACT.md`：

1. BLOCKER-A 有来源化 API 决议；
2. BLOCKER-B 有来源化 page/process trace；
3. P001–P005 exact permission/data-scope/sensitive fields frozen；
4. exact state/approval rules从 15 XLSX 固化并冲突对账；
5. `IMPACT_MATRIX.md / GAP_MATRIX.md` 正式版建立；
6. `MASTER_PROGRESS` 才可将 PHASE-09 改为 `IN_PROGRESS`。
