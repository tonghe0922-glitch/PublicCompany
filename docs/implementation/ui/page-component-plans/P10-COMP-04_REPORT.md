# P10-COMP-04 construction report

Status: `FORMAL_SUBMIT / INDEPENDENT_GATE_PENDING`. This report does not declare
P10-COMP-04, P006/P007 as fully closed, or any L0–L5 layer PASS.

## 1. Contract correction, baseline and ownership

The independently accepted external `CONTRACT-PATCH-05` changed only the
P10-COMP-04 task contract: the nonexistent `P007ShiftPage.vue` path was replaced
by the authoritative `P007SchedulePage.vue`, and the exact L0–L5 coverage matrix
path was added. No wildcard, dependency, acceptance or forbidden rule changed.

The effective 32-path project baseline is workspace
`E70584931A0955420DD03444ABD90464DD62C17F5E63D6A96B6406C7EF6F7274`
/1542 and task
`73BE1185147DF3C8E1852461A9D7E6918870A67BDC23E3B53C54731B1271C3EB`
/32 (5 existing, 27 missing), with metadata
`4F53CDA18C2BAA0C0354BB5F9A3ECBE5ED12AB4D8E11BA873C2F11161202B945`
/0. Package LOCAL/00 and LOCAL/01 were real exit-1 attempts at unavailable
package tooling; project preflight and planned baseline both exited 0 and form
the authoritative baseline.

Seven pre-existing API/worker/Vite runtime processes and listeners 5173–5175
were recorded before and after the baseline as source-baseline non-writers.
They are not task processes, are not Gate evidence, and must not be reported as
process zero.

## 2. Canonical plans

The P006 and P007 page plans are valid against the canonical schema and contain
only registry-backed, public, existing-stable component IDs. P007 uses
`P007SchedulePage` for page and implementation facts; `P007ShiftPage` is absent.
Both plans record backend 403/409 as final decisions and describe typed
node/caller permission projections only as UX candidates, not server
`allowedActions`.

The plans explicitly block directory-dependent owner/substitute capabilities.
They require no emitted action, no service call, no free-text or fabricated
UUID, no static directory options and no local cache truth while the directory
search/pagination/data-scope/active-person contract is missing.

## 3. P006 independently accepted sub-batch

P006 supplies process-local typed contracts, selectors, service, composable,
four components, public index and thin page. URLs and methods are centralized
in the service; the page and components contain no `session.request`, `/api/`,
bare permission/action constants, JSON dumps, raw interactive controls or deep
shared imports. Server records are the only source for identifiers, status,
node, version and business number.

The action and creation lifecycles use caller-created idempotency keys. Only
typed uncertain outcomes reuse a pending key; deterministic rejection does not
blindly replay. Status/kind contradictions fail closed. Multi-record selection,
latest-version refresh, 403/409/timeout, duplicate clicks and desktop/mobile
facts are covered. The owner-dependent action stays visibly blocked and cannot
emit or call the service.

The final independently accepted P006 focused matrix passed 4 files/52 tests;
typecheck and lint exited 0, and the current source Gate reports zero findings
for `P006MeetingPage.vue`. This is an accepted subbatch, not full L3/L5 closure.

## 4. P007 independently accepted sub-batch

P007 supplies the same process-local layers using the authoritative `Schedule`
name. The domain service deliberately exposes no create operation while the
owner directory contract is absent. `REQUEST_CHANGE` remains visible as a
blocked substitute-dependent action and emits/calls nothing; `NO_CHANGE` and
other typed actions remain backend-adjudicated UX candidates.

The final record list derives desktop, mobile, navigation and selection from
one effective server record source. Typed action errors and pending lifecycles
are owned by record. A 409 can be recovered only by explicit fact refresh,
which performs GET, clears the obsolete pending intent and uses the refreshed
version with a new key; it never replays the old action. Details do not expose
item value, arbitrary detail or stack text.

The final independently accepted P007 focused matrix passed 4 files/42 tests;
typecheck and lint exited 0. The reviewer double-truth probe passed 1/1, and the
current source Gate reports zero findings for `P007SchedulePage.vue`. This is an
accepted subbatch, not full L3/L5 closure.

## 5. Remaining authoritative blocks

L2 remains 13/16 ready. `DirectoryPersonPickerAdapter`,
`DirectoryOrganizationPickerAdapter` and `ManagedUpload` remain blocked,
unimplemented and unexported; P10-COMP-04 does not claim or manufacture them.

