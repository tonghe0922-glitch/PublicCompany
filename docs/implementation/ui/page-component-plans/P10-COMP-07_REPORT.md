# P10-COMP-07 route authority split report

Status: `TASK_CLOSEOUT_CONSTRUCTION_MATRIX_PENDING`.

This report records a task-local route-authority split. It does not declare
P10-COMP-07 independently accepted, does not close L2, L3, or L5, and does not
unlock P10-COMP-08 or any later task.

## Contract, ownership, and fresh baseline

The independently accepted external `CONTRACT-PATCH-09` added only three exact
P10-COMP-07 ownership paths: the Phase08 portal contract script, the L0-L5
coverage matrix, and this report. The external YAML, machine task, manifest,
and checksum files are an authorized contract patch outside the workspace task.

The authoritative corrected fresh13 baseline is:

- workspace source ID
  `A23C0D5819A30788FEBE1C24AB07389E0D3101A0AAD2516EB6641893F861420A`
  with 1,635 files;
- task source ID
  `A53365903051C456A9D0FD0D26204108D605B16D0A0F11B9FF6748B937B5A21F`
  with 13 unique paths;
- seven existing and six missing task paths;
- metadata ID
  `4F53CDA18C2BAA0C0354BB5F9A3ECBE5ED12AB4D8E11BA873C2F11161202B945`
  with zero files;
- seven pre-existing API/worker/Vite runtime processes and listeners 5173-5175
  remained source-baseline non-writers and were not reused as task evidence.

Package LOCAL/00 and LOCAL/01 were each attempted through their authoritative
interfaces and retained their package-tool exit-1 results. Project preflight
passed. The first planned-baseline run produced a readable but explicitly
non-authoritative partial manifest because localized `docker ps --format
'{{json .}}'` output failed JSON parsing before after/check/summary artifacts
were written. The authorized copy changed only Docker discovery to checked
ID-only commands for running containers, Testcontainers, and Ryuk. It then
produced the IDs above, candidate mismatch zero, runtime 7/7, and
Testcontainers/Ryuk zero. The failed half-run remains evidence and was not
overwritten.

## Tests-first characterization

Before production changes, executable router characterization instantiated the
employee, center, and tech routers and locked every named route as a literal
ordered tuple of path, name, single permission or ordered permissions-any.
Counts were employee 36, center 33, tech 14, total 83. The expected guard data
was not generated from IA, sorted, deduplicated, filled in, or narrowed.

The initial two-file result was 31 tests: 20 passed characterization and
existing semantics, while 11 failed for the intended missing contracts. The
failures covered four missing route modules, one contributor-closure/naked
permission boundary, three IA-backed `dataScope` projections, and three core
`dataScope` projections. Type-oriented expectations were subsequently proven
by `pnpm typecheck`, not inferred from Vitest runtime type erasure.

The split keeps three separate authorities:

1. Runtime guards preserve the former router's exact `permission` versus
   ordered `permissionsAny` metadata.
2. IA owns title, source key, sensitive level, and data scope only.
3. Core/runtime metadata owns login, home, forbidden, not-found, authenticated
   layout, and typed route process codes.

This separation is necessary because navigation permission codes are a
visibility projection, not the complete router guard authority. Existing
examples such as P002, P004, and the shared technical-monitor route deliberately
have broader runtime guard metadata than their IA navigation entries.

## Implemented route boundary

`portal-router.ts` now only assembles route contributors and retains the sole
router/history construction, session restore, safe redirect, guest/auth guard,
permission guard order, navigation Abort rotation, and `router.onError` path.
`core-routes.ts` owns login, home, forbidden, not-found, and the authenticated
layout with children. `phase09-routes.ts` and `phase10-routes.ts` own only their
previous route records and imports; route order and behavior did not change.

The route meta declaration now includes `dataScope`, with null assigned to
non-business core routes and the unnamed authenticated layout. Every IA-backed
named route receives the authoritative IA scope. The route contract exports
`RoutePermissionCode` and the exact `RouteProcessCode` union covering P001-P016,
PHASE-09, PHASE-10, PORTAL, SESSION, HOME, ACCESS, and NOT_FOUND. Unknown route
names fail closed to PORTAL. The four production route modules contain no naked
P-number permission literal, action endpoint, session request, or copied
process-local action map.

The P008/P016 shared-route display asymmetry is recorded, not repaired. The 14
pages outside the task's exact ownership that still carry naked route constants
are also deferred. P10-COMP-06's accepted monitor route and page behavior are
preserved.

## Failure and correction history

All failures remain classified and are not presented as passing evidence:

1. Early production generation used a route-text regex whose replacement did
   not match the complete TypeScript surface. Mechanical generation/patch
   attempts were stopped and corrected without changing characterization
   expectations. A source-Gate runner initially used an incomplete interface,
   and an opaque report read was corrected before authoritative source results
   were recorded.
