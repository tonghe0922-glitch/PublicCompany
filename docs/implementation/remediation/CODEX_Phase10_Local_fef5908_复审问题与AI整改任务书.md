# CODEX_Phase10_Local 最新分支复审问题与 AI 整改任务书

> 本地唯一施工目录：`I:\PublicCompany_source_codex`  
> 本文可以直接交给 Codex 执行；Codex 必须按任务编号顺序施工，不能跳项、不能自写独立 PASS。

---

# 1. 给 Codex 的第一条指令

将本文放入：

```text
I:\PublicCompany_source_codex\docs\implementation\remediation\
```

然后给 Codex：

```text
请完整读取根目录 AGENT.md、DESIGN.md、README.md、
docs/implementation/MASTER_PROGRESS.md，
以及本整改任务书。

现在只执行 CXR-00：重新建立本地真实基线并修正阶段状态。
不得进入 CXR-01 及后续任务；不得启动 PHASE-12；不得实现 P017+。
完成后严格使用本文第 19 节格式报告。
```

Codex 必须遵守：

1. 每次只执行最前面的未 PASS 任务；
2. 先建立失败测试或可复现 finding，再改生产代码；
3. 不删除或弱化现有测试；
4. 不把 Gate finding 改成 warning；
5. 不扩大 ignore/exception 逃避检查；
6. 不修改已执行的 Flyway 历史文件；
7. 不原地修改 Published Workflow 历史版本；
8. 不自动 push，不 force push，不 reset/clean 用户工作区；
9. 未执行的命令必须写 `NOT_EXECUTED`；
10. Codex 只能写 `REGATE_CANDIDATE`，不能自称 `INDEPENDENT_GATE_PASS`。

---

# 2. 本次更新中已经取得的进步

Codex 不得重复推翻这些已完成的正确方向：

1. P011–P016 六个大页面已拆为：
   - 13/14 行 route shell；
   - 独立 Feature；
   - 独立 composable；
2. P011–P016 已改用公共 `@sgj/ui` 组件；
3. 新增六份 page component plan；
4. 新增 Phase 11 source snapshot、bindings、checkpoint、DB/notification IT；
5. 新增：
   - resource/action 分离状态；
   - AbortController；
   - request-id last-write-wins；
   - conflict/no-permission/error 投影；
6. 新增复杂度和 feature mount 测试；
7. 外部复验中前端实际通过：

```text
ESLint: PASS
Typecheck: PASS
Vitest: 68 files / 631 tests / PASS
Three portal build: PASS
Knip: exit 0（仍有 1 个 configuration hint）
jscpd: 1.80%
Largest portal JS: 约 2.145 MB
```

这些改动说明 Phase 11 前端结构明显比上一版本更好。本轮应在此基础上修复剩余正确性、证据和全仓门禁问题，不能重新写回巨型页面。

---

# 3. 复审结论

最新分支仍不能授权 PHASE-12，原因不是“功能完全不存在”，而是：

1. 当前 commit 的阶段结论和实际可复验结果不一致；
2. PHASE-10 已知 Workflow/DB 问题仍未整改；
3. P016 技术监控路由可进入但不渲染 P016 内容；
4. Phase 11 UI 动作仍由前端硬编码推断，不由服务端 task/candidate 决定；
5. 写操作人工重试可能生成新的幂等键；
6. fresh clone 的 Phase 10/11 source check 仍失败；
7. 当前更新本身的 changed-scope UI Gate 仍失败；
8. 本地 Quick/Full/Release Gate 尚未建立；
9. 文档中的测试数量、状态和证据存在明显漂移。

因此建议立即恢复为：

```text
PHASE-10 = REGATE_REQUIRED
PHASE-11 = CONSTRUCTION_COMPLETE / REGATE_REQUIRED
PHASE-12 = NOT_STARTED / BLOCKED
```

---

# 4. 本次复审的实际结果

## 4.1 复审基线

```text
Current commit: fef590876838d2c0222e2721c480d61929a385da
Previous commit: 0636270933bc74e23f8c9c66280b42b7dbe502f8
Delta: 72 files, +161531 / -2633
Whole branch vs main: 434 files, +197066 / -302
GitHub check runs on fef5908: 0
```

GitHub check runs 为 0 在“本地优先模式”下本身不是失败，但仓库中必须存在本地等价 Gate；当前只有：

```text
scripts/local/phase10-component-baseline.ps1
scripts/local/phase10-component-preflight.ps1
```

