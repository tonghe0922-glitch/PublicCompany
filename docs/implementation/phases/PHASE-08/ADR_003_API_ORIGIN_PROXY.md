# ADR-003｜PHASE-08 API Origin and Development Proxy

Status: `ACCEPTED_FOR_PHASE_08_C0`

## Context

当前开发端口：

```text
employee = 5173
center   = 5174
admin    = 5175
API      = 8080
```

前端生产部署尚未批准跨域 API 域名。`AGENT.md` 要求前端只暴露批准的公开配置，密钥、数据库地址和服务凭据不得进入 bundle。

## Decision

浏览器端统一使用**同源相对 API 路径**：

```text
/api/v1/...
```

不在业务页面拼接 host，不把 API host 作为业务事实。

### Local development

三个 portal 的 Vite dev server 统一配置：

```text
/api -> http://127.0.0.1:8080
```

允许仅在 Node/Vite 配置进程中通过：

```text
SJG_LOCAL_API_PROXY_TARGET
```

覆盖本地代理目标。该变量不会通过 `import.meta.env` 暴露给浏览器 bundle。

### Production

默认要求 Web 与 API 通过反向代理提供同源 `/api`。如果未来部署必须跨域，需新的部署/安全 ADR，同步 CORS、CSP、cookie/credential 策略和 E2E；PHASE-08 不预先加入宽松 CORS。

## Rules

1. API Client 默认 base=`''`，请求使用 `/api/...`；
2. 页面/Store 不读取 DB URL、Redis/MinIO/RabbitMQ 地址或服务凭据；
3. 不允许 `VITE_*` 承载密码、token、私钥或数据库连接串；
4. 本地 Vite proxy 只解决开发 origin，不改变后端 deny-by-default；
5. production build 不包含 `127.0.0.1:8080` 作为客户端请求地址；该值只存在 Vite Node config；
6. 构建产物继续执行 secret/source-map/test-credential 扫描。

## Consequences

- employee/center/admin 三端共用同一 API Client；
- 不需要 CORS 才能完成本地浏览器开发；
- 部署层可通过同源反向代理稳定承载 `/api`；
- 后续 Docker/生产阶段只需要配置服务器代理，不重写页面请求路径。
