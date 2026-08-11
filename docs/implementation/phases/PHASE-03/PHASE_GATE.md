# PHASE-03 FORMAL PHASE GATE

## Verdict

# PHASE GATE: PASS

> Phase: `PHASE-03｜数据库三库、Schema、Flyway 与基础角色`
> Scope/process_code: `PLATFORM/基础工程`
> Repository: `louthison/NEWSTART`
> Branch: `agent/full-build`
> PHASE-02 Formal Gate baseline: `496e57801e5df849638d1f91e4423f251f9489d5`
> Construction final report commit: `793a868598c7848c39e93b1ab5b002cf8a1f61f5`
> Independent Gate validated commit: `dd81f7693a439e45d15099967fa69841d605af99`
> Independent Gate run: `31177913089` = `completed / success`

本文件是 PHASE-03 的独立正式验收结论，不直接采信施工 AI 的 `READY_FOR_GATE` 结论。验收重新读取了根 `AGENT.md`、`DESIGN.md`、PHASE-03 `IMPACT_MATRIX.md / GAP_MATRIX.md / PHASE_REPORT.md`、数据库 Knowledge Base 基线、主台账及当前实现，并重新执行独立 CI。

PHASE-03 的批准边界是**数据库基础设施**，明确不实现 P001–P126 业务页面、业务 HTTP API、领域状态机、审批闭环、业务 Outbox/Worker。因此这些业务层验证在本 Gate 中标记为 `NOT_APPLICABLE_BY_SCOPE`，而不是伪造 PASS。

---

## 1. Requirement / Expected / Actual / Evidence / Result

