# 10｜UI 组件库统一接入规范

> 适用项目：`I:\PublicCompany_source_codex`  
> 适用范围：员工端、中心管理端、技术后台端，以及后续所有新页面与页面改造  
> 目标：让 AI 和人工研发在写页面前先检索、组合并调用统一 UI 组件库；只有确认存在真实缺口时，才在正确层级扩展组件。

---

## 1. 核心结论

“以后所有页面优先调用 UI 组件库，不够再设计”的思路是正确的，但必须同时具备以下四个机制，否则 AI 仍会在页面中临时造控件：

1. **唯一公开入口**：页面只能从批准的 barrel/alias 导入组件；
2. **机器可读注册表**：AI 能检索组件用途、状态、替代关系和禁止职责；
3. **页面组件使用计划**：写代码前先把页面字段、状态、动作映射到已有组件；
4. **自动门禁**：发现原生交互控件、深层导入、未注册组件、重复基础组件时直接失败。

因此，本规范不是“建议优先复用”，而是可检查的工程合同：

```text
先查注册表 → 优先直接复用 → 再组合复用 → 再做领域特性组件
→ 只有无法表达通用交互语义时才新增基础组件
```

---

## 2. 在本地仓库中的 canonical 落点

执行 `P10-COMP-03A` 时，应把本包内容同步为项目内长期规范：

```text
I:\PublicCompany_source_codex\
├── docs/implementation/ui/
│   ├── UI_COMPONENT_ACCESS_STANDARD.md
│   ├── UI_COMPONENT_REGISTRY.json
│   ├── UI_COMPONENT_REUSE_RULES.json
│   ├── PAGE_COMPONENT_USAGE_PLAN.schema.json
│   ├── UI_NATIVE_ELEMENT_EXCEPTIONS.json
│   └── page-component-plans/
├── technical-platform/web/src/design-system/index.ts
├── technical-platform/web/src/platform/processes/shared/index.ts
└── scripts/implementation/ui_component_access_gate.py
```

根 `AGENT.md` 和 `DESIGN.md` 只需增加 canonical 指针与硬规则，不要复制出第三份可独立演进的完整规范。

---

## 3. UI 复用层级

### L0｜Design Tokens

负责颜色、字号、间距、圆角、阴影、动效、层级和响应式基础。

- 页面不得自行建立第二套颜色和尺寸体系；
- 页面样式必须优先使用 `--sgj-*` token；
- 缺 token 时先判断是否为通用语义，再在 token 层补充；
- 业务状态名称、金额、审批规则不属于 token。

### L1｜Design System 纯 UI 组件

目录：

```text
technical-platform/web/src/design-system
```

公开入口：

```ts
import { SgjButton, SgjInput, SgjCard } from '@sgj/ui'
```

职责：无业务语义、无 API、无流程码、无人员目录真值、无权限最终裁决。

### L2｜平台复合组件

目录：

```text
technical-platform/web/src/platform/processes/shared
```

公开入口：

```ts
import {
  AsyncStateBoundary,
  PermissionGate,
  ProcessActionPanel,
} from '@sgj/platform-ui'
```

职责：组合 L1，承载平台通用的异步状态、错误、权限展示、确认、冲突、记录元信息和目录适配；不得承载 P006–P126 的具体状态机。

### L3｜流程/领域特性组件

目录：

```text
technical-platform/web/src/platform/processes/<process_code>
```

例如：

```text
p006/MeetingCreateForm.vue
p008/LeaveQuotaSummary.vue
p010/QualificationCard.vue
```

职责：只服务明确领域或流程，可调用 L1/L2；不能复制基础按钮、输入框、弹窗或表格。

### L4｜页面模板与布局

使用：

```text
SgjListPageTemplate
SgjDetailPageTemplate
SgjFormPageTemplate
SgjApprovalPageTemplate
SgjTimelinePageTemplate
SgjDashboardPageTemplate
SgjPortalShell
```

职责：定义页面结构、landmark、标题、操作区和内容 slot，不处理业务命令。

### L5｜薄页面壳

目录：

```text
technical-platform/web/src/platform/pages
```

页面只负责：

- 选择页面模板；
- 组合领域特性组件；
- 连接 route 参数；
- 连接页面级 composable；
- 设置页面标题和少量展示编排。

页面禁止：

- 直接调用 `session.request`；
- 拼接 `/api/`；
- 散落权限码、动作码和状态表；
- 直接使用原生交互控件；
- 创建可复用基础 UI；
- 维护跨多个流程的巨型条件分支。

---

## 4. 唯一导入合同

### 4.1 批准的导入方式

```ts
import {
  SgjButton,
  SgjFormPageTemplate,
  SgjInput,
  SgjStatusChip,
} from '@sgj/ui'

import {
  AsyncStateBoundary,
  FormErrorSummary,
  ProcessActionPanel,
} from '@sgj/platform-ui'
```

### 4.2 禁止的导入方式

```ts
// 禁止：绕过公共出口，绑定内部文件结构
import Button from '../../design-system/components/Button.vue'
import Dialog from '@/design-system/components/Dialog.vue'
import PageTemplateFrame from '@/design-system/templates/PageTemplateFrame.vue'

// 禁止：新建第二套 UI 包
import AppButton from '@/components/common/AppButton.vue'
```

