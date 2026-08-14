# P10-COMP-02 Independent Gate

- Review date: 2026-08-13
- Repository: `I:\PublicCompany_source_codex`
- Verdict: **PASS** (`RESUBMIT-1`)
- Next task: **UNLOCKED only for P10-COMP-03A**; later UI tasks remain dependency-locked.

## Scope and evidence integrity

- `P10-COMP-01` is independently PASS.
- The remediation changed only `portal-router.ts`, `route-semantics.test.ts`, and task-owned report/evidence. Reviewer-owned gate and independent fixtures were read-only before this verdict.
- Fresh pre/post IDs independently agree: workspace `147FBA56E8E3340015D29E9E1C535BD76D4D2D10E8059510294D75411EDA454F` / 1483; task `5C269235A9864E63F4BB6699C418E701670D7D01B61C93BD748CFCF9FF9246F9` / 42; scoped task/unrelated/CORE/metadata `0/0/0/1`.
- All 42 task entries independently compare equal by path, existence, SHA-256, and bytes. The submitted 43-file hash inventory has `MISMATCH=0`.
- Report metadata independently matches the post manifest: SHA-256 `330F816DB4836535EAA7D1B0B2E6DE311FE2490056DBACCB7B6E2FF196A8D23E`, 7,370 bytes.
- The historical task-ID discrepancy was ordering-only: normalized path/hash/bytes/exists content is identical and the authoritative normalized ID equals the pre ID.

## Definition of Done

| Requirement | Result | Independent evidence |
|---|---|---|
| Exact named source must be unique | PASS | Production resolver inspection plus official/reviewer fixtures |
| Null fallback only when no explicit name exists and null is unique | PASS | Original adversarial fixture now passes |
| Duplicate exact/null, missing, and explicit-name conflict fail closed | PASS | Added official and reviewer variants |
| Legitimate P008 single-null source remains accepted | PASS | Official positive fixture and full router load |
| Route/template/landmark behavior remains intact | PASS | 6 files / 59 tests PASS |
| Full frontend gates | PASS | 35 files / 196 tests; lint, typecheck, Knip, and three builds exit 0 |
| Source/UI debt remains visible | PASS | Source current FAIL/340; package UI current FAIL/88; neither is misreported as task PASS evidence |
| Fresh representative Browser and cleanup | PASS | Independent P016 Chromium 1/1 PASS; exact PG/Redis absent, Ryuk 0, ports/processes 0 |

## Independent rerun details

- Focused matrix: official router/template/landmark suites, the original independent regression, and three additional resolver combinations all passed: 6 files / 59 tests.
- Full unit: 35 files / 196 tests PASS.
- `pnpm lint`, `pnpm typecheck`, and `pnpm quality:deadcode`: exit 0.
- `pnpm build`: employee, center, and admin all passed; the existing approximately 2.080 MB chunk warning remains visible.
- Project source self-test and package UI self-test: exit 0. Current scans remain expected dependency debt (`340` source findings and `88` UI errors).
- Independent fresh P016 fixture used Spring on `:18090`, PostgreSQL 16.14 migrated from empty through V125, and Redis 7.4. Desktop Chromium passed 1/1 (13.6 s test, 19.3 s total).
- Controlled shutdown ended the fixture. Runtime IDs `881e6d8c3bbd079fd3cd74b49b8fc8efbdfd1a624baa85a003a4e4d17624098f` and `e0c77d2a91f8a98920ccad0697ea34302455bc69e90dd4d5e7f3cbd23310c51a` are absent; Ryuk count is 0; ports 18090/5360/5361/5362 and workspace gate process counts are 0.

## Historical FAIL closure

The initial review failed because a null-name source record could be selected even when the same portal/path contained a conflicting explicit name. The revised resolver now selects a unique exact named record first; when no exact match exists, any explicit name suppresses null fallback; only a unique null record with zero explicit names is accepted. The original failing fixture and additional exact/null conflict variants now pass without changing route paths, components, permissions, props, API behavior, or data-scope behavior.

P10-COMP-02 is independently **PASS**. This verdict unlocks only the dependency-allowed next UI task, `P10-COMP-03A`.
