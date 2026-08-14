# PHASE-11 Independent Gate

Status: `PASS / INDEPENDENT_GATE_CLOSED`

Reviewed at: `2026-08-14` (Asia/Shanghai)

Scope: `P011-P016` under the sole source root `I:\PublicCompany_source_codex`. `.git` is absent; no clone, pull, push or remote-CI claim was used. `PHASE-12` is unblocked and may start in sequence.

## Final independent verdict

PHASE-11 passes its independent gate. The historical frontend failures below were reproduced, remediated through tests-first checkpoints, and independently reverified without weakening assertions or replacing real server behavior with mocks. P011-P016 now use thin route shells, public Sgj controls/templates, explicit seven-state resource handling, independent action state, AbortSignal + request-id last-write-wins behavior, visible permission/conflict/error/partial projections, and decomposed Feature/composable implementations within the repository complexity limits.

The final independent matrix is green: source/bindings 31/31; empty PostgreSQL 16.14 through V125 plus Worker 35/35; six Spring API lifecycles 6/6; focused frontend 85/85; complexity 12/12; lint/typecheck/Knip exit 0; full unit 70 files / 636 tests; employee/center/admin builds all exit 0; UI structural findings 0; PHASE-11 source findings 0; and six strictly serial fresh desktop-Chromium lifecycles 6/6. No PHASE-12 implementation was reviewed or pre-accepted.

### Final Definition of Done

| Gate | Result | Independent evidence |
|---|---|---|
| Authoritative source and bindings | PASS | 18 XLSX / 108 sheets / 5,655 non-empty rows; deterministic snapshot SHA `D21D758B6CCE42A68659A2D1711C977FFE8DAFDF56DB57234C775074F3A36C55`; 31/31 explicit bindings. |
| Empty DB / Worker | PASS | PostgreSQL 16.14 empty schema through V125; 12 selected DB/notification classes, 35 tests, zero failure/error/skip; replay, sanitization and rollback retained. |
| API lifecycles and server authority | PASS | P011-P016 six integration classes / 6 tests; permission, data-scope, masking, stale version, idempotency, audit and Outbox negative paths pass. |
| Design system / visible states | PASS | Six route pages are thin shells; six Features import public `@sgj/ui`; raw business controls 0; loading/empty/no-permission/error/conflict and P015-only partial failure are executable mount assertions. |
| Async and action behavior | PASS | Seven states, per-resource AbortController/requestId/LWW, stale success/error isolation, scope-dispose cancellation, typed failure results, same-action in-flight suppression and different-action isolation are independently tested. |
| Complexity / anti-evasion | PASS | Page effective/script/template, Feature/composable callable/computed/top-level thresholds pass; P012-P016 AST checks report max callable 26/24/27/28/40, top-level callables 15 each, dense statement lines 0; skip/only/fixme/retry/waitForTimeout 0. |
| Frontend full regression | PASS | focused 6 files / 85 tests; complexity 12/12; lint 0; typecheck 0; full unit 70 files / 636 tests; employee/center/admin builds 349 modules each; Knip 0. Existing ~2.145 MB Vite chunk warning retained. |
| Structural/static gates | PASS | Project UI current remains expected legacy debt 86/122 = RAW80 + LEGACY6 with structural 0 and PHASE-11 scoped 0. Source self passes; source current has only 14 pre-existing PHASE-10 Attendance/Tech findings and PHASE-11 scoped 0. |
| Real three-portal visibility | PASS | Existing `5173/employee.html`, `5174/center.html`, `5175/admin.html` independently render the correct employee, center and technical login surfaces. Fresh Playwright units start all three portals and exercise real login/navigation/API behavior. |
| Six real Chromium lifecycles | PASS | P011-P016 each passed desktop Chromium 1/1 against its own fresh Spring + PostgreSQL 16.14 + Redis 7.4 fixture; no fixture or browser was reused. |
| Exact cleanup | PASS | All 12 runtime PG/Redis IDs are absent; running Testcontainers 0, Ryuk 0; ports 18090 and 5330-5362 have zero listeners; original runtime PIDs remain 7/7 and 5173/5174/5175 retain owners 40796/36432/15196. |

