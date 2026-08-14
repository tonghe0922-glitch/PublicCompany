# MASTER_DATABASE_MAPPING

| Metric | Actual | Declared |
| --- | --- | --- |
| Database | 3 | 3 |
| Schema | 46 | 46 |
| Table | 265 | 265 |
| Database field rows | 7116 | n/a |
| Relations | 1335 | n/a |
| Indexes | 1024 | n/a |

## Process mapping

| Process | Name | Schema | Table |
| --- | --- | --- | --- |
| P001 | 统一登录与多岗位身份切换 | iam | iam.login_session |
| P002 | 权限申请、复核与回收 | iam | iam.permission_request |
| P003 | 个人资料变更 | hr | hr.employee_profile_change |
| P004 | 通用申请与审批 | workflow | workflow.generic_request |
| P005 | 制度、通知与执行回执 | collaboration | collaboration.notice |
| P006 | 会议与行动项 | collaboration | collaboration.meeting |
| P007 | 排班与班次调整 | attendance | attendance.shift_change_request |
| P008 | 请假与考勤 | attendance | attendance.leave_request |
| P009 | 加班与调休 | attendance | attendance.overtime_request |
| P010 | 员工学习、考试与资格 | learning | learning.learning_assignment |
| P011 | 绩效管理 | performance | performance.performance_cycle |
| P012 | 晋升与任职发展 | hr | hr.promotion_request |
| P013 | 奖励 | reward | reward.reward_case |
| P014 | 纪律、责任与申诉 | reward | reward.discipline_case |
| P015 | 成长积分与荣誉积分 | reward | reward.point_transaction |
| P016 | 员工福利与关怀 | welfare | welfare.care_case |
| P017 | 电子签署 | document | document.signature_envelope |
| P018 | 数据导入 | integration | integration.data_import_job |
| P019 | 敏感导出与文件下载 | audit | audit.data_export_request |
| P020 | 数据质量与修复 | audit | audit.data_quality_issue |
| P021 | 经营会议闭环 | collaboration | collaboration.meeting |
| P022 | 总裁指令闭环 | collaboration | collaboration.executive_directive |
| P023 | 重大事项升级 | collaboration | collaboration.major_matter |
| P024 | 预算闭环 | finance | finance.budget_request |
| P025 | 报销闭环 | finance | finance.expense_claim |
| P026 | 借款核销 | finance | finance.loan_request |
| P027 | 跨系统对账 | finance | finance.reconciliation_task |
| P028 | 录用入职闭环 | hr | hr.employee_onboarding |
| P029 | 调岗闭环 | hr | hr.employee_transfer |
| P030 | 离职闭环 | hr | hr.employee_offboarding |
| P031 | 归档接收 | archive | archive.archive_package |
| P032 | 借阅归还 | archive | archive.borrow_request |
| P033 | 销毁鉴定 | archive | archive.disposal_appraisal |
| P034 | 标准采购 | procurement | procurement.purchase_request |
| P035 | 紧急采购 | procurement | procurement.emergency_purchase |
| P036 | 退换货 | procurement | procurement.purchase_return |
| P037 | 售检票闭环 | ticketing | ticketing.ticket_order |
| P038 | 退款改签 | ticketing | ticketing.ticket_refund_change |
| P039 | 离线检票 | ticketing | ticketing.offline_check_event |
| P040 | 商机推进 | crm | crm.opportunity |
| P041 | 市场活动 | marketing | marketing.campaign |
| P042 | 渠道准入 | crm | crm.channel_partner |
| P043 | 课程产品上线 | education | education.course_product |
| P044 | 研学团队交付 | education | education.study_tour_delivery |
| P045 | 讲师排课 | education | education.teacher_schedule |
| P046 | 通知执行 | collaboration | collaboration.notice |
| P047 | 正式公文 | administration | administration.official_document |
| P048 | 会议行动 | collaboration | collaboration.meeting |
| P049 | 大型活动 | administration | administration.large_event |
| P050 | 入库 | asset | asset.stock_in |
| P051 | 领借调还 | asset | asset.asset_use_transaction |
| P052 | 盘点 | asset | asset.stocktake |
| P053 | 报废处置 | asset | asset.asset_disposal |
| P054 | 派车 | fleet | fleet.vehicle_dispatch |
| P055 | 车辆事故 | fleet | fleet.vehicle_incident |
| P056 | 宿舍入住退宿 | dormitory | dormitory.stay_record |
| P057 | 报修 | maintenance | maintenance.repair_order |
| P058 | 团餐交付 | catering | catering.group_meal_order |
| P059 | 食材验收 | catering | catering.ingredient_acceptance |
| P060 | 食品安全事件 | catering | catering.food_safety_incident |
| P061 | 餐卡结算 | catering | catering.meal_card_settlement |
| P062 | 日常巡逻 | security | security.patrol_task |
| P063 | 客流预警 | security | security.crowd_alert |
| P064 | 安全事件 | security | security.security_incident |
| P065 | 活动安保 | security | security.event_security_plan |
| P066 | 日常清洁 | cleaning | cleaning.cleaning_task |
| P067 | 污染应急 | cleaning | cleaning.pollution_incident |
| P068 | 活动保障 | cleaning | cleaning.event_support |
| P069 | 商户准入 | merchant | merchant.merchant_admission |
| P070 | 日常巡检 | merchant | merchant.merchant_inspection |
| P071 | 退场 | merchant | merchant.merchant_exit |
| P072 | 节目上线 | entertainment | entertainment.program |
| P073 | 场次执行 | entertainment | entertainment.show_session |
| P074 | 临时缺员 | entertainment | entertainment.staff_shortage |
| P075 | 停演 | entertainment | entertainment.suspension_decision |
| P076 | 场次准备 | costume | costume.session_preparation |
| P077 | 损坏报损 | costume | costume.damage_report |
| P078 | 盘点 | costume | costume.inventory_check |
| P079 | 飞行任务 | drone | drone.flight_task |
| P080 | 任务取消 | drone | drone.flight_cancellation |
| P081 | 飞行事故 | drone | drone.flight_incident |
| P082 | 场次技术保障 | entertainment | entertainment.tech_support_task |
| P083 | 设备故障 | entertainment | entertainment.equipment_fault |
| P084 | 停演技术建议 | entertainment | entertainment.suspension_advice |
| P085 | 网络故障 | itops | itops.network_incident |
| P086 | 网络变更 | itops | itops.network_change |
| P087 | 活动保障 | itops | itops.event_support |
| P088 | IT服务请求 | itops | itops.service_request |
| P089 | 生产发布 | devops | devops.release |
| P090 | 账号执行 | iam | iam.account_execution |
| P091 | 恢复演练 | itops | itops.recovery_drill |
| P092 | 需求开发 | devops | devops.requirement |
| P093 | 缺陷修复 | devops | devops.defect |
| P094 | 版本发布 | devops | devops.release |
| P095 | 宣传物料制作 | content | content.material_request |
| P096 | 拍摄任务 | content | content.shooting_task |
| P097 | 返工变更 | content | content.change_request |
| P098 | 策划项目 | planning | planning.project |
| P099 | 方案变更 | planning | planning.change_request |
| P100 | 活动策划移交 | planning | planning.event_handover |
| P101 | 产品上架 | ecommerce | ecommerce.product_listing |
| P102 | OTA订单 | ecommerce | ecommerce.ota_order |
| P103 | 退款 | ecommerce | ecommerce.refund_order |
| P104 | 评价客诉 | ecommerce | ecommerce.review_complaint |
| P105 | 短视频发布 | media | media.short_video_release |
| P106 | 直播执行 | media | media.live_session |
| P107 | 投放 | media | media.ad_campaign |
| P108 | 舆情 | media | media.public_opinion_case |
| P109 | 品牌授权 | brand | brand.authorization |
| P110 | 物料审核 | brand | brand.material_review |
| P111 | 侵权处理 | brand | brand.infringement_case |
| P112 | 标准接待 | reception | reception.reception_order |
| P113 | 临时变更 | reception | reception.change_request |
| P114 | 导游执行 | reception | reception.guide_execution |
| P115 | 接待客诉 | reception | reception.complaint |
| P116 | 线索转商机 | sales | sales.lead |
| P117 | 销售成交 | sales | sales.deal |
| P118 | 二次销售 | sales | sales.secondary_sale |
| P119 | 客户移交 | sales | sales.customer_handover |
| P120 | 全员生命周期闭环 | workflow | workflow.wf_orchestration_instance |
| P121 | 市场获客到交付回款闭环 | workflow | workflow.wf_orchestration_instance |
| P122 | 接待资源闭环 | workflow | workflow.wf_orchestration_instance |
| P123 | 演艺场次闭环 | workflow | workflow.wf_orchestration_instance |
| P124 | 采购资产财务闭环 | workflow | workflow.wf_orchestration_instance |
| P125 | 内容生产发布闭环 | workflow | workflow.wf_orchestration_instance |
| P126 | 事件与整改闭环 | workflow | workflow.wf_orchestration_instance |

