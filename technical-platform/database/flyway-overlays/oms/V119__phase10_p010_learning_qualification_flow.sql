-- PHASE-10 / P010 source-backed learning, examination, practical certification and qualification flow.
SET ROLE sjg_owner;

CREATE TABLE IF NOT EXISTS learning.learning_assignment_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, assignment_id uuid NOT NULL,
  event_seq integer NOT NULL, event_type varchar(32) NOT NULL, evidence jsonb NOT NULL,
  actor_employee_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_p010_event_assignment FOREIGN KEY (assignment_id) REFERENCES learning.learning_assignment(id) ON DELETE RESTRICT,
  CONSTRAINT uk_p010_event_seq UNIQUE(tenant_id,assignment_id,event_seq),
  CONSTRAINT ck_p010_event_evidence_object CHECK (jsonb_typeof(evidence)='object')
);
CREATE INDEX IF NOT EXISTS ix_p010_event_assignment ON learning.learning_assignment_event(tenant_id,assignment_id,created_at);
ALTER TABLE learning.learning_assignment_event ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_tenant_learning_assignment_event ON learning.learning_assignment_event;
CREATE POLICY p_tenant_learning_assignment_event ON learning.learning_assignment_event USING (tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK (tenant_id=current_setting('app.tenant_id',true)::uuid);

CREATE TABLE IF NOT EXISTS learning.qualification_permission_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, course_version_id varchar(64) NOT NULL,
  permission_id uuid NOT NULL, data_scope_code varchar(64) NOT NULL DEFAULT 'SELF', enabled boolean NOT NULL DEFAULT false,
  approval_reference varchar(128) NOT NULL, approved_by uuid NOT NULL, approved_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_p010_policy_permission FOREIGN KEY(permission_id) REFERENCES iam.permission(id) ON DELETE RESTRICT,
  CONSTRAINT uk_p010_policy_course_permission UNIQUE(tenant_id,course_version_id,permission_id),
  CONSTRAINT ck_p010_policy_approval CHECK(length(trim(approval_reference)) between 3 and 128)
);
ALTER TABLE learning.qualification_permission_policy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_tenant_qualification_permission_policy ON learning.qualification_permission_policy;
CREATE POLICY p_tenant_qualification_permission_policy ON learning.qualification_permission_policy USING (tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK (tenant_id=current_setting('app.tenant_id',true)::uuid);

CREATE TABLE IF NOT EXISTS learning.qualification_permission_grant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, assignment_id uuid NOT NULL,
  policy_id uuid NOT NULL, employee_id uuid NOT NULL, user_id uuid NOT NULL, identity_id uuid NOT NULL,
  permission_id uuid NOT NULL, data_scope_code varchar(64) NOT NULL, effective_start_date date NOT NULL,
  effective_end_date date NOT NULL, execution_status varchar(16) NOT NULL DEFAULT 'ACTIVE',
  executed_by uuid NOT NULL, executed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_p010_grant_assignment FOREIGN KEY(assignment_id) REFERENCES learning.learning_assignment(id) ON DELETE RESTRICT,
  CONSTRAINT fk_p010_grant_policy FOREIGN KEY(policy_id) REFERENCES learning.qualification_permission_policy(id) ON DELETE RESTRICT,
  CONSTRAINT fk_p010_grant_permission FOREIGN KEY(permission_id) REFERENCES iam.permission(id) ON DELETE RESTRICT,
  CONSTRAINT uk_p010_grant_assignment_policy UNIQUE(tenant_id,assignment_id,policy_id),
  CONSTRAINT ck_p010_grant_dates CHECK(effective_end_date>=effective_start_date),
  CONSTRAINT ck_p010_grant_status CHECK(execution_status IN ('ACTIVE','EXPIRED','REVOKED'))
);
CREATE INDEX IF NOT EXISTS ix_p010_grant_authorization ON learning.qualification_permission_grant(tenant_id,user_id,identity_id,effective_start_date,effective_end_date) WHERE execution_status='ACTIVE';
ALTER TABLE learning.qualification_permission_grant ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_tenant_qualification_permission_grant ON learning.qualification_permission_grant;
CREATE POLICY p_tenant_qualification_permission_grant ON learning.qualification_permission_grant USING (tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK (tenant_id=current_setting('app.tenant_id',true)::uuid);

CREATE OR REPLACE FUNCTION learning.guard_p010_event_tenant_integrity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,learning,org AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM learning.learning_assignment a
    JOIN org.employee e ON e.id=NEW.actor_employee_id AND e.tenant_id=NEW.tenant_id
    WHERE a.id=NEW.assignment_id AND a.tenant_id=NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'P010 event references records outside its tenant' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_p010_event_tenant_integrity ON learning.learning_assignment_event;
CREATE TRIGGER trg_p010_event_tenant_integrity BEFORE INSERT OR UPDATE ON learning.learning_assignment_event FOR EACH ROW EXECUTE FUNCTION learning.guard_p010_event_tenant_integrity();

CREATE OR REPLACE FUNCTION learning.guard_p010_policy_tenant_integrity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,learning,iam,org AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM iam.permission p
    JOIN org.employee e ON e.id=NEW.approved_by AND e.tenant_id=NEW.tenant_id
    WHERE p.id=NEW.permission_id AND p.tenant_id=NEW.tenant_id AND NOT p.is_deleted
  ) THEN
    RAISE EXCEPTION 'P010 permission policy references records outside its tenant' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_p010_policy_tenant_integrity ON learning.qualification_permission_policy;
