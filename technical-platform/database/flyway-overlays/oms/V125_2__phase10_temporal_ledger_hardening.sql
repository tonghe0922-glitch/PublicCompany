-- CXR-04: fail-closed temporal and append-only ledger hardening for P008/P009.
SET ROLE sjg_owner;

-- The P008 table is FORCE RLS. Temporarily let its owner inspect every tenant so
-- the upgrade preflight cannot mistake policy-filtered data for a clean ledger.
ALTER TABLE attendance.leave_quota_ledger NO FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM attendance.leave_request_item
     WHERE upper(field_code) = 'QUOTA_LEDGER'
  ) THEN
    RAISE EXCEPTION 'CXR-04 preflight: reserved QUOTA_LEDGER item rows exist'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1 FROM attendance.overtime_request_item
     WHERE upper(field_code) = 'TIME_OFF_LEDGER'
  ) THEN
    RAISE EXCEPTION 'CXR-04 preflight: reserved TIME_OFF_LEDGER item rows exist'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1 FROM attendance.shift_change_request
     WHERE actual_start_at IS NOT NULL AND actual_end_at < actual_start_at
    UNION ALL
    SELECT 1 FROM attendance.leave_request
     WHERE actual_start_at IS NOT NULL AND actual_end_at < actual_start_at
    UNION ALL
    SELECT 1 FROM attendance.overtime_request
     WHERE actual_start_at IS NOT NULL AND actual_end_at < actual_start_at
  ) THEN
    RAISE EXCEPTION 'CXR-04 preflight: reversed canonical actual interval exists'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    WITH ordered AS (
      SELECT available_after,
             reserved_after,
             consumed_after,
             sum(available_delta) OVER account_order AS expected_available,
             sum(reserved_delta) OVER account_order AS expected_reserved,
             sum(consumed_delta) OVER account_order AS expected_consumed
        FROM attendance.leave_quota_ledger
      WINDOW account_order AS (
        PARTITION BY tenant_id, employee_id, quota_account_id
        ORDER BY created_at, id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      )
    )
    SELECT 1 FROM ordered
     WHERE available_after IS DISTINCT FROM expected_available
        OR reserved_after IS DISTINCT FROM expected_reserved
        OR consumed_after IS DISTINCT FROM expected_consumed
  ) THEN
    RAISE EXCEPTION 'CXR-04 preflight: discontinuous P008 quota balance exists'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    WITH intervals AS (
      SELECT 'shift_change_request'::text AS source_table, id, tenant_id,
             owner_employee_id AS employee_id, actual_start_at AS starts_at,
             actual_end_at AS ends_at
        FROM attendance.shift_change_request
       WHERE NOT is_deleted AND owner_employee_id IS NOT NULL
         AND actual_start_at IS NOT NULL AND actual_end_at > actual_start_at
      UNION ALL
      SELECT 'leave_request', id, tenant_id, owner_employee_id,
             actual_start_at, actual_end_at
        FROM attendance.leave_request
       WHERE NOT is_deleted AND owner_employee_id IS NOT NULL
         AND actual_start_at IS NOT NULL AND actual_end_at > actual_start_at
      UNION ALL
      SELECT 'overtime_request', id, tenant_id, owner_employee_id,
             actual_start_at, actual_end_at
        FROM attendance.overtime_request
       WHERE NOT is_deleted AND owner_employee_id IS NOT NULL
         AND actual_start_at IS NOT NULL AND actual_end_at > actual_start_at
    )
    SELECT 1
      FROM intervals first_interval
      JOIN intervals second_interval
        ON second_interval.tenant_id = first_interval.tenant_id
       AND second_interval.employee_id = first_interval.employee_id
       AND (second_interval.source_table, second_interval.id)
           > (first_interval.source_table, first_interval.id)
       AND first_interval.starts_at < second_interval.ends_at
       AND second_interval.starts_at < first_interval.ends_at
  ) THEN
    RAISE EXCEPTION 'CXR-04 preflight: overlapping canonical actual intervals exist'
      USING ERRCODE = '23P01';
  END IF;
END
$$;

ALTER TABLE attendance.leave_quota_ledger
  DROP CONSTRAINT ck_p008_quota_delta_shape,
  ADD CONSTRAINT ck_p008_quota_delta_shape CHECK (
    (entry_type = 'GRANT' AND available_delta > 0
      AND reserved_delta = 0 AND consumed_delta = 0) OR
    (entry_type = 'RESERVE' AND available_delta < 0
      AND reserved_delta = -available_delta AND consumed_delta = 0) OR
    (entry_type = 'RELEASE' AND available_delta > 0
      AND reserved_delta = -available_delta AND consumed_delta = 0) OR
    (entry_type = 'DEDUCT' AND available_delta = 0
      AND reserved_delta < 0 AND consumed_delta = -reserved_delta) OR
    (entry_type = 'ADJUST' AND available_delta <> 0
      AND reserved_delta = 0 AND consumed_delta = -available_delta)
  );

