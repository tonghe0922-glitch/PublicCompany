# PHASE-08 IMPACT_MATRIX — CLOSEOUT

> Phase: `PHASE-08`
> Scope: `PLATFORM/Portal-Router-Session-API-Client`
> Status: `READY_FOR_GATE`
> IA evidence: `6/6 XLSX parsed / 0 failures / 7,126 page records cross-checked`
> Final functional implementation anchor: `6b347d1637b36c3d3e822f9035ce072155b926b6`
> Final functional gate: `31287803627 = PASS`

| process_code | Employee 页面 | Center 页面 | Tech 页面 | Route | Permission | Data Scope | Sensitive Level | API | Application Service | Domain | Repository | 数据库 | Flyway | Workflow | Outbox | Worker | Audit | Notification | Integration | Unit Test | Integration Test | E2E |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PLATFORM/PHASE08:C0-CONTRACT | login/shell source facts | 同左 | 同左 | IA route metadata source freeze | existing IAM facts only | server authoritative | page catalog L1-L4 | existing `/api/v1/auth/*`, `/session`, `/step-up` schemas | existing IAM services | IAM/ORG | existing JDBC/Redis | unchanged | none | none | none | none | existing security audit | none | OpenAPI + browser runtime contract | source contract | PostgreSQL16+Redis7.4 IAM | N/A |
| PLATFORM/PHASE08:C1-API-CLIENT | shared client | shared | shared | same-origin `/api` | bearer / explicit Step-Up metadata | no client authority | credentials never logged | approved `/api/v1/**` only | none | none | none | none | none | none | none | none | requestId/problem propagation | none | Fetch/HTTP | client/error/retry/cancel/idempotency | API contract regression | controlled HTTP scenarios |
| PLATFORM/PHASE08:C2-SESSION | login/current identity | login/current identity | login/current identity | protected shell gate | `session.can()` UX only | active server identity | access memory-only; refresh tab-scoped | login/refresh/logout/session/switch | existing Session/IAM services | IAM/ORG | existing JDBC/Redis | PostgreSQL + Redis existing | none | none | none | none | login/logout/switch security audit | none | Redis server-side session | restore/rotation/single-flight/corrupt-expired | real IAM integration | login/restore/expiry/switch/logout |
| PLATFORM/PHASE08:C3-ROUTER | employee shell | center shell | tech shell via admin alias | login/protected/forbidden/not-found + intended route + cancel | guard UX only | route meta display only | route meta display only | none | none | none | none | none | none | none | none | none | error trace | none | Vue Router | guard/redirect/cancel | N/A | protected route/navigation |
| PLATFORM/PHASE08:C4-NAV | IA taxonomy + mobile bottom nav | IA taxonomy | IA taxonomy | current route + real implemented entries | all canonical permissions required | no scope expansion | no sensitive nav authority | none for fake badge/search | none | none | none | none | none | none | none | none | none | no fake badge/search/messages | deterministic IA projection | projection + VTU; `splitMobileNavigation` | N/A | desktop/mobile reachability |
| PLATFORM/PHASE08:C5-HEADER | current employee identity | current manager identity | current tech identity | switch keeps route safe | `platform.session.switch` required to render switch | assignment refreshed | no credential display | session/switch/logout | existing IAM | IAM/ORG | existing | existing | none | none | none | none | server audit | no fake message/search | IAM | VTU + switch-failure regression | switch integration | switch invalidates old credential/permission |
| PLATFORM/PHASE08:C6-LOGIN-SHELL | real login shell | real login shell | real login shell | login/protected/forbidden/not-found | server final authority | server final authority | password/token fail-closed | auth/session | existing backend | IAM | existing | existing | none | none | none | none | backend security audit | none | three portal runtime | login-shell tests | controlled backend fixture | employee/center/admin desktop+mobile |
| PLATFORM/PHASE08:C7-QUALITY | no business-page completion claims | 同左 | 同左 | full shell coverage | 401/403 negative | no scope escalation | artifact/credential scan | existing IAM contracts only | existing IAM services | IAM/ORG | existing adapters | no structure change | none | no new business workflow | none | no new worker | immutable operation/security events | none | Vite proxy → Spring → PostgreSQL/Redis → Audit | 14 files / 66 PASS | PostgreSQL16+Redis7.4 IAM PASS | static 16 PASS; live 7 PASS / 1 duplicate deep mobile SKIP |

## Source and platform boundaries

1. Canonical portals remain `employee / center / tech`; runtime/build is exactly `employee / center / admin`, `tech → admin`.
2. PHASE-08 implements platform runtime only. It does not implement or reclassify P001–P126 business pages/processes.
3. Router/Nav visibility is UX only; API permissions, data scope, ABAC and PostgreSQL RLS remain final server boundaries.
4. Six IA XLSX sources were actually parsed; C4 deterministic navigation source counts are employee 885 / center 1,417 / tech 1,510.
5. Planned taxonomy is not clickable. Mobile `更多` contains only overflow items already admitted by the same implemented/route/permission/mobile filter.
6. No approved real API exists for todo/search/messages; PHASE-08 keeps those capabilities absent rather than faking data.
7. No new database/Flyway/business workflow/outbox/worker truth is introduced.
8. PHASE-09 remains `NOT_STARTED`.

## Final evidence

```text
C0 = 31271339605 PASS
C1 = 31272039128 PASS
C2 = 31272465244 PASS
C3 = 31272873854 PASS
C4 = 31273291742 PASS
C5 = 31273559280 PASS
C6 = 31273786369 PASS
C7 = 31287803627 PASS
Audit: actions=22 / switches=1 / denied=1 / credential_hits=0
Status = READY_FOR_GATE
```
