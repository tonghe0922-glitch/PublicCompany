# PHASE-09 SOURCE_CONTRACT

> Status: `FROZEN / C0_COMPLETE_CANDIDATE`
> Scope: `P001–P005 公共能力 A`
> Canonical portals: `employee / center / tech`; runtime alias `tech=admin`.

## 1. Source set actually read

- `/AGENT.md`, `/DESIGN.md`, `Construction Master Schedule.csv`;
- PHASE-01 master process/page/API/permission/database contracts;
- P001–P005 employee/center/tech XLSX: **15/15**, **90 sheets**, **4,396 non-empty rows**, parse failures **0**;
- required sheets per workbook: `00_流程总览 / 01_表单清单 / 02_字段字典 / 03_状态与审批 / 04_规则与接口 / 05_三端联动`;
- current Java/Vue/Flyway implementation from completed PHASE-03–08.

Machine evidence:
- `P001_P005_SOURCE_SNAPSHOT.json`
- `P001_P005_PAGE_TRACE.json`
- `PHASE09_PAGE_BINDINGS.json`

## 2. Process ownership

| process | canonical name | primary table | existing platform kernel | PHASE-09 obligation |
|---|---|---|---|---|
| P001 | 统一登录与多岗位身份切换 | `iam.login_session` + existing IAM/Redis session facts | IAM/Session/Step-Up | complete MFA + session/account-security views + tech monitoring/audit |
| P002 | 权限申请、复核与回收 | `iam.permission_request` | IAM + Workflow + Outbox/Audit | request→review→execute/revoke→expiry recovery |
| P003 | 个人资料变更 | `hr.employee_profile_change` | Workflow + Audit | self request→sensitive review→apply→history/masking |
| P004 | 通用申请与审批 | `workflow.generic_request` | Workflow runtime/form/task/idempotency | real bound workflow; no arbitrary status |
| P005 | 制度、通知与执行回执 | `collaboration.notice` | Workflow + Notification + Outbox/Audit | versioned publish→audience delivery→read/confirm receipt→archive |

No P006+ implementation is permitted.

## 3. Cross-portal truth

Every business record uses one authoritative server fact:
`business_id / business_no / process_instance_id / server_state / version`.
Employee, Center and Tech are projections/actions over the same record; no portal-specific duplicate business table or localStorage business state is allowed.

## 4. Page binding

The preparation scan proved PHASE-01 page `process_codes` were empty for P001–P005. C0 closes that ambiguity with explicit source-coordinate bindings in `PHASE09_PAGE_BINDINGS.json`. Those bindings are contractual selections, not fuzzy runtime matching. A page is marked IMPLEMENTED only after its real route, permission, API and server-backed behavior pass the process checkpoint.

## 5. API contract

PHASE-01 contains zero canonical business HTTP paths. The XLSX `04_规则与接口` sheets define interface capabilities and reliability requirements, not REST routes. PHASE-09 therefore freezes explicit engineering HTTP identifiers in `docs/implementation/contracts/phase-09/PHASE09_HTTP_PERMISSION_CONTRACT.md`.

The identifiers do not invent business meaning. Source-backed role/data-scope/state/sensitive semantics remain authoritative.

## 6. Workflow/state contract

- The current WorkflowRuntimeService and published-version model are mandatory shared infrastructure.
- State changes occur only through server workflow/domain commands.
- Each P002–P005 record binds to one workflow instance/version.
- Workflow actions require server-resolved task assignment; self-approval/interest conflicts fail closed.
- stale node/version, duplicate callback, invalid action and concurrency conflict are negative-test requirements.
- XLSX state/node order, forms and `P00X.stage.NN.completed` event names are the source for process-specific workflow definitions; no new business state labels may be created by controllers/Vue.

P001 uses IAM session lifecycle rather than duplicating it into a second workflow state store; P001 audit/event evidence must still satisfy the sourced S01–S08 business trace.

## 7. Permission/data-scope contract

Source roles and scope, not the engineering permission string, determine authority:
- employee: SELF unless a source row explicitly grants project/resource scope;
- center: CENTER/PROJECT/RESOURCE_SCOPE as source applies; requester may not approve own item;
- tech: configuration/execution/monitoring only; not default business approver.

Permission identifiers are frozen in the HTTP/Permission contract and must be seeded/assigned only according to sourced roles. Missing assignment => deny.

## 8. Sensitive data

P1/P2/P3 source field sensitivity is authoritative. P2/P3 fields require minimum-necessary projection, masking, controlled export and Step-Up where source requires secondary authentication. Secrets/password/MFA assertions never enter audit/outbox/plain logs.

## 9. P001 MFA

`ADR-PHASE09-001-P001-MFA-TOTP.md` is accepted as the engineering method decision. Existing session truth remains IAM/Redis. MFA is fail-closed for accounts whose `mfa_level > 0`.

## 10. Side effects / reliability

- Workflow action/history: existing workflow kernel;
- audit: immutable audit service/DB;
- async delivery/execution: existing Transactional Outbox/Worker/Notification/Integration; process-specific events must reuse them;
- every write: Idempotency-Key + request hash + optimistic/stale guard;
- worker callback/expiry: idempotent and retryable, DLQ/manual takeover where PHASE-06 kernel provides it;
- a notification/read flag never substitutes for business completion.

## 11. Definition of completion

A process is COMPLETE only after: real three-portal pages/actions, API, permission/data scope, application/domain/repository, PostgreSQL persistence, workflow/history, audit, side effects where applicable, refresh/relogin persistence, idempotency/concurrency/negative tests and real E2E are all PASS. Static UI alone is never implementation.
