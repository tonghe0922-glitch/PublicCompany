# PHASE-10｜Formal Phase Gate

> Result: **PHASE GATE: FAIL**
> Repository: `tonghe0922-glitch/PublicCompany`
> Branch: `agent/phase-10-public-capabilities-b`
> Base: `main@cd4f5c05f259c043fbe3e1288d6addccff6110e9`
> Evaluated remote code SHA: `382c8e8ebece3b63019880aedbef25ca5fe540ee`
> Pull request: `#1`
> Independent rerun: `PHASE-10 Full Construction Gate / run 31622967620 / attempt 2 / FAILURE`
> Verification date: `2026-08-13`
> Next phase: `PHASE-11 = NOT_STARTED / FORBIDDEN_UNTIL_PHASE10_PASS`

## 1. Gate verdict

当前远端 HEAD 不能编译，当前提交的后端单元、API 集成、PostgreSQL/Flyway 集成和最终 verdict 均失败。除此之外，P007/P008/P009 的员工自办节点候选规则仍可能排除发起人，P008–P010 的 19 条业务路由仍复用同一个通用页面，仓库不存在 PHASE-10 Playwright Live E2E，`PHASE_REPORT.md` 缺失，阶段台账仍与代码脱节。

因此 PHASE-10 不满足正式关闭条件，禁止进入 PHASE-11。

## 2. Requirement / Expected / Actual / Evidence

| Requirement | Expected | Actual | Evidence | Result |
|---|---|---|---|---|
| Repository identity | `tonghe0922-glitch/PublicCompany` | 仓库身份正确 | PR #1；contract job `94322041244` | PASS |
| Construction branch and remote SHA | 分支已 push，远端 SHA 可追溯 | 分支为 `agent/phase-10-public-capabilities-b`；验收代码 SHA=`382c8e8e...` | PR #1 head | PASS |
| PHASE-11 isolation | 不施工 P011+ | 未发现 PHASE-11 业务实现进入本阶段 | contract job | PASS |
| Source / page / API / permission contract | 来源、页面绑定、HTTP、权限、DB 契约检查成功 | 当前静态 contract 检查成功 | job `94322041244` | PASS |
| Fake-completion static scan | 无 TODO/FIXME/ts-ignore/临时演示入口/凭据 | 当前 contract 静态扫描成功 | job `94322041244` | PASS |
| Vue TypeScript | `vue-tsc` 和 Node TS 通过 | 通过 | job `94322040941` | PASS |
| Frontend lint | ESLint 0 warning | 通过 | job `94322040941` | PASS |
| Frontend unit tests | Vitest 通过 | 通过 | job `94322040941` | PASS |
| Employee / Center / Tech builds | 三端正式构建通过 | 通过 | job `94322040941` | PASS |
| Java 21 compile | 全后端可编译 | `GuardedShiftChangeRepository` 未实现 `ShiftChangeService.Repository.hasAttendanceConflict(...)` | rerun job `94322040354` | **FAIL** |
| Backend unit and production-service tests | P006–P010 全部执行并通过 | 在 `platform-workflow` 编译阶段停止；显式 production-service gate 被跳过 | job `94322040354` | **FAIL** |
| API integration | Spring 全量上下文 + PostgreSQL 16 API 回归通过 | 同一 Java 编译错误阻断，API 集成未执行到业务断言 | job `94322040434` | **FAIL** |
| PostgreSQL / Flyway integration | PHASE-03/05/06/09/10 profiles 全部通过 | 同一 Java 编译错误阻断，当前 SHA 无有效数据库集成结论 | job `94322040315` | **FAIL** |
| Permission negative path | employee 调 center API、跨中心、访问他人业务、tech 审批均被拒绝 | 当前 HEAD 无法编译，不能形成当前提交的可执行证据 | backend/API/database jobs | **FAIL** |
| Idempotency / stale version / concurrency | 重复点击与旧 version 均有当前提交的可执行证据 | 当前 HEAD 无法编译，相关测试未完整执行 | backend job | **FAIL** |
| Normal complete business loop | 发起→审批→执行→验收→回写→归档可实际走通 | 当前 HEAD 无法启动；不能证明 P006–P010 完整闭环 | backend/API/database jobs | **FAIL** |
| P007 employee self-service workflow | 员工本人可完成确认和换班任务 | Service 允许本人创建 `SHIFT_CHANGE`，但 S05/S06 的 `targetEmployeeIds` actor rule 没有 `allowInitiator:true`；resolver 默认排除发起人 | `WorkflowCandidateResolver` + V116 | **FAIL** |
| P008 employee leave workflow | 员工本人可确认交接、开始休假、销假/返岗 | S03/S07/S08 的 `targetEmployeeIds` actor rule 没有 `allowInitiator:true`；员工为流程发起人时会被候选解析排除 | `WorkflowCandidateResolver` + V117 | **FAIL** |
| P009 actual labor fact | 员工本人可登记实际加班事实 | S04 的 `targetEmployeeIds` actor rule没有 `allowInitiator:true`；员工为流程发起人时会被候选解析排除 | `WorkflowCandidateResolver` + V118 | **FAIL** |
| Real P008–P010 business pages | IA 中不同页面具备各自字段、视图、动作和权限语义 | P008–P010 的 19 条 employee/center 路由全部复用 `Phase10OperationsPage.vue` | `portal-router.ts` | **FAIL** |
| PHASE-10 Live E2E | P006–P010 至少有正常、权限负向、幂等/并发的 Playwright Live 验证 | `web/e2e` 只有 PHASE-08/09；Full Gate 也未执行 `pnpm test:e2e` | `web/e2e` + `phase10-full-gate.yml` | **FAIL** |
| Three-portal canonical fact consistency | employee/center/tech 共享同一 business ID/no/workflow/status，并有运行验证 | 代码设计引用同一后端事实，但当前 HEAD 无法运行，且无 PHASE-10 Live E2E 证明 | API/Repository/Router review | **FAIL** |
| Audit / Outbox / Worker / Notification | 关键动作有当前提交的可执行审计与副作用证据 | 编译失败导致完整运行证据缺失；不能用静态调用替代闭环验证 | backend/API jobs | **FAIL** |
| Phase report | `PHASE_REPORT.md` 已创建且与事实一致 | 文件不存在 | GitHub contents lookup | **FAIL** |
| Master progress | 台账与代码、SHA、测试证据一致 | 仍写 P008 为 NEXT、P009/P010 NOT_STARTED，明显落后于当前代码 | `MASTER_PROGRESS.md` | **FAIL** |
| PHASE-10 README / GAP matrix | 当前实现与剩余缺口如实更新 | README 仍写 P008 为下一目标；GAP_MATRIX 仍写五流程后端与页面均 MISSING | README / GAP_MATRIX | **FAIL** |
| Seal control plane | Formal Gate 由独立验收产生；一次性写工作流退出活动控制面 | `phase10-seal-once.yml` 仍驻留，具有 `contents:write` 与 `actions:write`，并可自行生成 PASS 文档 | `.github/workflows/phase10-seal-once.yml` | **FAIL** |
| Current-head GitHub Actions | 当前提交全部 required jobs 绿色 | contract/web 绿色；backend/API/database/verdict 红色 | run `31622967620`, attempt 2 | **FAIL** |

