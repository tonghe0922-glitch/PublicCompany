-- PHASE-11 / P014 source-backed discipline, responsibility and appeal lifecycle.
SET ROLE sjg_owner;

ALTER TABLE reward.discipline_case ADD COLUMN source_fact_key varchar(160);
ALTER TABLE reward.discipline_case ADD COLUMN affected_employee_id uuid;
ALTER TABLE reward.discipline_case ADD COLUMN business_object_type varchar(64);
ALTER TABLE reward.discipline_case ADD COLUMN business_object_no varchar(32);
ALTER TABLE reward.discipline_case ADD COLUMN business_object_name varchar(200);
ALTER TABLE reward.discipline_case ALTER COLUMN status TYPE varchar(64);
ALTER TABLE reward.discipline_case ADD CONSTRAINT ck_p014_source_fact_key
  CHECK(source_fact_key IS NULL OR length(trim(source_fact_key)) BETWEEN 3 AND 160);
ALTER TABLE reward.discipline_case ADD CONSTRAINT ck_p014_business_object
  CHECK((business_object_type IS NULL AND business_object_no IS NULL AND business_object_name IS NULL)
     OR (length(trim(business_object_type)) BETWEEN 2 AND 64
     AND length(trim(business_object_no)) BETWEEN 3 AND 32
     AND length(trim(business_object_name)) BETWEEN 2 AND 200));
CREATE UNIQUE INDEX uk_p014_source_fact_key ON reward.discipline_case(tenant_id,source_fact_key)
  WHERE source_fact_key IS NOT NULL AND NOT is_deleted;

CREATE TABLE reward.discipline_case_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  discipline_case_id uuid NOT NULL,
  event_seq integer NOT NULL,
  event_type varchar(48) NOT NULL,
  evidence jsonb NOT NULL,
  actor_employee_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_p014_event_case FOREIGN KEY(discipline_case_id) REFERENCES reward.discipline_case(id) ON DELETE RESTRICT,
  CONSTRAINT uk_p014_event_seq UNIQUE(tenant_id,discipline_case_id,event_seq),
  CONSTRAINT ck_p014_event_evidence CHECK(jsonb_typeof(evidence)='object')
);

-- Decisions are externally-authorized human facts. The platform records the
-- authority reference and result; it does not calculate sanctions or liability.
CREATE TABLE reward.discipline_decision_fact (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  discipline_case_id uuid NOT NULL,
  decision_kind varchar(16) NOT NULL,
  outcome varchar(24) NOT NULL,
  authority_reference varchar(160) NOT NULL,
  decided_at timestamptz NOT NULL,
  evidence jsonb NOT NULL,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_p014_decision_case FOREIGN KEY(discipline_case_id) REFERENCES reward.discipline_case(id) ON DELETE RESTRICT,
  CONSTRAINT uk_p014_decision_kind UNIQUE(tenant_id,discipline_case_id,decision_kind),
  CONSTRAINT ck_p014_decision_kind CHECK(decision_kind IN ('ORIGINAL','APPEAL')),
  CONSTRAINT ck_p014_decision_outcome CHECK(outcome IN ('RECORDED','UPHELD','AMENDED','REVOKED','NOT_APPLICABLE')),
  CONSTRAINT ck_p014_decision_reference CHECK(length(trim(authority_reference)) BETWEEN 3 AND 160),
  CONSTRAINT ck_p014_decision_evidence CHECK(jsonb_typeof(evidence)='object')
);

-- P014 creates instructions only. HR discipline, P015 point changes and
-- remediation remain owned by their authoritative downstream domains.
CREATE TABLE reward.discipline_impact_instruction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  discipline_case_id uuid NOT NULL,
  impact_type varchar(24) NOT NULL,
  authority_reference varchar(160) NOT NULL,
  evidence jsonb NOT NULL,
  instructed_by uuid NOT NULL,
  instructed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_p014_impact_case FOREIGN KEY(discipline_case_id) REFERENCES reward.discipline_case(id) ON DELETE RESTRICT,
  CONSTRAINT uk_p014_impact_type UNIQUE(tenant_id,discipline_case_id,impact_type),
  CONSTRAINT ck_p014_impact_type CHECK(impact_type IN ('HR_DISCIPLINE','POINT_ADJUSTMENT','REMEDIATION')),
  CONSTRAINT ck_p014_impact_reference CHECK(length(trim(authority_reference)) BETWEEN 3 AND 160),
  CONSTRAINT ck_p014_impact_evidence CHECK(jsonb_typeof(evidence)='object')
);

