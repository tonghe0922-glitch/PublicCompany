# P10-COMP-06 safe technical-monitor projection report

Status: `TASK_CLOSEOUT_CONSTRUCTION_MATRIX_PENDING`.

This report records a task-local safe-monitor projection. It does not declare
P10-COMP-06 independently accepted, does not close L2, L3, or L5, and does not
unlock P10-COMP-07 or any later task.

## Scope and baseline

The external contract patch added 15 exact paths to P10-COMP-06 and was
independently accepted before the fresh baseline. The authoritative fresh30
baseline is:

- workspace source ID
  `D3DB0F228A60110DD7393E31136CB34601C10BD1E65CC407E4BE503B0AAC7CD4`
  with 1,618 files;
- task source ID
  `DA253435738E7F07D218904940A50381EC21C163F1E400001D88AAEA2A82B962`
  with 30 unique paths;
- baseline task inventory: 11 existing and 19 missing;
- metadata inventory: empty;
- seven pre-existing API/worker/Vite runtime processes and listeners 5173-5175
  were classified only as source-baseline non-writers and were never reused as
  task evidence.

Before this report and matrix update, the current 30-path inventory was 27
existing and three missing: 18 added, eight modified, two deleted, and two
unchanged relative to fresh30. The two intentional deletions are the obsolete
`Phase09TechWorkflowMonitorPage.vue` and its page-adjacent plan. After this
report is created and the matrix is updated, the expected inventory is 28
existing and two missing, with all 30 planned paths accounted for as 19 added,
nine modified, and two deleted.

## Implemented boundary

The backend exposes only:

- `GET /api/v1/processes/P004/monitor-projections`, authorized by the existing
  `p004.request.read` permission and record-level data scope; and
- `GET /api/v1/processes/P005/monitor-projections`, authorized by
  `p005.notice.monitor` and record-level data scope.

P004 intentionally has no new monitor permission and the technical monitor has
no `p004.request.act` or P005 mutation authority. Both responses use a fixed
allowlist: record ID, business number, process code, current node, status,
version, and updated time; only P005 may include `approvedCount`. There is no
mutation endpoint and no domain entity, business body, recipient detail,
evidence, arbitrary map, exception detail, or stack trace in the projection.

The frontend maps every response field explicitly, strips unknown input, and
keeps P004/P005 loading in independent, abortable, last-request-wins requests.
The contracts layer owns a structurally compatible monitor state contract and
does not import the platform layer. `MonitorPanel` is the only public monitor
component; `MonitorStatusTable`, the service, composable, transport factories,
and monitor contracts do not leak through `@sgj/platform-ui`.

The Phase10 page obtains the public panel and composable only through the
process-local monitoring index. Endpoint permission checks are independent and
reactive: an unauthorized P004 or P005 endpoint is not requested, and any
change in the P004/P005 permission tuple refreshes the newly authorized facts
once. The page keeps the existing P006/P007/P010-P014 monitor projections,
retains `data-testid="phase09-tech-workflow-monitor"`, and does not add P008,
P009, or P016. The router keeps the exact `/tech/05/03/01` path, name, metadata,
and permissions while replacing only the component. The obsolete Phase09 page
and adjacent plan were removed after route replacement and reference-closure
tests migrated.

P008/P016 route-metadata display asymmetry remains deferred to P10-COMP-07.
P009 retains its independent route. Neither gap is silently expanded in this
task.

## Registry and L0-L5 accounting

The registry has 60 entries: 53 `existing-stable`, four `internal`, and three
`blocked-by-contract`; 56 are public and four are internal/non-public.
P10-COMP-06 adds:

- `platform.monitor-panel`: ready, public, exported, and executable-test linked;
- `platform.monitor-status-table`: ready internal implementation, non-public,
  non-exported, and executable-test linked.

L2 therefore changes from 13/16 ready plus three blocked to 15/18 ready plus
the same three blocked contracts. Directory person/organization and managed
upload remain blocked. L3 remains 0/5 closed with five partial implementations,
and related L5 P006-P010 pages remain 0/5 closed with five partial projections.
No LAYER PASS is claimed.

## Executable checkpoints