### Independent Chromium results

| Process | Test / total | PostgreSQL ID | Redis ID | Result / cleanup |
|---|---:|---|---|---|
| P011 | 15.5s / 23.0s | `d2ed13927d7aefb22d34f26c860785f6b62073ecfbf77cbeafa274ce42db35f5` | `9525979a40a6e552e9d99708c39096f479afe259821c9b388b5eb0739ee8a4db` | 1/1 PASS; exact IDs ABSENT |
| P012 | 14.8s / 21.4s | `2e041eca7a854849cf5c4c388a03c82d1cba8bacca34daaea77247104cca95d6` | `cdb304f87498e2f82cf7aea2117d0a0cfed28b103dcfa86d8be57139461a3f8a` | 1/1 PASS; exact IDs ABSENT |
| P013 | 15.4s / 22.1s | `7edd59083c4704af74846b8e6f3cd02d18dd5fd3388ee4da57b7ae660c7a8005` | `87ef0600cd590fd7dfcbd6e863a603662f6342de1d8a83f0908657fa74dd1952` | 1/1 PASS; exact IDs ABSENT |
| P014 | 19.3s / 25.8s | `72ff7ec729905beec19bddb77114848c7cd98b38c7b1af3f1b873be04e04bd3d` | `bd152f1faefa6287adfa1d77169ef851675ce368b07dc27c5f8f2ad0fa69fe95` | 1/1 PASS; exact IDs ABSENT |
| P015 | 18.3s / 24.8s | `0f186d04c473211bad4a4c1315d4fe7236b16123b8b274ee18f19976cba5c82b` | `93007b69afe44b092c71ee1220ea292a2d0e0380ef741bd349ba369370658615` | 1/1 PASS; exact IDs ABSENT |
| P016 | 15.4s / 21.8s | `c1c45cf880c8bad8f10993a68c95da0036b7c813f5ee5ee6f8f0fc71e4a65aff` | `d499edd3a273f84c50390d86bd604eb0ffce6c9461159792c523ee5e02bab47d` | 1/1 PASS; exact IDs ABSENT |

The browser suite proves the employee, center and technical projections for performance, promotion/appointment, reward, discipline/appeal, point-ledger and welfare/care flows; legitimate actions remain available to authorized actors, while cross-center, unauthenticated, stale/conflicting, duplicate/self-action and technical business-action paths fail closed. Technical views remain masked and do not acquire business approval authority.

### Final remediation file lock

The accepted remediation set is exactly 40 hand-written files. The SHA-256 lock is:

