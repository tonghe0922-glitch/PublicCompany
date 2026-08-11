---
project: 上金谷景区一体化运营管理平台
document: 平台三端设计与前端实现规范
filename: DESIGN.md
version: V2.0
baseline_date: 2026-08-07
status: 开发执行版
canonical_for: 视觉规范、三端信息架构实现、Vue 前端实现映射
engineering_authority: AGENT.md
business_authority: Knowledge Base
frontend_stack: Vue 3.5.x + TypeScript 5.9.x + Vite 8.2.x + Pinia 2.3.x + Vue Router 4.6.x
runtime_portals: employee / center / admin
canonical_portals: employee / center / tech
css_policy: 继承现有 CSS 与 Design Tokens；不得引入 Tailwind 作为平行样式体系
icon_policy: 继承现有 Lucide 依赖与图标适配方式
language: zh-CN
---

# 上金谷景区一体化运营管理平台
# 三端设计与前端实现规范（DESIGN.md）

> 本文件从 V2.0 起同时约束 **员工端、中心管理端、技术后台端**。  
> 本文件定义视觉、交互、信息架构实现、组件和前端工程映射；工程安全、数据库、流程、权限、测试和部署的最高约束仍以仓库根目录 `AGENT.md` 为准。  
> Knowledge Base 中的页面架构、126 个业务流程、表单字段、状态、规则、接口和数据库目录是业务事实来源。本文件不得创造与 Knowledge Base 冲突的页面职责、状态、权限或业务规则。

---

## 0. V2.0 统一整改结论

### 0.1 本版本解决的问题

旧版 `DESIGN.md` 存在以下会直接误导 AI 编码的问题：

1. 技术基线写成 React + TypeScript + Vite + Tailwind CSS + Lucide React；
2. 正文包含 `App.tsx`、React Hook Form、TanStack Query、Zustand、Redux Toolkit、Radix 等 React 体系建议；
3. 图标规范写成 `lucide-react`；
4. Tailwind 被当作实现基础，而当前仓库没有把 Tailwind 作为批准的平行样式体系；
5. 文档标题和大量内容只覆盖员工端，但仓库已经存在 employee / center / admin 三个运行入口；
6. 页面名称、运行入口、业务端口名称没有统一别名规则，容易把 `admin` 再误建成第四个“管理员端”。

V2.0 统一后：

- 前端正式技术基线改为 **Vue 3.5.x + TypeScript 5.9.x + Vite 8.2.x + Pinia + Vue Router**；
- 使用 Composition API 和 `<script setup lang="ts">`；
- 现有 CSS、CSS Variables、设计令牌是样式事实；旧 Tailwind 词汇仅保留为颜色语义参考，不再是技术依赖；
- 三端业务名称统一为：`employee`、`center`、`tech`；
- 当前代码运行别名 `admin` 明确映射为 `tech`，不得据此新增第四套端；
- 设计规则与 `AGENT.md` 的权限、安全、复杂度、敏感数据和闭环要求一致。

### 0.2 当前工程实际版本

以 `technical-platform/web/package.json` 为基准：

| 能力 | 当前基线 |
|---|---|
| Vue | 3.5.40 |
| TypeScript | 5.9.3 |
| Vite | 8.2.1 |
| Pinia | 2.3.1 |
| Vue Router | 4.6.4 |
| Node | >= 22 |
| pnpm | >= 10 |
| 图标依赖 | `lucide` |
| 构建入口 | `employee` / `center` / `admin` |
| 输出目录 | `dist/employee` / `dist/center` / `dist/admin` |

设计文档不得要求新增 React、Next.js、Tailwind、第二套路由或第二套状态管理来实现已有能力。

---

## 1. 文档权威边界

### 1.1 本文件负责

- 三端视觉语言；
- 页面信息优先级；
- 响应式布局；
- 组件状态；
- 交互方式；
- 文案与可访问性；
- 前端目录和 Vue 实现映射；
- 三端页面职责的展示边界；
- 设计验收清单。

