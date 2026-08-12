# PHASE-05 GAP_MATRIX

> Phase: `PHASE-05`
> Current state: `COMPLETE`
> Current checkpoint: `C8 = COMPLETE / GATE_PASSED`
> Allowed classifications: `EXISTING / PARTIAL / MISSING / CONFLICT / BLOCKED`.

| ID | Capability / gap | Repository truth | Closure evidence | State |
|---|---|---|---|---|
| G05-C01 | Phase scope drift | canonical scope corrected; P016–P020 prior Gate retained as historical only | current canonical Gate `31250885752` | EXISTING |
| G05-C02 | Repository migration metadata | current truth is `tonghe0922-glitch/PublicCompany` / `ChatGPT_Version_V0.05`; old NEWSTART refs are provenance only | final ledgers normalized | EXISTING |
| G05-01 | Workflow physical model | approved V45 + approved overlays reused | source/PG Gate checks | EXISTING |
| G05-02 | Canonical Java workflow runtime | C1–C8 implemented and validated | candidate CI `31250885714`; Gate `31250885752` | EXISTING |
| G05-03 | Definition/version publish lifecycle | published versions immutable | C1 + final regression | EXISTING |
| G05-04 | Node/transition resolution | bound version/current node/action; no client target state | C2/C7 + Gate | EXISTING |
| G05-05 | Runtime instance binds version | exact published version binding | C2 + V101 + Gate | EXISTING |
| G05-06 | Unified task lifecycle | task/action + server candidate claim + competing action protection | C2/C4/C8 + Gate | EXISTING |
| G05-07 | Action/history | distinct RETURN/REJECT/WITHDRAW and single committed competing APPROVE proven | C8 `31250129581`; Gate | EXISTING |
| G05-08 | Form definition/version | exact published form version | C3 `31247035418`; Gate | EXISTING |
| G05-09 | Submission/value runtime | C3 persistence + hardened C7 adapter | C3/C7 + Gate | EXISTING |
| G05-10 | Field-level return | persistent field-return evidence; unsafe generic HTTP exposure remains closed | C3 + Gate | EXISTING |
| G05-11 | Candidate resolver | org/position/amount/risk/self/recusal/no-approver | C4 `31247501071`; Gate | EXISTING |
| G05-12 | Organization/position integration | PHASE-04 org facts reused | C4 + Gate | EXISTING |
| G05-13 | Amount/risk policy | explicit rule facts; missing required facts fail closed | C4 + Gate | EXISTING |
| G05-14 | SLA policy | approved SLA policy/node/task/instance facts + explicit calendar capability | C5 `31247861299`; Gate | EXISTING |
| G05-15 | SLA pause preserves original due | original due remains immutable evidence | C5 + Gate | EXISTING |
| G05-16 | Reminder/escalation delivery | deterministic decisions; real capability/receipt required | C5 + Gate | EXISTING |
| G05-17 | Workflow audit | C5 critical-audit boundary + C7 mutation attempts + immutable action evidence | Gate includes PHASE-04 immutable-audit regression | EXISTING |
| G05-18 | Orchestration physical base | create/item/link/progress/status/close with optimistic versions | C6 `31248694755`; Gate | EXISTING |
| G05-19 | Workflow API | engineering-owned `/api/v1/workflow/**` documented and implemented | C7 `31249831710`; candidate/Gate | EXISTING |
| G05-20 | API security | opaque auth, deny-by-default, explicit permissions/data scope, hardened ordering | C7 + Gate | EXISTING |
| G05-21 | Unit tests | complete Java + focused Workflow API/security | candidate/Gate | EXISTING |
| G05-22 | PostgreSQL integration tests | complete PHASE-05 PG16 suite including C8 final proof | candidate/Gate | EXISTING |
| G05-23 | Stale/version/concurrency/idempotency conflicts | stale/conflict + real two-transaction action + hash replay/conflict | C8 + Gate | EXISTING |
| G05-24 | No-approver/recusal tests | Java + PG16 validated | C4 + Gate | EXISTING |
| G05-25 | Workflow API contract tests | principal/forgery/target-state/claim/form/401/403 | C7 + Gate | EXISTING |
| G05-26 | Corrected independent Phase Gate | exact candidate `d74fe79b934b1e635e4d351bc7499da4137bd6ca` independently revalidated | run `31250885752`, final verdict success | EXISTING |
| G05-27 | P016–P020 early work | retained as historical early consumers | historical evidence preserved | EXISTING |
| G05-28 | PHASE-06 boundary | no P021–P025 construction authorized | remains `NOT_STARTED` | EXISTING |
| G05-29 | Old Actions billing blocker | PublicCompany CI executes normally | current runs are source of validation truth | EXISTING |
| G05-30 | PublicCompany CI compatibility | source/Java/API/PG/Web and independent cross-stage Gate execute | candidate CI + Gate PASS | EXISTING |

## Closure order

1. C0 — COMPLETE.
2. C1 — COMPLETE.
3. C2 — COMPLETE.
4. C3 — COMPLETE; run `31247035418` PASS.
5. C4 — COMPLETE; run `31247501071` PASS.
6. C5 — COMPLETE; run `31247861299` PASS.
7. C6 — COMPLETE; run `31248694755` PASS.
8. C7 — COMPLETE after security hardening; run `31249831710` PASS.
9. C8 — COMPLETE; final construction proof run `31250129581` PASS.
10. READY_FOR_GATE candidate `d74fe79b934b1e635e4d351bc7499da4137bd6ca` — normal construction CI `31250885714` PASS.
11. Corrected independent Formal Gate — run `31250885752` PASS.

All PHASE-05 gaps are closed. PHASE-05 is `COMPLETE`. PHASE-06 remains `NOT_STARTED` and requires separate authorization.
