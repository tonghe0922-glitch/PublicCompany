# PHASE-02 GAP MATRIX

> Status vocabulary: `EXISTING / PARTIAL / MISSING / CONFLICT / BLOCKED`.
> Formal Phase Gate recheck snapshot. PHASE-02 technical acceptance result: `PASS`; PHASE-03 remains `NOT_STARTED`.

| ID | Area | Status | Formal recheck fact | Boundary / follow-up |
|---|---|---|---|---|
| G01 | Construction branch | EXISTING | `agent/full-build`，正常追加提交，无 force push | 继续沿用 |
| G02 | Draft PR | EXISTING | PR #2 持续承载施工分支，OPEN / DRAFT / 未合并 | PHASE-35 前不自动 merge |
| G03 | gh CLI | BLOCKED | 当前对话执行容器无 `gh` | 用户已授权 GitHub Connector 等价操作，不冒充本地 gh |
| G04 | Maven parent/wrapper | EXISTING | Java 21 + Maven 3.9.11 wrapper，多模块全仓 test 通过 | 后续复用 |
| G05 | API app | EXISTING | 独立 Spring Boot `platform-api`，Actuator/JDBC/Flyway/PostgreSQL 基础接线 | 无业务 Controller |
| G06 | Worker app | EXISTING | 独立非 Web Spring Boot `platform-worker` | 无业务 Worker handler |
| G07 | Core modules | EXISTING | core/iam/org/workflow/document/notification/integration/audit 可编译并有 smoke test | 仅模块骨架 |
| G08 | Spring JDBC | EXISTING | api/worker 引入 `spring-boot-starter-jdbc` | 无业务 Repository/SQL |
| G09 | Flyway | EXISTING | api/worker 引入 Flyway PostgreSQL 支持 | 业务 migration 数=0 |
| G10 | Vue monorepo | EXISTING | Vue3/TS/Vite/Pinia/Router 工程已建立 | 无业务页面 |
| G11 | Employee entry | EXISTING | canonical/runtime `employee` build 成功 | Platform shell only |
| G12 | Center entry | EXISTING | canonical/runtime `center` build 成功 | Platform shell only |
| G13 | Tech entry / runtime alias | EXISTING | canonical `tech` → runtime/build `admin`；`admin.html`、`src/portals/admin/main.ts`、`dist/admin` | Vitest + CI 双层防回归 |
| G14 | pnpm lock | EXISTING | `pnpm-lock.yaml` 已提交，CI frozen install 通过 | 禁止漂移安装 |
| G15 | strict TypeScript | EXISTING | strict + noImplicitAny/noImplicitReturns/noUncheckedIndexedAccess 等通过 | 未使用 ts-ignore/skip 绕过 |
| G16 | Docker dev stack | EXISTING | PostgreSQL/Redis/MinIO/RabbitMQ Compose 实际启动与健康验证通过 | RabbitMQ 为当前环境唯一消息总线 |
| G17 | `.env.example` | EXISTING | 仅变量名与 `__SET_LOCAL_*__` 安全占位；技术端端口 `ADMIN_WEB_PORT` | `.env` 不入库 |
| G18 | Windows BAT | EXISTING | install/verify/start/stop 在 Windows runner 中文路径执行通过；技术端调用 `pnpm dev:admin` | 真实交互凭据启动未在 CI 执行 |
| G19 | Current exact-head CI | EXISTING | Remote head `08cb61f6...` 的 Phase 02 Build run `31166532746` 五个 job 全部 success | Gate 收尾 commit 后再次验证最终 head |
| G20 | Business runtime | EXISTING | 按阶段要求保持未实现；PHASE-02 标记业务 IMPLEMENTED 数=0 | 后续 PHASE 施工 |
| G21 | Message bus choice | EXISTING | 开发环境固定 RabbitMQ，不与 Kafka 并存 | 未来变更需 ADR |
| G22 | Runtime tests | EXISTING | Java smoke、Vue type/test/build、alias regression、Compose smoke、Windows Chinese-path smoke 均完成 | 业务 E2E/权限/幂等等为 N/A by scope |
| G23 | PHASE-01 source conflicts | CONFLICT | 2,164 vs 1,972 forms；265 vs 266 DDL tables；1,024 vs 1,019 DDL indexes；KB pointer 缺失 | 保留，不在 PHASE-02 擅自修正 |
| G24 | Previous Formal Gate FAIL-01～FAIL-04 | EXISTING | 四项均已定向修复，并在本次独立 recheck 中逐项 PASS | 已解除 PHASE-02 Gate blocker |
| G25 | Formal Phase Gate recheck | EXISTING | `PHASE GATE: PASS`；MASTER_PROGRESS 目标 `PHASE-02 = COMPLETE` | 本次不自动开始 PHASE-03 |

## Gate interpretation

PHASE-02 的工程骨架、构建系统与开发环境满足本阶段 Definition of Done；上次 Formal Gate 的四项 blocker 已全部修复并独立复验通过。本阶段可在最终 Gate 收尾提交 push 且最终 Remote HEAD CI 成功后记为 `COMPLETE`。PHASE-03 保持 `NOT_STARTED`，等待用户明确施工指令。
