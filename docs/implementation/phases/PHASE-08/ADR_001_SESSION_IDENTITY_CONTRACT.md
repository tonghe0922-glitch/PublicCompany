# ADR-001｜PHASE-08 Session Identity Discovery Contract

Status: `ACCEPTED_FOR_PHASE_08_C0`

## Context

PHASE-04 已批准并实现：

```text
GET  /api/v1/session
POST /api/v1/session/switch
```

`POST /session/switch` 接收 `identityId`，服务端会重新验证 active identity/appointment、签发新 session，并撤销旧 session family；但原 `GET /session` 只返回当前 identity 与 permissions，前端没有权威来源知道“当前用户有哪些可切换身份”。

IAM 内核已经存在 `IdentityDirectoryService.activeIdentities(tenantId, userId)`，并基于 PostgreSQL 权威 identity + active appointment 过滤候选，因此 PHASE-08 不需要自行推断岗位或另造身份目录。

## Decision

扩展现有 `GET /api/v1/session` 的 `SessionView`，新增：

```text
availableIdentities[]
```

每个候选只暴露当前用户已有的最小 active identity 事实：

```text
identityId
identityType
identityName
orgId
positionId
primary
effectiveStartAt
effectiveEndAt
```

不新增第二个 identity discovery endpoint。

## Security rules

1. 候选来源只能是 `IdentityDirectoryService.activeIdentities(currentTenant, currentUser)`；
2. 不返回候选 identity 的额外权限集合、敏感员工资料、薪资、合同或业务数据；
3. 前端候选列表只用于发起 switch 请求，不构成切换授权；
4. `POST /session/switch` 继续服务端重新校验 identity/appointment 并撤销旧 session family；
5. 切换后前端必须丢弃旧 access token、旧 permissions、旧 navigation projection 和旧请求结果；
6. `admin` 只是 tech runtime alias，不因此增加候选身份或业务权限；
7. 未知/失效 identity fail-closed。

## Consequences

- TopHeader 可以从当前 session 的服务端事实渲染多身份切换器；
- 不需要根据页面标题、组织名称或浏览器缓存猜测身份；
- OpenAPI `SessionView` 必须同步 `availableIdentities` schema；
- 后端合同测试必须验证候选列表来自 server-authorized active identities。
