# PHASE-07 TEST_EVIDENCE — Cycle 3 Final

> Branch: `ChatGPT_Version_V0.07`
> Tested implementation anchor: `4d2cf205685e6806bb0a7bd5bdb542586afafd5a`
> READY_FOR_GATE candidate: `4797a70bc3d7e542fc2eed0ce32de974b2f67030`
> Construction: `31268081850 = PASS`
> Independent Formal Gate: `31268591057 = PASS`
> Status: `COMPLETE / FORMAL_GATE_PASS`

## 1. 测试原则

本阶段不再把“源码字符串存在”当成组件行为完成证据。最终证据由五层组成：

1. source/scope/safety contract；
2. strict TypeScript；
3. Vue runtime + Vue Test Utils DOM component tests；
4. 三端真实 Vite build + artifact scan；
5. Playwright desktop/mobile browser smoke。

## 2. Unit / component runtime evidence

最终 `pnpm test`：**32/32 PASS**。

覆盖：

- Button loading/disabled/click；
- form label-for / aria-describedby / aria-invalid / v-model；
- Dialog/Drawer initial focus / Tab / Shift+Tab / Escape / focus restore；
- Toast live region；
- Error safe metadata；
- MaskedValue / StepUpReveal fail-closed negative behavior；
- PortalShell slots/skip-link；
- 六类 page template mount/render；
- 新增完整表单与共享组件的类型/渲染回归。

`component-vtu.test.ts` 使用 `@vue/test-utils` + happy-dom 对真实 DOM 做交互断言，不是 `?raw` 字符串检查。

## 3. Strict typecheck

```text
pnpm typecheck = PASS
vue-tsc --noEmit -p tsconfig.app.json = PASS
tsc --noEmit -p tsconfig.node.json = PASS
```

Playwright config/e2e 已纳入 node TS project，避免 typed lint / build 工具看到“项目外文件”。

## 4. Static quality

```text
pnpm lint = PASS
complexity <= 10 = PASS
max-depth <= 3 = PASS
pnpm quality:duplicates = PASS
jscpd duplicated lines = 1.67% (< 8%)
pnpm quality:deadcode = PASS
circular dependency scan = PASS
```

关键修复：construction workflow 使用 `set -euo pipefail`，因此 `pnpm lint | tee`、jscpd、knip 的真实失败不能被 `tee` 返回码掩盖。

## 5. Three-portal build + artifact evidence

```text
pnpm build = PASS
build:employee = PASS
build:center = PASS
build:admin = PASS
```

实际产物：

```text
dist/employee/employee.html
dist/center/center.html
dist/admin/admin.html
```

`pnpm quality:artifacts = PASS`：扫描 source map、常见 secret/token、测试凭据与必需入口；结果与 dist 作为 CI artifact 上传。

## 6. Browser evidence

Playwright：**8/8 PASS**，desktop + mobile。

验证三端正式构建均渲染共享 `.sgj-portal-shell`，并验证 skip-link 能到达共享 main content。首次浏览器运行曾真实发现 hash Router 与 `#sgj-main-content` 冲突，修复后重跑通过。

## 7. Construction run

`31268081850` 最终：

```text
PHASE-07 source scope and contract = SUCCESS
ESLint duplication dead-code and dependency quality = SUCCESS
Strict typecheck component tests build and artifact scan = SUCCESS
Playwright three-portal desktop and mobile smoke = SUCCESS
PHASE-07 checkpoint verdict = SUCCESS
```

## 8. Independent Formal Gate

`31268591057` 对 READY_FOR_GATE candidate 独立重跑：

```text
Independent source scope safety and adequacy = SUCCESS
Independent ESLint duplication and dead-code rerun = SUCCESS
Independent typecheck VTU build artifact and Playwright rerun = SUCCESS
PHASE-07 independent formal verdict = SUCCESS
```

这不是复用 construction 的“绿”，而是第二套 workflow 重新安装依赖、重新执行所有硬门槛。

## 9. NOT_APPLICABLE / later phase

```text
PostgreSQL/Flyway = N/A（无 DB 变更）
Business API tests = N/A（无新增 API）
Server permission negative = N/A（无服务端权限施工）
Business write idempotency/concurrency = N/A
Business workflow/outbox/worker = N/A
真实 Session/API/权限/竞态业务 E2E = PHASE-08+，本阶段禁止伪造
```

## 10. 最终结论

所有 PHASE-07 范围内硬门槛均有可重复执行证据，Formal Gate 已通过，允许 `PHASE-07 = COMPLETE`；`PHASE-08` 仍为 `NOT_STARTED`。