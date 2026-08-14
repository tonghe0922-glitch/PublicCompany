# P10-COMP-03 construction report

Status: `RESUBMIT-1 / INDEPENDENT_REVIEW_PENDING`. This report does not
declare P10-COMP-03 or any L0–L5 layer PASS.

## 1. Baseline and ownership

The original 31-path construction baseline was independently verified as
workspace `931409E321442D063AF03A5B55BF810F50EAFC1ADAEAD83233114584891F431B`
/1513 and task
`7F5A2BA161B99FB402B19250E016A287EA97E5E9BD53ABCCF773455E3670FE02`
/31 (2 existing, 29 missing). Package LOCAL/00 and the corrected LOCAL/01
attempt both failed in the external package script parser; project preflight and
planned baseline were the real successful equivalents.

CONTRACT-PATCH-04 independently added only
`scripts/implementation/ui_component_access_gate.py` to P10-COMP-03. Both
CONTRACT-PATCH-03 and CONTRACT-PATCH-04 changed the external remediation
package, not workspace task source. The sole final baseline is fresh pre-3:
workspace
`B12DC447A8A94ADB32D21D37D1ADC191F7D85F9E660B184636B28006B63E2600`
/1542 and task
`15B30F9FDA745A2F714728D2FF7118DD9A48C79F08533ED36B65733D5DC961F8`
/33, with all 33 paths existing and metadata empty. Its authoritative path
inventory is `evidence/P10-COMP-03/pre-3/baseline-manifest.json`; no unclaimed
thirty-fourth path was added.

CONTRACT-PATCH-03 independently added only
`technical-platform/web/src/design-system/ui-component-access.test.ts` to the
P10-COMP-03 allowed paths. The authoritative fresh pre-2 is workspace
`0008DCF1981A8BF1B9E31C8B6074121B4694B200D4AD4B4468954EB81ADEF40C`
/1539 and task
`82E80BDE5762F2995BF09CABA81119A5D178C136167C76803ADCB630C884A99C`
/32 (29 existing, 3 missing), with empty metadata. Seven pre-existing API,
worker and Vite runtime processes plus listeners 5173–5175 remained stable and
are classified only as source-baseline non-writers, not as Gate evidence.

## 2. Async state and hooks

`AsyncState<T>` has exactly `idle`, `loading`, `success`, `empty`, `partial`,
`error`, and `cancelled`. `useAsyncResource` owns an AbortController per request,
increments internal request IDs, cancels the prior request, and applies only the
latest response. `useAsyncAction` keeps action state independent, rejects blank
caller idempotency keys, forwards the caller key unchanged, prevents a duplicate
runner while loading, and ignores responses after cancellation. Neither hook
creates, guesses or caches business idempotency truth.

## 3. Stable error and security projection

The error mapper projects 403, 404, 409 and timeout into stable reviewed UI
messages without displaying arbitrary server detail. `ApiErrorNotice`,
`FormErrorSummary`, and `VersionConflictPanel` expose retry/focus/reload intents
to the caller. `PermissionGate` accepts only caller/backend-provided `allowed`
and `denialReason`; it has no session/API access and never performs final
authorization.

## 4. Actions, records and forms

The action components consume caller action lists and independent states.
`HighRiskConfirmDialog` never collects password, OTP, token or raw credential;
it only consumes the authoritative `stepUpSatisfied`/`stepUpReference` result
and emits a reason plus confirm/cancel intent. `DateTimeRangeField` emits typed
range changes. Record metadata, server page intents, mobile row projection,
description lists and chronological process history remain process-neutral and
do not stringify unknown object detail.

## 5. Registry and public boundary

Thirteen implemented components are `existing-stable`, have real implementation
paths, required tests importing the implementation, and public exports through
`@sgj/platform-ui`. The two async hooks and stable types share that public
boundary. The alias test performs executable namespace/key assertions for the
ready exports and proves all three blocked names are absent. Directory person,
directory organization and managed upload remain unimplemented/unexported with
explicit contract reasons; see `P10-COMP-03_BLOCKED_CONTRACTS.md`.

## 6. Test-first history

