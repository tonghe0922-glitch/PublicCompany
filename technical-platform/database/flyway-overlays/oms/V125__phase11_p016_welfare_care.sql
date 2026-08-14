-- PHASE-11 / P016 source-backed welfare and care lifecycle.
SET ROLE sjg_owner;

ALTER TABLE welfare.care_case ADD COLUMN source_fact_key varchar(160);
ALTER TABLE welfare.care_case ADD COLUMN affected_employee_id uuid;
ALTER TABLE welfare.care_case ADD COLUMN care_type varchar(32);
ALTER TABLE welfare.care_case ADD COLUMN privacy_required boolean NOT NULL DEFAULT true;
ALTER TABLE welfare.care_case ADD COLUMN external_business_ref varchar(160);
ALTER TABLE welfare.care_case ALTER COLUMN status TYPE varchar(64);
ALTER TABLE welfare.care_case ADD CONSTRAINT ck_p016_source CHECK(source_fact_key IS NULL OR length(trim(source_fact_key)) BETWEEN 3 AND 160);
ALTER TABLE welfare.care_case ADD CONSTRAINT ck_p016_care_type CHECK(care_type IS NULL OR care_type IN ('MARRIAGE_BIRTH','HARDSHIP','HEALTH','BEREAVEMENT','OTHER'));
ALTER TABLE welfare.care_case ADD CONSTRAINT ck_p016_amount CHECK(benefit_amount IS NULL OR benefit_amount>=0);
CREATE UNIQUE INDEX uk_p016_source ON welfare.care_case(tenant_id,source_fact_key) WHERE source_fact_key IS NOT NULL AND NOT is_deleted;
CREATE INDEX ix_p016_employee ON welfare.care_case(tenant_id,affected_employee_id,created_at,id);