### 4.3 推荐别名配置

`technical-platform/web/tsconfig.app.json`：

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@sgj/ui": ["src/design-system/index.ts"],
      "@sgj/platform-ui": ["src/platform/processes/shared/index.ts"]
    }
  }
}
```

`technical-platform/web/vite.config.ts`：

```ts
import { fileURLToPath, URL } from 'node:url'

resolve: {
  alias: {
    '@sgj/ui': fileURLToPath(new URL('./src/design-system/index.ts', import.meta.url)),
    '@sgj/platform-ui': fileURLToPath(
      new URL('./src/platform/processes/shared/index.ts', import.meta.url),
    ),
  },
}
```

迁移期间允许从 `../design-system` 的 barrel 导入，但最终目标必须收敛到固定 alias；不得为了别名迁移同时改变业务行为。

---

## 5. AI 写页面前的强制流程

任何 AI 在创建或修改页面前，必须按顺序完成：

### STEP 1｜读取规范与真实出口

```text
AGENT.md
DESIGN.md
docs/implementation/ui/UI_COMPONENT_ACCESS_STANDARD.md
docs/implementation/ui/UI_COMPONENT_REGISTRY.json
docs/implementation/ui/UI_COMPONENT_REUSE_RULES.json
technical-platform/web/src/design-system/index.ts
technical-platform/web/src/platform/processes/shared/index.ts
```

### STEP 2｜解析页面事实

至少确认：

```text
portal_code
route_path
process_codes
permission_codes
data_scope
sensitive_level
page_type
fields
actions
loading/empty/error/partial/conflict states
mobile behavior
```

### STEP 3｜检索注册表

按中文关键词、英文关键词、原生控件替代项、页面类型和状态需求检索组件，不能只凭记忆猜组件名称。

### STEP 4｜生成页面组件使用计划

在写代码前生成：

```text
docs/implementation/ui/page-component-plans/<PageName>.ui-plan.json
```

必须列出：

- 页面模板；
- 每个字段使用的组件；
- 每个异步状态使用的组件；
- 每个动作使用的组件；
- 移动端投影；
- 组件缺口；
- 缺口处理决定；
- 是否存在原生元素例外。

模板见：

```text
templates/PAGE_COMPONENT_USAGE_PLAN.template.json
```

### STEP 5｜执行复用决策树

```text
已有组件可直接表达？
  ├─ 是 → 直接调用
  └─ 否
      已有组件可组合表达？
        ├─ 是 → 在 L2 或 L3 组合，不改基础组件职责
        └─ 否
            是否为跨流程通用平台能力？
              ├─ 是 → 新增 L2 复合组件
              └─ 否
                  是否只属于当前业务流程？
                    ├─ 是 → 新增 L3 领域特性组件
                    └─ 否
                        是否确属新的通用交互语义？
                          ├─ 是 → 经缺口流程新增 L1，并注册、导出、测试
                          └─ 否 → 标记 BLOCKED，禁止在页面伪造
