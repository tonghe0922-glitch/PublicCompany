# Design System public component contracts

This document records the public behavior of the existing P10-COMP-01 components. It does not create a second component registry or expand Design System ownership into business data, authorization, routing, or process state.

## Select

- Props: `label` and `options` are required. `modelValue` defaults to an empty string. `id`, `name`, `placeholder`, `hint`, `error`, `required`, and `disabled` control presentation and native field semantics.
- Emits: one native selection change emits `update:modelValue(value: string)` and `change(value: string)` with the same normalized value. Blur emits `blur(event: FocusEvent)`.
- States: default, placeholder, required, disabled, hint, and error. The component does not invent loading, permission, or business-process states.
- Accessibility: the visible label targets the generated or supplied control ID; hint and error IDs feed `aria-describedby`; errors set `aria-invalid`; required and disabled map to native attributes.
- Security boundary: callers supply already-authorized options and decide whether the field is visible or enabled. Select performs no API request, permission decision, person/organization lookup, truth caching, or process transition.

## PersonPicker and OrganizationPicker

- Props: the picker props mirror Select, with person- or organization-specific placeholder text. Options remain caller-owned `SelectOption` values.
- Emits: both pickers pass through `update:modelValue(value: string)` and typed `change(value: string)` without changing the value.
- States and accessibility: inherited from Select, including required, disabled, hint, error, label association, and native select keyboard behavior.
- Security boundary: the components are controlled selectors, not directories. They never call a network endpoint, cache personnel or organization truth, infer data scope, or grant access. The backend and calling feature remain authoritative.

## Drawer

- Props: `open` and `title` are required. `description`, `side`, and `closeLabel` refine presentation. `closeOnBackdrop` defaults to `true`; high-risk flows may set it to `false`.
- Emits: `close()` requests closure. The parent remains the source of truth for `open`.
- Close behavior: the close button and `Escape` always request closure. A backdrop click requests closure only when `closeOnBackdrop` is true. Disabling backdrop closure must not disable `Escape`.
- Focus and accessibility: the panel is a labelled modal dialog. Opening moves focus into the drawer, Tab is trapped inside, and closing restores focus to the element active before opening.
- Security boundary: preventing accidental backdrop closure is a UX safeguard, not an authorization or confirmation mechanism. The caller owns risk confirmation, permissions, idempotency, version checks, and server-side validation.

## Semantic token consumption

Design System components and shared navigation must consume only `--sgj-*` tokens defined in `tokens.css`. Overlay menus and modal surfaces use the existing `--sgj-shadow-overlay` semantic shadow; undefined aliases such as the former large-shadow name are forbidden.

## Registration and reuse boundary

P10-COMP-01 changes existing public components only. No component, public index entry, registry entry, framework, router, state manager, or API client is added. Business pages must import from the existing public Design System boundary and keep business actions, permissions, data scope, and remote truth outside this layer.
