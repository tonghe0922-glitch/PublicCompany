# ADR-004｜PHASE-08 Route Catalog and Navigation Source Strategy

Status: `ACCEPTED_FOR_PHASE_08_C0`

## Context

六份权威页面 IA XLSX 已在当前分支由 `phase08_page_ia_extract.py` 实际解析：6/6、0 failure，并与 PHASE-01 的 7,126 条页面记录交叉验证。统一 IA 规范明确禁止根据中文页面标题自行创造 permission、process 或 data scope。

当前前端 Router 只有根 `/`，不能作为正式三端 IA 唯一事实源；同时 PHASE-08 只负责 Portal Shell/Router/导航基础设施，不能把 7,126 条业务页面提前标为 implemented。

## Decision

PHASE-08 的 Router/Navigation 使用双层来源：

1. **Raw source evidence**：六份 XLSX 当前 HEAD 的 Sheet/行解析证据 `PAGE_IA_EXTRACT.json`；
2. **Normalized source records**：PHASE-01 已从同一批工作簿生成的 page records，用于稳定 source_key/level/display/mobile/data-classification 等字段。

正式 route record 只为 PHASE-08 实际实现的 Shell 级页面生成，例如：

```text
login
portal-home-shell
forbidden
not-found
```

业务页面 IA 可以形成导航 taxonomy/planned metadata，但在所属业务 PHASE 实现前：

```text
status != implemented
implementation_path = null 或明确 planned
不得创建假业务页面
```

## Permission/process discipline

- `permission_codes` 只能来自 canonical IAM/页面来源映射；没有来源时保持空/blocked；
- `process_codes` 只能使用 P001–P126 已有映射；不得从模块名猜测；
- Router guard 只做 UX 门禁；API/RLS 仍是安全权威；
- 技术端 `admin` 路径只是 runtime alias，不表示业务超级管理员。

## Navigation projection

导航生成器只消费：

```text
portal_code
level_1/2/3
display_name
route_name/route_path（若已实现）
permission_codes（若有 canonical mapping）
mobile_access
status
```

规则：

1. 未实现业务页不能生成可点击的假 route；
2. 无真实待办/消息/KPI API 时不显示假 badge；
3. permission filter 只隐藏 UX 入口，不能代替后端 403；
4. mobile `limited/no` 必须呈现真实限制或替代路径，不能静默丢功能；
5. current route highlight 只基于 Router 当前匹配结果。

## Evidence

- `docs/implementation/phases/PHASE-08/PAGE_IA_EXTRACT.md`
- `docs/implementation/phases/PHASE-08/PAGE_IA_EXTRACT.json`
- `Knowledge Base/01 完整的页面架构/00_三端页面IA统一规范.md`
- `docs/implementation/contracts/phase-01/pages.json`