### 1.2 本文件不负责自行决定

以下内容必须从 `AGENT.md`、Knowledge Base、PRD/SRS、状态/规则目录取得：

- 新业务状态；
- 审批人；
- 数据所有权；
- 权限范围；
- 金额、时限、比例和分值；
- 数据库表字段；
- 流程节点；
- 外部接口真值；
- 是否自动批准；
- L3/L4 的明文权限；
- 归档与关闭门槛。

### 1.3 冲突优先级

出现冲突时：

1. 法律法规和不可降低安全底线；
2. 用户最新明确决定；
3. 根 `AGENT.md`；
4. 已批准 PRD/SRS、ADR、验收记录；
5. Knowledge Base 的流程、表单、字段、数据库规则；
6. Knowledge Base 页面架构；
7. 本 `DESIGN.md`；
8. 当前代码；
9. 历史设计稿和旧原型。

---

## 2. 三端唯一命名体系

### 2.1 Canonical Portal

| Canonical Code | 中文名称 | 当前 Runtime/Build Alias | 当前代码目录 | 业务目标 |
|---|---|---|---|---|
| `employee` | 员工端 | `employee` | `src/portals/employee` | 本人发起、执行、补充、确认、查询 |
| `center` | 中心管理端 | `center` | `src/portals/center` | 受理、审核、分派、专业复核、验收 |
| `tech` | 技术后台端 | `admin` | `src/portals/admin` | 配置、监控、重试、补偿、审计 |

### 2.2 `admin` 的使用边界

- `admin` 是当前构建与目录实现别名；
- 业务文档、页面目录、职责描述统一称“技术后台端 / tech”；
- 不得把 `admin` 理解为“超级业务管理员”；
- 不得新建第四套 `tech` 目录与现有 `admin` 平行；
- 若未来要把运行别名 `admin` 正式改为 `tech`，必须单独 ADR，并同步 Vite 构建、部署、域名、监控、文档和 E2E。

### 2.3 三端共用同一事实

三端不是三套业务系统：

- 同一个 `business_id`；
- 同一个 `business_no`；
- 同一个 `process_instance_id`；
- 同一个服务端状态；
- 同一个流程版本；
- 同一个业务主表；
- 不同的是：可见字段、动作权限、数据范围、页面组合和工作目标。

---

## 3. Knowledge Base 页面架构绑定

### 3.1 员工端权威来源

- `Knowledge Base/01 完整的页面架构/1-1 员工首页.xlsx`
- `Knowledge Base/01 完整的页面架构/1-2员工全层级页面.xlsx`

### 3.2 中心端权威来源

- `Knowledge Base/01 完整的页面架构/2-1 中心首页.xlsx`
- `Knowledge Base/01 完整的页面架构/2-2中心全层级页面.xlsx`

### 3.3 技术端权威来源

- `Knowledge Base/01 完整的页面架构/3-1技术-首页.xlsx`
- `Knowledge Base/01 完整的页面架构/3-2技术-全层级页面.xlsx`

### 3.4 页面落地时必须建立的追溯字段

每一个正式页面必须能追溯到：

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

禁止通过中文标题相似就自行推断权限码或流程码。

---

## 4. 产品与设计定位

### 4.1 整体设计气质

关键词：

- 现代企业门户；
- 清晰直接；
- 稳重可信；
- 轻量卡片化；
- 大字号；
- 强任务导向；
- 明确状态；
- 适度科技感；
- 克制动效；
- 数据安全感；
- 对员工友好；
- 对管理人员高效率；
- 对技术人员高信息密度但不越权。

### 4.2 必须保留的视觉特征

1. 靛蓝品牌主色；
2. Slate 灰阶作为主要中性色；
3. 浅灰工作区 + 白色卡片；
4. 桌面侧栏；
5. 移动端底部导航；
6. 12 栅格；
7. KPI 大字号；
8. 状态采用“文字 + 颜色/图标”；
9. 页面切换轻微淡入；
10. 深色重点卡只用于少量关键摘要；
11. 普通卡片以边框为主、阴影为辅。

