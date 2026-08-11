# PHASE-05 IMPACT_MATRIX

> Phase: `PHASE-05`
> Current state: `COMPLETE`
> Formal scope: reusable canonical workflow runtime for P001–P126.

| Capability | process_code | API / consumer boundary | Permission / Data Scope | Application / repository | Approved database | Final evidence | State |
|---|---|---|---|---|---|---|---|
| Definition/version publish | P001–P126 shared | internal Java contract; no invented public admin HTTP | tenant/server-admin when exposed later | `WorkflowDefinitionService` + JDBC | `wf_definition`, `wf_version`, `wf_node`, `wf_transition` + V100 | C1 retained under candidate/Gate regression | EXISTING |
| Runtime instance/action | P001–P126 shared | engineering-owned `/api/v1/workflow/instances/**` | `workflow.runtime.start/read/act`; PHASE-04 data scope | `WorkflowRuntimeService` + JDBC | `wf_instance`, `wf_task`, `wf_action_log` + V101 | C2/C7/C8 + Gate `31250885752` | EXISTING |
| Form version/submission | P001–P126 shared | current form submit exposed; generic return HTTP intentionally closed | `workflow.form.submit`; current resource scope | `WorkflowFormService` + JDBC | `wf_form_definition`, `wf_submission`, `wf_submission_value` + V102 | C3 + C7 + Gate | EXISTING |
| Candidate/approver resolver | P001–P126 shared | current-task claim | `workflow.task.claim`; org/position/amount/risk/recusal/self-exclusion | `WorkflowCandidateResolver`, `WorkflowTaskAssignmentService` | `wf_node.actor_rule`, `wf_task.candidate_rule`, `wf_rule` | C4 `31247501071`; hardened C7; Gate | EXISTING |
| SLA engine | P001–P126 shared | internal capability; no fabricated scheduler/admin API | tenant + explicit provider capabilities | `WorkflowSlaService` | `wf_sla_policy`, `wf_task`, `wf_instance`, `wf_action_log` | C5 `31247861299`; Gate | EXISTING |
| P120–P126 orchestration base | P120–P126 structures only | reusable Java kernel; no business golden-path HTTP | tenant; explicit source fields | `WorkflowOrchestrationService` + JDBC | `wf_orchestration_instance`, `_item`, `wf_orchestration_link` | C6 `31248694755`; Gate | EXISTING |
| Workflow API/security | P001–P126 shared | `/api/v1/workflow/**`, explicitly engineering-owned | no default grants; opaque auth; fail-closed resource scope | `WorkflowRuntimeController` + handlers | delegates canonical state only | hardened C7 `31249831710`; candidate `31250885714`; Gate | EXISTING |
| Tenant/RLS/concurrency/idempotency/history final proof | canonical shared | test contract only | real `sjg_api_runtime`, two tenants | real runtime/JDBC/idempotency transactions | approved V45 + V100–V102 | C8 `31250129581`; independent Gate `31250885752` | EXISTING |
| Historical P016–P020 | P016–P020 | retained dedicated pages/APIs/workers | historical source-specific rules | retained dedicated services | approved business tables | historical provenance only | RETAINED / SUPERSEDED-AS-PHASE-SCOPE |

## Boundary decisions

1. `AGENT.md`, `DESIGN.md`, `Knowledge Base/**` and approved database DDL remain canonical source facts and were not rewritten by PHASE-05.
2. PHASE-05 implements shared mechanics only. No P021–P025 construction and no P120–P126 business golden path is authorized.
3. Existing P016–P020 code remains historical/early-consumer work; it does not substitute for the canonical kernel.
4. Public Workflow HTTP paths are explicitly engineering-owned because `MASTER_API_CATALOG.md` contains no source-defined HTTP method/path facts.
5. Approved V45 workflow tables are reused; duplicate workflow source-of-truth tables are prohibited.
6. API/Worker runtime applications do not own Flyway migration capability.
7. Where authoritative resource org/position/owner facts are absent, API/data-scope handling fails closed instead of borrowing caller facts or inventing ownership.
8. Candidate `d74fe79b934b1e635e4d351bc7499da4137bd6ca` passed normal construction CI `31250885714` and corrected independent Formal Gate `31250885752`.
9. PHASE-05 is COMPLETE; PHASE-06 remains NOT_STARTED pending separate authorization.
