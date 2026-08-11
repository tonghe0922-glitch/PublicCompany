# PHASE-09 P001–P005 XLSX ACTUAL PARSE SNAPSHOT

> 15 份三端业务流程 XLSX 由仓库内解析器在当前 GitHub checkout 上实际读取，不按文件名猜业务。
> 本文件只做开工前来源冻结；PHASE-09 仍为 NOT_STARTED，不代表任何业务流程已实现。

## Result

- Processes: **5 / 5**
- Portals: **3 / 3**
- XLSX workbooks parsed: **15 / 15**
- Parse failures: **0**
- Parsed sheets: **90**
- Non-empty source rows: **4396**
- PHASE-01 business API-like records: **0**
- API path inference from process/sheet text: **FORBIDDEN**

## Process / database / workbook evidence

| Process | Canonical name | Database mapping | Employee | Center | Tech |
|---|---|---|---|---|---|
| P001 | 统一登录与多岗位身份切换 | `iam.login_session` | 6 sheets / 275 rows | 6 sheets / 338 rows | 6 sheets / 291 rows |
| P002 | 权限申请、复核与回收 | `iam.permission_request` | 6 sheets / 277 rows | 6 sheets / 352 rows | 6 sheets / 293 rows |
| P003 | 个人资料变更 | `hr.employee_profile_change` | 6 sheets / 269 rows | 6 sheets / 278 rows | 6 sheets / 279 rows |
| P004 | 通用申请与审批 | `workflow.generic_request` | 6 sheets / 240 rows | 6 sheets / 283 rows | 6 sheets / 284 rows |
| P005 | 制度、通知与执行回执 | `collaboration.notice` | 6 sheets / 282 rows | 6 sheets / 357 rows | 6 sheets / 298 rows |

## Required sheet contract

Every portal workbook is verified to contain the current catalog-declared sections:
`00_流程总览 / 01_表单清单 / 02_字段字典 / 03_状态与审批 / 04_规则与接口 / 05_三端联动`.

## Preparation boundary

- This snapshot does not invent REST paths, permission codes, route paths, states, approvers, or data scopes.
- P001–P005 must be converted into formal SOURCE_CONTRACT / IMPACT_MATRIX / GAP_MATRIX only after this snapshot is reviewed with current code and master ledgers.
- P006 and later processes remain out of scope.
- Machine evidence: `docs/implementation/phases/PHASE-09/P001_P005_SOURCE_SNAPSHOT.json`.
