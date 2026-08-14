# 11｜AI 页面组件接入与组装模板

> 本文件可直接作为今后任何页面开发或整改的固定前置提示词。AI 未完成“组件使用计划”前，不得开始批量写 Vue 页面代码。

---

## 1. AI 固定指令

```text
你正在修改 I:\PublicCompany_source_codex。

本任务必须遵守 UI 组件库统一接入规范：

1. 先读取 AGENT.md、DESIGN.md、docs/implementation/ui/UI_COMPONENT_ACCESS_STANDARD.md；
2. 读取 UI_COMPONENT_REGISTRY.json、UI_COMPONENT_REUSE_RULES.json；
3. 实际读取 src/design-system/index.ts 与 src/platform/processes/shared/index.ts；
4. 在写代码前生成 <PageName>.ui-plan.json；
5. 页面只能从 @sgj/ui、@sgj/platform-ui 或本流程公开出口导入组件；
6. 禁止页面直接新增 input/select/textarea/button/table/modal/drawer/loading/error 等基础实现；
7. 现有组件能组合时不得新增；
8. 缺口必须按 L1/L2/L3/BLOCKED 分类，禁止在页面临时造轮子；
9. 新公共组件必须注册、导出、测试、写使用边界；
10. 最终运行 UI 组件接入 Gate，并报告真实结果。
```

---

## 2. 写代码前必须输出的组件使用计划

使用：

```text
templates/PAGE_COMPONENT_USAGE_PLAN.template.json
```

最少包含以下内容：

```json
{
  "page": "P008LeavePage",
  "portal_codes": ["employee", "center"],
  "route_paths": ["/employee/...", "/center/..."],
  "process_codes": ["P008"],
  "page_type": "form+detail+action",
  "page_template": "ui.template.form-page",
  "field_component_map": [
    {
      "field": "subject",
      "component_id": "ui.input",
      "reason": "普通单行文本"
    },
    {
      "field": "startAt/endAt",
      "component_id": "platform.datetime-range-field",
      "reason": "成对时间范围与顺序提示"
    }
  ],
  "state_component_map": [
    {
      "state": "loading/empty/error/partial",
      "component_id": "platform.async-state-boundary"
    },
    {
      "state": "409",
      "component_id": "platform.version-conflict-panel"
    }
  ],
  "action_component_map": [
    {
      "action": "submit",
      "component_id": "ui.button"
    },
    {
      "action": "approve/reject",
      "component_id": "platform.process-action-panel"
    }
  ],
  "gaps": [],
  "native_element_exceptions": [],
  "decision": "reuse-only"
}
```

AI 必须先展示该计划和缺口结论，再开始改代码。

---

## 3. 推荐页面代码骨架

```vue
<script setup lang="ts">
import {
  SgjFormPageTemplate,
  SgjInput,
  SgjTextarea,
} from '@sgj/ui'
import {
  AsyncStateBoundary,
  FormErrorSummary,
  ProcessActionPanel,
} from '@sgj/platform-ui'
import { useP008LeavePage } from '../processes/p008'

const page = useP008LeavePage()
</script>

<template>
  <SgjFormPageTemplate
    title="请假申请"
    description="填写休假时间、原因与工作交接信息。"
  >
    <FormErrorSummary :errors="page.formErrors.value" />

    <AsyncStateBoundary :state="page.resourceState.value">
      <P008LeaveForm
        v-model="page.form.value"
        :disabled="page.submitState.value.phase === 'loading'"
      />

      <ProcessActionPanel
        :actions="page.allowedActions.value"
        :states="page.actionStates.value"
        @execute="page.execute"
      />
    </AsyncStateBoundary>
  </SgjFormPageTemplate>
</template>
```

页面壳应保持薄；字段区、记录区和流程动作区进入 `platform/processes/p008`。

---

## 4. 常见需求与组件选择

| 页面需求 | 首选组件/组合 |
|---|---|
| 普通文本 | `SgjInput` |
| 多行原因/意见 | `SgjTextarea` |
| 枚举选择 | `SgjSelect` |
| 日期时间 | `SgjDateTime` |
| 开始/结束范围 | `DateTimeRangeField` |
| 人员选择 | `DirectoryPersonPickerAdapter`；无真实目录时 BLOCKED |
| 组织选择 | `DirectoryOrganizationPickerAdapter` |
| 开关 | `SgjSwitch` |
| 复选确认 | `SgjCheckbox` |
| 文件选择 | `SgjUpload`；正式上传由 `ManagedUpload` |
| 列表加载 | `AsyncStateBoundary` + `DataTable<T>`/`SgjList` |
| 记录摘要 | `SgjRecordCard` + `ProcessRecordMeta` |
| 状态 | `SgjStatusChip`，文本来自服务端 |
| 无权限 | `PermissionGate` + `SgjNoPermission` |
| 冲突 | `VersionConflictPanel` |
| 普通确认 | `ConfirmDialog` |
| 高风险操作 | `HighRiskConfirmDialog` |
| 敏感字段 | `SgjMaskedValue` / `SgjStepUpReveal` |
| 页面错误 | `ApiErrorNotice` / `FormErrorSummary` |
| KPI | `SgjKpiCard`，必须带单位、口径和数据时间 |
| 时间线 | `SgjTimelinePageTemplate` + 领域 Timeline 组件 |

---

## 5. AI 遇到缺口时的固定回答格式

```text
组件缺口编号：UI-GAP-xxx
需求场景：
已检索组件：
为什么不能直接复用：
为什么不能组合复用：
缺口层级：L1 / L2 / L3 / BLOCKED
建议组件名：
通用性证据：
Props/Emits/Slots：
状态与无障碍：
安全边界：
测试计划：
注册表与出口更新：
影响页面：
```

没有完成以上分析，不得直接新增 `BaseXxx.vue`、`CommonXxx.vue`、`AppXxx.vue`。

---

## 6. 完工报告模板

```text
页面：
路由：
process_code：
使用的页面模板：
复用的 L1 组件：
复用的 L2 组件：
新增的 L3 特性组件：
新增/修改的公共组件：
组件使用计划路径：
原生元素例外：无 / 列表
深层导入：0
页面内 API URL：0
页面内权限/动作表：0
UI 组件接入 Gate：PASS/FAIL
typecheck/lint/unit/build/E2E：
阻塞项：
```

---

## 7. 绝对禁止示例

```vue
<!-- 禁止：页面自己造控件 -->
<input v-model="name">
<button @click="submit">提交</button>

<!-- 禁止：页面直接接 API -->
<script setup lang="ts">
await session.request('/api/v1/...')
</script>

<!-- 禁止：绕过公共出口 -->
<script setup lang="ts">
import Button from '../../design-system/components/Button.vue'
</script>

<!-- 禁止：为单页复制公共样式 -->
<style scoped>
.my-button { /* 复制 SgjButton 视觉 */ }
</style>
```

正确做法是调用已有组件，或在正确层级增加可复用组合。

