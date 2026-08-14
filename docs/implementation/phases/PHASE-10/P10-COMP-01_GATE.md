# P10-COMP-01 Independent UI Gate

Status: `PASS`

Reviewed at: `2026-08-13` (Asia/Shanghai)

Scope: only `I:\PublicCompany_source_codex`. `.git` is absent and no remote operation was performed.

## Verdict

P10-COMP-01 passes. The existing Design System contracts for Select, the two Pickers and Drawer are behaviorally closed; PortalNavigation consumes a defined semantic token; the shared components remain presentation-only and do not acquire API, truth-cache, permission, data-scope or workflow authority.

This PASS unlocks only YAML-dependent task `P10-COMP-02`. It does not close PHASE-10, unlock P10-COMP-03+, or approve the concurrent PHASE-11 remediation. The current PHASE-10 source/UI backlogs remain visible at 361/88 and belong to later declared UI tasks.

## Definition of Done

| Requirement | Result | Independent evidence |
|---|---|---|
| P10-COMP-00 dependency | PASS | `P10-COMP-00_GATE.md` is PASS and explicitly unlocks only P10-COMP-01. |
| Select typed change | PASS | One native change emits the same normalized string first as `update:modelValue`, then as `change`; no DOM Event escapes. |
| Picker passthrough | PASS | PersonPicker and OrganizationPicker preserve the exact selected string for both events. |
| Drawer configurable backdrop | PASS | Default backdrop closes; `closeOnBackdrop=false` blocks only backdrop closure. Close button, Escape, initial focus and focus restoration remain active. |
| Token contract | PASS | All `var(--sgj-*)` consumers under Design System and PortalNavigation resolve to definitions; `--sgj-shadow-overlay` exists and the old `--sgj-shadow-lg` consumer is absent. |
| Security boundary | PASS | Focused source scan found no `/api/`, `fetch`, `session.request`, local truth cache, PHASE-10 process coupling, suppression or type bypass in the reviewed components/contracts. |
| Public contract | PASS | `COMPONENT_CONTRACTS.md` documents props, emits, states, accessibility and caller/backend authority boundaries. |
| Scope and registration | PASS | Seven UI source changes, twelve separately declared concurrent CORE changes, zero unrelated changes. No new component, registry entry, public index, router or state framework was introduced. |

## Independent commands and results

- Reviewer behavior matrix:
  - `pnpm exec vitest run src/design-system/component-vtu.test.ts src/design-system/runtime-primitives.test.ts src/design-system/foundation.test.ts src/design-system/evidence/P10-COMP-01/reviewer-independent.test.ts`
  - final exit `0`; 4 files / 20 tests PASS.
  - The first two reviewer attempts are retained as reviewer-fixture defects: CSS `?raw` produced an empty definition set, then nested `import.meta.url` was non-file. Neither reached a product failure. The corrected probe reads the real token file and passes without changing candidate source.
- Gate self-tests:
  - `python scripts/implementation/phase10_component_source_gate_test.py` -> exit `0`.
  - `python scripts/implementation/phase10_component_local_tools_test.py` -> exit `0`.
  - `python I:\PublicCompany_组件核对与AI整改方案\LOCAL\test_ui_component_access_gate.py` -> exit `0`.
- Current debt checks:
  - project source Gate -> expected exit `1`, FAIL 361 / 7 routed pages / 46 contract-derived actions;
  - package UI Gate -> expected exit `1`, FAIL 88 / warning 0.
  - These are declared downstream backlog, not hidden or represented as a green full-program Gate.
- Frontend quality:
  - `pnpm lint` -> exit `0`;
  - `pnpm typecheck` -> exit `0`;
  - `pnpm test` -> exit `0`, 30 files / 137 tests including reviewer probes;
  - `pnpm build` -> exit `0`, employee/center/admin all built; the approximately 2.078 MB chunk warning remains visible;
  - `pnpm quality:deadcode` -> exit `0`.
- Representative shared-dependency Browser:
  - reviewer fixture reached READY with fresh PostgreSQL 16.14 migrated through V125, Redis 7.4 and real Spring on `:18090`;
  - `pnpm exec playwright test --config playwright.phase11-p016-live.config.ts` -> exit `0`, desktop Chromium 1/1 PASS (13.4 s test / 18.3 s total);
  - controlled fixture termination -> expected exit `1`;
  - exact PostgreSQL `83602f6d72bc97dd3f93595289057cf5e8f27365cd0250b86eb8468e00518d45` and Redis `383f5f57f001d5736788d1a0d61f7885ee3455d8381d49633043ff76a18c7d8b` are ABSENT; Ryuk count and workspace fixture/process count are zero.

## Baseline and hash verification

- Submitted pre:
  - workspace `380B8F19EC956CD6054EEF8CBCECFD3DE2384289BDB96A6F0BC5C7F2E293C4C8` / 1,457;
  - task `CCFB4C6708D25DDC21439E706CBEE093407E6ABAAEBF4D75B74E45F88E1813A6` / 10 planned (9 existing).
- Reviewer live recomputation:
  - workspace `616FF54061F0B0BB01A348C17B5C4F359D72661877A4A8717A5E66F8E083B083` / 1,464;
  - task `007C80DEB48AD75992B285F65F22E28E778743AC34FD9ABEA98490BDB4F1E996` / 10 existing;
  - evidence-empty ID `4F53CDA18C2BAA0C0354BB5F9A3ECBE5ED12AB4D8E11BA873C2F11161202B945` / 0.
- Independent pre/post manifest diff: 19 source changes exactly, comprising seven UI task changes and twelve declared CORE changes; no unrelated source change.
- `submitted-sha256.json`: 11 entries; actual SHA-256/byte mismatches `0`.
- Submitted report: `0B195B2675966BE5639E3AB179FCCC8EC745187F1504EB16BA52D05F7F60CF90` / 6,037 bytes.
- Reviewer tests, evidence trees, `.runlogs`, `target`, `dist`, reports and test-results are excluded from workspace/task source IDs as declared.

## Reviewer evidence

- `technical-platform/web/src/design-system/evidence/P10-COMP-01/reviewer-independent.test.ts`
- `technical-platform/web/src/design-system/evidence/P10-COMP-01/reviewer-live-baseline/`
- `technical-platform/web/src/design-system/evidence/P10-COMP-01/final/`
- `technical-platform/web/src/design-system/evidence/P10-COMP-01/P10-COMP-01_REPORT.md`

## Next task boundary

`P10-COMP-02` may begin only within its YAML dependency and allowed-path rules, with a fresh claim and baseline. P10-COMP-03+ remains locked. PHASE-11 remains independently FAIL until its six-page remediation, full web matrix, six Browser flows and required representative backend regressions are resubmitted and pass.
