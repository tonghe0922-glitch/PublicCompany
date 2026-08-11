# PHASE-09｜P001–P005 公共能力 A

> 当前状态：`COMPLETE / FULL_CONSTRUCTION_GATE_PASS / P001_CLOSED / P002_CLOSED / P003_CLOSED / P004_CLOSED / P005_CLOSED`
> 上一阶段：`PHASE-08 = COMPLETE / FORMAL_GATE_PASS / INDEPENDENT_RECHECK`
> 当前施工分支：`ChatGPT_Version_V0.07`
> Accepted implementation candidate：`2eb9f646bf4477d4a4d82f605a1c7bc8e6cadd00`
> 下一阶段：`PHASE-10 = NOT_STARTED / UNLOCKED_BY_PHASE09_GATE`

PHASE-09 的 P001–P005 已全部关闭，Construction Master Schedule 的阶段核心门槛 **“5 流程三端闭环”** 已由同一 SHA 的 Full Construction Gate 验证通过。本阶段不得继续新增业务施工；PHASE-10 仅解除前置阻塞，本文件不代表 PHASE-10 已开工。

## 阶段范围与 checkpoint

| Process | 范围 | 状态 | 最终证据 |
|---|---|---|---|
| P001 | 统一登录与多岗位身份切换 | `CHECKPOINT_PASS / CLOSED` | `P001_CHECKPOINT.md` |
| P002 | 权限申请、复核与回收 | `CHECKPOINT_PASS / CLOSED` | `P002_CHECKPOINT.md` |
| P003 | 个人资料变更 | `CHECKPOINT_PASS / CLOSED` | `P003_CHECKPOINT.md` |
| P004 | 通用申请与审批 | `CHECKPOINT_PASS / CLOSED` | `P004_CHECKPOINT.md` |
| P005 | 制度、通知与执行回执 | `CHECKPOINT_PASS / CLOSED` | `P005_CHECKPOINT.md`；Full Gate run `31408096251` SUCCESS |

## C0 冻结事实

- 15/15 三端流程 XLSX 已实际解析：90 sheets、4,396 nonempty rows、0 failures；
- PHASE-01 page `process_codes` binding=0 与 business HTTP records=0 均保留为历史事实；本阶段通过显式 source-coordinate binding 与工程 HTTP/permission contract 实施；
- WorkflowRuntimeService、Notification/Outbox/Audit、IAM/Redis Session 等现有平台内核均复用，没有平行造第二套；
- P2/P3 字段遵守最小必要、脱敏、受控原则，密钥/密码/原文不得进入日志/审计/事件；
- 技术端不自动获得业务审批权；
- P006–P010 属于 PHASE-10，本阶段未施工；PHASE-11+ 继续禁止提前施工。

## 已关闭 checkpoint 摘要

### P001

IAM 登录/MFA/session 生命周期真实闭合；TOTP、密码重认证、Redis session、PostgreSQL/Audit、员工/中心/技术三端 Gate 均通过。

### P002

权限申请→多级复核→真实 `iam.user_role` grant→回收闭合；HIGH reviewer separation、幂等、版本、AUTO_EXPIRE、retry/DLQ、durable notification 和三端真实 Gate 均通过。

### P003

个人资料变更已闭合 proposal→双人复核→权威主档 AES-GCM/hash 更新→投影→通知审计；三端 reusable live regression 已纳入最终 PHASE-09 Full Gate。

### P004

通用申请已闭合填写→前置校验→动态审批→执行→独立验收→异常补偿→归档。真实实现复用 canonical `workflow.generic_request`、published WorkflowRuntime/Form/Task、Audit/Outbox/Notification；职责分离、幂等、乐观锁、跨中心 data scope、Tech metadata-only 均有真实回归。

### P005

冻结流程：

```text
S01 制度/通知版本发布
 → S02 按组织岗位确定范围
 → S03 消息送达
 → S04 员工阅读
 → S05 确认/阅签
 → S06 考试或理解验证
 → S07 执行任务
 → S08 责任人验收
 → S09 未完成催办升级
 → S10 档案移交
 → END 已关闭
```

P005 真实实现复用 canonical `collaboration.notice`、published Workflow/Form/Task、Outbox Worker/Notification、Audit、IAM 与 Redis Session。Employee `/employee/13/01/05`、Center `/center/13/01/05`、Tech `/tech/05/03/01` 已通过真实三端 Playwright。

最终数据库事实：`已关闭 / workflow COMPLETED / END / recipients2 / delivered2 / read2 / confirmed2 / understood2 / executed2 / accepted2 / orderViolations0 / receiptEvents12 / deliveryEvents2 / START1 / businessActions10 / FORM_SUBMIT1 / form1 / P005 outbox10 / privateHits0 / audit published1 / READ3(含一次同 key 重放审计) / CONFIRM2 / UNDERSTANDING2 / EXECUTION2 / MANAGE3 / passwordHits0`。已发布 notice 的非法正文修改由数据库不可变约束拒绝。

独立 P005 Live Gate：run `31407271270` / run number 8 / job `93516540880` SUCCESS / artifact `9070179633`。

## PHASE-09 最终 Full Construction Gate

最终 accepted implementation candidate：`2eb9f646bf4477d4a4d82f605a1c7bc8e6cadd00`

- Run number: `121`
- Run ID: `31408096251`
- Scope/source contract: `SUCCESS`
- Java21 + PostgreSQL16 + Redis backend regression: `SUCCESS`
- Vue TypeScript/lint/unit/build: `SUCCESS`
- P001 real live regression: `SUCCESS`
- P002 real live regression: `SUCCESS`
- P003 reusable live regression: `SUCCESS`
- P004 reusable live regression: `SUCCESS`
- P005 reusable live regression: `93519246713 / SUCCESS`
- P005 artifact: `9070482992`
- Final construction verdict: `93520539859 / SUCCESS`

P005 已被纳入 Full Gate 的 push scope、阶段边界扫描、credential/bypass scan、reusable job、`needs` 和最终 PASS 断言；因此最终 verdict 不可能在 P005 失败/跳过时误报 PHASE-09 PASS。

## 本阶段最终修复与门禁收口

- dedicated P003/P004/P005 Playwright configs 纳入 `knip.json` entry，`quality:deadcode` 不再误报；
- 主 `playwright.config.ts` 隔离 P004/P005 dedicated live specs，通用 `test:e2e` 不再混跑真实基础设施专项用例；
- P005 正式三端路由、canonical notice schema、workflow manager candidate、真实 Outbox Worker runtime、审计幂等重放计数、Vue async persistence 等真实 Gate 缺陷已逐项修复；
- Worker smoke test 使用高优先级参数关闭外部基础设施，既不破坏真实 Worker 激活，也能稳定完成无外部依赖 smoke；
- 最终 Full Construction Gate 强制 P001–P005 同一 SHA 全量验收。

## 阶段 verdict 与施工边界

```text
P001 = CHECKPOINT_PASS / CLOSED
P002 = CHECKPOINT_PASS / CLOSED
P003 = CHECKPOINT_PASS / CLOSED
P004 = CHECKPOINT_PASS / CLOSED
P005 = CHECKPOINT_PASS / CLOSED
PHASE-09 = COMPLETE / FULL_CONSTRUCTION_GATE_PASS
PHASE-10 = NOT_STARTED / UNLOCKED_BY_PHASE09_GATE
PHASE-11+ = NOT_STARTED / DO_NOT_START_EARLY
```

PHASE-09 至此停止施工。下一合法施工对象是 **PHASE-10 / P006–P010 公共能力 B**，但必须由下一阶段开工流程显式启动；本次封板不提前施工 PHASE-10。
