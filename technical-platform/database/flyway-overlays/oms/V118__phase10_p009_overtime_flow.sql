-- PHASE-10 / P009 source-backed overtime, factual attendance, HR scheme and payroll receipt flow.
SET ROLE sjg_owner;

CREATE INDEX IF NOT EXISTS ix_p009_overtime_interval ON attendance.overtime_request(tenant_id,owner_employee_id,start_at,end_at) WHERE NOT is_deleted;
CREATE OR REPLACE FUNCTION attendance.guard_p009_item_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'P009 factual, HR and payroll receipt evidence is append-only' USING ERRCODE='55000'; END $$;
DROP TRIGGER IF EXISTS trg_p009_overtime_item_append_only ON attendance.overtime_request_item;
CREATE TRIGGER trg_p009_overtime_item_append_only BEFORE UPDATE OR DELETE ON attendance.overtime_request_item FOR EACH ROW EXECUTE FUNCTION attendance.guard_p009_item_append_only();
REVOKE UPDATE,DELETE,TRUNCATE ON attendance.overtime_request_item FROM sjg_api_runtime,sjg_worker_runtime;

INSERT INTO core.sequence_rule(id,tenant_id,rule_code,prefix_template,date_pattern,current_value,step,created_at,updated_at,is_deleted)
SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,'P009','P009-','yyyyMMdd',0,1,now(),now(),false WHERE NOT EXISTS(select 1 from core.sequence_rule where tenant_id='${sjg_tenant_id}'::uuid and rule_code='P009' and not is_deleted);
INSERT INTO iam.permission(id,tenant_id,permission_code,permission_name,resource_type,action_code,risk_level,created_at,updated_at,is_deleted)
SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,v.code,v.name,'P009_OVERTIME',v.action,v.risk,now(),now(),false FROM (VALUES
 ('p009.overtime.submit','提交加班与调休申请','SUBMIT','NORMAL'),('p009.overtime.read','读取加班与调休记录','READ','NORMAL'),
 ('p009.overtime.review','主管审批与成果验收','REVIEW','HIGH'),('p009.overtime.hr','人事复核与方案确认','HR','HIGH'),
 ('p009.overtime.manage','考勤事实与归档管理','MANAGE','HIGH'),('p009.overtime.monitor','监控加班流程','MONITOR','NORMAL'))v(code,name,action,risk)
WHERE NOT EXISTS(select 1 from iam.permission p where p.tenant_id='${sjg_tenant_id}'::uuid and p.permission_code=v.code and not p.is_deleted);

DO $$ DECLARE d uuid;v uuid; BEGIN
 SELECT id INTO d FROM workflow.wf_definition WHERE tenant_id='${sjg_tenant_id}'::uuid AND process_code='P009' AND enabled AND not is_deleted ORDER BY created_at,id LIMIT 1;
 IF d IS NULL THEN d:=gen_random_uuid();INSERT INTO workflow.wf_definition(id,tenant_id,process_code,process_name,module_code,owner_schema,owner_table,enabled,created_at,updated_at,is_deleted) VALUES(d,'${sjg_tenant_id}'::uuid,'P009','加班与调休','全员公共能力','attendance','overtime_request',true,now(),now(),false);END IF;
 IF NOT EXISTS(select 1 from workflow.wf_version where tenant_id='${sjg_tenant_id}'::uuid and definition_id=d and status='PUBLISHED' and not is_deleted) THEN
  v:=gen_random_uuid();INSERT INTO workflow.wf_version(id,tenant_id,definition_id,version_no,status,definition_json,checksum,created_at,updated_at,is_deleted) VALUES(v,'${sjg_tenant_id}'::uuid,d,1,'DRAFT','{"processCode":"P009","states":["S01","S02","S03","S04","S05","S06","S07","S08","S09","END"],"guards":["time-overlap","independent-review","factual-attendance-before-result","external-payroll-receipt-only"]}'::jsonb,'phase10-p009-source-flow-v1',now(),now(),false);
  INSERT INTO workflow.wf_node(id,tenant_id,version_id,node_code,node_name,node_type,actor_rule,sort_no,created_at,updated_at,is_deleted) VALUES
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S01','事前申请/紧急事实登记','START',NULL,10,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S02','必要性与任务校验','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds"}',20,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S03','主管审批','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"reviewerCandidateIds"}',30,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S04','实际考勤与劳动事实','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds"}',40,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S05','成果验收','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"reviewerCandidateIds"}',50,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S06','人事复核','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"hrCandidateIds"}',60,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S07','法定工资/调休方案','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"targetEmployeeIds","allowInitiator":true}',70,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S08','薪酬回执','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"hrCandidateIds"}',80,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S09','归档','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds"}',90,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'END','已关闭','END',NULL,100,now(),now(),false);
  INSERT INTO workflow.wf_transition(id,tenant_id,version_id,from_node_code,action_code,to_node_code,condition_expr,is_rollback,created_at,updated_at,is_deleted) VALUES
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S01','SUBMIT','S02',NULL,false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S01','WITHDRAW','END',NULL,false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S02','VALIDATE','S03',NULL,false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S02','RETURN','S01',NULL,true,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S03','APPROVE','S04',NULL,false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S03','REJECT','END',NULL,false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S04','RECORD_FACT','S05',NULL,false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S05','ACCEPT_RESULT','S06',NULL,false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S05','REWORK','S04',NULL,true,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S06','HR_CONFIRM','S07',NULL,false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S06','HR_RETURN','S05',NULL,true,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S07','CONFIRM_SCHEME','S08',NULL,false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S08','RECORD_RECEIPT','S09',NULL,false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S09','ARCHIVE','END',NULL,false,now(),now(),false);
  UPDATE workflow.wf_version SET status='PUBLISHED',effective_at=now(),updated_at=now() WHERE tenant_id='${sjg_tenant_id}'::uuid AND id=v AND status='DRAFT';
 END IF;
 IF NOT EXISTS(select 1 from workflow.wf_form_definition where tenant_id='${sjg_tenant_id}'::uuid and form_code='EMP-P009-F01' and process_code='P009' and node_code='S01' and enabled and not is_deleted) THEN
  INSERT INTO workflow.wf_form_definition(id,tenant_id,form_code,form_name,process_code,node_code,version_no,field_schema,layout_schema,validation_schema,visibility_matrix,edit_matrix,enabled,created_at,updated_at,is_deleted) VALUES(gen_random_uuid(),'${sjg_tenant_id}'::uuid,'EMP-P009-F01','加班事前申请/紧急事实登记','P009','S01',1,
  '{"type":"object","properties":{"subject":{"type":"string","minLength":5},"reason":{"type":"string","minLength":10},"attendance_type":{"type":"string"},"start_at":{"type":"string","format":"date-time"},"end_at":{"type":"string","format":"date-time"},"emergency":{"type":"boolean"}},"required":["subject","reason","attendance_type","start_at","end_at","emergency"]}'::jsonb,
  '{"sections":["加班任务","计划区间","紧急事实"]}'::jsonb,'{"serverAuthoritative":["owner_employee_id","duration_hours"],"guards":["time-overlap","emergency-evidence"]}'::jsonb,'{"employee":"SELF","center":"AUTHORIZED_SCOPE","tech":"METADATA_ONLY"}'::jsonb,'{"employee":["subject","reason","attendance_type","start_at","end_at","emergency"],"center":[],"tech":[]}'::jsonb,true,now(),now(),false);
 END IF;
END $$;

RESET ROLE;
