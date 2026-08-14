# P10-COMP-03A UI component access report

Status: construction complete; independent review pending.

Resubmission note: the first independent review was `FAIL`. The original Gate
failed open for six mutations covering the governed platform root, registry
state/public combinations, canonical schema requirements, malformed plan
instances, dynamic native components, and non-literal deep imports. The
reviewer-owned Gate and six-probe fixture are preserved unchanged.

## 1. Repository root

`I:\PublicCompany_source_codex` (the only modified project root). Git metadata
is absent. No remote Git operation was performed.

## 2. Pre-construction baseline

- Package `LOCAL/00` and `LOCAL/01` direct invocation was blocked by the local
  execution policy before either script started; `$LASTEXITCODE` was empty.
- The required Bypass invocation started both scripts; both exited `1` because
  the package PowerShell source has parsing/encoding errors. These are failures,
  not PASS evidence.
- Project-side preflight/baseline exited `0/0`.
- Workspace source: `A75B79B5A65782DF26CF9C3F58A0ECCB2A9CEE48B4E1F3CB7819FE787FEEB5B6`
  / 1483 files.
- Task source: `76CC17082AC76CB1CB38C7BC7967CB39E36520E437A74D23757CCCF443C76B4B`
  / 23 planned paths (5 existing, 18 missing).
- Evidence metadata: `4F53CDA18C2BAA0C0354BB5F9A3ECBE5ED12AB4D8E11BA873C2F11161202B945`
  / 0 files.

## 3. Change summary

The package UI component access rules are projected into a single project-side
authority. The candidate establishes canonical documentation and plans, exact
public aliases, an empty platform-composite public boundary, and a fail-closed
registry/access Gate. It does not implement P10-COMP-03 or any P006-P010 page,
API, permission, cache, or state-machine change.

## 4. Planned file inventory

The submitted scope is the 23 paths frozen in
`evidence/P10-COMP-03A/pre-claim/baseline-manifest.json`: root `AGENT.md` and
`DESIGN.md`; 15 canonical files under `docs/implementation/ui`; TypeScript and
Vite alias configuration; both public indices; one alias contract test; and the
project Gate. Evidence files are excluded from task source.

## 5. Page component usage plans

Canonical, non-empty plans exist for P006 Meeting, P007 Schedule, P008 Leave,
P009 Overtime, and P010 Learning. Each preserves the source-defined routes,
portals, permissions, states, actions, desktop/mobile projection, security
boundary, reuse decision, and deferred later-task gaps. No native-element
exception or premature platform composite is claimed.

## 6. Reuse, component, and registry changes

- Actual Design System rescan: 42 `.vue` sources.
- Canonical Design System registrations: 42; unregistered/stale: 0/0.
- Existing public exports: 39 through `@sgj/ui`; internal components: 3 and not
  public.
- `@sgj/platform-ui` is deliberately an empty public index because all 15
  platform composites remain `planned` and ManagedUpload remains
  `blocked-by-contract`.
- P10-COMP-01/02 completed fixes allow Select, both pickers, Drawer, and
  PortalShell to be recorded as `existing-stable` after this local rescan.
- No component source, registry ID, public export, or exception was invented.
- Both governed roots (`design-system/**` and `platform/processes/shared/**`)
  now participate in source-to-registry-to-barrel-to-test reconciliation. A
  closed status/layer/public/import/export/test matrix rejects invented or
  contradictory registry declarations.

## 7. Design decisions and security boundary

- `@sgj/ui` resolves only to `src/design-system/index.ts`.
- `@sgj/platform-ui` resolves only to
  `src/platform/processes/shared/index.ts`.
- The aliases apply in Vite test, analysis, and all three portal build modes.
- Business layers may not deep-import Design System/templates/layout/platform
  internals or create duplicate primitives.
- Design System production code may not call `/api/`, fetch/axios, cache
  business facts, or own P006-P010 permission/process codes.
- Native-element exceptions remain an empty, separate ledger. Existing debt is
  recorded as findings, never converted into a permanent exception.
- The canonical plan schema requires `source_facts` and
  `responsive_projection`; every P006-P010 plan is checked recursively for
  required fields, types, enums, nested item shape, and unknown fields.
- Statically provable dynamic components/imports are resolved and checked.
  Unsupported expressions fail closed, while literal safe async imports and a
  safe static dynamic element remain valid.

