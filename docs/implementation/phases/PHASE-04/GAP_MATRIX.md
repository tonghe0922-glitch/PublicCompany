# PHASE-04 GAP MATRIX

> Phase: `PHASE-04｜Core IAM、组织、员工、任职、会话与权限内核`
> Final construction snapshot for Formal Phase Gate.
> Status vocabulary: `EXISTING / INTENTIONAL_BOUNDARY / NOT_APPLICABLE_BY_SCOPE`.

| ID | Area | Final status | Verified construction fact | Formal Gate treatment |
|---|---|---|---|---|
| G01 | Previous formal gate | EXISTING | PHASE-03 COMPLETE / formal Gate PASS | Must remain true |
| G02 | Construction branch | EXISTING | `agent/full-build`, fast-forward only | Verify remote SHA |
| G03 | Formal PHASE-04 authority | EXISTING | Scope = shared IAM/ORG/session/permission kernel | No business-phase expansion |
| G04 | Current-stage XLSX reparse | EXISTING | 11/11 sources, 0 parse failure | Re-run deterministic checks |
| G05 | P001 source mapping | EXISTING | session/identity kernel facts sourced | Full P001 page intentionally absent |
| G06 | P002 source mapping | EXISTING | permission/Step-Up requirements sourced | Full approval flow intentionally absent |
| G07 | P003 source mapping | EXISTING | sensitive-field/appointment boundaries sourced | Full profile-change flow intentionally absent |
| G08 | Organization workbook | EXISTING | safe structure/source facts extracted | No real employee row fixture |
| G09 | Real employee workbook privacy | EXISTING | row values not committed to evidence/tests | Must remain excluded |
| G10 | Org authoritative tables | EXISTING | PostgreSQL org employee/appointment/org/position read through JDBC + RLS | Re-run PG integration |
| G11 | IAM authoritative tables | EXISTING | PostgreSQL account/identity/role/permission/data-scope facts | Re-run IAM integration |
| G12 | Password verification | EXISTING | BCrypt verification against authoritative `password_hash`; no default password | Re-run C6 login negative/positive |
| G13 | Runtime session store | EXISTING | Redis access/refresh digest + TTL + context | Re-run session integration |
| G14 | Session expiry/refresh/logout | EXISTING | atomic rotation/replay protection/revoke | Re-run API integration |
| G15 | Current appointment switch | EXISTING | active identity/appointment re-resolved; old session revoked | Re-run API integration |
| G16 | RBAC evaluator | EXISTING | active role/permission facts; deny-by-default | Re-run C4 integration |
| G17 | ABAC/data scope evaluator | EXISTING | strict sourced scope subset; unknown expression fails closed | Re-run C4 integration |
| G18 | RLS transaction context | EXISTING | full transaction-local identity context | Re-run PostgreSQL integration |
| G19 | Field-level P2/P3 control | EXISTING | P2 mask; P3 permission + Step-Up | Re-run C4 integration |
| G20 | Authentication filter | EXISTING | opaque token filter; protected no-token = 401 | Re-run C6 integration |
| G21 | Authorization boundary | EXISTING | explicit matchers + final `/api/**` denyAll | Static + runtime verify |
| G22 | HTTP API source conflict | EXISTING | resolved by ADR: engineering paths are not claimed as KB canonical URLs | Verify ADR/OpenAPI |
| G23 | OpenAPI | EXISTING | phase-04 security contract checked into repo | Static verify |
| G24 | Step-Up ticket | EXISTING | digest-only, short-lived, one-time, identity/purpose bound | Re-run C5 integration |
| G25 | MFA capability provider | INTENTIONAL_BOUNDARY | interface implemented; default provider fail-closed; no invented secret/OTP | Non-blocking by approved scope |
| G26 | Audit application writer | EXISTING | separate audit DB using `sjg_audit_writer`; critical security operations audited | Re-run C6 integration |
| G27 | Production org/employee seed | INTENTIONAL_BOUNDARY | real P2/P3 employee values not copied into Git fixtures | Deployment/business-data concern, not kernel blocker |
| G28 | Synthetic test accounts | EXISTING | synthetic tenants/users/employees/appointments only | Must remain synthetic |
| G29 | Employee/Center/Tech full business pages | NOT_APPLICABLE_BY_SCOPE | no PHASE-04 business UI added | Baseline diff must be empty for web/src |
| G30 | 401/403 negative | EXISTING | unauthenticated 401; authenticated denied/undefined 403 | Re-run C6 integration |
| G31 | Cross-employee negative | EXISTING | C4 data-scope test denies | Re-run IAM integration |
| G32 | Cross-center negative | EXISTING | scope denial + identity switch context isolation | Re-run IAM integration |
| G33 | Appointment-switch negative | EXISTING | unknown/old identity path denied; old session invalidated after switch | Re-run integration |
| G34 | Session-expiry negative | EXISTING | expired access 401; valid refresh recovery | Re-run C6 integration |
| G35 | Step-Up replay/expiry negative | EXISTING | replay/expiry/wrong-context/wrong-purpose denied | Re-run C5 integration |
| G36 | Business Workflow runtime | NOT_APPLICABLE_BY_SCOPE | PHASE-05 remains NOT_STARTED; workflow main runtime unchanged | Hard boundary |
| G37 | Outbox/Notification business flow | NOT_APPLICABLE_BY_SCOPE | no business async flow added in PHASE-04 | Hard boundary |
| G38 | CI | EXISTING | normal construction head passed Phase02/03/04 regression | Independent Gate must rerun |
| G39 | Ledger protection | EXISTING | 7,126 page / 126 process catalogs unchanged from PHASE-03 complete baseline | Gate diff check |
| G40 | Phase state | EXISTING | PHASE-04 READY_FOR_GATE; PHASE-05 NOT_STARTED | Promote only after independent PASS |

## Closure summary

```text
C1 Source Contract                         CLOSED
C2 Identity + Org Authoritative Directory CLOSED
C3 Session + Appointment Switch           CLOSED
C4 RBAC + ABAC + RLS + Field Control      CLOSED
C5 Step-Up + MFA Capability               CLOSED
C6 API Security + Contract + Audit        CLOSED
```

There are no remaining PHASE-04 implementation blockers. `INTENTIONAL_BOUNDARY` and `NOT_APPLICABLE_BY_SCOPE` entries must not be converted into fake implementation merely to make the matrix uniformly `EXISTING`.