CREATE TABLE reward.discipline_impact_receipt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  discipline_case_id uuid NOT NULL,
  instruction_id uuid NOT NULL,
  receipt_type varchar(24) NOT NULL,
  external_reference varchar(160) NOT NULL,
  external_occurred_at timestamptz NOT NULL,
  evidence jsonb NOT NULL,
  received_by uuid NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_p014_receipt_case FOREIGN KEY(discipline_case_id) REFERENCES reward.discipline_case(id) ON DELETE RESTRICT,
  CONSTRAINT fk_p014_receipt_instruction FOREIGN KEY(instruction_id) REFERENCES reward.discipline_impact_instruction(id) ON DELETE RESTRICT,
  CONSTRAINT uk_p014_receipt_instruction UNIQUE(tenant_id,instruction_id),
  CONSTRAINT uk_p014_receipt_external UNIQUE(tenant_id,receipt_type,external_reference),
  CONSTRAINT ck_p014_receipt_type CHECK(receipt_type IN ('HR_CASE_RECEIPT','P015_POINT_LEDGER','REMEDIATION_TASK')),
  CONSTRAINT ck_p014_receipt_reference CHECK(length(trim(external_reference)) BETWEEN 3 AND 160),
  CONSTRAINT ck_p014_receipt_evidence CHECK(jsonb_typeof(evidence)='object')
);

CREATE INDEX ix_p014_event_case ON reward.discipline_case_event(tenant_id,discipline_case_id,created_at);
CREATE INDEX ix_p014_decision_case ON reward.discipline_decision_fact(tenant_id,discipline_case_id,recorded_at);
CREATE INDEX ix_p014_impact_case ON reward.discipline_impact_instruction(tenant_id,discipline_case_id,instructed_at);
CREATE INDEX ix_p014_receipt_case ON reward.discipline_impact_receipt(tenant_id,discipline_case_id,received_at);
ALTER TABLE reward.discipline_case_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward.discipline_decision_fact ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward.discipline_impact_instruction ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward.discipline_impact_receipt ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_tenant_discipline_case_event ON reward.discipline_case_event USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);
CREATE POLICY p_tenant_discipline_decision_fact ON reward.discipline_decision_fact USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);
CREATE POLICY p_tenant_discipline_impact_instruction ON reward.discipline_impact_instruction USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);
CREATE POLICY p_tenant_discipline_impact_receipt ON reward.discipline_impact_receipt USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);

CREATE OR REPLACE FUNCTION reward.guard_p014_fact_tenant() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,reward,org AS $$
DECLARE actor_id uuid; expected_receipt varchar(24);
BEGIN
  IF NOT EXISTS(SELECT 1 FROM reward.discipline_case c WHERE c.id=NEW.discipline_case_id AND c.tenant_id=NEW.tenant_id AND NOT c.is_deleted)
  THEN RAISE EXCEPTION 'P014 fact references discipline case outside its tenant' USING ERRCODE='23514'; END IF;
  IF TG_TABLE_NAME='discipline_case_event' THEN actor_id:=NEW.actor_employee_id;
  ELSIF TG_TABLE_NAME='discipline_decision_fact' THEN actor_id:=NEW.recorded_by;
  ELSIF TG_TABLE_NAME='discipline_impact_instruction' THEN actor_id:=NEW.instructed_by;
  ELSE
    actor_id:=NEW.received_by;
    SELECT CASE i.impact_type WHEN 'HR_DISCIPLINE' THEN 'HR_CASE_RECEIPT' WHEN 'POINT_ADJUSTMENT' THEN 'P015_POINT_LEDGER' ELSE 'REMEDIATION_TASK' END
      INTO expected_receipt FROM reward.discipline_impact_instruction i
     WHERE i.id=NEW.instruction_id AND i.tenant_id=NEW.tenant_id AND i.discipline_case_id=NEW.discipline_case_id;
    IF expected_receipt IS NULL OR expected_receipt<>NEW.receipt_type
    THEN RAISE EXCEPTION 'P014 receipt does not match a same-tenant impact instruction' USING ERRCODE='23514'; END IF;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM org.employee e WHERE e.id=actor_id AND e.tenant_id=NEW.tenant_id AND NOT e.is_deleted)
  THEN RAISE EXCEPTION 'P014 fact references actor outside its tenant' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_p014_event_tenant BEFORE INSERT OR UPDATE ON reward.discipline_case_event FOR EACH ROW EXECUTE FUNCTION reward.guard_p014_fact_tenant();