尚无完整 Quick/Full/Release Gate。

## 4.2 Fresh-clone 合同

以下均失败：

```text
python scripts/implementation/phase10_preparation_extract.py --check
python scripts/implementation/phase10_contract.py
python scripts/implementation/phase11_preparation_extract.py --check
```

共同错误：

```text
FileNotFoundError:
docs/implementation/contracts/phase-01/api_records.jsonl
```

因此 Phase 10/11 source snapshot 当前不能在干净源码中确定性复验。

## 4.3 UI Gate

```text
phase10 scope: PASS / 0
all scope: FAIL / 86
  RAW_INTERACTIVE_ELEMENT = 80
  LEGACY_COMPONENT_IMPORT = 6

fef5908 changed scope: FAIL / 1
  IMPORT_GRAMMAR_UNSUPPORTED = 1
  path = technical-platform/web/src/platform/phase11/process-complexity.test.ts
```

全仓 86 项集中在：

```text
LEGACY_COMPONENT_IMPORT:
  AuthenticatedPortalLayout.vue
  PortalRuntimeRoot.vue
  PortalSessionHeader.vue
  ForbiddenPage.vue
  LoginPage.vue
  NotFoundPage.vue

RAW_INTERACTIVE_ELEMENT:
  P001IdentityPage.vue = 11
  P002PermissionRequestPage.vue = 20
  P003ProfileChangePage.vue = 13
  P004GenericRequestPage.vue = 15
  P005NoticePage.vue = 21
```

## 4.4 Phase 10 Component Source Gate

```text
FAIL / 14
PAGE_NESTING = 9
BARE_PERMISSION = 5
```

具体：

```text
Phase10AttendanceMonitorPage.vue:
  PAGE_NESTING 2
  BARE_PERMISSION 2

Phase10TechMonitorPage.vue:
  PAGE_NESTING 7
  BARE_PERMISSION 3
```

## 4.5 前端测试和文档数字不一致

当前 fresh checkout 实际：

```text
68 files / 631 tests
```

文档声称：

```text
70 files / 636 tests
```

另有旧快照：

```text
36 files / 198 tests
```

当前 `PHASE_GATE.md`、`GAP_MATRIX.md`、`IMPACT_MATRIX.md` 与实际 checkout 不一致，必须重新生成当前本地证据，不能继续复制旧数字。

## 4.6 前端重复率和包体

```text
jscpd: 1.80% / 30 clones
employee/center/admin JS: 约 2.145 MB
Knip hint: src/showcase/main.ts entry pattern no matches
```


## 4.7 Java 可读性未整改

生产 Java：

```text
>120 chars: 1906 lines
>200 chars: 798 lines
>400 chars: 354 lines
max: 3322 chars
```

测试 Java：

```text
>200 chars: 644 lines
>400 chars: 335 lines
max: 3138 chars
```

大量 Controller、Service、Repository 和 Phase11 IT 仍压缩为超长单行。

## 4.8 后端复验限制

本次外部沙箱运行 Maven 时遇到 Maven Central TLS `handshake_failure`，缺失依赖无法下载，因此未把后端编译失败归类为代码失败。

Codex 在用户本地必须执行完整 Maven/PG16/Redis Gate；在本地执行成功前，文档中的 DB 35/API 6 不能直接当作当前 commit 的复验结论。

---

# 5. 关键新问题

## 5.1 P0：P016 技术监控路由是空壳

路由 `/tech/05/03/01` 允许：

```text
p016.welfare.monitor
```

但 `Phase10TechMonitorPage.vue` 只渲染：

```text
P006
P007
P010
P011
P012
P013
P014
```

没有：

```text
P016CareSupportPage / P016CareSupportFeature
```

现有测试甚至明确断言 P016 不存在：

```text
monitor-page.test.ts
P016 stub should be absent
```

P016 Playwright 只断言共享 monitor shell 可见，没有断言 P016 的 businessNo/node/status 在技术端页面中出现。

影响：

- 仅有 `p016.welfare.monitor` 的技术用户可以进入路由；
- 页面不展示 P016 投影；
- 路由测试 PASS，但实际业务功能不可用。

## 5.2 P1：P014/P016 共享中心页面架构反向依赖

当前：

```text
P016CareSupportFeature.vue
  → import P014DisciplinePage.vue
```

Feature 不应嵌入另一个流程的 route page。`/center/06/03/09` 同时绑定 P014/P016，当前路由名却是：