```text
57F0E65DC907DD25E7B50007F54CCB31B779D902C0A8BCA029297546F5EA769E  technical-platform/web/src/platform/pages/P011PerformancePage.vue
EF58679024275DE5094F6987793C107831F4378B67123354B0BD8D3BF5D31757  technical-platform/web/src/platform/pages/P012PromotionPage.vue
E0F395B6899F435FB03CEBA486C2CEFD1DD9F7B7E08C194A0FD28AD2E728321F  technical-platform/web/src/platform/pages/P013RewardPage.vue
01CF3C55DE9E5A15AD4126FFF0E2CAF8E7FDCCACAF720F4ED63B8799307AF191  technical-platform/web/src/platform/pages/P014DisciplinePage.vue
891F647FCE2AF025C557CA3DB4A6278410C4DB75007D9BED1F8DD6ABE4D54ADD  technical-platform/web/src/platform/pages/P015PointLedgerPage.vue
AB52D0E088B1368B3CBE5A9964A6C65D4116D0EA160BDBEC1521D0BAF251DA37  technical-platform/web/src/platform/pages/P016CareSupportPage.vue
17719FCBBFB445475FCBA693CBA359D384FA3AE73DAD65682E32EA556E90A43D  technical-platform/web/src/platform/phase11/process-pages.test.ts
26CA39F5F7CAA3D6F7EFC15E1970DBCB8F1B183D31B90816425404EB60457DB5  technical-platform/web/src/platform/phase11/process-state.ts
34CF44FAD2088C0E7CE4F73BE70C8CFA31114FB7AFFDD688CEBD058D0E85B7E3  technical-platform/web/src/platform/phase11/process-state.test.ts
6A488533FEC8209E82A93C5C79FBF64F6F9B0EC7E90FCA44D1C4725BB112FB65  technical-platform/web/src/platform/phase11/process-client.ts
316B0156276D2E218DC797A8CF885A9658BDA2B585F932D9FD82692B66D85EBA  technical-platform/web/src/platform/phase11/process-client.test.ts
FD9D7E8F53D8E7EC7C2D23CBDCDD6053358AB250334C855C6519C4D9D75BE641  technical-platform/web/src/platform/phase11/use-process-operation.ts
9E0321388F5D0400C051D21A0702F54DB08CCB816D415AAE8932951DB76DD5C4  technical-platform/web/src/platform/phase11/process-complexity.test.ts
1C6AB98438E00B55A3DAA3065B435E34A4EFA7BAB95C8E9C696EE3672BC3FB11  technical-platform/web/src/platform/phase11/process-feature-mount.test.ts
BC237A69BD0A0D18739DAA613A2F5853646AD40D99F4BE503EF96FAF34DF8E46  technical-platform/web/src/platform/phase11/use-process-operation.test.ts
5F35E480C6D6B87336F2B7412C0AE8192EB9BEB01270A6E75CCB9146F9224CA8  technical-platform/web/src/platform/phase11/p011/P011PerformanceFeature.vue
B6CF3E577FAAB6AE3CC710C94BCDC6C3DB0A36893556669E15D1221465588D50  technical-platform/web/src/platform/phase11/p012/P012PromotionFeature.vue
AF71896876755D2FA1254EA22A26172F782BA7EAFC4ECB3A5797D684556E6CA8  technical-platform/web/src/platform/phase11/p013/P013RewardFeature.vue
43E70367A4DDED56DA08E9B14EC1D73F1D6C864FFE46123797789AE9961D4856  technical-platform/web/src/platform/phase11/p014/P014DisciplineFeature.vue
204DB23549F7F7D750B19E4FB3A9D3CFF42DBB6D0ECE90CBDB35AE8E8564EC41  technical-platform/web/src/platform/phase11/p015/P015PointLedgerFeature.vue
F8818C1D1827D07F9BA2D616FFFDF9198213904FF42C7319D56837D2BC8EFC5F  technical-platform/web/src/platform/phase11/p016/P016CareSupportFeature.vue
F68458917FBF65911DC834C2EF08D4C4AA193BA4EC5994EB657E7A6792AE42EE  technical-platform/web/src/platform/phase11/p011/use-p011-performance.ts
857DB1945D4506D6EC8E5388CE1596175A6E4C5360E035277BFF0FE89D81FC9D  technical-platform/web/src/platform/phase11/p012/use-p012-promotion.ts
CFAE6FE4C2B5209A3860CE65BD03F4970BAB61D85C910FC128EAC5D902293CF2  technical-platform/web/src/platform/phase11/p013/use-p013-reward.ts
58751A92BA09C15BDC6ECC7E2CC4F656B17FDAFEE6425BB78F2112F7218CBE4D  technical-platform/web/src/platform/phase11/p014/use-p014-discipline.ts
93F93919C6968868168DF761675486BB9A94A162E71EBEFFD10E755C501C7B58  technical-platform/web/src/platform/phase11/p015/use-p015-point-ledger.ts
CDDBB735E6598CCB00AAF00E39BE3DD091CD9B75D066A44B3A1E31FA6EF8457C  technical-platform/web/src/platform/phase11/p016/use-p016-care-support.ts
508CBBC89F538F269434B0B5B56BEC9C2890A50A0F78E2AB3F04389471FF30A3  docs/implementation/ui/page-component-plans/P011PerformancePage.ui-plan.json
C92A8477678392E03FB07FDB95CAF92BDA23F3A384F36C5213C22F18443EF127  docs/implementation/ui/page-component-plans/P012PromotionPage.ui-plan.json
AEC60B8D3FA4CE89D5F8D0E14C010E94480071AA8B581D2CF100F1302E1BDED5  docs/implementation/ui/page-component-plans/P013RewardPage.ui-plan.json
C9E9D678C376F2F5429074EA0AFB0F3ADB6EBACD94AF091C77AC57E88CCC188E  docs/implementation/ui/page-component-plans/P014DisciplinePage.ui-plan.json
54FF8ED5579461AAD052E135E5B3DC8BC098B96F86544BE4290385D6662C0917  docs/implementation/ui/page-component-plans/P015PointLedgerPage.ui-plan.json
C1BE842FB0705EFF329646FEBAC37BFA314EAB53D6700618AAFE3422E6B45378  docs/implementation/ui/page-component-plans/P016CareSupportPage.ui-plan.json
60192EA97FA507DB752FA4B35ED25C12C3D8CF76F3420A06FFB2243DB230DE02  technical-platform/web/e2e/phase11-p012-live.spec.ts
6769B35BC27919E099D86757DD4A43034C93270E32232A981EBD95D9E60C7936  technical-platform/web/e2e/phase11-p013-live.spec.ts
2652748AFF71051599CE7A3AAB4D3168FD1A97761B1A93D8D306B9BD11B8FA08  technical-platform/web/e2e/phase11-p014-live.spec.ts
A44570DEC0A29BAF3E8D79A05A3424ABAF0E3DA85CC6C5F84DBDA87C52EDFFD3  technical-platform/web/e2e/phase11-p015-live.spec.ts
6E82F89245D45F507E5F5DEA937ACD1606791E4201E1400726F9B72901FFE83A  technical-platform/web/e2e/phase11-p016-live.spec.ts
647A7A43CDD2834BF2218BA4DB33092E679E221A0CBE5FC9C9CA7B9E75F3D367  technical-platform/web/src/platform/processes/p006/p006-components.test.ts
BE23746476E4D1EE45EF491B5A8B1B2586235554A1A3D11A1BBE75C6AC35DCA0  technical-platform/web/src/router/evidence/P10-COMP-02/reviewer-resubmit-1.test.ts
```

