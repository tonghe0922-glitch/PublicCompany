# PHASE-11 P011–P016 XLSX ACTUAL PARSE SNAPSHOT

<!-- GENERATED: DO NOT EDIT. Regenerate with the generator recorded in the JSON contract. -->
> Content SHA-256: `64bba585691e70d59310ef1d66b899f1583c0486d04c0cf89258f3feac53dd5a`

> 优先读取当前仓库中的原始 XLSX；原件缺失时只使用 PHASE-01 已落盘、逐行且带来源坐标的机器合同缓存。
> 缓存模式不会伪称重新解析原始 XLSX；本文件只冻结施工来源，不代表业务流程已实现。

## Result

- Processes: **6 / 6**
- Portals: **3 / 3**
- XLSX workbooks parsed: **18 / 18**
- Raw XLSX currently present: **18 / 18**
- PHASE-01 machine-contract cache used: **0 / 18**
- Parse failures: **0**
- Parsed sheets: **108**
- Non-empty source rows: **5655**
- PHASE-01 business API-like records: **0**
- API path inference from process/sheet text: **FORBIDDEN**

## Process / database / workbook evidence

| Process | Canonical name | Database mapping | Employee | Center | Tech |
|---|---|---|---|---|---|
| P011 | 绩效管理 | `performance.performance_cycle` | 6 sheets / 284 rows / RAW_XLSX | 6 sheets / 359 rows / RAW_XLSX | 6 sheets / 300 rows / RAW_XLSX |
| P012 | 晋升与任职发展 | `hr.promotion_request` | 6 sheets / 284 rows / RAW_XLSX | 6 sheets / 359 rows / RAW_XLSX | 6 sheets / 300 rows / RAW_XLSX |
| P013 | 奖励 | `reward.reward_case` | 6 sheets / 278 rows / RAW_XLSX | 6 sheets / 335 rows / RAW_XLSX | 6 sheets / 294 rows / RAW_XLSX |
| P014 | 纪律、责任与申诉 | `reward.discipline_case` | 6 sheets / 288 rows / RAW_XLSX | 6 sheets / 363 rows / RAW_XLSX | 6 sheets / 304 rows / RAW_XLSX |
| P015 | 成长积分与荣誉积分 | `reward.point_transaction` | 6 sheets / 325 rows / RAW_XLSX | 6 sheets / 358 rows / RAW_XLSX | 6 sheets / 299 rows / RAW_XLSX |
| P016 | 员工福利与关怀 | `welfare.care_case` | 6 sheets / 278 rows / RAW_XLSX | 6 sheets / 353 rows / RAW_XLSX | 6 sheets / 294 rows / RAW_XLSX |

## Required sheet contract

Every portal workbook is verified to contain the current catalog-declared sections:
`00_流程总览 / 01_表单清单 / 02_字段字典 / 03_状态与审批 / 04_规则与接口 / 05_三端联动`.

## Preparation boundary

- This snapshot does not invent REST paths, permission codes, route paths, states, approvers, or data scopes.
- Current checkout may not contain the original XLSX files. In that case the exact PHASE-01 row contracts and workbook metadata are the only accepted fallback, and the absence remains explicit.
- P011–P016 must be converted into formal SOURCE_CONTRACT / IMPACT_MATRIX / GAP_MATRIX only after this snapshot is reviewed with current code and master ledgers.
- P017 and later processes remain out of scope.
- Machine evidence: `docs/implementation/phases/PHASE-11/P011_P016_SOURCE_SNAPSHOT.json`.
