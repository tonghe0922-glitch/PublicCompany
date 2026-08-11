# PHASE-04 C4 CHECKPOINT

> Closure: `C4 RBAC + ABAC + RLS context`
> Phase state remains `IN_PROGRESS`; PHASE-05 remains `NOT_STARTED`.

## Implementation evidence

Implementation commit: `ff75434993462d3e8a804c863362e81cc1eff956`.

Workflow: `Phase 04 IAM Kernel`.
Implementation run: `31196188401`.

Verified on the implementation commit:

- focused PHASE-04 XLSX source contract/fake-completion gate = success;
- PostgreSQL 16 + Redis 7.4 IAM integration = success;
- RBAC decisions are loaded only from active `iam.user_role -> role -> role_permission -> permission` facts;
- unknown non-empty `condition_expr` remains fail-closed;
- ABAC data-scope evaluator supports only the strict source-derived single-scope subset (`SELF`, `OWNER`, `CENTER`/`ORG`, `POSITION`); missing, extra, or unknown expressions deny;
- tenant mismatch denies before scope evaluation;
- synthetic cross-center and cross-employee access are denied;
- switching from identity/appointment A to B does not carry A's grants or data scope;
- P2 field access can mask when unauthorized; P3 requires both authorization and Step-Up satisfaction before becoming visible;
- transaction context can bind tenant/user/identity/employee/appointment/org/position via `SET LOCAL`, preserving PostgreSQL RLS fail-closed behavior and automatic cleanup at transaction end.

## Boundary

C4 does not implement business workflow, full P001/P002/P003 pages, or PHASE-05 runtime. Business-status/risk/time-window ABAC expressions are not invented: until an approved expression contract exists, they remain fail-closed.

## Closure rule

This checkpoint commit must itself pass the same `Phase 04 IAM Kernel` workflow. After that success is observed, `C4 = CLOSED` and C5 may start.