P006 and P007 each have implementable sub-closures, but missing authoritative
directory contracts still block required owner/substitute capabilities.
Accordingly L3 is 0/5 closed with 2 partial-implemented, and the P006–P010 L5
closure count is also 0/5 with 2 partial-implemented. No LAYER PASS is claimed.

## 6. Construction failure history

Tests were written before each domain and component/page implementation. The
retained chain includes missing-module red runs; P006 permission, error,
idempotency, selection and source-Gate failures; P007 record double-truth and
409 recovery failures; focused/typecheck/lint corrections; and wrapper-only
failures that did not replace authoritative command exits. Production was not
rolled back to manufacture a red test, and no Gate or lint rule was weakened.

## 7. Closeout matrix and submission boundary

The closeout matrix freshly recorded Python compile exit 0, 03A official self
85/85, the two reviewer fixtures 6/6 and 7/7 with fail-open 0, and the
reference-context matrix 20/20. Project UI current is the expected exit 1:
150 findings across 78 scanned files, exactly 138 raw interactive elements and
12 legacy imports with structural findings 0. Source self exits 0; source
current is the expected exit 1 with 207 findings and exact P006/P007 page
findings 0. Package self exits 0; package phase10 current is the expected exit
1 with 58 findings across 30 scanned files. These current debts are visible and
are not represented as task PASS.

The combined P006/P007 focused run passed 8 files/94 tests. Lint and typecheck
exited 0. Full unit passed 50 files/319 tests, and employee, center and admin
builds all exited 0 with the existing approximately 2.100 MB chunk warning.
The first Knip run then correctly exited 1: the two process-local public indexes
re-exported six unused runtime symbols and six unused types, while the blocked
P007 create channel retained one unused exported input type. The matrix stopped
before Browser/post.

Under independent approval, each process contract test first added an
executable namespace assertion. The old indexes failed both new tests (2 files,
15 tests: 2 failed/13 passed). The minimum correction removed only the unused
public re-exports from the P006/P007 indexes and deleted the unconsumed
`P007CreateScheduleInput` contract; internal domain factories, action maps and
types remain available through their owning modules. No Knip ignore or fake
consumer was added. The two tests then passed 15/15, and the combined focused
plus alias run passed 9 files/98 tests.

After that correction, typecheck and lint exited 0, full unit passed 50 files
/321 tests, all three builds exited 0 with the same warning, and Knip exited 0.
Current UI/source/package results remained 150/207/58 respectively, structural
findings stayed 0, and exact P006/P007 source findings remained 0.

After the construction matrix, the 32-path SHA/bytes inventory and runtime
boundary will be frozen and submitted for a separate final Browser/post
window. Until that window is explicitly authorized, no Browser, post baseline
or PASS claim is made. P10-COMP-05 and all later tasks remain locked.

The first read-only inventory wrapper used the unavailable static
`SHA256.HashData` API on this PowerShell runtime. It exited without a valid
inventory digest but changed no file; the emitted per-file hashes were not used
as an authoritative summary. The one mechanical correction used
`SHA256.Create().ComputeHash` and produced the valid 32-path digest before this
final report update. The report itself is therefore rehashed only in the final
freeze boundary and that later digest is authoritative.

## 8. Representative Browser contract correction and fresh-33 baseline

The independently accepted external `CONTRACT-PATCH-06` added only the exact
`technical-platform/web/e2e/phase10-p006-live.spec.ts` path to the P10-COMP-04
contract. It did not add a wildcard or P007 E2E ownership. The external YAML,
machine task, manifest and checksum closure remain outside the project workspace
and are classified as an authorized external contract patch, not as task source.

The resulting authoritative fresh-33 raw baseline is workspace
`4B28E8298C33B2D9D6D65F9956FBDF9FF1D3CA606B1445A2C6988A36F1BCE05F`
/1578 and task
`0675F607C9E4E93C2A71D76281520CA22A8979E339FE1556128866CDAF6BDA0C`
/33, with 33 existing and 0 missing and metadata empty/0. The report-excluded
pre comparable projection is workspace
`EA2B6A196571388E41B423A10BAEB5B7F2E7052B9105C6DB741507C0623536E5`
/1577 and task
`97DB7AD4F9EE2CE5B41A4BA1D9E7223F9FCDF7B7383904D6E2C2642CBCD2C2B5`
/32; the report is tracked separately as one metadata file.