## 8. Gate and test results

Historical RESUBMIT-2 frozen results (superseded for the current-source
projection by the RESUBMIT-3 section below):

- Project UI-access self-test, project source self-test, and package UI
  self-test all exited `0`. The earlier construction package self-test exited
  `1` on a GBK subprocess decode defect and remains preserved as a failed run.
- The first current scan never started because its wrapper redirected into a
  missing evidence directory. Two later Python commands used a wrong
  web-relative Gate path and exited `2` (and `1/2` for compile/self); none is
  counted as a Gate result. Corrected compile/self runs exited `0/0`, covering
  the positive case and nine independent negative categories.
- RESUBMIT-2 project current UI-access Gate: `1 / FAIL / 190` findings across 26 production
  files (181 `RAW_INTERACTIVE_ELEMENT`, 9 `LEGACY_COMPONENT_IMPORT`). Registry,
  aliases, plans, and component coverage add zero findings.
- Project current source Gate: `1 / FAIL / 340`, with 7 discovered routed pages
  and 46 contract-derived actions. Package current UI Gate: `1 / FAIL / 79`
  across 4 pages. These are visible migration debt, not candidate failures.
- Public alias test: 1 file / 2 tests PASS. Targeted, lint, typecheck, full unit,
  three-portal build, and Knip all exited `0`; the full unit run executed 36
  files / 198 tests. Employee/center/admin builds passed, retaining the existing
  ~2.080 MB chunk warning.
- Representative P016 Browser attempt 1 reached fixture READY, but the wrapper
  treated the `NO_COLOR`/`FORCE_COLOR` warning as `NativeCommandError` and
  aborted before a Playwright result. It is not a Browser PASS. Controlled
  cleanup removed PostgreSQL `ce11657d2ba102c21720b5018032f48dbf715d70ca98f47bc414ba0c8d6380d9`
  and Redis `f0d3eca719599426a4d4fcf58130795c3e3395425066034cff90309eb9fe9e1f`;
  exact IDs, listeners, and workspace processes were all zero afterward.
- A corrected wrapper used a fresh fixture. Real Spring `:18090`, fresh
  PostgreSQL 16.14 empty-to-V125, and Redis 7.4 reached READY; desktop Chromium
  passed 1/1 (13.5 s test / 18.2 s total). Controlled shutdown did not require a
  forced stop. PostgreSQL `042bef640ded845b70b44a7109f1432db6871b5ea6a056ca10d3c29550771dc0`
  and Redis `9b3ac6f037299c5bf7c388fdc85bf366e718eb711f3a5fe6b446dd02a5b4a9e8`
  were ABSENT; ports 18090/5360/5361/5362 and workspace processes were zero.

Resubmission formal frozen checks:

- Python compile exited `0`; official self-test exited `0` with 20 cases,
  including clean/static-dynamic positives and all original plus reviewer
  negative categories.
- The unmodified reviewer six-probe fixture exited `0`; `probe_count=6` and
  `fail_open_count=0`. Stable findings are `COMPONENT_NOT_REGISTERED`,
  `PLAN_SCHEMA_REQUIRED_INVALID`, `PAGE_PLAN_SCHEMA_INVALID`,
  `REGISTRY_STATUS_INVALID`, `DYNAMIC_NATIVE_COMPONENT`, and
  `DEEP_COMPONENT_IMPORT`.
- Before the schema authority was corrected, current Gate exposed 191 findings:
  the existing 190 source debts plus `PLAN_SCHEMA_REQUIRED_INVALID`. That
  canonical defect could not be waived. The schema was extended under explicit
  ownership approval, adding only `source_facts` and
  `responsive_projection` to `required`.
- After correction, current Gate is again `1 / FAIL / 190` (181 raw controls,
  9 legacy imports); canonical/registry/alias/plan structural findings are 0.
- The first resubmission pre (`5AC2C45F...13FFB1`, task
  `1701FEBB...510F2`) was explicitly ABORTED after the schema source changed and
  is not reused. Fresh pre-2 project preflight/baseline exited `0/0`:
  workspace `1EE760B478C9432364B692ADE32C61C841B769F9CE048CD73C7B94C22279D35D`
  / 1503; task `A3E20B12B46FB350534C2D563709C5E7B92203ECF80577D53A98291909E09DBB`
  / 23 existing paths; metadata empty / 0; Git absent.
