-- PHASE-11 / P013 source-backed reward lifecycle.
SET ROLE sjg_owner;

-- Stable upstream contribution identity. Existing historical rows remain readable;
-- all P013 API writes require a value and the partial unique index prevents two
-- active reward cases from claiming the same source fact in one tenant.
ALTER TABLE reward.reward_case ADD COLUMN source_fact_key varchar(160);
ALTER TABLE reward.reward_case ADD COLUMN recommended_reward_level varchar(64);
ALTER TABLE reward.reward_case ADD COLUMN approved_reward_level varchar(64);
ALTER TABLE reward.reward_case ADD CONSTRAINT ck_p013_source_fact_key
  CHECK(source_fact_key IS NULL OR length(trim(source_fact_key)) BETWEEN 3 AND 160);
ALTER TABLE reward.reward_case ADD CONSTRAINT ck_p013_recommended_level
  CHECK(recommended_reward_level IS NULL OR length(trim(recommended_reward_level)) BETWEEN 2 AND 64);
ALTER TABLE reward.reward_case ADD CONSTRAINT ck_p013_approved_level
  CHECK(approved_reward_level IS NULL OR length(trim(approved_reward_level)) BETWEEN 2 AND 64);
CREATE UNIQUE INDEX uk_p013_source_fact_key ON reward.reward_case(tenant_id,source_fact_key)
  WHERE source_fact_key IS NOT NULL AND NOT is_deleted;

CREATE TABLE reward.reward_case_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  reward_case_id uuid NOT NULL,
  event_seq integer NOT NULL,
  event_type varchar(40) NOT NULL,
  evidence jsonb NOT NULL,
  actor_employee_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_p013_event_case FOREIGN KEY(reward_case_id) REFERENCES reward.reward_case(id) ON DELETE RESTRICT,
  CONSTRAINT uk_p013_event_seq UNIQUE(tenant_id,reward_case_id,event_seq),
  CONSTRAINT ck_p013_event_evidence CHECK(jsonb_typeof(evidence)='object')
);

-- S06 records an approved instruction only. It never inserts P015 ledger rows and
-- never initiates or calculates a payment.
CREATE TABLE reward.reward_impact_instruction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  reward_case_id uuid NOT NULL,
  impact_type varchar(24) NOT NULL,
  requested_points bigint,
  approved_amount numeric(18,2),
  authority_reference varchar(160) NOT NULL,
  evidence jsonb NOT NULL,
  instructed_by uuid NOT NULL,
  instructed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_p013_impact_case FOREIGN KEY(reward_case_id) REFERENCES reward.reward_case(id) ON DELETE RESTRICT,
  CONSTRAINT uk_p013_impact_type UNIQUE(tenant_id,reward_case_id,impact_type),
  CONSTRAINT ck_p013_impact_type CHECK(impact_type IN ('HONOR_POINTS','BONUS','DEVELOPMENT')),
  CONSTRAINT ck_p013_impact_reference CHECK(length(trim(authority_reference)) BETWEEN 3 AND 160),
  CONSTRAINT ck_p013_impact_evidence CHECK(jsonb_typeof(evidence)='object'),
  CONSTRAINT ck_p013_impact_shape CHECK(
    (impact_type='HONOR_POINTS' AND requested_points IS NOT NULL AND requested_points>0 AND approved_amount IS NULL)
    OR (impact_type='BONUS' AND requested_points IS NULL AND approved_amount IS NOT NULL AND approved_amount>0)
    OR (impact_type='DEVELOPMENT' AND requested_points IS NULL AND approved_amount IS NULL)
  )
);

