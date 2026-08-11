# PHASE-03 Migration Attempt Evidence

## Attempt 1 — PostgreSQL 16 empty-install

- Workflow: `Phase 03 Database Baseline`
- Run: `31169862639`
- Head: `d3bd1a4fb713600d19143e72b386db2e4c3e6759`
- Static provenance / boundary job: `PASS`
- PostgreSQL integration job: `FAIL`
- Test image: `postgres:16.14-alpine3.24`
- Cluster role migration: PASS
- `sjg_oms` migrations `V0.1` through `V94`: PASS
- Failure migration: `V95__seed_process_catalog.sql`
- PostgreSQL SQLSTATE: `42601`
- Root cause: approved Knowledge Base seed uses the psql client metacommand `\\set tenant_id ...` and psql variable syntax `:'tenant_id'`; Flyway/JDBC executes SQL, not psql client commands.

### Repair 1

The Knowledge Base source was not modified. A deterministic compatibility layer was added:

- source SHA-256 remains recorded unchanged;
- only `95_seed_process_catalog.sql` is eligible for the explicitly approved psql compatibility conversion;
- any other psql metacommand or unresolved `:'variable'` fails generation;
- the manifest records the exact transformation and recomputed generated migration checksum.

Repair implementation commit: `f5d9d090555cc2186c03e2963c1d4a6cc597ee97`.
Compatibility Flyway regeneration workflow: `31170261980 = success`.
Generated compatibility baseline commit: `3ad157ab677f3476b6dc851b1a2f468dfde71d74`.

## Attempt 2 — syntax fixed, tenant FK precondition exposed

- Workflow: `Phase 03 Database Baseline`
- Run: `31170357830`
- Head: `91f3e2e7e0b6e6568368294e479e181cc54f4380`
- Static provenance / compatibility / boundary job: `PASS`
- PostgreSQL integration job: `FAIL`
- Cluster roles: PASS
- `sjg_oms` migrations `V0.1` through `V94`: PASS
- V95 psql syntax conversion: PASS (migration reached the real INSERT)
- Failure migration: `V95__seed_process_catalog.sql`
- PostgreSQL SQLSTATE: `23503`
- Error: `workflow.wf_definition.tenant_id` references `core.tenant(id)` but the approved seed tenant id is not present on a true empty database.

### Repair 2 — explicit deployment tenant bootstrap

The approved V95 source itself says production must replace tenant identity. The Knowledge Base does not provide a canonical production tenant code/name, so PHASE-03 does not invent one.

Required deployment Flyway placeholders:

- `sjg_tenant_id`
- `sjg_tenant_code`
- `sjg_tenant_name`

Technical migration `V94.1__bootstrap_tenant.sql` creates the tenant only from those explicit deployment facts and fails on mismatched existing identity. No production tenant id/code/name is stored in Git.

Repair implementation commit: `bab20af686348b3ff7576fb609e5322cb3c038b8`.
Flyway regeneration workflow: `31170746835 = success`.
Generated tenant-parameterized baseline commit: `838336da3d083cddf96c1a0c2061014cdc3e139a`.

## Attempt 3 — test compilation defect, then first full green database baseline

- Run `31170881854`: PostgreSQL assertions were blocked by a Java test compilation error (mutable loop variable captured by assertion-message lambda).
- Repair commit: `8def1baf6b3ec98ee36295d5e60f3f91df5f11b9`.
- Run `31171021336`: `SUCCESS`.
- Result: empty PostgreSQL 16 install, 3 databases, Flyway validate, second migrate=0, 46 schemas, tenant RLS, role NOBYPASSRLS, least privileges, tenant bootstrap, 126 workflow definitions, audit INSERT/SELECT-only and UPDATE/DELETE/TRUNCATE negative tests all passed.

## Attempt 4 — migration execution identity separation

The first green baseline still used PostgreSQL bootstrap credentials for target Flyway. PHASE-03 therefore added `Phase03MigrationRoleTest` to execute target migrations as non-superuser `sjg_migration`.

