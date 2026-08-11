# ADR — PHASE-07 Design System 完整度与 PHASE-08/32 边界

> Status: ACCEPTED_FOR_PHASE-07_REWORK
> Date: 2026-08-09
> Repository: `louthison/PublicCompany`
> Branch: `ChatGPT_Version_V0.07`

## 1. 背景

PHASE-07 第一版 `SOURCE_CONTRACT` 只圈定了最小组件集合，导致虽然 Gate 可以证明“最小合同存在”，但没有完整覆盖根 `DESIGN.md §9-§11` 与 `AGENT.md §16.7/16.9/19.7/19.8` 的共享前端基线。

本 ADR 用于修正阶段边界：**PHASE-07 必须补齐纯 UI/无业务语义的设计系统能力与质量门禁；PHASE-08 才负责真实 Router/Session/API Client/身份与权限数据接线；PHASE-32 再做全系统级质量与 E2E 扩展。**

## 2. PHASE-07 本次必须完成

### DESIGN §11.2 表单族

统一提供并测试：

```text
Input
Textarea
Select
Date/Time
Checkbox
Radio
Switch
Upload
Cascader
PersonPicker
OrganizationPicker
```

PersonPicker / OrganizationPicker 在 PHASE-07 只接收调用方传入候选项，不自行访问人员/组织 API，不缓存业务真值。

### 共享回归组件

补齐并回归：

```text
Avatar
PersonRow
RecordCard
StatusChip
Empty/Loading/Error/PartialFailure/NoPermission/Conflict
KpiCard
ToastRegion
```

KPI 必须显示指标名称、值、单位和口径；危险色只用于异常语义。

### PortalShell 运行时消费

不新建临时业务 Router。现有三端共同使用的 `platform/PlatformShell.vue` 直接消费 `SgjPortalShell`，因此 employee / center / tech(admin alias) 的真实构建入口均经过设计系统视觉壳。

`--sgj-sidebar-collapsed-width` 由 `PortalShell.sidebarCollapsed` 使用，不再是死 token。

### 前端质量

PHASE-07 CI 增加：

- Vue Test Utils 真实 DOM 组件测试；
- ESLint；
- jscpd；
- knip；
- 循环依赖检查；
- 三端 Playwright 构建烟测（桌面 + 移动视口）；
- 构建产物密钥/测试账号/source map 扫描；
- `dist/employee|center|admin` 作为 CI artifact 保存，不提交 Git。

## 3. 明确留给 PHASE-08

以下能力依赖真实会话、路由、权限、待办或 API 数据，因此 PHASE-07 **不得用静态假数据实现**：

- TopHeader 当前身份；
- 多岗位切换后的权限刷新；
- 全局搜索真实权限结果；
- 消息/用户菜单真实数据；
- Sidebar Knowledge Base IA、当前路由高亮；
- 待办徽标；
- 未授权业务入口裁剪；
- Router/Session/API Client；
- Toast 生命周期/服务端错误映射/全局请求队列；
- PersonPicker/OrganizationPicker 的远端查询与数据范围。

PortalShell 在 PHASE-07 只提供这些区域的视觉与 slot/props 契约。

## 4. Playwright 与 AGENT 19.7/19.8 的阶段化解释

PHASE-07 没有真实业务闭环、权限 API、Session 或写操作，因此不能伪造“审批/重复提交/401/403/竞态”E2E。

本阶段 Playwright 必须真实验证：

- 三个正式构建入口都能加载；
- 三端都真实消费 `SgjPortalShell`；
- desktop/mobile viewport 不发生整体横向溢出；
- skip link 与 main focus 可用。

以下 E2E 在对应能力实际落地后成为硬门槛：

```text
PHASE-08: Session/API/Router/权限/刷新/竞态
PHASE-09+ : 各业务 process_code 闭环
PHASE-32: 全仓质量、跨端关键 E2E、覆盖率与稳定性总门禁
```

这不是豁免“以后不做”，而是禁止在能力尚不存在时制造假 E2E。

## 5. Table/List 与业务数据能力边界

Design System 提供：

- 原生 table/list 语义；
- caption / aria-label；
- 横向滚动；
- 数值右对齐辅助类；
- `aria-sort` 样式支持；
- loading/empty/error 等共享状态组件。

服务端分页、排序参数、数据范围、导出权限、虚拟化阈值属于业务列表/API 阶段，不在纯 UI 组件内伪造。

## 6. Dialog/Drawer 边界

PHASE-07 硬门槛是：role/aria-modal、初始焦点、Tab/Shift+Tab containment、Esc、关闭后焦点恢复、移动复杂操作全屏 Sheet。

`inert`/应用级背景隔离与路由级滚动管理需结合正式 App Shell 容器，在 PHASE-08 接线时再做浏览器级验证；不得由单个通用组件猜测整个应用 DOM 层级。

## 7. 决策结果

```text
PHASE-07：补齐纯 UI Design System + 三端真实消费 + VTU + 静态质量 + build artifact + browser smoke
PHASE-08：真实 Shell/Router/Session/API/权限数据接线
PHASE-32：全系统质量与关键业务 E2E 总门禁
```

本 ADR 被 `GAP_MATRIX.md`、`SOURCE_CONTRACT.md` 和最终 `PHASE_GATE.md` 引用。
