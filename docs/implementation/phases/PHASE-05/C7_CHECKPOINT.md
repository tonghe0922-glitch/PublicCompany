# PHASE-05 C7 CHECKPOINT — engineering-owned Workflow API / security contract

- Phase: `PHASE-05`
- Scope: generic canonical Workflow API/security only; no business golden paths
- State: `COMPLETE`
- Initial implementation commit: `3a7736e3ce9d0bd9e0ad85584b550f69309ad95f`
- Forward test fix: `a12a4e8d78531c310644b1cfcee589db9d00c953`
- Post-checkpoint hardening commit: `edb94462e735a5c6b988ccc41ccc30833b788557`
- Final focused CI: `Phase 05 Canonical Workflow Kernel` run `31249831710`
- Result: source/scope PASS; Java PASS; Workflow API + Spring Security PASS; PostgreSQL 16/Testcontainers PASS; Web PASS

## Closed scope

1. C7 introduces the clearly engineering-owned `/api/v1/workflow/**` namespace. The repository does not claim these paths came from Knowledge Base/API source facts; `MASTER_API_CATALOG.md` has no authoritative canonical Workflow HTTP paths.
2. Tenant, employee/actor and operator identity are derived only from authenticated PHASE-04 `SessionPrincipal`; request bodies cannot select another tenant, employee, actor or identity.
3. Generic routes reuse PHASE-04 `AuthorizationService` / `AuthorizationTarget` and the existing opaque-token deny-by-default Spring Security chain. C7 adds no default role grants for the new Workflow permission codes, so unconfigured access fails closed.
4. The exposed contract covers canonical instance start/read/action, current-task claim and form submission. Controllers delegate business behavior to the already validated C2/C3/C4 services.
5. Runtime action request bodies are strict whitelists; `targetState` and `targetNodeCode` are rejected before runtime mutation and next-state resolution remains server-authoritative.
6. Existing workflow instance data-scope targets use persisted initiator/assignee employee facts and do not borrow caller org/position when the resource does not persist those dimensions. CENTER/ORG/POSITION scopes therefore fail closed when those facts are absent.
7. Task claim uses claimant employee/org/position as the candidate-action data scope but leaves `ownerEmployeeId = null`; an OWNER scope cannot be made true by pretending the claimant owns an unclaimed task. C4 candidate resolution remains the authoritative eligibility gate for organization, position, amount, risk, self-approval exclusion and recusal.
8. Claim verifies that the URL task is the current task of the requested instance before invoking the assignment mutation; a stale/wrong task cannot be claimed through a mismatched instance path.
9. Form submission performs explicit action permission, tenant-bound runtime lookup and resource data-scope authorization before inspecting current task/assignee details. When a current task exists, the submitted task must be that exact task, it must already be claimed, and the authenticated employee must be the assignee.
10. Public mutation attempts use the PHASE-04 audit writer before business mutation; audit unavailability fails closed.
11. Generic field-level return remains deliberately unexposed over HTTP because the approved submission model does not provide an authoritative generic owner/org/position data-scope binding. The C3 service capability remains intact and tested.
12. Focused tests prove principal-derived tenant/actor/identity, forged authority/target-state rejection before mutation, claimant OWNER-null semantics, resource-scope use of persisted initiator/assignee facts, wrong instance/task rejection before claim mutation, unclaimed-form fail-closed behavior, unauthenticated `401`, and authenticated-without-workflow-permission `403`.
13. The prior candidate `a12a4e8d78531c310644b1cfcee589db9d00c953` and run `31249472162` remain truthful historical PASS evidence. A later security review reopened C7, and the final hardening candidate `edb94462e735a5c6b988ccc41ccc30833b788557` superseded it.
14. Exact hardened SHA `edb94462e735a5c6b988ccc41ccc30833b788557` passed run `31249831710` across all five required jobs.
15. `AGENT.md`, `DESIGN.md` and `Knowledge Base/**` were not modified. PHASE-06 remains `NOT_STARTED`.

## Next legal checkpoint

`C8 = final PostgreSQL/concurrency/API/full regression, repository metadata normalization, final report/evidence consistency and corrected Formal Gate candidate` may begin.

PHASE-05 remains `IN_PROGRESS / NOT_READY`. C8 may move it only to `READY_FOR_GATE`; only an independent corrected Formal Gate on the exact final candidate SHA may mark PHASE-05 COMPLETE and open PHASE-06.
