# PHASE-07 IMPACT_MATRIX — Cycle 3 Final

> Phase: `PHASE-07`
> Scope: `PLATFORM/Design-System`
> Tested anchor: `4d2cf205685e6806bb0a7bd5bdb542586afafd5a`
> Formal Gate: `31268591057 = PASS`
> 规则：本阶段只建设共享前端表现与质量基线，不声明任何业务 process_code 已实现；PHASE-08 保持 NOT_STARTED。

| process_code | Employee | Center | Tech/Admin runtime | Route | Permission | Data Scope | Sensitive | API | Service | Domain | Repository | DB/Flyway | Workflow/Outbox/Worker | Test / Gate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PLATFORM/Design-System:TOKENS | 共享消费 | 共享消费 | 共享消费 | NONE | NONE | NONE | UI semantic only | NONE | NONE | NONE | NONE | NONE | NONE | source + CSS contract |
| PLATFORM/Design-System:FORMS | 11 类共享表单 | 同左 | 同左 | NONE | 不裁决 | 调用方提供 | error/required/ARIA only | NONE | NONE | NONE | NONE | NONE | NONE | runtime + VTU |
| PLATFORM/Design-System:RECORDS | Avatar/PersonRow/RecordCard/KpiCard | 同左 | 同左 | NONE | NONE | NONE | 调用方决定可见字段 | NONE | NONE | NONE | NONE | NONE | NONE | runtime/DOM |
| PLATFORM/Design-System:FEEDBACK | Dialog/Drawer/Toast/ToastRegion/states | 同左 | 同左 | NONE | 只呈现结果 | NONE | 不自行升级权限 | NONE | NONE | NONE | NONE | NONE | NONE | keyboard/a11y/VTU |
| PLATFORM/Design-System:DATA | Table/List | 同左 | 同左 | NONE | NONE | NONE | 调用方决定字段 | NONE | NONE | NONE | NONE | NONE | NONE | semantics + responsive |
| PLATFORM/Design-System:SECURITY-UI | MaskedValue/StepUpReveal | 同左 | 同左 | NONE | 只 emit request，不授权 | NONE | fail-closed | NONE | NONE | NONE | NONE | NONE | NONE | negative reveal tests |
| PLATFORM/Design-System:SHELL | 正式入口消费 SgjPortalShell | 同左 | 同左 | PHASE-08 | PHASE-08 | PHASE-08 | 不承载业务事实 | PHASE-08 | NONE | NONE | NONE | NONE | NONE | Playwright desktop/mobile |
| PLATFORM/Design-System:TEMPLATES | List/Detail/Form/Approval/Timeline/Dashboard | 同左 | 同左 | NONE | NONE | NONE | slot/props only | NONE | NONE | NONE | NONE | NONE | NONE | mounted slot smoke |
| PLATFORM/Design-System:QUALITY | 共享质量门禁 | 共享质量门禁 | 共享质量门禁 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | typecheck + 32 tests + ESLint + jscpd + knip + cycle + build + artifact scan + 8 Playwright |

## 三端真实消费

现有 `technical-platform/web/src/platform/PlatformShell.vue` 直接消费 `SgjPortalShell`，因此 employee / center / admin(tech runtime alias) 三端正式 Vite build 都会实际进入 Design System 运行路径；没有通过临时 Gallery route 冒充集成。

## 质量与构建影响

- `package.json` 新增正式质量脚本；
- `pnpm-lock.yaml` 锁定 VTU / happy-dom / ESLint / jscpd / knip / Playwright 等依赖；
- construction + independent workflows 对相同硬门槛重复执行；
- `dist/employee|center|admin` 由 CI 生成并扫描，不提交仓库；
- static-quality pipeline 使用 `pipefail`，失败不能被 `tee` 掩盖。

## 阶段边界

未新增具体业务 route、Session、API Client、登录壳、服务端权限、PostgreSQL/Flyway、业务流程、Outbox/Worker 或具体业务页。业务排序/分页/身份/通知/Toast 生命周期与后端状态映射继续由后续真实能力阶段完成。

## Final closure

```text
MISSING = 0
PARTIAL = 0（PHASE-07 范围内）
CONFLICT = 0
Construction Gate = PASS
Independent Formal Gate = PASS
PHASE-07 = COMPLETE
PHASE-08 = NOT_STARTED
```