-- S08 accepts receipts produced by the authoritative downstream system. One
-- instruction has exactly one immutable receipt; external references are tenant
-- scoped and cannot be replayed onto another reward case.
CREATE TABLE reward.reward_impact_receipt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  reward_case_id uuid NOT NULL,
  instruction_id uuid NOT NULL,
  receipt_type varchar(24) NOT NULL,
  external_reference varchar(160) NOT NULL,
  external_occurred_at timestamptz NOT NULL,
  evidence jsonb NOT NULL,
  received_by uuid NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_p013_receipt_case FOREIGN KEY(reward_case_id) REFERENCES reward.reward_case(id) ON DELETE RESTRICT,
  CONSTRAINT fk_p013_receipt_instruction FOREIGN KEY(instruction_id) REFERENCES reward.reward_impact_instruction(id) ON DELETE RESTRICT,
  CONSTRAINT uk_p013_receipt_instruction UNIQUE(tenant_id,instruction_id),
  CONSTRAINT uk_p013_receipt_external UNIQUE(tenant_id,receipt_type,external_reference),
  CONSTRAINT ck_p013_receipt_type CHECK(receipt_type IN ('P015_POINT_LEDGER','FINANCE_BONUS','HR_DEVELOPMENT')),
  CONSTRAINT ck_p013_receipt_reference CHECK(length(trim(external_reference)) BETWEEN 3 AND 160),
  CONSTRAINT ck_p013_receipt_evidence CHECK(jsonb_typeof(evidence)='object')
);

CREATE INDEX ix_p013_event_case ON reward.reward_case_event(tenant_id,reward_case_id,created_at);
CREATE INDEX ix_p013_impact_case ON reward.reward_impact_instruction(tenant_id,reward_case_id,instructed_at);
CREATE INDEX ix_p013_receipt_case ON reward.reward_impact_receipt(tenant_id,reward_case_id,received_at);
ALTER TABLE reward.reward_case_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward.reward_impact_instruction ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward.reward_impact_receipt ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_tenant_reward_case_event ON reward.reward_case_event USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);
CREATE POLICY p_tenant_reward_impact_instruction ON reward.reward_impact_instruction USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);
CREATE POLICY p_tenant_reward_impact_receipt ON reward.reward_impact_receipt USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);

CREATE OR REPLACE FUNCTION reward.guard_p013_fact_tenant() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,reward,org AS $$
DECLARE actor_id uuid; parent_case uuid; expected_receipt varchar(24);
BEGIN
  parent_case:=NEW.reward_case_id;
  IF NOT EXISTS(SELECT 1 FROM reward.reward_case c WHERE c.id=parent_case AND c.tenant_id=NEW.tenant_id AND NOT c.is_deleted)
  THEN RAISE EXCEPTION 'P013 fact references reward case outside its tenant' USING ERRCODE='23514'; END IF;
  IF TG_TABLE_NAME='reward_case_event' THEN actor_id:=NEW.actor_employee_id;
  ELSIF TG_TABLE_NAME='reward_impact_instruction' THEN actor_id:=NEW.instructed_by;
  ELSE
    actor_id:=NEW.received_by;
    SELECT CASE i.impact_type WHEN 'HONOR_POINTS' THEN 'P015_POINT_LEDGER' WHEN 'BONUS' THEN 'FINANCE_BONUS' ELSE 'HR_DEVELOPMENT' END
      INTO expected_receipt FROM reward.reward_impact_instruction i
     WHERE i.id=NEW.instruction_id AND i.tenant_id=NEW.tenant_id AND i.reward_case_id=NEW.reward_case_id;
    IF expected_receipt IS NULL OR expected_receipt<>NEW.receipt_type
    THEN RAISE EXCEPTION 'P013 receipt does not match a same-tenant impact instruction' USING ERRCODE='23514'; END IF;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM org.employee e WHERE e.id=actor_id AND e.tenant_id=NEW.tenant_id AND NOT e.is_deleted)
  THEN RAISE EXCEPTION 'P013 fact references actor outside its tenant' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_p013_event_tenant BEFORE INSERT OR UPDATE ON reward.reward_case_event FOR EACH ROW EXECUTE FUNCTION reward.guard_p013_fact_tenant();
CREATE TRIGGER trg_p013_impact_tenant BEFORE INSERT OR UPDATE ON reward.reward_impact_instruction FOR EACH ROW EXECUTE FUNCTION reward.guard_p013_fact_tenant();
CREATE TRIGGER trg_p013_receipt_tenant BEFORE INSERT OR UPDATE ON reward.reward_impact_receipt FOR EACH ROW EXECUTE FUNCTION reward.guard_p013_fact_tenant();

