-- PHASE-11 / P015 source-backed append-only growth and honor point ledger.
SET ROLE sjg_owner;

ALTER TABLE reward.point_transaction ADD COLUMN source_fact_key varchar(160);
ALTER TABLE reward.point_transaction ADD COLUMN affected_employee_id uuid;
ALTER TABLE reward.point_transaction ADD COLUMN point_kind varchar(16);
ALTER TABLE reward.point_transaction ADD COLUMN rule_version_id uuid;
ALTER TABLE reward.point_transaction ADD COLUMN original_transaction_id uuid;
ALTER TABLE reward.point_transaction ADD COLUMN expires_at timestamptz;
ALTER TABLE reward.point_transaction ADD COLUMN business_object_type varchar(64);
ALTER TABLE reward.point_transaction ADD COLUMN business_object_no varchar(64);
ALTER TABLE reward.point_transaction ADD COLUMN business_object_name varchar(200);
ALTER TABLE reward.point_transaction ADD COLUMN quantity bigint;
ALTER TABLE reward.point_transaction ADD COLUMN calculated_points bigint;
ALTER TABLE reward.point_transaction ADD COLUMN capped_points bigint;
ALTER TABLE reward.point_transaction ALTER COLUMN status TYPE varchar(64);
ALTER TABLE reward.point_transaction ADD CONSTRAINT ck_p015_source CHECK(source_fact_key IS NULL OR length(trim(source_fact_key)) BETWEEN 3 AND 160);
ALTER TABLE reward.point_transaction ADD CONSTRAINT ck_p015_kind CHECK(point_kind IS NULL OR point_kind IN ('GROWTH','HONOR'));
ALTER TABLE reward.point_transaction ADD CONSTRAINT ck_p015_change CHECK(change_action IN ('AWARD','ADJUSTMENT','REVERSAL'));
ALTER TABLE reward.point_transaction ADD CONSTRAINT ck_p015_original_shape CHECK((change_action='AWARD' AND original_transaction_id IS NULL) OR (change_action IN ('ADJUSTMENT','REVERSAL') AND original_transaction_id IS NOT NULL));
ALTER TABLE reward.point_transaction ADD CONSTRAINT ck_p015_calculation CHECK(quantity IS NULL OR (quantity>0 AND calculated_points IS NOT NULL AND capped_points IS NOT NULL AND points_delta=capped_points));
CREATE UNIQUE INDEX uk_p015_source ON reward.point_transaction(tenant_id,source_fact_key) WHERE source_fact_key IS NOT NULL AND change_action='AWARD' AND NOT is_deleted;
CREATE INDEX ix_p015_employee_time ON reward.point_transaction(tenant_id,affected_employee_id,fact_occurred_at,id);

