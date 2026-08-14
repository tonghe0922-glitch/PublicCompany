-- PHASE-10 / P007. Authority: raw P007 workbooks + frozen PHASE10 contracts.
-- S01 demand -> S02 template -> S03 qualification/work-hours -> S04 publish -> S05 employee confirm
-- -> S06 shift/substitution request -> S07 review -> S08 attendance/catering/shuttle linkage -> S09 day close.
SET ROLE sjg_owner;

INSERT INTO core.sequence_rule(id,tenant_id,rule_code,prefix_template,date_pattern,current_value,step,created_at,updated_at,is_deleted)
SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,'P007','P007-','yyyyMMdd',0,1,now(),now(),false
WHERE NOT EXISTS(select 1 from core.sequence_rule where tenant_id='${sjg_tenant_id}'::uuid and rule_code='P007' and not is_deleted);

INSERT INTO iam.permission(id,tenant_id,permission_code,permission_name,resource_type,action_code,risk_level,created_at,updated_at,is_deleted)
SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,v.code,v.name,'P007_SCHEDULE',v.action,v.risk,now(),now(),false
FROM (VALUES
 ('p007.schedule.read','读取排班与班次调整','READ','NORMAL'),('p007.schedule.manage','编制与发布排班','MANAGE','HIGH'),
 ('p007.schedule.change','确认并申请换班替班','CHANGE','NORMAL'),('p007.schedule.review','审批班次变更','REVIEW','HIGH'),
 ('p007.schedule.monitor','监控排班流程','MONITOR','NORMAL')
) v(code,name,action,risk)
WHERE NOT EXISTS(select 1 from iam.permission p where p.tenant_id='${sjg_tenant_id}'::uuid and p.permission_code=v.code and not p.is_deleted);

CREATE OR REPLACE FUNCTION attendance.guard_p007_evidence_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.field_code IN ('before_snapshot','after_snapshot','handover_items','qualification_check','employee_confirmation','review_rejection','integration_receipt','day_close') THEN
    RAISE EXCEPTION 'P007 schedule evidence is append-only' USING ERRCODE='55000';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS trg_p007_evidence_append_only ON attendance.shift_change_request_item;
CREATE TRIGGER trg_p007_evidence_append_only BEFORE UPDATE OR DELETE ON attendance.shift_change_request_item
FOR EACH ROW EXECUTE FUNCTION attendance.guard_p007_evidence_append_only();

