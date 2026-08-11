# KB_FILE_INDEX

> 生成基线：`agent/full-build` 创建时的 GitHub 递归树。递归查询返回 `truncated=false`，因此本索引以该完整树为准。
>
> Knowledge Base 当前根层只有 `00`、`01`、`02`、`03`，未发现 `04 Agents开发规范/`。根 `AGENT.md` 仍是唯一 canonical 工程执行宪法。

## 1. 统计

| 区域 | 文件数 | 说明 |
|---|---:|---|
| `00 企业架构及员工` | 2 | 组织与真实工号 XLSX |
| `01 完整的页面架构` | 9 | 规范/Schema/aliases + 六份页面 XLSX |
| `02 业务流程 表单 字段` | 384 | S0 1；S1 总索引 1；三端目录索引 3；三端流程 XLSX 378；S1 README 1 |
| `03 数据库需求规则` | 129 | 架构、字典、DDL、初始化、ER、验收、映射和包元数据 |
| **合计** | **524** | 仅文件，不含目录 |

## 2. `00 企业架构及员工/`

```text
Knowledge Base/00 企业架构及员工/01 企业组织架构数据表.xlsx
Knowledge Base/00 企业架构及员工/02 员工的真实工号.xlsx
```

## 3. `01 完整的页面架构/`

```text
Knowledge Base/01 完整的页面架构/00_三端页面IA统一规范.md
Knowledge Base/01 完整的页面架构/01_portal_aliases.json
Knowledge Base/01 完整的页面架构/02_page_catalog.schema.json
Knowledge Base/01 完整的页面架构/1-1 员工首页.xlsx
Knowledge Base/01 完整的页面架构/1-2员工全层级页面.xlsx
Knowledge Base/01 完整的页面架构/2-1 中心首页.xlsx
Knowledge Base/01 完整的页面架构/2-2中心全层级页面.xlsx
Knowledge Base/01 完整的页面架构/3-1技术-首页.xlsx
Knowledge Base/01 完整的页面架构/3-2技术-全层级页面.xlsx
```

## 4. `02 业务流程 表单 字段/`

顶层：

```text
Knowledge Base/02 业务流程 表单 字段/S0 全部业务流程简表.xlsx
Knowledge Base/02 业务流程 表单 字段/S1 三端业务流程表单字段包/00_三端业务流程表单字段总索引.xlsx
Knowledge Base/02 业务流程 表单 字段/S1 三端业务流程表单字段包/README_使用说明.txt
```

三端根：

```text
Knowledge Base/02 业务流程 表单 字段/S1 三端业务流程表单字段包/01_员工端/
Knowledge Base/02 业务流程 表单 字段/S1 三端业务流程表单字段包/02_中心管理端/
Knowledge Base/02 业务流程 表单 字段/S1 三端业务流程表单字段包/03_技术后台端/
```

每个端根均存在：

```text
00_目录索引.xlsx
01_平台公共能力/
02_总裁办/
03_财人中心/
04_市场中心/
05_行政中心/
06_物业中心/
07_演艺中心/
08_网络中心/
09_企划中心/
10_新媒体中心/
11_运营中心/
12_跨中心协同/
```

以下 126 个叶文件在上述 **01_员工端、02_中心管理端、03_技术后台端** 中各存在一份；因此本表与三个端根做笛卡尔展开，即精确覆盖 378 个三端流程工作簿路径。

### 4.1 01_平台公共能力（001–020）

```text
001_统一登录与多岗位身份切换.xlsx
002_权限申请、复核与回收.xlsx
003_个人资料变更.xlsx
004_通用申请与审批.xlsx
005_制度、通知与执行回执.xlsx
006_会议与行动项.xlsx
007_排班与班次调整.xlsx
008_请假与考勤.xlsx
009_加班与调休.xlsx
010_员工学习、考试与资格.xlsx
011_绩效管理.xlsx
012_晋升与任职发展.xlsx
013_奖励.xlsx
014_纪律、责任与申诉.xlsx
015_成长积分与荣誉积分.xlsx
016_员工福利与关怀.xlsx
017_电子签署.xlsx
018_数据导入.xlsx
019_敏感导出与文件下载.xlsx
020_数据质量与修复.xlsx
```

### 4.2 02_总裁办（021–023）

```text
021_经营会议闭环.xlsx
022_总裁指令闭环.xlsx
023_重大事项升级.xlsx
```

### 4.3 03_财人中心（024–039）