### Retained review failures

- The first full-unit review found an expired P006 datetime test fixture and one full-concurrency router transform timeout. Both were fixed only in their test fixtures; the final independent full unit is 636/636 with no timeout increase, retry, skip or assertion weakening.
- The first P011 fixture command passed unquoted Maven properties through PowerShell and failed before fixture startup. The corrected literal-argument invocation reached READY and Chromium passed.
- The first P012 fixture invocation ran in a restricted named-pipe context and was denied before container creation. The identical full-access invocation reached READY and Chromium passed.
- Vite's existing chunk-size warning and Maven's missing Spring Boot plugin-version warning remain visible, non-fatal technical debt; neither warning was suppressed.

## Historical first-review evidence (superseded)

The following sections preserve the independent FAIL issued on 2026-08-13 and its required remediation. They are historical evidence, not the current verdict.

### Historical verdict

The source contract, PostgreSQL migrations, canonical facts, Worker replay/rollback, API lifecycles, permissions, data scope, masking and a representative real Chromium lifecycle all independently pass. PHASE-11 nevertheless fails its frontend hard gate: every new P011-P016 business page bypasses the existing Sgj Design System and renders raw browser controls. Across the six pages there are 157 raw `input/select/textarea/button` elements and zero uses of the required `SgjButton`, `SgjInput`, `SgjSelect`, `SgjTextarea`, `SgjTable` or `SgjStatusChip` components.

