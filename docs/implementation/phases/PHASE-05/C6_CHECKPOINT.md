# PHASE-05 C6 CHECKPOINT — reusable orchestration base runtime

- Phase: `PHASE-05`
- Scope: reusable P120–P126 orchestration mechanics only; no business golden paths
- Initial implementation commit: `a26da971e0b4f27089847a871cb2da441a133622`
- Forward fixes: `30b86d5fd52dcc6b2e373fd4c05655286ff0bad1` / `bc3e6ca8baac3505da3c97a1ca7aa5d7706e70ba` / `3141a8378c8e4b641626069edfd5702959f1e793`
- Final focused CI: `Phase 05 Canonical Workflow Kernel` run `31248694755`
- Result: source/scope PASS; Java PASS; PostgreSQL 16/Testcontainers PASS; Web PASS

## Closed scope

1. C6 reuses the approved `workflow.wf_orchestration_instance`, `wf_orchestration_instance_item` and `wf_orchestration_link` structures; no substitute orchestration source-of-truth table was introduced.
2. Only P120–P126 may create orchestration masters. The kernel does not encode their later business golden paths.
3. All approved physical source fields required by the current orchestration table must be supplied explicitly by the caller; the kernel does not invent business defaults for center, incident, customer, asset, reception, program or dependency facts.
4. Business numbers are obtained through existing `BusinessNumberService` / `core.sequence_rule`; no second numbering service or local counter is introduced.
5. Optional parent workflow binding is tenant-scoped and process-code checked.
6. Items persist typed/source-traceable values through the approved item table. Item identity collisions are rejected.
7. Links bind a real child `wf_instance`; supplied child process code must match the persisted workflow instance. Duplicate child links are rejected.
8. Every master mutation requires `expectedVersion`; item/link additions and progress/status/close mutations advance both `version_no` and `master_change_version` with conditional updates.
9. Stale mutations fail with `STALE_VERSION` and cannot overwrite a newer orchestration state.
10. The kernel does not invent orchestration status transitions. Exactly one `StateTransitionCapability` must authorize status/closure semantics; missing or ambiguous capabilities fail closed.
11. Close requires an explicit close timestamp, cannot precede `actual_start_at`, and uses the transition capability to obtain/authorize the closing status.
12. Real PostgreSQL 16 integration verifies sequence-backed creation, item/link persistence, child process binding, optimistic-version conflict rejection, progress/status updates and closure on the approved tables.
13. The first C6 DB run exposed a test-fixture violation of C1/C2 version binding (published child version had no START node). The fix created DRAFT → START node → PUBLISHED; V101 protection was not weakened.
14. The next DB run exposed an actual C6 JDBC defect: orchestration INSERT contained one extra placeholder. The final forward fix corrected only the binding count.
15. Final exact SHA `3141a8378c8e4b641626069edfd5702959f1e793` passed run `31248694755` across source contract, Java, PostgreSQL/Testcontainers and Web.
16. `AGENT.md`, `DESIGN.md` and `Knowledge Base/**` were not modified. PHASE-06 remains `NOT_STARTED`.

## Next legal checkpoint

`C7 = engineering-owned Workflow API / security contract` may begin. PHASE-05 remains `IN_PROGRESS / NOT_READY`; C8 and the corrected Formal Gate are still required.