CREATE TRIGGER trg_p014_decision_tenant BEFORE INSERT OR UPDATE ON reward.discipline_decision_fact FOR EACH ROW EXECUTE FUNCTION reward.guard_p014_fact_tenant();
CREATE TRIGGER trg_p014_impact_tenant BEFORE INSERT OR UPDATE ON reward.discipline_impact_instruction FOR EACH ROW EXECUTE FUNCTION reward.guard_p014_fact_tenant();
CREATE TRIGGER trg_p014_receipt_tenant BEFORE INSERT OR UPDATE ON reward.discipline_impact_receipt FOR EACH ROW EXECUTE FUNCTION reward.guard_p014_fact_tenant();

CREATE OR REPLACE FUNCTION reward.guard_p014_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'P014 discipline events, decisions, instructions and receipts are append-only' USING ERRCODE='55000'; END $$;
CREATE TRIGGER trg_p014_event_append_only BEFORE UPDATE OR DELETE ON reward.discipline_case_event FOR EACH ROW EXECUTE FUNCTION reward.guard_p014_append_only();
CREATE TRIGGER trg_p014_decision_append_only BEFORE UPDATE OR DELETE ON reward.discipline_decision_fact FOR EACH ROW EXECUTE FUNCTION reward.guard_p014_append_only();
CREATE TRIGGER trg_p014_impact_append_only BEFORE UPDATE OR DELETE ON reward.discipline_impact_instruction FOR EACH ROW EXECUTE FUNCTION reward.guard_p014_append_only();
CREATE TRIGGER trg_p014_receipt_append_only BEFORE UPDATE OR DELETE ON reward.discipline_impact_receipt FOR EACH ROW EXECUTE FUNCTION reward.guard_p014_append_only();
REVOKE UPDATE,DELETE,TRUNCATE ON reward.discipline_case_event,reward.discipline_decision_fact,reward.discipline_impact_instruction,reward.discipline_impact_receipt FROM sjg_api_runtime,sjg_worker_runtime;
GRANT SELECT,INSERT ON reward.discipline_case_event,reward.discipline_decision_fact,reward.discipline_impact_instruction,reward.discipline_impact_receipt TO sjg_api_runtime;
GRANT SELECT ON reward.discipline_case_event,reward.discipline_decision_fact,reward.discipline_impact_instruction,reward.discipline_impact_receipt TO sjg_worker_runtime;

INSERT INTO core.sequence_rule(id,tenant_id,rule_code,prefix_template,date_pattern,current_value,step,created_at,updated_at,is_deleted)
SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,'P014','P014-','yyyyMMdd',0,1,now(),now(),false
WHERE NOT EXISTS(SELECT 1 FROM core.sequence_rule WHERE tenant_id='${sjg_tenant_id}'::uuid AND rule_code='P014' AND NOT is_deleted);

INSERT INTO iam.permission(id,tenant_id,permission_code,permission_name,resource_type,action_code,risk_level,created_at,updated_at,is_deleted)
SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,v.code,v.name,'P014_DISCIPLINE',v.action,v.risk,now(),now(),false FROM (VALUES
 ('p014.discipline.read','Read own discipline case','READ','HIGH'),
 ('p014.discipline.manage','Manage discipline intake, safeguard and execution','MANAGE','CRITICAL'),
 ('p014.discipline.investigate','Investigate discipline case','INVESTIGATE','CRITICAL'),
 ('p014.discipline.decide','Record externally authorized discipline decision','DECIDE','CRITICAL'),
 ('p014.discipline.appeal','Submit or independently review appeal','APPEAL','CRITICAL'),
 ('p014.discipline.monitor','Monitor private discipline workflow metadata','MONITOR','HIGH'))v(code,name,action,risk)
WHERE NOT EXISTS(SELECT 1 FROM iam.permission p WHERE p.tenant_id='${sjg_tenant_id}'::uuid AND p.permission_code=v.code AND NOT p.is_deleted);

