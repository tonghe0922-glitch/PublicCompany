# PHASE-09 PREPARATION REPORT

> Phase: `PHASE-09｜P001–P005 公共能力 A`
> State: `PREPARATION_ONLY / NOT_STARTED`
> Previous phase: `PHASE-08 = COMPLETE / FORMAL_GATE_PASS`
> Construction gate: `5流程三端闭环`

## 1. 准备结论

PHASE-09 已完成开工前事实盘点，但**尚未正式施工**。本准备包没有新增 P001–P005 业务页面、API、权限码、状态机、数据库表、Flyway、Outbox wiring 或 Worker 业务处理，也没有把任何页面/流程标记为 IMPLEMENTED。

## 2. 正式范围

- P001：统一登录与多岗位身份切换；权威主表 `iam.login_session`；
- P002：权限申请、复核与回收；权威主表 `iam.permission_request`；
- P003：个人资料变更；权威主表 `hr.employee_profile_change`；
- P004：通用申请与审批；权威主表 `workflow.generic_request`；
- P005：制度、通知与执行回执；权威主表 `collaboration.notice`。

PHASE-10/P006 及以后全部禁止提前施工。

## 3. 已重新读取的事实源

- 根 `AGENT.md`；
- 根 `DESIGN.md`；
- `Construction Master Schedule.csv`；
- `MASTER_PROGRESS / TRACEABILITY / PROCESS_CATALOG / PAGE_CATALOG / API_CATALOG / PERMISSION_MATRIX / DATABASE_MAPPING / MASTER_GAPS`；
- P001–P005 employee / center / tech 共 15 份流程 XLSX；
- PHASE-01 `pages.json`；
- 当前 IAM / Workflow / Notification / Org / API security 实现。

## 4. XLSX 实际解析证据

GitHub Runner 在真实 checkout 上解析结果：

```text
Processes = 5 / 5
Portals = 3 / 3
XLSX = 15 / 15
Sheets = 90
Non-empty source rows = 4,396
Parse failures = 0
```

每份工作簿均实际包含并读取：

`00_流程总览 / 01_表单清单 / 02_字段字典 / 03_状态与审批 / 04_规则与接口 / 05_三端联动`。

机器证据：`P001_P005_SOURCE_SNAPSHOT.json`。

## 5. 页面追踪证据

PHASE-01 页面目录共 7,126 条。对 `process_codes=P001–P005` 做精确筛选时，当前匹配结果为 **0**。

这意味着：现有页面目录尚未建立 P001–P005 的 canonical process binding。不得通过中文标题相似度补绑定。正式开工 C0 必须把流程 XLSX `05_三端联动` 与页面 IA 的 `source_file/source_sheet/source_row/source_key` 做来源化对账后，才能冻结 route/page/permission 关系。

机器证据：`P001_P005_PAGE_TRACE.json`。

## 6. 当前代码基线

### P001 — PARTIAL

已有：AuthController/LoginService、IdentityDirectory、SessionService、Session switch、Redis session、Spring Security、Audit、三端 Login/Session runtime、真实 PostgreSQL/Redis/browser E2E。

仍需按 P001 XLSX 对账：源流程明确包含 `身份认证/MFA`、S01–S08、会话持续校验、退出与审计。当前 `LoginService` 是用户名/密码 + identity selection + session issue，没有完成 P001 全流程业务语义，也不能据此把 P001 标 COMPLETE。

### P002 — MISSING business loop / EXISTING IAM kernel

IAM 授权、Session permission、ABAC/RLS 基础已存在；当前代码树未发现 P002 `PermissionRequest` 业务 Application/Domain/API。`iam.permission_request` 表已在数据库基线中，但“表存在”不等于权限申请/复核/回收闭环已实现。

### P003 — MISSING business loop

`hr.employee_profile_change` 表已存在；当前 backend modules 没有独立 HR 业务模块，也未发现 `EmployeeProfileChange` 实现。Org/IAM 基础不能替代个人资料变更的申请、敏感字段审批、版本历史和回写闭环。

### P004 — PARTIAL infrastructure / MISSING business loop

Workflow 内核、定义/表单/运行时/编排 JDBC Repository、幂等和 fail-closed transition 能力真实存在；但未发现 `GenericRequest` 业务 Application/Domain/API。不得把 Workflow Engine 内核等同于 P004 通用申请业务已经完成。

### P005 — PARTIAL infrastructure / MISSING business loop

NotificationService、DeliveryHandler/Provider、模板与 PHASE-06 side-effect 内核存在；未发现 `collaboration.notice` 对应 Notice 业务 Domain/API/页面闭环。通知发送能力不等于制度发布、送达、回执、执行确认、归档全部完成。

## 7. 两个 C0 硬阻断

1. **Business API contract gap**：PHASE-01 `api_records.jsonl` 当前业务 API-like records = 0。不能从流程名或 Sheet 文案自行生成 REST path。
2. **Page-process trace gap**：7,126 页面中 P001–P005 canonical `process_codes` binding = 0。不能按中文标题推断 route/permission/process。

这两个问题必须在正式施工开始后的 C0 Contract Freeze 中解决；未解决前不得批量生成页面或 Controller。

## 8. 建议施工顺序

```text
C0 Source / Page / API / Permission Contract Freeze
→ P001 登录/MFA/多身份/持续会话/退出审计闭环
→ P002 权限申请/复核/回收闭环
→ P003 个人资料变更闭环
→ P004 通用申请与审批闭环
→ P005 制度/通知/回执闭环
→ 五流程跨端/权限/幂等/并发/异常全量回归
→ READY_FOR_GATE
```

每个 Pxxx 必须独立 checkpoint，不得先做五套静态页面再补后端。

## 9. 准备完成条件

- PHASE-08 COMPLETE：PASS；
- P001–P005 15 XLSX actual parse：PASS；
- 7,126 page trace 精确扫描：PASS，且暴露 0 binding 缺口；
- 现有代码能力审计：完成；
- Draft Source Contract / Impact / Gap / Start Checklist：完成；
- PHASE-09 状态：仍为 `NOT_STARTED`；
- PHASE-10：`NOT_STARTED`。

结论：`PREPARATION_READY / NOT_STARTED`。
