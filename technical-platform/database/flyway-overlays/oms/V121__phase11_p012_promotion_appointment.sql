-- PHASE-11 / P012 source-backed promotion and appointment lifecycle.
SET ROLE sjg_owner;

-- The source field dictionary defines the 1000-point assessment result.  Keep it
-- on the canonical request row so optimistic-lock reads and the immutable event
-- fact are committed in the same transaction.
ALTER TABLE hr.promotion_request ADD COLUMN score_1000 bigint;
ALTER TABLE hr.promotion_request ADD CONSTRAINT ck_p012_score_1000 CHECK(score_1000 IS NULL OR score_1000 BETWEEN 0 AND 1000);

CREATE TABLE hr.promotion_request_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  request_id uuid NOT NULL,
  event_seq integer NOT NULL,
  event_type varchar(40) NOT NULL,
  evidence jsonb NOT NULL,
  actor_employee_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_p012_event_request FOREIGN KEY(request_id) REFERENCES hr.promotion_request(id) ON DELETE RESTRICT,
  CONSTRAINT uk_p012_event_seq UNIQUE(tenant_id,request_id,event_seq),
  CONSTRAINT ck_p012_event_evidence CHECK(jsonb_typeof(evidence)='object')
);
CREATE INDEX ix_p012_event_request ON hr.promotion_request_event(tenant_id,request_id,created_at);
ALTER TABLE hr.promotion_request_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_tenant_promotion_request_event ON hr.promotion_request_event
  USING (tenant_id=current_setting('app.tenant_id',true)::uuid)
  WITH CHECK (tenant_id=current_setting('app.tenant_id',true)::uuid);

CREATE TABLE hr.promotion_appointment_execution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  request_id uuid NOT NULL,
  execution_type varchar(24) NOT NULL,
  target_position_id uuid NOT NULL,
  previous_appointment_id uuid,
  new_appointment_id uuid,
  effective_date date NOT NULL,
  salary_confirmation_reference varchar(128),
  external_reference varchar(128) NOT NULL,
  evidence jsonb NOT NULL,
  executed_by uuid NOT NULL,
  executed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_p012_execution_request FOREIGN KEY(request_id) REFERENCES hr.promotion_request(id) ON DELETE RESTRICT,
  CONSTRAINT fk_p012_execution_position FOREIGN KEY(target_position_id) REFERENCES org.position(id) ON DELETE RESTRICT,
  CONSTRAINT fk_p012_execution_previous FOREIGN KEY(previous_appointment_id) REFERENCES org.employee_position(id) ON DELETE RESTRICT,
  CONSTRAINT fk_p012_execution_new FOREIGN KEY(new_appointment_id) REFERENCES org.employee_position(id) ON DELETE RESTRICT,
  CONSTRAINT uk_p012_execution_type UNIQUE(tenant_id,request_id,execution_type),
  CONSTRAINT uk_p012_execution_external UNIQUE(tenant_id,external_reference),
  CONSTRAINT ck_p012_execution_type CHECK(execution_type IN ('CONFIRMED','EFFECTIVE','ROLLED_BACK')),
  CONSTRAINT ck_p012_execution_reference CHECK(length(trim(external_reference)) BETWEEN 3 AND 128),
  CONSTRAINT ck_p012_execution_salary CHECK(execution_type<>'CONFIRMED' OR length(trim(salary_confirmation_reference)) BETWEEN 3 AND 128),
  CONSTRAINT ck_p012_execution_shape CHECK(
    (execution_type='CONFIRMED' AND previous_appointment_id IS NULL AND new_appointment_id IS NULL)
    OR (execution_type='EFFECTIVE' AND previous_appointment_id IS NOT NULL AND new_appointment_id IS NOT NULL)
    OR (execution_type='ROLLED_BACK' AND previous_appointment_id IS NOT NULL AND new_appointment_id IS NULL)
  ),
  CONSTRAINT ck_p012_execution_evidence CHECK(jsonb_typeof(evidence)='object')
);
ALTER TABLE hr.promotion_appointment_execution ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_tenant_promotion_appointment_execution ON hr.promotion_appointment_execution
  USING (tenant_id=current_setting('app.tenant_id',true)::uuid)
  WITH CHECK (tenant_id=current_setting('app.tenant_id',true)::uuid);

