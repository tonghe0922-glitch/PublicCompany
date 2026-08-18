---
project: 上金谷景区一体化运营管理平台
document: 平台三端设计与前端实现规范
filename: DESIGN.md
version: V3.0
baseline_date: 2026-08-18
status: 开发执行版
canonical_for: 视觉规范、设计系统、三端信息架构实现、Vue 前端实现映射
engineering_authority: AGENT.md
business_authority: Knowledge Base
visual_reference: 上金谷管理系统-重构版 (2).html
theme_name: 苹果暖琥珀橙
frontend_stack: Vue 3.5.x + TypeScript 5.9.x + Vite 8.2.x + Pinia 2.3.x + Vue Router 4.6.x
runtime_portals: employee / center / admin
canonical_portals: employee / center / tech
css_policy: 单一全局 CSS 入口 + Design Tokens + Vue 组件；不得引入 Tailwind 或第二套主题
icon_policy: 使用当前工程批准的线性 SVG/Lucide 适配方式
language: zh-CN
---

# 上金谷景区一体化运营管理平台
# 三端设计与前端实现规范（DESIGN.md V3.0）

> V3.0 以用户最新确认的模拟页面为视觉事实源，正式替换 V2.0 的靛蓝品牌基线。
> 本文件同时约束员工端、中心管理端和技术后台端。业务状态、流程、权限、字段、数据库和审计仍以 `AGENT.md` 与 Knowledge Base 为准。
> 视觉升级不得伪造业务数据，不得绕开服务端权限，不得改变状态机和数据库事实。

---

## 0. V3.0 强制结论

1. 品牌主色统一为暖琥珀橙，核心色为 `#EA580C`。
2. 工作区统一为浅灰 `#F4F4F7`，主要内容使用白色卡片。
3. 顶部栏、桌面侧栏和移动底栏使用轻度磨砂玻璃，不使用高饱和大面积背景。
4. 普通卡片以细边框和轻阴影为主，悬停时才增加阴影和橙色边框。
5. 所有三端应用必须从 `src/platform/create-portal-app.ts` 导入 `src/styles.css`。
6. `styles.css` 是唯一全局入口，不允许页面各自加载第二套主题。
7. 已认证页面统一使用 `UnifiedPortalShell.vue`；旧 `SgjPortalShell` 只保留给登录、错误和无侧栏全屏场景。
8. 旧靛蓝令牌、局部硬编码主题和重复组件样式停止新增。
9. 所有旧业务页面先通过兼容层获得新主题，再按闭环逐个迁移到正式组件。
10. 设计系统改造不得修改后端计算、数据库结构、权限码或业务流程。

---

## 1. 权威边界和冲突顺序

发生冲突时依次采用：

1. 法律法规与不可降低的安全底线；
2. 用户最新明确决定；
3. 根目录 `AGENT.md`；
4. 已批准 PRD、SRS、ADR 和验收记录；
5. Knowledge Base 的流程、字段、权限和数据库规则；
6. 本 `DESIGN.md`；
7. 当前代码；
8. 历史设计稿和旧原型。

本文件负责视觉语言、布局、响应式、组件交互、可访问性、前端目录映射和验收。
本文件不得自行决定审批人、金额、时限、流程节点、数据范围、字段权限或业务状态。

---

## 2. 技术与加载基线

### 2.1 正式技术栈

- Vue 3.5.x；
- TypeScript 5.9.x；
- Vite 8.2.x；
- Pinia；
- Vue Router；
- CSS Variables 与普通 CSS；
- 不引入 React、Next.js、Tailwind、第二套路由或第二套状态管理。

### 2.2 唯一 CSS 入口

每个端口的 `main.ts` 调用 `createPortalApp()`，由 `create-portal-app.ts` 统一执行：

```ts
import '../styles.css'
```

`styles.css` 必须按以下顺序加载：

```text
tokens.css
base.css
components.css
templates.css
extended.css
phase10.css（历史页面）
rebuild-shell.css
reference-theme.css（最终兼容覆盖）
```

规则：

