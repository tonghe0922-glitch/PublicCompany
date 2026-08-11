# PHASE-02 IMPACT MATRIX

> Phase: `PHASE-02`
> Scope: `PLATFORM/基础工程`
> Goal: 建立可编译、可测试、可启动的 monorepo 工程骨架；不实现领域业务。
> Source: PHASE-02 正式施工说明 + 根 `AGENT.md` + `DESIGN.md` + PHASE-01 machine contracts。

| Dimension | PHASE-02 impact | Expected implementation |
|---|---|---|
| process_code | `PLATFORM/基础工程` | 不实现 P001–P126 领域流程，不创建假业务状态 |
| Employee 页面 | 工程入口与空壳启动页 | 仅 platform shell/smoke，明确“基础工程已启动，业务未实现” |
| Center 页面 | 工程入口与空壳启动页 | 同上，不复制服务端业务事实 |
| Tech 页面 | 工程入口与空壳启动页 | canonical `tech`，不赋予业务超级权限 |
| Route | 三端根入口 | Vue Router 最小根路由，不预生成业务页面路由 |
| Permission | 工程骨架 | 不实现业务权限码；后端仅保留安全模块边界 |
| Data Scope | N/A | 不制造 SELF/CENTER 等业务结论 |
| Sensitive Level | N/A | 不制造字段敏感级别 |
| API | platform health | 仅健康/存活型 platform endpoint；无业务 CRUD |
| Application Service | 骨架 | 建模块边界，不写业务 use case |
| Domain | 骨架 | core/iam/org/workflow/document/notification/integration/audit 模块可编译 |
| Repository | 骨架 | Spring JDBC 依赖与模块边界存在，不写业务 SQL |
| 数据库 | 开发依赖 | PostgreSQL 16 Compose；不创建业务表 |
| Flyway | 基础集成 | 引入 Flyway PostgreSQL 支持；不创建业务迁移 |
| Workflow | 模块骨架 | 不实现业务状态机 |
| Outbox | shared/core 骨架 | 只定义模块边界，不创建业务 outbox 表 |
| Worker | 独立 Spring Boot 应用 | 与 api 分离，可独立 compile/smoke |
| Audit | 模块骨架 | 不写审计业务记录 |
| Notification | 模块骨架 | 不发送真实通知 |
| Integration | 基础依赖 | Redis/MinIO/RabbitMQ Compose；不调用真实外部系统 |
| Unit Test | 必须 | Java 模块 smoke/unit + 前端 Vitest smoke |
| Integration Test | 基础设施配置验证 | Compose config / Spring context 最小验证；业务 PostgreSQL IT 不适用 |
| E2E | 最小构建入口检查 | 不做业务 E2E；验证三端入口可构建 |

## Hard boundaries

- 不得创建 P001–P126 业务实现。
- 不得创建静态业务页面并标记 IMPLEMENTED。
- 不得创建 Mock API、localStorage/sessionStorage 业务事实源。
- 不得新增 React、JPA/Hibernate、WebFlux、H2/SQLite。
- 不得修改 Knowledge Base 原始事实。
