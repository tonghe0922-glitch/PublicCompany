# PHASE-04 SOURCE CONTRACT

> Focused current-head XLSX reparse required before IAM runtime code.

## Result

- XLSX sources parsed: **11 / 11**
- Parse failures: **0**
- P001/P002/P003: employee / center / tech workbooks all parsed from the six required sheets.
- Real employee workbook values are **not** written to repository evidence.

## Enterprise/employee sources

- `Knowledge Base/00 企业架构及员工/01 企业组织架构数据表.xlsx` — SHA-256 `c8f33d102761234ff35b463b0c93048aab60d2e55fcb2c5560c4ce3028cd9764` — sheets: 组织架构, 任职明细
- `Knowledge Base/00 企业架构及员工/02 员工的真实工号.xlsx` — SHA-256 `d4a6db396530e0bac6dcd293f504a762061bc5431eb7ef5df4cf6e7d4b83752e` — sheets: Sheet1; row values redacted

## Process workbook parse

| process | portal | source | sheets | nonempty rows by sheet |
|---|---|---|---:|---|
| P001 | employee | `Knowledge Base/02 业务流程 表单 字段/S1 三端业务流程表单字段包/01_员工端/01_平台公共能力/001_统一登录与多岗位身份切换.xlsx` | 6 | 00_流程总览=17, 01_表单清单=7, 02_字段字典=210, 03_状态与审批=10, 04_规则与接口=21, 05_三端联动=10 |
| P001 | center | `Knowledge Base/02 业务流程 表单 字段/S1 三端业务流程表单字段包/02_中心管理端/01_平台公共能力/001_统一登录与多岗位身份切换.xlsx` | 6 | 00_流程总览=17, 01_表单清单=8, 02_字段字典=272, 03_状态与审批=10, 04_规则与接口=21, 05_三端联动=10 |
| P001 | tech | `Knowledge Base/02 业务流程 表单 字段/S1 三端业务流程表单字段包/03_技术后台端/01_平台公共能力/001_统一登录与多岗位身份切换.xlsx` | 6 | 00_流程总览=17, 01_表单清单=8, 02_字段字典=225, 03_状态与审批=10, 04_规则与接口=21, 05_三端联动=10 |
| P002 | employee | `Knowledge Base/02 业务流程 表单 字段/S1 三端业务流程表单字段包/01_员工端/01_平台公共能力/002_权限申请、复核与回收.xlsx` | 6 | 00_流程总览=17, 01_表单清单=7, 02_字段字典=210, 03_状态与审批=10, 04_规则与接口=23, 05_三端联动=10 |
| P002 | center | `Knowledge Base/02 业务流程 表单 字段/S1 三端业务流程表单字段包/02_中心管理端/01_平台公共能力/002_权限申请、复核与回收.xlsx` | 6 | 00_流程总览=17, 01_表单清单=8, 02_字段字典=284, 03_状态与审批=10, 04_规则与接口=23, 05_三端联动=10 |
| P002 | tech | `Knowledge Base/02 业务流程 表单 字段/S1 三端业务流程表单字段包/03_技术后台端/01_平台公共能力/002_权限申请、复核与回收.xlsx` | 6 | 00_流程总览=17, 01_表单清单=8, 02_字段字典=225, 03_状态与审批=10, 04_规则与接口=23, 05_三端联动=10 |
| P003 | employee | `Knowledge Base/02 业务流程 表单 字段/S1 三端业务流程表单字段包/01_员工端/01_平台公共能力/003_个人资料变更.xlsx` | 6 | 00_流程总览=17, 01_表单清单=8, 02_字段字典=203, 03_状态与审批=10, 04_规则与接口=21, 05_三端联动=10 |
| P003 | center | `Knowledge Base/02 业务流程 表单 字段/S1 三端业务流程表单字段包/02_中心管理端/01_平台公共能力/003_个人资料变更.xlsx` | 6 | 00_流程总览=17, 01_表单清单=8, 02_字段字典=212, 03_状态与审批=10, 04_规则与接口=21, 05_三端联动=10 |
| P003 | tech | `Knowledge Base/02 业务流程 表单 字段/S1 三端业务流程表单字段包/03_技术后台端/01_平台公共能力/003_个人资料变更.xlsx` | 6 | 00_流程总览=17, 01_表单清单=8, 02_字段字典=213, 03_状态与审批=10, 04_规则与接口=21, 05_三端联动=10 |

## Privacy and implementation gate

- Organization evidence emits only hierarchy/code/name/type/status-like columns and excludes person/contact/salary fields.
- The real employee-number workbook is parsed structurally, but employee row values are never copied into evidence or test fixtures.
- PHASE-04 tests must use synthetic tenant/account/employee/appointment data.
- PHASE-04 runtime code may start only when this evidence is current and deterministic.

Machine evidence: `docs/implementation/evidence/PHASE-04_SOURCE_CONTRACT.json`.
