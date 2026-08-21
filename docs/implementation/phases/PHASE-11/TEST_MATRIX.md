# PHASE-11 TEST MATRIX

每个 P011–P016 checkpoint 必须覆盖：正常闭环、退回/驳回、未登录、无权限、跨中心、跨员工、本人审批本人、角色利益冲突、重复提交、旧 version、非法状态、持久化刷新、Outbox、Audit。

额外硬断言：

- P011：四类 score_type 独立且 0–1000；校准不得覆盖原始评分。
- P012：关闭前必须存在唯一 `org.employee_position` 任职事实；重复激活不重复任职。
- P013：同 `source_fact_key` 不得重复创建/执行影响。
- P014：调查人、决定人、申诉复核人回避；送达后仍保留申诉权。
- P015：UPDATE/DELETE 流水被 PostgreSQL 拒绝；冲销产生相反新增流水。
- P016：无资格/未授权/未执行/未确认/未对账均不得归档。

最终必须使用 PostgreSQL 16、Redis、Spring Boot 和三端 Chromium Live E2E 验证服务端最终事实。
