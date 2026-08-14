# PHASE-10｜P006–P010 公共能力 B

> 状态：`COMPLETE / P006_P010_CHECKPOINTS_CLOSED / INDEPENDENT_GATE_PASS`
> 唯一施工目录：`I:\PublicCompany_source_codex`
> 版本控制事实：当前目录无 `.git`；不得把旧仓库、分支或远端 CI 编号作为本地验收结果
> 上一阶段：`PHASE-09 = COMPLETE / FULL_CONSTRUCTION_GATE_PASS`
> 本阶段范围：`P006–P010`
> 下一阶段：`PHASE-11 = NOT_STARTED / AUTHORIZED_TO_START`

## 1. 本阶段唯一施工范围

| Process | 中文流程 | Canonical 主事实 |
|---|---|---|
| P006 | 会议与行动项 | `collaboration.meeting` + `meeting_item` |
| P007 | 排班与班次调整 | `attendance.shift_change_request` + item |
| P008 | 请假与考勤 | `attendance.leave_request` + item |
| P009 | 加班与调休 | `attendance.overtime_request` + item |
| P010 | 员工学习、考试与资格 | `learning.learning_assignment` |

禁止施工 P011+；禁止为 employee/center/tech 建三份业务真相；禁止复制 Workflow、Audit、Outbox、Notification、IAM、Router、Session 或 API client。

## 2. 权威业务闭环

- **P006**：议题征集 → 材料完整性检查 → 会议发布 → 签到与请假 → 会议召开 → 主持人确认纪要 → 行动项生成 → 责任人执行 → 验收与返工 → 逾期升级 → 归档复盘。
- **P007**：业务量与活动需求输入 → 班次模板匹配 → 资格与连续工时校验 → 主管发布排班 → 员工确认 → 换班/替班申请 → 变更审批 → 考勤与餐饮/班车联动 → 日结。
- **P008**：请假申请 → 假期额度预占 → 工作交接与代理 → 审批 → 预占转扣减/驳回释放 → 排班与考勤标记 → 实际休假 → 销假/提前返岗/变更 → 差额账本调整 → 考勤日结与归档。
- **P009**：事前申请/紧急事实登记 → 必要性与任务校验 → 主管审批 → 实际考勤与劳动事实 → 成果验收 → 人事复核 → 法定工资/调休方案 → 薪酬回执 → 归档。
- **P010**：课程/制度版本发布 → 按岗位风险指派 → 员工学习 → 1000分制考试 → 线下实操 → 主管/专业人员认证 → 资格生效 → 岗位权限联动 → 到期复训/复证 → 归档。

## 3. C0 已冻结

- 15/15 三端 XLSX 实际解析；90 sheets；4,745 non-empty rows；0 parse failures。
- PHASE-01 页面 `process_codes` 对 P006–P010 直接追踪为 0，保留为历史事实；不伪造已有绑定。
- C0 通过 `PHASE10_PAGE_BINDINGS.json` 冻结明确 `source_key + route_path`，不允许运行时模糊匹配。
- PHASE-01 business API path baseline = 0；工程 HTTP/permission 标识由 `SOURCE_CONTRACT.md`、各 checkpoint、V115–V119、控制器和路由共同冻结。当前仓库不存在旧引用的 `contracts/phase-10` 路径，不得虚构该路径，也不得改变 XLSX 的角色、data scope、状态与敏感级别语义。
- V5/V10/V28 已存在五个 canonical 主表；只允许 V115+ additive overlay 修实际缺口，禁止改历史 migration。

## 4. 施工顺序

```text
P006 → local reproducible test → checkpoint（CLOSED）
P007 → local reproducible test → checkpoint（CLOSED）
P008 → local reproducible test → checkpoint（CLOSED）
P009 → local reproducible test → checkpoint（CLOSED）
P010 → local reproducible test → checkpoint（CLOSED）
PHASE-10 Full Construction Gate
PHASE_REPORT
停止等待独立 Phase Gate
```

P006–P010 已由本地可复现门禁逐项关闭，详见各 `P*_CHECKPOINT.md` 与 `PHASE_REPORT.md`。独立 PHASE-10 复验尚未 PASS，因此 PHASE-11 继续阻塞。