CREATE OR REPLACE FUNCTION hr.guard_p012_fact_tenant() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,hr,org AS $$
DECLARE actor_id uuid; target_id uuid; appointment_id uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM hr.promotion_request r WHERE r.id=NEW.request_id AND r.tenant_id=NEW.tenant_id AND NOT r.is_deleted)
  THEN RAISE EXCEPTION 'P012 fact references request outside its tenant' USING ERRCODE='23514'; END IF;
  IF TG_TABLE_NAME='promotion_request_event' THEN actor_id:=NEW.actor_employee_id;
  ELSE actor_id:=NEW.executed_by; END IF;
  IF NOT EXISTS(SELECT 1 FROM org.employee e WHERE e.id=actor_id AND e.tenant_id=NEW.tenant_id AND NOT e.is_deleted)
  THEN RAISE EXCEPTION 'P012 fact references actor outside its tenant' USING ERRCODE='23514'; END IF;
  IF TG_TABLE_NAME='promotion_appointment_execution' THEN
    target_id:=NEW.target_position_id;
    IF NOT EXISTS(SELECT 1 FROM org.position p WHERE p.id=target_id AND p.tenant_id=NEW.tenant_id AND NOT p.is_deleted)
    THEN RAISE EXCEPTION 'P012 execution references position outside its tenant' USING ERRCODE='23514'; END IF;
    FOREACH appointment_id IN ARRAY ARRAY[NEW.previous_appointment_id,NEW.new_appointment_id] LOOP
      IF appointment_id IS NOT NULL AND NOT EXISTS(
        SELECT 1 FROM org.employee_position ep WHERE ep.id=appointment_id AND ep.tenant_id=NEW.tenant_id AND NOT ep.is_deleted)
      THEN RAISE EXCEPTION 'P012 execution references appointment outside its tenant' USING ERRCODE='23514'; END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_p012_event_tenant BEFORE INSERT OR UPDATE ON hr.promotion_request_event FOR EACH ROW EXECUTE FUNCTION hr.guard_p012_fact_tenant();
CREATE TRIGGER trg_p012_execution_tenant BEFORE INSERT OR UPDATE ON hr.promotion_appointment_execution FOR EACH ROW EXECUTE FUNCTION hr.guard_p012_fact_tenant();

CREATE OR REPLACE FUNCTION hr.guard_p012_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'P012 promotion event and appointment execution facts are append-only' USING ERRCODE='55000'; END $$;
CREATE TRIGGER trg_p012_event_append_only BEFORE UPDATE OR DELETE ON hr.promotion_request_event FOR EACH ROW EXECUTE FUNCTION hr.guard_p012_append_only();
CREATE TRIGGER trg_p012_execution_append_only BEFORE UPDATE OR DELETE ON hr.promotion_appointment_execution FOR EACH ROW EXECUTE FUNCTION hr.guard_p012_append_only();
REVOKE UPDATE,DELETE,TRUNCATE ON hr.promotion_request_event,hr.promotion_appointment_execution FROM sjg_api_runtime,sjg_worker_runtime;
GRANT SELECT,INSERT ON hr.promotion_request_event,hr.promotion_appointment_execution TO sjg_api_runtime;
GRANT SELECT ON hr.promotion_request_event,hr.promotion_appointment_execution TO sjg_worker_runtime;

INSERT INTO core.sequence_rule(id,tenant_id,rule_code,prefix_template,date_pattern,current_value,step,created_at,updated_at,is_deleted)
SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,'P012','P012-','yyyyMMdd',0,1,now(),now(),false
WHERE NOT EXISTS(SELECT 1 FROM core.sequence_rule WHERE tenant_id='${sjg_tenant_id}'::uuid AND rule_code='P012' AND NOT is_deleted);

INSERT INTO iam.permission(id,tenant_id,permission_code,permission_name,resource_type,action_code,risk_level,created_at,updated_at,is_deleted)
SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,v.code,v.name,'P012_PROMOTION',v.action,v.risk,now(),now(),false FROM (VALUES
 ('p012.promotion.read','Read own promotion request','READ','NORMAL'),
 ('p012.promotion.manage','Manage promotion qualification and vacancy','MANAGE','HIGH'),
 ('p012.promotion.review','Assess and review promotion','REVIEW','HIGH'),
 ('p012.promotion.approve','Approve promotion decision','APPROVE','CRITICAL'),
 ('p012.promotion.appoint','Record appointment and execute effective assignment','APPOINT','CRITICAL'),
 ('p012.promotion.monitor','Monitor promotion workflow metadata','MONITOR','NORMAL'))v(code,name,action,risk)
WHERE NOT EXISTS(SELECT 1 FROM iam.permission p WHERE p.tenant_id='${sjg_tenant_id}'::uuid AND p.permission_code=v.code AND NOT p.is_deleted);