CREATE TRIGGER trg_p010_policy_tenant_integrity BEFORE INSERT OR UPDATE ON learning.qualification_permission_policy FOR EACH ROW EXECUTE FUNCTION learning.guard_p010_policy_tenant_integrity();

CREATE OR REPLACE FUNCTION learning.guard_p010_grant_tenant_integrity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,learning,iam,org AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM learning.learning_assignment a
    JOIN learning.qualification_permission_policy p
      ON p.id=NEW.policy_id AND p.tenant_id=NEW.tenant_id
      AND p.enabled AND p.permission_id=NEW.permission_id
      AND p.data_scope_code=NEW.data_scope_code AND p.course_version_id=a.course_version_id
    JOIN iam.permission pm
      ON pm.id=NEW.permission_id AND pm.tenant_id=NEW.tenant_id AND NOT pm.is_deleted
    JOIN org.employee learner
      ON learner.id=NEW.employee_id AND learner.tenant_id=NEW.tenant_id
    JOIN org.employee executor
      ON executor.id=NEW.executed_by AND executor.tenant_id=NEW.tenant_id
    JOIN iam.user_account u
      ON u.id=NEW.user_id AND u.tenant_id=NEW.tenant_id AND NOT u.is_deleted
    JOIN iam.user_identity i
      ON i.id=NEW.identity_id AND i.tenant_id=NEW.tenant_id
      AND i.user_id=NEW.user_id AND i.employee_id=NEW.employee_id AND NOT i.is_deleted
    WHERE a.id=NEW.assignment_id AND a.tenant_id=NEW.tenant_id
      AND a.qualification_effective_date IS NOT NULL
      AND a.qualification_expire_date IS NOT NULL
      AND NEW.effective_start_date>=a.qualification_effective_date
      AND NEW.effective_end_date<=a.qualification_expire_date
  ) THEN
    RAISE EXCEPTION 'P010 executed grant is not backed by a same-tenant approved qualification policy' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_p010_grant_tenant_integrity ON learning.qualification_permission_grant;
CREATE TRIGGER trg_p010_grant_tenant_integrity BEFORE INSERT OR UPDATE ON learning.qualification_permission_grant FOR EACH ROW EXECUTE FUNCTION learning.guard_p010_grant_tenant_integrity();

CREATE OR REPLACE FUNCTION learning.guard_p010_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'P010 qualification evidence and executed grants are append-only' USING ERRCODE='55000'; END $$;
DROP TRIGGER IF EXISTS trg_p010_event_append_only ON learning.learning_assignment_event;
CREATE TRIGGER trg_p010_event_append_only BEFORE UPDATE OR DELETE ON learning.learning_assignment_event FOR EACH ROW EXECUTE FUNCTION learning.guard_p010_append_only();
DROP TRIGGER IF EXISTS trg_p010_grant_append_only ON learning.qualification_permission_grant;
CREATE TRIGGER trg_p010_grant_append_only BEFORE UPDATE OR DELETE ON learning.qualification_permission_grant FOR EACH ROW EXECUTE FUNCTION learning.guard_p010_append_only();
REVOKE UPDATE,DELETE,TRUNCATE ON learning.learning_assignment_event,learning.qualification_permission_grant FROM sjg_api_runtime,sjg_worker_runtime;

INSERT INTO core.sequence_rule(id,tenant_id,rule_code,prefix_template,date_pattern,current_value,step,created_at,updated_at,is_deleted)
SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,'P010','P010-','yyyyMMdd',0,1,now(),now(),false WHERE NOT EXISTS(select 1 from core.sequence_rule where tenant_id='${sjg_tenant_id}'::uuid and rule_code='P010' and not is_deleted);
INSERT INTO iam.permission(id,tenant_id,permission_code,permission_name,resource_type,action_code,risk_level,created_at,updated_at,is_deleted)
SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,v.code,v.name,'P010_LEARNING',v.action,v.risk,now(),now(),false FROM (VALUES
 ('p010.learning.read','Read learning assignments and qualifications','READ','NORMAL'),
 ('p010.learning.manage','Publish, assign, activate and archive learning','MANAGE','HIGH'),
 ('p010.learning.complete','Complete assigned learning','COMPLETE','NORMAL'),
 ('p010.learning.exam','Submit 1000-point examination','EXAM','NORMAL'),
 ('p010.learning.certify','Record practical result and certify qualification','CERTIFY','HIGH'),
 ('p010.learning.link','Execute approved qualification permission policy','LINK','HIGH'),
 ('p010.learning.monitor','Monitor learning workflow metadata','MONITOR','NORMAL'))v(code,name,action,risk)
