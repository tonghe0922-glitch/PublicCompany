-- PHASE-10 / P008 source-backed leave flow and append-only quota conservation ledger.
SET ROLE sjg_owner;

CREATE TABLE IF NOT EXISTS attendance.leave_quota_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, employee_id uuid NOT NULL,
  quota_account_id varchar(32) NOT NULL, leave_request_id uuid, entry_type varchar(16) NOT NULL,
  available_delta numeric(18,6) NOT NULL DEFAULT 0, reserved_delta numeric(18,6) NOT NULL DEFAULT 0,
  consumed_delta numeric(18,6) NOT NULL DEFAULT 0, available_after numeric(18,6) NOT NULL,
  reserved_after numeric(18,6) NOT NULL, consumed_after numeric(18,6) NOT NULL,
  idempotency_key varchar(200) NOT NULL, reason text, created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_p008_quota_entry CHECK(entry_type IN ('GRANT','RESERVE','RELEASE','DEDUCT','ADJUST')),
  CONSTRAINT ck_p008_quota_nonnegative CHECK(available_after>=0 AND reserved_after>=0 AND consumed_after>=0),
  CONSTRAINT ck_p008_quota_delta_shape CHECK(
    (entry_type='GRANT' AND available_delta>0 AND reserved_delta=0 AND consumed_delta=0) OR
    (entry_type='RESERVE' AND available_delta<0 AND reserved_delta=-available_delta AND consumed_delta=0) OR
    (entry_type='RELEASE' AND available_delta>0 AND reserved_delta=-available_delta AND consumed_delta=0) OR
    (entry_type='DEDUCT' AND available_delta=0 AND reserved_delta<0 AND consumed_delta=-reserved_delta) OR
    (entry_type='ADJUST' AND available_delta>0 AND reserved_delta=0 AND consumed_delta=-available_delta)
  ),
  CONSTRAINT uq_p008_quota_idem UNIQUE(tenant_id,idempotency_key),
  CONSTRAINT fk_p008_quota_leave FOREIGN KEY(leave_request_id) REFERENCES attendance.leave_request(id)
);
CREATE INDEX IF NOT EXISTS ix_p008_quota_account ON attendance.leave_quota_ledger(tenant_id,employee_id,quota_account_id,created_at,id);
CREATE OR REPLACE FUNCTION attendance.guard_p008_quota_leave_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.leave_request_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM attendance.leave_request r
    WHERE r.id=NEW.leave_request_id AND r.tenant_id=NEW.tenant_id AND r.owner_employee_id=NEW.employee_id
  ) THEN
    RAISE EXCEPTION 'P008 quota entry tenant/employee does not match leave request' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_p008_quota_leave_tenant ON attendance.leave_quota_ledger;
CREATE TRIGGER trg_p008_quota_leave_tenant BEFORE INSERT ON attendance.leave_quota_ledger FOR EACH ROW EXECUTE FUNCTION attendance.guard_p008_quota_leave_tenant();
CREATE OR REPLACE FUNCTION attendance.guard_p008_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'P008 evidence and quota ledger are append-only' USING ERRCODE='55000'; END $$;
DROP TRIGGER IF EXISTS trg_p008_quota_append_only ON attendance.leave_quota_ledger;
CREATE TRIGGER trg_p008_quota_append_only BEFORE UPDATE OR DELETE ON attendance.leave_quota_ledger FOR EACH ROW EXECUTE FUNCTION attendance.guard_p008_append_only();
DROP TRIGGER IF EXISTS trg_p008_leave_item_append_only ON attendance.leave_request_item;
CREATE TRIGGER trg_p008_leave_item_append_only BEFORE UPDATE OR DELETE ON attendance.leave_request_item FOR EACH ROW EXECUTE FUNCTION attendance.guard_p008_append_only();
ALTER TABLE attendance.leave_quota_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance.leave_quota_ledger FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_tenant_p008_quota_ledger ON attendance.leave_quota_ledger;
CREATE POLICY p_tenant_p008_quota_ledger ON attendance.leave_quota_ledger
  USING (tenant_id=current_setting('app.tenant_id',true)::uuid)
  WITH CHECK (tenant_id=current_setting('app.tenant_id',true)::uuid);
GRANT SELECT,INSERT ON attendance.leave_quota_ledger TO sjg_api_runtime,sjg_worker_runtime;
REVOKE UPDATE,DELETE,TRUNCATE ON attendance.leave_quota_ledger FROM sjg_api_runtime,sjg_worker_runtime;

INSERT INTO core.sequence_rule(id,tenant_id,rule_code,prefix_template,date_pattern,current_value,step,created_at,updated_at,is_deleted)
SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,'P008','P008-','yyyyMMdd',0,1,now(),now(),false WHERE NOT EXISTS(select 1 from core.sequence_rule where tenant_id='${sjg_tenant_id}'::uuid and rule_code='P008' and not is_deleted);
INSERT INTO iam.permission(id,tenant_id,permission_code,permission_name,resource_type,action_code,risk_level,created_at,updated_at,is_deleted)
SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,v.code,v.name,'P008_LEAVE',v.action,v.risk,now(),now(),false FROM (VALUES
 ('p008.leave.submit','提交请假与销假','SUBMIT','NORMAL'),('p008.leave.read','读取请假与额度流水','READ','NORMAL'),
 ('p008.leave.review','审批请假','REVIEW','HIGH'),('p008.leave.manage','管理额度与考勤闭环','MANAGE','HIGH'),
 ('p008.leave.monitor','监控请假流程','MONITOR','NORMAL'))v(code,name,action,risk)