CREATE TABLE welfare.care_case_event(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,care_case_id uuid NOT NULL,event_seq integer NOT NULL,event_type varchar(48) NOT NULL,
 evidence jsonb NOT NULL,actor_employee_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT fk_p016_event_case FOREIGN KEY(care_case_id) REFERENCES welfare.care_case(id) ON DELETE RESTRICT,
 CONSTRAINT uk_p016_event_seq UNIQUE(tenant_id,care_case_id,event_seq),CONSTRAINT ck_p016_event_evidence CHECK(jsonb_typeof(evidence)='object')
);
CREATE TABLE welfare.care_eligibility_fact(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,care_case_id uuid NOT NULL,outcome varchar(16) NOT NULL,authority_reference varchar(160) NOT NULL,
 checked_at timestamptz NOT NULL,evidence jsonb NOT NULL,checked_by uuid NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT fk_p016_eligibility_case FOREIGN KEY(care_case_id) REFERENCES welfare.care_case(id) ON DELETE RESTRICT,
 CONSTRAINT uk_p016_eligibility UNIQUE(tenant_id,care_case_id),CONSTRAINT ck_p016_eligibility_outcome CHECK(outcome IN ('ELIGIBLE','INELIGIBLE')),
 CONSTRAINT ck_p016_eligibility_evidence CHECK(jsonb_typeof(evidence)='object')
);
CREATE TABLE welfare.care_privacy_consent(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,care_case_id uuid NOT NULL,consent_scope varchar(500) NOT NULL,consent_hash char(64) NOT NULL,
 consented_at timestamptz NOT NULL,evidence jsonb NOT NULL,consented_by uuid NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT fk_p016_consent_case FOREIGN KEY(care_case_id) REFERENCES welfare.care_case(id) ON DELETE RESTRICT,
 CONSTRAINT uk_p016_consent UNIQUE(tenant_id,care_case_id),CONSTRAINT ck_p016_consent_hash CHECK(consent_hash~'^[0-9a-fA-F]{64}$'),
 CONSTRAINT ck_p016_consent_evidence CHECK(jsonb_typeof(evidence)='object')
);
CREATE TABLE welfare.care_approval_fact(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,care_case_id uuid NOT NULL,outcome varchar(16) NOT NULL,authority_reference varchar(160) NOT NULL,
 approved_amount numeric(18,2),decided_at timestamptz NOT NULL,evidence jsonb NOT NULL,decided_by uuid NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT fk_p016_approval_case FOREIGN KEY(care_case_id) REFERENCES welfare.care_case(id) ON DELETE RESTRICT,
 CONSTRAINT uk_p016_approval UNIQUE(tenant_id,care_case_id),CONSTRAINT ck_p016_approval_outcome CHECK(outcome IN ('APPROVED','REJECTED')),
 CONSTRAINT ck_p016_approval_amount CHECK(approved_amount IS NULL OR approved_amount>=0),CONSTRAINT ck_p016_approval_evidence CHECK(jsonb_typeof(evidence)='object')
);
CREATE TABLE welfare.care_execution_receipt(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,care_case_id uuid NOT NULL,execution_kind varchar(24) NOT NULL,
 external_reference varchar(160) NOT NULL,external_occurred_at timestamptz NOT NULL,executed_amount numeric(18,2),currency varchar(8),
 invoice_code varchar(64),invoice_number varchar(64),invoice_date date,invoice_amount numeric(18,2),invoice_image_sha256 char(64),
 evidence jsonb NOT NULL,recorded_by uuid NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT fk_p016_execution_case FOREIGN KEY(care_case_id) REFERENCES welfare.care_case(id) ON DELETE RESTRICT,
 CONSTRAINT uk_p016_execution_case UNIQUE(tenant_id,care_case_id),CONSTRAINT uk_p016_external_receipt UNIQUE(tenant_id,execution_kind,external_reference),
 CONSTRAINT ck_p016_execution_kind CHECK(execution_kind IN ('PAYMENT_RECEIPT','GOODS_DELIVERY','SERVICE_COMPLETION')),
 CONSTRAINT ck_p016_execution_amount CHECK(executed_amount IS NULL OR executed_amount>=0),
 CONSTRAINT ck_p016_invoice_shape CHECK((invoice_code IS NULL AND invoice_number IS NULL AND invoice_date IS NULL AND invoice_amount IS NULL AND invoice_image_sha256 IS NULL) OR (invoice_code IS NOT NULL AND invoice_number IS NOT NULL AND invoice_date IS NOT NULL AND invoice_amount>=0 AND invoice_image_sha256~'^[0-9a-fA-F]{64}$')),
 CONSTRAINT ck_p016_execution_evidence CHECK(jsonb_typeof(evidence)='object')
);
CREATE UNIQUE INDEX uk_p016_invoice ON welfare.care_execution_receipt(tenant_id,invoice_code,invoice_number,invoice_date,invoice_amount,invoice_image_sha256) WHERE invoice_code IS NOT NULL;
CREATE TABLE welfare.care_employee_confirmation(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,care_case_id uuid NOT NULL,outcome varchar(16) NOT NULL,confirmed_at timestamptz NOT NULL,
 evidence jsonb NOT NULL,confirmed_by uuid NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT fk_p016_confirmation_case FOREIGN KEY(care_case_id) REFERENCES welfare.care_case(id) ON DELETE RESTRICT,
 CONSTRAINT uk_p016_confirmation UNIQUE(tenant_id,care_case_id),CONSTRAINT ck_p016_confirmation_outcome CHECK(outcome IN ('CONFIRMED','DISPUTED')),
 CONSTRAINT ck_p016_confirmation_evidence CHECK(jsonb_typeof(evidence)='object')
);
CREATE TABLE welfare.care_reconciliation_fact(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,care_case_id uuid NOT NULL,outcome varchar(16) NOT NULL,external_reference varchar(160) NOT NULL,
 reconciled_at timestamptz NOT NULL,evidence jsonb NOT NULL,reconciled_by uuid NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT fk_p016_reconciliation_case FOREIGN KEY(care_case_id) REFERENCES welfare.care_case(id) ON DELETE RESTRICT,
 CONSTRAINT uk_p016_reconciliation UNIQUE(tenant_id,care_case_id),CONSTRAINT ck_p016_reconciliation_outcome CHECK(outcome IN ('MATCHED','EXCEPTION_RESOLVED')),
 CONSTRAINT ck_p016_reconciliation_evidence CHECK(jsonb_typeof(evidence)='object')
);

ALTER TABLE welfare.care_case_event ENABLE ROW LEVEL SECURITY;ALTER TABLE welfare.care_eligibility_fact ENABLE ROW LEVEL SECURITY;ALTER TABLE welfare.care_privacy_consent ENABLE ROW LEVEL SECURITY;ALTER TABLE welfare.care_approval_fact ENABLE ROW LEVEL SECURITY;ALTER TABLE welfare.care_execution_receipt ENABLE ROW LEVEL SECURITY;ALTER TABLE welfare.care_employee_confirmation ENABLE ROW LEVEL SECURITY;ALTER TABLE welfare.care_reconciliation_fact ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_tenant_p016_event ON welfare.care_case_event USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);
CREATE POLICY p_tenant_p016_eligibility ON welfare.care_eligibility_fact USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);
CREATE POLICY p_tenant_p016_consent ON welfare.care_privacy_consent USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);
CREATE POLICY p_tenant_p016_approval ON welfare.care_approval_fact USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);
CREATE POLICY p_tenant_p016_execution ON welfare.care_execution_receipt USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);
CREATE POLICY p_tenant_p016_confirmation ON welfare.care_employee_confirmation USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);
CREATE POLICY p_tenant_p016_reconciliation ON welfare.care_reconciliation_fact USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);

