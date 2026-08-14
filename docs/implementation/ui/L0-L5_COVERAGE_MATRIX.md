# L0–L5 UI coverage matrix

Status: `P10-COMP-07_TASK_CLOSEOUT_PENDING`; no row in this matrix is a
`LAYER PASS`.

The 42 governed Design System Vue sources are partitioned, not double-counted:
L1 contains 35 component/internal implementations (32 component + 3 internal),
while L4 contains 7 layout/template implementations (1 layout + 6 template).

| Layer | Recomputable inventory | Current coverage | P10 ownership | Remaining acceptance / block | Independent state |
| --- | --- | ---: | --- | --- | --- |
| L0 tokens | unique `--sgj-*:` definitions in `technical-platform/web/src/design-system/tokens.css` | 74 / 74 inventoried | P10-COMP-01, P10-COMP-08 | Continue definition/consumption and full quality Gate checks | measured; no LAYER PASS |
| L1 pure Design System | registry categories `design-system=32`, `internal=3` | 35 / 35 registered and test-linked | P10-COMP-01, P10-COMP-03A, P10-COMP-08 | Preserve pure-UI/API-free boundary and executable test linkage | registered/test-linked; no LAYER PASS |
| L2 shared process UI | registry IDs in the `platform.*` namespace, including the non-public internal monitor table | 15 / 18 ready and test-linked; 3 / 18 blocked | P10-COMP-03, P10-COMP-06, later P10-COMP-08 regression | Directory person/organization and managed upload lack authoritative contracts | MonitorPanel is public and MonitorStatusTable is internal; no LAYER PASS |
| L3 process modules | P006–P010 canonical plans | 0 / 5 modules closed; P006–P010 each have independently accepted implementable sub-closures | P10-COMP-04, P10-COMP-05, P10-COMP-06 | P006/P007 directory-dependent capabilities, P008 handover directory, P009 sensitive reveal authority, and P010 owner directory plus sensitive reveal authority remain contract-blocked | 5 partial-implemented, 0 closed; no LAYER PASS |
| L4 templates and shell | registry categories `template=6`, `layout=1` | 7 / 7 registered and test-linked | P10-COMP-02, P10-COMP-03A, P10-COMP-08 | Runtime route/main/heading and Browser acceptance remain task-gated | registered/test-linked; no LAYER PASS |
| L5 thin pages | direct `*.vue` files under `technical-platform/web/src/platform/pages` | 22 / 22 inventoried; 0 / 5 P006–P010 modules closed; all five thin-page projections implemented | P10-COMP-04, P10-COMP-05, P10-COMP-06, P10-COMP-08 | Each P006–P010 page preserves its process-specific contract blocks; remaining source debt stays visible to the current Gate | 5 partial-implemented, 0 closed; no LAYER PASS |

## L2 P10-COMP-03 projection

Ready and public through `@sgj/platform-ui`: `AsyncStateBoundary`,
`ApiErrorNotice`, `FormErrorSummary`, `VersionConflictPanel`, `PermissionGate`,
`ConfirmDialog`, `HighRiskConfirmDialog`, `ProcessActionPanel`,
`DateTimeRangeField`, `ProcessRecordMeta`, `DataTable`, `DescriptionList`, and
`ProcessTimeline`. `useAsyncResource` and `useAsyncAction` are public hooks but
are not registry component entries.

Blocked, unimplemented and unexported: `DirectoryPersonPickerAdapter`,
`DirectoryOrganizationPickerAdapter`, and `ManagedUpload`. Their authority gaps
are recorded in `P10-COMP-03_BLOCKED_CONTRACTS.md`; no future task ownership is
claimed until the authoritative YAML is revised and a fresh exact claim exists.

## P10-COMP-04 partial projection

P006 and P007 now have typed process-local contracts, selectors, services,
composables, public indexes, components, focused tests and thin pages. P007 uses
the authoritative `Schedule` page name throughout. Both page files have zero
findings when filtered from the current source Gate. These facts are task-level
partial implementation evidence only.

The missing directory search/pagination/data-scope/active-person projection is
still authoritative. P006 therefore blocks its owner-dependent action, while
P007 blocks owner creation and substitute-dependent `REQUEST_CHANGE`. The UI
does not accept free-text UUIDs, static directory options or cached directory
truth, and blocked operations do not emit or call their services. Backend 403
and 409 responses remain the final authorization and concurrency decisions.

Consequently L2 was 13/16 ready plus three blocked at P10-COMP-03 closeout, L3 remains 0/5 closed,
and the P006–P010 L5 closure count remains 0/5. Neither the independently
accepted P006/P007 sub-batches nor this matrix declares a layer complete.