CREATE TABLE reward.point_rule_version(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,rule_code varchar(64) NOT NULL,version_no integer NOT NULL,
 point_kind varchar(16) NOT NULL,event_type varchar(64) NOT NULL,unit_points bigint NOT NULL,min_points bigint NOT NULL,max_points bigint NOT NULL,
 manual_review_threshold bigint NOT NULL,effective_from timestamptz NOT NULL,effective_to timestamptz,status varchar(16) NOT NULL DEFAULT 'DRAFT',
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),published_by uuid,published_at timestamptz,
 CONSTRAINT uk_p015_rule_version UNIQUE(tenant_id,rule_code,version_no),CONSTRAINT ck_p015_rule_kind CHECK(point_kind IN ('GROWTH','HONOR')),
 CONSTRAINT ck_p015_rule_bounds CHECK(min_points<=max_points AND unit_points BETWEEN min_points AND max_points AND manual_review_threshold>=0),
 CONSTRAINT ck_p015_rule_time CHECK(effective_to IS NULL OR effective_to>effective_from),CONSTRAINT ck_p015_rule_status CHECK(status IN ('DRAFT','PUBLISHED'))
);
CREATE TABLE reward.point_rank_rule(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,rule_version_id uuid NOT NULL,rank_code varchar(32) NOT NULL,min_balance bigint NOT NULL,max_balance bigint,
 created_at timestamptz NOT NULL DEFAULT now(),CONSTRAINT fk_p015_rank_rule FOREIGN KEY(rule_version_id) REFERENCES reward.point_rule_version(id) ON DELETE RESTRICT,
 CONSTRAINT uk_p015_rank UNIQUE(tenant_id,rule_version_id,rank_code),CONSTRAINT ck_p015_rank_bounds CHECK(max_balance IS NULL OR max_balance>=min_balance)
);
CREATE TABLE reward.point_transaction_event(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,point_transaction_id uuid NOT NULL,event_seq integer NOT NULL,event_type varchar(48) NOT NULL,
 evidence jsonb NOT NULL,actor_employee_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT fk_p015_event_transaction FOREIGN KEY(point_transaction_id) REFERENCES reward.point_transaction(id) ON DELETE RESTRICT,
 CONSTRAINT uk_p015_event_seq UNIQUE(tenant_id,point_transaction_id,event_seq),CONSTRAINT ck_p015_event_evidence CHECK(jsonb_typeof(evidence)='object')
);
CREATE TABLE reward.point_posting_fact(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,point_transaction_id uuid NOT NULL,posted_points bigint NOT NULL,rule_version_id uuid NOT NULL,
 posting_mode varchar(16) NOT NULL,risk_grade varchar(8) NOT NULL,evidence jsonb NOT NULL,posted_by uuid NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT fk_p015_post_transaction FOREIGN KEY(point_transaction_id) REFERENCES reward.point_transaction(id) ON DELETE RESTRICT,
 CONSTRAINT fk_p015_post_rule FOREIGN KEY(rule_version_id) REFERENCES reward.point_rule_version(id) ON DELETE RESTRICT,
 CONSTRAINT uk_p015_post UNIQUE(tenant_id,point_transaction_id),CONSTRAINT ck_p015_post_mode CHECK(posting_mode IN ('AUTOMATIC','MANUAL_REVIEW')),
 CONSTRAINT ck_p015_post_risk CHECK(risk_grade IN ('L1','L2','L3','L4')),CONSTRAINT ck_p015_post_evidence CHECK(jsonb_typeof(evidence)='object')
);
CREATE TABLE reward.point_balance_fact(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,point_transaction_id uuid NOT NULL,affected_employee_id uuid NOT NULL,
 effective_balance bigint NOT NULL,rank_code varchar(32) NOT NULL,calculated_at timestamptz NOT NULL DEFAULT now(),evidence jsonb NOT NULL,calculated_by uuid NOT NULL,
 CONSTRAINT fk_p015_balance_transaction FOREIGN KEY(point_transaction_id) REFERENCES reward.point_transaction(id) ON DELETE RESTRICT,
 CONSTRAINT uk_p015_balance UNIQUE(tenant_id,point_transaction_id),CONSTRAINT ck_p015_balance_evidence CHECK(jsonb_typeof(evidence)='object')
);
CREATE INDEX ix_p015_event ON reward.point_transaction_event(tenant_id,point_transaction_id,event_seq);
CREATE INDEX ix_p015_post ON reward.point_posting_fact(tenant_id,posted_at);
CREATE INDEX ix_p015_balance_employee ON reward.point_balance_fact(tenant_id,affected_employee_id,calculated_at);

ALTER TABLE reward.point_rule_version ENABLE ROW LEVEL SECURITY;ALTER TABLE reward.point_rank_rule ENABLE ROW LEVEL SECURITY;ALTER TABLE reward.point_transaction_event ENABLE ROW LEVEL SECURITY;ALTER TABLE reward.point_posting_fact ENABLE ROW LEVEL SECURITY;ALTER TABLE reward.point_balance_fact ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_tenant_p015_rule ON reward.point_rule_version USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);
CREATE POLICY p_tenant_p015_rank ON reward.point_rank_rule USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);
CREATE POLICY p_tenant_p015_event ON reward.point_transaction_event USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);
CREATE POLICY p_tenant_p015_post ON reward.point_posting_fact USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);
CREATE POLICY p_tenant_p015_balance ON reward.point_balance_fact USING(tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);