- Formal compile, official self-test 20, and the unmodified reviewer six-probe
  fixture exited `0/0/0`; the reviewer result remained `fail_open_count=0`.
  Project source self-test and package UI self-test also exited `0/0`.
- Formal current debt remained project UI `1 / FAIL / 190` with structural 0,
  project source `1 / FAIL / 340` with 7 routed pages and 46 actions, and
  package UI `1 / FAIL / 79` across 4 pages.
- Targeted alias, lint, typecheck, full unit, three-portal build, and Knip all
  exited `0`; unit executed 36 files / 198 tests. The existing ~2.080 MB build
  warning remains visible.
- Fresh representative P016 reached READY on real Spring `:18090`, PostgreSQL
  16.14 empty-to-V125, and Redis 7.4. Desktop Chromium passed 1/1 (13.5 s test /
  18.2 s total). Controlled Ctrl+C produced the expected fixture command exit
  `1`. PostgreSQL `a34f513923afb63866c185e9fc712efe4eea4474b5f10f73eaf2a50dbc8fa010`
  and Redis `2dd1ae51285f0e2d2f43d68282bf4954f86af707762dcb460f2b7424dab10c59`
  are ABSENT; Ryuk, ports 18090/5360/5361/5362, and workspace processes are 0.
- The first final post-preflight wrapper passed the unsupported parameter name
  `OutputDirectory`; PowerShell exited `1` before the project preflight tool
  started. That orchestration failure is retained and is not counted as a Gate
  result. The corrected invocation used `EvidenceDirectory` and the real
  project preflight exited `0` before the final post baseline was generated.

## 9. Evidence directory

`docs/implementation/ui/evidence/P10-COMP-03A/` contains the package invocation
failures, project preflight/baseline, construction diagnostics, both Browser
attempts and cleanup records, final Gate logs, submitted hashes, post baseline,
and scoped diff. The evidence tree is excluded from all source IDs.

## 10. Blockers and remaining debt

The 190 all-scope and 101 phase10 findings are real later-task migration debt.
They are not waived by P10-COMP-03A and keep the real current Gate red. Package
PowerShell parsing and package self-test encoding defects are external package
issues and are retained verbatim. No skip or permanent exception is used.

## 11. Dependency unlock decision

## 12. RESUBMIT-3 hardening and current L0–L5 coverage

RESUBMIT-2 was explicitly aborted and none of its pre/post identifiers is
reused. RESUBMIT-3 preserves the canonical schema, aliases, public indexes,
plans, production pages, and reviewer-owned fixtures as read-only. Its source
changes are limited to the component-access Gate, the canonical registry, and
the existing component runtime test; this report and its evidence are metadata.

The Gate now proves a component's declared test imports and consumes the same
implementation or public export inside an executable test callback. It rejects
callback-local binding/namespace shadows, unconsumed alias-name arrays,
unrelated tests, object/array alias mutation after a `v-bind` initializer,
descendant or duplicate SFC scripts, comment/string fake dynamic-import
constants, CommonJS deep imports, `import.meta.glob` deep imports, static and
programmatic native controls, and Design System session/cache/process coupling.
The production scan covers every production `.vue`, `.ts`, `.tsx`, `.js`, and
`.jsx` file under `technical-platform/web/src`, excluding governed component
roots, tests, fixtures, evidence, and generated output.

The final RESUBMIT-3 official self-test is `77/77 PASS`; it includes all earlier 27 cases plus
required-test linkage, namespace-shadow, decoy-array, object escape, top-level
SFC authority, fake dynamic-import binding, full-source enumeration, CommonJS,
glob, static/programmatic native, and Design System boundary variants. The
reviewer six-probe and resubmit-1 seven-probe fixtures remain `0` exit with
`fail_open_count=0`. The updated real component suite runs `36 files / 199
tests PASS` and directly mounts PartialFailure, FieldFrame, and StatePanel.

