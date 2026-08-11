# PHASE-05 C5 CHECKPOINT — canonical SLA runtime and evidence

- Phase: `PHASE-05`
- Scope: SLA policy binding / working-calendar port / pause-resume / reminder-escalation / immutable evidence
- Implementation commit: `ff940b2d0f7214f13007de01143262f5eb03045b`
- Focused CI: `Phase 05 Canonical Workflow Kernel` run `31247861299`
- Result: source/scope PASS; Java PASS; PostgreSQL 16/Testcontainers PASS; Web PASS

## Closed scope

1. C5 reuses approved `workflow.wf_sla_policy`, `wf_node.sla_policy_id`, `wf_task.due_at`, `wf_instance.due_at` and `wf_action_log`; no substitute SLA source-of-truth table was introduced.
2. Working-calendar calculation is an explicit capability keyed by `calendar_id`. The runtime requires exactly one matching capability and fails closed when unavailable or ambiguous; it does not invent holiday/weekend rows or a default business calendar.
3. `start` computes the effective due time from task receipt time + policy duration through that calendar capability and persists both task/instance due time.
4. The original due-time fact is written into immutable SLA action evidence at `SLA_STARTED` and is never overwritten by pause/resume.
5. `pause` records `SLA_PAUSED` evidence and suppresses reminder/escalation evaluation without destroying the persisted effective due time.
6. `resume` asks the calendar capability for paused working minutes, shifts only the effective due time, records previous/effective/original deadlines and preserves the initial deadline fact.
7. Stored `remind_rules` / `escalation_rules` stay opaque to the kernel. A rule-evaluator capability must interpret them; the kernel does not invent an unapproved JSON business DSL.
8. Reminder/escalation decisions are persisted first as deterministic `SLA_REMINDER_DUE` / `SLA_ESCALATION_DUE` action evidence keyed by stable decision request IDs; repeated evaluation does not duplicate decisions.
9. Notification delivery requires exactly one real capability for the decision type. Missing/ambiguous providers or missing delivery receipts fail closed; success is never fabricated.
10. Successful delivery appends `SLA_REMINDER_SENT` / `SLA_ESCALATION_SENT` evidence and repeated dispatch replays safely without sending twice.
11. A critical-audit capability can classify SLA events through `supports(event)`; when it claims an event, audit recording executes before workflow evidence and any audit failure aborts the operation. Multiple matching audit capabilities fail closed.
12. PostgreSQL 16 integration verifies real SLA policy/node/task/instance rows, original-due preservation across pause/resume, effective-due adjustment, persisted reminder/escalation decisions, real provider receipts and duplicate suppression.
13. `AGENT.md`, `DESIGN.md` and `Knowledge Base/**` were not changed. PHASE-06 remains `NOT_STARTED`.

## Next legal checkpoint

`C6 = reusable P120–P126 orchestration base runtime` may begin. C6 must implement only shared orchestration mechanics over approved structures and must not implement P120–P126 business golden paths. PHASE-05 remains `IN_PROGRESS / NOT_READY`.
