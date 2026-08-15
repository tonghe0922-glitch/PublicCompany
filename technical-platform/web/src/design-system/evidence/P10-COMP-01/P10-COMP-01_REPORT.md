# P10-COMP-01 Design System contract remediation report

1. **Repository root**: `I:\PublicCompany_source_codex` (Git metadata absent; no remote operation was performed).

2. **Pre-baseline**: package `LOCAL/00_检查本地项目.ps1` exit `1` and `LOCAL/01_生成本地基线.ps1` exit `1` because their PowerShell source cannot be parsed on this host; both raw logs are retained and are not described as PASS. The project-side equivalent completed preflight/baseline with exit `0/0`: workspace `380B8F19EC956CD6054EEF8CBCECFD3DE2384289BDB96A6F0BC5C7F2E293C4C8` / 1457 files; planned task source `CCFB4C6708D25DDC21439E706CBEE093407E6ABAAEBF4D75B74E45F88E1813A6` / 10 paths (9 existing, contract document explicitly missing); evidence metadata empty-set ID `4F53CDA18C2BAA0C0354BB5F9A3ECBE5ED12AB4D8E11BA873C2F11161202B945` / 0.

3. **Summary**: Select now emits ordered, typed string `update:modelValue` and `change` events from one native change. PersonPicker and OrganizationPicker preserve their existing typed passthrough contracts. Drawer adds `closeOnBackdrop` with a safe compatibility default of `true`; setting it to `false` suppresses only backdrop closure while the close button, Escape, focus trap, and focus restoration remain. PortalNavigation consumes the existing overlay shadow token. Public component contracts now document props, emits, states, accessibility, and security boundaries.

4. **Files**:
   - Modified: `components/Select.vue`, `components/Drawer.vue`, `component-vtu.test.ts`, `runtime-primitives.test.ts`, `foundation.test.ts`, and `../router/PortalNavigation.vue`.
   - Added: `COMPONENT_CONTRACTS.md`.
   - Verified unchanged: `components/PersonPicker.vue`, `components/OrganizationPicker.vue`, and `tokens.css`.
   - Evidence only: `design-system/evidence/P10-COMP-01/**`.

5. **UI plan**: not applicable. This task changes no business page and therefore creates no `<PageName>.ui-plan.json`. The shared navigation file changes only a token reference.

6. **Reuse, new components, registry, and public index**: existing Select, PersonPicker, OrganizationPicker, Drawer, focus composable, and semantic tokens are reused. No component was created; registry and public index changes are both zero. `--sgj-shadow-overlay` is reused instead of adding an alias or a second token system.

7. **Design decisions**:
   - `change(value: string)` follows `update:modelValue(value: string)` for the same normalized value; no DOM Event escapes the public component contract.
   - High-risk callers can disable accidental backdrop closure without weakening keyboard closure or focus recovery.
   - Pickers remain controlled presentation components: no network endpoint, people/organization truth cache, permission inference, data-scope decision, or process transition was added.
   - The Design System still has one public implementation and no second UI framework, router, or state manager.

8. **Gate and test results**:
   - The first combined final-matrix wrapper hit the tool time boundary after writing only partial step logs and produced no `matrix-results.json`; it is not used as evidence. Every required step was then rerun individually with an explicit exit code and dedicated log.
   - Red fixture before implementation: exit `1`; 3 files / 15 tests, 4 failed and 11 passed (typed change, picker/runtime passthrough, Drawer backdrop false, undefined token).
   - Final targeted tests: exit `0`; 3 files / 16 tests, all passed. The assertions cover event order/string payload, both picker passthroughs, Drawer default/configured backdrop, close button, Escape, focus restore, and definition/consumption token consistency.
   - Project source Gate self-test: exit `0`. Current project source Gate: exit `1`, `FAIL`, 361 existing violations across the Phase-10 backlog (7 routed pages / 46 derived actions); no debt is hidden.
   - Package UI Gate self-test: exit `0`. Current package UI Gate: exit `1`, `FAIL`, 88 existing errors; no debt is hidden.
   - `pnpm lint`: exit `0`; `pnpm typecheck`: exit `0`; `pnpm test`: exit `0`, 29 files / 133 tests; `pnpm build`: exit `0` for employee/center/admin with the existing approximately 2.078 MB chunk warning retained; `pnpm quality:deadcode`: exit `0`.
   - Representative P016 shared-dependency Browser: fixture reached READY with real Spring on `:18090`, fresh PostgreSQL 16.14 through V125, and Redis 7.4; desktop Chromium exit `0`, 1/1 passed (13.3 s test / 18.0 s total). Controlled fixture shutdown returned the expected exit `1`; exact PostgreSQL and Redis IDs are absent, Ryuk is absent, and workspace process count is zero.

9. **Evidence directory**: `technical-platform/web/src/design-system/evidence/P10-COMP-01/`. It contains the package LOCAL failures, project preflight/baselines, before/after focused tests, current debt reports, full frontend logs, Browser fixture/Playwright/cleanup evidence, scoped diff, and submitted hashes. Evidence, secrets, and generated directories are excluded from source IDs.

10. **Blockers and residual risk**: P10-COMP-01 has no known implementation blocker. The current source/UI Gate debts (361/88) remain work for their owning later tasks and are not presented as a P10-COMP-01 PASS. The production bundle warning remains visible. Concurrent PHASE-11 page remediation is isolated as 12 `concurrent_core` paths and requires its own independent review.

11. **Next task unlock**: `P10-COMP-02` remains locked until the independent reviewer explicitly marks P10-COMP-01 PASS. No P10-COMP-02+ construction has started.

12. **Post-baseline**: workspace source `616FF54061F0B0BB01A348C17B5C4F359D72661877A4A8717A5E66F8E083B083` / 1464 files; task source `007C80DEB48AD75992B285F65F22E28E778743AC34FD9ABEA98490BDB4F1E996` / 10 existing files. Scoped source changes are 7 UI task paths, 12 concurrent CORE paths, and 0 unrelated paths; evidence and generated outputs are excluded. The final evidence-metadata/report hash is recorded separately in `submitted-sha256.json` to avoid a self-referential report hash.
