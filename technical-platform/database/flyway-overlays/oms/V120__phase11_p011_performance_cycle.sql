-- PHASE-11 / P011 source-backed performance lifecycle with independent score types.
SET ROLE sjg_owner;

CREATE TABLE performance.performance_score_fact (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  cycle_id uuid NOT NULL,
  score_seq integer NOT NULL,
  score_type varchar(32) NOT NULL,
  score_1000 bigint NOT NULL,
  evidence jsonb NOT NULL,
  actor_employee_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_p011_score_cycle FOREIGN KEY(cycle_id) REFERENCES performance.performance_cycle(id) ON DELETE RESTRICT,
  CONSTRAINT uk_p011_score_seq UNIQUE(tenant_id,cycle_id,score_seq),
  CONSTRAINT uk_p011_score_type UNIQUE(tenant_id,cycle_id,score_type),
  CONSTRAINT ck_p011_score_type CHECK(score_type IN ('EMPLOYEE_SELF','SUPERVISOR','SYSTEM_CALCULATED','CALIBRATED')),
  CONSTRAINT ck_p011_score_range CHECK(score_1000 BETWEEN 0 AND 1000),
  CONSTRAINT ck_p011_score_evidence CHECK(jsonb_typeof(evidence)='object')
);
CREATE INDEX ix_p011_score_cycle ON performance.performance_score_fact(tenant_id,cycle_id,created_at);
ALTER TABLE performance.performance_score_fact ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_tenant_performance_score_fact ON performance.performance_score_fact
  USING (tenant_id=current_setting('app.tenant_id',true)::uuid)
  WITH CHECK (tenant_id=current_setting('app.tenant_id',true)::uuid);

CREATE TABLE performance.performance_cycle_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  cycle_id uuid NOT NULL,
  event_seq integer NOT NULL,
  event_type varchar(32) NOT NULL,
  evidence jsonb NOT NULL,
  actor_employee_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_p011_event_cycle FOREIGN KEY(cycle_id) REFERENCES performance.performance_cycle(id) ON DELETE RESTRICT,
  CONSTRAINT uk_p011_event_seq UNIQUE(tenant_id,cycle_id,event_seq),
  CONSTRAINT ck_p011_event_evidence CHECK(jsonb_typeof(evidence)='object')
);
CREATE INDEX ix_p011_event_cycle ON performance.performance_cycle_event(tenant_id,cycle_id,created_at);
ALTER TABLE performance.performance_cycle_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_tenant_performance_cycle_event ON performance.performance_cycle_event
  USING (tenant_id=current_setting('app.tenant_id',true)::uuid)
  WITH CHECK (tenant_id=current_setting('app.tenant_id',true)::uuid);

CREATE TABLE performance.performance_effect_execution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  cycle_id uuid NOT NULL,
  execution_type varchar(32) NOT NULL,
  external_reference varchar(128) NOT NULL,
  execution_status varchar(16) NOT NULL DEFAULT 'RECORDED',
  evidence jsonb NOT NULL,
  executed_by uuid NOT NULL,
  executed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_p011_effect_cycle FOREIGN KEY(cycle_id) REFERENCES performance.performance_cycle(id) ON DELETE RESTRICT,
  CONSTRAINT uk_p011_effect_type UNIQUE(tenant_id,cycle_id,execution_type),
  CONSTRAINT ck_p011_effect_type CHECK(execution_type IN ('DEVELOPMENT_PLAN','PERFORMANCE_IMPROVEMENT','EXTERNAL_HR_REFERENCE')),
  CONSTRAINT ck_p011_effect_status CHECK(execution_status='RECORDED'),
  CONSTRAINT ck_p011_effect_reference CHECK(length(trim(external_reference)) BETWEEN 3 AND 128),
  CONSTRAINT ck_p011_effect_evidence CHECK(jsonb_typeof(evidence)='object')
);
ALTER TABLE performance.performance_effect_execution ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_tenant_performance_effect_execution ON performance.performance_effect_execution
  USING (tenant_id=current_setting('app.tenant_id',true)::uuid)
  WITH CHECK (tenant_id=current_setting('app.tenant_id',true)::uuid);

