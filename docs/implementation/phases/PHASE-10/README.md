# PHASE-10｜P006–P010 公共能力 B

> 状态：`COMPLETE / FULL_CONSTRUCTION_GATE_PASS`
> 仓库：`tonghe0922-glitch/PublicCompany`
> 分支：`agent/phase-10-public-capabilities-b`
> 目标分支：`main`
> 上一阶段：`PHASE-09 = COMPLETE`
> 本阶段范围：`P006–P010`
> Accepted implementation candidate：`43eda5911038be3837b66bfb487838f32dc6d3a8`
> Full Construction Gate：`31803920306 / run #147 / SUCCESS`
> 下一阶段：`PHASE-11 = NOT_STARTED / UNLOCKED_ONLY`

## 1. 阶段关闭结果

| Process | 中文流程 | Canonical 主事实 | 最终状态 |
|---|---|---|---|
| P006 | 会议与行动项 | `collaboration.meeting` + `meeting_item` | `CHECKPOINT_PASS / CLOSED` |
| P007 | 排班与班次调整 | `attendance.shift_change_request` + item | `CHECKPOINT_PASS / CLOSED` |
| P008 | 请假与考勤 | `attendance.leave_request` + item | `CHECKPOINT_PASS / CLOSED` |
| P009 | 加班与调休 | `attendance.overtime_request` + item | `CHECKPOINT_PASS / CLOSED` |
| P010 | 员工学习、考试与资格 | `learning.learning_assignment` + evidence | `CHECKPOINT_PASS / CLOSED` |

本阶段只关闭 P006–P010。P011+ 没有进入可执行代码范围；PHASE-11 仍未开工。

## 2. 已实现业务闭环

- **P006**：议题征集 → 材料检查 → 会议发布 → 签到/请假 → 会议召开 → 纪要确认 → 行动项执行 → 验收/返工 → 逾期升级 → 归档。
- **P007**：业务需求输入 → 班次模板匹配 → 资格/连续工时/冲突校验 → 排班发布 → 员工确认 → 换班/替班 → 审批 → 考勤联动 → 日结。
- **P008**：请假申请 → 额度预占 → 工作交接 → 审批 → 额度扣减/释放 → 考勤标记 → 实际休假 → 销假/返岗 → 差额调整 → 日结归档。
- **P009**：事前申请或紧急事实 → 必要性校验 → 审批 → 实际劳动事实 → 成果验收 → 人事复核 → 工资/调休方案 → 薪酬回执 → 归档。
- **P010**：内容版本发布 → 风险指派 → 学习 → 1000 分制考试 → 实操 → 独立专业认证 → 资格生效 → 岗位权限联动 → 复训检查 → 归档。

P010 保留职责分离：任务发布人不能自认证；真实 E2E 先验证自认证 403，再由同中心独立专业认证人完成认证。

## 3. 三端与页面实现

员工端、中心端和技术端读取同一 canonical 业务事实，不创建三份业务数据。P008–P010 原通用页面已退役，19 条语义不同的业务路由均绑定独立组件；申请、账本、变更、审批、人事复核、薪酬依据、学习、考试、实操、资格与权限联动不再复用一个业务页面。

技术端使用设计系统表格、状态标签和仪表页模板，只显示元数据、工作流节点和集成事实，不提供业务审批或专业认证动作。跨技术端路由复用同一监控组件时，数据源会随 route props 响应式重载，不再串用前一个流程的投影。

## 4. 服务端、权限和数据库

- 复用 Java 21 / Spring Boot / Spring MVC / Spring JDBC 模块化单体基线。
- 复用 IAM、Workflow、Form、Task、Audit、Outbox、Notification、Redis Session，不建设影子内核。
- Controller 继续执行动作权限和数据范围双重校验；员工端、中心端、技术端职责分离。
- 使用既有 canonical 主表和 additive Flyway overlays `V115–V121`，不修改历史 migration。
- P008 额度账本、P009 调休/薪酬事实、P010 学习证据与资格权限联动保留数据库约束、不可变事实和 fail-closed 校验。

## 5. C0 来源事实

```text
15/15 authoritative XLSX parsed
90 sheets
4,745 non-empty rows
0 parse failures
PHASE-01 direct process_codes page binding = 0 (historical fact)
Business HTTP source baseline = 0 (historical fact)
Explicit source-coordinate bindings = PHASE10_PAGE_BINDINGS.json
Engineering HTTP/permission contract = docs/implementation/contracts/phase-10
```

历史 XLSX 中缺少直接页面流程绑定和业务 HTTP 路径的事实继续保留，工程补充标识没有被冒充为原始来源。

## 6. 最终可执行证据

```text
Accepted implementation candidate = 43eda5911038be3837b66bfb487838f32dc6d3a8
Full Construction Gate = 31803920306 / run #147 / SUCCESS
Final verdict job = 94778697853 / SUCCESS
Real three-portal E2E job = 94778127040 / SUCCESS
Artifact = 9220411386
Artifact SHA256 = fca4b61a827493811d39efe29070f2ae7af5af8deba904a59119e54e47d49617
Playwright = 1 passed
Canonical facts = closed:5, workflows:5, leave-ledger:3,
                  learning-evidence:7, qualification-grant:1,
                  outbox:50, audit:156, credential-hits:0, redis-keys:29
```

同一 Full Gate 还通过了 source/route/API/permission/database contract、Java 全量单测、PHASE-04 API 安全回归、PostgreSQL PHASE-03/05/06/09/10 回归、Vue TypeScript、ESLint、Vitest、重复代码、死代码和三端生产构建。

## 7. 封板规则

`PHASE_REPORT.md`、`PHASE_GATE.md`、`GAP_MATRIX.md` 和 `MASTER_PROGRESS.md` 已按上述产品候选与运行证据同步。包含这些文档的收口提交仍必须在 GitHub Actions 上再次通过同一 Full Construction Gate，才能作为最终分支封板 SHA。

PHASE-10 完成后停止施工；不得自动进入 PHASE-11。
