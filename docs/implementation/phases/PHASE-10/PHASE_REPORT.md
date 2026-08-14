# PHASE-10 PHASE_REPORT — P006–P010 公共能力 B

> Repository: `tonghe0922-glitch/PublicCompany`
> Branch: `agent/phase-10-public-capabilities-b`
> Phase state: `COMPLETE / FULL_CONSTRUCTION_GATE_PASS`
> Scope: `P006–P010`
> Construction Master Schedule core gate: `5流程三端闭环`
> Accepted implementation candidate: `43eda5911038be3837b66bfb487838f32dc6d3a8`
> Full Construction Gate: `31803920306 / run #147 / SUCCESS`
> Closeout parent: `43eda5911038be3837b66bfb487838f32dc6d3a8`
> PHASE-11: `NOT_STARTED / UNLOCKED_ONLY`

## 1. 阶段名称与边界

`PHASE-10｜P006–P010 公共能力 B`。本阶段只允许 P006–P010；P011–P016 属于 PHASE-11，P017+ 属于更后阶段，均不得提前施工。

根 `Construction Master Schedule.csv` 将本阶段核心门槛冻结为 **5 流程三端闭环**。完成口径不是“代码存在”“页面能打开”或“CI 能编译”，而是服务端权限、工作流、canonical PostgreSQL、员工端、中心端、技术端、真实浏览器、Redis、Outbox、Audit、隐私和阶段文档同时闭合。

## 2. 权威来源与 C0 冻结

本阶段实际解析 15/15 authoritative XLSX、90 sheets、4,745 non-empty rows，parse failures=0。

PHASE-01 对 P006–P010 的直接 `process_codes` 页面绑定和 business HTTP source 均为 0，这是必须保留的历史来源事实。本阶段没有伪造“原资料已有”，而是通过：

- `PHASE10_PAGE_BINDINGS.json` 冻结 `source_key + route_path`；
- `docs/implementation/contracts/phase-10` 冻结工程 HTTP/permission 标识；
- canonical schema、发布 Workflow/Form/Task 和可执行测试形成实现追溯。

## 3. P006 — 会议与行动项

状态：`CHECKPOINT_PASS / CLOSED`。

闭环包括议题征集、材料完整性、会议发布、签到/请假、会议召开、纪要确认、行动项生成、责任人执行、验收/返工、逾期升级和归档复盘。复用 `collaboration.meeting`、`meeting_item`、Workflow、Task、Form、Outbox、Audit 和 IAM；没有创建第二套会议状态机。

真实三端 E2E 将业务推进到 `END / 已关闭`，技术端只读取运行投影，不执行会议业务动作。

## 4. P007 — 排班与班次调整

状态：`CHECKPOINT_PASS / CLOSED`。

闭环包括业务需求、班次模板、资格/连续工时/考勤冲突校验、排班发布、员工确认、换班/替班、中心审批、考勤联动和日结。员工确认及变更节点允许合法 initiator 领取任务；审批候选和发起人仍保持职责分离。

本阶段修复 Repository 接口对齐和 `hasAttendanceConflict(...)` 可执行实现，并使用发布工作流新版本修复员工自办候选死路。

## 5. P008 — 请假与考勤

状态：`CHECKPOINT_PASS / CLOSED`。

闭环包括请假申请、额度预占、工作交接、审批、额度扣减/释放、考勤标记、实际休假、销假/返岗、差额账本调整和考勤日结归档。

关键硬化：

- 交接人引用统一转换为 canonical `varchar(32)` 合同；
- 员工自办节点明确允许合法 initiator；
- 实际返岗时间与流程关闭时间分离，避免 close 动作覆盖 return fact；
- `RESERVE / DEDUCT / RELEASE / ADJUST` 账本类型和金额 fail-closed；
- 返岗不得早于实际休假开始；
- 额度账本保持 append-only。

真实 E2E 最终产生 3 条额度账本事实并进入 `END / 已关闭`。

## 6. P009 — 加班与调休

状态：`CHECKPOINT_PASS / CLOSED`。

闭环包括事前申请或紧急事实登记、必要性与任务校验、主管审批、实际考勤/劳动事实、成果验收、人事复核、法定工资或调休方案、薪酬回执和归档。

实际劳动、成果验收、HR 复核和薪酬依据保持为独立事实；员工登记实际劳动节点允许合法 initiator，中心审批和复核仍按权限/data scope 分离。流程进入 `END / 已关闭`。