CREATE OR REPLACE FUNCTION performance.guard_p011_fact_tenant() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,performance,org AS $$
DECLARE referenced_cycle uuid; referenced_actor uuid;
BEGIN
  referenced_cycle:=NEW.cycle_id;
  IF TG_TABLE_NAME='performance_effect_execution' THEN referenced_actor:=NEW.executed_by; ELSE referenced_actor:=NEW.actor_employee_id; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM performance.performance_cycle c
    JOIN org.employee e ON e.id=referenced_actor AND e.tenant_id=NEW.tenant_id AND NOT e.is_deleted
    WHERE c.id=referenced_cycle AND c.tenant_id=NEW.tenant_id AND NOT c.is_deleted
  ) THEN RAISE EXCEPTION 'P011 fact references records outside its tenant' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_p011_score_tenant BEFORE INSERT OR UPDATE ON performance.performance_score_fact FOR EACH ROW EXECUTE FUNCTION performance.guard_p011_fact_tenant();
CREATE TRIGGER trg_p011_event_tenant BEFORE INSERT OR UPDATE ON performance.performance_cycle_event FOR EACH ROW EXECUTE FUNCTION performance.guard_p011_fact_tenant();
CREATE TRIGGER trg_p011_effect_tenant BEFORE INSERT OR UPDATE ON performance.performance_effect_execution FOR EACH ROW EXECUTE FUNCTION performance.guard_p011_fact_tenant();

CREATE OR REPLACE FUNCTION performance.guard_p011_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'P011 performance score, event and effect facts are append-only' USING ERRCODE='55000'; END $$;
CREATE TRIGGER trg_p011_score_append_only BEFORE UPDATE OR DELETE ON performance.performance_score_fact FOR EACH ROW EXECUTE FUNCTION performance.guard_p011_append_only();
CREATE TRIGGER trg_p011_event_append_only BEFORE UPDATE OR DELETE ON performance.performance_cycle_event FOR EACH ROW EXECUTE FUNCTION performance.guard_p011_append_only();
CREATE TRIGGER trg_p011_effect_append_only BEFORE UPDATE OR DELETE ON performance.performance_effect_execution FOR EACH ROW EXECUTE FUNCTION performance.guard_p011_append_only();
REVOKE UPDATE,DELETE,TRUNCATE ON performance.performance_score_fact,performance.performance_cycle_event,performance.performance_effect_execution FROM sjg_api_runtime,sjg_worker_runtime;
GRANT SELECT,INSERT ON performance.performance_score_fact,performance.performance_cycle_event,performance.performance_effect_execution TO sjg_api_runtime;
GRANT SELECT ON performance.performance_score_fact,performance.performance_cycle_event,performance.performance_effect_execution TO sjg_worker_runtime;

INSERT INTO core.sequence_rule(id,tenant_id,rule_code,prefix_template,date_pattern,current_value,step,created_at,updated_at,is_deleted)
SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,'P011','P011-','yyyyMMdd',0,1,now(),now(),false
WHERE NOT EXISTS(select 1 from core.sequence_rule where tenant_id='${sjg_tenant_id}'::uuid and rule_code='P011' and not is_deleted);

INSERT INTO iam.permission(id,tenant_id,permission_code,permission_name,resource_type,action_code,risk_level,created_at,updated_at,is_deleted)
SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,v.code,v.name,'P011_PERFORMANCE',v.action,v.risk,now(),now(),false FROM (VALUES
 ('p011.performance.read','Read own performance cycle','READ','NORMAL'),
 ('p011.performance.manage','Manage performance target and data','MANAGE','HIGH'),
 ('p011.performance.evaluate','Submit employee or supervisor evaluation','EVALUATE','HIGH'),
 ('p011.performance.calibrate','Calibrate performance result','CALIBRATE','HIGH'),
 ('p011.performance.appeal','Resolve performance appeal','APPEAL','HIGH'),
 ('p011.performance.execute','Record performance effect execution','EXECUTE','HIGH'),
 ('p011.performance.monitor','Monitor performance workflow metadata','MONITOR','NORMAL'))v(code,name,action,risk)
WHERE NOT EXISTS(select 1 from iam.permission p where p.tenant_id='${sjg_tenant_id}'::uuid and p.permission_code=v.code and not p.is_deleted);