### 4.3 必须修正的旧问题

- 常规中文不得使用 8/9/10px；
- 普通员工界面不展示内部工程 P0/P1 术语；
- 错误与安全提示中文化；
- 不依赖随机第三方头像；
- 移动端不能因为底部只显示 5 项就丢功能；
- 敏感数据不默认明文；
- 不允许各业务模块随意新建颜色体系；
- 危险状态统一使用 Rose 语义；
- 禁止所有卡片都使用重阴影；
- 禁止只靠颜色传达状态。

---

## 5. 三端任务优先级

### 5.1 员工端

首屏优先：

1. 高危安全或紧急预警；
2. 今日待办、到期、逾期；
3. 当日排班与打卡；
4. 本人高频申请；
5. 专业业务入口；
6. 通知、会议、学习；
7. 个人成长与福利摘要。

员工端文案应说明：
- 发生了什么；
- 为什么；
- 下一步；
- 如何修复；
- 需要谁处理。

### 5.2 中心管理端

首屏优先：

1. 超时和高风险队列；
2. 待受理 / 待审核 / 待验收；
3. 人员、排班和资源异常；
4. 跨中心依赖阻塞；
5. 本中心指标；
6. 今日重要事件；
7. 数据质量问题。

中心端默认桌面优先，允许批量动作，但批量动作必须预览、校验、审计。

### 5.3 技术后台端

首屏优先：

1. 服务健康；
2. API/数据库/Worker/外部接口异常；
3. Outbox、Retry、DLQ；
4. 流程定义和版本；
5. 权限/配置变更；
6. 数据质量和技术补偿；
7. 审计与发布；
8. 恢复演练状态。

技术端不得放置：
- “批准报销”；
- “确认支付”；
- “决定纪律处分”；
- “直接改薪资”；
- “直接关闭采购”；
- “强制将业务改成完成”。

---

## 6. 全局布局

### 6.1 桌面

推荐：

- Top Header：72–80px；
- Sidebar 展开：280–288px；
- Sidebar 收起：72–80px；
- 主内容最大宽度：1600px；
- 页面左右内边距：32–48px；
- 页面底部安全区：48px。

行为：
- 顶部栏固定；
- 左侧导航固定；
- 内容区独立滚动；
- 页面标题随内容滚动；
- 只有必要的全局告警吸顶。

### 6.2 移动

- 顶部轻量标题栏；
- 单列主内容；
- 底部固定导航；
- “更多”进入完整功能菜单；
- 高频提交可使用底部固定操作区；
- 安全区适配；
- 二三级页面必须有返回能力。

员工端底部最多 5 个主入口，建议：
1. 首页
2. 业务
3. 考勤
4. 申请
5. 更多

“更多”不是删减功能，而是完整 IA 的移动入口。

### 6.3 12 栅格

常用：
- 8 + 4；
- 9 + 3；
- 6 + 6；
- 4 + 8；
- 4 + 4 + 4；
- 敏感业务单列 768–960px。

---

## 7. Design Tokens

### 7.1 CSS Variables 是正式实现方式

不得要求 Tailwind 才能使用本规范。

推荐：

```css
:root {
  --sgj-brand-50: #eef2ff;
  --sgj-brand-100: #e0e7ff;
  --sgj-brand-500: #6366f1;
  --sgj-brand-600: #4f46e5;
  --sgj-brand-700: #4338ca;
  --sgj-brand-800: #3730a3;

  --sgj-canvas: #f8fafc;
  --sgj-surface: #ffffff;
  --sgj-surface-muted: #f1f5f9;
  --sgj-border: #e2e8f0;
  --sgj-border-subtle: #f1f5f9;

  --sgj-text-primary: #0f172a;
  --sgj-text-secondary: #475569;
  --sgj-text-tertiary: #64748b;
  --sgj-text-disabled: #94a3b8;

  --sgj-success: #059669;
  --sgj-warning: #d97706;
  --sgj-danger: #e11d48;
  --sgj-info: #2563eb;

  --sgj-radius-sm: 8px;
  --sgj-radius-md: 12px;
  --sgj-radius-lg: 16px;
  --sgj-radius-xl: 20px;
  --sgj-radius-2xl: 24px;
}
```

