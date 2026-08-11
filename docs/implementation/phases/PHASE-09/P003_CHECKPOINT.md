# PHASE-09 P003 Checkpoint

> Process: `P003` 个人资料变更
> Checkpoint status: `PASS / CHECKPOINT_CLOSED / P004_UNLOCKED`
> Evidence branch: `ChatGPT_Version_V0.07`
> Evidence SHA: `df2b5bff7e3fa63c882e59c51805247c8aee39c0`
> Closed at: `2026-08-10`

本文件只关闭 PHASE-09 的 P003 checkpoint。`PHASE-09` 仍为 `IN_PROGRESS`；P001–P003 已关闭；P004–P005 尚未完成；`PHASE-10` 继续 `NOT_STARTED / BLOCKED_UNTIL_PHASE09_GATE`。

## 1. 冻结流程与实际状态机

```text
S03 提交新值与证明
 → S04 字段敏感级别校验
 → S05 人事/财务/归口岗核验
 → S06 权威主档更新
 → S07 关联模块投影同步
 → S08 通知与审计
 → END 已关闭
```

P003 复用 published WorkflowRuntimeService，不建立第二套自由状态机。`business_id / business_no / workflow_instance_id / status / version_no` 均以 PostgreSQL 为唯一事实；前端不能指定目标状态。S04/S05 必须由不同 `employee_id` 完成，精确相同 `Idempotency-Key` 重放仍返回原结果；换新 key 不能绕过职责分离。

## 2. 实际 API、权限与三端路由

API：

- `POST /api/v1/processes/P003/profile-changes`
- `GET /api/v1/processes/P003/profile-changes`
- `GET /api/v1/processes/P003/profile-changes/{id}`
- `POST /api/v1/processes/P003/profile-changes/{id}/actions/review`
- `POST /api/v1/processes/P003/profile-changes/{id}/actions/apply`

服务端权限：`p003.change.submit / read / review / apply`。全局 deny-by-default SecurityFilterChain 只把 `/api/v1/processes/P003/**` 放入 authenticated 边界；细粒度权限与 data scope 仍由 Controller + AuthorizationService 执行。

冻结路由：

- Employee：`/employee/03/03/01`
- Center：`/center/03/02/01`
- Tech：`/tech/04/01/01`

Employee 为 SELF；Center 为授权中心范围；Tech 仅执行权威 apply/同步所需能力，不自动获得业务复核权。跨中心列表为空且直接读取被拒绝。

## 3. 敏感字段与权威主档

当前服务端字段白名单：`person_name / mobile / id_no`。敏感级别由服务端固定，不接受客户端自报：

- `person_name`：P2；
- `mobile`：P2；
- `id_no`：P3，高度敏感，证明材料必填。

P3 使用独立 profile AES-GCM master key，不复用 MFA key。`id_no` proposal 在 `hr.employee_profile_change_item.item_value_json` 只保存 ciphertext + SHA-256 hash；权威 `org.employee` 更新 `id_no_cipher / id_no_hash`。读取只返回掩码，不返回原文；密钥缺失时 fail closed。

Live Gate 使用合成值 `TESTP003ID00001234`，最终页面/API 仅显示 `********1234`。后验严格验证：item/request/outbox/audit 中原文明文命中均为 0；测试密码审计命中 0。

## 4. PostgreSQL / Workflow / Audit / Outbox / Notification

Canonical facts：

- 主单：`hr.employee_profile_change`
- 字段项：`hr.employee_profile_change_item`
- 权威员工主档：`org.employee`
- Workflow：`workflow.wf_instance / wf_task / wf_action_log`
- Event：`core.outbox_event`
- Audit：独立 `sjg_audit.audit.operation_log`
- Notification：`notification.message` + `NOTIFICATION_SEND` outbox

`V110__phase09_p003_profile_change.sql` 发布正式 P003 workflow/version/nodes/transitions/permissions。`Phase09P003NotificationHandler` 只消费业务号、事件和节点标签，不把 proposal value 写入通知；节点白名单外事件 fail closed。

