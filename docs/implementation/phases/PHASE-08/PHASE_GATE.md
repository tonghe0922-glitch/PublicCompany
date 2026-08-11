# PHASE-08 正式阶段验收（PHASE_GATE）— Independent Recheck

> Repository: `louthison/PublicCompany`
> Branch: `ChatGPT_Version_V0.07`
> Recheck Candidate: `48c3b822ed23f20565e331f3590a5209574f865e`
> Gate Date: `2026-08-09`
> Verdict: **PHASE GATE: PASS**
> Next Phase: `PHASE-09 = NOT_STARTED`（本次不自动施工）

---

## 1. 验收原则

本次是对首次 Gate FAIL 修复后的独立重新验收，不直接采信施工阶段的 `READY_FOR_RECHECK`。重新读取 `AGENT.md`、`DESIGN.md`、PHASE-08 当前 Source Contract/IA 证据/实现/报告/主台账，并对 exact candidate `48c3b822...` 重新执行 GitHub Actions 关键链路。

本地验收沙箱无法通过 DNS 访问 `github.com` 完成新的 clone/fetch，因此没有虚构本地 `git fetch/status/ls-remote` 结果；远端 ref/commit/PR 由已授权 GitHub App 直接核验，实际构建与测试由 GitHub Actions runner 在精确候选 SHA 上 checkout 后执行。

---

## 2. 首次 Gate FAIL 历史

首次正式 Gate 对 candidate `16171f3294aa03306618bc8e1207feb0683e482e` 判定 `FAIL`，报告提交为 `9ac0573c532f8602677eb2422273e855b0b20e6c`。

失败项：

1. `GATE-F08-001`：三端共用 protected home 将前端硬编码 PHASE-05/P016–P020 工程/流程常量、数据库表名、API base 和固定“已关闭”作为运行态内容；
2. `GATE-F08-002`：PHASE-08 README 仍写准备期 `NOT_STARTED`，与主账冲突；
3. `GATE-F08-003`：PHASE_REPORT/TEST_EVIDENCE 未披露上述 Gate 缺口。

本次重新验收没有删除该失败历史，而逐项验证修复是否真实关闭。

---

## 3. Requirement Matrix

| Requirement | Expected | Actual | Evidence | Result |
|---|---|---|---|---|
| Repository / branch / remote candidate | 唯一仓库、非默认施工分支、候选已 push | `louthison/PublicCompany` / `ChatGPT_Version_V0.07` / `48c3b822...` | GitHub remote ref + PR #2 | PASS |
| PHASE-09 边界 | 验收期间不得施工 P001–P005 | `PHASE-09 = NOT_STARTED` | MASTER_PROGRESS + source gate | PASS |
| 三端唯一体系 | employee / center / tech；tech runtime alias=admin；无第四端 | 符合 | portal config + 404 browser regression | PASS |
| 三端职责差异 | employee/center/tech 工作目标不同 | 分别为 `员工工作入口 / 中心管理工作入口 / 技术运行工作入口` | portal-config + live E2E | PASS |
| Protected-home 事实源 | 不得用静态工程常量冒充业务运行状态 | PlatformShell 已断开 PHASE05_PROCESSES；无 P-code/DB/API/fixed closed-state 内容 | source negative gate + live negative assertions | PASS |
| 普通员工工程信息暴露 | 不展示内部工程 P0/P1/DB/API 诊断 | real-backend employee home 负向断言通过 | Playwright live | PASS |
| 无假业务 read model | 无真实 todo/search/messages/KPI API 时不造数据 | 继续安全省略 | PlatformShell / GAP | PASS |
| Unified API Client | Bearer/problem/timeout/cancel/401/403/idempotency/stale response | 已实现并回归 | C1 + recheck static tests | PASS |
| Session | login/restore/refresh rotation/single-flight/logout/switch | 已实现并真实联调 | C2 + live browser | PASS |
| Credential policy | access memory-only；refresh current-tab sessionStorage；无 token localStorage | 符合批准 ADR | source/unit/live negative | PASS |
| Router | login/protected/forbidden/not-found/intended redirect/cancel/error boundary | 已实现 | C3 tests | PASS |
| Navigation | implemented + real route + permission + mobile_access 才激活 | 已实现 fail-closed | C4 tests | PASS |
| Mobile BottomNav / More | overflow 不绕权限/mobile filter | 已实现 | navigation tests | PASS |
| 服务端权限最终权威 | 前端 UX 过滤不能替代后端授权 | 无权限 identity switch 真实 HTTP 403 | live E2E | PASS |
| TypeScript / ESLint | 严格通过 | PASS | independent static job | PASS |
| Unit / component | 当前组件/运行壳回归全部通过 | 14 files / 67 tests PASS | independent static job | PASS |
| Duplication / dead code | jscpd/knip PASS | 1.09% duplicated lines；knip PASS | independent static job | PASS |
| Three portal build | employee / center / admin | PASS | independent static job | PASS |
| Static browser E2E | desktop/mobile smoke | 16 PASS | independent static job | PASS |
| PostgreSQL16 + Redis7.4 IAM | 真实 Testcontainers regression | PASS | independent backend job | PASS |
| Live Browser → Vite → Spring → DB/Redis | 真实 session/security 链 | 7 PASS / 1 intentional duplicate skip | independent live job | PASS |
| Refresh / switch / logout negatives | old token 401；unauthorized switch 403；logout revoke | PASS | live E2E | PASS |
| Audit | 不只验证 HTTP 200 | actions=22 / switch=1 / denied=1 | audit DB query | PASS |
| Credential redaction | synthetic password 不进入 audit | credential_hits=0 | audit DB query | PASS |
| Flyway / DB schema | 本阶段无新增 migration；现有 migration 可真实启动 | NO_CHANGE / fixture PASS | C0/backend/live | PASS |
| Workflow / Outbox / Worker | 本阶段不新增业务闭环副作用 | N/A，未虚构 PASS | source/report | PASS |
| README / report / evidence consistency | 当前阶段事实一致 | 修复后全部明确首次 FAIL、修复与 recheck | README/GAP/REPORT/EVIDENCE | PASS |
| GitHub Actions | 当前 candidate CI 必须成功 | `31290849170` run_attempt=2 SUCCESS | GitHub Actions | PASS |

