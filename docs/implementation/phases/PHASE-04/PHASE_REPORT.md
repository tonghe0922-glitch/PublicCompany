# PHASE-04 CONSTRUCTION REPORT

## Status

# PHASE-04 = PASS / READY_FOR_GATE

> Phase: `PHASE-04｜Core IAM、组织、员工、任职、会话与权限内核`
> Scope/process_code: `PLATFORM/基础工程`
> Repository: `louthison/NEWSTART`
> Branch: `agent/full-build`
> Construction validation head: `5ec106e24697e3e61a0e9f588d4fc62048dd1631`
> PHASE-05: `NOT_STARTED`

本报告是施工侧最终报告，不替代独立 `PHASE_GATE.md`。Formal Gate 必须重新读取源码和规则、重新执行关键测试并 independently 判定 PASS/FAIL。

## 1. Requirement / Expected / Actual / Evidence / Result

| # | Requirement | Expected | Actual | Evidence | Result |
|---|---|---|---|---|---|
| 1 | Source contract | 当前 PHASE 重新读取权威资料 | 11/11 XLSX 重新解析，0 parse failure，真实员工行值未写入 evidence | `PHASE-04_SOURCE_CONTRACT.json`, `PHASE-04_IAM_SOURCE_FACTS.json` | PASS |
| 2 | Identity/Org directory | PostgreSQL 为权威身份/组织/任职事实源 | C2 JDBC directory + tenant RLS context；无平行内存事实源 | PG16 integration | PASS |
| 3 | Session | 短期安全会话可撤销、可轮换、身份绑定 | Redis digest-only access/refresh、TTL、rotation/replay protection、logout | IAM integration | PASS |
| 4 | Appointment switch | 切换后旧授权不可沿用 | 切换重新解析 active identity/appointment，新 session 替换旧 family | IAM/API integration | PASS |
| 5 | RBAC | deny-by-default | active user-role/role/permission facts；未知条件拒绝 | C4 checkpoint + IAM integration | PASS |
| 6 | ABAC/Data Scope | 跨员工/跨中心不得越权 | strict SELF/OWNER/CENTER/ORG/POSITION subset；unknown expression fail-closed | C4 checkpoint + IAM integration | PASS |
| 7 | Field P2/P3 | 服务端字段权限，不靠 UI 隐藏 | P2 可 mask；P3 需要 permission + Step-Up | IAM integration | PASS |
| 8 | PostgreSQL RLS context | 请求/事务身份上下文完整且不泄漏 | tenant/user/identity/employee/appointment/org/position 使用 transaction-local context | C4 integration | PASS |
| 9 | Step-Up | 短期、一次性、身份/目的绑定 | opaque ticket，Redis SHA-256 digest，一次性原子消费，expiry/replay/wrong-context 拒绝 | C5 checkpoint | PASS |
| 10 | MFA | 不发明 secret/OTP；未配置时 fail-closed | capability interface + fail-closed default provider | C5/C6 | PASS |
| 11 | HTTP authn | 未认证必须 401 | protected session request without token = 401 | C6 API integration | PASS |
| 12 | HTTP authz | 无权限/未定义 protected route 必须 403 | authenticated denied/undefined API = 403 | C6 API integration | PASS |
| 13 | API default deny | 非 public API 必须显式授权 | Spring Security final `/api/**` denyAll | `SecurityConfiguration` + CI grep | PASS |
| 14 | No default local user | 禁止生成默认密码/测试账号 | `UserDetailsServiceAutoConfiguration` excluded；无 demo bypass | API code + fake-completion gate | PASS |
| 15 | OpenAPI | 技术 HTTP 契约可追溯且不冒充来源 URL | 6 个 IAM/security endpoint 工程契约 + ADR source-boundary说明 | `contracts/phase-04/openapi.yaml`, ADR-002 | PASS |
| 16 | Audit | 关键安全行为必须不可变审计 | separate `sjg_audit` + `sjg_audit_writer`; operation/security event append | C6 integration | PASS |
| 17 | Audit secrecy | raw credentials 不得进审计 | integration query asserts raw access/refresh token hits = 0 | C6 integration | PASS |
| 18 | Audit immutability | runtime writer 不得 UPDATE/DELETE/TRUNCATE | DB role negative tests；C6 additionally asserts UPDATE denied | PG16/C6 integration | PASS |
| 19 | Fake completion | 无 TODO/FIXME/disabled test/browser-storage/demo/default password bypass | focused implementation scan PASS | Phase04 CI | PASS |
| 20 | Business boundary | 不冒充 P001/P002/P003完整流程 | 无新增 business UI；page/process catalogs unchanged | baseline diff | PASS |
| 21 | PHASE-05 boundary | 不提前实现 workflow runtime | workflow main implementation unchanged；MASTER PHASE-05 NOT_STARTED | baseline diff/master | PASS |
| 22 | Java regression | 编译/单测不退化 | API/Worker + dependency smoke PASS | Phase02/Phase03 independent regression | PASS |
| 23 | Vue/TS regression | 三端构建不退化 | frozen install/typecheck/Vitest/three portal build PASS | Phase02/Phase03 gate | PASS |
| 24 | PostgreSQL/Flyway | 数据库基础不得被 IAM 阶段破坏 | PG16/Flyway/RLS/roles independent suite PASS | run `31231985871` | PASS |
| 25 | Windows Chinese path | BAT 不得被新增容器测试污染 | integration lifecycle separated; Windows install/verify/migrate/start/stop PASS | runs `31231985875`, `31231985837`, `31231985842` | PASS |
| 26 | GitHub push | 当前施工 head 已 push | remote branch = `5ec106e...` at construction validation | GitHub branch API | PASS |
| 27 | Construction CI | PHASE-04 正常 workflow必须全绿 | run `31231985822`, 3/3 jobs success | GitHub Actions | PASS |