### 7.2 色彩

| 语义 | 主色 | 浅底 | 边框 |
|---|---|---|---|
| Brand | Indigo 600 | Indigo 50 | Indigo 100/200 |
| Success | Emerald 600 | Emerald 50 | Emerald 200 |
| Warning | Amber 600 | Amber 50 | Amber 200 |
| Danger | Rose 600 | Rose 50 | Rose 200 |
| Info | Blue 600 | Blue 50 | Blue 200 |
| Neutral | Slate 600 | Slate 100 | Slate 200 |

### 7.3 字体

```css
font-family:
  Inter,
  "SF Pro Display",
  "SF Pro Text",
  "PingFang SC",
  "Microsoft YaHei",
  "Noto Sans CJK SC",
  system-ui,
  sans-serif;
```

| 层级 | 桌面 | 移动 | 建议字重 |
|---|---:|---:|---:|
| Display | 40 | 32 | 800 |
| Page Title | 32 | 24 | 800 |
| Section Title | 24 | 20 | 700 |
| Card Title | 18 | 17 | 700 |
| Body Large | 16 | 16 | 500–600 |
| Body | 15–16 | 15–16 | 400–500 |
| Secondary | 14 | 14 | 500 |
| Metadata | 13 | 13 | 500 |
| Minimum | 12 | 12 | 600 |

禁止为了塞内容将正文缩小到 12px 以下。

### 7.4 间距

采用 4px 基础：
`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48`

### 7.5 圆角

- 小标签：8px；
- 控件：12px；
- 标准卡：16px；
- KPI：20px；
- 大型强调：24px。

### 7.6 阴影

- 普通卡片：极轻；
- 浮层：中等；
- Modal：明显但克制；
- 不允许普通卡片全部重阴影。

---

## 8. 响应式

建议断点语义，不绑定 Tailwind：

```text
mobile      < 640
large-phone >= 640
tablet      >= 768
desktop     >= 1024
wide        >= 1280
xl-wide     >= 1536
```

实现可以使用 CSS Media Query、现有 CSS token 或现有布局工具。

不得：
- 为一个页面创造大量临时断点；
- 用缩小字体代替响应式；
- 把桌面 10 列表格硬塞到手机。

---

## 9. 全局组件

### 9.1 App Shell

应包含：

```text
PortalShell
├── TopHeader
├── Sidebar
├── MobileBottomNav
├── GlobalAlertBar
├── MainContent
├── ToastRegion
└── OptionalAssistantEntry
```

Shell 只做框架，不承载领域业务规则。

### 9.2 TopHeader

显示：
- 品牌；
- 当前端口；
- 当前身份；
- 全局搜索（有权限时）；
- 消息；
- 用户菜单。

多岗位切换：
- 当前身份必须清晰；
- 切换后刷新服务端权限与数据；
- 不使用仅前端改变量模拟岗位切换。

### 9.3 Sidebar

- 一级/二级 IA 来自 Knowledge Base；
- 当前路由高亮；
- 徽标来自真实待办；
- 收起后有 Tooltip；
- 不显示未授权业务入口；
- 但最终安全仍由 API 控制。

### 9.4 Button

变体：

```ts
type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
```

必须具备：
- default；
- hover；
- active；
- focus-visible；
- disabled；
- loading。

写操作 loading 时禁止重复提交。

### 9.5 Card

```ts
type CardVariant = 'default' | 'muted' | 'spotlight'
```

一个卡片只表达一个主题。

### 9.6 StatusChip

```ts
type StatusTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
```

状态名称来自服务端/状态目录，不在组件内发明。

