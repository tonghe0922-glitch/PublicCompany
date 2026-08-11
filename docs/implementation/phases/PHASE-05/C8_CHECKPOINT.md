# PHASE-05 C8 CHECKPOINT — canonical final proof / Gate passed

> Canonical C8 state: `COMPLETE / GATE_PASSED`
> PHASE-05: `COMPLETE`
> PHASE-06: `NOT_STARTED`

- C8 runtime/concurrency implementation candidate: `f6f6de10012378feedc71c596181d49c30b91049`
- C8 forward test-compile fix: `fd375267b64815abfd787266d260bfccc13ed293`
- C8 construction CI: `31250129581` — all PHASE-05 construction jobs PASS
- Final READY_FOR_GATE candidate: `d74fe79b934b1e635e4d351bc7499da4137bd6ca`
- Candidate construction CI: `31250885714` — PASS
- Corrected independent Formal Gate: `31250885752` — PASS

## 1. Final canonical PostgreSQL proof

C8 added `Phase05WorkflowFinalDatabaseIT` to the real `phase05-integration` profile without adding replacement workflow tables, replacement RLS policies or test-only production migrations.

The PostgreSQL 16 suite proves:

1. approved workflow definition/runtime/form/SLA/orchestration tables are installed with RLS, owner `sjg_owner` and tenant policy coverage;
2. two synthetic tenants are isolated while connected as the real `sjg_api_runtime` role with transaction-scoped `app.tenant_id`;
3. cross-tenant reads are hidden and a cross-tenant UPDATE affects zero rows;
4. runtime DML privileges do not include `CREATE` on the workflow schema;
5. the installed PHASE-03 V45 schema and V100–V102 integrity overlays remain authoritative.

## 2. Real competing-action transaction proof

C8 creates a real published synthetic workflow:

```text
START --SUBMIT--> REVIEW --APPROVE--> END_OK
START --WITHDRAW--> END_WITHDRAW
REVIEW --REJECT--> END_REJECT
REVIEW --RETURN--> START
```

Two independent transactions with different idempotency keys simultaneously approve the same assigned REVIEW task through the real runtime/JDBC/idempotency stack.

Validated outcome:

- exactly one transaction commits;
- the loser fails closed after the winning state change;
- final instance is `COMPLETED / END_OK`;
- the task is `COMPLETED`;
- exactly one `APPROVE` action row exists;
- exactly one competing idempotency row remains, proving the losing transaction's idempotency claim rolled back.

## 3. Idempotency and distinct action history

The final PostgreSQL proof also validates:

- same-key/same-hash START replay returns the same instance;
- same-key/changed-hash START fails `CONFLICT`;
- same-key/same-hash APPROVE replay returns the same action;
- same-key/changed-hash APPROVE fails `CONFLICT`;
- `REJECT` persists `END_REJECT` and instance `REJECTED`;
- `RETURN` persists `REVIEW -> START` while the instance remains running;
- `WITHDRAW` persists `START -> END_WITHDRAW` and instance `WITHDRAWN`.

RETURN, REJECT and WITHDRAW therefore remain distinct outcomes and immutable history facts.

## 4. Construction validation history

Initial C8 SHA `f6f6de10012378feedc71c596181d49c30b91049` caused run `31250045738` to fail test compilation because four generic RLS assertions made JUnit overload selection ambiguous. The forward fix `fd375267b64815abfd787266d260bfccc13ed293` only made test return typing explicit; it did not skip test compilation, remove an assertion or change production behavior.

Run `31250129581` then passed source/scope, full Java, hardened Workflow API/Spring Security, PostgreSQL 16 canonical + historical suite including C8, and Web.

## 5. Final candidate and Gate

The READY_FOR_GATE candidate `d74fe79b934b1e635e4d351bc7499da4137bd6ca` contains the final control-plane alignment and exact-SHA Gate contract. It passed normal construction CI `31250885714`.

Independent Gate run `31250885752` then revalidated that exact candidate and passed:

- exact candidate source/security preflight;
- Java + Workflow API/Spring Security;
- PostgreSQL 16 RLS/concurrency/idempotency/history;
- PHASE-04 IAM/Redis/HTTP/immutable audit;
- Web typecheck/test/build;
- Windows Chinese-path install/verify/migrate/start/stop;
- final Gate verdict.

## 6. Historical superseded C8 evidence

The previous C8 record for the shifted P016–P020-only interpretation remains valid historical provenance:

```text
Historical strong-integration candidate: a99e22494f0f56d8d0bda0df98be57a000d3139b
Historical PHASE-05 focused run: 31238966448
Historical PHASE-03 later-phase-aware run: 31239252933
Historical PHASE-04 IAM later-phase-aware run: 31239314223
Historical PHASE-04 independent Gate later-phase-aware run: 31239340626
Current canonical use: provenance only / superseded as C8 proof
```

## 7. C8 verdict

```text
C8 canonical construction = COMPLETE
PHASE GATE = PASS
PHASE-05 = COMPLETE
PHASE-06 = NOT_STARTED
```
