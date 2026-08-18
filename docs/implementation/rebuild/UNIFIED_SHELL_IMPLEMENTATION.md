# Rebuild Website · 统一设计系统实施记录

## 目标

在 `Rebuild_website` 分支把最新模拟页面的“苹果暖琥珀橙”视觉正式接入 Vue 三端，同时保留现有登录、会话、Router、权限投影、后端接口、数据库和业务状态机。

## 本次根因

原工程存在三处断链：

1. `src/styles.css` 声明了设计系统样式，但 `create-portal-app.ts` 没有导入该入口；
2. `rebuild-shell.css` 已存在，却没有进入全局 CSS 依赖链；
3. `PortalNavigation.vue` 与 `PortalSessionHeader.vue` 的旧 `scoped` 样式仍可能覆盖全局主题。

因此三端页面无法稳定加载完整设计系统，导航和身份栏也可能保留旧版视觉。

## 已实施

### CSS 入口

`src/platform/create-portal-app.ts` 统一导入：

```ts
import '../styles.css'
```

员工端、中心端和技术端共用这一个入口。

### 加载顺序

```text
tokens
→ base
→ components
→ templates
→ extended
→ phase10 compatibility
→ rebuilt shell
→ latest reference compatibility overrides
```

### 主题替换

- 靛蓝替换为暖琥珀橙；
- 工作区改为 `#F4F4F7`；
- 白色卡片、细边框、轻阴影；
- 顶部栏、侧栏和移动底栏采用磨砂玻璃；
- 表单聚焦、按钮、导航高亮统一使用橙色；
- 成功、警告、危险、信息和协作色保持语义独立。

### 组件处理

- 已认证页面继续使用 `UnifiedPortalShell`；
- `PortalNavigation.vue` 已直接替换为图标化、橙色高亮、桌面和移动双形态的新导航；
- `PortalSessionHeader.vue` 已直接替换为头像、端口、当前身份、在线状态、身份切换和退出操作的新身份栏；
- 登录和异常页保留 `SgjPortalShell`，但视觉已统一；
- `SgjButton`、`SgjCard`、表单、表格、状态、弹窗、抽屉、Toast 和页面模板全部换用新主题；
- 历史页面通过 `reference-theme.css` 获得统一视觉；
- 兼容层不再重复覆盖导航和身份栏，避免与组件 `scoped` 样式竞争；
- 后续逐闭环删除对应重复旧样式，不进行一次性破坏性删除。

### 规范

根 `DESIGN.md` 升级为 V3.0，成为暖琥珀橙设计系统唯一执行基线。

### 自动回归

新增 `theme-entry.test.ts`，检查：

- 三端应用入口确实加载 CSS；
- 设计系统导入顺序；
- 主品牌色；
- 旧靛蓝令牌清除；
- 桌面、抽屉和移动底栏契约；
- 导航和身份栏组件本体已经替换。

## 未改变

- Java 后端；
- PostgreSQL / Flyway；
- API；
- 权限码；
- 业务状态机；
- 三端数据范围；
- 审计与敏感数据规则。

## 后续闭环迁移

每个业务闭环按以下顺序推进：

```text
页面核对
→ 旧组件清单
→ 正式组件替换
→ 真实 API 联调
→ PC/移动验收
→ 单元与 E2E
→ 删除该闭环重复 CSS
```