### 9.7 Empty / Loading / Error

所有数据区必须有：
- loading；
- empty；
- error；
- partial（适用时）；
- retry；
- no-permission。

错误展示：
- 中文说明；
- 可执行下一步；
- 错误编号 / traceId；
- 不暴露 SQL、堆栈、内部路径。

### 9.8 Dialog / Drawer

- 简单确认：Dialog；
- 复杂详情/表单：Drawer 或页面；
- 移动端复杂操作优先全屏 Sheet；
- 高风险操作必须说明后果；
- Modal 焦点锁定；
- Esc 行为明确。

---

## 10. 表格、列表与 KPI

### 10.1 KPI

- 一行常规 3–4 个；
- 只突出真正关键指标；
- 数字 28–40px；
- 危险色只用于异常；
- 必须显示单位和口径。

### 10.2 Table

- 服务端分页；
- 数值列对齐；
- 操作列稳定；
- 加载/空/错误；
- 移动端转换卡片或受控横向滚动；
- 导出按钮必须绑定独立权限；
- 不允许“导出所有”绕开数据范围。

### 10.3 列表

任务列表至少显示：
- 类型；
- 标题；
- 来源；
- 时间；
- 状态；
- 下一步；
- 是否逾期。

“立即办理”应进入具体任务/节点，不只是模块首页。

---

## 11. 表单

### 11.1 三层校验

1. 前端 Schema/组件即时校验；
2. API DTO 校验；
3. 服务端领域规则。

前端通过不代表业务通过。

### 11.2 组件

统一：
- Input；
- Textarea；
- Select；
- Date/Time；
- Checkbox；
- Radio；
- Switch；
- Upload；
- Cascader；
- PersonPicker；
- OrganizationPicker。

### 11.3 高风险字段

以下不得信任前端：
- companyId；
- employeeId；
- approverId；
- approvedAmount；
- finalStatus；
- createdBy；
- audit fields；
- dataScope。

### 11.4 自动保存

长表单可自动保存草稿，但必须：
- 显示状态；
- 有版本；
- 冲突处理；
- 自动保存不等于正式提交。

---

## 12. 流程与状态呈现

### 12.1 状态来自服务端

前端只能提交动作：
- SUBMIT；
- APPROVE；
- RETURN；
- REJECT；
- CANCEL；
- CONFIRM；
- ARCHIVE 等已批准动作。

不得提交任意目标状态。

### 12.2 多状态维度

页面不得把所有含义压成一个状态：

- workflow_status；
- business_status；
- validity_status；
- archive_status；
- domain_stage。

UI 可以生成“综合状态标签”，但原始事实仍须可追溯。

### 12.3 时间线

流程详情应显示：
- 发起；
- 关键审核；
- 执行；
- 验收；
- 退回/异常；
- 归档；
- 关闭。

技术事件不能冒充业务审批节点。

---

## 13. 员工端页面模板

员工端优先对齐 Knowledge Base 员工首页和全层级页面。

常见模板：

### 13.1 今日工作台

8 + 4：
- 待办；
- 排班；
- 快捷申请；
- 通知；
- 风险。

### 13.2 我的专业业务

入口取决于：
- 当前岗位；
- 当前任职；
- 权限；
- process capability。

### 13.3 快捷申请

只展示可发起的业务。
每一申请都应支持：
- 草稿；
- 提交；
- 补充；
- 合法撤回；
- 进度；
- 结果。

### 13.4 考勤

- 月历/列表；
- 班次；
- 打卡；
- 异常；
- 假期/调休；
- 补卡入口。

### 13.5 档案/任职

敏感个人字段默认脱敏。

### 13.6 学习/资格

显示：
- 必修；
- 截止；
- 进度；
- 考试；
- 资格有效期。

### 13.7 薪酬福利

- 单列窄版；
- 默认隐藏完整金额；
- Step-Up 后看完整信息；
- 异议入口；
- 不在公共场景自动展示。

---

## 14. 中心管理端页面模板