CREATE OR REPLACE FUNCTION welfare.guard_p016_case() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,welfare,org AS $$
BEGIN
 IF NEW.affected_employee_id IS NULL OR NOT EXISTS(SELECT 1 FROM org.employee e WHERE e.id=NEW.affected_employee_id AND e.tenant_id=NEW.tenant_id AND e.employment_status='ACTIVE' AND NOT e.is_deleted) THEN RAISE EXCEPTION 'P016 affected employee is outside tenant or inactive' USING ERRCODE='23514';END IF;
 IF NEW.created_by IS NULL OR NOT EXISTS(SELECT 1 FROM org.employee e WHERE e.id=NEW.created_by AND e.tenant_id=NEW.tenant_id AND e.employment_status='ACTIVE' AND NOT e.is_deleted) THEN RAISE EXCEPTION 'P016 creator is outside tenant or inactive' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_p016_case_guard BEFORE INSERT ON welfare.care_case FOR EACH ROW WHEN(NEW.source_fact_key IS NOT NULL) EXECUTE FUNCTION welfare.guard_p016_case();
CREATE OR REPLACE FUNCTION welfare.guard_p016_fact() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,welfare,org AS $$
DECLARE actor_id uuid; affected uuid;
BEGIN
 SELECT affected_employee_id INTO affected FROM welfare.care_case WHERE id=NEW.care_case_id AND tenant_id=NEW.tenant_id AND NOT is_deleted;
 IF affected IS NULL THEN RAISE EXCEPTION 'P016 fact references care case outside tenant' USING ERRCODE='23514';END IF;
 IF TG_TABLE_NAME='care_case_event' THEN actor_id:=NEW.actor_employee_id;
 ELSIF TG_TABLE_NAME='care_eligibility_fact' THEN actor_id:=NEW.checked_by;
 ELSIF TG_TABLE_NAME='care_privacy_consent' THEN actor_id:=NEW.consented_by;IF NEW.consented_by<>affected THEN RAISE EXCEPTION 'P016 privacy consent must be recorded by affected employee' USING ERRCODE='23514';END IF;
 ELSIF TG_TABLE_NAME='care_approval_fact' THEN actor_id:=NEW.decided_by;
 ELSIF TG_TABLE_NAME='care_execution_receipt' THEN actor_id:=NEW.recorded_by;
 ELSIF TG_TABLE_NAME='care_employee_confirmation' THEN actor_id:=NEW.confirmed_by;IF NEW.confirmed_by<>affected THEN RAISE EXCEPTION 'P016 confirmation must be recorded by affected employee' USING ERRCODE='23514';END IF;
 ELSE actor_id:=NEW.reconciled_by;END IF;
 IF actor_id IS NULL OR NOT EXISTS(SELECT 1 FROM org.employee e WHERE e.id=actor_id AND e.tenant_id=NEW.tenant_id AND e.employment_status='ACTIVE' AND NOT e.is_deleted) THEN RAISE EXCEPTION 'P016 fact actor is outside tenant or inactive' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_p016_event_guard BEFORE INSERT ON welfare.care_case_event FOR EACH ROW EXECUTE FUNCTION welfare.guard_p016_fact();