2. The first production checkpoint passed the 83-route guard matrix but
   introduced mojibake in core metadata: `P1-内部` and `无权限` were corrupted.
   It also lacked the promised `RoutePermissionCode` and `RouteProcessCode`
   types. Reopened tests produced three runtime failures across employee,
   center, and tech while retaining the other 29 passes; typecheck separately
   exposed the missing/narrowing contract. The two-file production fix restored
   exact UTF-8 values and the typed unions without changing guard order.
3. The unmodified Phase08 script first failed its obsolete lifecycle assertion
   that PHASE-10 must be NOT_STARTED. The authoritative master progress instead
   requires PHASE-10 COMPLETE while PHASE-07/08/09 remain complete. The precise
   boundary was updated rather than widened.
4. After that correction, Phase08 C3/C5 reached the intended owner-migration
   red: router orchestration remained in `portal-router`, while core paths,
   authenticated layout, and children moved to `core-routes`. Assertions were
   relocated without deleting restore, redirect, Abort, error, layout, login,
   or rollback checks.
5. The next Phase08 failure was an accepted dynamic-title evolution. Both
   affected assertions now jointly require the `pageTitle` binding, computed
   source, `route.meta.title` preference, and `portal.homeTitle` fallback. They
   do not merely check a variable name or delete the home fallback.
6. The first atomic two-document closeout patch failed verification because its
   matrix tail context did not exist; it wrote neither file. A first anchor
   correction also failed because terminal visual wrapping was mistaken for
   physical lines. Both failures remained atomic zero-write. The final
   authorized patch used the complete physical EOF lines and added both docs in
   one operation.

## Current candidate and executable evidence

Before the two closeout documents, the exact 11 non-document task changes were:

| Path | SHA-256 | Bytes |
| --- | --- | ---: |
| `src/router/portal-router.ts` | `97B7228BD8ACF50BE96654C3755A265C7BEBCEE4F26062BD03416FDE8B8DFEAD` | 2598 |
| `src/router/core-routes.ts` | `10993B9978886FBCD4B568187CB77BB12C503E344F8CF5A406ADEC38893C6FEB` | 4011 |
| `src/router/phase09-routes.ts` | `E269BC561F686B83B9C9CFDCCE59A50F03F403F9E664FDE0844856784AA31C0F` | 4042 |
| `src/router/phase10-routes.ts` | `309C52514B239F61E565C75F51EC05DAF13B9F2BA0FC127210164A28943A6716` | 10517 |
| `src/router/route-meta.d.ts` | `EF08D545144A04C76A5477E2DE49C5AB26DC9CA0F219C3A8DDE3E60BDE095728` | 417 |
| `src/contracts/route.ts` | `76B8905DCB687DBA23E5EA577AF84F091972F887B8EC0A7C579EC1231D86AE00` | 15752 |
| `src/contracts/index.ts` | `6FE204F3029C65963E920B8305342234FD7C53B8A7D574B864E56BBE21CFC1A1` | 75 |
| `src/router/route-module-boundary.test.ts` | `E4FA347472D2D0390EF72E0868EDF377CB792C7CEE093F30C42914BEDE9C3874` | 2852 |
| `src/router/route-semantics.test.ts` | `CC247FD8BDC13EEA41754BFD13CBF6C56CFFE43699F504E7EE6384357F637FA2` | 23020 |
| `src/router/phase10-tech-monitor-router.test.ts` | `B3F6D5E378DEB9221024409147CE2CD5213D84553D781B7820B756493613F243` | 2668 |
| `scripts/implementation/phase08_portal_contract.py` | `D595A1C2308023418626BBF7AB874E9A35CFD5E6644C8EF8E5F6011B01BFFA3D` | 9864 |

The accepted construction checkpoints before this docs closeout were:

- router directory: 19 files / 94 tests passed, preserving 36/33/14 named
  route counts;
- focused route semantics/boundary: 2 files / 32 tests passed;
- TypeScript typecheck and lint: exit 0;
- source self-test: exit 0; source current: expected exit 1 with the existing
  22 findings (Attendance 4 plus technical monitor 18), opaque/contributor
  findings zero;
- project UI current: expected exit 1 with 92 findings, structural zero;
- Phase08 portal contract: Python compilation exit 0 and full script exit 0,
  output `PASS (c7)`;
- all touched production and script files read as strict UTF-8 with U+FFFD zero.

These construction results will be rerun in the non-Browser closeout matrix
after this document update. They are not inherited as a task PASS.

## Security and layer boundary

UI guard metadata controls routing experience only. It does not replace API
authorization, record scope, or backend 403 decisions. This task cites the
already accepted backend/E2E negative evidence from prior tasks; it does not
manufacture a new API or Browser claim.

