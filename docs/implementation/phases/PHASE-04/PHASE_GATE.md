# PHASE-04 FORMAL PHASE GATE

## Verdict

# PHASE GATE: PASS

> Phase: `PHASE-04｜Core IAM、组织、员工、任职、会话与权限内核`
> Scope/process_code: `PLATFORM/基础工程`
> Repository: `louthison/NEWSTART`
> Branch: `agent/full-build`
> Construction validation head: `5ec106e24697e3e61a0e9f588d4fc62048dd1631`
> Formal Gate candidate: `534b27d316e190bb15a869c983d39e2714b47808`
> Independent Gate run: `31232531587` = `completed / success`
> Next phase: `PHASE-05 = NOT_STARTED`

本文件由独立技术验收视角生成，不直接采信施工侧 `PHASE_REPORT.md` 的完成声明。验收重新检查了当前 GitHub 分支、阶段规则、来源资料、实现边界、假完成风险、服务端权限、数据库/RLS、Redis 会话与 Step-Up、Spring Security HTTP 边界、不可变审计、跨阶段回归以及 Windows 中文路径脚本，并通过独立 GitHub Actions 重新执行关键测试。

本报告所在 closeout commit 仍必须再次通过适用的 GitHub Actions，尤其是 `.github/workflows/phase04-gate.yml`。如果 closeout commit 的独立 Gate 失败，则本 PASS 自动失效并按 FAIL 处理。

---

## 1. Requirement / Expected / Actual / Evidence / Result