CREATE TRIGGER trg_p016_eligibility_guard BEFORE INSERT ON welfare.care_eligibility_fact FOR EACH ROW EXECUTE FUNCTION welfare.guard_p016_fact();
CREATE TRIGGER trg_p016_consent_guard BEFORE INSERT ON welfare.care_privacy_consent FOR EACH ROW EXECUTE FUNCTION welfare.guard_p016_fact();
CREATE TRIGGER trg_p016_approval_guard BEFORE INSERT ON welfare.care_approval_fact FOR EACH ROW EXECUTE FUNCTION welfare.guard_p016_fact();
CREATE TRIGGER trg_p016_execution_guard BEFORE INSERT ON welfare.care_execution_receipt FOR EACH ROW EXECUTE FUNCTION welfare.guard_p016_fact();
CREATE TRIGGER trg_p016_confirmation_guard BEFORE INSERT ON welfare.care_employee_confirmation FOR EACH ROW EXECUTE FUNCTION welfare.guard_p016_fact();
CREATE TRIGGER trg_p016_reconciliation_guard BEFORE INSERT ON welfare.care_reconciliation_fact FOR EACH ROW EXECUTE FUNCTION welfare.guard_p016_fact();
CREATE OR REPLACE FUNCTION welfare.guard_p016_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'P016 lifecycle facts are append-only' USING ERRCODE='55000';END $$;
CREATE TRIGGER trg_p016_event_immutable BEFORE UPDATE OR DELETE ON welfare.care_case_event FOR EACH ROW EXECUTE FUNCTION welfare.guard_p016_immutable();
CREATE TRIGGER trg_p016_eligibility_immutable BEFORE UPDATE OR DELETE ON welfare.care_eligibility_fact FOR EACH ROW EXECUTE FUNCTION welfare.guard_p016_immutable();
CREATE TRIGGER trg_p016_consent_immutable BEFORE UPDATE OR DELETE ON welfare.care_privacy_consent FOR EACH ROW EXECUTE FUNCTION welfare.guard_p016_immutable();
CREATE TRIGGER trg_p016_approval_immutable BEFORE UPDATE OR DELETE ON welfare.care_approval_fact FOR EACH ROW EXECUTE FUNCTION welfare.guard_p016_immutable();
CREATE TRIGGER trg_p016_execution_immutable BEFORE UPDATE OR DELETE ON welfare.care_execution_receipt FOR EACH ROW EXECUTE FUNCTION welfare.guard_p016_immutable();
CREATE TRIGGER trg_p016_confirmation_immutable BEFORE UPDATE OR DELETE ON welfare.care_employee_confirmation FOR EACH ROW EXECUTE FUNCTION welfare.guard_p016_immutable();
CREATE TRIGGER trg_p016_reconciliation_immutable BEFORE UPDATE OR DELETE ON welfare.care_reconciliation_fact FOR EACH ROW EXECUTE FUNCTION welfare.guard_p016_immutable();
REVOKE UPDATE,DELETE,TRUNCATE ON welfare.care_case_event,welfare.care_eligibility_fact,welfare.care_privacy_consent,welfare.care_approval_fact,welfare.care_execution_receipt,welfare.care_employee_confirmation,welfare.care_reconciliation_fact FROM sjg_api_runtime,sjg_worker_runtime;
GRANT SELECT,INSERT ON welfare.care_case_event,welfare.care_eligibility_fact,welfare.care_privacy_consent,welfare.care_approval_fact,welfare.care_execution_receipt,welfare.care_employee_confirmation,welfare.care_reconciliation_fact TO sjg_api_runtime;
GRANT SELECT ON welfare.care_case_event,welfare.care_eligibility_fact,welfare.care_privacy_consent,welfare.care_approval_fact,welfare.care_execution_receipt,welfare.care_employee_confirmation,welfare.care_reconciliation_fact TO sjg_worker_runtime;

INSERT INTO core.sequence_rule(id,tenant_id,rule_code,prefix_template,date_pattern,current_value,step,created_at,updated_at,is_deleted) SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,'P016','P016-','yyyyMMdd',0,1,now(),now(),false WHERE NOT EXISTS(SELECT 1 FROM core.sequence_rule WHERE tenant_id='${sjg_tenant_id}'::uuid AND rule_code='P016' AND NOT is_deleted);
INSERT INTO iam.permission(id,tenant_id,permission_code,permission_name,resource_type,action_code,risk_level,created_at,updated_at,is_deleted)
SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,v.code,v.name,'P016_WELFARE',v.action,v.risk,now(),now(),false FROM (VALUES
('p016.welfare.read','Read authorized welfare case','READ','HIGH'),('p016.welfare.manage','Manage eligibility and archive','MANAGE','HIGH'),('p016.welfare.approve','Record authorized welfare decision','APPROVE','CRITICAL'),('p016.welfare.execute','Record external execution receipt','EXECUTE','CRITICAL'),('p016.welfare.reconcile','Reconcile external execution receipt','RECONCILE','CRITICAL'),('p016.welfare.monitor','Monitor welfare workflow metadata','MONITOR','NORMAL'))v(code,name,action,risk)
WHERE NOT EXISTS(SELECT 1 FROM iam.permission p WHERE p.tenant_id='${sjg_tenant_id}'::uuid AND p.permission_code=v.code AND NOT p.is_deleted);