- Backend integration: four focused tests passed; compile/test-compile passed.
  Authorized projections, scope-empty and denied identities, exact JSON keys,
  and real P004/P005 mutation 403 boundaries are executable.
- Frontend service: eight tests passed. Exact URLs, AbortSignal, unknown-field
  stripping, approved-count distinction, all-settled state projection, abort,
  and last-request-wins are executable.
- Components, registry, alias, page, router, and legacy closure: the final
  combined checkpoint passed six files / 47 tests. Separate page/router/service
  checkpoint history reached five files / 31 tests after both permission fixes.
- Source self-test migrated its discovered route from Phase09 to Phase10
  without changing Gate logic or expected violations.
- Fixture smoke: 14 checks passed for technical, out-of-scope, and denied
  identities, exact allowlist/seed projections, and two real forbidden
  mutations.
- Representative live E2E: ESLint, typecheck, and Knip passed; a fresh desktop
  Chromium run passed 1/1. It verified technical/out/denied identities, exact
  allowlists, P004-without-approved-count, default-sensitive DOM suppression,
  zero page-origin P004/P005 mutations, and two real API mutation 403s.

No runtime password, token, or seeded business body is reproduced in this
report.

## Failure and correction history

All failures below remain evidence and are not reclassified as product PASS:

1. The initial frontend contract imported platform `AsyncState`, producing one
   structural finding. The structural reopen moved the compatible readonly
   monitor state shape into contracts without a second runtime state model.
2. Page checkpoint FAIL-1 found non-reactive legacy permission flags and an
   unconditional P004/P005 refresh. Tests-first correction made every flag
   reactive and suppressed monitor requests with no monitor permission.
3. Page checkpoint FAIL-2 found that the combined permission boolean still
   caused P004-only users to request P005 (and vice versa), and did not refresh
   when a second permission appeared. Endpoint-specific dynamic permission
   checks and permission-tuple watching closed both cases.
4. The first fixture API-smoke PowerShell wrappers failed during parser/string
   construction before HTTP. A separate Python smoke executed the unchanged
   14 checks successfully; the failed wrappers remain preserved.
5. A non-forced cleanup `taskkill` attempt failed before the task-owned launcher
   was terminated with the exact `/F /T` command. Exact container IDs were then
   absent, Testcontainers/Ryuk and task ports were zero, and the original seven
   runtime processes remained.
6. The representative E2E's first launcher wrapper used the
   `technical-platform` working directory and could not locate root `mvnw.cmd`.
   It started no Java, container, Vite, or Browser process. The preserved
   failure was corrected once by using root `mvnw.cmd` with the exact module;
   the first real Browser run then passed 1/1 and exact cleanup succeeded.

## Current debt snapshot before closeout matrix

- Project UI access current: real exit 1, 92 findings across 106 scanned source
  files: 80 `RAW_INTERACTIVE_ELEMENT` plus 12 `LEGACY_COMPONENT_IMPORT`, with
  structural findings zero.
- Phase10 source current: real exit 1 with 22 visible violations. The existing
  attendance-monitor closure has four findings: two `PAGE_NESTING` and two
  `BARE_PERMISSION`. The Phase10 technical-monitor closure has 18: seven direct
  `PAGE_NESTING`, three direct `BARE_PERMISSION`, and eight
  `COMPONENT_GRAPH_DYNAMIC_IS_AMBIGUOUS` findings whose `finding.path` is
  `Card.vue` but whose `route_page` is `Phase10TechMonitorPage.vue`. These 18
  retain the contract-required legacy P006/P007/P010-P014 page projections as
  explicit partial debt. P10-COMP-05 had 24 source-current findings, so the
  current 22 does not increase the total debt. It remains debt, not a source
  Gate PASS or a layer-completion claim.
- External package phase10 current: real exit 0, zero findings across 70 scanned
  files. This means only that the external package Gate's tracked debt is zero.

The first project-current attempt omitted required `--repo-root` and exited 2
without running the Gate. The corrected authoritative command and its exit 1
result are both retained; the interface failure is not presented as a product
failure.