```

### STEP 6｜先测试，再实现

至少覆盖：

- Props/Emits/Slots；
- loading/disabled/error/permission-denied；
- 键盘与焦点；
- 移动视口；
- 409/重复点击/取消请求；
- 敏感信息 fail-closed。

### STEP 7｜更新注册表与使用计划

任何新增或公开合同变更，都必须同步：

```text
UI_COMPONENT_REGISTRY.json
相关 index.ts
组件测试
页面使用计划
变更说明
```

未注册、未导出或无测试的组件，不得被认定为公共组件完成。

---

## 6. 原生交互元素替代规则

业务页面和领域特性组件默认禁止直接新增以下元素：

| 原生元素 | 必须优先使用 |
|---|---|
| `<button>` | `SgjButton` |
| `<input type="text/number/date/...">` | `SgjInput` / `SgjDateTime` |
| `<textarea>` | `SgjTextarea` |
| `<select>` | `SgjSelect` / `SgjCascader` / Picker Adapter |
| `<input type="checkbox">` | `SgjCheckbox` |
| `<input type="radio">` | `SgjRadioGroup` |
| `<input type="file">` | `SgjUpload`，正式上传由 `ManagedUpload` |
| `<table>` | `SgjTable` 或 `DataTable<T>` |
| 自制 modal | `SgjDialog` / `ConfirmDialog` |
| 自制 side panel | `SgjDrawer` |
| 自制状态徽标 | `SgjStatusChip` |
| 自制 loading/empty/error | `AsyncStateBoundary` + 状态组件 |

允许的原生结构元素包括：`main` 之外的语义结构标签、`section`、`article`、`header`、`footer`、`nav`、`ul/ol/li`、`dl/dt/dd`、`p`、`h2-h6` 等；每个正式路由最终只能有一个 `main` 和一个主 `h1`。

确需原生交互元素时，必须登记在：

```text
docs/implementation/ui/UI_NATIVE_ELEMENT_EXCEPTIONS.json
```

每条例外必须包含 path、tag、原因、责任人、到期日和替代计划。禁止用注释或 `eslint-disable` 永久绕过。

---

## 7. 标准页面组装

### 7.1 列表页

```text
SgjListPageTemplate
├── Filter/Search 复合区
├── AsyncStateBoundary
│   ├── DataTable<T>（桌面）
│   └── RecordCardList（移动）
├── Pagination
└── RowAction → ProcessActionPanel
```

### 7.2 表单页

```text
SgjFormPageTemplate
├── FormErrorSummary
├── 领域 FormSection
│   └── SgjInput/Select/DateTime/Picker...
├── Draft/Conflict 状态
└── SgjButton / ConfirmDialog
```

### 7.3 详情页

```text
SgjDetailPageTemplate
├── ProcessRecordMeta
├── DescriptionList
├── Evidence/Attachment 区
├── ProcessTimeline
└── ProcessActionPanel
```

### 7.4 审批/处理页

```text
SgjApprovalPageTemplate
├── 对象摘要
├── 风险/权限/敏感提示
├── 材料与历史
├── 意见字段
└── HighRiskConfirmDialog
```

### 7.5 驾驶舱/监控页

```text
SgjDashboardPageTemplate
├── KpiCard
├── 白名单聚合表/图
├── 数据时间与口径
├── 部分失败说明
└── Drill-down（受权限控制）
```

技术端不得使用 `JSON.stringify` 直接输出业务聚合，不得因为“监控”而展示全部业务正文。

---

## 8. 状态、权限和安全接入

所有数据区必须显式覆盖：

```text
idle
loading
success
empty
partial
error
cancelled
permission-denied
conflict
```

规则：

- 权限显示由 `PermissionGate` 改善体验，最终鉴权仍在 API；
- 业务动作按钮必须来自服务端允许动作或冻结合同，不能由颜色/页面名称猜测；
- 写操作必须有独立 loading、Idempotency-Key 和重复点击保护；
- 409 使用 `VersionConflictPanel`，不得覆盖用户输入；
- 敏感数据默认 `MaskedValue/StepUpReveal` fail-closed；
- Toast 只表示请求反馈，不表示流程已完成；
- 技术 monitor 权限不得推出 approve/review/accept/certify。

---

## 9. 样式与响应式规则

- 组件库决定控件尺寸、焦点、状态、圆角和颜色；
- 页面允许做布局编排，不允许重做控件视觉；
- 页面 CSS 优先使用 grid/flex 和 token；
- 禁止复制 `.sgj-button`、`.sgj-control` 等内部样式；
- 禁止通过极小字号把桌面表格塞进手机；
- 移动端必须使用卡片、分组、底部动作区或受控横向滚动；
- 新组件必须尊重 reduced motion、键盘操作和 44px 触控目标。

---

## 10. 公共组件新增判定

只有同时满足以下条件，才允许新增 L1 公共组件：

1. 现有组件无法通过 Props/Slots/组合表达该交互；
2. 该能力没有具体流程状态、权限码和 API 语义；
3. 至少有两个独立场景，或有明确平台级设计必要性；
4. 名称描述 UI 语义，而不是业务页面名称；
5. 完整定义 Props/Emits/Slots/状态/ARIA；
6. 已登记注册表、公开导出并有测试；
7. 不引入第二套 CSS/UI 框架。

仅一个流程需要的业务区块，应放 L3；多个流程共享的平台行为，应放 L2；缺服务端合同的能力应标记 BLOCKED，而不是造一个“看起来能用”的组件。

---

## 11. 自动 Gate

本包新增：

```text
LOCAL/ui_component_access_gate.py
LOCAL/test_ui_component_access_gate.py
LOCAL/03_运行UI组件接入Gate.ps1
```

Gate 至少检查：

- 页面/领域组件是否直接使用原生交互控件；
- 是否深层导入 Design System 内部文件；
- 是否在 Design System 外重复创建基础组件；
- Design System 与平台复合组件是否全部注册、公开导出；
- 注册表中的现有组件路径、出口和测试是否存在；
- 页面组件使用计划是否存在且引用合法组件 ID；
- `@sgj/ui`、`@sgj/platform-ui` alias 是否建立；
- 是否存在未批准原生元素例外；
- 是否出现未定义 token 和绕过类型检查。

采用质量棘轮：PHASE-10 先对 P006–P010 强制；后续对所有新增/修改页面强制；旧页面逐步迁移，不允许新增债务。

---

## 12. 页面完成定义

页面只有同时满足以下条件才算完成：

- 已生成并通过组件使用计划校验；
- 组件全部来自批准出口，或已按流程注册新组件；
- 无原生交互控件和深层导入；
- 页面壳不含 API URL、权限表、动作表和业务状态机；
- 具备 loading/empty/error/partial/conflict/permission 状态；
- PC 与移动端可用；
- 键盘、焦点、ARIA 和触控目标通过；
- 复用率、复杂度、重复率满足门禁；
- UI 组件接入 Gate、typecheck、lint、unit、build、E2E 真实通过。

这套机制的最终目标不是把所有页面做成同一个样子，而是统一基础体验和平台行为，同时保留员工端、中心端、技术端的任务差异和业务语义。