The first six-suite run failed because the planned implementations did not yet
exist and is retained as the red baseline. Async implementation initially
exposed a parse failure, a TypeScript operator error, lint complexity, and then
two behavioral fixture gaps; all were corrected without weakening the
contracts. The reviewer-required seven-phase boundary and action cancellation,
blank-key and duplicate-runner cases were added before proceeding. C initially
failed because cancel was disabled during loading; D initially failed lint on
unsafe object stringification. Those failures remain evidence and their focused
reruns, typecheck and lint passed before the next batch.

During full construction regression, Knip correctly rejected duplicate named
and default hook exports. That failed run is retained. Under reviewer approval,
the hooks kept their default runtime exports and type exports, while their
tests switched to default imports. The public barrel, registry contract and
fixed two-hook Gate allowlist did not change. Corrected Knip and the complete
required regression chain passed.

## 7. Safety boundary

No shared component contains a P006–P010 branch, process URL, `session.request`,
global busy truth, server-detail passthrough, person/organization cache, or local
upload truth. Permission display never substitutes for backend rejection.
`P10-COMP-03_BLOCKED_CONTRACTS.md` is the authoritative fail-closed inventory.

## 8. Coverage and remaining work

`L0-L5_COVERAGE_MATRIX.md` records L2 as 13/16 implemented and three blocked;
it intentionally declares no layer PASS. P10-COMP-04 and later tasks remain
locked until an independent P10-COMP-03 PASS.

## 9. Original formal-submit frozen matrix (historical)

Fresh pre-3 to the final freeze changed exactly four approved task paths:
`async/shared-components.test.ts`, `useAsyncAction.ts`,
`useAsyncResource.ts`, and `ui_component_access_gate.py`. The other 29 task
paths retained their pre-3 hashes. The final Gate SHA-256 is
`054E01BFF90725C4829001C1CC48ABBAC9BE427540C3CC1803368D51A1378743`.

Python compile exited `0`; official self-test passed `85/85`; the original and
second reviewer probes passed `6/6` and `7/7` with fail-open `0`; and the
reference-context matrix passed `20/20`. Source self and package self exited
`0`. Current debt stayed visible: source Gate `FAIL/340` (7 routed pages, 46
actions), project UI Gate `FAIL/193` across 60 files (`181` raw controls +
`12` legacy imports, structural `0`), and package phase10 Gate `FAIL/79`
across 4 files.

Focused shared tests passed 6 files/20 tests and the alias contract passed 1
file/2 tests. Lint and typecheck exited `0`; full unit passed 42 files/219
tests. Employee, center and admin builds all exited `0`, retaining the existing
approximately 2.080 MB chunk warning. Knip exited `0`.

## 10. Original formal-submit Browser and cleanup (historical)

Fresh P016 used only ports 18090 and 5360–5362. Real Spring, fresh PostgreSQL
16.14 migrated from empty through V125, and fresh Redis 7.4 reached READY.
Desktop Chromium passed 1/1 (13.5 s test / 18.5 s total). The first exact
`taskkill /T` stop returned `128` because Windows required force for the
recorded launcher children; this cleanup failure is retained. The authorized
correction targeted only launcher PID 46820 with `/F /T` and exited `0`.

PostgreSQL
`c0b477f09212a3dc2aca75ef8b5638cb70df97fdbb2ced4bc358d06c7393a6a4`
and Redis
`7023df1e28123de82a62135dffccbac50de935e9a6b7b7f8b0cd9028cceef6a8`
are ABSENT. Running Testcontainers and Ryuk are `0`; listeners on
18090/5360/5361/5362 and new fixture/Maven/Java/Vite/Playwright/Chromium
processes are `0`. The seven pre-existing API/worker/Vite runtime PIDs remain
7/7, were neither stopped nor reused, and are not Browser evidence. Four dev
compose containers and two historical exited Testcontainers were untouched.

## 11. Original formal-submit boundary and formal FAIL (historical)

The post projection uses fresh pre-3 only. This report is metadata. Of the
remaining 32 comparable task paths, exactly four are the approved construction
changes listed in section 9; the other 28 must remain byte-identical.
Generated evidence, caches, Maven targets, Vite dist, Playwright reports and
test-results are excluded. Final raw and comparable IDs, scoped
task/unrelated/concurrent/metadata counts, submitted 33-path hashes, and this
report's final SHA-256/bytes are emitted in
`evidence/P10-COMP-03/final/`. The two external contract patches are recorded
as `external_authorized_contract_patch`, never workspace task changes.

