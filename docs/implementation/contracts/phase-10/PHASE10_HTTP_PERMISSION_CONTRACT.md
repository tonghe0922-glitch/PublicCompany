# PHASE-10 HTTP / PERMISSION ENGINEERING CONTRACT

> These HTTP paths and permission identifiers are **engineering identifiers**, because PHASE-01 contains zero canonical business HTTP path records. Business roles, state order, data scope and sensitive-field semantics remain authoritative from P006–P010 XLSX.

## Shared rules

- every write requires authenticated session + backend permission/data scope + `Idempotency-Key` + request hash;
- `actionCode` is a server-mapped source workflow command, never a free target status;
- stale version/node => 409; invalid action => fail closed; cross-scope => 403/404 by policy;
- Tech monitor permissions never imply business review/accept/certify permissions;
- P2/P3 data is minimum-projection/masked; export/Step-Up follows source rules.

## P006 — meeting / action items

HTTP:
- `POST /api/v1/processes/P006/meetings`
- `GET /api/v1/processes/P006/meetings`
- `GET /api/v1/processes/P006/meetings/{id}`
- `POST /api/v1/processes/P006/meetings/{id}/actions/{actionCode}`

Permissions: `p006.meeting.create`, `p006.meeting.read`, `p006.meeting.manage`, `p006.meeting.action`, `p006.meeting.accept`, `p006.meeting.monitor`.

## P007 — schedule / shift change

HTTP:
- `GET /api/v1/processes/P007/schedules`
- `POST /api/v1/processes/P007/shift-changes`
- `GET /api/v1/processes/P007/shift-changes`
- `GET /api/v1/processes/P007/shift-changes/{id}`
- `POST /api/v1/processes/P007/shift-changes/{id}/actions/{actionCode}`

Permissions: `p007.schedule.read`, `p007.schedule.manage`, `p007.schedule.change`, `p007.schedule.review`, `p007.schedule.monitor`.

## P008 — leave / quota ledger

HTTP:
- `POST /api/v1/processes/P008/leaves`
- `GET /api/v1/processes/P008/leaves`
- `GET /api/v1/processes/P008/leaves/{id}`
- `GET /api/v1/processes/P008/quota-ledger`
- `POST /api/v1/processes/P008/leaves/{id}/actions/{actionCode}`

Permissions: `p008.leave.submit`, `p008.leave.read`, `p008.leave.review`, `p008.leave.manage`, `p008.leave.monitor`.

## P009 — overtime / time off

HTTP:
- `POST /api/v1/processes/P009/overtime-requests`
- `GET /api/v1/processes/P009/overtime-requests`
- `GET /api/v1/processes/P009/overtime-requests/{id}`
- `POST /api/v1/processes/P009/overtime-requests/{id}/actions/{actionCode}`

Permissions: `p009.overtime.submit`, `p009.overtime.read`, `p009.overtime.review`, `p009.overtime.hr`, `p009.overtime.manage`, `p009.overtime.monitor`.

## P010 — learning / exam / qualification

HTTP:
- `GET /api/v1/processes/P010/assignments`
- `GET /api/v1/processes/P010/assignments/{id}`
- `POST /api/v1/processes/P010/assignments/{id}/learning-progress`
- `POST /api/v1/processes/P010/assignments/{id}/exam`
- `POST /api/v1/processes/P010/assignments/{id}/practical`
- `POST /api/v1/processes/P010/assignments/{id}/actions/{actionCode}`

Permissions: `p010.learning.read`, `p010.learning.manage`, `p010.learning.complete`, `p010.learning.exam`, `p010.learning.certify`, `p010.learning.monitor`.

`p010.learning.certify` belongs only to source-authorized supervisor/professional roles. Tech support/monitor roles must not receive it merely because they operate the platform.
