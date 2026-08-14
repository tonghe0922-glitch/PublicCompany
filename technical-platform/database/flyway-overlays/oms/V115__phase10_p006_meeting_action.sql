-- PHASE-10 / P006. Authority: PHASE10_SOURCE_CONTRACT + 15 raw Knowledge Base workbooks.
-- Exact state sequence: S01 issue -> S02 completeness -> S03 publish -> S04 attendance -> S05 convene
-- -> S06 minutes -> S07 action generation -> S08 execution -> S09 acceptance/rework -> S10 overdue -> S11 archive.
SET ROLE sjg_owner;

INSERT INTO core.sequence_rule(id,tenant_id,rule_code,prefix_template,date_pattern,current_value,step,created_at,updated_at,is_deleted)
SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,'P006','P006-','yyyyMMdd',0,1,now(),now(),false
WHERE NOT EXISTS(select 1 from core.sequence_rule where tenant_id='${sjg_tenant_id}'::uuid and rule_code='P006' and not is_deleted);

INSERT INTO iam.permission(id,tenant_id,permission_code,permission_name,resource_type,action_code,risk_level,created_at,updated_at,is_deleted)
SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,v.code,v.name,'P006_MEETING',v.action,v.risk,now(),now(),false
FROM (VALUES
 ('p006.meeting.create','创建会议议题','CREATE','NORMAL'),('p006.meeting.read','读取会议与行动项','READ','NORMAL'),
 ('p006.meeting.manage','管理会议流程','MANAGE','HIGH'),('p006.meeting.action','执行签到与行动项','ACTION','NORMAL'),
 ('p006.meeting.accept','独立验收行动项','ACCEPT','HIGH'),('p006.meeting.monitor','监控会议流程','MONITOR','NORMAL')
) v(code,name,action,risk)
WHERE NOT EXISTS(select 1 from iam.permission p where p.tenant_id='${sjg_tenant_id}'::uuid and p.permission_code=v.code and not p.is_deleted);

CREATE OR REPLACE FUNCTION collaboration.guard_p006_evidence_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.field_code IN ('action_items','execution_evidence','acceptance_evidence','overdue_escalation','archive_review') THEN
    RAISE EXCEPTION 'P006 meeting evidence is append-only' USING ERRCODE='55000';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS trg_p006_evidence_append_only ON collaboration.meeting_item;
CREATE TRIGGER trg_p006_evidence_append_only BEFORE UPDATE OR DELETE ON collaboration.meeting_item
FOR EACH ROW EXECUTE FUNCTION collaboration.guard_p006_evidence_append_only();

