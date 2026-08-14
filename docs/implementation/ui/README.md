# UI component access authority

This directory is the project-side canonical authority for Phase 10 UI
component access. The package under `I:\PublicCompany_组件核对与AI整改方案`
remains the remediation source; these files are its executable repository
projection.

Required authorities:

- `UI_COMPONENT_CONSTRUCTION_STANDARD.md`: the single public-access contract.
- `UI_PAGE_COMPOSITION_STANDARD.md`: the page planning and assembly contract.
- `UI_AI_IMPLEMENTATION_GUARDRAILS.md`: L1/L2/L3/BLOCKED gap decisions.
- `UI_COMPONENT_REGISTRY.json`: every Design System `.vue` component and all
  approved/planned higher-layer components.
- `UI_COMPONENT_REUSE_RULES.json`: reuse order and prohibited alternatives.
- `PAGE_COMPONENT_USAGE_PLAN.schema.json`: the machine-readable plan schema.
- `UI_NATIVE_ELEMENT_EXCEPTIONS.json`: temporary exceptions; currently empty.
- `page-component-plans/`: canonical plans required before page edits.
- `CURRENT_UI_COMPONENT_VIOLATIONS.json`: the latest real debt scan, never an
  exception list.

Public imports are fixed to `@sgj/ui` and `@sgj/platform-ui`. Deep imports into
component, template, layout, or platform-shared internals are prohibited. The
project Gate is `scripts/implementation/ui_component_access_gate.py`.
