# PHASE-05 Workflow API Contract

> Status: C7 engineering-owned contract
> Namespace: `/api/v1/workflow/**`
> Source provenance: **engineering-owned**. `MASTER_API_CATALOG.md` contains no source-authored HTTP method/path facts for the canonical workflow kernel, so the paths below MUST NOT be represented as Knowledge Base supplied URLs.

## 1. Security boundary

All routes require an authenticated PHASE-04 opaque session. Tenant, employee, identity, appointment, organization and position facts come from `SessionPrincipal`; request bodies cannot select a tenant, actor or operator identity.

The API reuses PHASE-04 `AuthorizationService` / `AuthorizationTarget`. Every route has an explicit permission code and data-scope check. No C7 migration grants these permissions to any role by default; an unconfigured permission therefore fails closed.

Runtime resources do not persist an authoritative resource organization/position binding. For existing workflow instances, the controller supplies the persisted initiator/assignee employee facts to data-scope evaluation and leaves resource `orgId` / `positionId` null. `CENTER`, `ORG` and `POSITION` scopes therefore fail closed rather than borrowing the caller's own organization facts.

Task claim is a candidate action rather than ownership of an existing workflow resource. Its generic data-scope target is the authenticated claimant's employee/org/position identity with `ownerEmployeeId = null`; therefore an `OWNER` scope cannot be made true by pretending the claimant owns the task. C4 server-side candidate resolution remains the authoritative eligibility gate and applies organization, position, amount, risk, self-approval exclusion and recusal rules.

Mutation attempts are written through `JdbcSecurityAuditService` before the business mutation. Audit persistence failure aborts the request.

## 2. Permissions

| Permission | Use |
|---|---|
| `workflow.runtime.start` | start a canonical workflow instance |
| `workflow.runtime.read` | read a workflow instance/current task result |
| `workflow.runtime.act` | submit an action against the current node/task |
| `workflow.task.claim` | claim the current unassigned task when the server-side candidate resolver says the employee is eligible |
| `workflow.form.submit` | submit the form bound to the current instance/task |

## 3. Routes

### `POST /api/v1/workflow/instances`

Starts an instance from an exact published `wf_version.id`.

Required header: `Idempotency-Key`.

Allowed request fields only:

```json
{
  "versionId": "uuid",
  "businessObjectType": "string",
  "businessObjectId": "uuid-or-null",
  "businessObjectNo": "string-or-null",
  "title": "string",
  "priority": "string-or-null",
  "contextSnapshot": {}
}
```

The request cannot provide `tenantId`, `actorId`, `operatorIdentityId`, `processCode`, `targetState` or `targetNodeCode`.

### `GET /api/v1/workflow/instances/{instanceId}`

Returns the canonical `WorkflowRuntimeService.Result` for the tenant-bound instance, including its current task when one exists.

### `POST /api/v1/workflow/instances/{instanceId}/actions`

Required header: `Idempotency-Key`.

Allowed request fields only:

```json
{
  "taskId": "uuid-or-null",
  "expectedNodeCode": "string",
  "actionCode": "string",
  "reason": "string-or-null"
}
```

**No target node or target status is accepted.** `WorkflowRuntimeService` resolves `actionCode -> transition -> next node/status` from the exact version/current node on the server. A stale `expectedNodeCode`, stale task or illegal action fails closed.

### `POST /api/v1/workflow/instances/{instanceId}/tasks/{taskId}/claim`

The request first passes explicit `workflow.task.claim` permission and claimant-scoped data-scope checks. It then loads the tenant-bound instance and verifies the URL task is the current task **before** invoking the claim mutation. C4 resolves the candidate set from organization, position, amount, risk, self-approval exclusion and recusal facts. Zero eligible candidates, an ineligible claimant or a competing prior claim fails closed.

### `POST /api/v1/workflow/forms/submissions`

Required header: `Idempotency-Key`.

Allowed request fields only:

```json
{
  "instanceId": "uuid",
  "taskId": "uuid-or-null",
  "formDefinitionId": "uuid",
  "expectedFormVersion": 1,
  "values": [
    {
      "fieldCode": "string",
      "valueType": "TEXT|NUMBER|DATETIME|BOOLEAN|JSON",
      "valueText": "string-or-null",
      "valueNumber": 0,
      "valueDatetime": "ISO-8601-or-null",
      "valueBoolean": true,
      "valueJson": {},
      "searchHash": "string-or-null",
      "sensitiveLevel": "string-or-null",
      "encrypted": false
    }
  ]
}
```

The controller resolves the tenant-bound runtime resource and completes the resource data-scope check before exposing current-task details to later validation. When the instance has a current task, the submission must bind that exact task, the task must already be claimed, and the authenticated employee must be its assignee. The C3 form service remains authoritative for published form version, process/node binding, typed values, idempotency and stale-version rejection.

## 4. Deliberately not exposed in C7

C3 field-level return remains implemented and tested in `WorkflowFormService`, but C7 does not expose a generic HTTP return endpoint yet. The approved submission model does not provide enough authoritative resource owner/org/position facts to prove a safe generic PHASE-04 data-scope target for that HTTP operation. C7 keeps the service capability and fails closed at the public API boundary rather than inventing ownership semantics.

Definition/version administration, SLA scheduler endpoints, orchestration business endpoints and P120–P126 golden paths are also outside C7.

## 5. Error semantics

- `400 BAD_REQUEST`: invalid or unsupported request shape, including forged authority fields or target-state fields.
- `403 FORBIDDEN`: authenticated caller lacks permission/data scope, or the workflow service rejects the actor as forbidden.
- `404 NOT_FOUND`: tenant-bound resource does not exist.
- `409 CONFLICT`: stale version/node/task, illegal transition, invalid workflow definition, immutable published version, no eligible approver or competing state.
- `503 SERVICE_UNAVAILABLE`: security audit persistence is unavailable through the existing PHASE-04 handler.

Workflow errors are returned as `application/problem+json` with `status`, workflow `code`, `detail` and `requestId`.

## 6. C7 verification contract

C7 is not complete until all of the following run on the exact candidate SHA:

1. controller contract tests prove principal-derived tenant/actor/identity;
2. forged `tenantId` / `actorId` and `targetState` / `targetNodeCode` fields are rejected before mutation;
3. wrong instance/task claim is rejected before assignment mutation;
4. runtime data-scope targets use persisted initiator/assignee facts and do not borrow caller org/position;
5. claim scope uses claimant employee/org/position but leaves ownership null, then delegates final eligibility to the C4 candidate resolver;
6. form submission on an unclaimed task fails closed after permission/data-scope validation and before persistence/audit mutation;
7. Spring Security integration proves unauthenticated workflow requests are `401` and authenticated sessions without workflow permission are `403`;
8. the existing C1–C6 Java/PostgreSQL regressions and completed Web regression remain green.