CREATE OR REPLACE FUNCTION attendance.guard_p10_reserved_item_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF upper(NEW.field_code) = TG_ARGV[0] THEN
    RAISE EXCEPTION 'CXR-04 reserved item code % must use its formal ledger', TG_ARGV[0]
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER trg_cxr04_leave_reserved_item
BEFORE INSERT OR UPDATE OF field_code ON attendance.leave_request_item
FOR EACH ROW EXECUTE FUNCTION attendance.guard_p10_reserved_item_code('QUOTA_LEDGER');

CREATE TRIGGER trg_cxr04_overtime_reserved_item
BEFORE INSERT OR UPDATE OF field_code ON attendance.overtime_request_item
FOR EACH ROW EXECUTE FUNCTION attendance.guard_p10_reserved_item_code('TIME_OFF_LEDGER');

CREATE OR REPLACE FUNCTION attendance.guard_p008_quota_continuity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  expected_available numeric(18,6);
  expected_reserved numeric(18,6);
  expected_consumed numeric(18,6);
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    NEW.tenant_id::text || '|' || NEW.employee_id::text || '|' || NEW.quota_account_id,
    0
  ));

  SELECT coalesce(sum(available_delta), 0) + NEW.available_delta,
         coalesce(sum(reserved_delta), 0) + NEW.reserved_delta,
         coalesce(sum(consumed_delta), 0) + NEW.consumed_delta
    INTO expected_available, expected_reserved, expected_consumed
    FROM attendance.leave_quota_ledger
   WHERE tenant_id = NEW.tenant_id
     AND employee_id = NEW.employee_id
     AND quota_account_id = NEW.quota_account_id;

  IF NEW.available_after IS DISTINCT FROM expected_available
     OR NEW.reserved_after IS DISTINCT FROM expected_reserved
     OR NEW.consumed_after IS DISTINCT FROM expected_consumed THEN
    RAISE EXCEPTION 'CXR-04 P008 quota balance is not continuous'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER trg_cxr04_p008_quota_continuity
BEFORE INSERT ON attendance.leave_quota_ledger
FOR EACH ROW EXECUTE FUNCTION attendance.guard_p008_quota_continuity();

CREATE TABLE attendance.time_off_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL REFERENCES org.employee(id),
  entry_type varchar(16) NOT NULL,
  hours numeric(18,6) NOT NULL,
  balance_after numeric(18,6) NOT NULL,
  leave_started_at timestamptz NOT NULL,
  returned_at timestamptz NOT NULL,
  idempotency_key varchar(200) NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_p009_time_off_entry_type
    CHECK (entry_type IN ('ACCRUE', 'CONSUME', 'ADJUST', 'EXPIRE')),
  CONSTRAINT ck_p009_time_off_positive_hours CHECK (hours > 0),
  CONSTRAINT ck_p009_time_off_nonnegative_balance CHECK (balance_after >= 0),
  CONSTRAINT ck_p009_time_off_return_chronology CHECK (returned_at >= leave_started_at),
  CONSTRAINT uq_p009_time_off_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX ix_cxr04_time_off_employee
  ON attendance.time_off_ledger(tenant_id, employee_id, created_at, id);

CREATE OR REPLACE FUNCTION attendance.guard_p009_time_off_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM org.employee employee
     WHERE employee.id = NEW.employee_id
       AND employee.tenant_id = NEW.tenant_id
       AND NOT employee.is_deleted
  ) THEN
    RAISE EXCEPTION 'CXR-04 P009 time-off employee does not belong to tenant'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER trg_cxr04_p009_time_off_tenant
BEFORE INSERT ON attendance.time_off_ledger
FOR EACH ROW EXECUTE FUNCTION attendance.guard_p009_time_off_tenant();

CREATE OR REPLACE FUNCTION attendance.guard_p009_time_off_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'CXR-04 P009 time-off ledger is append-only'
    USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER trg_cxr04_p009_time_off_append_only
BEFORE UPDATE OR DELETE ON attendance.time_off_ledger
FOR EACH ROW EXECUTE FUNCTION attendance.guard_p009_time_off_append_only();

ALTER TABLE attendance.time_off_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance.time_off_ledger FORCE ROW LEVEL SECURITY;
CREATE POLICY p_tenant_cxr04_time_off_ledger ON attendance.time_off_ledger
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
GRANT SELECT, INSERT ON attendance.time_off_ledger TO sjg_api_runtime, sjg_worker_runtime;
REVOKE UPDATE, DELETE, TRUNCATE ON attendance.time_off_ledger
  FROM sjg_api_runtime, sjg_worker_runtime;

ALTER TABLE attendance.shift_change_request
  ADD CONSTRAINT ck_cxr04_shift_actual_chronology
  CHECK (actual_start_at IS NULL OR actual_end_at IS NULL OR actual_end_at >= actual_start_at);
ALTER TABLE attendance.leave_request
  ADD CONSTRAINT ck_cxr04_leave_actual_chronology
  CHECK (actual_start_at IS NULL OR actual_end_at IS NULL OR actual_end_at >= actual_start_at);