CREATE OR REPLACE FUNCTION reward.guard_p015_tenant() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,reward,org AS $$
DECLARE actor_id uuid; tx_employee uuid; tx_rule uuid;
BEGIN
 IF TG_TABLE_NAME='point_rule_version' THEN actor_id:=COALESCE(NEW.published_by,NEW.created_by);
 ELSIF TG_TABLE_NAME='point_rank_rule' THEN SELECT created_by INTO actor_id FROM reward.point_rule_version WHERE id=NEW.rule_version_id AND tenant_id=NEW.tenant_id;
 ELSE
  SELECT affected_employee_id,rule_version_id INTO tx_employee,tx_rule FROM reward.point_transaction WHERE id=NEW.point_transaction_id AND tenant_id=NEW.tenant_id AND NOT is_deleted;
  IF tx_employee IS NULL THEN RAISE EXCEPTION 'P015 fact references transaction outside tenant' USING ERRCODE='23514'; END IF;
  IF TG_TABLE_NAME='point_transaction_event' THEN actor_id:=NEW.actor_employee_id;
  ELSIF TG_TABLE_NAME='point_posting_fact' THEN actor_id:=NEW.posted_by;IF NEW.rule_version_id<>tx_rule THEN RAISE EXCEPTION 'P015 posting rule mismatch' USING ERRCODE='23514';END IF;
  ELSE actor_id:=NEW.calculated_by;IF NEW.affected_employee_id<>tx_employee THEN RAISE EXCEPTION 'P015 balance employee mismatch' USING ERRCODE='23514';END IF;END IF;
 END IF;
 IF actor_id IS NULL OR NOT EXISTS(SELECT 1 FROM org.employee e WHERE e.id=actor_id AND e.tenant_id=NEW.tenant_id AND NOT e.is_deleted) THEN RAISE EXCEPTION 'P015 actor is outside tenant' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_p015_rule_tenant BEFORE INSERT OR UPDATE ON reward.point_rule_version FOR EACH ROW EXECUTE FUNCTION reward.guard_p015_tenant();