The report-excluded comparable projection is workspace
`B7421B23588C7FF049F293D9490FB9A0EE73F48BBF77330FFF1C2CAFE9BE5FED`
/1541 before and
`CA3D31C2F0A95EB726EE80AB5DC09376864E57287E044E24E6E12A8EED57DFFA`
/1541 after; task is
`41726E9699733A5F9422A25500FEC660BCF65DC261A55312FFB83AD34BEB262A`
/32 before and
`18AFD21B3B68E87709A8B332B1F7CD38DD62C088B0B53D76DA3D491096E095FF`
/32 after. The scoped classification is task/unrelated/concurrent/metadata
`4/0/0/1`. The four task changes are exactly the paths listed in section 9.
No independent PASS is claimed by these construction-side results.

The independent reviewer subsequently returned `FORMAL FAIL`. The accepted
Gate, registry, alias, frontend and Browser evidence was not the cause. The
review found three contract gaps in the public L2 composites: `DataTable` did
not implement its declared server sort/filter intents or loading/empty/partial/
error projections; `ProcessActionPanel` did not fail closed for typed error
states; and `DescriptionList` did not own a fixed masked projection. This
verdict remains part of the evidence chain and the old post is not reused.

## 12. RESUBMIT-1 test-first correction

The only RESUBMIT-1 production/test changes are five approved paths:

- `records/DataTable.vue` and `records/shared-components.test.ts`;
- `records/DescriptionList.vue` (covered by the same records test);
- `actions/ProcessActionPanel.vue` and `actions/shared-components.test.ts`.

The fresh baseline is workspace
`C28742FEB27279A28529B87F10AF3709EE05269706FC34A8F93667BEA0DFCBA5`
/1542 and task
`28DAC914909E09342312237921492AE01275AE3403D36F1C67D563EC9ACE7E51`
/33, metadata empty. Tests were changed before production. The first targeted
run exited `1`: 2 files, 8 tests, with exactly four failures covering sort,
loading, masked output and error-action fail-close. After the minimal three-
component implementation, the same 8 tests passed. A reviewer-required ninth
test then proved contradictory caller input (`status=409`, `kind=forbidden`)
does not guess either permission or conflict recovery and emits only generic
retry. The final six focused suites passed 6 files/23 tests; the public alias
contract passed 1 file/2 tests.

`DataTable` consumes the existing typed `AsyncState` rather than creating a
second state model. Loading, empty, error and partial projections have a single
caller-owned source; partial may retain the caller-provided rows. Sort and
filter controls are generated only for explicitly enabled columns, and the
emit functions independently reject unknown keys. Mobile row projection is
retained. `ProcessActionPanel` disables ordinary actions for every error state
and classifies recovery only when status and typed `UiError.kind` agree:
403/forbidden, 409/conflict, or otherwise generic retry. The three recovery
events are mutually exclusive. `DescriptionList` resolves `masked` before
value projection, renders a fixed safe label, and never places the original
secret in DOM text, HTML or attributes; blank and null values use the fixed
empty placeholder.

## 13. RESUBMIT-1 final matrix and Browser

The formal final matrix used the frozen five-path change set. Python compile,
official self-test 85/85, reviewer probes 6/6 and 7/7 (fail-open 0), reference
matrix 20/20, source self and package self all exited `0`. Current debt remains
visible and structurally unchanged: source `FAIL/340` (7 pages, 46 actions),
project UI `FAIL/193` across 60 files (`181` raw + `12` legacy, structural 0),
and package phase10 `FAIL/79` across 4 files. Lint and typecheck exited `0`;
full unit passed 42 files/222 tests; employee, center and admin builds exited
`0` with the existing approximately 2.080 MB warning; Knip exited `0`.