## PHASE-02 runtime database foundation

- PostgreSQL 16 runtime wiring and Flyway dependencies are present in `api` and `worker`.
- Development Compose creates only the three core databases: `sjg_oms`, `sjg_audit`, `sjg_dw`.
- PHASE-02 creates **no business table and no business Flyway migration**; the existing P001–P126 authoritative mappings remain contracts for later phases.
- Redis, MinIO and RabbitMQ are development infrastructure only and do not replace PostgreSQL as the transaction source of truth.

## PHASE-03 formal Flyway and role baseline

- Formal databases: PostgreSQL 16 `sjg_oms / sjg_audit / sjg_dw`.
- Physical Schema count: **46**.
- Table catalog: **265**; current approved DDL unique CREATE TABLE: **265**; deterministic diff: catalog-only 0 / DDL-only 0.
- Index catalog: **1,024**; current approved DDL CREATE INDEX: **1,019**; the five catalog-only audit `tenant_id` indexes are implemented as a source-traceable Flyway overlay, yielding the formal 1,024-index baseline.
- Flyway generated source migrations live under `technical-platform/database/flyway/**`; technical overlays live under `technical-platform/database/flyway-overlays/**`; formal structural SQL elsewhere under `technical-platform` is rejected by CI.
- `manifest.json` records KB source path/source SHA-256/generated migration SHA-256 and the one explicit V95 psql compatibility transformation.
- Required tenant deployment facts: `sjg_tenant_id / sjg_tenant_code / sjg_tenant_name`; no production tenant default is stored in Git.
- Formal database owner: `sjg_owner`; formal migration role: `sjg_migration`; API/Worker runtime roles are separate and application Flyway is disabled.
- All base tables containing `tenant_id` are verified to have PostgreSQL RLS and at least one policy; runtime roles are NOBYPASSRLS.
- Audit runtime write contract is INSERT/SELECT only; UPDATE/DELETE/TRUNCATE are verified rejected.