| # | Requirement | Expected | Actual | Evidence | Result |
|---|---|---|---|---|---|
| 1 | Repository | `louthison/NEWSTART` | Repository 与目标一致 | Independent Gate `GITHUB_REPOSITORY` assertion | PASS |
| 2 | Branch / push | 非默认施工分支，HEAD 已推送，无 force push | `agent/full-build` 连续 fast-forward；Draft PR #2 继续使用同一 head | GitHub branch / PR metadata | PASS |
| 3 | Previous phase | PHASE-02 必须 COMPLETE | PHASE-02 = COMPLETE；completed-stage regression 已 success | `MASTER_PROGRESS.md`; Phase 02 Build run `31173720739` | PASS |
| 4 | Canonical source integrity | PHASE-03 不得篡改 `AGENT.md / DESIGN.md / Knowledge Base` | 相对 PHASE-02 Formal Gate baseline无改动 | Independent Gate `git diff --quiet` | PASS |
| 5 | Scope boundary | 不提前实现 PHASE-04 或 P001–P126 业务层 | Gate 对 PHASE-02 baseline → PHASE-03 HEAD 的 changed paths 做 allowlist；无 Vue business page、Controller/Application/Domain/Repository 新实现 | Independent Gate scope step | PASS |
| 6 | Fake completion scan | 无 TODO/FIXME/mock/fake/browser-storage/disabled-test/临时账号等绕过 | 可执行/配置实现扫描无命中 | Independent Gate fake-completion step | PASS |
| 7 | Secret scan | Git 不得提交 token/secret/default production password | token pattern scan通过；`.env.example` 使用安全占位符；CI 密码运行时随机生成 | Independent Gate + runtime job | PASS |
| 8 | Core DB | 3 个 PostgreSQL 16 核心库 | `sjg_oms / sjg_audit / sjg_dw` | Testcontainers / migration runner | PASS |
| 9 | Physical Schema | 46 个物理 database+Schema | 空库迁移后实测 46 | `Phase03DatabaseBaselineTest` | PASS |
| 10 | Table baseline | 目录与批准 DDL 可解释且安装一致 | 当前确定性重算：catalog 265 = approved DDL unique tables 265；diff 0/0 | `DATABASE_BASELINE_REPORT.md` + Testcontainers | PASS |
| 11 | Index baseline | 目录 1,024 必须有来源化闭合 | approved DDL 1,019 + 5 个 index-catalog sourced audit overlays = 1,024；overlay 对象集合必须精确等于 catalog-only 5 项 | Independent database quality gate | PASS |
| 12 | Flyway formalization | 正式结构变更只能走 Flyway | generated Flyway + technical overlays；technical-platform 其它结构 SQL 被 CI 阻断 | Flyway-only structural SQL gate | PASS |
| 13 | Flyway provenance | KB 来源可追溯且生成确定 | `manifest.json` 保存 source path/source SHA-256/generated SHA-256；regeneration byte-stable | `phase03_flyway_compat.py --check` | PASS |
| 14 | V95 compatibility | 不静默篡改批准 seed，不发明生产 tenant | 仅允许 V95 psql tenant variable → Flyway deployment placeholder；其它 psql meta syntax令生成失败 | manifest + generator + quality gate | PASS |
| 15 | Tenant deployment facts | tenant id/code/name不得硬编码生产默认 | `sjg_tenant_id / code / name` 必须由部署环境提供 | `.env.example`, migrator, Testcontainers | PASS |
| 16 | Database owner | 正式对象 owner 不得是 runtime/bootstrap | 三库与业务表 owner = `sjg_owner`; `sjg_owner` = NOLOGIN | PostgreSQL integration | PASS |
| 17 | Migration identity | migration 不得使用 API/Worker 或超级用户身份 | `sjg_migration` 非 superuser/NOCREATEDB/NOCREATEROLE/NOBYPASSRLS，可受控 `SET ROLE sjg_owner` | `Phase03MigrationRoleTest` | PASS |
| 18 | API runtime identity | API 不得持有 DDL/Flyway 身份 | `sjg_api_runtime`; app Flyway disabled；Flyway dependency removed；CREATE TABLE 被 PostgreSQL拒绝 | independent runtime negative gate | PASS |
| 19 | Worker runtime identity | Worker 不得持有 DDL/Flyway 身份 | `sjg_worker_runtime`; app Flyway disabled；Flyway dependency removed；CREATE TABLE 被 PostgreSQL拒绝 | independent runtime negative gate | PASS |
| 20 | RLS coverage | 所有实际 tenant 表必须有 RLS/policy | 三库所有含 `tenant_id` base table均 `relrowsecurity=true` 且至少一条 policy；runtime roles NOBYPASSRLS | Testcontainers suite | PASS |
| 21 | Audit immutability | 应用审计写角色只可 append/read | `sjg_audit_writer` INSERT/SELECT PASS；UPDATE/DELETE/TRUNCATE 均真实拒绝；`sjg_auditor` SELECT-only | PostgreSQL negative tests | PASS |
| 22 | Migration idempotency | applied migration 不重复执行 | Flyway `validate()` PASS；第二次 migrate = 0 pending | Testcontainers + independent migrator | PASS |
| 23 | Checksum / version | 不得修改 applied migration、版本重复 | source/generated SHA gate + Flyway version uniqueness PASS | Independent quality gate | PASS |
| 24 | TypeScript / Vue / Build | 当前仓库基础工程不得被数据库阶段破坏 | frozen install、vue-tsc strict、Vitest、employee/center/admin build 全部重跑成功 | Independent Gate application-regression | PASS |
| 25 | Java Unit/Smoke | API/Worker + 依赖模块可编译测试 | Maven API/Worker dependency-tree tests重新成功 | Independent Gate application-regression | PASS |
| 26 | PostgreSQL Integration | 必须在真实 PostgreSQL 16 执行 | Testcontainers `postgres:16.14-alpine3.24` 全量迁移/权限/RLS测试 success | Independent Gate postgres job | PASS |
| 27 | Windows 中文路径 | BAT/路径不能只在 Linux成立 | install/verify/migrate/start/stop `--ci` 在 Windows 中文路径通过 | Independent Gate windows job | PASS |
| 28 | Business pages/API | PHASE-03 不得冒充业务完成 | 新增 IMPLEMENTED 业务页面/流程 = 0；业务集合保持 7,126/126 | ledger hash + scope gate | PASS |
| 29 | GitHub Actions | 当前验收 commit CI 必须成功 | Independent Gate run `31177913089` = success | GitHub Actions | PASS |
| 30 | PHASE-04 boundary | Formal Gate前后都不得自动施工下一阶段 | PHASE-04 保持 `NOT_STARTED` | `MASTER_PROGRESS.md` / report / gap | PASS |