```text
p014-discipline-supervision
```

组件却是：

```text
P016CareSupportPage(sharedSupervision=true)
```

应建立明确的共享 supervision composite page/feature，而不是 P016 feature 反向引用 P014 route page。

## 5.3 P1：Phase 11 动作由前端硬编码推断

P011–P016 composable 都维护：

```ts
const ACTIONS: Record<string, Action[]> = { ... }
```

按钮显示主要根据：

```text
currentNodeCode + session permission + 部分 self 判断
```

没有使用服务端真实：

```text
workflow task
candidate
assignee
allowed action
回避结果
```

例如 P011 S05 同时硬编码显示：

```text
SUBMIT_SELF_EVALUATION
SUBMIT_SUPERVISOR_EVALUATION
```

如果同一个会话拥有 evaluate 权限，前端可能显示两个按钮；服务端虽会拒绝不合法动作，但 UI 仍错误表达下一步。

服务端拒绝是安全底线，但前端不能把“可能 403”当作正式动作模型。

## 5.4 P1：人工重试使用新幂等键

当前 `process-client.ts`：

```ts
idempotencyKey(scope) {
  return `${scope}-${crypto.randomUUID()}`
}
```

每次调用 create/action 都生成新 key。

ApiClient 在同一次自动 retry 内会复用 key，这是正确的；但如果：

```text
服务端已成功提交
→ 响应在网络中丢失/超时
→ 用户再次点击同一动作
```

第二次点击会生成新 key，服务端可能把它当成新命令。

必须让同一个“逻辑命令”的人工重试复用同一个 idempotency key，直到得到确定成功/确定业务失败或用户显式放弃。

## 5.5 P1：不同动作可同时提交同一记录

当前 action registry key 包含 action code：

```text
P011:action:<recordId>:<actionCode>
```

这只能抑制“同一 action”重复点击，却允许用户几乎同时点击同一记录上的两个不同 action。

虽然 optimistic version 通常使第二个失败，但仍会产生：

- 两个 HTTP 写请求；
- 不必要审计尝试；
- 用户看到冲突；
- 外部副作用流程的风险。

同一 record 的业务动作应共享 record-level in-flight lock；状态展示可按 action 分开，但写入必须互斥。

## 5.6 P0：PHASE-10 已知修复仍未进入

当前 V116/V117/V118 仍存在：

```text
P007 S05/S06 targetEmployeeIds 无 allowInitiator
P008 S07 使用 managerCandidateIds
P009 S04 使用 managerCandidateIds
```

对照分支已有 successor workflow 和数据库测试，但 CODEX 尚无等价增量迁移。

同时缺少：

- P008/P009 ledger conversion hardening；
- P008 return/actual chronology constraints；
- P009 time-off ledger type constraint；
- latest published workflow self-service assertion。

## 5.7 P0：阶段文档过早授权 PHASE-12

最新同一 commit 同时包含：

```text
Phase 11 implementation changes
PHASE_GATE.md independent PASS
MASTER_PROGRESS authorized Phase12
```

但当前仍有：

- Phase 10 source Gate 14；
- UI all 86；
- changed scope 1；
- fresh contract FAIL；
- P016 tech monitor 空壳；
- Phase 10 self-service/DB hardening未修；
- 文档测试数字漂移。

因此当前源码不应继续标记 `AUTHORIZED_TO_START`。

---

# 6. 整改任务总表

| ID | Priority | 任务 | 前置 |
|---|---|---|---|
| CXR-00 | P0 | 重新建立本地基线并阻塞 PHASE-12 | 无 |
| CXR-01 | P0 | 建立本地 Quick/Full/Release Gate | CXR-00 |
| CXR-02 | P0 | 修复 Phase 10/11 source contract 与 snapshot 可复现性 | CXR-01 |
| CXR-03 | P0 | 补回 Phase 10 自服务 Workflow successor | CXR-02 |
| CXR-04 | P0 | 补回 Phase 10 ledger/chronology/conflict hardening | CXR-03 |
| CXR-05 | P0 | 修复 P016 tech monitor 与 P014/P016 shared supervision | CXR-04 |
| CXR-06 | P1 | 改为服务端驱动 allowed actions/task candidate | CXR-05 |
| CXR-07 | P1 | 修复幂等人工重试与 record-level action lock | CXR-06 |
| CXR-08 | P1 | 清零 UI changed/all 和 Phase 10 source Gate | CXR-07 |
| CXR-09 | P1 | Java 可读性、静态分析和覆盖率 | CXR-08 |
| CXR-10 | P1 | 前端路由拆分、导航、包体和重复率 | CXR-09 |
| CXR-11 | P0 | 本地 P001–P016 全量回归和证据 | CXR-10 |
| CXR-12 | P0 | 文档对账、独立复验候选和最终 Release Gate | CXR-11 |