```text
024_预算闭环.xlsx
025_报销闭环.xlsx
026_借款核销.xlsx
027_跨系统对账.xlsx
028_录用入职闭环.xlsx
029_调岗闭环.xlsx
030_离职闭环.xlsx
031_归档接收.xlsx
032_借阅归还.xlsx
033_销毁鉴定.xlsx
034_标准采购.xlsx
035_紧急采购.xlsx
036_退换货.xlsx
037_售检票闭环.xlsx
038_退款改签.xlsx
039_离线检票.xlsx
```

### 4.4 04_市场中心（040–045）

```text
040_商机推进.xlsx
041_市场活动.xlsx
042_渠道准入.xlsx
043_课程产品上线.xlsx
044_研学团队交付.xlsx
045_讲师排课.xlsx
```

### 4.5 05_行政中心（046–061）

```text
046_通知执行.xlsx
047_正式公文.xlsx
048_会议行动.xlsx
049_大型活动.xlsx
050_入库.xlsx
051_领借调还.xlsx
052_盘点.xlsx
053_报废处置.xlsx
054_派车.xlsx
055_车辆事故.xlsx
056_宿舍入住退宿.xlsx
057_报修.xlsx
058_团餐交付.xlsx
059_食材验收.xlsx
060_食品安全事件.xlsx
061_餐卡结算.xlsx
```

### 4.6 06_物业中心（062–071）

```text
062_日常巡逻.xlsx
063_客流预警.xlsx
064_安全事件.xlsx
065_活动安保.xlsx
066_日常清洁.xlsx
067_污染应急.xlsx
068_活动保障.xlsx
069_商户准入.xlsx
070_日常巡检.xlsx
071_退场.xlsx
```

### 4.7 07_演艺中心（072–084）

```text
072_节目上线.xlsx
073_场次执行.xlsx
074_临时缺员.xlsx
075_停演.xlsx
076_场次准备.xlsx
077_损坏报损.xlsx
078_盘点.xlsx
079_飞行任务.xlsx
080_任务取消.xlsx
081_飞行事故.xlsx
082_场次技术保障.xlsx
083_设备故障.xlsx
084_停演技术建议.xlsx
```

### 4.8 08_网络中心（085–094）

```text
085_网络故障.xlsx
086_网络变更.xlsx
087_活动保障.xlsx
088_IT服务请求.xlsx
089_生产发布.xlsx
090_账号执行.xlsx
091_恢复演练.xlsx
092_需求开发.xlsx
093_缺陷修复.xlsx
094_版本发布.xlsx
```

### 4.9 09_企划中心（095–100）

```text
095_宣传物料制作.xlsx
096_拍摄任务.xlsx
097_返工变更.xlsx
098_策划项目.xlsx
099_方案变更.xlsx
100_活动策划移交.xlsx
```

### 4.10 10_新媒体中心（101–111）

```text
101_产品上架.xlsx
102_OTA订单.xlsx
103_退款.xlsx
104_评价客诉.xlsx
105_短视频发布.xlsx
106_直播执行.xlsx
107_投放.xlsx
108_舆情.xlsx
109_品牌授权.xlsx
110_物料审核.xlsx
111_侵权处理.xlsx
```

### 4.11 11_运营中心（112–119）

```text
112_标准接待.xlsx
113_临时变更.xlsx
114_导游执行.xlsx
115_接待客诉.xlsx
116_线索转商机.xlsx
117_销售成交.xlsx
118_二次销售.xlsx
119_客户移交.xlsx
```

### 4.12 12_跨中心协同（120–126）

```text
120_全员生命周期闭环.xlsx
121_市场获客到交付回款闭环.xlsx
122_接待资源闭环.xlsx
123_演艺场次闭环.xlsx
124_采购资产财务闭环.xlsx
125_内容生产发布闭环.xlsx
126_事件与整改闭环.xlsx
```

## 5. `03 数据库需求规则/01_架构设计/`

```text
01_数据库总体架构.md
02_数据源分库分域.md
03_建模字段命名规则.md
04_字段逻辑与闭环规则.md
05_权限敏感与审计规则.md
06_索引分区备份规则.md
07_实施迁移验收方案.md
```

## 6. `03 数据库需求规则/02_数据字典/`

```text
01_数据源规划.csv
02_Schema分域.csv
03_全量表清单.csv
04_全量字段字典.csv
05_主外键关系.csv
06_索引设计.csv
07_流程落表映射.csv
上金谷数据库架构与全量数据字典.xlsx
数据库模型_machine_readable.json
```

