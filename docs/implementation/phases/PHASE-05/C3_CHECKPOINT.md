# PHASE-05 C3 CHECKPOINT — canonical form runtime

- Phase: `PHASE-05`
- Scope: canonical form version / submission / value / field-level return
- Implementation lineage: `86519b2a62e113e4e0707dbb6fdfe72cad87fdb2` with forward fixes `ef683a4a13f52ebfdb58c9eb21574d17649f01b5` and `e1fa0de194f3647504c2fd6ce5d2efac8786356e` (legacy imported history references)
- PublicCompany validation commit: `29f13dbf0cebbcb8fb35b1e449a604c00fed1f14`
- Focused CI: `Phase 05 Canonical Workflow Kernel` run `31247035418`
- Result: source/scope PASS; Java PASS; PostgreSQL 16/Testcontainers PASS; Web PASS

## Closed scope

1. Versioned `wf_form_definition` draft/publish semantics are implemented without introducing a parallel form source of truth.
2. Published form versions are immutable at service and PostgreSQL constraint/trigger boundaries.
3. `wf_submission` binds the exact `form_definition_id + form_version`; stale form versions are rejected.
4. `wf_submission_value` persists typed values only through the approved TEXT / NUMBER / DATETIME / BOOLEAN / JSON slots.
5. Submission content hashing and shared idempotency protect duplicate mutation attempts.
6. Field-level `RETURN_FIELDS` records exact returned field codes and submission/form-version evidence without moving the workflow node.
7. Submitted values and submission binding are immutable after submission according to the C3 database invariants.
8. The previous GitHub Actions billing/spending blocker is no longer active for this repository: run `31247035418` executed checkout, Maven, PostgreSQL/Testcontainers and web steps successfully.
9. The PublicCompany snapshot lost the executable bit on `mvnw`; PHASE-05 CI now invokes it with `bash ./mvnw`, preserving the wrapper content while restoring Linux runner execution.
10. PHASE-06 remains `NOT_STARTED`; C4 may start only after this checkpoint.

## Migration note

`louthison/PublicCompany` is now the sole construction repository and `ChatGPT_Version_V0.05` is the active construction branch. Legacy `louthison/NEWSTART` SHAs and runs remain historical provenance only; they are not treated as reachable PublicCompany commit identities.