---

# 7. CXR-00：本地基线和状态纠正

## 7.1 只允许修改

```text
docs/implementation/remediation/**
docs/implementation/MASTER_PROGRESS.md
README.md
docs/implementation/phases/PHASE-11/START_CHECKLIST.md
```

不得先改生产代码。

## 7.2 必须执行

在：

```powershell
Set-Location I:\PublicCompany_source_codex
```

执行：

```powershell
Test-Path .git
git rev-parse HEAD
git status --short
git diff --check
java -version
.\mvnw.cmd -version
node --version
pnpm --version
python --version
docker version
docker info
```

重新执行前端、合同和 Gate，保存本地真实数字。

## 7.3 状态纠正

在所有整改和本地 Release Gate 完成前，写为：

```text
PHASE-10 = REGATE_REQUIRED
PHASE-11 = CONSTRUCTION_COMPLETE / REGATE_REQUIRED
PHASE-12 = NOT_STARTED / BLOCKED
```

`PHASE_GATE.md` 不删除，但必须明确当前 commit 需重新绑定本地 Gate 证据；Codex 不得再次写 `INDEPENDENT_GATE_PASS`。

## 7.4 状态文件

新增：

```text
docs/implementation/remediation/CODEX_FEF5908_REMEDIATION_STATE.json
docs/implementation/remediation/CODEX_FEF5908_REMEDIATION_PROGRESS.md
```

每个任务只允许：

```text
NOT_STARTED / IN_PROGRESS / FAIL / BLOCKED / PASS
```

---

# 8. CXR-01：本地 Gate 控制面

## 8.1 必须新增

```text
scripts/local/gate-common.ps1
scripts/local/quick-gate.ps1
scripts/local/full-gate.ps1
scripts/local/release-gate.ps1
scripts/local/cleanup-gate.ps1
scripts/local/e2e/run-phase10-live.ps1
scripts/local/e2e/run-phase11-live.ps1
scripts/local/tests/gate-orchestrator-test.ps1
local-gate.config.json
docs/implementation/remediation/LOCAL_GATE_RUNBOOK.md
```

## 8.2 必须能力

- `Set-StrictMode -Version Latest`；
- `$ErrorActionPreference='Stop'`；
- 每个 step 独立日志、exit code、时间；
- mandatory step 不能 skip；
- skipped mandatory → final FAIL；
- 主步骤失败仍执行 cleanup；
- 日志脱敏；
- Gate 互斥 lock；
- 证据 SHA-256；
- 不自动 commit/push；
- 不自动写 Independent PASS。

## 8.3 依赖准备

本地首次运行增加显式 bootstrap：

```powershell
.\mvnw.cmd -B -ntp dependency:go-offline
Set-Location technical-platform\web
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
```

依赖下载失败必须分类为 `ENVIRONMENT_BLOCKED`，不能写代码 FAIL，也不能写 Gate PASS。

## 8.4 证据目录

```text
I:\PublicCompany_gate_evidence\<commit>\<run-id>\
```

至少保存：

```text
metadata.json
commands/*.log
surefire/failsafe XML
frontend reports
UI/source JSON
Playwright trace
cleanup report
checksums.sha256
VERDICT.md
```

---

# 9. CXR-02：Phase 10/11 Contract 可复现

## 9.1 修复目标

在 fresh local clone 中以下必须返回 0：

```powershell
python scripts/implementation/phase10_preparation_extract.py --check
python scripts/implementation/phase10_contract.py --mode sealed-regression
python scripts/implementation/phase11_preparation_extract.py --check
python scripts/implementation/phase11_contract.py
```

当前没有 `phase11_contract.py`，需要创建确定性只读合同检查。

## 9.2 最小 machine contract

确认并跟踪/生成：

```text
docs/implementation/contracts/phase-01/api_records.jsonl
docs/implementation/contracts/phase-01/pages.json
Phase 10 source snapshot JSON/MD
Phase 11 source snapshot JSON/MD
Phase 10/11 page bindings
```

不得用手写空 JSON 冒充 parser 输出。