The Windows source-Gate self-test was initially retried with both `TEMP` and `TMP` set to
`docs/implementation/ui/evidence/P10-COMP-03A/resubmit-3/temp`. It still
exited `1`: Python could create the root temporary directory but received
`WinError 5` creating its nested fixture tree. This is retained as an
environment failure and is not represented as a passing result. The unchanged
candidate later completed the same source self-test with
`PYTHONDONTWRITEBYTECODE=1`, exit `0`; both the failure chain and final result
are retained. The reconciled, non-overlapping L0-L5 matrix is the final matrix
at the end of this report; the superseded overlapping draft table was removed.

With the intentional full production scope, the current UI-access result is
`1 / FAIL / 193`: `181 RAW_INTERACTIVE_ELEMENT` and
`12 LEGACY_COMPONENT_IMPORT`. Registry, alias, schema, plan, and test-linkage
structural findings are `0`. The changed total is an honest scope expansion
from the prior 190-finding projection, not a new exception or a task failure.

Nothing is unlocked by this construction report. Only an independent formal
PASS may unlock the next YAML dependency. P10-COMP-03 and all later tasks stay
locked until that verdict.

## 12. Post-construction baseline

The coordinated post-baseline completed with project preflight/baseline exit
`0/0`:

- Workspace source: `222602D6659C7E9A9A027C63F9D0D3635BA2E2B01B5555B3C758070A807F33EA`
  / 1500 files.
- Task source: `FE96B72DCA3B646DF9107ACE3D969D01B5E4777A88E7BDBB5F5EFDD6BB123C42`
  / 22 implementation files. All 23 planned paths exist; the report is tracked
  separately as evidence metadata to avoid self-reference.
- Scoped pre-to-post changes: UI task 21, concurrent CORE 1, unrelated 0,
  evidence metadata 1. The sole CORE change is
  `technical-platform/web/e2e/phase11-p015-live.spec.ts`, with the declared
  accessible-checkbox locator adjustment; it is not counted as UI work.
- The final evidence metadata ID and report SHA-256/bytes are emitted by the
  final post manifest and `submitted-sha256.json`, after this report is frozen.
- Git remains absent; generated logs, targets, dist, reports, test-results,
  caches, secrets, and all task evidence directories remain excluded.

The IDs above are the original submission history, retained rather than
rewritten. For resubmission, pre-2 is the sole valid comparison baseline. Its
raw workspace/task IDs include the already-existing report among the 23 planned
files. To avoid report self-reference, the comparable source projection removes
the report from both sides and tracks it only as metadata:

- Comparable pre and post workspace source:
  `C1EDDA4378BC96A1AD5877646A8B19918F0340CAD580E72CBE25CCD4176E4787`
  / 1502 files.
- Comparable pre and post task source:
  `D92E47BC07DC2C8C1A4FE839E31082F289BCBA27A489C0BF76BF8D95CBCE2909`
  / 22 implementation files; all 23 planned paths exist.
- Fresh scoped task / concurrent CORE / unrelated / metadata is `0/0/0/1`.
  No hand-written source changed after pre-2; the report is the sole metadata
  change. Generated frontend and Browser artifacts remain excluded.
- Final metadata ID and all 23 submitted SHA-256/byte records are emitted by the
  frozen final manifest and `submitted-sha256.json` after this report is hashed.

## RESUBMIT-1 independent result and RESUBMIT-2 correction

The independent RESUBMIT-1 review accepted the original six probes, canonical
required-field repair, structural-zero/current-190 classification, comparable
IDs, 23-file hashes, frontend evidence, and fresh P016 cleanup. It nevertheless
returned `FAIL`: seven new adversarial mutations still passed the mandatory
Gate. A public barrel could contain only a commented or string-shaped export;
the alias test could contain only a comment; `required_tests` could name a Vue
source file; object-form `v-bind` could hide a native dynamic component; and the
canonical schema could remove the `page_type` enum or replace `componentMap`
with an unconstrained object. The reviewer fixture and formal Gate update are
retained read-only. The RESUBMIT-1 post is history and is not reused.

RESUBMIT-2 changes only the access Gate, this report, and task evidence:

- Barrel parsing now masks comments, quoted/template strings, and regular
  expressions, splits balanced top-level statements, and accepts only supported
  real export declarations. Unsupported export grammar fails closed.
