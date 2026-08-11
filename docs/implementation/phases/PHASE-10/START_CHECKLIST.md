# PHASE-10 START CHECKLIST

> Status: `IN_PROGRESS`
> Scope: `P006–P010 公共能力 B`

- [x] 已读取根 `AGENT.md` 与 `DESIGN.md`。
- [x] 已实际解析 P006–P010 三端 XLSX（15/15 workbooks、90 sheets、4,745 non-empty rows、0 failures）。
- [x] 已读取 current Java/Vue/Flyway 与 PHASE-04/05/06/08/09 shared kernels。
- [x] 已建立/复核 `IMPACT_MATRIX.md` 与 `GAP_MATRIX.md`。
- [x] 已冻结 `SOURCE_CONTRACT.md`、`PHASE10_PAGE_BINDINGS.json` 与 HTTP/Permission engineering contract。
- [x] 已确认 V5/V10/V28 baseline 不修改；PHASE-10 additive migration 从 V115+ 开始。
- [x] 已确认施工分支 `agent/phase-10-public-capabilities-b`，通过 GitHub connector 执行等价的 fetch/read/commit/push/ref-SHA 验证；不使用 force update。
- [x] P006 已形成远端代码 checkpoint；继续以真实 CI/E2E 作为 CLOSED 门槛。
- [x] P007 已形成远端代码 checkpoint并完成 frozen HTTP/permission contract 对齐；继续以真实 CI/E2E 作为 CLOSED 门槛。
- [x] PHASE-10 active full construction gate 已建立；第一轮失败已定位并进入 remediation，不将失败冒充 PASS。
- [ ] P008 请假与考勤完整闭环。
- [ ] P009 加班与调休完整闭环。
- [ ] P010 员工学习、考试与资格完整闭环。
- [ ] P006–P010 unit/integration/negative/idempotency/concurrency/3-portal E2E 全量验证。
- [ ] 更新全部 MASTER 台账并生成 `PHASE_REPORT.md`。
- [ ] 最终 Gate、远端 SHA、Draft PR/CI 状态全部记录。

## Hard stop

- PHASE-11 必须保持 `NOT_STARTED`。
- 任一 P006–P010 未 CLOSED、关键测试未实际 PASS、CI 未绿或远端 SHA 不匹配，PHASE-10 均不得标记 COMPLETE。