## 7. P010 — 学习、考试与资格

状态：`CHECKPOINT_PASS / CLOSED`。

闭环包括内容版本发布、按岗位风险指派、员工学习、1000 分制考试、线下实操、专业认证、资格生效、岗位权限联动、到期复训检查和归档。

关键硬化：

- 修复 assignment INSERT 连续分隔符、占位符和实际 PostgreSQL 执行问题；
- 对齐 `content_version` 数据库约束；
- 学习、考试、实操和认证证据以不可变事实落库；
- 新增同中心独立专业认证人；任务发布人自认证明确返回 403；
- 资格生效后写入 qualification 来源的 IAM role grant；
- 技术端只监控资格与权限联动元数据，不获得认证/授权业务动作。

真实 E2E 最终产生 7 条学习证据、1 条资格权限授权并进入 `END / 已关闭`。

## 8. API / Service / Repository / Flyway

P006–P010 的写操作均由服务端命令、乐观版本和发布工作流推进，前端不能直接提交最终状态。业务实现位于模块化单体既有边界内，复用 Spring MVC、Spring JDBC、IAM、Workflow、Audit、Outbox、Notification、Redis Session 和 Worker 基线。

数据库继续复用 V5/V10/V28 canonical 主表，PHASE-10 只使用 additive overlays `V115–V121` 补齐字段、约束、触发器和发布工作流版本；没有修改已发布历史 migration，也没有创建 `phase10`/`p006`–`p010` 影子业务表。

## 9. Permission / data scope / separation of duties

前端 route/nav 仅是 UX projection；最终授权由 Spring Security、IAM、动作权限、data scope、RLS 和工作流候选规则共同决定。

- Employee 只能操作本人和允许的自办节点；
- Center 按中心范围审批、复核、发布和联动；
- Tech 只读取 metadata-only 运行投影，不直接审批、认证或授予岗位权限；
- 跨中心、访问他人业务、非法候选、旧版本和非法动作均 fail-closed；
- P010 发布人不能自认证，独立专业认证人完成认证。

业务 `WorkflowException` 现由全局 handler 保留真实 400/403/404/409 语义，不再因错误转发被误报为 401。

## 10. 三端页面和设计系统

P006、P007 使用独立业务页面。P008–P010 原 `Phase10OperationsPage.vue` 通用页面已退役，19 条业务路由按 IA 语义一对一绑定：

```text
P008
P008LeaveRequestPage
P008LeaveQuotaLedgerPage
P008LeaveChangePage
P008LeaveReviewPage
P008QuotaManagementPage
P008LeaveChangeCenterPage

P009
P009OvertimeRequestPage
P009TimeOffRequestPage
P009ResultAcceptancePage
P009OvertimeManagementPage
P009HrReviewPage
P009PayrollBasisPage

P010
P010LearningTasksPage
P010OnlineExamPage
P010PracticalTaskPage
P010QualificationsPage
P010LearningManagementPage
P010PracticalCertificationPage
P010PermissionLinkagePage
```

业务页面使用既有设计系统组件和页面模板，不使用原生 button/input/select/textarea 绕过统一控件。技术端监控不再 `<pre>` 输出 raw JSON，而使用 `SgjDashboardPageTemplate`、`SgjTable` 和 `SgjStatusChip`。

同一技术监控组件跨 P008/P009/P010 路由复用时，组合函数现在监听 route props，先清空旧 rows 再请求新流程投影，解决 P010 页面显示上一流程数据的问题。

## 11. Frontend static quality and builds

Full Gate 强制执行：

```text
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm quality:duplicates
pnpm quality:deadcode
pnpm build
```

Vue TypeScript、ESLint、Vitest、jscpd、knip 和 employee/center/tech 三端生产构建全部成功。`phase10_frontend_contract.py` 同时检查独立路由组件、设计系统、无原生控件、无 raw JSON 和 audited source 120 列可读性。

## 12. Backend and database regression

Full Construction Gate 在 Java 21 下执行全量 API 依赖模块测试，并显式执行 Phase-10 service/candidate/hardening 测试。PostgreSQL 16 matrix 对 PHASE-03、PHASE-05、PHASE-06、PHASE-09 和 PHASE-10 全部回归成功；PHASE-04 API security profile 同样成功。

