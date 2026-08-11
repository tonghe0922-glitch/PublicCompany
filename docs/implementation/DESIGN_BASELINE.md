# DESIGN_BASELINE

> 来源：当前 `agent/full-build` 分支根 `DESIGN.md` V2.0（baseline 2026-08-07）。本文件只做执行提取，不创造业务状态、权限或页面职责。

## 1. 三端与实现边界

| Canonical | 中文 | Runtime alias | 目标 |
|---|---|---|---|
| `employee` | 员工端 | `employee` | 本人发起、执行、补充、确认、查询 |
| `center` | 中心管理端 | `center` | 受理、审核、分派、专业复核、验收 |
| `tech` | 技术后台端 | `admin` | 配置、监控、重试、补偿、审计 |

- `admin` 只是当前 runtime/build alias，不是第四端，也不等于业务超级管理员。
- 三端共享同一业务事实、业务主键、流程实例、服务端状态和流程版本。
- 页面 IA 必须从 Knowledge Base 六份页面架构 Excel 建立追溯，禁止凭中文标题猜权限码或流程码。

页面正式追溯字段至少包含：

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

## 2. 设计气质

- 现代企业门户；
- 清晰直接、稳重可信；
- 轻量卡片化；
- 大字号、强任务导向、明确状态；
- 适度科技感、克制动效；
- 数据安全感；
- 员工友好、管理高效率、技术高信息密度但不越权。

必须保留：Indigo 品牌、Slate 灰阶、浅灰工作区+白卡、桌面侧栏、移动底栏、12 栅格、KPI 大字号、状态“文字+颜色/图标”、轻微页面淡入、普通卡边框优先轻阴影。

## 3. Design Tokens

正式实现使用 CSS Variables，不依赖 Tailwind。

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

语义：Brand=Indigo、Success=Emerald、Warning=Amber、Danger=Rose、Info=Blue、Neutral=Slate。

间距：`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48`。

圆角：标签 8、控件 12、标准卡 16、KPI 20、大型强调 24px。

## 4. 字体与可读性

字体栈：

```text
Inter,
SF Pro Display,
SF Pro Text,
PingFang SC,
Microsoft YaHei,
Noto Sans CJK SC,
system-ui,
sans-serif
```

字号基线：

| 层级 | 桌面 | 移动 |
|---|---:|---:|
| Display | 40 | 32 |
| Page Title | 32 | 24 |
| Section Title | 24 | 20 |
| Card Title | 18 | 17 |
| Body Large | 16 | 16 |
| Body | 15–16 | 15–16 |
| Secondary | 14 | 14 |
| Metadata | 13 | 13 |
| Minimum | 12 | 12 |

禁止通过缩小中文字体解决布局，常规正文不得落到 8/9/10px。

## 5. 桌面布局

- Top Header：72–80px；
- Sidebar 展开：280–288px；
- Sidebar 收起：72–80px；
- 主内容最大宽度：1600px；
- 页面水平内边距：32–48px；
- 页面底部安全区：48px；
- 顶部栏/侧栏固定，内容区独立滚动；
- 只有必要的全局告警吸顶。

常用 12 栅格：8+4、9+3、6+6、4+8、4+4+4；敏感业务单列 768–960px。

## 6. 移动布局

- 轻量顶部标题栏；
- 单列内容；
- 固定底部导航；
- “更多”承载完整 IA，不得删功能；
- 高频提交可使用底部固定操作区；
- 适配安全区；
- 二三级页面必须有返回能力；
- 员工端底部主入口最多 5 项。

## 7. 响应式语义

```text
mobile      < 640
large-phone >= 640
tablet      >= 768
desktop     >= 1024
wide        >= 1280
xl-wide     >= 1536
```

不得为单页制造大量临时断点、用缩小字体代替响应式或把桌面大表硬塞进手机。

## 8. 全局组件基线

App Shell：

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

组件：

- Button：`primary / secondary / ghost / danger`，具备 default/hover/active/focus-visible/disabled/loading；写操作 loading 防重复提交。
- Card：`default / muted / spotlight`，一卡一主题。
- StatusChip：`neutral / info / success / warning / danger`；状态名来自服务端/状态目录。
- 数据区：Loading / Empty / Error / Partial / Retry / NoPermission。
- Dialog：简单确认；Drawer/Page：复杂详情/表单；移动复杂操作优先全屏 Sheet。
- Table：服务端分页、稳定操作列、加载/空/错、独立导出权限，移动端转卡片或受控横滚。