WHERE NOT EXISTS(select 1 from iam.permission p where p.tenant_id='${sjg_tenant_id}'::uuid and p.permission_code=v.code and not p.is_deleted);

DO $$ DECLARE d uuid;v uuid; BEGIN
 SELECT id INTO d FROM workflow.wf_definition WHERE tenant_id='${sjg_tenant_id}'::uuid AND process_code='P008' AND enabled AND not is_deleted ORDER BY created_at,id LIMIT 1;
 IF d IS NULL THEN d:=gen_random_uuid();INSERT INTO workflow.wf_definition(id,tenant_id,process_code,process_name,module_code,owner_schema,owner_table,enabled,created_at,updated_at,is_deleted) VALUES(d,'${sjg_tenant_id}'::uuid,'P008','请假与考勤','全员公共能力','attendance','leave_request',true,now(),now(),false);END IF;
 IF NOT EXISTS(select 1 from workflow.wf_version where tenant_id='${sjg_tenant_id}'::uuid and definition_id=d and status='PUBLISHED' and not is_deleted) THEN
  v:=gen_random_uuid();INSERT INTO workflow.wf_version(id,tenant_id,definition_id,version_no,status,definition_json,checksum,created_at,updated_at,is_deleted) VALUES(v,'${sjg_tenant_id}'::uuid,d,1,'DRAFT','{"processCode":"P008","states":["S01","S02","S03","S04","S05","S06","S07","S08","S09","S10","END"],"guards":["time-overlap","append-only-quota-conservation","independent-review"]}'::jsonb,'phase10-p008-source-flow-v1',now(),now(),false);
  INSERT INTO workflow.wf_node(id,tenant_id,version_id,node_code,node_name,node_type,actor_rule,sort_no,created_at,updated_at,is_deleted) VALUES
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S01','请假申请','START',NULL,10,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S02','假期额度预占','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds"}',20,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S03','工作交接与代理','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"targetEmployeeIds","allowInitiator":true}',30,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S04','审批','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"reviewerCandidateIds"}',40,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S05','预占转扣减/驳回释放','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds"}',50,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S06','排班与考勤标记','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds"}',60,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S07','实际休假','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds"}',70,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S08','销假/提前返岗/变更','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"targetEmployeeIds","allowInitiator":true}',80,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S09','差额账本调整','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds"}',90,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S10','考勤日结与归档','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds"}',100,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'END','已关闭','END',NULL,110,now(),now(),false);
  INSERT INTO workflow.wf_transition(id,tenant_id,version_id,from_node_code,action_code,to_node_code,condition_expr,is_rollback,created_at,updated_at,is_deleted) VALUES
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S01','SUBMIT','S02',NULL,false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S01','WITHDRAW','END',NULL,false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S02','RESERVE','S03',NULL,false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S02','RETURN','S01',NULL,true,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S03','CONFIRM_HANDOVER','S04',NULL,false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S03','RETURN','S01',NULL,true,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S04','APPROVE','S05',NULL,false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S04','REJECT','S05',NULL,false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S05','DEDUCT','S06',NULL,false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S05','RELEASE','END',NULL,false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S06','MARK_ATTENDANCE','S07',NULL,false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S07','START_LEAVE','S08',NULL,false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S08','RETURN','S09',NULL,false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S08','EARLY_RETURN','S09',NULL,false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S08','CHANGE','S09',NULL,false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S09','ADJUST','S10',NULL,false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S10','CLOSE_DAY','END',NULL,false,now(),now(),false);
  UPDATE workflow.wf_version SET status='PUBLISHED',effective_at=now(),updated_at=now() WHERE tenant_id='${sjg_tenant_id}'::uuid AND id=v AND status='DRAFT';
 END IF;
 IF NOT EXISTS(select 1 from workflow.wf_form_definition where tenant_id='${sjg_tenant_id}'::uuid and form_code='EMP-P008-F01' and process_code='P008' and node_code='S01' and enabled and not is_deleted) THEN
  INSERT INTO workflow.wf_form_definition(id,tenant_id,form_code,form_name,process_code,node_code,version_no,field_schema,layout_schema,validation_schema,visibility_matrix,edit_matrix,enabled,created_at,updated_at,is_deleted) VALUES(gen_random_uuid(),'${sjg_tenant_id}'::uuid,'EMP-P008-F01','请假申请登记单','P008','S01',1,
  '{"type":"object","properties":{"subject":{"type":"string","minLength":5},"reason":{"type":"string","minLength":10},"attendance_type":{"type":"string"},"start_at":{"type":"string","format":"date-time"},"end_at":{"type":"string","format":"date-time"},"quota_account_id":{"type":"string"},"quota_amount":{"type":"number","exclusiveMinimum":0}},"required":["subject","reason","attendance_type","start_at","end_at","quota_account_id","quota_amount"]}'::jsonb,
  '{"sections":["请假事项","时间与额度"]}'::jsonb,'{"serverAuthoritative":["owner_employee_id","duration_hours","quota_amount"],"guards":["time-overlap","available-quota"]}'::jsonb,'{"employee":"SELF","center":"AUTHORIZED_SCOPE","tech":"METADATA_ONLY"}'::jsonb,'{"employee":["subject","reason","attendance_type","start_at","end_at","quota_account_id"],"center":[],"tech":[]}'::jsonb,true,now(),now(),false);
 END IF;
END $$;

RESET ROLE;