- Registry test paths must stay inside the web test scope and end in a real
  `.test`/`.spec` JavaScript or TypeScript extension. Their source must contain
  real imports plus executable `test`/`it` and `expect`/`assert` code. Alias
  coverage is derived from a real `@sgj/ui`/`@sgj/platform-ui` namespace import,
  a statically declared expected-export array, and runtime `Object.keys` plus
  indexed binding assertions; comments and strings cannot satisfy it.
- Dynamic-component analysis covers direct `:is`, object-form `v-bind` with a
  direct `is`, and statically resolved object spreads. Native results fail with
  `DYNAMIC_NATIVE_COMPONENT`; calls, ambiguous spreads, and unsupported object
  grammar fail with `DYNAMIC_COMPONENT_UNRESOLVED`.
- An immutable meta-contract embedded in the Gate independently fixes the
  canonical schema dialect/keys, exact required set, every top-level property
  contract and enum, and the complete nested `componentMap` contract. The
  mutable schema can no longer validate a weakened copy of itself.
- Official self-test now executes 27 cases (the prior 20 plus the seven exact
  RESUBMIT-1 categories) with real clean alias/dynamic positives. Both reviewer
  fixtures run unchanged with `fail_open_count=0`. Extra local variants also
  reject nested fake exports, string-shaped fake tests, static native spreads,
  unresolved object spreads, and top-level schema loosening.
- The RESUBMIT-2 live current Gate remained intentionally red for 190
  source debts: 181 raw interactive elements and 9 legacy imports. Canonical,
  registry, public-boundary, alias, test, and plan/schema structural findings
  are zero. The 340 project source and 79 package UI debts remain unchanged.

The RESUBMIT-2 fresh pre/post IDs, final matrix, hashes, and Browser cleanup are
recorded only after a new coordinated freeze. No RESUBMIT-1 baseline is carried
forward.

## RESUBMIT-3 construction status (not yet an independent verdict)

RESUBMIT-2 was formally aborted after independent adversarial probes found
additional fail-open paths. RESUBMIT-3 keeps the scope limited to the access
Gate, component registry, its direct component test, this report, and its
evidence. The hardening work completed before any new baseline is:

- `required_tests` now proves a real implementation or public-export binding is
  consumed inside an executable `test`/`it` callback with an assertion; callback
  locals cannot shadow the imported component or namespace. Internal components
  have direct implementation coverage rather than borrowing a public alias test.
- Namespace coverage requires the declared export set to flow into an assertion
  against the same imported namespace. Unconsumed decoy arrays are rejected.
- Static `v-bind` object values require an immutable, non-escaped binding. Direct
  writes, array aliases, `Object.assign`, and unknown escapes fail closed.
- Vue script authority is restricted to valid top-level SFC script blocks. The
  Gate masks comments, strings, templates, and regex literals for imports and
  dynamic-import constants; it rejects unsupported ambiguity. It also rejects
  static/dynamic native components, programmatic `h('button')`, CommonJS deep
  imports, and `import.meta.glob` deep imports.
- Production scanning now covers all production `.vue`, `.ts`, `.tsx`, `.js`, and
  `.jsx` files below `technical-platform/web/src`, excluding governed component
  roots, test/fixture/evidence paths, and generated output. The live UI debt is
  consequently `193`: `181` raw interactive elements and `12` legacy imports;
  structural findings remain `0`.

Construction-only verification, before a fresh coordinated baseline, is:

- `py_compile`: exit `0`.
- official Gate self-test: exit `0`, `77/77` cases. The final set includes
  reference-context negatives for namespace aliases, optional/member calls,
  mutable aliases, conditional/bound/container/argument/return escapes, and
  clean recursive immutable component-binding positives.
- original reviewer fixture: exit `0`, `6` probes and `0` fail-open findings;
  RESUBMIT-1 reviewer fixture: exit `0`, `7` probes and `0` fail-open findings.
- design-system component suite: exit `0`, `36` files / `199` tests.
- project source Gate current scan: expected exit `1`, `340` findings across
  `7` route pages and `46` action codes; it remains visible debt, not a pass.

The project source Gate's own self-test was first attempted twice with `TEMP`
and `TMP` redirected to the writable RESUBMIT-3 evidence temporary directory.
Both attempts stopped before fixture execution with Windows `WinError 5` while
its fixture code created a nested temporary directory. Those environment
failures remain in the evidence chain. A later unchanged-candidate rerun with
`PYTHONDONTWRITEBYTECODE=1` completed with exit `0` and the source Gate's full
router/contract/component-graph fixture summary PASS; the earlier failures are
not rewritten or presented as Gate results. The
RESUBMIT-3 report, baseline IDs, post comparison, hashes, frontend matrix, and
Browser evidence will be refreshed only after the reviewer authorizes a fresh
coordinated window.