---

## 2. 真实实现层检查

### Employee / Center / Tech / Router

`NOT_APPLICABLE_BY_SCOPE`：PHASE-03 明确无业务页面/Router改动。独立 scope gate确认相对 PHASE-02 baseline没有 `technical-platform/web/src/**` 业务实现变更。

### Permission / ABAC / Step-Up

业务 Permission/ABAC/Step-Up：`NOT_APPLICABLE_BY_SCOPE`。

PHASE-03 实际验收的是技术数据库权限：

- `sjg_owner` NOLOGIN；
- `sjg_migration` 非超级 migration identity；
- `sjg_api_runtime` / `sjg_worker_runtime` 独立 runtime；
- audit/dw writer/reader 最小权限；
- 所有正式 login role = NOBYPASSRLS。

### API / Controller / Application Service / Domain / Repository

业务 API、Controller、Application Service、Domain、Repository：`NOT_IMPLEMENTED_IN_PHASE_03 / NOT_APPLICABLE_BY_SCOPE`。

Gate 确认没有借 PHASE-03 提前创建这些业务实现。

### PostgreSQL / Flyway

实际实现并重跑验证：三库、46 Schema、265 tables、1,024 formal indexes、Flyway provenance、empty install、validate、second migrate=0、owner/migration/runtime role separation。

### Workflow / 状态历史

业务 Workflow runtime/状态历史：`NOT_APPLICABLE_BY_SCOPE`。数据库层仅安装批准表结构和 V95 126 workflow definition seed，不把 seed 当成运行时状态机完成。

### Audit

数据库级 Audit append-only contract实际验证；不是仅凭文档声明。

### Outbox / Notification / business Worker / Integration

业务 Outbox publisher/consumer、通知闭环、外部集成：`NOT_APPLICABLE_BY_SCOPE`。批准 DDL中的结构可以存在，但 PHASE-03未冒充这些 runtime 行为已经完成。

---

## 3. 假完成检查

独立 Gate 对 PHASE-03 可执行/配置实现重新扫描：

```text
TODO
FIXME
mock/fake API
localStorage/sessionStorage
empty catch
@Disabled
@ts-ignore/@ts-nocheck
临时账号
测试验证码
默认密码
临时演示入口
secret/token patterns
```

结果：**PASS**。

同时检查：

- 无静态页面冒充业务完成；
- 无假 API / 假成功；
- 无前端自改业务状态；
- 无内存业务事实源；
- 无技术管理员业务越权；
- 无隐藏按钮替代服务端权限。

原因不是这些业务行为“测试通过”，而是 PHASE-03没有实现这些业务能力且 scope gate确认没有越界代码。

---

## 4. 重新执行关键测试

Formal Gate独立执行，而非仅查看 `PHASE_REPORT`：

```text
Workflow: Phase 03 Independent Gate
Run: 31177913089
Head: dd81f7693a439e45d15099967fa69841d605af99
Conclusion: success
```

五个独立 job：

1. `Independent source boundary and fake-completion gate` — PASS；
2. `Java Vue TypeScript build and unit regression` — PASS；
3. `Independent PostgreSQL 16 Flyway RLS audit role integration` — PASS；
4. `Independent bootstrap migration API Worker negative gate` — PASS；
5. `Independent Windows Chinese-path scripts gate` — PASS。

### 第一轮 Gate 透明记录