DO $$
DECLARE d uuid; v uuid;
BEGIN
  SELECT id INTO d FROM workflow.wf_definition WHERE tenant_id='${sjg_tenant_id}'::uuid AND process_code='P007' AND enabled AND not is_deleted ORDER BY created_at,id LIMIT 1;
  IF d IS NULL THEN
    d:=gen_random_uuid();
    INSERT INTO workflow.wf_definition(id,tenant_id,process_code,process_name,module_code,owner_schema,owner_table,enabled,created_at,updated_at,is_deleted)
    VALUES(d,'${sjg_tenant_id}'::uuid,'P007','排班与班次调整','全员公共能力','attendance','shift_change_request',true,now(),now(),false);
  END IF;
  IF NOT EXISTS(select 1 from workflow.wf_version where tenant_id='${sjg_tenant_id}'::uuid and definition_id=d and status='PUBLISHED' and not is_deleted) THEN
    v:=gen_random_uuid();
    INSERT INTO workflow.wf_version(id,tenant_id,definition_id,version_no,status,definition_json,checksum,created_at,updated_at,is_deleted)
    VALUES(v,'${sjg_tenant_id}'::uuid,d,1,'DRAFT',
      '{"processCode":"P007","source":"PHASE10_SOURCE_CONTRACT","states":["S01","S02","S03","S04","S05","S06","S07","S08","S09","END"],"guards":["qualification","continuous-hours","time-overlap","append-only-snapshots"]}'::jsonb,
      'phase10-p007-source-flow-v1',now(),now(),false);
    INSERT INTO workflow.wf_node(id,tenant_id,version_id,node_code,node_name,node_type,actor_rule,sort_no,created_at,updated_at,is_deleted) VALUES
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S01','业务量与活动需求输入','START',NULL,10,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S02','班次模板匹配','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',20,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S03','资格与连续工时校验','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',30,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S04','主管发布排班','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',40,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S05','员工确认','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"targetEmployeeIds"}',50,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S06','换班/替班申请','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"targetEmployeeIds"}',60,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S07','变更审批','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"reviewerCandidateIds","allowInitiator":true}',70,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S08','考勤与餐饮/班车联动','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',80,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S09','日结','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',90,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'END','已日结','END',NULL,100,now(),now(),false);
    INSERT INTO workflow.wf_transition(id,tenant_id,version_id,from_node_code,action_code,to_node_code,condition_expr,is_rollback,created_at,updated_at,is_deleted) VALUES
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S01','SUBMIT_DEMAND','S02',NULL,false,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S01','WITHDRAW','END',NULL,false,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S02','MATCH_TEMPLATE','S03',NULL,false,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S02','RETURN','S01',NULL,true,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S03','VALIDATE','S04',NULL,false,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S03','RETURN','S02',NULL,true,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S04','PUBLISH','S05',NULL,false,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S04','RETURN','S03',NULL,true,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S05','CONFIRM','S06',NULL,false,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S06','REQUEST_CHANGE','S07',NULL,false,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S06','NO_CHANGE','S08',NULL,false,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S07','APPROVE','S08',NULL,false,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S07','REJECT','S06',NULL,true,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S08','LINK','S09',NULL,false,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S09','CLOSE_DAY','END',NULL,false,now(),now(),false);
    UPDATE workflow.wf_version SET status='PUBLISHED',effective_at=now(),updated_at=now() WHERE tenant_id='${sjg_tenant_id}'::uuid AND id=v AND status='DRAFT';
    IF NOT FOUND THEN RAISE EXCEPTION 'P007 workflow publish failed' USING ERRCODE='55000'; END IF;
  END IF;
  IF NOT EXISTS(select 1 from workflow.wf_form_definition where tenant_id='${sjg_tenant_id}'::uuid and form_code='CTR-P007-F01' and process_code='P007' and node_code='S01' and enabled and not is_deleted) THEN
    INSERT INTO workflow.wf_form_definition(id,tenant_id,form_code,form_name,process_code,node_code,version_no,field_schema,layout_schema,validation_schema,visibility_matrix,edit_matrix,enabled,created_at,updated_at,is_deleted)
    VALUES(gen_random_uuid(),'${sjg_tenant_id}'::uuid,'CTR-P007-F01','排班需求与班次计划登记单','P007','S01',1,
    '{"type":"object","properties":{"subject":{"type":"string","minLength":5,"maxLength":120},"reason":{"type":"string","minLength":10},"owner_employee_id":{"type":"string","format":"uuid"},"attendance_type":{"enum":["排班","换班","替班"]},"change_action":{"enum":["制定","换班","替班"]},"content_version":{"type":"string","maxLength":32},"period_or_course_no":{"type":"string","maxLength":32},"start_at":{"type":"string","format":"date-time"},"end_at":{"type":"string","format":"date-time"},"duration_hours":{"type":"number","minimum":0,"maximum":12}} ,"required":["subject","reason","owner_employee_id","attendance_type","change_action","content_version","period_or_course_no","start_at","end_at","duration_hours"]}'::jsonb,
    '{"sections":["需求输入","班次区间","资格版本"]}'::jsonb,
    '{"serverAuthoritative":["duration_hours","owner_center_id"],"guards":["active-employee","qualification","continuous-hours","time-overlap"]}'::jsonb,
    '{"employee":"SELF","center":"AUTHORIZED_SCOPE","tech":"METADATA_ONLY"}'::jsonb,
    '{"employee":[],"center":["subject","reason","owner_employee_id","attendance_type","change_action","content_version","period_or_course_no","start_at","end_at"],"tech":[]}'::jsonb,
    true,now(),now(),false);
  END IF;
END $$;

RESET ROLE;