### L0-L5 coverage snapshot

The layer counts below are deliberately mutually accountable. The 42 Vue files
under `src/design-system` are partitioned into L1 `35` (32 public
`design-system` plus 3 `internal`) and L4 `7` (6 `template` plus 1 `layout`), so
the matrix does not double-count all 42 as L1. Counts describe inventory or
Gate coverage, not layer completion.

| Layer | Recomputable source | Covered / total now | Owning P10 task(s) | Applicable acceptance / remaining block | Review state |
| --- | --- | ---: | --- | --- | --- |
| L0 tokens | unique `--sgj-*:` definitions in `technical-platform/web/src/design-system/tokens.css` | 74 / 74 inventoried | P10-COMP-01, P10-COMP-08 | token definition/consumption and full quality Gate; later tasks may still expose usage debt | measured, no LAYER PASS |
| L1 pure Design System | registry groups `design-system=32`, `internal=3`; corresponding Vue implementation paths | 35 / 35 registered and test-linked | P10-COMP-01, P10-COMP-03A, P10-COMP-08 | public/internal classification, export and executable-test closure; current 03A Gate is still awaiting formal review | pre-submit code PASS only, no LAYER PASS |
| L2 shared process UI | registry `platform-composite`: 15 `planned` + 1 `blocked-by-contract`; implementation paths do not yet exist | 0 / 16 implemented | P10-COMP-03, P10-COMP-08 | AsyncState/shared composites must be implemented without process/API coupling; one contract block remains explicit | BLOCKED / planned, no LAYER PASS |
| L3 process modules | five P006-P010 machine-valid page plans are the currently declared module set | 0 / 5 modules closed | P10-COMP-04, P10-COMP-05, P10-COMP-06 | typed services/composables/selectors and process public indexes are later work; this task only validates plans | NOT STARTED, no LAYER PASS |
| L4 templates and shell | registry groups `template=6`, `layout=1`; 7 of the 42 DS Vue sources | 7 / 7 registered and test-linked | P10-COMP-02, P10-COMP-03A, P10-COMP-08 | runtime route/main/h1 and Browser acceptance remains task-gated even though registry/test closure is present | inventoried/test-linked, no LAYER PASS |
| L5 thin pages | `*.vue` directly under `technical-platform/web/src/platform/pages` | 22 / 22 inventoried; 0 / 5 P006-P010 modules closed | P10-COMP-04, P10-COMP-05, P10-COMP-06, P10-COMP-08 | live debt is 193 across the expanded 60-file production scan: 181 raw controls + 12 legacy imports, structural 0 | BLOCKED by real source debt, no LAYER PASS |

The L0 count is recomputed with `rg` over `tokens.css`; L1/L2/L4 counts come
from `UI_COMPONENT_REGISTRY.json` grouped by `layer,status`; L5 is a direct
filesystem enumeration of the pages root. The current access Gate scan covers
60 production `.vue/.ts/.tsx/.js/.jsx` files and reports exactly 193 source
debts (`181` raw, `12` legacy) with zero registry/public/schema/plan/alias
structural findings. No row claims that P10-COMP-03 or L0-L5 is complete.

## RESUBMIT-3 FINAL-3 submission

This section supersedes the construction-only wording above for the current
submission while preserving every failed/aborted attempt as history. It does
not claim an independent verdict and does not unlock P10-COMP-03B or any later
L0-L5 task.

Two external, explicitly authorized contract patches preceded FINAL-3. They
added only the exact `ShowcaseApp.vue` and `knip.json` paths to
P10-COMP-03A's allowed paths in the separate remediation package. The package
remains outside this workspace and is classified as
`external_authorized_contract_patch`, never as workspace task source. The
resulting project fixes were equally narrow: remove the unused
`DateTimeMode` type import from `ShowcaseApp.vue`, and register the real
`src/showcase/main.ts` HTML entry in `knip.json` without an ignore. Independent
single-file/full lint and Knip checks passed. The earlier lint-blocked and
dead-code-blocked FINAL attempts and their fresh baselines remain ABORTED.

