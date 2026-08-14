# PHASE-10 IMPACT MATRIX

> C0 formal matrix. 本文件记录“必须影响的工程面”；实际 EXISTING/PARTIAL/MISSING 见 GAP_MATRIX。

| Process | Employee | Center | Tech | API / Permission | Domain / Repository | DB / Flyway | Workflow | Side effects / Audit | Tests |
|---|---|---|---|---|---|---|---|---|---|
| P006 | 会议详情、签到/请假、纪要确认、行动项执行 | 议题材料、发布、纪要、行动项、验收/返工/升级/归档 | workflow monitor；只读/配置支撑 | `P006/meetings`; create/read/manage/action/accept/monitor | MeetingService + JdbcMeetingRepository；行动项领域约束 | `collaboration.meeting/meeting_item`; V115+ only if real overlay gap | published P006 S01–S11 | action/overdue/accept/archive events；通知、审计 | unit + PG16/Redis + 3-portal E2E；返工/越权/幂等负向 |
| P007 | 我的排班、确认、换班/替班 | 排班发布、资格/连续工时校验、变更审批 | workflow monitor；集成保障 | schedule read + shift-change namespace; read/manage/change/review/monitor | ScheduleChangeService + server conflict validator + JDBC | `attendance.shift_change_request/item`; additive only | published P007 S01–S09 | schedule/change events；考勤/餐饮/班车联动按 source | overlap/qualification/stale/idempotency + real E2E |
| P008 | 请假、额度账本、销假/提前返岗/变更 | 审批、额度预占、变更、日结 | workflow + attendance integration monitor | leave namespace + quota ledger read; submit/read/review/manage/monitor | LeaveService + QuotaLedgerService + TimeConflictValidator | `attendance.leave_request/item`; append-only quota ledger overlay likely required; V115+ | published P008 S01–S10 | reserve/deduct/release/delta + schedule/attendance/outbox/audit | exact quota conservation, overlap, reject release, relogin persistence, 3-portal E2E |
| P009 | 加班/调休申请、成果验收、结果回执 | 主管审批、人事复核、工资/调休方案 | payroll/attendance integration monitor | overtime namespace; submit/read/review/hr/manage/monitor | OvertimeService + factual attendance/result/hr/payroll invariants | `attendance.overtime_request/item`; additive only | published P009 S01–S09 | attendance/result/payroll receipt events + audit | applicant self-approval deny, factual evidence required, overlap, 3-portal E2E |
| P010 | 学习任务、考试、实操、当前资格 | 版本发布/指派、实操、认证、资格、权限联动 | workflow/permission audit；无业务认证权 | `p010.learning.read/manage/complete/exam/certify/link/monitor` | `LearningAssignmentService` + approved-policy permission-link executor + JDBC | canonical `learning.learning_assignment`; V119 immutable event/policy/grant facts | published P010 S01–S10 + END | assignment/exam/practical/certification/expiry/permission-link events + audit | score 0–1000, assessor/certifier separation, tech no-certify, policy fail-closed, expiry, idempotency, real 3-portal E2E |

## Shared hard constraints

- Three portals share one business truth; no localStorage/mock business state.
- Backend AuthorizationService/data scope is security boundary; Vue guard only UX.
- Published Workflow/Form/Task/Audit/Outbox/Worker/Notification are reused, never forked.
- P2/P3 source sensitivity requires minimum projection/masking; export/Step-Up follows source rules.
- P011+ has zero implementation impact in PHASE-10.
