# PHASE-09 PHASE_REPORT — P001–P005 公共能力 A

> Repository: `louthison/PublicCompany`
> Branch: `ChatGPT_Version_V0.07`
> Phase state: `COMPLETE / FULL_CONSTRUCTION_GATE_PASS`
> Scope: `P001–P005`
> Construction Master Schedule core gate: `5流程三端闭环`
> Accepted implementation candidate: `2eb9f646bf4477d4a4d82f605a1c7bc8e6cadd00`
> Closeout parent: `ec41cf0b9b446cd3ba593509a7267808e358333b`
> PHASE-10: `NOT_STARTED / UNLOCKED_BY_PHASE09_GATE`

## 1. 阶段名称与边界

`PHASE-09｜P001–P005 公共能力 A`。本阶段只允许 P001–P005；P006–P010 属于 PHASE-10，P011+ 属于更后阶段，均不得提前施工。

根 `Construction Master Schedule.csv` 将本阶段核心门槛冻结为 **5 流程三端闭环**。本报告不以“页面存在”“HTTP 200”或“通知已发送”作为完成，必须同时验证服务端权限、工作流、数据落库、异步副作用、审计、隐私与三端 E2E。

## 2. 读取与遵循的权威基线

本阶段按根 `AGENT.md` 的优先级和质量门禁执行，并使用已冻结的 PHASE-09 C0 证据、`SOURCE_CONTRACT`、`IMPACT_MATRIX`、`GAP_MATRIX`、P001–P005 source snapshot/page trace、数据库 canonical schema/Flyway、三端路由与现有 Workflow/Outbox/Notification/IAM 内核。

C0 实际解析：15/15 XLSX、90 sheets、4,396 nonempty rows、0 failures。历史 page process binding=0 与 business HTTP source=0 未被伪造成来源事实；本阶段使用显式 source-coordinate binding 与工程 HTTP/permission contract。

## 3. P001 — 统一登录与多岗位身份切换

状态：`CHECKPOINT_PASS / CLOSED`。

真实闭环包括 login、密码重认证、TOTP MFA、Redis session、session list/revoke/refresh、身份切换、审计与三端访问。旧 access token 在 refresh/switch 后失效；越权身份切换 fail-closed；密码与 MFA 密钥不进入 audit。

证据：`P001_CHECKPOINT.md`；PHASE-09 run `31313100002 / SUCCESS`。

## 4. P002 — 权限申请、复核与回收

状态：`CHECKPOINT_PASS / CLOSED`。

真实闭环覆盖权限申请、多级复核、真实 `iam.user_role` grant、人工/自动回收、HIGH 风险 reviewer separation、版本/幂等、Outbox/Notification、retry/DLQ 与三端 data scope。

最终事实：grant `REVOKED`、workflow `COMPLETED`、START=1、business actions=7、approvers=3、outbox=7。

证据：`P002_CHECKPOINT.md`；run `31332029201 / SUCCESS`。

## 5. P003 — 个人资料变更

状态：`CHECKPOINT_PASS / CLOSED`。

真实闭环为 proposal → 双人复核 → 权威主档更新 → 投影 → 通知/审计。P2/P3 受控字段使用 AES-GCM ciphertext + SHA-256 hash；原文不进入 request/outbox/audit，密码命中=0。

最终事实：status 已关闭、workflow COMPLETED、START=1、business actions=6、reviewers=2、outbox=6、item=1、audit 1/3/1、Redis=30。

证据：`P003_CHECKPOINT.md`；Full Gate run `31336274001 / SUCCESS`。

## 6. P004 — 通用申请与审批

状态：`CHECKPOINT_PASS / CLOSED`。

真实闭环为填写 → 前置校验 → 动态审批 → 执行 → 独立验收 → 异常补偿 → 归档。复用 canonical `workflow.generic_request` 与 published Workflow/Form/Task；职责分离、幂等、乐观锁、跨中心 data scope、Tech metadata-only 均由真实 PG16/Redis/三端 Gate 验证。

