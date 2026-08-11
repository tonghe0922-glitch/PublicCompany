# PHASE-05 SOURCE_CONTRACT

> Phase: `PHASE-05`
> Current state: `COMPLETE`
> Next phase: `PHASE-06 = NOT_STARTED`

## 1. Corrected formal scope

PHASE-05 is the reusable **canonical workflow runtime / 表单版本 / 统一任务 / SLA / 编排内核** for P001–P126. The earlier P016–P020 dedicated business implementations remain **early consumers/reference implementations** and do not replace the platform-level DoD.

This phase implements shared mechanics only. It does not implement PHASE-06 P021–P025 or the P120–P126 business golden paths themselves.

## 2. Canonical runtime requirements

PHASE-05 delivers:

1. workflow definition, version, node, transition and publish lifecycle;
2. runtime instance, task, action/history lifecycle;
3. form definition/version, submission/value persistence and field-level return;
4. server-side `action_code -> transition -> next node/status`; callers cannot supply arbitrary target state;
5. candidate/approver resolution for organization, position, amount, risk and recusal, with no-approver fail closed;
6. SLA working calendar, pause/resume, reminder and escalation behavior;
7. immutable workflow action evidence plus the platform critical-audit boundary where required;
8. reusable orchestration base over approved P120–P126-oriented orchestration structures;
9. engineering-owned Workflow API contract because source catalogs do not define public HTTP paths;
10. focused and PostgreSQL integration tests for return/reject/withdraw, stale versions, no approver, recusal/self-approval, SLA pause, orchestration, illegal transition, RLS, concurrency and idempotency.

## 3. Definition of Done invariants

- A published workflow version is immutable; changes require a new draft version.
- Every runtime instance binds one exact `wf_version.id`.
- A client submits an action, never a target state; the server resolves the transition from the bound version/current node.
- `RETURN`, `REJECT` and `WITHDRAW` remain distinct actions/results with distinct history evidence.
- Stale form/task/state commands fail closed.
- Candidate resolution enforces recusal/self-approval exclusion and fails closed if no eligible approver remains.
- SLA pause/resume preserves the original due-time fact.
- P120–P126 orchestration base is reusable without implementing those business golden paths.
- PostgreSQL integration tests exercise the approved physical schema, tenant boundary and concurrent runtime behavior.
- PHASE-06 remains `NOT_STARTED`; Gate PASS does not itself authorize PHASE-06 construction.

## 4. Approved physical schema truth

PHASE-05 reuses the approved PHASE-03 workflow model in `technical-platform/database/flyway/oms/V45__workflow_tables.sql` plus approved workflow integrity overlays. Canonical structures include:

- `workflow.wf_definition`
- `workflow.wf_version`
- `workflow.wf_node`
- `workflow.wf_transition`
- `workflow.wf_rule`
- `workflow.wf_instance`
- `workflow.wf_task`
- `workflow.wf_action_log`
- `workflow.wf_form_definition`
- `workflow.wf_submission`
- `workflow.wf_submission_value`
- `workflow.wf_sla_policy`
- `workflow.wf_orchestration_instance`
- `workflow.wf_orchestration_instance_item`
- `workflow.wf_orchestration_link`
- `workflow.wf_business_relation`

No substitute workflow source-of-truth tables were introduced.

## 5. Security and consistency boundary

- Repository operations are tenant-scoped and rely on the PHASE-03 RLS baseline plus server-side tenant validation.
- PHASE-04 identity, RBAC/ABAC/data-scope and Step-Up capabilities remain authoritative.
- Workflow mutations are transactional and server-authoritative.
- Task assignment cannot bypass recusal/SoD through client input.
- Critical audit failure remains fail closed where applicable.
- Browser storage is not a workflow source of truth.
- No fake provider, fake notification or fake integration success is used to satisfy this phase.

## 6. Construction and Gate evidence

```text
C3: run 31247035418 PASS
C4: run 31247501071 PASS
C5: run 31247861299 PASS
C6: run 31248694755 PASS
C7 hardened: run 31249831710 PASS
C8 final construction proof: run 31250129581 PASS
Final READY_FOR_GATE candidate: d74fe79b934b1e635e4d351bc7499da4137bd6ca
Candidate construction CI: run 31250885714 PASS
Corrected independent Formal Gate: run 31250885752 PASS
```

The independent Gate revalidated the exact candidate SHA and passed source/security preflight, Java/Workflow API, PostgreSQL 16 RLS/concurrency/history, PHASE-04 IAM/Redis/HTTP/immutable-audit, Web, Windows Chinese-path contracts and the final verdict.

## 7. Historical shifted work retained

The previous P016–P020 implementation, three-portal workspace, Outbox/Worker retry/DLQ work and related tests remain in the repository as historical early capabilities. Their earlier PHASE-05 Gate evidence is retained as provenance but is superseded as the canonical PHASE-05 verdict.

## 8. Exit rule result

The corrected independent Formal Gate passed against candidate `d74fe79b934b1e635e4d351bc7499da4137bd6ca` in run `31250885752`. Therefore PHASE-05 is `COMPLETE`.

PHASE-06 remains `NOT_STARTED` and requires separate authorization before construction.