DO $$ DECLARE v_definition_id uuid; v_version_id uuid; BEGIN
 SELECT id INTO v_definition_id FROM workflow.wf_definition WHERE tenant_id='${sjg_tenant_id}'::uuid AND process_code='P014' AND enabled AND NOT is_deleted ORDER BY created_at,id LIMIT 1;
 IF v_definition_id IS NULL THEN
  v_definition_id:=gen_random_uuid();
  INSERT INTO workflow.wf_definition(id,tenant_id,process_code,process_name,module_code,owner_schema,owner_table,enabled,created_at,updated_at,is_deleted)
  VALUES(v_definition_id,'${sjg_tenant_id}'::uuid,'P014','Discipline responsibility and appeal','Performance growth welfare','reward','discipline_case',true,now(),now(),false);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM workflow.wf_version wv WHERE wv.tenant_id='${sjg_tenant_id}'::uuid AND wv.definition_id=v_definition_id AND wv.status='PUBLISHED' AND NOT wv.is_deleted) THEN
  v_version_id:=gen_random_uuid();
  INSERT INTO workflow.wf_version(id,tenant_id,definition_id,version_no,status,definition_json,checksum,created_at,updated_at,is_deleted)
  VALUES(v_version_id,'${sjg_tenant_id}'::uuid,v_definition_id,1,'DRAFT','{"processCode":"P014","states":["S01","S02","S03","S04","S05","S06","S07","S08","S09","S10","S11","S12","END"],"guards":["affected-employee-participation","investigation-review-decision-appeal-separation","external-authority-reference-only","append-only-decision-reversal","all-instructions-receipted-before-close","independent-remediation-observer"]}'::jsonb,'phase11-p014-source-flow-v1',now(),now(),false);
  INSERT INTO workflow.wf_node(id,tenant_id,version_id,node_code,node_name,node_type,actor_rule,sort_no,created_at,updated_at,is_deleted) VALUES
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S01','Clue registration','START',NULL,10,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S02','Temporary safeguard','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',20,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S03','Formal investigation','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"investigatorCandidateIds"}',30,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S04','Employee statement','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"affectedCandidateIds"}',40,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S05','Responsibility review','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"reviewerCandidateIds"}',50,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S06','Decision record','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"deciderCandidateIds"}',60,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S07','Service confirmation','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"affectedCandidateIds"}',70,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S08','Impact execution','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',80,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S09','Appeal review','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"appealReviewerCandidateIds"}',90,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S10','Core case closure','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',100,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S11','Independent remediation observation','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"observerCandidateIds","allowInitiator":true}',110,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S12','Supplementary archive','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',120,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'END','Closed','END',NULL,130,now(),now(),false);
  INSERT INTO workflow.wf_transition(id,tenant_id,version_id,from_node_code,action_code,to_node_code,is_rollback,created_at,updated_at,is_deleted) VALUES
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S01','REGISTER_CLUE','S02',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S02','RECORD_SAFEGUARD','S03',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S03','COMPLETE_INVESTIGATION','S04',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S04','SUBMIT_STATEMENT','S05',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S05','COMPLETE_RESPONSIBILITY_REVIEW','S06',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S06','RECORD_DECISION','S07',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S07','CONFIRM_SERVICE','S08',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S08','RECORD_IMPACT','S08',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S08','RECORD_RECEIPT','S08',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S08','COMPLETE_IMPACTS','S09',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S09','SUBMIT_APPEAL','S09',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S09','REVIEW_APPEAL','S10',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S10','CLOSE_CORE','S11',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S11','VERIFY_REMEDIATION','S12',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S12','SUPPLEMENT_ARCHIVE','END',false,now(),now(),false);
  UPDATE workflow.wf_version SET status='PUBLISHED',effective_at=now(),updated_at=now() WHERE tenant_id='${sjg_tenant_id}'::uuid AND id=v_version_id;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM workflow.wf_form_definition WHERE tenant_id='${sjg_tenant_id}'::uuid AND form_code='CTR-P014-F01' AND process_code='P014' AND node_code='S01' AND enabled AND NOT is_deleted) THEN
  INSERT INTO workflow.wf_form_definition(id,tenant_id,form_code,form_name,process_code,node_code,version_no,field_schema,layout_schema,validation_schema,visibility_matrix,edit_matrix,enabled,created_at,updated_at,is_deleted)
  VALUES(gen_random_uuid(),'${sjg_tenant_id}'::uuid,'CTR-P014-F01','Discipline clue registration','P014','S01',1,
  '{"type":"object","properties":{"subject":{"type":"string","minLength":5},"affected_employee_id":{"type":"string","format":"uuid"},"source_fact_key":{"type":"string","minLength":3},"business_object_no":{"type":"string","minLength":3},"fact_summary":{"type":"string","minLength":10}}}'::jsonb,
  '{"sections":["Clue","Affected employee","Business object","Immutable evidence"]}'::jsonb,
  '{"serverAuthoritative":["workflow_instance_id","decision_facts","impact_instructions","external_receipts"],"guards":["source-fact-unique","no-automated-liability-or-sanction","no-direct-p015-or-hr-write","recusal"]}'::jsonb,
  '{"employee":"SELF_READ","center":"AUTHORIZED_SCOPE","tech":"METADATA_ONLY"}'::jsonb,
  '{"employee":["subject","affected_employee_id","source_fact_key","business_object_type","business_object_no","business_object_name","fact_summary"],"center":["subject","affected_employee_id","source_fact_key","business_object_type","business_object_no","business_object_name","fact_summary"],"tech":[]}'::jsonb,true,now(),now(),false);
 END IF;
END $$;

RESET ROLE;