CREATE OR REPLACE FUNCTION reward.guard_p013_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'P013 reward events, impact instructions and receipts are append-only' USING ERRCODE='55000'; END $$;
CREATE TRIGGER trg_p013_event_append_only BEFORE UPDATE OR DELETE ON reward.reward_case_event FOR EACH ROW EXECUTE FUNCTION reward.guard_p013_append_only();
CREATE TRIGGER trg_p013_impact_append_only BEFORE UPDATE OR DELETE ON reward.reward_impact_instruction FOR EACH ROW EXECUTE FUNCTION reward.guard_p013_append_only();
CREATE TRIGGER trg_p013_receipt_append_only BEFORE UPDATE OR DELETE ON reward.reward_impact_receipt FOR EACH ROW EXECUTE FUNCTION reward.guard_p013_append_only();
REVOKE UPDATE,DELETE,TRUNCATE ON reward.reward_case_event,reward.reward_impact_instruction,reward.reward_impact_receipt FROM sjg_api_runtime,sjg_worker_runtime;
GRANT SELECT,INSERT ON reward.reward_case_event,reward.reward_impact_instruction,reward.reward_impact_receipt TO sjg_api_runtime;
GRANT SELECT ON reward.reward_case_event,reward.reward_impact_instruction,reward.reward_impact_receipt TO sjg_worker_runtime;

INSERT INTO core.sequence_rule(id,tenant_id,rule_code,prefix_template,date_pattern,current_value,step,created_at,updated_at,is_deleted)
SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,'P013','P013-','yyyyMMdd',0,1,now(),now(),false
WHERE NOT EXISTS(SELECT 1 FROM core.sequence_rule WHERE tenant_id='${sjg_tenant_id}'::uuid AND rule_code='P013' AND NOT is_deleted);

INSERT INTO iam.permission(id,tenant_id,permission_code,permission_name,resource_type,action_code,risk_level,created_at,updated_at,is_deleted)
SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,v.code,v.name,'P013_REWARD',v.action,v.risk,now(),now(),false FROM (VALUES
 ('p013.reward.read','Read own reward case','READ','NORMAL'),
 ('p013.reward.manage','Manage reward contribution and evidence','MANAGE','HIGH'),
 ('p013.reward.review','Review reward level and duplicate impact','REVIEW','HIGH'),
 ('p013.reward.approve','Approve reward decision','APPROVE','CRITICAL'),
 ('p013.reward.execute','Record impact instructions and authoritative receipts','EXECUTE','CRITICAL'),
 ('p013.reward.monitor','Monitor reward workflow metadata','MONITOR','NORMAL'))v(code,name,action,risk)
WHERE NOT EXISTS(SELECT 1 FROM iam.permission p WHERE p.tenant_id='${sjg_tenant_id}'::uuid AND p.permission_code=v.code AND NOT p.is_deleted);