WHERE NOT EXISTS(select 1 from iam.permission p where p.tenant_id='${sjg_tenant_id}'::uuid and p.permission_code=v.code and not p.is_deleted);

DO $$ DECLARE d uuid;v uuid; BEGIN
 SELECT id INTO d FROM workflow.wf_definition WHERE tenant_id='${sjg_tenant_id}'::uuid AND process_code='P010' AND enabled AND not is_deleted ORDER BY created_at,id LIMIT 1;
 IF d IS NULL THEN d:=gen_random_uuid();INSERT INTO workflow.wf_definition(id,tenant_id,process_code,process_name,module_code,owner_schema,owner_table,enabled,created_at,updated_at,is_deleted) VALUES(d,'${sjg_tenant_id}'::uuid,'P010','Employee learning, examination and qualification','Common capability','learning','learning_assignment',true,now(),now(),false);END IF;
 IF NOT EXISTS(select 1 from workflow.wf_version where tenant_id='${sjg_tenant_id}'::uuid and definition_id=d and status='PUBLISHED' and not is_deleted) THEN
  v:=gen_random_uuid();INSERT INTO workflow.wf_version(id,tenant_id,definition_id,version_no,status,definition_json,checksum,created_at,updated_at,is_deleted) VALUES(v,'${sjg_tenant_id}'::uuid,d,1,'DRAFT','{"processCode":"P010","states":["S01","S02","S03","S04","S05","S06","S07","S08","S09","S10","END"],"guards":["score-0-1000","independent-certification","approved-permission-policy","qualification-expiry"]}'::jsonb,'phase10-p010-source-flow-v1',now(),now(),false);
  INSERT INTO workflow.wf_node(id,tenant_id,version_id,node_code,node_name,node_type,actor_rule,sort_no,created_at,updated_at,is_deleted) VALUES
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S01','Course or policy version publication','START',NULL,10,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S02','Assignment by position risk','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',20,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S03','Employee learning','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"learnerIds","allowInitiator":true}',30,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S04','1000-point online examination','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"learnerIds","allowInitiator":true}',40,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S05','Offline practical assessment','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"certifierCandidateIds"}',50,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S06','Supervisor or professional certification','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"certifierCandidateIds"}',60,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S07','Qualification effective','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',70,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S08','Position permission linkage','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"linkerCandidateIds"}',80,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S09','Expiry retraining or recertification scheduling','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',90,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S10','Archive','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',100,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'END','Closed','END',NULL,110,now(),now(),false);
  INSERT INTO workflow.wf_transition(id,tenant_id,version_id,from_node_code,action_code,to_node_code,is_rollback,created_at,updated_at,is_deleted) VALUES
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S01','PUBLISH','S02',false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S02','ASSIGN','S03',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S03','COMPLETE_LEARNING','S04',false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S04','SUBMIT_EXAM','S05',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S05','RECORD_PRACTICAL','S06',false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S06','CERTIFY','S07',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S07','ACTIVATE','S08',false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S08','LINK_PERMISSION','S09',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S09','SCHEDULE_RECERTIFICATION','S10',false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S10','ARCHIVE','END',false,now(),now(),false);
  UPDATE workflow.wf_version SET status='PUBLISHED',effective_at=now(),updated_at=now() WHERE tenant_id='${sjg_tenant_id}'::uuid AND id=v;
 END IF;
 IF NOT EXISTS(select 1 from workflow.wf_form_definition where tenant_id='${sjg_tenant_id}'::uuid and form_code='CTR-P010-F01' and process_code='P010' and node_code='S01' and enabled and not is_deleted) THEN
  INSERT INTO workflow.wf_form_definition(id,tenant_id,form_code,form_name,process_code,node_code,version_no,field_schema,layout_schema,validation_schema,visibility_matrix,edit_matrix,enabled,created_at,updated_at,is_deleted) VALUES(gen_random_uuid(),'${sjg_tenant_id}'::uuid,'CTR-P010-F01','Learning assignment publication','P010','S01',1,
  '{"type":"object","properties":{"subject":{"type":"string","minLength":5},"course_version_id":{"type":"string"},"content_version":{"type":"string"},"period_or_course_no":{"type":"string"},"owner_employee_id":{"type":"string","format":"uuid"}},"required":["subject","course_version_id","content_version","period_or_course_no","owner_employee_id"]}'::jsonb,
  '{"sections":["Course version","Target learner","Qualification lifecycle"]}'::jsonb,'{"serverAuthoritative":["workflow_instance_id","qualification_permission_grants"],"guards":["approved-policy-only","independent-certification"]}'::jsonb,'{"employee":"SELF","center":"AUTHORIZED_SCOPE","tech":"METADATA_ONLY"}'::jsonb,'{"employee":[],"center":["subject","course_version_id","content_version","period_or_course_no","owner_employee_id"],"tech":[]}'::jsonb,true,now(),now(),false);
 END IF;
END $$;

RESET ROLE;
