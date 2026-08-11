# PHASE-08 PAGE IA NAVIGATION SOURCE

> 由 PAGE_IA_EXTRACT.json 确定性派生，仅保留一级/二级 IA；不把 planned 业务页面自动升级成可点击 route。

## Counts

- employee: **885** source records
- center: **1417** source records
- tech: **1510** source records

## Activation rules

- business entry 必须 `status=implemented` 且 route_path 已存在于真实 Router；
- permission code 只使用 canonical source；多个 permission 时 fail-closed，全部满足才可显示；
- `mobile_access=no` 在移动端不显示；`limited` 保留限制标识，不扩大能力；
- planned taxonomy 可以用于结构说明，但不能生成假业务页面、假 badge、假搜索、假消息。

Machine source: `technical-platform/web/src/router/generated/portal-ia-navigation.json`.