CREATE TRIGGER trg_p015_rank_tenant BEFORE INSERT OR UPDATE ON reward.point_rank_rule FOR EACH ROW EXECUTE FUNCTION reward.guard_p015_tenant();
CREATE TRIGGER trg_p015_event_tenant BEFORE INSERT OR UPDATE ON reward.point_transaction_event FOR EACH ROW EXECUTE FUNCTION reward.guard_p015_tenant();
CREATE TRIGGER trg_p015_post_tenant BEFORE INSERT OR UPDATE ON reward.point_posting_fact FOR EACH ROW EXECUTE FUNCTION reward.guard_p015_tenant();
CREATE TRIGGER trg_p015_balance_tenant BEFORE INSERT OR UPDATE ON reward.point_balance_fact FOR EACH ROW EXECUTE FUNCTION reward.guard_p015_tenant();
CREATE OR REPLACE FUNCTION reward.guard_p015_transaction_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,reward,org,workflow AS $$
DECLARE original_points bigint; original_employee uuid; original_kind varchar(16);
BEGIN
 IF NEW.affected_employee_id IS NULL OR NOT EXISTS(SELECT 1 FROM org.employee e WHERE e.id=NEW.affected_employee_id AND e.tenant_id=NEW.tenant_id AND e.employment_status='ACTIVE' AND NOT e.is_deleted) THEN RAISE EXCEPTION 'P015 affected employee is outside tenant or inactive' USING ERRCODE='23514';END IF;
 IF NEW.rule_version_id IS NULL OR NOT EXISTS(SELECT 1 FROM reward.point_rule_version r WHERE r.id=NEW.rule_version_id AND r.tenant_id=NEW.tenant_id AND r.status='PUBLISHED' AND r.point_kind=NEW.point_kind AND r.effective_from<=NEW.fact_occurred_at AND (r.effective_to IS NULL OR r.effective_to>NEW.fact_occurred_at)) THEN RAISE EXCEPTION 'P015 effective published rule mismatch' USING ERRCODE='23514';END IF;
 IF NEW.workflow_instance_id IS NULL OR NOT EXISTS(SELECT 1 FROM workflow.wf_instance w WHERE w.id=NEW.workflow_instance_id AND w.tenant_id=NEW.tenant_id AND NOT w.is_deleted) THEN RAISE EXCEPTION 'P015 workflow instance is outside tenant' USING ERRCODE='23514';END IF;
 IF NEW.original_transaction_id IS NOT NULL THEN
  SELECT x.points_delta,x.affected_employee_id,x.point_kind INTO original_points,original_employee,original_kind FROM reward.point_transaction x WHERE x.id=NEW.original_transaction_id AND x.tenant_id=NEW.tenant_id AND NOT x.is_deleted;
  IF original_employee IS NULL OR original_employee<>NEW.affected_employee_id OR original_kind<>NEW.point_kind THEN RAISE EXCEPTION 'P015 correction original transaction mismatch' USING ERRCODE='23514';END IF;
  IF NOT EXISTS(SELECT 1 FROM reward.point_posting_fact p WHERE p.tenant_id=NEW.tenant_id AND p.point_transaction_id=NEW.original_transaction_id) THEN RAISE EXCEPTION 'P015 correction requires a posted original transaction' USING ERRCODE='23514';END IF;
  IF NEW.change_action='REVERSAL' AND NEW.points_delta<>-original_points THEN RAISE EXCEPTION 'P015 reversal must negate the original posted points' USING ERRCODE='23514';END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_p015_transaction_insert BEFORE INSERT ON reward.point_transaction FOR EACH ROW WHEN(NEW.affected_employee_id IS NOT NULL) EXECUTE FUNCTION reward.guard_p015_transaction_insert();
CREATE OR REPLACE FUNCTION reward.guard_p015_rank_overlap() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM reward.point_rank_rule r WHERE r.tenant_id=NEW.tenant_id AND r.rule_version_id=NEW.rule_version_id AND r.id<>NEW.id AND int8range(r.min_balance,r.max_balance,'[]') && int8range(NEW.min_balance,NEW.max_balance,'[]')) THEN RAISE EXCEPTION 'P015 rank ranges overlap' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_p015_rank_overlap BEFORE INSERT OR UPDATE ON reward.point_rank_rule FOR EACH ROW EXECUTE FUNCTION reward.guard_p015_rank_overlap();
CREATE OR REPLACE FUNCTION reward.guard_p015_rank_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_rule uuid; target_tenant uuid;
BEGIN
 IF TG_OP='DELETE' THEN target_rule:=OLD.rule_version_id;target_tenant:=OLD.tenant_id;ELSE target_rule:=NEW.rule_version_id;target_tenant:=NEW.tenant_id;END IF;
 IF EXISTS(SELECT 1 FROM reward.point_rule_version r WHERE r.id=target_rule AND r.tenant_id=target_tenant AND r.status='PUBLISHED') THEN RAISE EXCEPTION 'P015 published rule ranks are immutable' USING ERRCODE='55000';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $$;