## 9.3 Phase 11 contract 必查

- 18 workbook；
- 108 sheets；
- 5655 rows；
- 0 parse failure；
- P011–P016；
- 31 explicit bindings；
- route path、portal、source key 一致；
- P017+ 未实现；
- current snapshot SHA 可从源码重新计算；
- `--check` 不修改工作树。

## 9.4 Snapshot 体积

当前 Phase 11 JSON：

```text
约 5.3 MB / 155627 lines
```

可保留，但必须：

- 标明 generated；
- 有稳定生成器；
- 有 compact summary；
- 不允许人工编辑；
- Gate 用内容 hash 证明确定性。

如果将完整 JSON 移到仓库外证据目录，仓库中必须保留足够的 compact manifest 和来源 hash，不能失去可复验性。

## 9.5 阶段模式

`phase10_contract.py` 增加：

```text
construction
sealed-regression
```

sealed-regression 允许 Phase 11 存在，但必须验证 Phase 10 没有回退。

---

# 10. CXR-03：Phase 10 自服务 Workflow successor

## 10.1 不修改旧迁移

禁止修改：

```text
V116
V117
V118
```

当前最高 V125，建议新增：

```text
V125_1__phase10_self_service_workflow_hardening.sql
```

如本地已有同版本，选择下一个未占用增量版本，不覆盖。

## 10.2 必须修复

| Process | Node | 目标 |
|---|---|---|
| P007 | S05/S06 | 员工本人可成为 candidate；allowInitiator=true |
| P008 | S03/S07/S08 | 员工本人可执行；S07 不得继续只指向 manager |
| P009 | S04 | 员工本人可登记实际劳动事实 |

审批、评审、HR、验收节点继续禁止 self approval。

## 10.3 算法

- 从最新 Published version 复制；
- 新建 DRAFT；
- 只修改目标 node actor_rule；
- 复制 transition；
- 写 supersedesVersionId/checksum；
- 发布新版本；
- 重复迁移幂等；
- 旧 Published version 不变。

## 10.4 测试

新增 latest published version PostgreSQL IT：

```text
P007 target nodes = 2
P008 target nodes = 3
P009 target nodes = 1
```

并使用真实 task assignment/candidate claim 验证本人可领取、审批人仍分离。

---

# 11. CXR-04：Phase 10 Ledger/Chronology/Conflict

建议新增：

```text
V125_2__phase10_temporal_ledger_hardening.sql
```

必须补齐：

1. P008 `QUOTA_LEDGER` 普通行不可转换；
2. P008 ledger 不可 UPDATE/DELETE；
3. reserve/deduct/release >0，adjust !=0；
4. 余额守恒且不为负；
5. P009 `TIME_OFF_LEDGER` 普通行不可转换；
6. P009 ledger append-only、合法类型、正值；
7. `actual_end_at >= actual_start_at`；
8. `returned_at >= leave_started_at`；
9. 排班/请假/加班跨 canonical 表冲突；
10. tenant、当前记录排除和边界相接语义正确。

必须添加真实 PostgreSQL 并发、约束、RLS、Flyway empty→latest/validate/no-op 测试。

---

# 12. CXR-05：修复 P016 Monitor 和共享监督页

## 12.1 先写失败测试

新增/修改测试，使当前代码先失败：

1. 技术用户只有 `p016.welfare.monitor`：
   - 可进入 `/tech/05/03/01`；
   - 页面出现 P016 monitor section；
   - 显示 businessNo/currentNode/status；
   - 不显示员工、金额、票据、证据；
2. 只有 P014 monitor：只显示 P014；
3. P014 + P016 monitor：两个 section 都显示；
4. `p016.welfare.execute` 但无 monitor：route forbidden；
5. 导航对 P016 monitor 用户可见。

删除错误断言：

```text
P016 should be absent from shared monitor
```

## 12.2 重构路由模块

把：

```text
technical-platform/web/src/router/phase10-routes.ts
```

中的 `phase11P011Routes`～`phase11P016Routes` 拆到：

```text
technical-platform/web/src/router/phase11-routes.ts
```

`createCoreRoutes` 分别组合 Phase 10/11。

## 12.3 技术监控 Hub

不要继续在 route page 中嵌套七个 route page。

推荐：

```text
PhaseWorkflowMonitorPage.vue      // thin route shell
PhaseWorkflowMonitorFeature.vue   // 组合各流程 metadata feature
```

Hub 直接组合 feature/monitor projection，不 import `*Page.vue`。