- 所有 `@import` 必须位于文件最前；
- `templates.css` 建立基础外壳和页面模板，`extended.css` 在其后加载修饰器与扩展状态；
- `reference-theme.css` 必须最后加载，以接管历史页面视觉；
- 新页面不得单独导入主题文件；
- 组件内部仅允许 `scoped` 的结构性样式，不允许重复定义品牌色、圆角、阴影和字号体系。

---

## 3. 三端命名和职责

| Canonical Code | 中文名称 | Runtime Alias | 目录 | 核心目标 |
|---|---|---|---|---|
| `employee` | 员工端 | `employee` | `src/portals/employee` | 本人发起、执行、补充、确认、查询 |
| `center` | 中心管理端 | `center` | `src/portals/center` | 受理、审核、分派、复核、验收 |
| `tech` | 技术后台端 | `admin` | `src/portals/admin` | 配置、监控、重试、补偿、审计 |

三端共享同一业务事实，只在可见字段、动作权限、数据范围、页面组合和工作目标上不同。
`admin` 只是技术端运行别名，不代表业务超级管理员。

---

## 4. 视觉语言

### 4.1 气质

- 现代企业门户；
- 苹果式克制与清晰；
- 暖琥珀橙品牌识别；
- 浅灰工作区；
- 白色卡片；
- 大字号和高可读性；
- 强任务导向；
- 明确状态反馈；
- 边框为主、阴影为辅；
- 少量深色重点卡；
- 克制动效；
- 数据安全感。

### 4.2 颜色令牌

| 用途 | Token | 标准值 |
|---|---|---|
| 主品牌 | `--sgj-brand-600` | `#EA580C` |
| 主品牌悬停 | `--sgj-brand-700` | `#C2410C` |
| 品牌浅底 | `--sgj-brand-50` | `#FFF7ED` |
| 工作区 | `--sgj-canvas` | `#F4F4F7` |
| 卡片 | `--sgj-surface` | `#FFFFFF` |
| 主文字 | `--sgj-text-primary` | `#0F172A` |
| 次文字 | `--sgj-text-secondary` | `#334155` |
| 辅助文字 | `--sgj-text-tertiary` | `#64748B` |
| 危险 | `--sgj-danger` | `#E11D48` |
| 警告 | `--sgj-warning` | `#D97706` |
| 成功 | `--sgj-success` | `#059669` |
| 信息 | `--sgj-info` | `#0284C7` |
| 协作/特殊 | `--sgj-violet` | `#7C3AED` |

禁止：

- 新增独立品牌色；
- 在业务组件硬编码原靛蓝色；
- 只靠颜色表达状态；
- 用危险红色表达普通强调；
- 大面积使用橙色背景。

### 4.3 圆角和阴影

- 小控件：8–12px；
- 普通卡片：16px；
- 重点卡和弹窗：20px；
- 胶囊：999px；
- 默认卡片只使用 `shadow-xs`；
- 悬停使用 `shadow-card`；
- 弹窗使用 `shadow-overlay`；
- 主按钮允许 `shadow-accent`；
- 禁止所有卡片同时使用重阴影。

---

## 5. 字体和可读性

字体栈：

```text
-apple-system
BlinkMacSystemFont
SF Pro Display
SF Pro Text
PingFang SC
Microsoft YaHei
Noto Sans CJK SC
Inter
system-ui
```

字号基线：

| 场景 | 建议 |
|---|---|
| 辅助说明 | 12px，不能承载主要操作信息 |
| 表单标签/表格头 | 14px |
| 正文/输入控件 | 16px |
| 卡片标题 | 18px |
| 分区标题 | 21px |
| 页面标题 | 28–38px |
| KPI | 28–44px |

规则：

- 常规中文不得使用 8/9/10px；
- 主要正文行高不低于 1.65；
- 详情长文建议 16–17px、行高 1.8；
- 数字使用等宽数字或 `tabular-nums`；
- 不用纯浅灰承载关键文字；
- 页面标题、状态、关键数字必须形成清晰层级。

---

## 6. 全局应用外壳

### 6.1 桌面端

- 顶部栏 64px，固定；
- 左侧导航内容宽 258px；
- 侧栏以独立磨砂卡片呈现；
- 内容最大宽度 1600px；
- 内容区独立滚动；
- 页面左右内边距 24–32px；
- 支持收起侧栏；
- 顶部提供搜索、当前身份、消息和退出；
- 二三级页面提供面包屑与返回上一层。

