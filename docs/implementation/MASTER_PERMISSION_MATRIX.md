# MASTER_PERMISSION_MATRIX

> 仅抽取源资料中可直接来源化的权限/角色/动作/数据范围/敏感/审批字段；无来源保持 UNKNOWN。

| Portal | Fragments |
| --- | --- |
| employee | 28767 |
| center | 36811 |
| tech | 29182 |

Machine: `contracts/phase-01/permissions.jsonl`

## PHASE-02 permission runtime status

- Business permission runtime: `NOT_IMPLEMENTED_IN_PHASE_02`.
- PHASE-01 sourced permission fragments remain authoritative; no new permission code, ABAC rule, RLS policy or approval power was invented.
- `tech` is a technical portal and is not a business super-administrator.

## PHASE-03 database technical role matrix

| Role | LOGIN | Superuser/CreateDB/CreateRole/Replication/BYPASSRLS | Database purpose |
|---|---|---|
| `sjg_owner` | NO | all NO | owns formal databases/Schemas/tables; runtime cannot log in as owner |
| `sjg_migration` | YES | all NO | independent Flyway execution; controlled membership allows `SET ROLE sjg_owner` |
| `sjg_api_runtime` | YES | all NO | OMS API runtime; no Schema CREATE / DDL |
| `sjg_worker_runtime` | YES | all NO | OMS Worker runtime; no Schema CREATE / DDL |
| `sjg_audit_writer` | YES | all NO | audit INSERT/SELECT only; UPDATE/DELETE/TRUNCATE denied |
| `sjg_auditor` | YES | all NO | audit read-only |
| `sjg_dw_writer` | YES | all NO | analytics load/write role only |
| `sjg_dw_reader` | YES | all NO | analytics read-only |

- `sjg_app` is retained only as a NOLOGIN compatibility role because approved audit DDL references it; new runtime code must not use it.
- These are technical database roles, not business approval permissions and not a substitute for later RBAC/ABAC/field permission implementation.

## PHASE-07 Design System permission status

- Source permission fragment counts remain unchanged; PHASE-07 adds no RBAC permission, ABAC expression, RLS policy, approval power or data-scope rule.
- `NoPermission` only renders an externally supplied denial result; it cannot infer or grant access.
- `MaskedValue` defaults to masked. `StepUpReveal` does not mount the revealed slot until the caller supplies `revealed=true` from an external authoritative security result; the component itself cannot authenticate or authorize.
- Technical portal remains non-super-admin by default; shared components contain no portal-specific privilege shortcut.

## PHASE-08 Portal Runtime permission status

- Source permission fragment counts remain unchanged. PHASE-08 creates **no new business permission code**, ABAC expression, RLS policy, approval power or data-scope rule.
- `SessionView.permissions` is server-supplied. Front-end `session.can()` / Router / navigation / Header checks are experience-layer filtering only and never substitute for server authorization.
- Sidebar / MobileBottomNav / `更多` only activate a business entry after canonical permission codes are all satisfied; multiple permissions are AND/fail-closed.
- `PortalSessionHeader` renders the identity switch control only when the current server session includes `platform.session.switch` and more than one server-authorized identity exists.
- Live C7 proves permission revocation after identity switch: the second synthetic identity lacks `platform.session.switch`; a subsequent switch attempt receives HTTP **403** and generates an `AUTHORIZATION_DENIED` security event.
- Old access credentials are rejected with HTTP **401** after refresh rotation and after identity switch.
- ABAC/data-scope facts remain backend-owned; identity switch refreshes the authoritative assignment/permission set instead of carrying old client privileges forward.
- PostgreSQL RLS remains the final tenant/data boundary and was not modified by PHASE-08.
- `tech` remains canonical technical portal with runtime alias `admin`; it receives no default business super-admin authority.
- Step-Up remains backend policy. Unified client can transport an explicitly approved Step-Up ticket/header contract but cannot create authorization by itself.

### C7 permission evidence

```text
Workflow: 31287803627 PASS
IAM PostgreSQL16/Redis7.4 regression job: 93179694053 PASS
Live browser integration job: 93179694059 PASS
AUTHORIZATION_DENIED events verified: 1
Credential material found in audit: 0
```