真实 notification PostgreSQL IT 验证：事件生成唯一 durable IN_APP message +唯一 NOTIFICATION_SEND；精确 replay 幂等；事件即使夹带 synthetic secret，message/outbox 仍不含该值；非法 S99 回滚。

## 5. 负向、幂等、职责分离与真实 E2E

最终 Gate 覆盖：

1. Employee 真实登录并提交 P3 `id_no` 变更；
2. P3 缺证明由服务端拒绝；
3. applicant 无 review/apply 权限；
4. cross-center list/get 受 data scope 限制；
5. stale review 返回 409；
6. reviewer1 在 Center UI 完成 S04；
7. reviewer1 换新 key 尝试 S05 被职责分离拒绝；
8. reviewer2 完成 S05；同 key 精确重放保持同一结果/version；
9. reviewer 无 apply 权限；stale tech apply 返回 409；
10. Tech UI 执行 S06，并由服务端连续完成 S07/S08/END；
11. closed request 再 review/apply 返回冲突；
12. Employee 重新读取仍只看到掩码与服务端 CLOSED 状态；
13. PostgreSQL 后验验证权威主档、cipher/hash、Workflow、Outbox、Audit；
14. Redis 使用真实 session runtime；不存在浏览器 shadow state。

## 6. 最终 Gate 证据

### 独立 P003 Live Gate

- Run ID: `31335960725`
- Job: `93301711565 / SUCCESS`
- Result: Playwright `1 passed`
- Facts: `status=已关闭 / workflow=COMPLETED / START=1 / business actions=6 / reviewers=2 / outbox=6 / item=1 / audit=1/3/1 / redis=30`

### PHASE-09 Full Construction Gate（P003 已成为 verdict 必需依赖）

- Run number: `91`
- Run ID: `31336274001`
- Head SHA: `df2b5bff7e3fa63c882e59c51805247c8aee39c0`
- Scope/source contract: `SUCCESS`
- Vue TypeScript/lint/unit/build: `SUCCESS`
- Java unit + PostgreSQL16/Redis IAM + phase09 integration: `SUCCESS`
- P001 real live regression: `SUCCESS`
- P002 real live regression: `SUCCESS`
- P003 reusable live job: `93302543447 / SUCCESS`
- P003 artifact: `9044458178`
- Final construction verdict: `93302929858 / SUCCESS`

## 7. 真 Gate 发现并关闭的缺陷链

- `JdbcProfileChangeRepository` 曾声明为 `final`，Spring exception translation/AOP 无法 CGLIB 代理，导致已完成 PHASE-08/P001/P002 上下文连锁失败；移除 final 后旧阶段全部恢复绿；
- P003 初次 live create/list 统一 403。Session 已有 P003 权限，最终定位为 deny-by-default `SecurityConfiguration` 未登记 P003 authenticated API boundary；新增 P003 authenticated matcher，未绕过细粒度 RBAC/data scope；
- P003 live spec 首轮 lint `prefer-const` 被静态 Gate 拒绝后修复；
- P003 专属 Gate 被抽成 reusable `workflow_call`，Full Gate verdict 直接依赖同一份真实 P003 Gate，避免独立/总门禁脚本漂移；
- 新增真实 P003 notification PostgreSQL IT 并纳入 `phase09-integration`。

## 8. Checkpoint verdict

```text
P001 = CHECKPOINT_PASS / CLOSED
P002 = CHECKPOINT_PASS / CLOSED
P003 = CHECKPOINT_PASS / CLOSED
P004 = NEXT / NOT_STARTED
P005 = NOT_STARTED
PHASE-09 = IN_PROGRESS / NOT COMPLETE
PHASE-10 = NOT_STARTED / BLOCKED_UNTIL_PHASE09_GATE
```

P003 已满足真实页面、API、server permission/data scope、Workflow、PostgreSQL、Redis、权威主档加密、Audit、Outbox、Notification、幂等、版本/并发、职责分离、负向验证和三端真实 E2E。允许进入 P004；不得因此宣告 PHASE-09 COMPLETE，也不得施工 P006+。