## 9. 三端首页任务优先级

员工端：安全/紧急 → 今日待办/到期/逾期 → 排班打卡 → 高频申请 → 专业业务 → 通知会议学习 → 成长福利。

中心端：超时/高风险 → 待受理/审核/验收 → 人员排班资源异常 → 跨中心阻塞 → 指标 → 今日事件 → 数据质量。

技术端：服务健康 → API/DB/Worker/集成异常 → Outbox/Retry/DLQ → 流程版本 → 权限/配置变更 → 数据质量/技术补偿 → 审计发布 → 恢复演练。

技术端禁止出现批准报销、确认支付、决定纪律处分、直接改薪资、直接关闭采购、强制业务完成等业务越权动作。

## 10. 表单、状态与反馈

- 表单三层校验：前端 Schema/组件 → API DTO → 服务端领域规则。
- `companyId`、`employeeId`、`approverId`、`approvedAmount`、`finalStatus`、`createdBy`、audit fields、dataScope 等高风险字段不得信任前端。
- 自动保存只保存有版本的草稿，不等于正式提交，必须处理冲突。
- 前端只提交已批准动作，不提交任意目标状态。
- 页面应区分 `workflow_status / business_status / validity_status / archive_status / domain_stage`。
- 所有正式页面必须处理 Loading、Empty、Error、NoPermission、Conflict、PartialFailure（适用）、Retry/人工帮助与服务端最终结果。

## 11. Vue 实现映射

新代码：Vue 3 Composition API + `<script setup lang="ts">`。

复杂页面采用：

```text
PageShell.vue
features/
composables/
services/
selectors/
types/
```

- PageShell 只负责页面外壳、路由上下文、区块组合和公共加载错误外框。
- Composable 负责请求、局部状态、动作、取消、竞态和生命周期清理。
- API Service 统一 Authorization、Request ID、Idempotency-Key、Step-Up、ApiError、traceId、取消。
- Pinia 只保存会话、当前身份、跨页面客户端状态和必要缓存，不长期保存薪资、合同正文、证件、银行卡、健康档案。
- 复杂度阈值与 AGENT 一致：SFC 300、script 180、template 180、函数 40、嵌套 3、顶层函数 15、computed 25、圈复杂度 10。

## 12. 异步与竞态

建议统一：

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

- 不使用一个全局 busy 管多个请求；
- route change/unmount 取消；
- 旧请求不能覆盖新状态；
- 非幂等写无 Idempotency-Key 不自动重试；
- 禁止空 catch；
- 失败不能继续显示成功。

## 13. 可访问性

目标：WCAG 2.2 AA 核心要求。

必须覆盖：

- 文本对比度；
- 键盘操作；
- `focus-visible`；
- `aria-label`；
- `aria-live`；
- 表单错误关联；
- 状态不只依赖颜色；
- 系统字体放大；
- `prefers-reduced-motion`；
- 移动触控目标不小于 44×44px。

动效应克制：Hover 120–180ms、Dialog 180–240ms、Drawer 220–300ms、页面进入 240–360ms；关键任务不能等待装饰动效。

## 14. 安全显示

- P0/P1/P2/P3 映射 DATA-L1/L2/L3/L4。
- L3/L4 默认脱敏；完整查看需要后端权限、Step-Up、有限时间和访问审计。
- 菜单/按钮隐藏不是安全边界，API 必须验证 user、active assignment、permission、data scope、field level、state、Step-Up、conflict-of-interest。
- 技术管理员不天然取得敏感明文。

## 15. MUST NOT

禁止新增 React、Next.js、`.tsx` 业务页、Tailwind 平行体系、第二套路由、第二状态管理、`lucide-react`；禁止前端隐藏代替权限、写死真实员工/金额/日期/业务记录、假按钮/假成功、技术端业务批准动作、三端复制同一业务事实、缩小中文字体解决布局、localStorage 存敏感事实、自创状态/流程/权限码。
