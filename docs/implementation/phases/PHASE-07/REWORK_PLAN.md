# PHASE-07 REWORK_PLAN — Cycle 3 Final Closure

> Phase: `PHASE-07｜前端 Design System 与共享组件库`
> Cycle: `3 / External Audit Completeness Rework`
> External-audit baseline: `fa5c2246a71a4936126855f1803b673d443213a0`
> Tested implementation anchor: `4d2cf205685e6806bb0a7bd5bdb542586afafd5a`
> READY_FOR_GATE candidate: `4797a70bc3d7e542fc2eed0ce32de974b2f67030`
> Status: `COMPLETE / FORMAL_GATE_PASS`
> Next phase: `PHASE-08 = NOT_STARTED`

## 1. Cycle 3 目标

在不越界到 PHASE-08 的前提下，把 Cycle 2 的“最小合同绿”升级成符合 `DESIGN.md` 与 `AGENT.md` 完整标准的共享 Design System：完整表单族、共享记录/KPI 组件、三端真实消费、真实 DOM/浏览器测试和前端工程质量门禁。

## 2. Checkpoints

| Checkpoint | 内容 | 最终状态 |
|---|---|---|
| C3-0 | 外部评测逐项复核，区分过时项/真实缺口/后续阶段边界 | COMPLETE |
| C3-1 | 完整表单族 + Avatar/PersonRow/RecordCard/KpiCard/ToastRegion/PartialFailure | COMPLETE |
| C3-2 | PlatformShell → SgjPortalShell 三端真实消费；collapsed token 接线 | COMPLETE |
| C3-3 | Vue Test Utils + happy-dom DOM 交互测试 | COMPLETE |
| C3-4 | Playwright 三端 desktop/mobile 浏览器 smoke | COMPLETE |
| C3-5 | ESLint/complexity/max-depth/jscpd/knip/circular dependency | COMPLETE |
| C3-6 | 三端 build + artifact secret/source-map/test-credential scan | COMPLETE |
| C3-7 | 修复 Gate 暴露的 strict/router/test-runner/pipefail/knip 问题 | COMPLETE |
| C3-8 | Construction checkpoint | `31268081850 PASS` |
| C3-9 | READY_FOR_GATE 状态候选 | `4797a70b...` |
| C3-10 | Independent Formal Gate | `31268591057 PASS` |
| C3-11 | 台账与正式 Gate 报告收口 | COMPLETE |

## 3. 关键真实失败及处置

本轮保留并利用失败证据，不删除测试、不 skip、不降 strict：

1. strict typecheck 暴露 Cascader readonly outer array 与 VTU undefined 断言；
2. Playwright 暴露 skip-link + hash Router 冲突；
3. Vitest 把 Playwright spec 混入 unit suite，改为明确测试边界；
4. Formal Gate 暴露 construction `tee` 未 pipefail 的假绿风险；
5. typed ESLint project scope / test-host 规则边界不正确；
6. `useModalFocus` 超 AGENT function line budget；
7. knip 未理解公共 Design System entry，Vite analysis mode 也不安全加载。

全部通过代码或配置修复，没有 blanket ignore Design System、没有 `@ts-ignore`/`any`/skip。

## 4. 阶段边界

Cycle 3 始终没有：

- 实现 PHASE-08 Router/Session/API Client/真实身份导航；
- 新建 P001–P126 业务页面/业务状态；
- 新增业务 API/Service/Domain/Repository/DB/Flyway；
- 前端存储业务真值；
- Mock API/临时账号/静态业务假数据；
- 自动 merge main。

## 5. 最终结果

```text
DESIGN 11.2 form family = COMPLETE
AGENT 19.8 shared regression baseline = COMPLETE
three-portal real consumption = PASS
Vitest + VTU = 32/32 PASS
ESLint/complexity/max-depth = PASS
jscpd = PASS (1.67%)
knip = PASS
circular dependency = PASS
three-portal build/artifact scan = PASS
Playwright desktop/mobile = 8/8 PASS
Construction = 31268081850 PASS
Independent Formal Gate = 31268591057 PASS
PHASE-07 = COMPLETE
PHASE-08 = NOT_STARTED
```

Cycle 3 rework 正式关闭。