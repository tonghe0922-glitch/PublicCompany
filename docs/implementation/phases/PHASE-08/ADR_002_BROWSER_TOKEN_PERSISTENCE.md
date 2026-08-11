# ADR-002｜PHASE-08 Browser Credential Persistence

Status: `ACCEPTED_FOR_PHASE_08_C0`

## Context

PHASE-04 当前 HTTP 合同通过 JSON 返回 opaque access/refresh token。`AGENT.md` 明确禁止把 Token 放入 `localStorage`，同时要求 `portal-session` 覆盖刷新恢复、损坏缓存、过期会话、退出、身份切换和并发恢复。

当前后端尚未批准 HttpOnly refresh-cookie 合同；如果直接改为 cookie，需要同步 CSRF、SameSite/Secure、CORS、OpenAPI、登录/刷新/退出控制器与完整安全回归，不能由前端自行假设。

## Decision

PHASE-08 在现有 Bearer/JSON 合同下采用最小持久化模型：

```text
access token  = memory only
refresh token = sessionStorage / current browser tab only
```

持久化对象必须是版本化、最小字段 credential envelope：

```text
version
refreshToken
refreshExpiresAt
```

禁止持久化：

```text
accessToken
password
Step-Up assertion
Step-Up ticket
完整 SessionView
敏感员工/合同/薪资数据
```

## Runtime rules

1. 登录成功后 access token 仅进入内存；refresh token 写入当前 tab 的 `sessionStorage`；
2. 页面刷新时只读取 refresh envelope，先验证 JSON 结构/版本/expiry；损坏、未知版本、过期全部立即清除并 fail-closed；
3. restore 只能调用一次统一 refresh recovery；成功后立即用服务端旋转后的新 refresh token 原子替换旧值；
4. 同一 tab 内 refresh 必须 single-flight，所有并发 401 共用同一个恢复 Promise；
5. 403 不触发 refresh；409/503 不进入无限恢复循环；
6. logout 清除 memory access + sessionStorage refresh；
7. identity switch 成功后旧 credential 立即替换，旧 permissions/navigation/request state 全部失效；
8. 不使用 `localStorage`、IndexedDB 或 Cookie 复制 token；
9. 不跨 tab 同步 refresh token。另一个 tab 如无自己的 tab session，按匿名处理；
10. token/password/assertion 不进入 console、错误详情、日志或 telemetry。

## Security trade-off

`sessionStorage` 仍可被同源 XSS 读取，因此它不是 HttpOnly cookie 的等价安全替代。本阶段选择它的原因是：保持已 Gate 的 PHASE-04 Bearer 合同、限制持久化到单 tab、避免在没有完整 CSRF/Cookie 安全合同的情况下做半套迁移。

后续如在安全专项阶段迁移为 HttpOnly refresh cookie，必须单独 ADR，并一次性同步：

```text
SameSite / Secure / HttpOnly
CSRF policy
CORS/origin
login/refresh/logout response contract
OpenAPI
integration + browser security tests
```

## Acceptance

- `localStorage` 中不得出现任何 token；
- restore/corrupt/expired/concurrent refresh/logout/switch 必须有 Vitest 回归；
- 构建产物不得含 synthetic credential 常量或真实 token。
