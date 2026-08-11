# ADR-003 — PHASE-05 Shared Process Kernel Boundaries

- Status: Accepted for PHASE-05 gate validation
- Scope: P016–P020 only
- Decision date: 2026-08-08

## Context

PHASE-05 implements the approved flows for employee welfare/care (P016), electronic signature (P017), data import (P018), sensitive export/download (P019), and data quality/repair (P020). The Knowledge Base defines the process semantics, audit expectations, state sequences, and approved physical tables. HTTP routes, Java interfaces, permission-code strings, and worker adapter boundaries are engineering contracts derived for this implementation; they are not presented as original Knowledge Base facts.

The physical ownership used by this phase is limited to approved structures, including `welfare.care_case`, `document.signature_envelope`, `document.signature_party`, `integration.data_import_job`, `integration.data_import_job_item`, `integration.dead_letter`, `audit.data_export_request`, `audit.data_export_request_item`, `audit.data_quality_issue`, `audit.data_quality_issue_item`, plus existing shared `core`, `document`, workflow, IAM, and immutable-audit structures. No `signature_event`, `export_download_log`, or `data_repair_record` table is invented by PHASE-05.

## Decisions

### 1. Fail closed at external capability boundaries

P016 financial/invoice validation, P017 signature provider operations, P018 import executors, P019 export generation/download delivery, and P020 repair handlers are explicit capability boundaries. If the required adapter is missing, ambiguous, or returns incomplete evidence, the operation is rejected. No placeholder adapter may report business success.

### 2. State machines are authoritative

Business services enforce the published P016–P020 state sequence and optimistic version. Controllers cannot skip states by sending a target status. P019 specifically preserves the second-authentication node before download delivery. P020 preserves repair-plan approval, distinct-person execution, verification, and closing nodes.

### 3. P018/P019 execution is asynchronous and registered-handler only

Confirmation creates a tenant-scoped `core.outbox_event`. Worker handlers receive an already-routed tenant/event/resource/version tuple, enter a tenant transaction, validate the event and aggregate state, resolve exactly one registered executor/generator, and then invoke it. The worker does not accept arbitrary SQL or scan all tenants. Retry is bounded; terminal failure is recorded in the approved `integration.dead_letter` structure.

### 4. Critical audit is a prerequisite, not a best-effort side effect

Security-sensitive HTTP mutations use the separate immutable `sjg_audit` writer. P018/P019 workers also append an approved `audit.operation_log` record before invoking the actual executor/generator. If audit persistence is unavailable, the critical action does not execute and the worker follows its retry/dead-letter path. Raw access/refresh/Step-Up credentials are never audit payloads.

### 5. P019 reuses the PHASE-04 one-time contextual Step-Up kernel

A download grant requires the P019 download permission and consumes a single-use Step-Up ticket bound to the authenticated session context and the request-specific purpose `P019_DOWNLOAD:<request-id>`. A normal authenticated session is insufficient for this action. Delivery capability is issued only after Step-Up consumption and critical audit succeed; an unavailable delivery adapter fails closed.

### 6. P020 dual-person control is persisted server-side

The reviewer and approved repair plan are persisted in approved P020 detail storage during plan approval. Execution reloads that persisted control evidence and rejects an executor equal to the reviewer. A caller cannot satisfy the rule by supplying an arbitrary reviewer ID on the execute request. Repair execution is limited to a registered handler and must produce before/after evidence that is verified before close.

### 7. Database tenancy is enforced below the service layer

API and worker code set `app.tenant_id` inside a database transaction. Approved PostgreSQL RLS policies remain the database enforcement layer. Authorization/data-scope checks in controllers/services are additional controls, not substitutes for RLS. PHASE-05 integration tests must install the actual Flyway baseline and inspect/use the approved RLS policies; tests must not create replacement policies.

### 8. The three portal UI is not a security boundary

Employee, center-management, and technical portals share the P016–P020 process workspace and may tailor presentation. Button visibility and client state never confer permission. Every read/write continues through server-side authentication, permission/data-scope checks, state validation, RLS, and required Step-Up/audit controls.

### 9. API and Worker remain non-migration runtime identities

Flyway stays in the dedicated database-baseline/migration capability. API and Worker runtime POMs and application startup must not gain Flyway migration responsibility. PHASE-05 CI continues the PHASE-03 runtime-identity separation contract.

## Consequences

- Some flows remain intentionally unavailable until a real provider/executor/generator/delivery/repair adapter is configured; this is correct fail-closed behavior, not incomplete success.
- The implementation can be tested deterministically at domain/controller boundaries without faking external success.
- PostgreSQL 16 integration must validate the approved physical tables, RLS and least-privilege runtime behavior, while Redis/Step-Up and immutable-audit regressions reuse the proven PHASE-04 integration suite.
- Any future schema addition or state bypass requires a new source-backed decision rather than an ad-hoc PHASE-05 patch.