最终事实：status 已关闭、workflow COMPLETED、actualAmount=111.11、START=1、business actions=9、FORM_SUBMIT=1、approval actors=2、exec/accept actors=2、applicant actions=0、tech actions=0、outbox=9、form=1、audit=1+22、Redis=30；private/password hits=0。

证据：`P004_CHECKPOINT.md`；独立 Gate `31362796230 / SUCCESS`；Full Gate `31363467215 / SUCCESS`。

## 7. P005 — 制度、通知与执行回执

状态：`CHECKPOINT_PASS / CLOSED`。

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

实现复用 published `WorkflowRuntimeService`、Form/Task、Audit、Outbox Worker、Notification、IAM、Redis Session，不造第二套状态机。canonical master=`collaboration.notice`；receipt facts=`collaboration.notice_recipient / notice_receipt_event`。已发布 notice 受不可变约束保护，修改正式内容必须新版本。

三端冻结路由：Employee `/employee/13/01/05`、Center `/center/13/01/05`、Tech `/tech/05/03/01`。Tech 仅监控 projection，不自动获得业务发布/回执/验收权。

最终数据库事实：status 已关闭、workflow COMPLETED、current_node END、recipients=2、delivered=2、read=2、confirmed=2、understanding_passed=2、executed=2、accepted=2、order_violations=0、receipt_events=12、delivery_events=2、workflow_START=1、business_actions=10、FORM_SUBMIT=1、form_count=1、P005_business_outbox=10、private_payload_hits=0、password_hits=0；published notice illegal mutation=REJECTED。

证据：`P005_CHECKPOINT.md`；独立 P005 Live Gate `31407271270 / SUCCESS`；PHASE-09 Full Gate `31408096251 / SUCCESS`。

## 8. API / Service / Repository / Flyway

P001–P005 的业务写操作均由服务端领域命令/Workflow 推进，前端不能提交任意最终状态。P003/P004/P005 repository 已对齐 canonical schema；P005 使用 `planned_start_at / planned_finish_at` 对应业务有效期，不依赖不存在的旧列。

数据库变更坚持 append-only Flyway overlay，不修改已发布 migration。P005 后续 overlay 用于修正 canonical trigger/workflow contract；没有通过直接改旧 migration 隐藏历史。

## 9. Permission / ABAC / RLS / Step-Up

前端 route/nav 只是 UX projection；最终授权由 Spring Security/IAM/AuthorizationService/data scope/RLS。Employee、Center、Tech 权限分离；技术端不是业务超级管理员。高风险身份/权限链继续使用既有 Step-Up/MFA 能力；跨 tenant/center/非收件人/非审批人均 fail-closed。

## 10. Audit / Outbox / Worker / Integration

关键业务动作有 audit；业务事件通过 durable Outbox + Worker + Notification 处理，不以页面成功提示替代副作用落地。P005 真实 Gate 验证 `PlatformOutboxPump → Phase09P005NotificationHandler → NotificationService` 实际消费，而非“应用启动但 Worker 未装载”。

P005 同 Idempotency-Key 重放保留独立 HTTP audit，但不得重复 workflow/receipt/outbox 副作用；READ audit=3 表示 2 次真实 READ + 1 次合法同 key replay audit。

## 11. 正常、负向、幂等、并发测试

正常路径覆盖 P001–P005 三端闭环。负向覆盖未登录/越权/跨范围/错误顺序/stale version/非法状态/Tech 越权/非收件人访问/已发布通知非法修改。幂等覆盖重复写不产生重复业务副作用。并发与版本通过 server version/乐观锁/状态机顺序约束处理；Playwright 不再用随机等待掩盖异步竞态，而等待可观察持久化结果。

## 12. 前端静态质量与构建

PHASE-09 Full Construction Gate 强制执行：`pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm build`。P003/P004/P005 dedicated Playwright configs 已进入 `knip.json` entry；主 `playwright.config.ts` 排除 P004/P005 dedicated live specs，避免通用 E2E 混跑真实基础设施专项用例。