DO $$ DECLARE v_definition_id uuid; v_version_id uuid; BEGIN
 SELECT id INTO v_definition_id FROM workflow.wf_definition WHERE tenant_id='${sjg_tenant_id}'::uuid AND process_code='P012' AND enabled AND NOT is_deleted ORDER BY created_at,id LIMIT 1;
 IF v_definition_id IS NULL THEN
  v_definition_id:=gen_random_uuid();
  INSERT INTO workflow.wf_definition(id,tenant_id,process_code,process_name,module_code,owner_schema,owner_table,enabled,created_at,updated_at,is_deleted)
  VALUES(v_definition_id,'${sjg_tenant_id}'::uuid,'P012','Promotion and appointment development','Performance growth welfare','hr','promotion_request',true,now(),now(),false);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM workflow.wf_version wv WHERE wv.tenant_id='${sjg_tenant_id}'::uuid AND wv.definition_id=v_definition_id AND wv.status='PUBLISHED' AND NOT wv.is_deleted) THEN
  v_version_id:=gen_random_uuid();
  INSERT INTO workflow.wf_version(id,tenant_id,definition_id,version_no,status,definition_json,checksum,created_at,updated_at,is_deleted)
  VALUES(v_version_id,'${sjg_tenant_id}'::uuid,v_definition_id,1,'DRAFT','{"processCode":"P012","states":["S01","S02","S03","S04","S05","S06","S07","S08","S09","S10","END"],"guards":["approval-is-not-effective","vacancy-and-budget-required","review-approval-separation","salary-reference-only","atomic-appointment-or-rollback"]}'::jsonb,'phase11-p012-source-flow-v1',now(),now(),false);
  INSERT INTO workflow.wf_node(id,tenant_id,version_id,node_code,node_name,node_type,actor_rule,sort_no,created_at,updated_at,is_deleted) VALUES
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S01','Application or nomination','START',NULL,10,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S02','Eligibility and freeze review','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',20,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S03','1000-point comprehensive assessment','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"reviewerCandidateIds"}',30,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S04','Vacancy and budget verification','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',40,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S05','Competition and review','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"reviewerCandidateIds"}',50,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S06','Approval','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"approverCandidateIds"}',60,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S07','Publication and notice','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',70,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S08','Appointment and salary confirmation','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"appointmentCandidateIds"}',80,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S09','Validation period','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"reviewerCandidateIds"}',90,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S10','Effective assignment or rollback','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"appointerCandidateIds"}',100,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'END','Closed','END',NULL,110,now(),now(),false);
  INSERT INTO workflow.wf_transition(id,tenant_id,version_id,from_node_code,action_code,to_node_code,is_rollback,created_at,updated_at,is_deleted) VALUES
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S01','SUBMIT','S02',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S02','CHECK_ELIGIBILITY','S03',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S03','RECORD_ASSESSMENT','S04',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S04','VERIFY_VACANCY_BUDGET','S05',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S05','COMPLETE_REVIEW','S06',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S06','APPROVE','S07',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S07','COMPLETE_NOTICE','S08',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S08','RECORD_APPOINTMENT','S08',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S08','CONFIRM_APPOINTMENT','S09',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S09','COMPLETE_PROBATION','S10',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S10','MAKE_EFFECTIVE','END',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S10','ROLL_BACK','END',false,now(),now(),false);
  UPDATE workflow.wf_version SET status='PUBLISHED',effective_at=now(),updated_at=now() WHERE tenant_id='${sjg_tenant_id}'::uuid AND id=v_version_id;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM workflow.wf_form_definition WHERE tenant_id='${sjg_tenant_id}'::uuid AND form_code='EMP-P012-F01' AND process_code='P012' AND node_code='S01' AND enabled AND NOT is_deleted) THEN
  INSERT INTO workflow.wf_form_definition(id,tenant_id,form_code,form_name,process_code,node_code,version_no,field_schema,layout_schema,validation_schema,visibility_matrix,edit_matrix,enabled,created_at,updated_at,is_deleted)
  VALUES(gen_random_uuid(),'${sjg_tenant_id}'::uuid,'EMP-P012-F01','Promotion application or nomination','P012','S01',1,
  '{"type":"object","properties":{"subject":{"type":"string","minLength":5},"owner_employee_id":{"type":"string","format":"uuid"},"target_position_code":{"type":"string"},"planned_effective_date":{"type":"string","format":"date"}},"required":["subject","owner_employee_id","target_position_code","planned_effective_date"]}'::jsonb,
  '{"sections":["Application","Target appointment","Evidence"]}'::jsonb,
  '{"serverAuthoritative":["workflow_instance_id","appointment_execution","employee_position"],"guards":["approval-not-effective","salary-reference-only","atomic-appointment"]}'::jsonb,
  '{"employee":"SELF","center":"AUTHORIZED_SCOPE","tech":"METADATA_ONLY"}'::jsonb,
  '{"employee":["subject","reason","target_position_code","planned_effective_date"],"center":["owner_employee_id","headcount_no"],"tech":[]}'::jsonb,true,now(),now(),false);
 END IF;
END $$;

RESET ROLE;