- Migration-role implementation commit: `8c33dffeb84efdda3d7d98cf269d7861f1715d0b`.
- Run `31172172432`: static quality `PASS`; the new migration-role test completed OMS/Audit/DW migrations successfully, but the legacy baseline test failed because its target databases were still owned by postgres.
- Migration-role proof in that run: OMS 56 migrations, Audit 7 migrations, DW 5 migrations; validate + second migrate=0 succeeded under `sjg_migration`.

### Repair 4 — database owner normalization

Formal V0.1 now enforces:

- target owner must be `sjg_owner`;
- if already `sjg_owner`: continue;
- bootstrap-superuser empty DB with mismatched owner: normalize owner to `sjg_owner`;
- non-superuser mismatch: fail instead of widening privileges.

Generator implementation commit: `d4cd09c34e7367782e635df28ee8b8737e1a6b5f`.
Flyway generation run: `31172543947`.
Generated owner-guard baseline commit: `88a2591ccc412d611dc3083f577c036ea825cf51`.

## Attempt 5 — owner guard + migration role fully green

- Database workflow run: `31172689808`.
- Result: static provenance/security gate `PASS`; PostgreSQL 16 Testcontainers integration `PASS`.
- Both bootstrap empty-install and non-superuser `sjg_migration` installation paths now use the same formal Flyway package.

A separate CI-control issue was also fixed: completed PHASE-02 workflows now validate their own invariants without executing PHASE-03-owned Testcontainers tests or rewriting PHASE-03 state.

## Attempt 6 — application/runtime identity separation

PHASE-03 removed the remaining shared database identity from application runtime:

```text
bootstrap = sjg_bootstrap
migration = sjg_migration
API       = sjg_api_runtime
Worker    = sjg_worker_runtime
owner     = sjg_owner (NOLOGIN)
```

API/Worker application Flyway is disabled and their Flyway dependencies are removed. Independent Linux/Windows migration runners execute migrate/validate/repeatability before applications start.

Validated implementation checkpoint: `f63249fdbec828d6178308b42d6a3900653ec077`.

- `Phase 03 Database Baseline` run `31173547265`: `SUCCESS`.
- `Phase 03 Runtime Database Identity` run `31173547048`: `SUCCESS`.
- Runtime CI generates ephemeral passwords at run time, starts PostgreSQL, provisions roles, runs the independent migration runner, proves API/Worker can connect, then proves both are denied DDL.
- Three database owners = `sjg_owner`.
- Formal login roles with forbidden super/createDB/createRole/replication/BYPASSRLS privileges = 0.
- Windows Chinese-path `migrate.bat` / `start.bat --ci` contract = PASS.

## Attempt 7 — completed PHASE-02 regression after PHASE-03 changes

The PHASE-02 Windows verifier originally ran root `mvnw test`, which incorrectly pulled PHASE-03 Linux Testcontainers tests into the completed-stage Windows job. CI ownership was scoped without skipping PHASE-03 tests: PHASE-02 validates its own API/Worker dependency tree; PHASE-03 workflows remain responsible for database integration.

- Completed-stage regression workflow: `Phase 02 Build`.
- Run: `31173720739`.
- Head: `cc7612b722b951cb49ab8b89a2457ae1660c79f9`.
- Result: quality / Java / Vue / Compose / Windows Chinese-path = **all success**.

## Ledger closure

- Workflow: `Phase 03 Ledger Finalize`.
- Run: `31174051036`.
- Conclusion: `success`.
- Generated ledger commit: `6a847a023cbf4a4293ebed05a770384e23c418d6`.
- `MASTER_PROGRESS`: `PHASE-03 = PASS / READY_FOR_GATE`, `PHASE-04 = NOT_STARTED`.
- Page/process business collections remain unchanged by PHASE-03 ledger metadata.

## Status

`PASS / READY_FOR_GATE` construction result.

The report/evidence commit containing this status still requires exact-current-head revalidation by both `Phase 03 Database Baseline` and `Phase 03 Runtime Database Identity`. This file does **not** declare Formal Phase Gate PASS and does not authorize PHASE-04.
