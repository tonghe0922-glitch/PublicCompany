# MASTER_TRACEABILITY

> page(source file/sheet/row) → process → form/field → table → permission → API/interface。UNKNOWN 表示无可来源化事实。

- Pages: **7126**
- Processes: **126**
- Trace records: **7126**
- Machine: `contracts/phase-01/traceability.jsonl`

## PHASE-02 platform runtime foundation

- PHASE-01 business trace records remain unchanged: 7,126 pages / 126 processes.
- Canonical portal remains `employee / center / tech`; runtime/build alias is `employee / center / admin` (`tech → admin`). No business page is marked IMPLEMENTED by PHASE-02.
- Backend foundation: separate `api` and `worker` applications plus shared modular boundaries.
- Traceability rule remains unchanged: future business implementations must bind page → process → API → permission → authoritative database before being marked IMPLEMENTED.

## PHASE-03 database implementation trace

- Business page/process trace collections remain unchanged: 7,126 page records / 126 processes.
- Approved KB DDL → deterministic Flyway migration → source/generated SHA-256 manifest → PostgreSQL 16 Testcontainers migration evidence is traceable.
- Table baseline: catalog 265 = approved installed table objects 265.
- Index baseline: catalog 1,024 = approved DDL 1,019 + 5 catalog-sourced audit index overlays.
- Runtime identity trace: bootstrap admin → `sjg_migration` → `sjg_owner` DDL ownership; API and Worker use distinct NOBYPASSRLS runtime roles and cannot execute DDL.

## PHASE-07 Design System final trace

- Business trace cardinality remains **7,126 pages / 126 processes**; no Knowledge Base business page or P001–P126 process is reclassified as IMPLEMENTED.
- Engineering-only scope is `PLATFORM/Design-System`.
- Shared implementation lives under `technical-platform/web/src/design-system/**`; employee / center / admin(tech runtime alias) consume the shared Design System through the platform shell.
- DESIGN §11.2 form family is complete at shared UI layer; Avatar / PersonRow / RecordCard / KpiCard / ToastRegion / PartialFailure are in shared regression baseline.
- Quality trace is executable: strict typecheck, Vitest/VTU, ESLint, complexity/max-depth, jscpd, knip, circular dependency, three-portal build, artifact scan, Playwright desktop/mobile.

## PHASE-07 final evidence chain

```text
External audit baseline
→ Cycle 3 implementation anchor 4d2cf205685e6806bb0a7bd5bdb542586afafd5a
→ READY_FOR_GATE candidate 4797a70bc3d7e542fc2eed0ce32de974b2f67030
→ Construction workflow 31268081850 PASS
→ Independent Formal Gate 31268591057 PASS
→ PHASE-07 COMPLETE
```

No new business API, permission, database, workflow, outbox, worker, or integration truth is introduced by PHASE-07.

## PHASE-08 Portal Runtime final trace

- Business trace cardinality remains **7,126 pages / 126 processes**. PHASE-08 scope is `PLATFORM/Portal-Router-Session-API-Client`; **no P001–P126 business page or process is reclassified as IMPLEMENTED**.
- Canonical portals remain `employee / center / tech`; build/runtime remains exactly `employee / center / admin`, with `tech → admin`. A fourth `tech` runtime is rejected by browser regression.
- Six current IA XLSX sources were parsed with `6/6` success and `0` parse failures. Deterministic level-one/two navigation evidence contains employee **885**, center **1,417**, tech **1,510** source records.
- Navigation activation is fail-closed: only `status=implemented` + a real Router path + all canonical permissions satisfied + valid `mobile_access` can become clickable. Planned taxonomy remains non-clickable.
- Mobile navigation uses the same active-item projection: Home + at most three real active entries are primary; only additional already-active entries enter `更多`.
- Router trace: `/login`, protected home, `/forbidden`, not-found, intended-route restore, navigation AbortSignal rotation and Vue/Router error boundary.
- Existing IAM contracts consumed: login/refresh/logout/session/session-switch/approved Step-Up. PHASE-08 invents no business REST path.
- Session trace: access token memory-only; refresh credential current-tab `sessionStorage`; credential `localStorage` prohibited; refresh single-flight/rotation and stale-response fencing verified.
- Authorization trace: route/nav/header checks are UX only; Spring Security + IAM + data scope + PostgreSQL RLS remain final authority. Live negative test proves unauthorized identity switch returns HTTP 403.
- Protected-home fact-source trace after Gate fix: employee=`员工工作入口`, center=`中心管理工作入口`, tech=`技术运行工作入口`; formal home no longer consumes `PHASE05_PROCESSES` and does not render P016–P020/DB table/API base/fixed `已关闭` as runtime facts.
- Source contract plus real-backend Playwright permanently guard the protected-home fact-source boundary.
- Database trace: no new database/Schema/table/Flyway migration by PHASE-08. Existing PostgreSQL16/Redis7.4 IAM paths were re-run in Testcontainers.
- Audit trace from independent recheck live browser loop: relevant actions **22**, `SESSION_SWITCH` **1**, `AUTHORIZATION_DENIED` **1**, synthetic credential occurrences **0**.

