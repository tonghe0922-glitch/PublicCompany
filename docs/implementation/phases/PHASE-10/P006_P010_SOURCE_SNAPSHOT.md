# PHASE-10 P006–P010 XLSX ACTUAL PARSE SNAPSHOT

<!-- GENERATED: DO NOT EDIT. Regenerate with the generator recorded in the JSON contract. -->
> Content SHA-256: `a56d6c118c8239c6aa0c228c1b6a53b8b4d125806763eea85fcb7e16c15564d3`

> 优先读取当前仓库中的原始 XLSX；原件缺失时只使用 PHASE-01 已落盘、逐行且带来源坐标的机器合同缓存。
> 缓存模式不会伪称重新解析原始 XLSX；本文件只冻结施工来源，不代表业务流程已实现。

## Result

- Processes: **5 / 5**
- Portals: **3 / 3**
- XLSX workbooks parsed: **15 / 15**
- Raw XLSX currently present: **15 / 15**
- PHASE-01 machine-contract cache used: **0 / 15**
- Parse failures: **0**
- Parsed sheets: **90**
- Non-empty source rows: **4745**
- PHASE-01 business API-like records: **0**
- API path inference from process/sheet text: **FORBIDDEN**

## Process / database / workbook evidence

| Process | Canonical name | Database mapping | Employee | Center | Tech |
|---|---|---|---|---|---|
| P006 | 会议与行动项 | `collaboration.meeting` | 6 sheets / 286 rows / RAW_XLSX | 6 sheets / 361 rows / RAW_XLSX | 6 sheets / 302 rows / RAW_XLSX |
| P007 | 排班与班次调整 | `attendance.shift_change_request` | 6 sheets / 322 rows / RAW_XLSX | 6 sheets / 355 rows / RAW_XLSX | 6 sheets / 296 rows / RAW_XLSX |
| P008 | 请假与考勤 | `attendance.leave_request` | 6 sheets / 325 rows / RAW_XLSX | 6 sheets / 340 rows / RAW_XLSX | 6 sheets / 299 rows / RAW_XLSX |
| P009 | 加班与调休 | `attendance.overtime_request` | 6 sheets / 280 rows / RAW_XLSX | 6 sheets / 337 rows / RAW_XLSX | 6 sheets / 296 rows / RAW_XLSX |
| P010 | 员工学习、考试与资格 | `learning.learning_assignment` | 6 sheets / 285 rows / RAW_XLSX | 6 sheets / 360 rows / RAW_XLSX | 6 sheets / 301 rows / RAW_XLSX |

## Required sheet contract

Every portal workbook is verified to contain the current catalog-declared sections:
`00_流程总览 / 01_表单清单 / 02_字段字典 / 03_状态与审批 / 04_规则与接口 / 05_三端联动`.

## Preparation boundary

- This snapshot does not invent REST paths, permission codes, route paths, states, approvers, or data scopes.
- Current checkout may not contain the original XLSX files. In that case the exact PHASE-01 row contracts and workbook metadata are the only accepted fallback, and the absence remains explicit.
- P006–P010 must be converted into formal SOURCE_CONTRACT / IMPACT_MATRIX / GAP_MATRIX only after this snapshot is reviewed with current code and master ledgers.
- P011 and later processes remain out of scope.
- Machine evidence: `docs/implementation/phases/PHASE-10/P006_P010_SOURCE_SNAPSHOT.json`.