## 13. 后端与真实基础设施

Gate 使用 Java 21，执行 API 及依赖模块单元测试；运行 PostgreSQL16 + Redis IAM integration；运行 PHASE-09 worker/notification integration。P001–P005 browser jobs 均连接真实 Spring fixture + PostgreSQL16 + Redis，而非静态 mock 页面。

## 14. 最终 Full Construction Gate

Accepted implementation candidate：`2eb9f646bf4477d4a4d82f605a1c7bc8e6cadd00`。

```text
Run number = 121
Run ID = 31408096251
Scope/source contract = SUCCESS
Java21 + PostgreSQL16 + Redis backend regression = SUCCESS
Vue TypeScript/lint/unit/build = SUCCESS
P001 real live regression = SUCCESS
P002 real live regression = SUCCESS
P003 reusable live regression = SUCCESS
P004 reusable live regression = SUCCESS
P005 reusable live job = 93519246713 / SUCCESS
P005 reusable artifact = 9070482992
Final construction verdict = 93520539859 / SUCCESS
```

P005 已纳入 push paths、phase boundary scan、credential/bypass scan、reusable job、`needs` 与最终 PASS assertion，因此 P005 失败/跳过时 Full Gate 不能误报成功。

## 15. 本阶段真实缺陷修复链

- dedicated P003/P004/P005 Playwright configs 未进入 knip entry；已修复；
- 主 Playwright 未隔离 P004/P005 live specs；已修复；
- P005 路由曾使用旧值；已改冻结正式路由；
- P005 Repository 曾引用 canonical notice 不存在字段；已对齐 schema；
- P005 manager candidate 被 initiator exclusion 过滤为空；已通过 workflow v2 修正；
- Worker 条件装配可能启动但不消费；已修复真实 runtime 激活；
- worker smoke 低优先级 default properties 未真正关闭外部 Worker；已改高优先级参数；
- audit 对合法幂等 replay 计数预期错误；已改精确 action 计数；
- Vue async handler 与 Playwright click 竞态；已等待持久化事实；
- Full Gate 曾未把 P005 作为 required dependency；已强制纳入；
- 最终文档收口发现 `MASTER_PROGRESS.md` 仍停留 P005 NOT_STARTED，且缺失 PHASE-09 `PHASE_REPORT.md` / `PHASE_GATE.md`；本次正式补齐并保留失败历史。

## 16. 未运行测试与后续阶段风险

本阶段不宣称已完成 PHASE-33 部署、PHASE-34 性能/备份恢复、PHASE-35 126 流程全量 UAT。P006–P010 未施工；PHASE-10 只解除阻塞。任何后续回归若破坏 P001–P005，必须先修复已完成能力。

## 17. 回滚方式

代码与文档均使用普通 `git revert` 回退，禁止 force push、reset --hard 覆盖其他提交。已发布 Flyway migration 不回写；需要数据库修正必须新增向前 migration/overlay。

## 18. Definition of Done

```text
P001 = CHECKPOINT_PASS / CLOSED
P002 = CHECKPOINT_PASS / CLOSED
P003 = CHECKPOINT_PASS / CLOSED
P004 = CHECKPOINT_PASS / CLOSED
P005 = CHECKPOINT_PASS / CLOSED
5流程三端闭环 = PASS
server-side permission/data scope = PASS
canonical PostgreSQL/Flyway = PASS
published Workflow/Form/Task reuse = PASS
Audit/Outbox/Worker/Notification = PASS
Redis Session = PASS
idempotency/version/order/negative tests = PASS
privacy/credential hygiene = PASS
TypeScript/lint/unit/build = PASS
real browser + PostgreSQL16 + Redis = PASS
PHASE-09 Full Construction Gate = PASS
PHASE-10 = NOT_STARTED / UNLOCKED_ONLY
PHASE-09 = COMPLETE
```

本报告只封板 PHASE-09，不自动启动 PHASE-10。
