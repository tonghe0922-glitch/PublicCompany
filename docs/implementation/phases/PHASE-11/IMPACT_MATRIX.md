# PHASE-11 IMPACT MATRIX

## Full-gate impact correction

P011-P016 are delivered and independently accepted together. Shared impact includes V120-V125 additive overlays, six domain services/repositories/controllers, six Worker notification handlers, six published workflows/forms, 31 explicit source-route bindings, six permission namespaces, three portal projections and six isolated real Browser fixtures. Construction evidence is indexed by `FULL_GATE_REPORT.md`; the authoritative verdict is `PHASE_GATE.md`. State is `COMPLETE / INDEPENDENT_GATE_PASS`.

Remediation impact is limited to the six page projections, shared phase11 client/state/operation helpers, structure/unit assertions and necessary behavior-preserving E2E structure. Backend API, permission, idempotency, version, data-scope and masking authority remain unchanged. Final independent revalidation covers Web 70 files / 636 tests and six fresh Chromium 1/1 runs with exact PG/Redis removal and final Ryuk/process/port zero state.

## P016 delivered impact evidence

- Domain/DB: V125 extends canonical `welfare.care_case` with immutable lifecycle facts, RLS/tenant/linkage/append-only protections and published S01–S08 workflow/form metadata.
- API/async: real controller/service/JDBC repository, workflow task/candidate enforcement, audit/outbox and replay-safe notification are covered by PostgreSQL 16.14 + Redis 7.4 integration tests.
- Portals: five exact source routes render employee, center/shared-supervision and metadata-only tech projections; route permissions fail closed.
- Boundary: payment is never initiated or calculated. Only an external execution receipt is persisted after separate human approval, followed by employee confirmation and independent reconciliation.
- Evidence: `P016_CHECKPOINT.md` and `.runlogs/phase11-p016-*`; P016 is locally closed while PHASE-11 remains `FULL_GATE_PENDING`.

| 流程 | Employee | Center | Tech | Domain / DB | Workflow / side effects | 核心测试 |
|---|---|---|---|---|---|---|
| P011 | 目标确认、记录、自评、结果确认、申诉 | 目标、主管评价、计算、校准、复核、执行、归档 | workflow/规则/审计 monitor | performance service/repository；cycle + score/evidence overlay | S01–S11；反馈/申诉/执行通知 | score_type 分离、0–1000、自校准拒绝、stale/idempotency |
| P012 | 申请/提名、进度、验证期 | 资格/空缺/预算、评审、审批、任命、回退 | workflow/org sync monitor | HR service/repository；promotion + employee_position | S01–S10；任命生效/回退事件 | 审批≠生效、无空缺拒绝、原任职保留、薪酬不自算 |
| P013 | 事实、通知、回执状态 | 证据、级别、审批、防重、影响、归档 | workflow/规则/审计 monitor | reward service/repository；reward_case + immutable facts | S01–S09；积分、外部财务/人事回执 | 同源防重、职责分离、重复执行拒绝 |
| P014 | 申辩、送达确认、申诉 | 止险、调查、评审、决定、执行、复核、整改 | workflow/隐私/审计 monitor | discipline service/repository；case + recusal/appeal facts | S01–S12；私密通知与整改事件 | 回避、自裁拒绝、原决定不可删、跨中心 masking |
| P015 | 当前/累计/到期/流水/申诉 | 发放、段位、来源、冲销、异常 | 规则版本/workflow/审计 monitor | point service/repository；append-only transaction | S01–S10；入账/调整/冲销通知 | DML 拒绝、同源防重、余额守恒、并发/重放 |
| P016 | 申请、材料授权、进度、确认 | 资格、审批、执行回执、对账、归档 | workflow/集成/隐私审计 monitor | welfare service/repository；care_case + receipts | S01–S08；执行/确认/对账通知 | 无资格/授权拒绝、回执防重、不发起付款、masking |

共享影响：root Maven reactor、API security/config、Worker handler registry、V120+ Flyway overlay、database-baseline IT、三端 Vue page/router/API client/unit/E2E、docs/implementation 台账与证据。