### 6.2 平板与移动端

- 960px 以下切换抽屉导航；
- 移动端顶部保留轻量品牌和菜单按钮；
- 底部固定导航不超过 5 个直接入口；
- 其余入口进入“更多”；
- 内容底部预留安全区；
- 表格允许横向滚动，禁止压缩到不可读；
- 固定操作区不得遮挡表单；
- 每个深层页面必须可返回。

### 6.3 外壳组件

已认证页面：

```text
AuthenticatedPortalLayout.vue
└─ UnifiedPortalShell.vue
   ├─ 顶部栏
   ├─ 权限导航
   ├─ 面包屑与返回
   ├─ 页面搜索
   ├─ 内容区
   ├─ 移动抽屉
   └─ 移动底部导航
```

登录和异常页保留 `SgjPortalShell`，但视觉必须使用同一令牌。

---

## 7. 导航

1. 导航必须来自真实 Router、已实现状态和服务端权限投影。
2. 未实现页面不得生成可点击假链接。
3. 当前页面必须有明显高亮。
4. 高亮使用橙色渐变、白字和轻阴影。
5. 普通项为灰色文字，悬停使用品牌浅底。
6. 菜单数字角标必须来自真实 read model。
7. 桌面侧栏支持收起；移动端支持抽屉。
8. 图标采用统一线性 SVG 风格，不使用 Emoji 作为正式导航图标。
9. 路由切换后关闭移动抽屉并把焦点移到主内容。
10. 权限变化或身份切换后必须重新投影导航。

---

## 8. 标准组件

### 8.1 Button

- 主按钮：橙色实底、白字；
- 次按钮：橙色浅底；
- Ghost：中性浅灰；
- Danger：仅危险或不可逆动作；
- 最小触控高度 44px；
- 必须有 hover、active、focus、disabled、loading；
- 按钮文案使用明确动词。

### 8.2 Card

- 白底、1px 细边框、16px 圆角；
- 默认轻阴影；
- 悬停仅在可点击卡片上使用；
- 卡头、内容、卡尾边界明确；
- Spotlight 深色卡只用于少量关键摘要；
- 卡片不能仅靠阴影分组。

### 8.3 Form

- 标签始终可见；
- 必填同时使用文字或星号，不只用颜色；
- 控件最小高度 44px；
- 聚焦为橙色边框和橙色 focus ring；
- 错误为 Rose，并关联 `aria-describedby`；
- Hint 与 Error 不得重叠；
- 长表单按主题分段；
- 保存、提交、取消层级明确；
- 敏感字段默认遮罩。

### 8.4 Search / Filter

- 搜索框为圆角胶囊；
- 支持键盘焦点；
- 全局搜索只搜索当前真实可访问页面，业务数据搜索必须接真实 API；
- 筛选项可清除；
- 搜索、筛选、刷新、导入、导出应放在统一工具栏；
- 不允许用前端假数据伪造搜索结果。

### 8.5 Table / List

- 表头浅灰、14px、加粗；
- 行高不低于 44px；
- 行悬停使用橙色浅底；
- 数字右对齐；
- 长表格横向滚动；
- 空数据、加载、错误和部分失败分别展示；
- 批量动作先选择、再预览、再确认；
- 表格不是在手机上强行压成八列，必要时切卡片。

### 8.6 Status

- 状态使用“文字 + 颜色/图标”；
- 成功绿、警告琥珀、危险 Rose、信息蓝、协作紫；
- 状态名称必须来自服务端状态目录；
- 不允许前端自行发明状态；
- 逾期可有克制的呼吸提示，但必须遵守减少动态效果。

### 8.7 Dialog / Drawer / Toast

- Dialog 宽度按任务复杂度选择，默认不超过 680px；
- 复杂编辑使用全屏页或宽屏 Drawer，不塞入狭窄弹窗；
- 必须锁定焦点、支持 Escape 和焦点恢复；
- Toast 使用深色磨砂胶囊，自动消失且可被辅助技术读取；
- 危险确认必须说明影响，不使用模糊“确定”。