The P006 E2E adaptation retained the real employee, center and technical-portal
routes, create and complete `SUBMIT` to `END` lifecycle, four backend 403
negative paths, data-scope, rework and independent-acceptance assertions, and
private-content safe projection. It removed the obsolete `article.record` and
`data-meeting-id` selectors. The created record ID comes from the authoritative
API response/list; current record selection uses `data-select-record` and actions
use `data-action-code`. No production debug or compatibility shell was added.

The construction history retains two launcher/Playwright wrapper failures where
`SJG_LOCAL_API_PROXY_TARGET` was absent and Vite used port 8080 while the fixture
was correctly READY on 18086. Neither was classified as a selector or product
failure. The old spec was then restored to its exact baseline SHA and run with
the corrected proxy, producing the valid red failure on the obsolete route
heading. After the single-spec adaptation, a new fixture and Chromium run passed
1/1 and exact cleanup succeeded.

## 9. Formal Gate and frontend matrix

The formal frozen matrix recorded Python compile exit 0, official self 85/85,
reviewer fixtures 6/6 and 7/7 with fail-open 0, and reference-context 20/20.
Source self exited 0; source current remained the expected exit 1 with 207
findings and exact P006/P007 page findings 0. Project UI current remained the
expected exit 1 with 150 findings across 78 files: 138 raw interactive elements,
12 legacy imports and structural findings 0.

The first formal package-current command mistakenly invoked the workspace
P10-COMP-03A project Gate. It returned exit 1 with 58 findings across 23 files
and is permanently retained as `WRONG_INTERFACE`. The one authorized correction
used the external package `LOCAL/ui_component_access_gate.py`; it returned the
authoritative expected exit 1, status FAIL, 58 raw findings across 30 files.
Package self exited 0. No count was hidden or represented as task failure.

The combined P006/P007 and alias matrix passed 9 files/98 tests; the P006 E2E
spec ESLint check, full lint and typecheck all exited 0. Full unit passed 50
files/321 tests. Employee, center and admin builds all exited 0 with the existing
approximately 2.100 MB chunk warning, and Knip exited 0. The first full-unit
command wrapper timed out before returning an exit and left no running test
process; its non-authoritative log is retained. The same command then completed
authoritatively with exit 0 and the counts above.

## 10. Formal P006 Browser and runtime boundary

The formal representative Browser used a fresh
`Phase10P006BrowserBackendFixture` on the authoritative port 18086, fresh
PostgreSQL 16.14 migrated from empty schema, fresh Redis 7.4, and an explicit
`SJG_LOCAL_API_PROXY_TARGET=http://127.0.0.1:18086`. Desktop Chromium passed 1/1
(test 13.2 seconds, total 18.2 seconds).

The runtime JSON recorded PostgreSQL container
`5192afa51971a500ac367d7bceec5e781b08c6b05167fd0ca9c6f094f963b101`
and Redis container
`ebd44882b581960cf37ba7b7a09a2896aa91338b6c707a31a82efb97ec993b8b`.
Only the unique formal launcher PID 45872 was terminated with `/F /T`; the two
exact container IDs are absent, running Testcontainers/Ryuk is 0,
18086/18090/5303/5304/5305 listeners are 0 and new fixture/web processes are 0.
The seven pre-existing API/worker/Vite runtime processes and listeners
5173/5174/5175 remain 7/7, were neither stopped nor reused, and are not reported
as process-zero evidence.

## 11. Final submission classification

The authoritative post evidence uses the fresh-33 baseline and the same
report-excluded projection rule. The only task-source delta is the approved P006
live spec; the only metadata delta is this report. Unrelated and concurrent
hand-written changes are zero. Submitted hashes cover all 33 planned paths and
must match the final disk inventory; the final report SHA/bytes and raw/comparable
post IDs are recorded in the post manifest so this report does not create a
self-referential hash cycle.

This is a formal submission for independent review, not a self-declared PASS.
L2 remains 13/16 ready with three contract-blocked capabilities; L3 and L5 remain
0/5 closed with P006/P007 recorded only as partial implementations. No LAYER PASS
is claimed. P10-COMP-05 and later tasks remain locked pending an independent
P10-COMP-04 conclusion.
