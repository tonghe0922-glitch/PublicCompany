# PHASE-05 C4 CHECKPOINT — canonical candidate resolver and task claim

- Phase: `PHASE-05`
- Scope: candidate/approver resolution + recusal/self-approval exclusion + server-side task claim
- Implementation commit: `1e37c8c409bc1f98bb7701f36e5f27d6a52288ae`
- Focused CI: `Phase 05 Canonical Workflow Kernel` run `31247501071`
- Result: source/scope PASS; Java PASS; PostgreSQL 16/Testcontainers PASS; Web PASS

## Closed scope

1. Candidate resolution is server-side and uses approved organization/position facts through `OrgDirectoryPort`; workflow does not create a second employee/organization model.
2. `ORG_POSITION` rules require configured organization and position identities; the position must belong to the configured organization.
3. Optional amount bounds and risk levels are consumed only from the stored candidate rule. No numeric threshold, risk category or approval priority is invented by runtime code.
4. When a rule requires amount/risk facts and runtime context does not supply them, resolution fails closed rather than guessing.
5. The initiator is always excluded from the candidate set. Static exclusions and runtime `recusedEmployeeIds` are also excluded.
6. Zero eligible candidates produces `NO_ELIGIBLE_APPROVER`; it never falls back to the initiator, an administrator or an arbitrary employee.
7. Multiple eligible candidates remain a candidate set. The runtime does not invent a first-person/lowest-ID business priority; an eligible actor must server-claim the task.
8. Claim validates the task is still PENDING and belongs to the current RUNNING workflow node, locks instance/task rows, and uses a conditional update so a competing claimant cannot overwrite the first assignment.
9. Repeating the claim by the same already-assigned claimant is safe; a different claimant receives stale/conflict semantics.
10. Real PostgreSQL 16 integration exercises approved `org.employee_position`, `workflow.wf_instance` and `workflow.wf_task` rows, verifies initiator exclusion, dynamic recusal, persisted assignment and competing-claim protection.
11. `AGENT.md`, `DESIGN.md` and `Knowledge Base/**` were not changed. PHASE-06 remains `NOT_STARTED`.

## Next legal checkpoint

`C5 = SLA working-calendar / pause-resume / reminder-escalation / audit evidence` may begin only after this checkpoint. PHASE-05 remains `IN_PROGRESS / NOT_READY`.