中心端优先对齐 Knowledge Base 中心首页和全层级页面。

### 14.1 中心工作台

显示：
- 待受理；
- 待审核；
- 待执行；
- 待验收；
- 逾期；
- 风险；
- 本中心资源；
- 数据质量。

### 14.2 审批/专业审核

必须显示：
- 申请人；
- 当前身份；
- 业务摘要；
- 证据；
- 历史；
- 规则结果；
- 利益冲突提示；
- 合法动作。

不得只给“通过/拒绝”两个按钮而缺少业务事实。

### 14.3 批量动作

必须：
- 预览；
- 条件校验；
- 逐项结果；
- 部分失败；
- 审计；
- 可重试边界。

### 14.4 中心范围

页面可以显示当前中心名称，但真正数据范围由服务端 active assignment 和组织关系控制。

---

## 15. 技术后台端页面模板

技术端优先对齐 Knowledge Base 技术首页和全层级页面。

### 15.1 系统健康

- API；
- DB；
- Worker；
- integration；
- object storage；
- queue/outbox；
- error rate；
- release version。

### 15.2 流程治理

可：
- 查看/管理流程定义；
- 发布版本；
- 查看实例技术状态；
- 重试技术事件。

不可：
- 直接批准业务；
- 伪造业务执行证据。

### 15.3 DLQ / Retry

显示：
- event id；
- type；
- aggregate；
- retry count；
- error code；
- trace；
- occurred time。

L3/L4 payload 默认脱敏。

### 15.4 权限治理

权限配置属于高风险动作：
- Step-Up；
- 原因；
- 审批/四眼；
- 审计；
- 生效和回收时间。

---

## 16. Vue 3 实现映射

### 16.1 组件语法

新代码默认：

```vue
<script setup lang="ts">
</script>

<template>
</template>
```

禁止新增 React/JSX/TSX 作为平行实现。

### 16.2 页面结构

复杂页面：

```text
PageShell.vue
features/
  XxxSummary.vue
  XxxList.vue
  XxxActionPanel.vue
composables/
  use-xxx-page.ts
services/
  xxx-api.ts
selectors/
  xxx-selectors.ts
types/
  xxx-types.ts
```

### 16.3 PageShell

只负责：
- 页面标题；
- 路由上下文；
- 区块组合；
- loading/error/empty 外框。

不负责：
- 复杂业务规则；
- 金额计算；
- 权限最终裁决；
- 大量 SQL/API 语义；
- 50 个方法。

### 16.4 Composable

负责：
- 页面请求；
- 局部状态；
- 用户动作；
- AbortController；
- request sequence；
- 错误映射；
- 生命周期清理。

### 16.5 API Service

统一：
- Authorization；
- X-Request-Id；
- Idempotency-Key；
- X-Step-Up-Ticket；
- ApiError；
- traceId；
- 请求取消。

页面不得各自拼 URL。

### 16.6 Pinia

只保存：
- 会话；
- 当前身份；
- 跨页面 UI/客户端状态；
- 必要缓存。

不得长期保存完整：
- 薪资；
- 合同正文；
- 身份证；
- 银行卡；
- 健康档案。

---

## 17. 代码复杂度对齐 AGENT

新建/修改默认：

| 项目 | 上限 |
|---|---:|
| 页面 SFC 有效行 | 300 |
| `<script setup>` | 180 |
| `<template>` | 180 |
| 单函数 | 40 |
| 嵌套深度 | 3 |
| 顶层函数 | 15 |
| computed | 25 |
| 圈复杂度 | 10 |

超限时：
- 按业务内聚拆分；
- 不压缩代码逃避；
- 不把 1 个 GodComponent 变成 1 个 GodComposable。

---

## 18. 样式组织

### 18.1 正式规则

- 优先复用 `technical-platform/web/src/styles.css` 与现有 `src/styles/**`；
- 设计令牌进入统一 CSS Variables；
- 业务组件只消费语义 token；
- 禁止页面随意硬编码近似色；
- 禁止引入 Tailwind 作为第二套样式体系来重写现有页面。

