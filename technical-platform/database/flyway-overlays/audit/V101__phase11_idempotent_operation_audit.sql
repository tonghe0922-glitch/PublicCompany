-- CXR-07: bind mutating PHASE-11 audit rows to the logical command key.
-- Existing read/monitor audit rows remain nullable and retain append-only semantics.

SET ROLE sjg_owner;

ALTER TABLE audit.operation_log
    ADD COLUMN idempotency_key varchar(128);

CREATE UNIQUE INDEX ux_audit_operation_log_idempotent_command
    ON audit.operation_log (tenant_id, action, resource_type, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN audit.operation_log.idempotency_key IS
    '逻辑命令幂等键｜仅写操作审计使用；NULL保留既有读取/监控审计语义';

RESET ROLE;
