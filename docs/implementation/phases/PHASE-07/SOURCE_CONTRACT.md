# PHASE-07 SOURCE_CONTRACT — Cycle 3 Final

> 阶段：`PHASE-07｜前端 Design System 与共享组件库`
> process_code：`PLATFORM/Design-System`
> Repository：`louthison/PublicCompany`
> Branch：`ChatGPT_Version_V0.07`
> External-audit baseline：`fa5c2246a71a4936126855f1803b673d443213a0`
> Tested implementation anchor：`4d2cf205685e6806bb0a7bd5bdb542586afafd5a`
> 状态：`COMPLETE / FORMAL_GATE_PASS`

## 1. 权威来源

1. 根 `AGENT.md`；
2. 根 `DESIGN.md`；
3. 根 `Construction Master Schedule.csv`；
4. `MASTER_*` 台账；
5. PHASE-07 历史 Gate / GAP / IMPACT / TEST_EVIDENCE；
6. 当前真实源码与 GitHub Actions 运行证据。

## 2. 本阶段允许且已完成的共享能力

- CSS Design Tokens、focus/reduced-motion、响应式基础；
- Button / Card / StatusChip；
- Input / Textarea / Select / DateTime / Checkbox / RadioGroup / Switch / Upload / Cascader / PersonPicker / OrganizationPicker；
- Dialog / Drawer / Toast / ToastRegion；
- Table / List；
- Empty / Loading / Error / PartialFailure / NoPermission / Conflict；
- MaskedValue / StepUpReveal 纯 UI/事件契约；
- Avatar / PersonRow / RecordCard / KpiCard；
- 无 Router/Session/API 业务真值的 `SgjPortalShell`；
- List / Detail / Form / Approval / Timeline / Dashboard 结构模板；
- Vue runtime + Vue Test Utils 组件/可访问性/安全负向测试；
- 三端真实消费与三端真实 build；
- ESLint / jscpd / knip / circular dependency / artifact scan / Playwright 门禁。

## 3. 明确排除并保持未启动

- 具体业务页面与 P001–P126 业务逻辑；
- Router 业务导航事实、Session、登录态、API Client；
- 新业务 API / Application Service / Domain / Repository；
- PostgreSQL / Flyway；
- 服务端权限裁决、业务 Workflow / Outbox / Worker；
- localStorage/sessionStorage/Mock API/静态业务假数据作为业务真值。

以上能力属于后续阶段，尤其 PHASE-08；本阶段没有以假数据提前实现。

## 4. Design fidelity hard contract

必须且已验证：

- 核心 token、danger hover、focus ring、reduced motion；
- Error `errorCode/traceId` 安全诊断；
- PortalShell globalAlert / toastRegion / assistant / skip-link；
- sidebar collapsed token 真消费；
- desktop independent scrolling；
- mobile Drawer full-screen；
- DESIGN 字体 fallback；
- KPI value/unit/definition；
- shared record/person/avatar baseline；
- 六类结构模板。

## 5. Runtime / DOM / browser test contract

仅源码字符串断言不够。最终测试链包含：

```text
runtimeTestHost.ts
runtime-primitives.test.ts
runtime-overlays-security.test.ts
runtime-shell-templates.test.ts
component-vtu.test.ts
e2e/design-system-integration.spec.ts
```

覆盖：表单 label/error/ARIA/v-model、Dialog/Drawer focus/Tab/Escape/restore、Toast live region、StepUpReveal fail-closed、Shell/模板 slots、三端真实构建消费、desktop/mobile skip-link 与浏览器渲染。

## 6. 工程质量 hard contract

```text
vue-tsc/tsc strict = PASS
Vitest + VTU = 32/32 PASS
ESLint = PASS
complexity <= 10 = PASS
max-depth <= 3 = PASS
jscpd = PASS (1.67% < 8%)
knip = PASS
circular dependency = PASS
employee/center/admin build = PASS
artifact scan = PASS
Playwright = 8/8 PASS
```

施工 workflow 的静态质量管道已使用 `pipefail`，禁止 `tee` 掩盖真实失败。

## 7. 假完成与越界禁止项

Design System 范围 Gate 拒绝：TODO/FIXME、mock/fake/demo/hardcode、storage 业务真值、empty catch、ts-ignore/ts-nocheck、any 绕过、skip/disabled tests、临时账号/验证码/默认密码/演示入口、常见 secret/token、`/api/`、Pxxx、fetch/axios 与后续阶段业务耦合。

## 8. Closure facts

```text
Construction workflow = 31268081850 PASS
READY_FOR_GATE candidate = 4797a70bc3d7e542fc2eed0ce32de974b2f67030
Independent Formal Gate = 31268591057 PASS
Formal verdict = SUCCESS
PHASE-07 = COMPLETE
PHASE-08 = NOT_STARTED
```

结论：SOURCE_CONTRACT 已从 Cycle 2 的最小清单升级为与 DESIGN/AGENT 完整标准一致的 PHASE-07 最终合同。