## 2. Closure checkpoints

- C1: focused source contract = closed; 11 source workbooks / 0 parse failure.
- C2: authoritative IAM/ORG directory = closed.
- C3: Redis session/refresh/logout/current appointment switching = closed.
- C4: RBAC + ABAC + RLS context + field P2/P3 = closed; checkpoint `C4_CHECKPOINT.md`.
- C5: Step-Up + MFA capability = closed; checkpoint `C5_CHECKPOINT.md`.
- C6: HTTP security + OpenAPI + immutable audit + regression = closed; checkpoint `C6_CHECKPOINT.md`.

## 3. Security path sampled

The current real integration suite exercises the platform-kernel equivalent of an end-to-end path:

```text
unauthenticated protected request -> 401
login -> session issued
current session -> 200
refresh -> old access revoked
Step-Up with no approved MFA provider -> 403 fail-closed
undefined protected API -> 403
identity/appointment switch -> new session
old switched session -> 401
new identity without required permission -> 403
logout -> token revoked -> 401
access expiry -> 401
valid refresh -> session recovered
critical operations/security events -> immutable audit database
```

This is the relevant PHASE-04 kernel closed loop. The generic business `发起→审批→执行→验收→回写→归档` path is **NOT_APPLICABLE_BY_SCOPE** because PHASE-04 deliberately does not implement a business workflow; PHASE-05 remains NOT_STARTED.

## 4. Repetition / concurrency / abnormal behavior

- refresh rotation and replay protection are atomic in Redis;
- Step-Up is one-time/expiry/context/purpose bound and atomically consumed;
- duplicate/replay access is denied rather than producing duplicate successful side effects;
- critical audit failure is fail-closed/compensated for session/Step-Up security operations;
- external provider timeout/retry/DLQ is NOT_APPLICABLE because no external production MFA/provider integration is introduced in this phase.

## 5. Three-portal fact consistency

No new Employee/Center/Tech business fact table or parallel browser fact source was introduced. The three portals remain views over the same server-side IAM/ORG/PostgreSQL facts. Full P001/P002/P003 pages remain for their owning business phases.

## 6. CI evidence on construction validation head

```text
Phase 02 Build                 31231985875  success  5/5
Phase 03 Database Baseline     31231985871  success  2/2
Phase 03 Runtime Identity      31231985842  success  2/2
Phase 03 Independent Gate      31231985837  success  5/5
Phase 04 IAM Kernel            31231985822  success  3/3
```

## 7. Known non-blocking scope items

1. Production MFA vendor/provider and secret material are intentionally not invented; default capability stays fail-closed.
2. Full P001/P002/P003 pages, permission-request approval workflow, notification/outbox and unified workflow runtime are outside PHASE-04.
3. Real employee workbook values remain excluded from committed test fixtures/evidence; tests use synthetic identities.
4. HTTP paths are an engineering ADR/OpenAPI decision because source materials did not define canonical URLs.

## 8. Construction verdict

```text
PHASE-04 = PASS / READY_FOR_GATE
PHASE-05 = NOT_STARTED
```

Only the independent Formal Phase Gate may promote PHASE-04 to `COMPLETE`.