DO $$
DECLARE d uuid; v uuid;
BEGIN
  SELECT id INTO d FROM workflow.wf_definition WHERE tenant_id='${sjg_tenant_id}'::uuid AND process_code='P006' AND enabled AND not is_deleted ORDER BY created_at,id LIMIT 1;
  IF d IS NULL THEN
    d:=gen_random_uuid();
    INSERT INTO workflow.wf_definition(id,tenant_id,process_code,process_name,module_code,owner_schema,owner_table,enabled,created_at,updated_at,is_deleted)
    VALUES(d,'${sjg_tenant_id}'::uuid,'P006','会议与行动项','全员公共能力','collaboration','meeting',true,now(),now(),false);
  END IF;
  IF NOT EXISTS(select 1 from workflow.wf_version where tenant_id='${sjg_tenant_id}'::uuid and definition_id=d and status='PUBLISHED' and not is_deleted) THEN
    v:=gen_random_uuid();
    INSERT INTO workflow.wf_version(id,tenant_id,definition_id,version_no,status,definition_json,checksum,created_at,updated_at,is_deleted)
    VALUES(v,'${sjg_tenant_id}'::uuid,d,1,'DRAFT',
      '{"processCode":"P006","source":"PHASE10_SOURCE_CONTRACT","states":["S01","S02","S03","S04","S05","S06","S07","S08","S09","S10","S11","END"],"guards":["append-only-action-evidence","independent-execution-acceptance","controlled-rework"]}'::jsonb,
      'phase10-p006-source-flow-v1',now(),now(),false);
    INSERT INTO workflow.wf_node(id,tenant_id,version_id,node_code,node_name,node_type,actor_rule,sort_no,created_at,updated_at,is_deleted) VALUES
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S01','议题征集','START',NULL,10,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S02','材料完整性检查','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds"}',20,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S03','会议发布','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds"}',30,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S04','签到与请假','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"executorCandidateIds","allowInitiator":true}',40,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S05','会议召开','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds"}',50,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S06','主持人确认纪要','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds"}',60,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S07','行动项生成','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds"}',70,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S08','责任人执行','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"executorCandidateIds","allowInitiator":true}',80,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S09','验收与返工','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"acceptorCandidateIds"}',90,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S10','逾期升级','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds"}',100,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S11','归档复盘','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds"}',110,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'END','已归档','END',NULL,120,now(),now(),false);
    INSERT INTO workflow.wf_transition(id,tenant_id,version_id,from_node_code,action_code,to_node_code,condition_expr,is_rollback,created_at,updated_at,is_deleted) VALUES
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S01','SUBMIT','S02',NULL,false,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S01','WITHDRAW','END',NULL,false,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S02','ACCEPT','S03',NULL,false,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S02','RETURN','S01',NULL,true,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S02','REJECT','END',NULL,false,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S03','PUBLISH','S04',NULL,false,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S03','RETURN','S02',NULL,true,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S03','REJECT','END',NULL,false,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S04','RECORD_ATTENDANCE','S05',NULL,false,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S05','CONVENE','S06',NULL,false,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S06','CONFIRM_MINUTES','S07',NULL,false,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S06','RETURN','S05',NULL,true,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S07','GENERATE_ACTIONS','S08',NULL,false,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S08','SUBMIT_EXECUTION','S09',NULL,false,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S09','ACCEPT_RESULT','S10',NULL,false,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S09','REWORK','S08',NULL,true,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S10','ACKNOWLEDGE_OVERDUE','S11',NULL,false,now(),now(),false),
    (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S11','ARCHIVE','END',NULL,false,now(),now(),false);
    UPDATE workflow.wf_version SET status='PUBLISHED',effective_at=now(),updated_at=now() WHERE tenant_id='${sjg_tenant_id}'::uuid AND id=v AND status='DRAFT';
    IF NOT FOUND THEN RAISE EXCEPTION 'P006 workflow publish failed' USING ERRCODE='55000'; END IF;
  END IF;
  IF NOT EXISTS(select 1 from workflow.wf_form_definition where tenant_id='${sjg_tenant_id}'::uuid and form_code='EMP-P006-F01' and process_code='P006' and node_code='S01' and enabled and not is_deleted) THEN
    INSERT INTO workflow.wf_form_definition(id,tenant_id,form_code,form_name,process_code,node_code,version_no,field_schema,layout_schema,validation_schema,visibility_matrix,edit_matrix,enabled,created_at,updated_at,is_deleted)
    VALUES(gen_random_uuid(),'${sjg_tenant_id}'::uuid,'EMP-P006-F01','会议议题登记单','P006','S01',1,
    '{"type":"object","properties":{"process_instance_no":{"type":"string","readOnly":true},"process_code":{"type":"string","readOnly":true},"form_code":{"type":"string","readOnly":true},"official_subject":{"type":"string","maxLength":200},"official_content":{"type":"string","maxLength":20000},"subject":{"type":"string","minLength":5,"maxLength":120},"reason":{"type":"string","minLength":10},"business_date":{"type":"string","format":"date"},"priority":{"enum":["普通","加急","紧急"]},"visibility_level":{"enum":["公开","内部","秘密","机密"]},"venue_channel":{"type":"string","maxLength":500}},"required":["official_subject","official_content","subject","reason","business_date","priority","visibility_level"]}'::jsonb,
    '{"sections":["系统标识","议题登记","会议安排"]}'::jsonb,'{"serverAuthoritative":["process_instance_no","process_code","form_code"]}'::jsonb,
    '{"employee":"SELF","center":"AUTHORIZED_SCOPE","tech":"METADATA_ONLY"}'::jsonb,
    '{"employee":["official_subject","official_content","subject","reason","business_date","priority","visibility_level","venue_channel"],"center":[],"tech":[]}'::jsonb,
    true,now(),now(),false);
  END IF;
END $$;

RESET ROLE;