### 8.8 Avatar / Person

- 默认使用姓名首字或内部头像；
- 不依赖随机第三方头像；
- 姓名、组织、岗位和状态层级明确；
- 敏感人员信息按权限显示；
- 人员选择器必须搜索真实组织数据。

### 8.9 KPI

- 数值突出，定义和单位同时存在；
- 不展示无法追溯的假 KPI；
- KPI 必须标明口径或定义；
- 颜色只表示语义，不表示装饰；
- 重要数字支持更新时间或来源说明。

---

## 9. 页面模板

正式页面优先使用：

- `SgjListPageTemplate`；
- `SgjDetailPageTemplate`；
- `SgjFormPageTemplate`；
- `SgjApprovalPageTemplate`；
- `SgjTimelinePageTemplate`；
- `SgjDashboardPageTemplate`。

页面结构：

```text
页面标题与说明
→ 关键动作
→ 筛选/摘要
→ 主内容
→ 辅助信息
→ 状态与反馈
→ 底部或吸顶动作
```

每个页面都必须覆盖：

- loading；
- empty；
- error；
- partial failure；
- no permission；
- conflict；
- success feedback；
- mobile layout。

---

## 10. 三端展示差异

### 员工端

优先展示本人待办、到期、排班、申请、通知、学习、成长和福利。
文案要告诉员工发生了什么、为什么、下一步是什么。

### 中心管理端

优先展示高风险、超时、待受理、待审核、待验收、人员与资源异常。
允许批量动作，但必须预览、校验、权限验证和审计。

### 技术后台端

优先展示服务健康、API、数据库、Worker、外部集成、重试、补偿、配置和审计。
不得提供业务批准、付款、处分、薪资修改或伪造完成等越权动作。

---

## 11. 响应式和栅格

断点：

- `< 640px`：手机；
- `640–959px`：大屏手机/平板；
- `960–1279px`：小桌面；
- `>= 1280px`：桌面；
- `>= 1600px`：宽屏。

规则：

- 页面使用 12 栅格或 CSS Grid；
- 避免大量临时断点；
- 手机单列；
- 两栏详情在 960px 以下变单列；
- KPI 在手机端 1–2 列；
- 操作按钮允许换行；
- 横向表格必须有滚动容器；
- 移动底栏适配 `safe-area-inset-bottom`；
- 不允许隐藏功能而没有“更多”入口。

---

## 12. 可访问性

1. 所有交互元素可键盘操作。
2. Focus 必须清晰可见。
3. 页面有跳到主要内容链接。
4. Dialog/Drawer 使用正确 role 和 `aria-modal`。
5. 表单 Label、Hint、Error 与原生控件关联。
6. 状态不只用颜色。
7. Toast 使用适当 live region。
8. 主内容路由切换后可获得焦点。
9. 触控目标不小于 44px。
10. 支持 `prefers-reduced-motion`。
11. 文本对比度满足 WCAG AA。
12. 图标按钮必须有中文可访问名称。

---

## 13. 数据安全和权限展示

- L3/L4 信息默认遮罩；
- 明文显示由服务端授权和二次认证决定；
- 前端隐藏不等于权限控制；
- 技术端不自动获得业务敏感数据；
- API、RLS、字段范围和审计是最终边界；
- 构建产物不得包含测试账号、默认密码、密钥或内部敏感数据；
- 不得把权限失败伪装成空数据；
- Request ID 可在错误详情中显示，便于追踪。

---

## 14. 旧组件替换与迁移

| 旧实现 | 新实现 | 处理规则 |
|---|---|---|
| 认证页使用 `SgjPortalShell` | `UnifiedPortalShell` | 已替换，禁止回退 |
| 靛蓝 Brand Tokens | 暖琥珀橙 Tokens | 全局替换 |
| 页面局部主题 CSS | `styles.css` 单入口 | 禁止新增局部主题 |
| 重复卡片/按钮样式 | `SgjCard` / `SgjButton` | 逐闭环迁移 |
| 普通 input/select/textarea | `SgjInput` / `SgjSelect` / `SgjTextarea` | 新页面必须使用 |
| 自制弹窗 | `SgjDialog` / `SgjDrawer` | 逐模块替换 |
| 自制空/错/无权状态 | `SgjEmpty` / `SgjError` / `SgjNoPermission` | 立即替换 |
| 自制 KPI | `SgjKpiCard` | 有真实口径后使用 |
| 历史 phase 页面样式 | `reference-theme.css` 兼容 | 只维护迁移，不新增业务 |
| 假导航 | Router + Permission Projection | 禁止 |
| 假搜索 | 真实可访问路由/真实 API | 禁止 |