The fresh P016 fixture used only 18090 and 5360–5362 and reached READY with
real Spring, PostgreSQL 16.14 migrated from empty through V125, and Redis 7.4.
Desktop Chromium passed 1/1 (13.4 s test / 19.2 s total). Cleanup targeted only
the recorded launcher PID 43872 with `/F /T` and exited `0`. PostgreSQL
`361e2a25f8dac9362ee2afccac35a1c2e89b735e2bc30ea6d42f005709f35f95`
and Redis
`c1d65ac1077b4da02717acf4b2f82a94382500ea935bf56f6dc996719891993a`
are ABSENT. Running Testcontainers, Ryuk, listeners on the four fresh ports,
and new fixture/Maven/Java/Vite/Playwright/Chromium processes are all zero.
The seven pre-existing API/worker/Vite runtime PIDs remain 7/7 and were not
stopped or reused.

## 14. RESUBMIT-1 submission boundary

The authoritative baseline is only `resubmit-1/pre`. Evidence, targets, caches,
dist, reports and test-results are excluded. Report-excluded comparison must
classify exactly five task changes, zero unrelated, zero concurrent and one
metadata report change. The submitted inventory remains the original 33 owned
paths; its final hashes/bytes, raw and comparable IDs, scoped classification,
and report metadata hash are emitted under `resubmit-1/final`. This report and
the construction evidence request independent review; they do not declare
P10-COMP-03 or L2 PASS, and P10-COMP-04/05 remain locked.

The corrected report-excluded projection is workspace
`CA3D31C2F0A95EB726EE80AB5DC09376864E57287E044E24E6E12A8EED57DFFA`
/1541 before and
`A3D71D0843777BD92C574EDE0529CE03127E6DEE85E286FD285AC342263FC4CF`
/1541 after; task is
`18AFD21B3B68E87709A8B332B1F7CD38DD62C088B0B53D76DA3D491096E095FF`
/32 before and
`09065B3F69C1E682F0DB20BE42E007898EB76A3017D64463594BC1196C3E7773`
/32 after. Scoped task/unrelated/concurrent/metadata is `5/0/0/1`.
The first comparable wrapper exited `0` but produced semantically invalid empty
projections because its property-form `Where-Object` predicate was malformed;
a first correction then failed parsing before execution due to an invalid
here-string header. Both non-authoritative failures are retained. The explicit
scriptblock correction exited `0` and produced the IDs and classification
above. No source changed across either wrapper failure or correction.

## 15. RESUBMIT-1 FORMAL FAIL-2 and RESUBMIT-2 red chain

The independent reviewer accepted the typed error fail-close behavior of
`ProcessActionPanel`, the contradictory status/kind negative case, and the
fixed masked projection of `DescriptionList`. The second formal failure was
limited to `DataTable`: when `state` was present, rows still came from the
separate `rows` prop rather than `AsyncState.data`, and filter controls were
hidden when an empty server result made `showRows` false. The old
RESUBMIT-1 post remains historical and is not reused.

RESUBMIT-2 used fresh workspace baseline
`72EDB466A366909032A121EFF5A8672DE29A22803816D9DF8341B20A951CFCF1`
/1542 and task baseline
`3A63CF6A3A543FC3A9A14999D598DB67688148831215F3E9EC0465073BF60B10`
/33, with empty metadata. Tests changed before production. The first records
run exited `1`: 7 tests, exactly 2 failures and 5 passes. The failures proved
that conflicting legacy rows were displayed instead of authoritative
`state.data`, and that an active filter disappeared in the empty state. The
existing negative handler test already passed and continued to prove that
unknown or non-filterable keys emit no `filterChange`.

The minimal production correction introduced only an `effectiveRows`
projection: when `state` is supplied it reads only `state.data` (or an empty
array when data is absent); only the backward-compatible no-state path reads
`rows`. Success, partial, empty, desktop and mobile projections all consume
that single row source. Filter controls are generated from the explicit
filterable-column whitelist independently of row visibility, so an empty
server result remains recoverable and clearing the controlled value emits the
same whitelisted intent. The corrected records suite passed 7/7.