对应 jobs：

```text
Contract = 94778126921 / SUCCESS
Java service behavior = 94778126975 / SUCCESS
PHASE-04 API security = 94778126980 / SUCCESS
Web quality/builds = 94778127039 / SUCCESS
DB PHASE-03 = 94778127148 / SUCCESS
DB PHASE-05 = 94778127131 / SUCCESS
DB PHASE-06 = 94778127171 / SUCCESS
DB PHASE-09 = 94778127091 / SUCCESS
DB PHASE-10 = 94778127044 / SUCCESS
```

## 13. Real PostgreSQL16 + Redis + three-portal E2E

Gate 启动真实 Spring Boot API fixture、PostgreSQL 16、Redis 和 Chromium，不使用静态 mock 页面代替业务闭环。

```text
E2E job = 94778127040 / SUCCESS
Playwright = 1 passed
Artifact = 9220411386
Artifact SHA256 = fca4b61a827493811d39efe29070f2ae7af5af8deba904a59119e54e47d49617

closed = 5
completed workflows = 5
P008 quota ledger = 3
P010 evidence = 7
P010 qualification grant = 1
outbox = 50
audit = 156
credential hits = 0
redis keys = 29
```

测试同时覆盖三端路由可达、数据范围、跨中心隔离、幂等重放、工作流推进、技术端 projection、P010 自认证拒绝和最终 canonical facts。

## 14. Full Construction Gate

```text
Workflow = PHASE-10 Full Construction Gate
Accepted implementation candidate = 43eda5911038be3837b66bfb487838f32dc6d3a8
Run number = 147
Run ID = 31803920306
Run conclusion = SUCCESS
Final verdict job = 94778697853 / SUCCESS
```

所有 required jobs 均为 success，verdict 不能在任一 gate 失败或跳过时误报通过。

## 15. Defect repair chain

本阶段最终收口实际修复了以下缺陷，而不是调整断言制造绿灯：

- P006–P010 API 被通用 `/api/**` 安全规则错误拦截；
- P006 host/participant canonical 标识长度和 SELF 数据范围不一致；
- P007 Repository 接口与考勤冲突校验缺失；
- P007/P008/P009 员工自办节点发起人候选死路；
- P008 交接人 36 位 UUID 超出 canonical 字段；
- P008 关闭时间覆盖实际返岗时间；
- P010 assignment INSERT SQL 语法和占位符错误；
- P010 content version 数据库约束不匹配；
- P010 发布人缺少独立认证人且不得自认证；
- Workflow 业务异常被误映射为 401；
- 技术监控组件跨路由复用导致 P010 串用 P008/P009 数据；
- P008–P010 通用页、技术端 raw JSON、无 Live E2E、质量工具未进 CI；
- `PHASE_REPORT.md` 缺失以及 README/GAP/GATE/MASTER 台账严重滞后。

每次修复均通过真实失败日志定位，并由后续 Full Gate 重新执行验证。

## 16. Rollback

代码和文档使用普通 `git revert` 回退，禁止 force push 或 `reset --hard` 覆盖其他提交。已发布 Flyway migration 不回写；数据库修正只能新增向前 overlay。P010 资格授权回滚必须通过正式回收业务动作，不允许直接删除审计事实。

## 17. Definition of Done

```text
P006 = CHECKPOINT_PASS / CLOSED
P007 = CHECKPOINT_PASS / CLOSED
P008 = CHECKPOINT_PASS / CLOSED
P009 = CHECKPOINT_PASS / CLOSED
P010 = CHECKPOINT_PASS / CLOSED
5流程三端闭环 = PASS
server-side permission/data scope = PASS
canonical PostgreSQL/Flyway = PASS
published Workflow/Form/Task reuse = PASS
P008 append-only quota facts = PASS
P010 evidence/qualification/permission linkage = PASS
Audit/Outbox facts = PASS
Redis Session = PASS
idempotency/version/order/negative paths = PASS
privacy/credential hygiene = PASS
TypeScript/lint/unit/duplicates/deadcode/three builds = PASS
real browser + PostgreSQL16 + Redis = PASS
PHASE-10 Full Construction Gate = PASS
PHASE-11 = NOT_STARTED / UNLOCKED_ONLY
PHASE-10 = COMPLETE
```

本报告只封板 PHASE-10，不自动启动 PHASE-11。