## P10-COMP-05 partial projection

P008, P009 and P010 now each have a machine-valid canonical plan, typed
process-local contracts, selectors, service, composable, public index,
components, focused tests, a thin page and an independently accepted
representative Browser scenario. Their page files have zero exact findings in
the current source Gate. Server records remain the authority for identifiers,
business numbers, nodes, status and versions; caller-owned idempotency,
last-request-wins, deterministic rejection and uncertain-result retry
boundaries are executable behavior rather than documentation-only claims.

P008 permits only the server-supported no-handover create path while the
handover-agent directory capability remains visibly blocked. P009 keeps amount
and receipt facts masked because no authoritative session-level reveal chain
exists. P010 deliberately exposes no create service or UI submit path while the
scoped learner directory is missing; its qualification, exam and practical
facts also remain masked without an authoritative reveal contract. The P010
Browser fixture's learner ID is used only for an authorized API seed and never
as UI or domain directory truth.

The external package phase10 UI Gate currently reports exit 0, error 0 across
70 scanned files after the P10-COMP-06 representative config was added. That fact means only that this one Gate's tracked debt has
been cleared. It does not close any directory/reveal contract, any process
module, any thin page, or any L0–L5 layer. Therefore L3 remains 0/5 closed with
five partial implementations, and L5
P006–P010 remains 0/5 closed with five partial thin pages. No LAYER PASS is
claimed.

## P10-COMP-06 safe monitor projection

P10-COMP-06 adds two test-linked registry entries without closing L2:
`platform.monitor-panel` is an `existing-stable`, public
`@sgj/platform-ui` composite, while `platform.monitor-status-table` is an
internal, non-exported rendering detail. This changes the recomputable L2
inventory from 13/16 ready plus three blocked to 15/18 ready plus the same three
blocked contracts. The registry as a whole contains 60 entries: 53
`existing-stable`, four `internal`, and three `blocked-by-contract`; 56 entries
are public and four are internal/non-public.

The shared technical monitor consumes two GET-only backend allowlist
projections. P004 deliberately uses its existing `p004.request.read`
permission and exposes no P004 monitor or act permission; P005 uses
`p005.notice.monitor`. The page renders only the typed P004/P005 projection,
keeps the prior P006/P007/P010–P014 monitor projections, performs no business
mutation, and replaces the Phase09 route component without changing the route
path, name, or metadata. The old Phase09 page and page-adjacent plan are
removed, while the stable route test ID is retained by the Phase10 page.

The P008/P016 permissions present in shared-route metadata but absent from the
old shared-page projection remain an explicit display-asymmetry gap deferred
to P10-COMP-07. P009 keeps its independent technical-monitor route and is not
migrated into this shared page. Representative Browser evidence covers the
fresh P004/P005 monitor identities and allowlist projection only; it does not
close any P006–P010 directory/reveal block or any L3/L5 module. L2 is therefore
15/18 ready plus three blocked, L3 is still 0/5 closed with five partial
implementations, and the related L5 pages remain 0/5 closed with five partial
projections. No LAYER PASS is claimed.

## P10-COMP-07 route authority split

P10-COMP-07 separates the runtime router into one `portal-router` orchestrator
and three contributors owned by `core-routes`, `phase09-routes`, and
`phase10-routes`. There is still exactly one `createRouter` and one hash-history
instance. The executable guard snapshot preserves all named routes and their
original order: employee 36, center 33, and tech 14, for 83 total. Each route's
`permission` versus ordered `permissionsAny` shape is preserved independently
of navigation visibility metadata.

`PORTAL_IA_NAVIGATION` remains authoritative only for route title, source key,
sensitivity, and data scope. Runtime guard permissions are not rewritten from
IA `permissionCodes`; `processCode` continues to use the typed runtime route
contract. Login, home, forbidden, not-found, and the unnamed authenticated
layout explicitly use `dataScope: null`. Route contracts now expose the
task-owned permission and process-code unions without importing the platform
layer or copying process-local action maps. The task-owned route surface has no
action-code or allowed-actions metadata, and backend 403 responses remain the
final authorization decision.

The P10-COMP-06 safe-monitor route and its accepted P004-read/P005-monitor
projection are preserved. The shared-route P008/P016 display asymmetry remains
deferred, as do naked route constants in 14 pages outside this task's exact
ownership. This authority split adds no registry component or process/page
closure: L2 remains 15/18 ready plus three blocked, while L3 and the related L5
set remain 0/5 closed with five partial implementations each. No LAYER PASS is
claimed.