## 3. Independent rerun evidence

对当前远端代码 SHA `382c8e8ebece3b63019880aedbef25ca5fe540ee` 重新执行失败作业，结果：

```text
Source, repository and workflow-control contract
job 94322041244 = SUCCESS

Vue TypeScript lint unit and three-build regression
job 94322040941 = SUCCESS

Java 21 P006-P010 executable service behavior
job 94322040354 = FAILURE

PHASE-04 API security regression
job 94322040434 = FAILURE

PostgreSQL 16 completed-phase and PHASE-10 constraints
job 94322040315 = FAILURE

PHASE-10 full gate verdict
job 94322107357 = FAILURE
```

确定性编译错误：

```text
GuardedShiftChangeRepository is not abstract and does not override
hasAttendanceConflict(UUID, UUID, Instant, Instant)
in ShiftChangeService.Repository
```

这不是偶发运行器问题；独立 rerun 在相同源码点再次失败。

## 4. Business path sampling

### 4.1 正常完整闭环

**FAIL**。当前 HEAD 在 Java 编译阶段停止，无法启动后端，也无法实际走通：

```text
发起 → 审批 → 执行 → 验收 → 回写 → 归档
```

### 4.2 权限负向

**FAIL / NOT EXECUTED ON CURRENT HEAD**。当前提交没有可执行的 API/数据库结果来证明：

- employee 不能调用 center 动作；
- 跨 center 被拒绝；
- 员工不能访问他人业务；
- tech monitor 不能直接审批、认证或联动岗位权限。

### 4.3 重复与并发

**FAIL / NOT EXECUTED ON CURRENT HEAD**。旧 version、重复 Idempotency-Key、重复 callback 和并发状态迁移未在当前 SHA 完整执行。

### 4.4 异步与补偿

**FAIL / NOT EXECUTED ON CURRENT HEAD**。Outbox、Worker、Notification、retry、DLQ/补偿无法在当前不可编译提交上形成闭环证据。