## PHASE-08 final evidence chain

```text
C0 31271339605 PASS
→ C1 31272039128 PASS
→ C2 31272465244 PASS
→ C3 31272873854 PASS
→ C4 31273291742 PASS
→ C5 31273559280 PASS
→ C6 31273786369 PASS
→ C7 construction PASS
→ Initial candidate 16171f3294aa03306618bc8e1207feb0683e482e
→ Initial Formal Gate FAIL / report commit 9ac0573c532f8602677eb2422273e855b0b20e6c
→ Gate fix code checkpoint 8574ec9ac6f01bd51feddce34e22dc7831571301
→ Gate fix closeout / recheck candidate 48c3b822ed23f20565e331f3590a5209574f865e
→ Independent recheck 31290849170 attempt 2 PASS
→ PHASE-08 COMPLETE / FORMAL_GATE_PASS
```

The paragraph above is the sealed PHASE-08 historical boundary. PHASE-09 later closed P001–P005.

## PHASE-10 P006 local implementation trace

- Authoritative input is the current raw Knowledge Base snapshot: 15/15 P006–P010 XLSX, 90 sheets, 4,745 non-empty rows, zero fallback and zero parse failures.
- P006 exact bindings are employee `/employee/05/01/03`, `/employee/05/07/02`; center `/center/06/09/03`, `/center/05/02/02`; tech monitor `/tech/05/03/01`. Each retains its PHASE-01 source key in `phases/PHASE-10/PHASE10_PAGE_BINDINGS.json`.
- P006 trace closes as: raw XLSX states/roles/rules → P006 → initial published form and S01–S11/END workflow → six IAM permissions → meeting API → `collaboration.meeting/meeting_item` → audit/outbox/worker notification → three real portal projections.
- Local evidence is `phases/PHASE-10/P006_CHECKPOINT.md` and `.runlogs/phase10-p006-*`; the directory has no `.git`, so no remote SHA/CI status is asserted.
- P006 is `CHECKPOINT_PASS / CLOSED`; P007 is next. P008–P010 remain planned and PHASE-11 remains blocked.

## PHASE-10 P007 local implementation trace

- P007 exact bindings are employee `/employee/04/01/01`, `/employee/03/01/09`, `/employee/03/01/10`; center `/center/04/01/01`, `/center/04/07/04`, `/center/04/07/05`; tech `/tech/05/03/01`.
- Trace closes as raw XLSX states/roles/rules → P007 → published S01–S09/END workflow and form → five IAM permissions → schedule/shift-change API → `attendance.shift_change_request/item` plus learning qualification → audit/outbox/worker notification → three real portal projections.
- Local evidence: `phases/PHASE-10/P007_CHECKPOINT.md` and `.runlogs/phase10-p007-*`; no remote SHA/CI fact is asserted.
- P006/P007 are closed; P008 is next. P009/P010 remain planned and PHASE-11 remains blocked.

## PHASE-11 P011-P016 construction trace

- Authoritative source: 18 XLSX / 108 worksheets / 5,655 non-empty rows / SHA-256 `D21D758B6CCE42A68659A2D1711C977FFE8DAFDF56DB57234C775074F3A36C55`, with 0 fallback and 0 parse failure.
- Explicit binding ledger: `phases/PHASE-11/PHASE11_PAGE_BINDINGS.json`; full-gate revalidation proves 31/31 source keys and 31/31 current router paths, with employee/center/tech coverage for every P011-P016 process.
- Runtime chain: source states/roles/rules → V120-V125 published workflow/form → server authorization/data scope → engineering API → canonical table plus append-only facts → audit/outbox/Worker → employee/center/metadata-only tech projections.
- Evidence chain: `P011_CHECKPOINT.md` through `P016_CHECKPOINT.md`, then `FULL_GATE_REPORT.md` and `.runlogs/phase11-full-*`.
- State: `CONSTRUCTION_COMPLETE / INDEPENDENT_GATE_PENDING`; no independent PASS is asserted and PHASE-12 remains blocked.