必须加入 P016；P015 保留 dedicated monitor 时，要在合同中明确，不得遗漏。

## 12.4 中心共享监督页

建立：

```text
Phase11DisciplineCareSupervisionPage.vue
Phase11DisciplineCareSupervisionFeature.vue
```

用于 `/center/06/03/09`。

禁止：

```text
P016 Feature → P014 Route Page
```

共享 feature 可组合：

```text
P014DisciplineFeature
P016CareSupportFeature
```

但必须分别按权限和服务端 data scope 加载。

## 12.5 Binding

`PHASE11_PAGE_BINDINGS.json` 对共享来源行必须显式表达多 process 绑定。不得让同一 source key 的两条记录看起来像两个独立页面却实际只有一个混合组件。

## 12.6 E2E

P016 Playwright 必须从“只看 monitor shell”升级为“看到真实 P016 metadata record，并验证敏感字段不存在”。

---

# 13. CXR-06：服务端驱动 Allowed Actions

## 13.1 目标

前端不再自行决定业务动作，只负责显示服务端允许动作。

## 13.2 推荐合同

API record DTO 增加只读投影：

```json
{
  "availableActions": [
    {
      "code": "...",
      "labelCode": "...",
      "taskId": "...",
      "expectedVersion": 7
    }
  ]
}
```

availableActions 必须由服务端根据：

```text
current workflow node
current task
candidate/assignee
permission
data scope
self-review separation
业务 guard
```

计算。

如果不修改 DTO，可新增只读 endpoint，但必须更新 SOURCE/HTTP contract。禁止从前端猜 task candidate。

## 13.3 前端保留内容

前端可以保留：

```text
action code → 中文 label/icon/form section
```

但动作 code 集合必须来自服务端，不来自 `currentNodeCode + ACTIONS map`。

## 13.4 必测场景

- P011 S05 owner 只看到 SELF evaluation；
- supervisor 只看到 SUPERVISOR evaluation；
- calibrator 与 supervisor 分离；
- P012 S08 appointment actor 与 employee confirmation 分离；
- P014 self statement/appeal 与 investigator/decider 分离；
- P015 affected employee 与 reviewer/adjuster 分离；
- P016 privacy/receipt self actions 与 approve/execute/reconcile 分离；
- tech availableActions=[]。

服务端拒绝仍保留，前端隐藏不能替代后端安全。

---

# 14. CXR-07：幂等人工重试和写互斥

## 14.1 Idempotency Key 所有权

修改 `process-client.ts`：

- 不在最底层每次调用时无条件 random；
- 由 logical operation 创建并持有 key；
- 自动 retry 和人工 retry 复用同一个 key；
- 确定成功后清除；
- 确定 4xx validation/permission 后可结束；
- transport timeout/unknown outcome 保留 key；
- 用户显式新建另一条业务才生成新 key。

建议 operation state 保存：

```ts
interface CommandAttempt {
  operationKey: string
  idempotencyKey: string
  payloadHash: string
  outcome: 'pending' | 'unknown' | 'confirmed' | 'rejected'
}
```

payload 改变时不得复用旧 key；同 key 不同 payload 必须被服务端拒绝。

## 14.2 Record-level Lock

同一 record 的所有 business action 使用锁：

```text
<process>:record:<recordId>
```

UI 仍可按 action 显示状态，但任一写动作 pending 时，同一 record 其他 action disabled。

不同 record 可并行。

## 14.3 必须新增测试

1. 第一次请求服务端成功但客户端模拟 transport failure；
2. 用户重试；
3. 两次请求 Idempotency-Key 相同；
4. 服务端只有一个事实/Outbox/audit success；
5. 同 record APPROVE 与 REJECT 同时点击，只发一个请求；
6. 不同 record 可同时执行；
7. payload 变化生成新 logical command 或被 conflict 拒绝；
8. route dispose 会 abort，但 unknown command key 不丢失。

---

# 15. CXR-08：清零 UI 和 Source Gate

## 15.1 当前 commit changed finding

`process-complexity.test.ts` 导致：

```text
IMPORT_GRAMMAR_UNSUPPORTED / unbalanced JavaScript delimiter
```

处理方式：

- 先创建最小复现 fixture；
- 判断是测试源码写法超出批准 grammar，还是 Gate parser 缺陷；
- 若改 Gate，必须增加正负 fixture；
- 不得把该测试文件加入 ignore。