## 5. Additional structural blockers

### 5.1 Employee task candidate dead ends

`WorkflowCandidateResolver` 对 `CONTEXT_EMPLOYEE_IDS` 默认排除 initiator，只有 actor rule 明确设置：

```json
{"allowInitiator": true}
```

才允许发起人领取任务。

当前发布定义存在以下矛盾：

- P007 Service 已允许员工本人创建换班流程，但 S05/S06 员工节点没有 `allowInitiator:true`；
- P008 由员工本人发起，但 S03/S07/S08 员工节点没有 `allowInitiator:true`；
- P009 由员工本人发起，但 S04 实际劳动事实节点没有 `allowInitiator:true`。

因此，即使修复当前编译错误，这些流程仍可能在正式任务候选解析时 fail-closed，不能判定闭环完成。

### 5.2 Generic page reuse is not IA-complete implementation

P008、P009、P010 的 19 条员工端和中心端路由只改变 route name、process 和 mode，实际均指向同一个 `Phase10OperationsPage.vue`。它没有按 IA 将申请、额度账本、销假、审批、HR 复核、薪资依据、考试、实操认证、资格与权限联动拆成各自正式页面。

路由可达和按钮可点击不能替代页面级业务实现验收。

### 5.3 No PHASE-10 Live E2E

虽然 `package.json` 定义了 `pnpm test:e2e`，当前 Full Construction Gate 没有调用该命令；`web/e2e` 目录也不存在 `phase10-*` Playwright spec。当前绿色的前端 job 仅证明 typecheck、lint、Vitest 和静态构建成功。

## 6. Failed items

1. 当前 HEAD Java 编译失败。
2. Backend、API integration、PostgreSQL/Flyway integration 和 final verdict 失败。
3. P007/P008/P009 员工自办节点候选规则存在发起人被排除的死路。
4. P008–P010 19 条路由仍是通用页面复用，不符合 IA 逐页闭环要求。
5. PHASE-10 没有 Playwright Live E2E，也未进入 Full Gate。
6. 权限负向、幂等、并发、完整闭环和异步补偿没有当前 HEAD 的有效执行证据。
7. `PHASE_REPORT.md` 缺失。
8. MASTER_PROGRESS、README、GAP_MATRIX 与实际代码脱节。
9. 写权限的一次性 seal workflow 仍驻留活动控制面。
10. 当前提交 GitHub Actions 为 FAILURE。

## 7. Required repairs before re-gate

1. 统一 `ShiftChangeService.Repository` 与所有实现类接口，修复 `hasAttendanceConflict(...)` 编译错误。
2. 修复后重新执行全部 backend unit、PHASE-04 API integration、PHASE-03/05/06/09/10 PostgreSQL/Flyway profiles。
3. 为 P007 S05/S06、P008 S03/S07/S08、P009 S04 建立合法的后继 workflow version，明确 `allowInitiator:true`；不得直接篡改已发布版本或历史 migration。
4. 增加任务候选解析的真实数据库/工作流集成测试，证明员工本人可以领取这些自办任务，同时审批人仍禁止自批。
5. 按 `PHASE10_PAGE_BINDINGS.json` 和 IA 拆分 P008–P010 正式页面，至少保证页面字段、列表、详情、权限与动作语义独立。
6. 为 P006–P010 增加 Playwright Live E2E，覆盖正常闭环、employee→center 越权、跨中心、他人数据、tech 直接审批、重复点击、旧 version、重试与补偿。
7. 将 `pnpm test:e2e` 或等效 live gate 接入 PHASE-10 required CI。
8. 创建并如实更新 `PHASE_REPORT.md`、README、GAP_MATRIX、MASTER_PROGRESS；只在最终同一 SHA 全绿后标记 COMPLETE。
9. 移除或正式 retire `phase10-seal-once.yml` 及相关自写 PASS 脚本，Formal Gate 结果必须来自独立验收。
10. 对修复后的最终远端 HEAD 重新执行本 Phase Gate。

## 8. Final result

```text
PHASE GATE: FAIL

禁止进入下一阶段。

Repository: tonghe0922-glitch/PublicCompany
Branch: agent/phase-10-public-capabilities-b
Evaluated Commit: 382c8e8ebece3b63019880aedbef25ca5fe540ee
Remote SHA: 382c8e8ebece3b63019880aedbef25ca5fe540ee
Tests: CONTRACT/WEB PASS; BACKEND/API/POSTGRESQL/FLYWAY/E2E FAIL
CI: PHASE-10 Full Construction Gate run 31622967620 / attempt 2 / FAILURE
PHASE-11: NOT_STARTED
```