### 18.2 Tailwind 历史术语

旧设计文件中 `indigo-600`、`slate-200` 等名称可作为“色板参考名称”，但正式实现使用：
- CSS Variable；
- 项目 class；
- Vue 组件变体。

不得因此安装 Tailwind。

---

## 19. 图标

### 19.1 正式策略

- 继承当前 `lucide` 依赖和项目适配方式；
- 同一页面不混用多套图标；
- 图标必须配文字或 aria-label；
- Emoji 不作为业务图标。

### 19.2 禁止

- 文档要求 `lucide-react`；
- 为一个图标引入第二图标库；
- 业务状态只放一个无文字色点。

---

## 20. 异步状态与竞态

统一状态建议：

```ts
type AsyncState<T> =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'success'; data: T }
  | { state: 'empty' }
  | { state: 'partial'; data: T; errors: ApiError[] }
  | { state: 'error'; error: ApiError }
  | { state: 'cancelled' }
```

规则：
- 不用一个全局 busy 管多个请求；
- 旧请求不能覆盖新状态；
- route change/unmount 取消；
- 非幂等写无 Idempotency-Key 不自动重试；
- 空 catch 禁止；
- 失败不能继续显示成功。

---

## 21. 权限与敏感数据

### 21.1 前端不是安全边界

菜单隐藏、按钮隐藏仅改善体验。

API 必须再次验证：
- user；
- active assignment；
- permission；
- data scope；
- field level；
- state；
- Step-Up；
- conflict-of-interest。

### 21.2 数据分级

沿用 `AGENT.md` 映射：

| 业务字段包 | 安全口径 |
|---|---|
| P0-公开 | DATA-L1 |
| P1-内部 | DATA-L2 |
| P2-个人 | DATA-L3 |
| P3-高度敏感 | DATA-L4 |

### 21.3 默认脱敏

示例：
- 手机：`138****8008`
- 证件：`3302**********1234`
- 银行卡：`**** 5678`
- 薪酬：`¥••••••`

完整查看：
- 后端权限；
- Step-Up；
- 有限时间；
- 访问审计。

技术管理员不天然取得明文。

---

## 22. 文案

员工端：
- 尊重；
- 明确；
- 可修复；
- 不甩技术术语。

中心端：
- 准确；
- 责任明确；
- 给出规则与异常事实。

技术端：
- 可以使用 event id / trace id / error code；
- 不直接把技术术语暴露给员工。

错误推荐：
> 申请未提交。你的网络连接已经中断，内容仍保留在草稿中。恢复网络后可以再次提交。

不推荐：
> 操作失败，请稍后重试。

---

## 23. 日期、金额与编号

### 日期
- 存储/接口遵循服务端契约；
- 展示 `2026年8月7日 14:30`；
- 相对时间仅辅助；
- 截止事项必须能看到绝对日期。

### 金额
- `¥12,580.42`；
- 千分位；
- 不使用 float 计算业务金额；
- 前端只展示服务端事实；
- 不自行生成批准金额。

### 编号
- 业务编号由服务端生成；
- 前端 UUID 只用于幂等键、correlation 或明确允许的临时 ID。

---

## 24. 可访问性

目标：WCAG 2.2 AA 核心要求。

必须：
- 文字对比度；
- 键盘；
- focus-visible；
- aria-label；
- aria-live；
- 表单错误关联；
- 状态不只依赖颜色；
- 支持系统字体放大；
- 尊重 `prefers-reduced-motion`。

移动触控目标不小于 44×44px。

---

## 25. 动效

- Hover 120–180ms；
- Dialog 180–240ms；
- Drawer 220–300ms；
- 页面进入 240–360ms；
- 不用 700ms 长动画阻碍办公；
- 不做循环装饰动画；
- 关键任务不等待动效结束才能操作。

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 26. 性能

