# P10-COMP-02 test-first and shared-runtime failure chain

All results below are actual local command outcomes from 2026-08-13. They are retained as failures and are not counted as passing gates.

1. Initial targeted run
   - Command: `pnpm exec vitest run src/design-system/templates/PageTemplateFrame.test.ts src/design-system/layout/PortalShell.landmark.test.ts src/router/route-semantics.test.ts`
   - Result: exit 1; 3 test files failed; 29 failed, 2 passed.
   - Proven gaps: template still emitted `h1`; P001-P010/monitor pages still emitted nested `main`/`h1`; Forbidden mounted a second PortalShell; route metadata/title projection was absent. The template VTU fixture also lacked an explicit happy-dom environment and failed closed with `document is not defined`.

2. First implementation run
   - Command added existing `portal-router.test.ts` to the targeted matrix.
   - Result: exit 1; 1 test file failed, 3 passed; 6 failed, 25 passed.
   - Proven gap: P008/P009 navigation authority entries have `routeName: null`; requiring route-name equality caused `ROUTE_SOURCE_MISSING`, including `center:p008-leave-management`.

3. Shared P011 Browser impact
   - CORE started a fresh real P011 fixture, but the three Vite applications failed while loading the UI candidate because of `ROUTE_SOURCE_MISSING center:p008-leave-management`; P011 Playwright assertions did not start.
   - CORE stopped Playwright/Vite and the fixture; the exact PostgreSQL and Redis containers were reported absent. No CORE/UI ownership boundary was crossed.

4. First path fallback
   - Result: exit 1; 2 test files failed, 2 passed; 18 failed, 27 passed.
   - Proven gap: the frozen PHASE-09 entries and raw architecture entries can share a path. Treating named and unnamed records as equal candidates caused `ROUTE_SOURCE_AMBIGUOUS`.

5. Corrected authority rule
   - Prefer the unique same-path entry whose explicit route name matches. When none exists, require exactly one same-path entry with `routeName: null`. Missing and ambiguity remain fail-closed.
   - The center P008 route now derives title `待审批请假` and source key `2-2中心全层级页面.xlsx:完整页面树:R253:6634facff70c` without changing path, component, permission metadata, or props.
   - Targeted route/template/landmark matrix subsequently passed 4 files / 45 tests; after desktop/mobile route projections were added, route semantics passed 14/14.

6. Shared heading impact
   - A fresh real P011 page reached Browser rendering. The route title `员工自评` was the only `h1`; the business template title `绩效评价、校准与执行` was an `h2`.
   - The existing CORE E2E expected the business title to be `h1` and failed. This is an expected shared-contract impact, not an initial Browser pass. CORE owns the exact E2E locator adjustment and must retain both unique route `h1` and business `h2` assertions.