迁移顺序：

```text
全局 CSS 入口
→ Tokens
→ 应用外壳
→ 基础组件
→ 页面模板
→ 一个业务闭环
→ E2E
→ 下一个闭环
```

每完成一个闭环，删除该闭环的重复旧样式，不进行全仓一次性大爆炸删除。

---

## 15. 目录映射

```text
technical-platform/web/src/
├─ styles.css
├─ design-system/
│  ├─ tokens.css
│  ├─ base.css
│  ├─ components.css
│  ├─ extended.css
│  ├─ templates.css
│  ├─ reference-theme.css
│  ├─ components/
│  ├─ layout/
│  └─ templates/
├─ shared/layout/rebuild/
│  ├─ UnifiedPortalShell.vue
│  └─ rebuild-shell.css
├─ platform/
├─ router/
├─ session/
└─ portals/
```

新组件必须进入 `design-system` 或明确业务模块，禁止堆入全局 `components` 目录而没有归属。

---

## 16. 页面追溯

每个正式页面必须记录：

```text
portal_code
source_file
source_sheet
source_row_or_key
level_1
level_2
level_3
display_name
route_name
route_path
permission_code
process_codes
data_scope
sensitive_level
mobile_access
implementation_path
status
```

禁止通过标题相似自行推断权限码、流程码或数据范围。

---

## 17. 设计验收门禁

### 17.1 自动检查

至少执行：

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm quality:duplicates
pnpm quality:deadcode
pnpm build
```

设计系统必须有测试证明：

- 三端入口导入 `styles.css`；
- 样式入口顺序正确；
- 主品牌为 `#EA580C`；
- 旧 `#4F46E5` 不再是 Brand Token；
- 桌面侧栏、移动抽屉和移动底栏仍存在；
- Dialog、Drawer、表单错误和敏感数据显示满足现有可访问性测试。

### 17.2 人工验收

- 1440px 桌面；
- 1024px 平板；
- 390px 手机；
- 键盘完整操作；
- 200% 缩放；
- 减少动态效果；
- 长中文、空数据、错误、无权限、部分失败；
- 员工端、中心端、技术端分别验证；
- 登录、身份切换、退出和权限变化不回归。

### 17.3 完成定义

只有同时满足以下条件才算设计迁移完成：

```text
CSS 已真实加载
＋
组件使用统一 Tokens
＋
页面不再依赖旧主题色
＋
PC/移动布局通过
＋
权限和路由未回归
＋
自动测试通过
＋
真实业务闭环可操作
```

---

## 18. 禁止事项

- 禁止继续使用靛蓝作为默认品牌色；
- 禁止引入 Tailwind 形成第二套体系；
- 禁止页面硬编码整套色板；
- 禁止复制模拟 HTML 的业务假数据进入正式系统；
- 禁止为了视觉效果绕开 Router、Session 或服务端权限；
- 禁止用 `!important` 堆叠替代组件迁移；
- 禁止所有卡片使用重阴影；
- 禁止低对比度关键文字；
- 禁止用 Emoji 替代正式图标；
- 禁止在移动端隐藏功能且无替代入口；
- 禁止把按钮能点击当作业务闭环完成。

---

## 19. 变更记录

### V3.0 · 2026-08-18

- 以最新模拟页面的苹果暖琥珀橙风格替换靛蓝基线；
- 建立三端唯一 CSS 加载入口；
- 统一 Tokens、基础样式、组件、模板和应用外壳；
- 明确认证外壳与登录外壳边界；
- 增加旧组件迁移矩阵；
- 增加设计系统加载自动测试；
- 保留业务、权限、数据库和状态机边界。