DO $$ DECLARE v_definition_id uuid; v_version_id uuid; BEGIN
 SELECT id INTO v_definition_id FROM workflow.wf_definition WHERE tenant_id='${sjg_tenant_id}'::uuid AND process_code='P013' AND enabled AND NOT is_deleted ORDER BY created_at,id LIMIT 1;
 IF v_definition_id IS NULL THEN
  v_definition_id:=gen_random_uuid();
  INSERT INTO workflow.wf_definition(id,tenant_id,process_code,process_name,module_code,owner_schema,owner_table,enabled,created_at,updated_at,is_deleted)
  VALUES(v_definition_id,'${sjg_tenant_id}'::uuid,'P013','Reward','Performance growth welfare','reward','reward_case',true,now(),now(),false);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM workflow.wf_version wv WHERE wv.tenant_id='${sjg_tenant_id}'::uuid AND wv.definition_id=v_definition_id AND wv.status='PUBLISHED' AND NOT wv.is_deleted) THEN
  v_version_id:=gen_random_uuid();
  INSERT INTO workflow.wf_version(id,tenant_id,definition_id,version_no,status,definition_json,checksum,created_at,updated_at,is_deleted)
  VALUES(v_version_id,'${sjg_tenant_id}'::uuid,v_definition_id,1,'DRAFT','{"processCode":"P013","states":["S01","S02","S03","S04","S05","S06","S07","S08","S09","END"],"guards":["source-fact-deduplication","approval-separated-from-impact","p015-ledger-receipt-only","finance-receipt-only","all-instructions-receipted-before-archive"]}'::jsonb,'phase11-p013-source-flow-v1',now(),now(),false);
  INSERT INTO workflow.wf_node(id,tenant_id,version_id,node_code,node_name,node_type,actor_rule,sort_no,created_at,updated_at,is_deleted) VALUES
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S01','Contribution fact','START',NULL,10,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S02','Evidence verification','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',20,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S03','Reward level recommendation','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"reviewerCandidateIds"}',30,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S04','Approval','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"approverCandidateIds"}',40,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S05','Duplicate impact verification','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"reviewerCandidateIds"}',50,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S06','Impact instruction execution','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"executorCandidateIds"}',60,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S07','Employee notification','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"ownerCandidateIds"}',70,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S08','Finance and HR receipts','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"executorCandidateIds"}',80,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S09','Archive','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',90,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'END','Closed','END',NULL,100,now(),now(),false);
  INSERT INTO workflow.wf_transition(id,tenant_id,version_id,from_node_code,action_code,to_node_code,is_rollback,created_at,updated_at,is_deleted) VALUES
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S01','RECORD_CONTRIBUTION','S02',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S02','VERIFY_EVIDENCE','S03',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S03','RECOMMEND_LEVEL','S04',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S04','APPROVE','S05',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S05','CHECK_DUPLICATE','S06',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S06','RECORD_IMPACT','S06',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S06','COMPLETE_IMPACTS','S07',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S07','CONFIRM_NOTICE','S08',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S08','RECORD_RECEIPT','S08',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S08','COMPLETE_RECEIPTS','S09',false,now(),now(),false),
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v_version_id,'S09','ARCHIVE','END',false,now(),now(),false);
  UPDATE workflow.wf_version SET status='PUBLISHED',effective_at=now(),updated_at=now() WHERE tenant_id='${sjg_tenant_id}'::uuid AND id=v_version_id;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM workflow.wf_form_definition WHERE tenant_id='${sjg_tenant_id}'::uuid AND form_code='CTR-P013-F01' AND process_code='P013' AND node_code='S01' AND enabled AND NOT is_deleted) THEN
  INSERT INTO workflow.wf_form_definition(id,tenant_id,form_code,form_name,process_code,node_code,version_no,field_schema,layout_schema,validation_schema,visibility_matrix,edit_matrix,enabled,created_at,updated_at,is_deleted)
  VALUES(gen_random_uuid(),'${sjg_tenant_id}'::uuid,'CTR-P013-F01','Reward contribution fact','P013','S01',1,
  '{"type":"object","properties":{"subject":{"type":"string","minLength":5},"owner_employee_id":{"type":"string","format":"uuid"},"source_fact_key":{"type":"string","minLength":3},"fact_occurred_at":{"type":"string","format":"date-time"},"fact_summary":{"type":"string","minLength":5}}}'::jsonb,
  '{"sections":["Contribution","Affected employee","Immutable evidence"]}'::jsonb,
  '{"serverAuthoritative":["workflow_instance_id","duplicate_check","impact_instructions","external_receipts"],"guards":["source-fact-unique","no-direct-p015-write","no-payment-initiation"]}'::jsonb,
  '{"employee":"SELF_READ","center":"AUTHORIZED_SCOPE","tech":"METADATA_ONLY"}'::jsonb,
  '{"employee":[],"center":["subject","owner_employee_id","source_fact_key","fact_summary"],"tech":[]}'::jsonb,true,now(),now(),false);
 END IF;
END $$;

RESET ROLE;
