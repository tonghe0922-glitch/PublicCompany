# PHASE-09 GAP_MATRIX

Status values: `EXISTING / PARTIAL / MISSING / CONFLICT / BLOCKED`.

> P001 checkpoint: `PASS / CLOSED` on evidence SHA `efe3ef6b33cdde79c0a406dbcf8961bf18cc497c`; full evidence: `P001_CHECKPOINT.md`.
> P002 checkpoint: `PASS / CLOSED` on evidence SHA `cdd58b3e7d93326ad4e48bc9c3b4f3460efaf6a6`; full evidence: `P002_CHECKPOINT.md`.
> P003 checkpoint: `PASS / CLOSED` on evidence SHA `df2b5bff7e3fa63c882e59c51805247c8aee39c0`; full evidence: `P003_CHECKPOINT.md`.
> P004 checkpoint: `PASS / CLOSED` on gate head SHA `baf7b29f1b2796b4017e4f1e0cf2c13407e18c35`; full evidence: `P004_CHECKPOINT.md`.
> P005 remains unimplemented at P004 close time.

| Area | P001 | P002 | P003 | P004 | P005 | Current decision |
|---|---|---|---|---|---|---|
| 15 XLSX source parse | EXISTING | EXISTING | EXISTING | EXISTING | EXISTING | 15/15, 90 sheets, 4,396 nonempty rows, 0 failures |
| Canonical DB mapping | EXISTING | EXISTING | EXISTING | EXISTING | EXISTING | P001 IAM session/MFA；P002 permission request/grant/user_role；P003 `hr.employee_profile_change` + `org.employee`；P004 `workflow.generic_request`；P005 retains frozen canonical mapping |
| Page `process_codes` in PHASE-01 | MISSING | MISSING | MISSING | MISSING | MISSING | original exact binding remains 0 as historical fact; explicit source-coordinate selections frozen in `PHASE09_PAGE_BINDINGS.json`; P001–P004 routes implement frozen selections |
| Route source coordinates | EXISTING | EXISTING | EXISTING | EXISTING | EXISTING | explicit page bindings frozen; no fuzzy runtime matching |
| Business HTTP paths from PHASE-01 | MISSING | MISSING | MISSING | MISSING | MISSING | historical source fact remains 0; engineering HTTP identifiers are explicit PHASE-09 contracts, not invented source claims |
| Server permission identifiers | EXISTING | EXISTING | EXISTING | EXISTING | MISSING | P001 monitor；P002 submit/read/review/execute/revoke；P003 submit/read/review/apply；P004 submit/read/act are enforced server-side; P005 remains to implement |
| IAM/session kernel | EXISTING | EXISTING | EXISTING | EXISTING | EXISTING | reuse, never duplicate |
| Workflow runtime/form/task/idempotency | EXISTING | EXISTING | EXISTING | EXISTING | EXISTING | P002/P003/P004 bind published workflow/runtime facts; P004 also binds versioned `EMP-P004-F01`, task assignment, idempotency and optimistic projection version |
| Notification/Outbox/Audit kernel | EXISTING | EXISTING | EXISTING | EXISTING | EXISTING | P004 emits privacy-minimized business events and uses worker notification/audit kernels; real Gate verifies outbox and audit facts |
| P001 password login/session/switch | EXISTING | n/a | n/a | n/a | n/a | real IAM/Redis runtime retained |
| P001 login-time MFA | EXISTING | n/a | n/a | n/a | n/a | TOTP fail-closed, encrypted credential, reauthentication and relogin verified |
| P001 account-security routes | EXISTING | n/a | n/a | n/a | n/a | employee/center/tech security routes implemented |
| P002 PermissionRequest business service/API/repo | n/a | EXISTING | n/a | n/a | n/a | service/controller/JDBC repository implemented; target job persists authoritative position_code |
| P002 temporary expiry auto-revoke | n/a | EXISTING | n/a | n/a | n/a | production worker + AUTO_EXPIRE + retry/DLQ + notification PostgreSQL checkpoint verified |
| P003 ProfileChange business service/API/repo | n/a | n/a | EXISTING | n/a | n/a | `platform-hr` service/controller/JDBC/value-store implemented with SELF/CENTER/tech scopes and authoritative apply |
| P003 sensitive proposal/master storage | n/a | n/a | EXISTING | n/a | n/a | P2/P3 server classification; P3 AES-GCM ciphertext + SHA-256 hash; separate profile key; proof required; masked reads; plaintext hygiene verified |
| P004 GenericRequest business service/API/repo | n/a | n/a | n/a | EXISTING | n/a | thin domain binding over canonical `workflow.generic_request` + shared WorkflowRuntimeService/Form/Task; actionCode only, no free target status |
| P005 Notice version/receipt business service/API/repo | n/a | n/a | n/a | n/a | MISSING | next checkpoint must implement publish/audience/read/confirm/archive; read != confirm |
| P005 delivery retry/DLQ | n/a | n/a | n/a | n/a | PARTIAL | platform notification/outbox kernel exists; P005 event/worker wiring missing |
| Three-portal real pages | EXISTING | EXISTING | EXISTING | EXISTING | MISSING | P004 Employee `/employee/03/07/01`, Center `/center/02/01/01`, Tech `/tech/05/03/01` pass real Playwright; Tech is monitoring-only |
| PostgreSQL persistence after refresh/relogin | EXISTING | EXISTING | EXISTING | EXISTING | MISSING | P004 request/workflow/form/action/outbox facts are PostgreSQL-backed; sessions use real Redis; no browser shadow state |
| Idempotency/concurrency/negative tests | EXISTING | EXISTING | EXISTING | EXISTING | MISSING | P004 covers stale 409, exact replay, cross-center isolation, applicant self-action denial, S04/S05 separation, S07/S08 independence, tech no-act and closed state |
| Real three-portal E2E | EXISTING | EXISTING | EXISTING | EXISTING | MISSING | P004 reusable Spring Boot + PostgreSQL16 + Redis + Audit + employee/center/tech Gate is required by Full Construction verdict |
| P006+ code | EXISTING | EXISTING | EXISTING | EXISTING | EXISTING | phase boundary guard active; P006+ remains NOT_STARTED / absent from PHASE-09 implementation targets |

## Current conclusion

C0 ambiguity and P001–P004 implementation gaps are closed by real checkpoints, not document assertion.

P004 evidence is pinned to:

```text
Gate head SHA = baf7b29f1b2796b4017e4f1e0cf2c13407e18c35
Independent P004 Live Gate = 31362796230 / run_number=6 / SUCCESS
Independent P004 job = 93374896402 / SUCCESS
Independent artifact = 9053030760
PHASE-09 Full Gate = 31363467215 / run_number=100 / SUCCESS
P004 reusable live job = 93376861706 / SUCCESS
P004 reusable artifact = 9053276684
Final verdict job = 93377476140 / SUCCESS
Final facts = status 已关闭 / workflow COMPLETED / actualAmount 111.11 / START 1 / business actions 9 / FORM_SUBMIT 1 / approval actors 2 / execution-acceptance actors 2 / applicant actions 0 / tech actions 0 / outbox 9 / private hits 0 / form 1 / audit 1+22 / password hits 0 / redis 30
```

PHASE-09 remains `IN_PROGRESS`. The only legal next construction target is P005. Every MISSING/PARTIAL P005 item must be closed before PHASE-09 Formal Gate can declare the stage complete. PHASE-10 remains blocked until P001–P005 are all closed and the final PHASE-09 gate passes.