The task adds no registry component and closes no process or thin-page module.
L2 remains 15/18 ready plus three `BLOCKED_BY_CONTRACT`. L3 remains 0/5 closed
with five partial implementations, and the related L5 set remains 0/5 closed
with five partial pages. Project UI debt 92 and source debt 22 remain visible
rather than being presented as PASS. No password, token, business secret, task
PASS, or LAYER PASS is claimed.

## Closeout matrix status

The remaining non-Browser closeout must rerun the Phase08 contract, router and
layout/portal tests, official/reviewer/source/package self/current interfaces,
lint, typecheck, full unit, three portal builds, and Knip. Any unexpected result
stops closeout and prevents a final-freeze request. No fixture, Browser, or post
baseline is authorized in this construction window.

## Formal A-D execution

This section supersedes the pending construction status above with the final
freeze-window facts. It remains a submission for independent review, not a
task or layer PASS.

- Formal A independently recomputed the fresh13 boundary as 13 existing and
  zero missing paths: six added, seven modified, zero deleted, and zero
  unchanged. Raw scope was task 13 and unrelated zero. With this report
  excluded as metadata, comparable scope was task 12, unrelated zero,
  concurrent zero, and metadata one. All 13 frozen SHA/byte pairs matched.
  Matrix and report were strict UTF-8 with U+FFFD zero. The original runtime
  remained 7/7 with listeners 5173-5175 on their original owners, and running
  Testcontainers/Ryuk remained zero.
- Formal B passed Phase08 Python compilation and the complete contract with
  `PASS (c7)`. Boundary plus semantics passed two files / 33 tests; the router
  directory passed 19 files / 95 tests; the frozen router/layout/portal set
  passed 22 files / 118 tests. The checked-in project official self-test passed
  85/85. Project current remained its expected exit 1 with 92 findings across
  110 sources (80 raw plus 12 legacy, structural zero). Source self-test passed;
  source current remained expected exit 1 with 22 findings, seven discovered
  pages, and zero `ROUTER_CONTRIBUTOR*` findings. External package self/current
  passed with zero current findings across 70 scanned files. Fresh formal
  current reports were written only to fixed system-temporary files.
- The historical reviewer6, reviewer7, and reference20 runners were not rerun:
  independent audit established that their executable sources were temporary
  and are not reproducibly present in the repository or evidence tree. Their
  old result logs are not presented as current evidence. The checked-in
  official 85 and source self-tests cover the retained component and imported
  contributor fail-closed contracts.
- Formal C passed lint, typecheck, full unit (67 files / 580 tests), employee,
  center, and admin builds, and Knip. The existing approximately 2.13 MB build
  chunk warning remains visible. Knip reported no duplicate export.
- Formal D is not applicable. P10-COMP-07 has no Browser or fixture contract;
  no service, fixture, Playwright process, or Browser was started to manufacture
  a ceremonial D result.

The closeout also preserves the following non-product failure chain:

1. A read-only test locator included a nonexistent `platform/layouts` folder
   and exited 1 before tests. The independently enumerated 22-file list then
   passed. A second read-only locator found no saved reviewer/reference runner
   source and returned the normal no-match exit 1; the matrix did not recreate
   those runners or reuse their historical logs.
2. The first project-current wrapper was rejected by shell policy before its
   body ran. The authorized split execution produced the expected report. Its
   first freshness check compared a local-kind `DateTime` with UTC file time
   and returned a false negative even though the report was about nine seconds
   newer. A read-only `DateTimeOffset` comparison corrected that verifier
   without rerunning or replacing the Gate report.
3. The first full-unit run passed 578/579 tests but timed out at 5,016 ms while
   `vi.importActual` first transformed the full core route/page graph under
   all-suite concurrency. Focused route matrices already passed. The owned
   boundary test moved the four executable namespace loads to static imports
   without raising timeout, retrying, skipping, or weakening exports. Its first
   typed table used a namespace/key union and typecheck correctly rejected it
   with TS7053; static name/value tuples closed the harness contract. Full unit
   then passed 579/579.
4. Knip subsequently found the unused duplicate public alias
   `processCodeForRoute`. A tests-first namespace negative produced one expected
   failure while 32 tests passed. The alias was removed, leaving the authoritative
   typed `processCodeForRouteName` consumed by core routes. The added negative
   raised final counts to 33 focused, 95 router, and 580 full-unit tests; Knip
   then passed with duplicate exports zero.
5. The first final-boundary read-only script had missing PowerShell whitespace
   after `in` in compact `foreach` expressions and failed parsing before any
   scan. Its mechanical token correction produced the exact 13/13 and
   12/0/0/1 scope facts. A later docs verifier searched two unnecessarily narrow
   English substrings and returned a false negative even though SHA, UTF-8,
   status, and layer counts matched. A read-only exact check of the existing
   complete sentences passed without changing either document.

No failure above changed production authority, weakened a Gate or timeout, or
started a Browser. The final post baseline and submitted13 verification remain
the last formal step before submission. No P10-COMP-07 or LAYER PASS is claimed.