## 15.2 全仓 UI 86

按实时 JSON 修复：

- 6 个 legacy imports 改为 `@sgj/ui`；
- P001–P005 80 个 raw elements 替换为注册组件；
- page plan/registry/public index/tests 同步；
- 临时 exception 必须有 owner/expiry/test，不允许永久大范围例外。

## 15.3 Source Gate 14

通过 CXR-05 的 monitor hub/composite 重构清除：

```text
PAGE_NESTING
BARE_PERMISSION
```

页面权限组合使用批准的 `PermissionGate`/route meta；最终安全仍由 API 403。

## 15.4 PASS

```text
UI self-test = PASS
UI phase10 = 0
UI changed = 0
UI all = 0
Phase10 source self = PASS
Phase10 source current = 0
```

---

# 16. CXR-09：Java 可读性与质量工具

## 16.1 优先模块

```text
performance
attendance
learning
reward
welfare
phase11 controllers
Phase11 DatabaseIT/API Integration/BrowserFixture
```

## 16.2 规则

- 一行一个 statement；
- 字段/构造器/方法分行；
- SQL、校验、状态迁移、Outbox 拆为命名方法；
- 生产/测试 Java 不得有 >400 字符行；
- 建议 ≤120；
- 不把领域规则移进 Controller；
- 不破坏事务边界；
- 先测试再重构，每模块单独提交。

## 16.3 工具

新增/启用：

```text
Spotless or google-java-format
Checkstyle
SpotBugs or PMD
JaCoCo
```

覆盖目标：

```text
core domain line >=80%
permission/state/idempotency/candidate/ledger branch >=90%
```

不得 exclude 整个 Phase10/11 模块。

## 16.4 Warning

- 固定 Spring Boot Maven Plugin version；
- 处理 `@MockBean` 弃用；
- 配置 Mockito agent；
- Maven warning 记录但不隐藏。

---

# 17. CXR-10：导航、包体和重复率

## 17.1 Navigation

共享 tech monitor 的导航 permission 必须覆盖真实 monitor permissions，或由 route meta 权威生成，避免：

```text
路由允许 p016.welfare.monitor
但菜单仍只认 p005.notice.monitor
```

新增“只有 P016 monitor 权限”的导航投影测试。

## 17.2 Route dynamic import

Phase 10/11 route 改为 lazy import，使 employee/center/tech 不一次性打包全部页面。

## 17.3 Bundle Ratchet

当前约：

```text
2.145 MB
```

先建立不可恶化基线，再逐步将主入口 chunk 降至 <500 KB。不能只提高 Vite warning limit。

## 17.4 Duplicate

当前 1.80%，整改后不得恶化；重复的 Phase11 feature error/action/render 结构可抽取业务无关组件，但不得创建万能业务组件。

## 17.5 Knip

修复：

```text
src/showcase/main.ts entry pattern no matches
```

不得用 ignore 隐藏真实入口。

---

# 18. CXR-11/CXR-12：本地全量复验和文档收口

## 18.1 后端

```powershell
.\mvnw.cmd -B -ntp test
.\mvnw.cmd -B -ntp -pl :platform-database-baseline -am -Pphase10-integration verify
.\mvnw.cmd -B -ntp -pl :platform-database-baseline -am -Pphase11-integration verify
```

执行 P006–P016 API Integration；解析 XML，不只搜索 BUILD SUCCESS。

## 18.2 前端

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm quality:deadcode
pnpm quality:duplicates
pnpm build
```

文档数字必须从当前日志自动提取，不手写旧数字。

## 18.3 Live E2E

```text
P006 → P007 → P008 → P009 → P010 → Phase10 monitor
P011 → P012 → P013 → P014 → P015 → P016
```

P016 tech E2E 必须验证真实 monitor record，不只验证 shell。

## 18.4 Cleanup

每个 fixture 后验证：

```text
PostgreSQL container absent
Redis container absent
Ryuk count 0
Gate Java/node process 0
Gate ports 0
```

## 18.5 文档对账

统一以下文件：

```text
README.md
MASTER_PROGRESS.md
PHASE-10 PHASE_GATE/REPORT
PHASE-11 PHASE_GATE/REPORT/README/GAP/IMPACT/START_CHECKLIST
remediation state/progress
```

删除矛盾：

- README Phase11 pending vs progress complete；
- START_CHECKLIST independent pass 未勾选 vs PhaseGate PASS；
- 36/198、70/636、实际数字并存；
- `.git absent` 与本地实际不一致；
- runlogs 不存在却作为唯一证据；
- construction pending 与 authorized Phase12 同时存在。

## 18.6 独立结论

Codex 完成后只能写：

```text
PHASE-10 = LOCAL_REGATE_CANDIDATE
PHASE-11 = LOCAL_REGATE_CANDIDATE
PHASE-12 = BLOCKED_PENDING_REVIEW
```

随后由独立 reviewer 在干净本地 clone 上运行 `release-gate.ps1`，再决定是否解锁。

---

# 19. Codex 每个任务的强制报告格式

```markdown
## Task Result