The test-only callable-handler assertion initially exposed two fixture typing
and lint failures. The first typecheck exited `2` because the Vue internal
instance shape was not narrowed. After an approved minimal `unknown`-based
shape, typecheck passed but lint exited `1` because the cast still accessed
`wrapper.vm.$` before narrowing. The final approved named-variable cast
narrowed `wrapper.vm as unknown` first; records 7/7, typecheck and lint then all
exited `0`. No `any`, ignore directive or production debug API was added.

## 16. RESUBMIT-2 formal Gate and frontend matrix

The frozen change set contains exactly two task-source files:

- `DataTable.vue`: `64B135E8...F8CC4` /4950 bytes to
  `F32004A3...0EDE5` /5182 bytes;
- `records/shared-components.test.ts`: `A0F2F99B...028DA` /4435 bytes to
  `6AA0309E...557DC` /7537 bytes.

Python compile, official self-test 85/85, reviewer probes 6/6 and 7/7 with
fail-open 0, reference probes 20/20, source self and package self all exited
`0`. Current debt remains explicit: source `FAIL/340` (7 pages, 46 actions),
project UI `FAIL/193` over 60 files (`181` raw + `12` legacy, structural 0),
and package phase10 `FAIL/79` over 4 files. Six focused suites passed 6 files
/26 tests; the alias suite passed 1 file/2 tests. Lint and typecheck exited
`0`; full unit passed 42 files/225 tests; employee, center and admin builds
exited `0` with the existing approximately 2.080 MB warning; Knip exited `0`.

Two orchestration failures are preserved without changing their underlying
results. First, a five-Gate wrapper ended with the literal `exit$x` and thus
the combined shell exited `1`; each of its five authoritative `exit.txt`
files is `0` and the reviewer explicitly accepted the wrapper classification.
Second, the first read-only freeze inventory used `Get-Item$p` instead of
`Get-Item -LiteralPath $p`, producing an invalid 33-diff/zero-byte result. It
wrote no candidate file. The one corrected read-only command exited `0` and
proved the exact two-file diff above. Two additional read-only CLI-discovery
commands exited `1` because they guessed a nonexistent script/path; they were
not Gate commands and caused no repository mutation.

## 17. RESUBMIT-2 fresh P016 Browser and cleanup

The fresh fixture used only 18090 and 5360-5362, with real Spring, fresh
PostgreSQL 16.14 migrated from empty through V125, and Redis 7.4. It reached
the unique READY marker. Desktop Chromium passed 1/1 (14.2 seconds test,
20.2 seconds total). Cleanup targeted only recorded launcher PID 50824 with
`/F /T` and exited `0`.

PostgreSQL container
`81202d9a83d64a9f7eb5486433eb4b38c1f04019c377959b8f9d8af25b03674a`
and Redis container
`6dc29121cd2ca7c779ae6c5fa7413e20c49f9607fec5bd81bfa7007703772314`
are both ABSENT. Running Testcontainers and Ryuk, listeners on all four fresh
ports, and the recorded new launcher/Spring processes are zero. The seven
pre-existing API/worker/Vite runtime PIDs remain 7/7, listeners 5173-5175
remain three, and none was stopped or reused.

## 18. RESUBMIT-2 submission boundary

The only authoritative baseline is `resubmit-2/pre`. Evidence, generated
targets, caches, dist, reports and test-results are excluded. The
report-excluded comparable projection is workspace
`32C7D820B62597FA13C7100AAC206CFB8A5E629EB82F33E7C80DFDD5BA6E2BF4`
/1541 before and
`471F1B300B3FFCB1E08CB6811EB6429AE261FA51D96E41CC08082CDEB97A744F`
/1541 after; task is
`09065B3F69C1E682F0DB20BE42E007898EB76A3017D64463594BC1196C3E7773`
/32 before and
`DE1EFD918C68AD4977B4678FD5F67AFBDE8309A345567F5A3B4006380C325F0E`
/32 after. Scoped task/unrelated/concurrent/metadata is `2/0/0/1`.

The submitted inventory remains all 33 owned paths; final hashes/bytes, raw
post IDs, comparable manifests, scoped classification and report metadata are
emitted under `evidence/P10-COMP-03/resubmit-2/final`. These construction-side
facts request independent review and do not declare P10-COMP-03 or L2 PASS.
P10-COMP-04/05 remain locked pending the independent verdict.