The same pages also reduce all concurrent resources/actions to one global `busy` boolean and plain text feedback; none renders the required typed loading/empty/error/no-permission/partial states or `SgjError`/`SgjPartialFailure`. Several pages compress complete lifecycle functions and templates onto single physical lines, defeating the documented complexity/decomposition gate. These are production page defects, not external-environment blockers. No PHASE-12 work is authorized.

## Definition of Done results

| Gate | Result | Independent evidence |
|---|---|---|
| PHASE-11 source snapshot and bindings | PASS | `python scripts/implementation/phase11_preparation_extract.py --check`; 18 XLSX, 108 sheets, 5,655 non-empty rows, deterministic snapshot and 31 bindings. |
| Empty PG16.14 → V125, validate/no-op | PASS | Full `phase11-integration` Maven verify, 12 Failsafe classes / 35 tests / 0 failures, errors or skips. |
| Worker replay/sanitization/rollback | PASS | Same 12-class full integration run; P011-P016 NotificationDatabaseIT all executed. |
| Six Spring API lifecycles | PASS | Full Maven API run, 6 classes / 6 tests / 0 failures, errors or skips; 19-module BUILD SUCCESS. |
| Server permissions/data scope/masking | PASS | API/DB negative paths plus source inspection; tech routes do not gain business actions. |
| Web lint/typecheck/unit/build | PASS | Independent full regression: lint/typecheck/build exit 0, 26 files / 109 tests, three portals built; retained ~2.057 MB chunk warning. |
| Representative normal browser path | PASS | P016 fixture READY; desktop Chromium 1/1 PASS, normal lifecycle completed against real Spring/PG/Redis. |
| Representative negative browser paths | PASS | Same P016 spec covers unauthenticated, tech action denial/masking, cross-center, invalid UUID, stale, duplicate source, self-consent and actor-separation failures. |
| Browser fixture cleanup | PASS | PG `9a98dadc2cb0c7e179c3ee2e3558f8aac28300181706938cf063031b75aa72c0` and Redis `6230e5e2b6955e4a3187888c7ecd187b42bb7dfe0d6110eb545b797404ded93f` absent; workspace process count 0. |
| Global style import | PASS | `technical-platform/web/src/platform/create-portal-app.ts:3` imports `../styles.css`. |
| Sgj Design System use in P011-P016 | **FAIL (P0)** | 157 raw interactive controls, required Sgj control count 0. |
| Typed async/error/empty/no-permission/partial states | **FAIL (P1)** | Six pages use a single `busy`/plain `feedback`; `AsyncState`, `SgjError`, `SgjPartialFailure` count 0. |
| SFC complexity/decomposition | **FAIL (P1)** | P012-P015 place full request/action functions on single lines; P014/P015 compress nearly the whole template into lines 49-51 / 36-40. |
| Trace/page/process/API/permission/database catalogs | PASS | P011-P016 mappings exist and match V120-V125, 31 bindings, six process roots, permission families and canonical tables. |

## Frontend hard-failure evidence

Authority:

- User UI standard: business pages must not use raw `button`, `input`, `select`, `textarea` or `table`; controls must map to Sgj components.
- `AGENT.md:1106-1111`: all three portals must use the canonical unified design system and shared form controls.
- `AGENT.md:1116-1128`: every page must render loading, empty, no-permission, validation, conflict, external/partial failure, retry/help and real server result states.
- `AGENT.md:1185-1204` and `DESIGN.md:968-986`: page/function/template complexity must be decomposed and must not be compressed to evade line gates.
- `AGENT.md:1227-1238`: typed async state and explicit failure handling are mandatory; one global `busy` cannot manage multiple parallel actions.
- `DESIGN.md:624-647`, `1210-1223`: forms use unified controls and pages provide Loading/Empty/Error/NoPermission with page/composable/service layering.

Measured page results:

| File | Raw input | Raw select | Raw textarea | Raw button | Required Sgj controls |
|---|---:|---:|---:|---:|---:|
| `P011PerformancePage.vue` | 9 | 1 | 3 | 3 | 0 |
| `P012PromotionPage.vue` | 18 | 2 | 3 | 3 | 0 |
| `P013RewardPage.vue` | 13 | 4 | 4 | 3 | 0 |
| `P014DisciplinePage.vue` | 14 | 6 | 4 | 3 | 0 |
| `P015PointLedgerPage.vue` | 24 | 2 | 4 | 5 | 0 |
| `P016CareSupportPage.vue` | 18 | 4 | 4 | 3 | 0 |
| **Total** | **96** | **19** | **22** | **20** | **0** |

Representative locations:

- `technical-platform/web/src/platform/pages/P011PerformancePage.vue:174-200`
- `technical-platform/web/src/platform/pages/P012PromotionPage.vue:102-138`
- `technical-platform/web/src/platform/pages/P013RewardPage.vue:95-131`
- `technical-platform/web/src/platform/pages/P014DisciplinePage.vue:49-51`
- `technical-platform/web/src/platform/pages/P015PointLedgerPage.vue:36-40`
- `technical-platform/web/src/platform/pages/P016CareSupportPage.vue:115-161`

## Independent commands

```powershell
python scripts/implementation/phase11_preparation_extract.py --check

.\mvnw.cmd -pl technical-platform/backend/modules/database-baseline -am -Pphase11-integration verify

.\mvnw.cmd -pl technical-platform/backend/apps/api -am '-Dtest=Phase11P011IntegrationTest,Phase11P012IntegrationTest,Phase11P013IntegrationTest,Phase11P014IntegrationTest,Phase11P015IntegrationTest,Phase11P016IntegrationTest' '-Dsurefire.failIfNoSpecifiedTests=false' test

pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm quality:deadcode

pnpm exec playwright test --config playwright.phase11-p016-live.config.ts
```

Reviewer runtime evidence:

- `.runlogs/phase11-review-p016-browser-fixture.log`: retained first failure before container creation because required test env was absent; not counted as a Gate run.
- `.runlogs/phase11-review-p016-browser-fixture-rerun.log`: real fixture/migration/READY run.
- `.runlogs/phase11-review-p016-playwright.log`: desktop Chromium `1 passed (18.2s)`.
- `.runlogs/phase11-review-p016-fixture-cleanup.log`: exact runtime IDs absent and process count 0.

## Required remediation

1. Refactor all six P011-P016 pages to the existing `src/design-system` public components and page templates. Replace every raw interactive control with the appropriate `SgjButton`, `SgjInput`, `SgjSelect`, `SgjTextarea`, `SgjCheckbox`, `SgjDateTime`, `SgjTable`/list primitive and `SgjStatusChip`. Do not add Tailwind or a second component system.
2. Preserve every real `session.request`, server permission/data-scope decision, idempotency key, optimistic version and current normal/negative lifecycle assertion. Do not replace functionality with mocks, local state success or a construction placeholder now that PHASE-11 is the active stage.
3. Give write actions component loading/disabled states and split resource/action state so independent requests do not share one global `busy`. Render the required loading, empty, no-permission, validation/conflict, error, partial-failure and retry/help states using the existing Sgj primitives.
4. Decompress and split the page implementations into page shell, feature components/composables/services/selectors as required by AGENT/DESIGN thresholds. Do not evade limits with semicolon-packed one-line functions/templates. Keep every SFC below the user 360-line hard cap and the stricter repository effective-line/complexity gates.
5. Add/strengthen unit tests that assert Sgj control contracts and state rendering. Rerun lint, typecheck, full web tests, build, Knip and all six real P011-P016 Playwright lifecycles because every business page is affected.

## Re-review scope

Re-review will scan all P011-P016 page/feature SFCs for raw controls and design-system imports, verify component props/loading/errors and typed async states, rerun the complete frontend matrix and all six Browser lifecycles, and regress representative DB/API permissions. Any raw interactive control, skipped test, weakened assertion, mock state or catalog mismatch keeps PHASE-11 at FAIL.