---

## 4. 独立重新执行的测试

Exact candidate: `48c3b822ed23f20565e331f3590a5209574f865e`。

```text
Workflow: 31290849170
Independent rerun attempt: 2
Result: SUCCESS

Source / scope / fact-source job: 93188250798 PASS
Static / unit / build / browser job: 93188251034 PASS
PostgreSQL16 + Redis7.4 IAM job: 93188261679 PASS
Live Browser / Spring / PostgreSQL / Redis / Audit job: 93188251216 PASS
Final C7 verdict: 93188269628 PASS
```

Static recheck:

```text
vue-tsc / tsc = PASS
ESLint = PASS
Vitest = 14 files / 67 tests PASS
jscpd = PASS / duplicated lines 1.09%
knip = PASS
employee build = PASS
center build = PASS
admin build = PASS
artifact scan = PASS
static Playwright = 16 PASS
```

Live recheck:

```text
employee/center/admin real login = PASS
refresh rotation = PASS
old access after refresh = HTTP 401 PASS
identity switch = PASS
old access after switch = HTTP 401 PASS
unauthorized switch = HTTP 403 PASS
logout revoke = PASS
live Playwright = 7 PASS / 1 intentional duplicate mobile skip
audit actions = 22
SESSION_SWITCH = 1
AUTHORIZATION_DENIED = 1
credential_hits = 0
```

---

## 5. 上次失败项重新裁决

### GATE-F08-001 — PASS

根因已关闭：正式 `PlatformShell` 不再引用 `PHASE05_PROCESSES`，三端首页不展示 PHASE-05/P016–P020、数据库表、API base 或固定“已关闭”。三端分别展示来源化的职责标题，并且没有真实 read model 的业务数据继续不展示。

为防回归，source contract 和 real-backend Playwright 均新增负向断言。

### GATE-F08-002 — PASS

README 已从准备期状态改为 Gate 修复/复验状态，与 MASTER_PROGRESS、GAP、REPORT 一致。

### GATE-F08-003 — PASS

PHASE_REPORT、TEST_EVIDENCE、GAP_MATRIX 均记录首次 Gate FAIL、根因、修复内容与独立 recheck；不再宣称没有发生过缺口。

---

## 6. 非阻断风险

以下不构成 PHASE-08 Gate FAIL，但保留给后续阶段：

- Vite 仍有单 bundle >500 kB 的性能提示；性能/拆包专项留给后续性能与部署阶段；
- GitHub Actions 提示部分第三方 Action Node20 runtime 被平台强制到 Node24；当前执行成功，后续可升级 Action major；
- Spring 测试存在 `@MockBean` deprecation warning；当前测试通过，后续升级 Spring 测试 API 时处理；
- todo/search/messages 没有批准的真实 API contract，继续保持不展示，不能用 mock 填充。

---

## 7. Final Verdict

```text
PHASE GATE: PASS

Repository: louthison/PublicCompany
Branch: ChatGPT_Version_V0.07
Accepted implementation candidate: 48c3b822ed23f20565e331f3590a5209574f865e
Tests: PASS
CI: PASS
PHASE-08: COMPLETE
PHASE-09: NOT_STARTED
```

PHASE-08 可以进入完成态；下一阶段只有在新的明确施工指令下才能开始，本次 Gate 不自动施工 PHASE-09。