- Task ID: CXR-xx
- Status: PASS / FAIL / BLOCKED
- Local root: I:\PublicCompany_source_codex
- Source commit: <sha or N/A>
- Working tree: CLEAN / DIRTY
- Evidence path: <absolute path>

### Baseline reproduced
- finding/test

### Files changed
- path

### Commands executed
| Command | Exit | Result | Log |
|---|---:|---|---|

### Test totals
| Suite | Files/Classes | Tests | Failures | Errors | Skipped |
|---|---:|---:|---:|---:|---:|

### Findings closed
- finding

### Findings remaining
- finding

### Mandatory commands not executed
- NONE / exact command and reason

### Phase claim
- PHASE-10: ...
- PHASE-11: ...
- PHASE-12: BLOCKED

### Next task
- CXR-yy（当前 PASS 后才解锁）

### Claims not made
- 未自称 Independent Gate PASS
- 未宣称未执行测试通过
- 未授权 PHASE-12
```

---

# 20. 最终 Definition of Done

```text
[ ] Local Release Gate exists and self-tests fail-closed
[ ] fresh clone Phase10/11 source contracts pass
[ ] P007/P008/P009 latest workflow self-service candidates pass
[ ] Phase10 ledger/chronology/conflict hardening pass on PG16
[ ] P016 monitor route renders real P016 metadata
[ ] P016 monitor E2E verifies masking and no business actions
[ ] P014/P016 shared route uses explicit composite, no route-page nesting
[ ] Phase11 action list is server/task/candidate driven
[ ] manual retry reuses logical Idempotency-Key
[ ] same-record different actions are mutually exclusive
[ ] UI changed/all findings = 0
[ ] Phase10 source violations = 0
[ ] Java >400-char production/test lines = 0
[ ] Spotless/Checkstyle/SpotBugs/JaCoCo local gates pass
[ ] P001–P016 backend unit/API/DB/Worker regression pass
[ ] P006–P016 real Chromium pass
[ ] bundle does not exceed ratchet
[ ] jscpd does not exceed baseline
[ ] Knip has no unmatched real entry hint
[ ] test numbers in docs equal current logs
[ ] local evidence has SHA-256 and cleanup proof
[ ] Codex only marks REGATE_CANDIDATE
[ ] PHASE-12 remains blocked until independent clean-clone review
```

---

# 21. Codex 停止条件

Codex 必须停止并提出一个精确问题，如果：

1. 本地 HEAD 不是 `fef5908` 且改动范围无法安全重定位；
2. 用户工作区有未提交修改会被覆盖；
3. V125_1/V125_2 已存在但内容不同；
4. flyway_schema_history checksum 与源码冲突；
5. 必须修改旧 Published Workflow/Flyway 才能继续；
6. P014/P016 同一来源行的业务归属在 Knowledge Base 中无法确认；
7. Docker/PG16/Redis 不可用导致 mandatory Gate 无法执行；
8. 发现真实生产凭据或个人敏感数据；
9. 需要删除或重建用户本地正式数据库；
10. 用户要求开始 PHASE-12，但本任务书 DoD 尚未完成。

停止报告必须包含：

```text
Task ID
具体文件/迁移/命令
原始错误
已完成步骤
未执行步骤
需要用户回答的唯一问题
```

---

# 22. 最终目标

> 整改完成后，`I:\PublicCompany_source_codex` 应从“Phase 11 前端结构已改善，但阶段结论、P016 技术监控、Phase 10 历史缺口、幂等重试、动作投影和本地证据仍不闭合”，提升为“P001–P016 在同一份本地源码、同一 commit、同一套 PG16/Redis/API/Worker/Chromium Gate 上可重复通过，UI 与 Workflow 动作由服务端事实驱动，文档数字与当前日志一致，并且只有独立干净副本复验后才允许进入 PHASE-12”。
