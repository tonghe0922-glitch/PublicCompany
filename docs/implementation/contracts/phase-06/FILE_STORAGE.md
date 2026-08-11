# PHASE-06 C3｜File / Attachment / MinIO 工程合同

> Scope: `PLATFORM/基础工程`
> Ownership: engineering-owned platform contract derived from approved `document.file_object / document.attachment_link` and PHASE-06 DoW.

## 1. Source facts and minimal overlay

Approved V16 Document DDL already owns file identity, object key, original name, MIME, byte size, SHA256, storage bucket, encryption reference, virus scan status, retention and legal hold. Attachment links own business type/id/field/file/type/order/evidence.

PHASE-06 explicitly requires file sensitivity + version, while approved V16 has no physical columns. C3 therefore introduces only:

- `document.file_object.sensitive_level varchar(32) NOT NULL DEFAULT 'P1_INTERNAL'`;
- `document.file_object.version_no integer NOT NULL DEFAULT 1 CHECK(version_no > 0)`.

`P1_INTERNAL` is an engineering token mapping the approved V16 file-object comments `敏感级别:P1-内部`. No business classification taxonomy is invented by C3.

## 2. Object storage truth

Binary content is stored in MinIO/S3-compatible storage through `FileObjectStorage`; metadata truth remains PostgreSQL `document.file_object`.

`MinioFileObjectStorage` uses the official Java SDK for real put/stat/presigned-get/remove operations. It does not fall back to local filesystem, memory, browser storage or a fixed-success provider.

Object keys are generated from tenant UUID + file UUID, never from the original filename, preventing path/key injection through user filenames.

## 3. Upload integrity

Upload requires an active tenant database transaction. The service:

1. validates non-empty content and bounded metadata;
2. computes SHA-256 server side;
3. uploads bytes to MinIO;
4. writes `document.file_object` with `virus_scan_status='PENDING'`;
5. registers transaction-completion cleanup so a database rollback removes the just-uploaded object.

MinIO and PostgreSQL are not falsely described as one XA transaction. Reconciliation remains responsible for rare object-delete failure after rollback.

## 4. Scan state and SAFE gate

Allowed scan transitions:

```text
PENDING -> SCANNING
SCANNING -> SAFE | INFECTED | FAILED
FAILED -> SCANNING
SAFE -> terminal
INFECTED -> terminal
```

Formal business attachment binding and signed download both require current `virus_scan_status='SAFE'`. `PENDING`, `SCANNING`, `FAILED` and `INFECTED` fail closed.

C3 establishes the state machine and safety gate; scanner-provider implementation can drive `transitionScan` without weakening the gate.

## 5. Attachment evidence

`bindAttachment` reuses approved `document.attachment_link`. The file row is locked and checked SAFE before link creation. RLS and explicit tenant predicates prevent cross-tenant file binding.

## 6. Signed download and sensitive boundary

Presigned GET TTL is bounded to 1 second–15 minutes. Before generating a URL the service:

- re-reads tenant-scoped PostgreSQL metadata;
- requires SAFE;
- invokes `FileDownloadGuard`;
- verifies object-store byte size matches database metadata;
- then asks MinIO for the signed URL.

`FileDownloadGuard` is deliberately mandatory. C3 never treats a logged-in session as sufficient for sensitive download. C7 wires this guard to explicit permission/Step-Up/immutable audit policy.

## 7. Required validation

- V103 migrates on PostgreSQL 16 and exposes sensitivity/version with RLS unchanged;
- PENDING/INFECTED files cannot bind or download;
- legal PENDING→SCANNING→SAFE can bind evidence;
- another tenant cannot see the file through runtime RLS;
- real MinIO container passes put/stat/presigned HTTP GET/remove;
- SHA256 is deterministic and stored from server-computed bytes;
- prior C2 Outbox/Inbox and PHASE-05 PostgreSQL regressions remain green.