DO $$ DECLARE d uuid;v uuid;BEGIN
 SELECT id INTO d FROM workflow.wf_definition WHERE tenant_id='${sjg_tenant_id}'::uuid AND process_code='P016' AND enabled AND NOT is_deleted ORDER BY created_at,id LIMIT 1;
 IF d IS NULL THEN d:=gen_random_uuid();INSERT INTO workflow.wf_definition(id,tenant_id,process_code,process_name,module_code,owner_schema,owner_table,enabled,created_at,updated_at,is_deleted) VALUES(d,'${sjg_tenant_id}'::uuid,'P016','Employee welfare and care','Performance growth welfare','welfare','care_case',true,now(),now(),false);END IF;
 IF NOT EXISTS(SELECT 1 FROM workflow.wf_version WHERE tenant_id='${sjg_tenant_id}'::uuid AND definition_id=d AND status='PUBLISHED' AND NOT is_deleted) THEN
  v:=gen_random_uuid();INSERT INTO workflow.wf_version(id,tenant_id,definition_id,version_no,status,definition_json,checksum,created_at,updated_at,is_deleted) VALUES(v,'${sjg_tenant_id}'::uuid,d,1,'DRAFT','{"processCode":"P016","states":["S01","S02","S03","S04","S05","S06","S07","S08","END"],"guards":["eligibility-evidence","affected-employee-privacy-consent","external-human-approval","external-execution-receipt-only","affected-employee-confirmation","independent-reconciliation","archive-complete"]}'::jsonb,'phase11-p016-source-flow-v1',now(),now(),false);
  INSERT INTO workflow.wf_node(id,tenant_id,version_id,node_code,node_name,node_type,actor_rule,sort_no,created_at,updated_at,is_deleted) VALUES
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S01','Trigger or application','START',NULL,10,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S02','Eligibility validation','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',20,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S03','Materials and privacy consent','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"affectedCandidateIds"}',30,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S04','Approval','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"approverCandidateIds"}',40,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S05','External payment goods or service execution','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"executorCandidateIds"}',50,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S06','Employee confirmation','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"affectedCandidateIds"}',60,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S07','Reconciliation','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"reconcilerCandidateIds"}',70,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S08','Archive','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',80,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'END','Closed','END',NULL,90,now(),now(),false);
  INSERT INTO workflow.wf_transition(id,tenant_id,version_id,from_node_code,action_code,to_node_code,is_rollback,created_at,updated_at,is_deleted) VALUES
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S01','SUBMIT_APPLICATION','S02',false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S02','CONFIRM_ELIGIBILITY','S03',false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S02','REJECT_ELIGIBILITY','END',false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S03','AUTHORIZE_PRIVACY','S04',false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S04','APPROVE_CARE','S05',false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S04','REJECT_CARE','END',false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S05','RECORD_EXECUTION','S06',false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S06','CONFIRM_RECEIPT','S07',false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S07','RECONCILE','S08',false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S08','ARCHIVE','END',false,now(),now(),false);
  UPDATE workflow.wf_version SET status='PUBLISHED',effective_at=now(),updated_at=now() WHERE id=v;
 END IF;
END $$;
INSERT INTO workflow.wf_form_definition(id,tenant_id,form_code,form_name,process_code,node_code,version_no,field_schema,layout_schema,validation_schema,visibility_matrix,edit_matrix,enabled,created_at,updated_at,is_deleted)
SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,'CTR-P016-F01','P016 welfare care application','P016','S01',1,
'{"type":"object","required":["affected_employee_id","source_fact_key","care_type","fact_summary"],"properties":{"affected_employee_id":{"type":"string","format":"uuid"},"source_fact_key":{"type":"string","minLength":3},"care_type":{"enum":["MARRIAGE_BIRTH","HARDSHIP","HEALTH","BEREAVEMENT","OTHER"]},"fact_summary":{"type":"string"}}}'::jsonb,
'{"sections":["Application","Affected employee","Privacy","Source evidence"]}'::jsonb,
'{"serverAuthoritative":["workflow_instance_id","eligibility","approval","execution_receipt","employee_confirmation","reconciliation"],"guards":["affected-employee-privacy-consent","external-execution-receipt-only","append-only-facts"]}'::jsonb,
'{"employee":"SELF_READ_AND_CONFIRM","center":"AUTHORIZED_SCOPE","tech":"WORKFLOW_METADATA_ONLY"}'::jsonb,
'{"employee":["privacy_consent","employee_confirmation"],"center":["affected_employee_id","source_fact_key","care_type","fact_summary"],"tech":[]}'::jsonb,
true,now(),now(),false WHERE NOT EXISTS(SELECT 1 FROM workflow.wf_form_definition WHERE tenant_id='${sjg_tenant_id}'::uuid AND form_code='CTR-P016-F01' AND version_no=1 AND NOT is_deleted);

RESET ROLE;
