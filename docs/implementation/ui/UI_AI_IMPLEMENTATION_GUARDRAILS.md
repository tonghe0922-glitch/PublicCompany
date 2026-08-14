# 12｜组件缺口判定、扩展与注册流程

> “组件不够再设计”必须被解释为：在完成检索和组合分析后，在正确层级新增最小能力；不是允许 AI 在页面中临时设计一个新控件。

---

## 1. 四类缺口

### A｜现有组件合同缺口

例：`SgjSelect` 缺少 typed `change`、`SgjDrawer` 缺少 `closeOnBackdrop`。

处理：修改原组件合同并补回归测试，不新建 `BetterSelect.vue` 或 `SafeDrawer.vue`。

### B｜平台复合能力缺口

例：异步状态边界、409 冲突、动作确认、目录适配、服务端分页表格。

处理：在 `platform/processes/shared` 组合 L1 组件，公开到 `@sgj/platform-ui`。

### C｜流程专用领域缺口

例：P008 假期额度摘要、P009 补偿方案、P010 资格证卡片。

处理：进入对应 `platform/processes/pXXX`；可复用基础体验，但不抹平流程语义。

### D｜合同阻塞

例：没有真实文件上传 API、没有人员目录 API、没有导出权限合同。

处理：明确 `BLOCKED_BY_CONTRACT`，显示可理解的阻塞状态；禁止静态候选、假进度、假下载和“前端先完成”。

---

## 2. 新增 L1 组件的最低门槛

必须同时满足：

- 现有注册表无同类组件；
- 组合现有组件无法清晰表达；
- 交互语义跨业务可复用；
- 不依赖 API、权限码、流程码或具体数据模型；
- 至少两个独立使用场景，或属于平台必需基础交互；
- 组件名是 UI 语义，不是页面/模块名称；
- Props/Emits/Slots 有稳定类型；
- default/hover/focus/disabled/loading/error 等状态明确；
- 键盘、焦点、ARIA、移动端明确；
- 已有 VTU/浏览器测试；
- 已加入 `design-system/index.ts` 和注册表。

未满足时，优先 L2/L3 或 BLOCKED。

---

## 3. 新增组件固定产物

每个新增公共组件必须同时提交：

```text
1. 组件源码
2. 类型定义
3. 样式/token 变更（如有）
4. 单元测试/可访问性测试
5. 公共 index.ts 导出
6. UI_COMPONENT_REGISTRY.json 条目
7. 使用示例
8. 迁移/影响说明
9. 原组件替代或废弃策略（如适用）
```

只创建 `.vue` 文件，不算组件库建设完成。

---

## 4. 注册表条目要求

模板见：

```text
templates/COMPONENT_REGISTRY_ENTRY.template.json
```

关键字段：

```text
id
name
layer
status
public
public_import
implementation_path
export_name
category
keywords_zh
keywords_en
replaces_native
use_when
do_not_use_for
required_states
accessibility
security_boundary
required_tests
examples
owner
version
```

规则：

- `id` 永久稳定；组件改名也不得复用旧 ID 表示另一语义；
- `status` 只能从批准枚举选择；
- `planned/blocked` 组件不得被页面当作已完成调用；
- `deprecated` 必须给 replacement 和删除期限；
- 组件入口、路径、注册表三者必须一致。

---

## 5. 修改现有组件还是新增组件

优先修改现有组件，当：

- 新需求仍属于原组件的核心语义；
- 通过可选 Props/Slots 可以向后兼容；
- 不引入具体业务依赖；
- 不让组件承担过多职责。

优先新增复合组件，当：

- 需要同时组合多个原子组件；
- 包含平台级异步/权限/错误编排；
- 修改原组件会污染纯 UI 边界；
- 不同页面反复出现相同组合。

优先新增领域特性组件，当：

- 组件名称和字段只有某个流程有意义；
- 状态、动作或校验来自该流程；
- 其他流程只是“视觉相似”，业务语义不同。

---

## 6. 防止组件爆炸

禁止以下命名和模式：

```text
CommonButton.vue
AppButton.vue
BlueButton.vue
EmployeeButton.vue
P008Input.vue
UniversalForm.vue
CommonEverything.vue
```

治理规则：

- 只有颜色不同，不新增组件，使用批准 variant/token；
- 只有文案不同，不新增组件，使用 Props/Slots；
- 只有页面布局不同，优先模板/布局组合；
- 只有业务规则不同，不塞进公共 UI，留在领域层；
- 两个组件合同 80% 以上一致时，先评估合并或共享基础能力；
- 一个组件出现大量 `if (portal/process/type)` 时，应拆分策略或领域组件。

---

## 7. 组件版本与废弃

公共合同变更必须分类：

- **Patch**：样式/无障碍/缺陷修复，不改变调用合同；
- **Minor**：向后兼容的新 Props/Slots/variant；
- **Breaking**：删除/改名/语义变化，必须 ADR、迁移清单和过渡期。

废弃流程：

```text
标记 deprecated
→ 注册表写 replacement
→ 控制台/类型注释提示
→ 批量迁移调用方
→ Gate 禁止新增引用
→ 到期删除
```

禁止静默删除公共导出。

---

## 8. 组件评审问题

评审新增或修改组件时必须回答：

1. 注册表中是否已有同类能力？
2. 为什么不能使用 Props/Slots 或组合？
3. 该能力属于 L1、L2 还是 L3？
4. 是否把业务规则错误塞入公共 UI？
5. 是否支持三端和移动端，而不是复制三份？
6. 是否覆盖 loading/error/disabled/focus/keyboard？
7. 是否有敏感数据或权限泄漏风险？
8. 是否新增 token，新增是否有通用语义？
9. 是否已经导出、注册和测试？
10. Gate 能否阻止未来再造同类组件？

---

## 9. 典型判定示例

### 示例 1｜开始/结束日期

现有 `SgjDateTime` 可表达单值，但多个页面重复成对使用并需要顺序提示。

结论：新增 L2 `DateTimeRangeField`，内部组合两个 `SgjDateTime`；不修改 `SgjDateTime` 去理解请假/加班。

### 示例 2｜人员选择

`SgjPersonPicker` 只是本地 options UI，真实页面需要远端搜索和数据范围。

结论：保留 L1，新增 L2 `DirectoryPersonPickerAdapter`；没有目录 API 时 BLOCKED，不把 API 塞进 L1。

### 示例 3｜P010 资格信息

只在学习/考试/资格流程出现，包含证书生效、到期和权限联动。

结论：新增 L3 `QualificationCard`；不加入通用 Design System。

### 示例 4｜新颜色按钮

页面想要橙色按钮。

结论：先核对语义。若只是视觉偏好，不新增；若表示平台统一 warning action，可扩展 `SgjButton` 的语义 variant，并更新 token、测试和注册表。