CREATE TRIGGER trg_p015_rank_mutation BEFORE INSERT OR UPDATE OR DELETE ON reward.point_rank_rule FOR EACH ROW EXECUTE FUNCTION reward.guard_p015_rank_mutation();
CREATE OR REPLACE FUNCTION reward.guard_p015_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'P015 ledger facts are append-only' USING ERRCODE='55000';END $$;
CREATE TRIGGER trg_p015_transaction_immutable BEFORE UPDATE OR DELETE ON reward.point_transaction FOR EACH ROW EXECUTE FUNCTION reward.guard_p015_immutable();
CREATE TRIGGER trg_p015_event_immutable BEFORE UPDATE OR DELETE ON reward.point_transaction_event FOR EACH ROW EXECUTE FUNCTION reward.guard_p015_immutable();
CREATE TRIGGER trg_p015_post_immutable BEFORE UPDATE OR DELETE ON reward.point_posting_fact FOR EACH ROW EXECUTE FUNCTION reward.guard_p015_immutable();
CREATE TRIGGER trg_p015_balance_immutable BEFORE UPDATE OR DELETE ON reward.point_balance_fact FOR EACH ROW EXECUTE FUNCTION reward.guard_p015_immutable();
CREATE OR REPLACE FUNCTION reward.guard_p015_published_rule() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.status='PUBLISHED' THEN RAISE EXCEPTION 'P015 published rule is immutable' USING ERRCODE='55000';END IF;RETURN NEW;END $$;
CREATE TRIGGER trg_p015_published_rule BEFORE UPDATE OR DELETE ON reward.point_rule_version FOR EACH ROW EXECUTE FUNCTION reward.guard_p015_published_rule();
REVOKE UPDATE,DELETE,TRUNCATE ON reward.point_transaction,reward.point_transaction_event,reward.point_posting_fact,reward.point_balance_fact FROM sjg_api_runtime,sjg_worker_runtime;
GRANT SELECT,INSERT ON reward.point_transaction,reward.point_transaction_event,reward.point_posting_fact,reward.point_balance_fact TO sjg_api_runtime;
GRANT SELECT ON reward.point_transaction,reward.point_transaction_event,reward.point_posting_fact,reward.point_balance_fact TO sjg_worker_runtime;
GRANT SELECT,INSERT,UPDATE ON reward.point_rule_version,reward.point_rank_rule TO sjg_api_runtime;GRANT SELECT ON reward.point_rule_version,reward.point_rank_rule TO sjg_worker_runtime;

INSERT INTO core.sequence_rule(id,tenant_id,rule_code,prefix_template,date_pattern,current_value,step,created_at,updated_at,is_deleted) SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,'P015','P015-','yyyyMMdd',0,1,now(),now(),false WHERE NOT EXISTS(SELECT 1 FROM core.sequence_rule WHERE tenant_id='${sjg_tenant_id}'::uuid AND rule_code='P015' AND NOT is_deleted);
INSERT INTO iam.permission(id,tenant_id,permission_code,permission_name,resource_type,action_code,risk_level,created_at,updated_at,is_deleted)
SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,v.code,v.name,'P015_POINTS',v.action,v.risk,now(),now(),false FROM (VALUES
('p015.points.read','Read own point ledger','READ','NORMAL'),('p015.points.manage','Manage point source and rules','MANAGE','HIGH'),('p015.points.review','Review point risk and posting','REVIEW','CRITICAL'),('p015.points.adjust','Submit or review append-only adjustment','ADJUST','CRITICAL'),('p015.points.monitor','Monitor point rule and workflow metadata','MONITOR','NORMAL'))v(code,name,action,risk)
WHERE NOT EXISTS(SELECT 1 FROM iam.permission p WHERE p.tenant_id='${sjg_tenant_id}'::uuid AND p.permission_code=v.code AND NOT p.is_deleted);

