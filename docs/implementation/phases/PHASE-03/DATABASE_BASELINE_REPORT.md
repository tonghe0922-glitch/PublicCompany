# PHASE-03 DATABASE BASELINE REPORT

> Deterministic source comparison. This report compares the current Knowledge Base data dictionary with the current approved DDL package; it does not silently reconcile differences.

## 1. Baseline counts

| Metric | Current actual |
|---|---:|
| Core databases | 3 |
| Physical database+Schema pairs declared by approved DDL | 46 |
| Unique table catalog entries | 265 |
| Unique approved DDL `CREATE TABLE` entries | 265 |
| Unique index catalog entries | 1024 |
| Unique approved DDL `CREATE [UNIQUE] INDEX` entries | 1019 |

## 2. Table catalog vs approved DDL

- Catalog-only: **0**
- DDL-only: **0**

### Catalog-only tables

- `NONE`

### DDL-only tables

- `NONE`

## 3. Index catalog vs approved DDL

- Catalog-only: **5**
- DDL-only: **0**

### Catalog-only indexes (`schema.table :: index`)

- `audit.access_log :: idx_audit_access_log_tenant`
- `audit.data_change_log :: idx_audit_data_change_log_tenant`
- `audit.operation_log :: idx_audit_operation_log_tenant`
- `audit.rule_execution_log :: idx_audit_rule_execution_log_tenant`
- `audit.security_event :: idx_audit_security_event_tenant`

### DDL-only indexes (`schema.table :: index`)

- `NONE`

## 4. PHASE-03 interpretation

- This phase installs the **approved DDL** through Flyway and proves the installed database matches those approved `CREATE TABLE` statements.
- Existing table/index catalog differences are preserved as source conflicts. PHASE-03 does not fabricate missing requirements or rewrite the approved DDL solely to make historic counts equal.
- The 46 physical Schema gate is counted as **database + Schema**, because the same Schema name may exist in more than one database.
- A later approved database/requirements decision must resolve any catalog-only or DDL-only objects if they are not intentional.

## 5. Machine-readable evidence

`docs/implementation/evidence/PHASE-03_STATIC_BASELINE.json`