DO $$ DECLARE d uuid;v uuid; BEGIN
 SELECT id INTO d FROM workflow.wf_definition WHERE tenant_id='${sjg_tenant_id}'::uuid AND process_code='P011' AND enabled AND not is_deleted ORDER BY created_at,id LIMIT 1;
 IF d IS NULL THEN d:=gen_random_uuid();INSERT INTO workflow.wf_definition(id,tenant_id,process_code,process_name,module_code,owner_schema,owner_table,enabled,created_at,updated_at,is_deleted) VALUES(d,'${sjg_tenant_id}'::uuid,'P011','Performance management','Performance growth welfare','performance','performance_cycle',true,now(),now(),false);END IF;
 IF NOT EXISTS(select 1 from workflow.wf_version where tenant_id='${sjg_tenant_id}'::uuid and definition_id=d and status='PUBLISHED' and not is_deleted) THEN
  v:=gen_random_uuid();
  INSERT INTO workflow.wf_version(id,tenant_id,definition_id,version_no,status,definition_json,checksum,created_at,updated_at,is_deleted) VALUES(v,'${sjg_tenant_id}'::uuid,d,1,'DRAFT','{"processCode":"P011","states":["S01","S02","S03","S04","S05","S06","S07","S08","S09","S10","S11","END"],"guards":["independent-score-types","score-0-1000","calibrator-separation","appeal-evidence","effect-receipt-only"]}'::jsonb,'phase11-p011-source-flow-v1',now(),now(),false);
  INSERT INTO workflow.wf_node(id,tenant_id,version_id,node_code,node_name,node_type,actor_rule,sort_no,created_at,updated_at,is_deleted) VALUES
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S01','Target setting','START',NULL,10,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S02','Employee confirmation','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"employeeCandidateIds","allowInitiator":true}',20,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S03','Progress record and coaching','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',30,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S04','Authoritative data collection','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',40,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S05','Employee self and supervisor evaluation','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"evaluationCandidateIds","allowInitiator":true}',50,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S06','1000-point calculation','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',60,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S07','Calibration','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"calibratorCandidateIds"}',70,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S08','Result feedback confirmation','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"employeeCandidateIds","allowInitiator":true}',80,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S09','Appeal review','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"appealCandidateIds"}',90,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S10','Performance effect execution','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"executorCandidateIds"}',100,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S11','Archive','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',110,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'END','Closed','END',NULL,120,now(),now(),false);
  INSERT INTO workflow.wf_transition(id,tenant_id,version_id,from_node_code,action_code,to_node_code,is_rollback,created_at,updated_at,is_deleted) VALUES
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S01','SET_TARGET','S02',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S02','CONFIRM_TARGET','S03',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S03','RECORD_COACHING','S04',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S04','COLLECT_AUTHORITY_DATA','S05',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S05','SUBMIT_SELF_EVALUATION','S05',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S05','SUBMIT_SUPERVISOR_EVALUATION','S06',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S06','CALCULATE_SCORE','S07',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S07','CALIBRATE','S08',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S08','CONFIRM_FEEDBACK','S09',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S09','RESOLVE_APPEAL','S10',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S09','NO_APPEAL','S10',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S10','EXECUTE_EFFECT','S11',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S11','ARCHIVE','END',false,now(),now(),false);
  UPDATE workflow.wf_version SET status='PUBLISHED',effective_at=now(),updated_at=now() WHERE tenant_id='${sjg_tenant_id}'::uuid AND id=v;
 END IF;
 IF NOT EXISTS(select 1 from workflow.wf_form_definition where tenant_id='${sjg_tenant_id}'::uuid and form_code='CTR-P011-F01' and process_code='P011' and node_code='S01' and enabled and not is_deleted) THEN
  INSERT INTO workflow.wf_form_definition(id,tenant_id,form_code,form_name,process_code,node_code,version_no,field_schema,layout_schema,validation_schema,visibility_matrix,edit_matrix,enabled,created_at,updated_at,is_deleted) VALUES(gen_random_uuid(),'${sjg_tenant_id}'::uuid,'CTR-P011-F01','Performance target setting','P011','S01',1,
  '{"type":"object","properties":{"subject":{"type":"string","minLength":5},"owner_employee_id":{"type":"string","format":"uuid"},"content_version":{"type":"string"},"period_or_course_no":{"type":"string"}},"required":["subject","owner_employee_id","content_version","period_or_course_no"]}'::jsonb,
  '{"sections":["Target","Cycle","Evidence"]}'::jsonb,'{"serverAuthoritative":["workflow_instance_id","score_facts","effect_executions"],"guards":["score-type-independent","score-0-1000","calibrator-separation"]}'::jsonb,'{"employee":"SELF","center":"AUTHORIZED_SCOPE","tech":"METADATA_ONLY"}'::jsonb,'{"employee":[],"center":["subject","owner_employee_id","content_version","period_or_course_no"],"tech":[]}'::jsonb,true,now(),now(),false);
 END IF;
END $$;

RESET ROLE;