DO $$ DECLARE d uuid;v uuid;BEGIN
 SELECT id INTO d FROM workflow.wf_definition WHERE tenant_id='${sjg_tenant_id}'::uuid AND process_code='P015' AND enabled AND NOT is_deleted ORDER BY created_at,id LIMIT 1;
 IF d IS NULL THEN d:=gen_random_uuid();INSERT INTO workflow.wf_definition(id,tenant_id,process_code,process_name,module_code,owner_schema,owner_table,enabled,created_at,updated_at,is_deleted) VALUES(d,'${sjg_tenant_id}'::uuid,'P015','Growth and honor points','Performance growth welfare','reward','point_transaction',true,now(),now(),false);END IF;
 IF NOT EXISTS(SELECT 1 FROM workflow.wf_version WHERE tenant_id='${sjg_tenant_id}'::uuid AND definition_id=d AND status='PUBLISHED' AND NOT is_deleted) THEN
  v:=gen_random_uuid();INSERT INTO workflow.wf_version(id,tenant_id,definition_id,version_no,status,definition_json,checksum,created_at,updated_at,is_deleted) VALUES(v,'${sjg_tenant_id}'::uuid,d,1,'DRAFT','{"processCode":"P015","states":["S01","S02","S03","S04","S05","S06","S07","S08","S09","S10","END"],"guards":["append-only-ledger","published-rule-required","source-deduplication","manual-review-for-risk","adjustment-adds-linked-row","balance-and-rank-from-posted-ledger"]}'::jsonb,'phase11-p015-source-flow-v1',now(),now(),false);
  INSERT INTO workflow.wf_node(id,tenant_id,version_id,node_code,node_name,node_type,actor_rule,sort_no,created_at,updated_at,is_deleted) VALUES
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S01','Business event','START',NULL,10,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S02','Person and source validation','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',20,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S03','Exception and duplicate validation','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',30,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S04','Rule version match','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',40,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S05','Calculation and cap','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',50,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S06','Risk classification','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"reviewerCandidateIds"}',60,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S07','Automatic posting or manual review','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"reviewerCandidateIds"}',70,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S08','Employee notification','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"ownerCandidateIds"}',80,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S09','Appeal adjustment or reversal','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"adjusterCandidateIds"}',90,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S10','Balance and rank recalculation','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds","allowInitiator":true}',100,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'END','Closed','END',NULL,110,now(),now(),false);
  INSERT INTO workflow.wf_transition(id,tenant_id,version_id,from_node_code,action_code,to_node_code,is_rollback,created_at,updated_at,is_deleted) VALUES
  (gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S01','REGISTER_EVENT','S02',false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S02','VALIDATE_SOURCE','S03',false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S03','CHECK_DUPLICATE','S04',false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S04','MATCH_RULE','S05',false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S05','CALCULATE_CAP','S06',false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S06','CLASSIFY_RISK','S07',false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S07','POST_LEDGER','S08',false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S08','CONFIRM_NOTICE','S09',false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S09','SUBMIT_ADJUSTMENT','S09',false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S09','REVIEW_ADJUSTMENT','S10',false,now(),now(),false),(gen_random_uuid(),'${sjg_tenant_id}'::uuid,v,'S10','RECALCULATE_BALANCE','END',false,now(),now(),false);
  UPDATE workflow.wf_version SET status='PUBLISHED',effective_at=now(),updated_at=now() WHERE id=v;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM workflow.wf_form_definition WHERE tenant_id='${sjg_tenant_id}'::uuid AND form_code='CTR-P015-F01' AND process_code='P015' AND node_code='S01' AND enabled AND NOT is_deleted) THEN
  INSERT INTO workflow.wf_form_definition(id,tenant_id,form_code,form_name,process_code,node_code,version_no,field_schema,layout_schema,validation_schema,visibility_matrix,edit_matrix,enabled,created_at,updated_at,is_deleted) VALUES(gen_random_uuid(),'${sjg_tenant_id}'::uuid,'CTR-P015-F01','Point business event','P015','S01',1,'{"type":"object","properties":{"affected_employee_id":{"type":"string","format":"uuid"},"source_fact_key":{"type":"string","minLength":3},"point_kind":{"enum":["GROWTH","HONOR"]},"employee_event_type":{"type":"string"}}}'::jsonb,'{"sections":["Business event","Employee","Published rule","Immutable evidence"]}'::jsonb,'{"serverAuthoritative":["workflow_instance_id","rule_version","calculated_points","capped_points","risk_grade","posting_fact","effective_balance","rank"],"guards":["append-only","published-rule-required","adjustment-linked-to-original"]}'::jsonb,'{"employee":"SELF_READ","center":"AUTHORIZED_SCOPE","tech":"RULE_AND_METADATA_ONLY"}'::jsonb,'{"employee":[],"center":["affected_employee_id","source_fact_key","point_kind","employee_event_type"],"tech":[]}'::jsonb,true,now(),now(),false);
 END IF;
END $$;
RESET ROLE;