## PHASE-08 Portal Runtime database status

- **No new database, Schema, table, index, business repository or Flyway migration** is introduced by PHASE-08.
- P001–P126 process/table mappings above remain unchanged and are not reclassified as implemented.
- Portal session/login/switch/logout uses the existing IAM/ORG PostgreSQL model and Redis session store created in earlier phases.
- C7 re-runs the real PostgreSQL16 + Redis7.4 IAM integration suite through job `93179694053 = PASS`.
- C7 additionally launches a real Spring Boot API against PostgreSQL16/Redis7.4 Testcontainers and routes three Vite portals through `/api` to that API. This is test fixture infrastructure only; it creates no production migration.
- The live fixture uses existing runtime identities (`sjg_api_runtime` and `sjg_audit_writer`) and existing Flyway migrations. Synthetic credentials are generated at runtime and are not committed.
- Real browser activity persists immutable audit evidence in `sjg_audit`: relevant login/refresh/switch/logout operation actions **22**; `SESSION_SWITCH` **1**; `AUTHORIZATION_DENIED` **1**; synthetic credential text found in audit rows **0**.
- Existing PostgreSQL RLS and backend permission/data-scope checks remain final authorization; the browser never becomes a source of database truth.

### PHASE-08 database conclusion

```text
Database structure change: NO_CHANGE
Flyway change: NO_CHANGE
P001-P126 mapping change: NO_CHANGE_REVALIDATED
PostgreSQL16 IAM regression: PASS
Redis7.4 session regression: PASS
Live browser -> Spring -> PostgreSQL/Redis -> Audit: PASS
Workflow: 31287803627
```