ALTER TABLE attendance.overtime_request
  ADD CONSTRAINT ck_cxr04_overtime_actual_chronology
  CHECK (actual_start_at IS NULL OR actual_end_at IS NULL OR actual_end_at >= actual_start_at);

CREATE INDEX ix_cxr04_shift_actual_interval
  ON attendance.shift_change_request(tenant_id, owner_employee_id, actual_start_at, actual_end_at, id)
  WHERE NOT is_deleted AND owner_employee_id IS NOT NULL
    AND actual_start_at IS NOT NULL AND actual_end_at IS NOT NULL;
CREATE INDEX ix_cxr04_leave_actual_interval
  ON attendance.leave_request(tenant_id, owner_employee_id, actual_start_at, actual_end_at, id)
  WHERE NOT is_deleted AND owner_employee_id IS NOT NULL
    AND actual_start_at IS NOT NULL AND actual_end_at IS NOT NULL;
CREATE INDEX ix_cxr04_overtime_actual_interval
  ON attendance.overtime_request(tenant_id, owner_employee_id, actual_start_at, actual_end_at, id)
  WHERE NOT is_deleted AND owner_employee_id IS NOT NULL
    AND actual_start_at IS NOT NULL AND actual_end_at IS NOT NULL;

CREATE OR REPLACE FUNCTION attendance.p10_temporal_conflict_exists(
  requested_tenant uuid,
  requested_employee uuid,
  requested_start timestamptz,
  requested_end timestamptz,
  excluded_table text,
  excluded_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN requested_tenant IS NULL OR requested_employee IS NULL
      OR requested_start IS NULL OR requested_end IS NULL
      OR requested_end <= requested_start THEN false
    ELSE EXISTS (
      SELECT 1 FROM attendance.shift_change_request request
       WHERE request.tenant_id = requested_tenant
         AND request.owner_employee_id = requested_employee
         AND NOT request.is_deleted
         AND request.actual_start_at IS NOT NULL
         AND request.actual_end_at > request.actual_start_at
         AND request.actual_start_at < requested_end
         AND requested_start < request.actual_end_at
         AND NOT (
           excluded_id IS NOT NULL
           AND excluded_table IN ('shift_change_request', 'attendance.shift_change_request')
           AND request.id = excluded_id
         )
      UNION ALL
      SELECT 1 FROM attendance.leave_request request
       WHERE request.tenant_id = requested_tenant
         AND request.owner_employee_id = requested_employee
         AND NOT request.is_deleted
         AND request.actual_start_at IS NOT NULL
         AND request.actual_end_at > request.actual_start_at
         AND request.actual_start_at < requested_end
         AND requested_start < request.actual_end_at
         AND NOT (
           excluded_id IS NOT NULL
           AND excluded_table IN ('leave_request', 'attendance.leave_request')
           AND request.id = excluded_id
         )
      UNION ALL
      SELECT 1 FROM attendance.overtime_request request
       WHERE request.tenant_id = requested_tenant
         AND request.owner_employee_id = requested_employee
         AND NOT request.is_deleted
         AND request.actual_start_at IS NOT NULL
         AND request.actual_end_at > request.actual_start_at
         AND request.actual_start_at < requested_end
         AND requested_start < request.actual_end_at
         AND NOT (
           excluded_id IS NOT NULL
           AND excluded_table IN ('overtime_request', 'attendance.overtime_request')
           AND request.id = excluded_id
         )
    )
  END
$$;

CREATE OR REPLACE FUNCTION attendance.guard_p10_temporal_conflict()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_deleted OR NEW.owner_employee_id IS NULL
     OR NEW.actual_start_at IS NULL OR NEW.actual_end_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.actual_end_at < NEW.actual_start_at THEN
    RAISE EXCEPTION 'CXR-04 canonical actual interval is reversed'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.actual_end_at = NEW.actual_start_at THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    NEW.tenant_id::text || '|p10-temporal|' || NEW.owner_employee_id::text,
    0
  ));

  IF attendance.p10_temporal_conflict_exists(
       NEW.tenant_id,
       NEW.owner_employee_id,
       NEW.actual_start_at,
       NEW.actual_end_at,
       TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
       NEW.id
     ) THEN
    RAISE EXCEPTION 'CXR-04 canonical actual interval overlaps an existing interval'
      USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER trg_cxr04_shift_temporal_conflict
BEFORE INSERT OR UPDATE ON attendance.shift_change_request
FOR EACH ROW EXECUTE FUNCTION attendance.guard_p10_temporal_conflict();
CREATE TRIGGER trg_cxr04_leave_temporal_conflict
BEFORE INSERT OR UPDATE ON attendance.leave_request
FOR EACH ROW EXECUTE FUNCTION attendance.guard_p10_temporal_conflict();
CREATE TRIGGER trg_cxr04_overtime_temporal_conflict
BEFORE INSERT OR UPDATE ON attendance.overtime_request
FOR EACH ROW EXECUTE FUNCTION attendance.guard_p10_temporal_conflict();

ALTER TABLE attendance.leave_quota_ledger FORCE ROW LEVEL SECURITY;

RESET ROLE;