建议体验目标：
- LCP ≤ 2.5s；
- CLS ≤ 0.1；
- INP ≤ 200ms；
- 常规点击反馈 ≤ 100ms。

实现：
- 路由/特性懒加载；
- 首屏优先；
- 服务端分页；
- 大列表虚拟化；
- 图片延迟加载；
- 搜索防抖；
- 避免重复拉稳定字典；
- Skeleton 尺寸接近真实内容。

不得以客户端缓存敏感业务事实换性能。

---

## 27. AI 编码 MUST / MUST NOT

### 27.1 MUST

1. 使用 Vue 3 Composition API；
2. 使用 TypeScript strict；
3. 使用当前 Vite/Pinia/Vue Router；
4. 读取对应 Knowledge Base 页面架构；
5. 读取对应 `process_code`；
6. 使用统一 tokens；
7. 提供 Loading/Empty/Error/NoPermission；
8. 敏感数据默认脱敏；
9. 关键写操作处理重复点击；
10. 服务端最终裁决权限与状态；
11. 页面/Composable/Service 分层；
12. 移动端核心流程完整可达。

### 27.2 MUST NOT

1. 新增 React；
2. 新增 Next.js；
3. 新增 `.tsx` 业务页面；
4. 新增 Tailwind 作为平行体系；
5. 新增第二路由；
6. 新增第二状态管理；
7. 使用 `lucide-react`；
8. 用前端隐藏代替权限；
9. 写死员工、金额、日期、业务记录；
10. 生成假按钮/假成功；
11. 技术后台添加业务批准按钮；
12. 复制三套同业务事实；
13. 通过缩小中文字体解决布局；
14. 用 localStorage 存正式敏感事实；
15. 自行创造状态/流程/权限码。

---

## 28. 页面验收

### 全局
- [ ] 三端名称与 portal alias 一致
- [ ] 当前身份清楚
- [ ] 导航与 Knowledge Base 对齐
- [ ] 页面可返回
- [ ] 移动端完整可达
- [ ] 无横向异常溢出

### 视觉
- [ ] Indigo / Slate / Rose 语义一致
- [ ] 普通正文 >= 15px 优先
- [ ] Metadata >= 12px
- [ ] 卡片不滥用阴影
- [ ] 一屏一个主要视觉重点

### 组件
- [ ] Button 完整状态
- [ ] Form 完整错误状态
- [ ] List/Table loading-empty-error
- [ ] Dialog keyboard/focus
- [ ] Toast 说明具体结果

### 权限
- [ ] 前端隐藏与 API 拒绝一致
- [ ] 数据范围由服务端裁决
- [ ] L3/L4 脱敏
- [ ] Step-Up 场景正确
- [ ] 技术端无业务越权

### 业务
- [ ] 待办进入具体任务
- [ ] 申请可追踪
- [ ] 异常有处理入口
- [ ] 成功为服务端真实成功
- [ ] 刷新后状态一致
- [ ] 关闭状态满足流程门槛

---

## 29. 版本治理

### 29.1 版本号

`MAJOR.MINOR.PATCH`

- MAJOR：设计体系/端口架构重大变化；
- MINOR：新增组件/模板/规则；
- PATCH：细节修复。

### 29.2 设计变更

新增规则必须检查：
1. AGENT 是否允许；
2. Knowledge Base 是否有依据；
3. 现有 token/组件能否复用；
4. 三端影响；
5. 移动影响；
6. 可访问性；
7. 安全；
8. 回归测试。

### 29.3 设计债务

临时偏离必须记录：
- 问题；
- 页面；
- 原因；
- 临时方案；
- 风险；
- 责任人；
- 截止版本。

不得复制临时方案扩大债务。

---

## 30. 一句话执行基线

> **三端共享一个业务事实，员工看到清楚的下一步，中心看到真实的处理责任，技术看到可恢复的系统运行；前端统一使用 Vue 3 现有工程体系，任何视觉优化都不得制造第二技术栈、第二事实源或新的权限漏洞。**