## 7. `03 数据库需求规则/03_SQL_DDL/`

### 7.1 00_部署入口

```text
00_README.sql
01_create_databases.sql
```

### 7.2 01_sjg_oms

```text
01_extensions_and_schemas.sql
02_administration_tables.sql
03_archive_tables.sql
04_asset_tables.sql
05_attendance_tables.sql
06_audit_tables.sql
07_brand_tables.sql
08_catering_tables.sql
09_cleaning_tables.sql
10_collaboration_tables.sql
11_content_tables.sql
12_core_tables.sql
13_costume_tables.sql
14_crm_tables.sql
15_devops_tables.sql
16_document_tables.sql
17_dormitory_tables.sql
18_drone_tables.sql
19_ecommerce_tables.sql
20_education_tables.sql
21_entertainment_tables.sql
22_finance_tables.sql
23_fleet_tables.sql
24_hr_tables.sql
25_iam_tables.sql
26_integration_tables.sql
27_itops_tables.sql
28_learning_tables.sql
29_maintenance_tables.sql
30_marketing_tables.sql
31_mdm_tables.sql
32_media_tables.sql
33_merchant_tables.sql
34_notification_tables.sql
35_org_tables.sql
36_performance_tables.sql
37_planning_tables.sql
38_procurement_tables.sql
39_reception_tables.sql
40_reward_tables.sql
41_sales_tables.sql
42_security_tables.sql
43_ticketing_tables.sql
44_welfare_tables.sql
45_workflow_tables.sql
90_foreign_keys.sql
91_indexes.sql
92_triggers.sql
93_rls_policies.sql
94_views.sql
95_seed_process_catalog.sql
96_partition_templates.sql
```

### 7.3 02_sjg_audit

```text
01_extensions_and_schemas.sql
02_audit_tables.sql
90_immutability_and_grants.sql
```

### 7.4 03_sjg_dw

```text
01_extensions_and_schemas.sql
02_analytics_tables.sql
```

## 8. `03 数据库需求规则/04_初始化数据/`

```text
01_process_catalog.csv
02_state_catalog.csv
03_business_rule_catalog.csv
04_interface_catalog.csv
05_three_endpoint_linkage.csv
上金谷流程状态规则接口初始化数据.xlsx
```

## 9. `03 数据库需求规则/05_ER模型/`

```text
01_核心平台ER.mmd
administration_ER.mmd
archive_ER.mmd
asset_ER.mmd
attendance_ER.mmd
audit_ER.mmd
brand_ER.mmd
catering_ER.mmd
cleaning_ER.mmd
collaboration_ER.mmd
content_ER.mmd
costume_ER.mmd
crm_ER.mmd
devops_ER.mmd
document_ER.mmd
dormitory_ER.mmd
drone_ER.mmd
ecommerce_ER.mmd
education_ER.mmd
entertainment_ER.mmd
finance_ER.mmd
fleet_ER.mmd
hr_ER.mmd
iam_ER.mmd
integration_ER.mmd
itops_ER.mmd
learning_ER.mmd
maintenance_ER.mmd
marketing_ER.mmd
media_ER.mmd
merchant_ER.mmd
performance_ER.mmd
planning_ER.mmd
procurement_ER.mmd
reception_ER.mmd
reward_ER.mmd
sales_ER.mmd
security_ER.mmd
ticketing_ER.mmd
welfare_ER.mmd
```

## 10. `03 数据库需求规则/06_规则与验收/`

```text
01_数据库结构验收.sql
02_上线验收清单.md
03_自动校验报告.md
```

## 11. `03 数据库需求规则/07_源材料映射/`

```text
01_原始字段到目标数据库全量映射.csv
02_唯一字段规范化映射.csv
```

## 12. `03 数据库需求规则/` 根文件

```text
BUILD_INFO.json
README.md
SHA256SUMS.txt
```

## 13. 当前差异/警告

- `Knowledge Base/04 Agents开发规范/`：当前 GitHub 树不存在。根 `AGENT.md` V1.2 提到它应仅作为 canonical 指针；本阶段不自行创建缺失业务/规范内容。
- 根目录还有 `README.md`；PHASE-00 会将其更新为真实项目状态说明，但不把 README 提升为业务事实源。
- 本阶段只完成文件索引，不解析 378 个流程工作簿的表内字段；表内统计和基线差异重算留给对应后续阶段。