Run `31177735523` 曾失败于**Gate 验收器自身**：它用 `assert 'PENDING' not in ...` 扫描 validation 文本，从而误把合法的 `PHASE-04_NOT_STARTED_PENDING_FORMAL_GATE` / “No PENDING placeholder”说明当成失败。此前来源边界、假完成、Flyway确定性步骤已经通过。

修复仅修改验收器，使其只拒绝真正的占位值 `PENDING_AT_COMMIT_CREATION`；项目实现/数据库/台账未为迎合 Gate 而修改。修复 commit `dd81f769...` 的完整独立 Gate随后 success。

---

## 5. 抽查路径

### 正常技术闭环

```text
空 PostgreSQL 16
→ bootstrap cluster roles
→ 创建/规范化三核心数据库 owner
→ sjg_migration 执行 Flyway
→ migrate
→ validate
→ 第二次 migrate = 0
→ API/Worker runtime 独立登录
→ 服务端数据库权限生效
```

结果：PASS。

### 权限负向

实际抽查：

- `sjg_api_runtime` CREATE TABLE → DENIED；
- `sjg_worker_runtime` CREATE TABLE → DENIED；
- `sjg_audit_writer` UPDATE → DENIED；
- DELETE → DENIED；
- TRUNCATE → DENIED；
- API runtime无 Audit/DW CONNECT；
- formal login roles无 superuser/CreateDB/CreateRole/Replication/BYPASSRLS。

结果：PASS。

### 重复/幂等

- Flyway second migrate = 0；
- deterministic generator/report/ledger re-run = no diff。

结果：PASS。

### 并发

业务 optimistic-lock/重复点击/旧 version：`NOT_APPLICABLE_BY_SCOPE`。PHASE-03不暴露业务写 API；正式 DB migration要求单一 migration runner串行执行。

### 异常/补偿

业务 timeout/retry/DLQ/compensation：`NOT_APPLICABLE_BY_SCOPE`，本阶段不实现异步业务/外部系统调用。

---

## 6. 三端事实一致性

本阶段没有创建业务事实，因此没有可抽查的新 `business_id / business_no / process_instance_id`。

Gate验证的是：PHASE-03没有创建三端各自业务表/事实源，且 7,126 页面 / 126 process业务集合未被改写。因此三端事实一致性要求在本阶段没有被破坏；具体业务事实共享将在相应业务 PHASE中验收。

结果：`PASS_BY_SCOPE / NO_NEW_BUSINESS_FACTS`。

---

## 7. Known non-blocking items

1. 除批准 V95 SQL seed 外，其余初始化 CSV 没有被擅自转成 SQL；由拥有相应主数据/业务初始化职责的后续阶段施工。
2. 生产 `sjg_tenant_id / code / name` 必须由部署事实提供，Git无生产默认值。
3. 数据库 role password必须由部署/Secret Manager提供，Git无默认密码。
4. 当前工具环境没有本地 `gh` checkout；按用户已授权方案使用 GitHub Connector执行等价 fetch/commit/push/CI，并如实记录。
5. PHASE-04仍为 `NOT_STARTED`。

这些不违反 PHASE-03 的数据库基础 DoD，因此不构成 Gate blocker。

---

## 8. Formal conclusion

```text
PHASE GATE: PASS

Repository: louthison/NEWSTART
Branch: agent/full-build
Independent Gate Commit: dd81f7693a439e45d15099967fa69841d605af99
Independent Gate Run: 31177913089
Tests: PASS
CI: PASS
PHASE-04: NOT_STARTED
```

根据 Formal Gate 协议，`MASTER_PROGRESS` 中 PHASE-03 应更新为 `COMPLETE`。

**可以进入下一阶段，但本次不会自动开始 PHASE-04。**

本报告所在最终 commit 仍必须由 `.github/workflows/phase03-gate.yml` 在 exact HEAD 上再次验证；只有最终报告 commit 的 Gate workflow也为 success，才对外确认最终 PASS。