The sole valid FINAL-3 baseline is fresh pre-3:

- raw workspace `EF7F7B64D361333A3D6A009EE43BDAAE3997A8C4945DDC76644AD3DB3051DFBF`
  / 1513 files;
- raw task `5632C64CFC840C578175666DD0E10F33A7F45C3E4B56F8CAA0F75FEFD5B85C5B`
  / 25 existing planned paths; raw metadata is the empty-set ID
  `4F53CDA18C2BAA0C0354BB5F9A3ECBE5ED12AB4D8E11BA873C2F11161202B945`
  / 0;
- comparable pre excludes this report from workspace/task source and tracks it
  as metadata: workspace
  `AAE1CD6634CF11C3CF6C72A3136C7A00E4F67BCB75E86A5B807BED9B1623FC7F`
  / 1512, task
  `839DFB87CAC8AA8917E876033413853A14644F797CD35D79DB5DDEB84865F866`
  / 24, metadata
  `0EB8ADDD2C1A331954FD818784F424C02DEE4658E32E578C36ADB85A2EFBE420`
  / 1.

The complete Gate/targeted matrix was rerun on the frozen candidates:

- Python compile, official self `77/77`, source self, original reviewer
  `6/6` with `fail_open_count=0`, RESUBMIT-1 reviewer `7/7` with
  `fail_open_count=0`, and the independent reference-context matrix
  `20/20` all exited `0`.
- The expected current debt remained visible: source Gate exit `1` / `FAIL`
  / 340 findings (7 route pages, 46 actions); project UI Gate exit `1` /
  `FAIL` / 193 (`181` raw + `12` legacy, structural `0`); package UI Gate
  exit `1` / `FAIL` / 79 under the authoritative `--scope phase10` interface.
  The older erroneous `--scope all` result 207 is retained only as a command
  interface failure, not as the authoritative result.
- package self exited `0`; targeted Vitest exited `0` with 2 files / 10 tests.
  The two earlier Windows `WinError 5` source-self attempts remain visible;
  the unchanged final source-self run exited `0`.

The strict frontend chain also completed: lint `0`, typecheck `0`, full unit
`0` (36 files / 199 tests), employee/center/admin builds `0`, and Knip `0`.
The first build wrapper treated Vite's existing approximately 2.080 MB chunk
warning as a PowerShell terminating native error and exited `1` before it could
represent the full build chain. That wrapper failure is retained. After the
six candidate hashes were reverified unchanged, the one authorized corrected
wrapper completed all three builds with exit `0`; the warning was neither
hidden nor relaxed.

Fresh P016 Browser evidence is likewise independent of the seven pre-existing
runtime processes and their Vite listeners 5173-5175. A new real Spring API on
18090, fresh PostgreSQL 16.14 migrated from empty through V125, and fresh Redis
7.4 reached `PHASE11_P016_BROWSER_FIXTURE_READY`. Desktop Chromium completed
1/1 PASS (test 13.8 s / total 19.3 s). Controlled shutdown stopped only the
new launcher tree (PIDs 47876, 27448, and 976). PostgreSQL container
`9be29362f5a6673e440d25adb77b555f92458420eb8f91e7aca0eb17bdddd7e4`
and Redis container
`fe89b5b71820fa1d85283d2b8b867cbca71009696854e6d2098397cd1d8b589d`
were both ABSENT; Ryuk and running Testcontainers counts were zero; listeners
18090/5360/5361/5362 were zero. All seven pre-existing runtime PIDs remained
present and are classified only as `pre-existing active runtime /
source-baseline non-writer`, never as Browser or process-zero evidence. The
four existing development compose containers were not changed.

The authoritative post uses the same 24-path comparable projection. Its
manifest must reproduce the comparable workspace and task IDs above; scoped
task/unrelated/concurrent changes must be `0/0/0`, with this report as the sole
metadata change (`1`). Generated logs, targets, dist, reports, test-results,
Browser runtime data, caches, secrets, and every P10-COMP-03A evidence tree are
excluded. The submitted hash manifest contains all 25 raw planned files; the
frozen report SHA/bytes and final metadata ID are emitted separately by the
post evidence to avoid self-reference.
