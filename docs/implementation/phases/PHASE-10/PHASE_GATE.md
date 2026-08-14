# PHASE-10 Independent Phase Gate

> Review authority: independent professional reviewer
> Review date: 2026-08-12 (Asia/Shanghai)
> Sole reviewed source: `I:\PublicCompany_source_codex`
> Source-control fact: `.git` is absent; no branch, commit, push, PR or remote CI evidence is claimed
> Verdict: **PASS / INDEPENDENT_GATE_CLOSED**
> Downstream gate: **PHASE-11 may start in sequence**

## Formal verdict

P006-P010 implementation, database, API, Worker, frontend quality gates and representative real Chromium evidence were independently reproduced. The initial lint failure was corrected with a single behavior-preserving E2E edit and independently reverified. All mandatory Definition of Done gates now pass, so PHASE-10 is closed and PHASE-11 may start in sequence.

## Definition of Done verification

| Gate | Result | Independent evidence |
|---|---|---|
| Authority/source contract | PASS | Fully read the PHASE-10 prompt and phase ledgers. `python scripts/implementation/phase10_preparation_extract.py --check` passed. Snapshot SHA-256 independently matched `FCA53ED8312206218B0020315D5A16A41A9C5EB1490958771463A381888FFB26`; 15 XLSX / 90 sheets / 4,745 non-empty rows / zero fallback / zero parse failure. |
| Trace/page/process/API/permission/database ledgers | PASS | Snapshot and page-binding JSON parse successfully; 37 P006-P010 route bindings were present. README/checkpoint/GAP stale-state corrections were reread and the stale-state scan was clean. |
| Static architecture/security | PASS with observation | P006-P010 writes use tenant transactions, idempotency claims, optimistic versions, published workflow/form/task runtime, server authorization/data scope, immutable audit and transactional Outbox. P008 ledger uses an advisory transaction lock and conservation/negative-balance guards. V115-V119 contain append-only/tenant/RLS guards; V119 validates same-tenant policy/grant/identity/qualification dates. Technical views are metadata-only. Five candidate UUID parsers were corrected during review to fail closed; the final domain empty-catch scan is clean. Observation: the new service-level rejection branch has no dedicated regression test, although the lower-level workflow resolver has invalid-UUID fail-closed coverage. |
| PostgreSQL migration + database + Worker | PASS | From repository root: `.\mvnw.cmd -pl :platform-database-baseline -am -Pphase10-integration "-Dit.test=Phase10P006DatabaseIT,Phase10P006NotificationDatabaseIT,Phase10P007DatabaseIT,Phase10P007NotificationDatabaseIT,Phase10P008DatabaseIT,Phase10P008NotificationDatabaseIT,Phase10P009DatabaseIT,Phase10P009NotificationDatabaseIT,Phase10P010DatabaseIT,Phase10P010NotificationDatabaseIT" "-Dfailsafe.failIfNoSpecifiedTests=false" verify`. PostgreSQL 16.14, empty schema through V119, validate/no-op evidence, 22 tests, 0 failure/error/skip, Reactor BUILD SUCCESS (2026-08-12 22:01 +08:00). Reports: `technical-platform/backend/modules/database-baseline/target/failsafe-reports/`. |
| Real API lifecycle | PASS | `.\mvnw.cmd -pl :platform-api -am "-Dtest=Phase10P006IntegrationTest,Phase10P007IntegrationTest,Phase10P008IntegrationTest,Phase10P009IntegrationTest,Phase10P010IntegrationTest" "-Dsurefire.failIfNoSpecifiedTests=false" test`. Spring + PostgreSQL 16.14 + Redis 7.4; 5/5 selected lifecycle tests passed; 17-module Reactor BUILD SUCCESS (2026-08-12 22:04 +08:00). Reports: `technical-platform/backend/apps/api/target/surefire-reports/`. Container shutdown produced Redis/Hikari reconnect warnings but no test failure/error. |
| Frontend type/unit | PASS | `pnpm typecheck` exit 0. `pnpm test` passed 20 files / 91 tests. |
| Frontend production build/dead code | PASS with known warning | `pnpm build` passed employee/center/admin. `pnpm quality:deadcode` passed. Each portal bundle is approximately 1.996 MB and retains Vite's >500 kB warning. |
| Frontend lint | PASS after focused remediation | Initial review found `no-useless-assignment` at `technical-platform/web/e2e/phase10-p010-live.spec.ts:10`. The final edit preserves the `ASSIGN` API call, removes only the unread assignment and adds an explicit HTTP 200 assertion. Independent rerun on 2026-08-12: `pnpm lint` exit 0 with zero warning/error; no eslint-disable, skip/fixme/only or assertion weakening was introduced. |
| Real Chromium normal + negative path | PASS | Initial review and focused re-review each started a fresh `Phase10P010BrowserBackendFixture` with isolated temporary tenant credentials, real PostgreSQL 16.14/Redis/API on 18090, then ran `pnpm exec playwright test --config playwright.phase10-p010-live.config.ts`. Final Chromium rerun passed 1/1 in 16.2 s (test body 11.7 s). The scenario proves the new `ASSIGN` 200 assertion, cross-center denial, tech masking/no business buttons, stale-version rejection, assessor/certifier separation, tech denial, qualification activation, approved permission linkage in session authorization, recertification and archive. Fixture was shut down after the run. |

## Initial failure and remediation closure

### P1 — mandatory lint gate: CLOSED / REVERIFIED

- Location: `technical-platform/web/e2e/phase10-p010-live.spec.ts:10` (reported column 314).
- Reproduction:
  1. `Set-Location I:\PublicCompany_source_codex\technical-platform\web`
  2. `pnpm lint`
- Initial actual: exit code 1, one `no-useless-assignment` error.
- Final correction: replaced the unread post-`ASSIGN` assignment with `expect((await act(...)).status).toBe(200)`; the lifecycle action is retained and more explicitly asserted.
- Independent focused re-review: `pnpm lint` exit 0; `pnpm typecheck` exit 0; `pnpm test` 20 files / 91 tests; `pnpm build` passed employee/center/admin; `pnpm quality:deadcode` exit 0; fresh P010 real Chromium 1/1 passed in 16.2 s.
- Closure: PASS. No backend/database/API/Worker source was changed by the narrow remediation, so the already-passing 22 DB/Worker and 5 API lifecycle results remain the applicable backend evidence.

## Non-blocking observations

- The Maven effective-model warning for an unspecified Spring Boot plugin version and Mockito/JDK dynamic-agent warnings remain technical debt; they did not change test outcomes.
- The approximately 1.996 MB Vite bundles remain a known performance risk; the warning was not suppressed and is not the present PHASE-10 blocker.
- The first reviewer E2E fixture invocation omitted required environment variables and failed before application startup; both corrected isolated invocations passed and are the acceptance evidence.

## Final authorization

This verdict is PASS. PHASE-10 is independently closed. PHASE-11 is authorized to start in the prescribed sequence; no conclusion here pre-accepts any PHASE-11 deliverable.