| # | Requirement | Expected | Actual | Evidence | Result |
|---|---|---|---|---|---|
| 1 | Repository | `louthison/NEWSTART` | 仓库一致 | GitHub repository / workflow context | PASS |
| 2 | Construction branch | 非默认施工分支 | `agent/full-build` | GitHub branch / Draft PR #2 | PASS |
| 3 | Previous phase | PHASE-03 必须 COMPLETE | PHASE-03 = COMPLETE | `MASTER_PROGRESS.md`; Phase03 Gate regression | PASS |
| 4 | Canonical source integrity | 不得改写 `AGENT.md / DESIGN.md / Knowledge Base` | 相对 PHASE-03 complete baseline无改动 | Independent Gate `git diff --quiet` | PASS |
| 5 | Current-stage source reparse | 必须重新读取当前阶段来源 | 11/11 XLSX，0 parse failure | `PHASE-04_SOURCE_CONTRACT.json`; source scripts `--check` | PASS |
| 6 | Real employee privacy | 不得复制真实 P2/P3 行值到测试/evidence | 真实员工行值未提交 | source evidence privacy assertions | PASS |
| 7 | Phase scope | 只做 IAM/ORG/session/permission kernel | 未新增完整 P001/P002/P003 业务页面/流程 | baseline diff / matrices | PASS |
| 8 | C1–C6 closure | 六个 closure 必须闭合 | C1–C6 全部 CLOSED | checkpoints + `PHASE_REPORT.md` | PASS |
| 9 | Identity/Org truth | PostgreSQL 为权威身份/组织/任职事实源 | JDBC + PostgreSQL RLS；无浏览器/内存平行事实源 | IAM/ORG integration | PASS |
| 10 | Password handling | 不得明文/默认密码 | BCrypt 校验权威 `password_hash`；无默认测试密码 | API/IAM code + scan | PASS |
| 11 | Session | token需可撤销、可轮换、短期 | Redis 保存 digest + TTL；access/refresh rotation/replay protection | IAM integration | PASS |
| 12 | Appointment switch | 切换后旧会话/旧授权不可沿用 | 目标 identity/appointment 重新解析，旧 family 撤销 | IAM/API integration | PASS |
| 13 | RBAC | deny-by-default | 由 active role/permission facts 决策；未知条件拒绝 | C4 + IAM integration | PASS |
| 14 | ABAC/Data Scope | 跨员工/跨中心必须拒绝 | SELF/OWNER/CENTER/ORG/POSITION 来源化 subset；未知 expr fail-closed | C4 integration | PASS |
| 15 | Field P2/P3 | 服务端字段保护 | P2 mask；P3 需要 permission + Step-Up | C4 integration | PASS |
| 16 | RLS context | 完整身份上下文必须进入事务且不泄漏 | tenant/user/identity/employee/appointment/org/position transaction-local context | PostgreSQL integration | PASS |
| 17 | Step-Up | 短期、一次性、身份/目的绑定 | opaque ticket；Redis SHA-256 digest；原子一次消费；replay/expiry/wrong-context拒绝 | C5 integration | PASS |
| 18 | MFA capability | 不得发明 secret/OTP | capability interface；未配置 approved provider 时 fail-closed | C5/C6 | PASS |
| 19 | HTTP unauthenticated | protected API 无凭据必须 401 | `/api/v1/session` 无 access token = 401 | C6 API integration | PASS |
| 20 | HTTP unauthorized | 无权限必须 403 | switched identity / undefined protected API = 403 | C6 API integration | PASS |
| 21 | HTTP default deny | 非 public `/api/**` 不得隐式放行 | final `/api/**` = `denyAll()` | static contract + runtime | PASS |
| 22 | No generated default user | 禁止 Spring 默认账号/密码 | `UserDetailsServiceAutoConfiguration` excluded | source/static Gate | PASS |
| 23 | OpenAPI | HTTP 契约必须可追溯 | 6 个 security/session endpoints 已写 OpenAPI | `contracts/phase-04/openapi.yaml` | PASS |
| 24 | HTTP source boundary | 工程 URL 不得冒充 KB 原始 URL | ADR 明确 HTTP path 属工程契约 | ADR-002 / OpenAPI | PASS |
| 25 | Audit persistence | 关键安全行为必须写不可变审计 | separate `sjg_audit` + `sjg_audit_writer` append | C6 integration | PASS |
| 26 | Audit secrecy | raw access/refresh ticket不得入审计 | raw token query hits = 0 | C6 integration | PASS |
| 27 | Audit immutability | runtime writer不得 UPDATE/DELETE/TRUNCATE | PostgreSQL negative tests + C6 UPDATE denied | Phase03/C6 integration | PASS |
| 28 | Fake completion | 禁止 TODO/FIXME/disabled test/browser storage/demo/default password等绕过 | focused implementation scan无阻断命中 | Independent Gate preflight | PASS |
| 29 | Java regression | Java 21 build/unit/smoke必须通过 | API/Worker + dependencies success | Gate application-regression | PASS |
| 30 | Vue/TS regression | strict typecheck/Vitest/three portal build必须通过 | frozen install/typecheck/test/build success | Gate application-regression | PASS |
| 31 | PostgreSQL/Flyway regression | PG16/Flyway/RLS/roles不得退化 | database baseline profile success | Gate security-runtime | PASS |
| 32 | Redis/IAM integration | session/RBAC/ABAC/field/Step-Up必须真实执行 | PG16 + Redis7.4 suite success | Gate security-runtime | PASS |
| 33 | C6 HTTP/Audit integration | Spring Security + audit必须真实执行 | C6 integration success | Gate security-runtime | PASS |
| 34 | Windows Chinese path | install/verify/migrate/start/stop必须通过 | Windows runner 中文路径 success | Gate windows-regression | PASS |
| 35 | Repetition/concurrency | refresh/Step-Up replay不得重复成功 | Lua rotation / one-time consume atomic；replay denied | IAM integration | PASS |
| 36 | Abnormal/security compensation | 安全关键失败必须 fail-closed | audit unavailable / invalid identity / unknown rule / absent MFA provider 均拒绝 | C4/C5/C6 tests | PASS |
| 37 | Three-portal fact consistency | employee/center/tech不得三套业务事实 | 本阶段未新增 portal-local business fact；共享 server-side IAM/ORG facts | baseline diff + architecture | PASS |
| 38 | Business workflow boundary | 不得把本阶段冒充完整审批闭环 | 通用 `发起→审批→执行→验收→回写→归档` 为 NOT_APPLICABLE_BY_SCOPE | scope/matrices | PASS |
| 39 | PHASE-05 boundary | 不提前施工下一阶段 | workflow main runtime未因 PHASE-04 新增；PHASE-05 NOT_STARTED | baseline diff / master ledger | PASS |
| 40 | GitHub Actions | 当前正式候选 Gate 必须全绿 | Independent Gate 5/5 success | run `31232531587` | PASS |

---

## 2. 真实实现层检查