Earlier page/router checkpoint and FAIL-resubmit summaries incorrectly stated
that the Phase10 technical page had zero exact source findings. That conclusion
used an incomplete exact-path filter (or the wrong report field): it did not
count both direct page findings and the component-graph findings attributed by
`route_page`. Closeout corrects the evidence by classifying every authoritative
violation on both `path` and `route_page`, yielding attendance 4, technical
monitor 18, total 22. The earlier zero is not reused as evidence.

## Closeout matrix status

The non-Browser closeout construction matrix is pending after this document
update. It will rerun backend integration/compile, the complete new frontend
focused and alias set, py-compile/official/reviewer/reference Gates, all three
self/current interfaces, lint, typecheck, full unit, three portal builds, and
Knip. Any unexpected result stops the closeout and prevents a final-freeze
request.

## Formal A-D execution

This section supersedes the pending status above with the completed formal
freeze-window facts. It does not claim task or layer PASS.

- A: the fresh-30 inventory remained 28 existing and two expected deletions,
  with 19 added, nine modified, and two deleted paths. The report-excluded
  classification remained task 29, unrelated 0, concurrent 0, metadata 1.
  The original seven runtime processes and listeners 5173-5175 remained; API
  18093 and Vite 5370-5372 were free, with running Testcontainers and Ryuk zero.
- B: Python compilation and official 85/85 passed. Reviewer suites passed 6/6
  and 7/7 with fail-open zero. The corrected workspace-root reference runner
  passed 20/20 (18 negative and two positive), every negative scanned at least
  five source files, and its temporary directory was absent afterward. Project
  current remained exit 1 with 92/106 (80 raw and 12 legacy, structural zero).
  Source self-test passed; source current remained exit 1 with 22 findings,
  classified by both `path` and `route_page` as Attendance 4 plus technical
  monitor 18. External package self and current passed, with zero findings
  across 70 scanned files.
- C: backend integration passed four tests and backend compile passed. The
  focused frontend set passed six files / 47 tests, and the frozen live spec
  plus config passed single-file ESLint. Full lint and typecheck passed; full
  unit passed 66 files / 565 tests; employee, center, and admin builds passed
  with the existing large-chunk warning retained; Knip passed.
- D3: the final fresh fixture produced a new marker, runtime, 64-character
  PostgreSQL/Redis IDs, launcher tree, and 18093 listener. Full-ID membership
  used `docker ps --no-trunc` with ordinal-ignore-case exact membership and
  exact `docker inspect .Id` equality; both IDs were distinct from D1/D2. The
  frozen desktop Chromium spec passed 1/1. Cleanup terminated only the saved
  D3 launcher tree, after which both exact container IDs were absent, running
  Testcontainers/Ryuk were zero, 18093/5370-5372 listeners were zero, saved D3
  tree processes were zero, and the original runtime remained 7/7.

The formal Browser chain also preserves these non-product failures:

1. The first formal start wrapper was rejected by shell policy before its
   PowerShell body executed; it created no launcher, fixture, container, or
   listener.
2. The separately authorized D1 start reached a real fresh READY, but its
   summary attempted to assign PowerShell's readonly `$PID` automatic variable
   and then reported the verifier shell PID instead of the saved launcher PID.
   Browser did not run. Exact launcher-tree cleanup succeeded. The first
   cleanup verifier then exited 9 because its command text matched its own
   process filter; read-only inspection proved the single match was that
   verifier PowerShell process, not fixture residue.
3. D2 reached a fresh READY with listener ownership in the saved launcher tree,
   but compared the runtime's 64-character container IDs with default
   12-character `docker ps` output and produced two false negatives. Browser did
   not run, and exact cleanup succeeded. A read-only verifier self-check on the
   four existing development containers proved short IDs were length 12,
   no-trunc IDs and inspected `.Id` values were length 64, and all four exact
   comparisons matched.
4. D3 used only 64-character no-trunc IDs and exact equality, avoiding both
   earlier verifier defects. The D1/D2 logs, generated runtime backups, abort
   summaries, and cleanup evidence remain preserved and are not overwritten.

No runtime password, token, seeded subject/content/reason, recipient data, or
other business secret is included in the formal summary. P10-COMP-07 and later
tasks remain locked, and no L2, L3, L5, or aggregate LAYER PASS is claimed.