## PHASE-10 P006 runtime database closure

- Canonical business facts remain `collaboration.meeting` and `collaboration.meeting_item`; no parallel P006 truth table was introduced.
- Additive overlay `V115__phase10_p006_meeting_action.sql` installs the P006 business-number sequence, six IAM permissions, published form/workflow (S01–S11 + END, 18 transitions) and append-only evidence trigger.
- PostgreSQL 16 migration/validate/rerun and runtime-role behavior are verified by `Phase10P006DatabaseIT`; evidence updates/deletes fail with SQLSTATE `55000` and optimistic stale writes fail.
- Durable lifecycle events are stored in `core.outbox_event`; Worker notification effects are stored in `notification.template/message`, while operation audit stays in the separate audit database.
- Evidence: `phases/PHASE-10/P006_CHECKPOINT.md` and `.runlogs/phase10-p006-database-worker-it.log`.

## PHASE-10 P007 runtime database closure

- Canonical business facts remain `attendance.shift_change_request` and `attendance.shift_change_request_item`; qualification reads `learning.learning_assignment` and no parallel truth table was added.
- Additive `V116__phase10_p007_shift_change.sql` installs the P007 business sequence, five permissions, published form/workflow (S01–S09 + END, 15 transitions) and append-only item guard.
- PostgreSQL 16 migration/validate/rerun and runtime lifecycle prove server-calculated hours, qualification/overlap checks, immutable before/after/handover/integration facts and optimistic concurrency.
- Durable events are stored in `core.outbox_event`; sanitized rendered messages are stored in `notification.template/message`; operation audit remains in the separate audit database.
- Evidence: `phases/PHASE-10/P007_CHECKPOINT.md`, `.runlogs/phase10-p007-database-it.log`, and `.runlogs/phase10-p007-notification-database-it.log`.

## PHASE-11 P011-P016 runtime database closure

| Process | Canonical table | Additive overlay | Immutable/derived facts |
|---|---|---|---|
| P011 | `performance.performance_cycle` | `V120__phase11_p011_performance_cycle.sql` | score, cycle event and effect execution facts |
| P012 | `hr.promotion_request` | `V121__phase11_p012_promotion_appointment.sql` | request events and appointment execution facts |
| P013 | `reward.reward_case` | `V122__phase11_p013_reward_lifecycle.sql` | reward events and impact instruction/receipt facts |
| P014 | `reward.discipline_case` | `V123__phase11_p014_discipline_lifecycle.sql` | case events, decision and impact instruction/receipt facts |
| P015 | `reward.point_transaction` | `V124__phase11_p015_point_ledger.sql` | append-only transaction/event/posting/balance and versioned rule facts |
| P016 | `welfare.care_case` | `V125__phase11_p016_welfare_care.sql` | eligibility, privacy consent, approval, external receipt, employee confirmation and reconciliation facts |

No shadow process truth table is introduced. V120-V125 are additive overlays on canonical facts with tenant/RLS/linkage/append-only constraints, audit and Transactional Outbox/Worker notification. Full-gate PostgreSQL 16.14 empty-database migration to V125, validate/no-op and 12 specified DB/notification IT classes passed 35/35 tests. Evidence: `phases/PHASE-11/FULL_GATE_REPORT.md` and `.runlogs/phase11-full-db-worker-it-1.log`.