| Layer | Formal PHASE-04 expectation | Actual | Result |
|---|---|---|---|
| Employee / Center / Tech 页面 | 不实现完整 P001/P002/P003 业务 UI | `technical-platform/web/src` 相对 PHASE-03 complete baseline无本阶段业务实现变化 | PASS_BY_SCOPE |
| Router | 不用前端隐藏替代权限 | 本阶段无业务 route 扩张；服务端 Spring Security 为权威边界 | PASS |
| Permission | 服务端 RBAC + deny-by-default | 已实现并真实测试 | PASS |
| Data Scope / ABAC | 服务端 scope evaluator + fail-closed unknown | 已实现并真实测试 | PASS |
| Sensitive field | P2/P3 服务层保护 | field decision / mask / Step-Up 已实现 | PASS |
| API | 401/403/default deny + OpenAPI | 已实现 | PASS |
| Controller/Application | 仅 IAM/security kernel endpoints | 已实现且不扩张为完整 P001/P002/P003 流程 | PASS |
| Domain | Session/authorization/Step-Up security domain | 已实现 | PASS |
| Repository | PostgreSQL/Redis adapters | 已实现，PostgreSQL为权威业务身份事实源 | PASS |
| PostgreSQL | PG16/RLS/runtime identity | 已重跑 | PASS |
| Flyway | app runtime不拥有 migration身份 | DB baseline及 Phase03 Gate回归通过 | PASS |
| Workflow | PHASE-05 才实现统一 workflow runtime | 本阶段未提前实现 | NOT_APPLICABLE_BY_SCOPE |
| Audit | append-only application audit | 已实现并验证 | PASS |
| Outbox/Notification business flow | 本阶段不要求 | 未冒充实现 | NOT_APPLICABLE_BY_SCOPE |
| Worker business handlers | 本阶段不要求 | 未提前实现 | NOT_APPLICABLE_BY_SCOPE |
| Integration | PostgreSQL/Redis/Spring Security/Audit | 已真实集成测试 | PASS |

---

## 3. 假完成检查

独立 Gate 对真实 `src/main` 实现重新扫描并检查：

```text
TODO / FIXME
@Disabled / @Ignore
@ts-ignore / @ts-nocheck
localStorage / sessionStorage
empty catch
默认密码 / 测试验证码 / 临时演示入口
permitAll all-api shortcut
GitHub/OpenAI token patterns
```

结果：**PASS**。

同时结合源码和运行测试确认：

- 无静态页面冒充业务完成；
- 无假 API / 假成功；
- 无前端自己修改权威业务状态；
- 无浏览器或内存业务事实源；
- 无“技术管理员=业务超级管理员”绕过；
- 无隐藏按钮代替服务端权限；
- 未通过删除测试、`@Disabled`、宽松断言或默认账号来获得绿灯。

---

## 4. 独立重新执行关键测试

Formal Gate不是只读取施工报告，实际重新执行：

```text
Workflow: Phase 04 Independent Gate
Run: 31232531587
Head: 534b27d316e190bb15a869c983d39e2714b47808
Conclusion: success
```

独立 jobs：

1. `Independent source scope security and fake-completion gate` — PASS；
2. `Java Vue TypeScript build and unit regression` — PASS；
3. `PostgreSQL Redis Spring Security and immutable audit independent integration` — PASS；
4. `Windows Chinese-path completed-stage script regression` — PASS；
5. `PHASE-04 formal gate verdict` — PASS。

同一 Formal Gate candidate 的常规/前序回归：

```text
Phase 04 Source Contract       31232531574  success
Phase 02 Build                 31232531585  success
Phase 03 Database Baseline     31232531572  success
Phase 03 Independent Gate      31232531579  success
Phase 04 IAM Kernel            31232531577  success
Phase 04 Independent Gate      31232531587  success
```

PHASE-03 Runtime identity 在施工最终 head `5ec106e...` 的 run `31231985842` 已 success；Formal Gate 又通过 Phase03 Independent Gate 与 PG/Flyway security runtime重新覆盖关键数据库身份/RLS边界。

---

## 5. 路径抽查

### 5.1 PHASE-04 内核正常闭环

```text
login
→ authoritative identity/appointment resolve
→ Redis session issue
→ protected session access
→ refresh rotation / old access revoke
→ identity/appointment switch
→ permission + data-scope recompute
→ protected action allow/deny
→ logout / expiry
→ immutable audit persistence
```

结果：PASS。

### 5.2 权限负向

实际验证包括：

