# PHASE-09 GAP_MATRIX_DRAFT

> State: `DRAFT / PREPARATION_ONLY`
> Allowed status vocabulary: `EXISTING / PARTIAL / MISSING / CONFLICT / BLOCKED`.
> 本矩阵只表达正式开工前的差距，不代表施工状态。

| Gap / Capability | Status | Preparation evidence | Required C0 / construction action |
|---|---|---|---|
| PHASE-08 prerequisite | EXISTING | COMPLETE / Formal Gate PASS | 保持回归，不重做 |
| P001–P005 process scope | EXISTING | Construction Schedule + MASTER_PROCESS_CATALOG | 固定只做 5 流程 |
| 15 三端流程 XLSX actual parse | EXISTING | 15/15，90 Sheets，4,396 non-empty rows，0 failures | `phase09_preparation_extract.py --check` 持续门禁 |
| P001–P005 authoritative DB mapping | EXISTING | iam.login_session / iam.permission_request / hr.employee_profile_change / workflow.generic_request / collaboration.notice | 对照字段字典/DDL，禁止自行建平行表 |
| Business API source contract | BLOCKED | PHASE-01 business API-like records = 0 | C0 逐行读 `04_规则与接口` + current Controller/ADR，建立批准 API contract；禁止猜 REST path |
| Page → process canonical binding | BLOCKED | 7,126 pages 中 P001–P005 `process_codes` exact match = 0 | C0 用 `05_三端联动` + 页面 IA source coordinates 建立来源化 trace；禁止标题相似匹配 |
| Exact route binding | BLOCKED | page-process binding 尚未建立 | page trace 解决后再冻结 route_name/route_path |
| Exact permission codes | BLOCKED | existing permission fragments不能替代 P001–P005 action permissions | 从 process rules/linkage + approved permission catalog 冻结 |
| Exact data scopes | BLOCKED | current IAM/RLS only provides platform baseline | 按三端字段/规则逐节点冻结 SELF/CENTER/PROJECT 等来源值 |
| Exact sensitive levels | BLOCKED | process field dictionary 尚未转换到实施矩阵 | 从 15 XLSX 字段字典逐字段固化，L3/L4动作绑定 Step-Up |
| P001 current IAM/login/session kernel | EXISTING | AuthController/LoginService/IdentityDirectory/SessionService/SessionView/refresh/switch/audit/live E2E | 复用，不创建第二套 |
| P001 MFA node | MISSING | XLSX 明确 `身份认证/MFA`；当前 LoginService 未执行 MFA | C0 冻结 MFA方式/触发/失败策略后实现真实节点与负向测试 |
| P001 S01–S08 process semantic closure | PARTIAL | login/session能力覆盖部分节点，但未作为 P001 完整业务闭环验收 | 逐节点映射现有能力与缺口，补唯一事实/审计/异常闭环 |
| P002 authorization kernel | EXISTING | IAM grants/permissions/ABAC/RLS baseline | 复用 |
| P002 PermissionRequest business layer | MISSING | current tree no PermissionRequest Application/Domain/API | 按 XLSX 建 request/review/revoke commands + repository + workflow + audit |
| P003 employee profile change business layer | MISSING | DB table exists；current modules no HR business module / EmployeeProfileChange implementation | 先确认模块归属 ADR，再实现申请/审批/版本/回写/审计 |
| P004 workflow infrastructure | EXISTING | canonical workflow definition/runtime/form/orchestration/JDBC/idempotency kernel | 复用 |
| P004 GenericRequest business layer | MISSING | current tree no GenericRequest implementation | 在 workflow kernel 上构建业务薄层，不复制引擎 |
| P005 notification infrastructure | EXISTING | NotificationService/Delivery/Template + side-effect kernel | 复用 |
| P005 Notice business lifecycle | MISSING | current tree no collaboration Notice domain/API/repository | 建立发布范围→投递→回执/异议→执行确认→归档的来源化闭环 |
| Process-specific Outbox wiring | PARTIAL | PHASE-06 kernel existing；P002–P005 specific event binding not verified | 按每个节点真实副作用逐项接线 |
| Process-specific Worker/Integration | PARTIAL | worker/integration kernel existing | 仅在 XLSX/接口目录要求异步或外部动作时接入 |
| Process-specific Audit | PARTIAL | platform audit exists | 每个状态变更/审批/敏感读取/权限变更必须写 immutable audit |
| Unit tests P001–P005 | PARTIAL | P001 IAM tests exist；P002–P005 business tests absent | 每个小闭环立即补 |
| PostgreSQL integration P001–P005 | PARTIAL | platform/IAM integration exists；业务 5 流程未验证 | 使用 PostgreSQL16 Testcontainers 验证持久化、历史、RLS、版本、幂等 |
| Three-portal E2E P001–P005 | MISSING | only platform login/session E2E exists | 每个流程真实 employee→center→tech/回显闭环 |
| PHASE-10 leakage | EXISTING | PHASE-10 NOT_STARTED | source gate持续禁止 P006+ 实现 |

## Preparation verdict

```text
PHASE-09 state = NOT_STARTED
Preparation source extraction = PASS
Preparation page trace = PASS (and exposes 0 page-process binding)
Hard C0 blockers = 5 groups:
  1) API contract
  2) page/process binding + route
  3) permission/data-scope/sensitive-level freeze
  4) P001 MFA contract
  5) exact state/approval/side-effect mapping per process
Business implementation started = NO
PREPARATION_READY = YES
```