- 未认证访问 protected API → 401；
- 错误 credential → 401；
- 无权限/未定义 protected API → 403；
- 跨 employee / center scope → deny；
- identity switch 后旧 access/session → 401；
- 新 identity 缺 required permission → 403；
- unknown ABAC condition → fail-closed；
- 未配置生产 MFA provider 时 Step-Up → fail-closed。

结果：PASS。

### 5.3 重复 / 并发

- refresh rotation 使用 Redis 原子操作；旧 access / replay marker阻止旧凭据重复成功；
- Step-Up ticket一次性原子消费，replay/expiry/wrong-context/wrong-purpose拒绝；
- 重复安全操作不会生成第二个成功的权威状态跃迁。

结果：PASS。

### 5.4 异常 / 补偿

- 关键 audit persistence失败时 session/Step-Up security operation fail-closed，并在适用处撤销已创建临时安全状态；
- PostgreSQL/Redis/identity/MFA capability不可用或事实不合法时不返回假成功；
- 本阶段未接入外部生产 MFA vendor，因此外部 webhook timeout/retry/DLQ 为 `NOT_APPLICABLE_BY_SCOPE`，不得伪造 PASS。

---

## 6. 三端事实一致性

PHASE-04没有建立 Employee / Center / Tech 三套独立业务事实。

共同事实来源：

- PostgreSQL IAM/ORG/employee/appointment/permission tables；
- Redis 仅保存可重建的短期安全会话/Step-Up状态，不是业务主事实；
- 浏览器 `localStorage/sessionStorage` 不承载权威业务事实；
- 本阶段没有新增完整业务 process，因此没有伪造新的 `business_id / business_no / process_instance_id`。

结果：**PASS / NO_PARALLEL_BUSINESS_FACT_SOURCE**。

---

## 7. GitHub 与验收器透明记录

Formal Gate candidate `534b27d...` 已 push，PR #2保持 `open / draft / not merged`。

在 candidate 提交后，历史 `Phase 01 Independent Gate` 首次出现失败，但根因不是 PHASE-04 产品实现：旧 Gate 用 PHASE-00 baseline直接比较“当前 HEAD 是否出现 Java/Vue/Flyway”，因此把 PHASE-02～04 的合法后续实现误判为 PHASE-01 scope creep。

验收器修复遵循冻结历史阶段语义：

- `7845c466e1ea2c0cab024f8daa8c116a5d1029ea`：冻结 PHASE-01 scope 到其最后成功 Gate head `a28fb2f17ffc95317299d083930a94374e2e9faf`；
- run `31232669697` 证明 frozen scope、source immutability、fake-completion scan、parser compile、全量 KB reparse、机器不变量均通过，但旧 full-file `cmp` 仍把后续阶段追加的 top-level metadata判成失败；
- `5430003f958af285f363c10bd03166bc4106d180`：进一步在 frozen PHASE-01 snapshot 上执行完整 parser determinism，同时当前 HEAD仅比较 PHASE-01-owned page/process/mapping collections与 phase-01 contracts，不允许其业务集合漂移，也不阻止后续阶段追加有来源的顶层 metadata。

这些修改只修验收器生命周期语义，没有删除测试、跳过 parser、修改 Knowledge Base、修改 PHASE-04 产品实现或放宽 PHASE-04 Formal Gate。

本 `PHASE_GATE.md` 的 closeout commit 必须再次通过适用 workflow；最终 remote SHA 与 exact-commit Actions 由 GitHub branch/run evidence确认。

---

## 8. 非阻断的范围边界

1. Production MFA vendor/provider 与 secret material没有来源，本阶段故意不发明；default provider保持 fail-closed。
2. 完整 P001/P002/P003 页面、权限申请审批流程、统一 Workflow runtime、业务 Outbox/Notification由后续所属阶段实现。
3. 真实员工 P2/P3 行值不会为了测试便利写入 Git fixture。
4. HTTP paths是工程 ADR/OpenAPI契约，不声称来自 Knowledge Base canonical HTTP URL。

以上均是明确 scope boundary，不是缺陷，也不能通过伪造实现消除。

---

## 9. 最终结论

```text
PHASE GATE: PASS

Repository: louthison/NEWSTART
Branch: agent/full-build
Validated Gate Candidate: 534b27d316e190bb15a869c983d39e2714b47808
Independent Gate Run: 31232531587 = success
MASTER_PROGRESS: PHASE-04 = COMPLETE
PHASE-05: NOT_STARTED
```

**PHASE-04 可以进入下一阶段，但本次验收不自动开始 PHASE-05。**
