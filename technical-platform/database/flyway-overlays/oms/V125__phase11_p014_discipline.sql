-- PHASE-11 / P014: discipline responsibility, service evidence and independent appeal.
SET ROLE sjg_owner;

ALTER TABLE reward.discipline_case
  ALTER COLUMN customer_id DROP NOT NULL,
  ALTER COLUMN customer_name DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS current_node_code varchar(16) DEFAULT 'S01' NOT NULL,
  ADD COLUMN IF NOT EXISTS source_fact_key varchar(160),
  ADD COLUMN IF NOT EXISTS source_type varchar(32),
  ADD COLUMN IF NOT EXISTS content_version varchar(64),
  ADD COLUMN IF NOT EXISTS period_no varchar(32),
  ADD COLUMN IF NOT EXISTS investigator_employee_id uuid,
  ADD COLUMN IF NOT EXISTS investigation_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS interview_notes text,
  ADD COLUMN IF NOT EXISTS employee_statement text,
  ADD COLUMN IF NOT EXISTS statement_recorded_at timestamptz,
  ADD COLUMN IF NOT EXISTS decision_employee_id uuid,
  ADD COLUMN IF NOT EXISTS decision_summary text,
  ADD COLUMN IF NOT EXISTS decision_at timestamptz,
  ADD COLUMN IF NOT EXISTS service_proof jsonb,
  ADD COLUMN IF NOT EXISTS decision_served_at timestamptz,
  ADD COLUMN IF NOT EXISTS appeal_window_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS appeal_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS appeal_summary text,
  ADD COLUMN IF NOT EXISTS appeal_evidence jsonb,
  ADD COLUMN IF NOT EXISTS appeal_reviewer_employee_id uuid,
  ADD COLUMN IF NOT EXISTS appeal_review_assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS appeal_result varchar(16),
  ADD COLUMN IF NOT EXISTS appeal_decision text,
  ADD COLUMN IF NOT EXISTS appeal_decision_evidence jsonb,
  ADD COLUMN IF NOT EXISTS appeal_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS appeal_waived boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS waiver_evidence jsonb,
  ADD COLUMN IF NOT EXISTS defect_reopen_reason text,
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE c.conname='ck_p014_current_node'
      AND n.nspname='reward' AND t.relname='discipline_case'
  ) THEN
    EXECUTE $ddl$
      ALTER TABLE reward.discipline_case
      ADD CONSTRAINT ck_p014_current_node CHECK (
        employee_event_type <> 'P014_DISCIPLINE'
        OR current_node_code IN ('S01','S02','S03','S04','S05','S06','S07','S08','S09','S10','END'))
    $ddl$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE c.conname='ck_p014_source_fact_required'
      AND n.nspname='reward' AND t.relname='discipline_case'
  ) THEN
    EXECUTE $ddl$
      ALTER TABLE reward.discipline_case
      ADD CONSTRAINT ck_p014_source_fact_required CHECK (
        employee_event_type <> 'P014_DISCIPLINE'
        OR (source_fact_key IS NOT NULL AND btrim(source_fact_key) <> ''))
      NOT VALID
    $ddl$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE c.conname='ck_p014_investigator_sod'
      AND n.nspname='reward' AND t.relname='discipline_case'
  ) THEN
    EXECUTE $ddl$
      ALTER TABLE reward.discipline_case
      ADD CONSTRAINT ck_p014_investigator_sod CHECK (
        employee_event_type <> 'P014_DISCIPLINE'
        OR investigator_employee_id IS NULL
        OR owner_employee_id IS NULL
        OR investigator_employee_id <> owner_employee_id)
      NOT VALID
    $ddl$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE c.conname='ck_p014_appeal_reviewer_sod'
      AND n.nspname='reward' AND t.relname='discipline_case'
  ) THEN
    EXECUTE $ddl$
      ALTER TABLE reward.discipline_case
      ADD CONSTRAINT ck_p014_appeal_reviewer_sod CHECK (
        employee_event_type <> 'P014_DISCIPLINE'
        OR appeal_reviewer_employee_id IS NULL
        OR decision_employee_id IS NULL
        OR appeal_reviewer_employee_id <> decision_employee_id)
      NOT VALID
    $ddl$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE c.conname='ck_p014_customer_link_scope'
      AND n.nspname='reward' AND t.relname='discipline_case'
  ) THEN
    EXECUTE $ddl$
      ALTER TABLE reward.discipline_case
      ADD CONSTRAINT ck_p014_customer_link_scope CHECK (
        employee_event_type <> 'P014_DISCIPLINE'
        OR (customer_id IS NULL AND customer_name IS NULL)
        OR (upper(coalesce(source_type,''))='CUSTOMER'
            AND customer_id IS NOT NULL AND customer_name IS NOT NULL))
      NOT VALID
    $ddl$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE c.conname='ck_p014_appeal_result'
      AND n.nspname='reward' AND t.relname='discipline_case'
  ) THEN
    EXECUTE $ddl$
      ALTER TABLE reward.discipline_case
      ADD CONSTRAINT ck_p014_appeal_result CHECK (
        employee_event_type <> 'P014_DISCIPLINE'
        OR appeal_result IS NULL
        OR appeal_result IN ('UPHOLD','MODIFY','OVERTURN'))
      NOT VALID
    $ddl$;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_p014_business_no
  ON reward.discipline_case(tenant_id,business_no) WHERE NOT is_deleted;
CREATE UNIQUE INDEX IF NOT EXISTS uq_p014_source_fact
  ON reward.discipline_case(tenant_id,source_fact_key)
  WHERE employee_event_type='P014_DISCIPLINE' AND source_fact_key IS NOT NULL AND NOT is_deleted;
CREATE INDEX IF NOT EXISTS ix_p014_subject
  ON reward.discipline_case(tenant_id,owner_employee_id,created_at DESC)
  WHERE employee_event_type='P014_DISCIPLINE' AND NOT is_deleted;
CREATE INDEX IF NOT EXISTS ix_p014_appeal_reviewer
  ON reward.discipline_case(tenant_id,appeal_reviewer_employee_id,updated_at DESC)
  WHERE employee_event_type='P014_DISCIPLINE' AND appeal_reviewer_employee_id IS NOT NULL AND NOT is_deleted;

ALTER TABLE reward.discipline_case ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_tenant_discipline_case ON reward.discipline_case;
CREATE POLICY p_tenant_discipline_case ON reward.discipline_case
  USING (tenant_id=current_setting('app.tenant_id',true)::uuid)
  WITH CHECK (tenant_id=current_setting('app.tenant_id',true)::uuid);

INSERT INTO core.sequence_rule(
  id,tenant_id,rule_code,prefix_template,date_pattern,current_value,step,
  created_at,updated_at,is_deleted)
SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,'P014','P014-','yyyyMMdd',0,1,now(),now(),false
WHERE NOT EXISTS (
  SELECT 1 FROM core.sequence_rule
  WHERE tenant_id='${sjg_tenant_id}'::uuid AND rule_code='P014' AND NOT is_deleted);

INSERT INTO iam.permission(
  id,tenant_id,permission_code,permission_name,resource_type,action_code,risk_level,
  created_at,updated_at,is_deleted)
SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,v.code,v.name,'PROCESS',v.action,v.risk,now(),now(),false
FROM (VALUES
  ('p014.discipline.create','P014纪律案件登记','CREATE','HIGH'),
  ('p014.discipline.read','P014纪律案件读取','READ','HIGH'),
  ('p014.discipline.investigate','P014纪律调查','INVESTIGATE','HIGH'),
  ('p014.discipline.decide','P014纪律决定与送达','DECIDE','CRITICAL'),
  ('p014.discipline.appeal','P014独立申诉复核','APPEAL','CRITICAL'),
  ('p014.discipline.remediate','P014关闭重开与归档','REMEDIATE','CRITICAL'),
  ('p014.discipline.monitor','P014纪律流程监控','MONITOR','NORMAL')
) AS v(code,name,action,risk)
WHERE NOT EXISTS (
  SELECT 1 FROM iam.permission p
  WHERE p.tenant_id='${sjg_tenant_id}'::uuid
    AND p.permission_code=v.code AND NOT p.is_deleted);

DO $$
DECLARE
  target_definition_id uuid;
  target_version_id uuid;
BEGIN
  SELECT id INTO target_definition_id
  FROM workflow.wf_definition
  WHERE tenant_id='${sjg_tenant_id}'::uuid
    AND process_code='P014' AND enabled AND NOT is_deleted
  ORDER BY created_at,id LIMIT 1;

  IF target_definition_id IS NULL THEN
    target_definition_id:=gen_random_uuid();
    INSERT INTO workflow.wf_definition(
      id,tenant_id,process_code,process_name,module_code,owner_schema,owner_table,
      enabled,created_at,updated_at,is_deleted)
    VALUES(
      target_definition_id,'${sjg_tenant_id}'::uuid,'P014','纪律责任与申诉',
      '绩效成长福利','reward','discipline_case',true,now(),now(),false);
  END IF;

  IF NOT EXISTS (
      SELECT 1 FROM workflow.wf_version
      WHERE tenant_id='${sjg_tenant_id}'::uuid AND definition_id=target_definition_id
        AND status='PUBLISHED' AND checksum='phase11-p014-c0-v1' AND NOT is_deleted) THEN
    target_version_id:=gen_random_uuid();
    INSERT INTO workflow.wf_version(
      id,tenant_id,definition_id,version_no,status,definition_json,checksum,
      created_at,updated_at,is_deleted)
    SELECT target_version_id,'${sjg_tenant_id}'::uuid,target_definition_id,
      coalesce(max(version_no),0)+1,'DRAFT',
      '{"processCode":"P014","source":"PHASE11_C0_CONTRACT","states":["NEW","TRIAGE_PENDING","INVESTIGATING","STATEMENT_RECORDED","DECISION_PENDING","DECISION_SERVED","APPEAL_PENDING","APPEAL_REVIEWING","APPEAL_RESOLVED","CLOSED","ARCHIVED"]}'::jsonb,
      'phase11-p014-c0-v1',now(),now(),false
    FROM workflow.wf_version
    WHERE tenant_id='${sjg_tenant_id}'::uuid AND definition_id=target_definition_id;

    INSERT INTO workflow.wf_node(
      id,tenant_id,version_id,node_code,node_name,node_type,actor_rule,sort_no,
      created_at,updated_at,is_deleted) VALUES
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S01','NEW','START',NULL,10,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S02','TRIAGE_PENDING','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"investigatorCandidateIds"}'::jsonb,20,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S03','INVESTIGATING','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"investigatorCandidateIds"}'::jsonb,30,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S04','STATEMENT_RECORDED','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"decisionCandidateIds"}'::jsonb,40,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S05','DECISION_PENDING','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"decisionCandidateIds"}'::jsonb,50,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S06','DECISION_SERVED','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"appealOrRemediationCandidateIds"}'::jsonb,60,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S07','APPEAL_PENDING','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"appealReviewerIds"}'::jsonb,70,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S08','APPEAL_REVIEWING','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"appealReviewerIds"}'::jsonb,80,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S09','APPEAL_RESOLVED','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"remediationCandidateIds"}'::jsonb,90,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S10','CLOSED','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"remediationCandidateIds"}'::jsonb,100,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'END','ARCHIVED','END',NULL,110,now(),now(),false);

    INSERT INTO workflow.wf_transition(
      id,tenant_id,version_id,from_node_code,action_code,to_node_code,
      condition_expr,is_rollback,created_at,updated_at,is_deleted) VALUES
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S01','REGISTER_LEAD','S02',NULL,false,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S02','OPEN_INVESTIGATION','S03',NULL,false,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S03','RECORD_STATEMENT','S04',NULL,false,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S04','HEARING_DECISION','S05',NULL,false,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S05','SERVE_DECISION','S06',NULL,false,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S06','OPEN_APPEAL','S07',NULL,false,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S07','ASSIGN_APPEAL_REVIEWER','S08',NULL,false,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S08','RESOLVE_APPEAL','S09',NULL,false,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S06','CLOSE_NO_APPEAL','S10',NULL,false,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S09','CLOSE_AFTER_APPEAL','S10',NULL,false,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S10','REOPEN_FOR_DEFECT','S03',NULL,true,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S10','ARCHIVE','END',NULL,false,now(),now(),false);

    UPDATE workflow.wf_version
    SET status='PUBLISHED',effective_at=now(),updated_at=now()
    WHERE tenant_id='${sjg_tenant_id}'::uuid AND id=target_version_id AND status='DRAFT';
  END IF;

  IF NOT EXISTS (
      SELECT 1 FROM workflow.wf_form_definition
      WHERE tenant_id='${sjg_tenant_id}'::uuid
        AND form_code='EMP-P014-F01' AND process_code='P014'
        AND node_code='S01' AND enabled AND NOT is_deleted) THEN
    INSERT INTO workflow.wf_form_definition(
      id,tenant_id,form_code,form_name,process_code,node_code,version_no,
      field_schema,layout_schema,validation_schema,visibility_matrix,edit_matrix,
      enabled,created_at,updated_at,is_deleted)
    VALUES(
      gen_random_uuid(),'${sjg_tenant_id}'::uuid,'EMP-P014-F01',
      '纪律责任与申诉-事实登记单','P014','S01',1,
      '{"type":"object","properties":{"process_code":{"type":"string","readOnly":true},"business_no":{"type":"string","readOnly":true},"subject":{"type":"string"},"reason":{"type":"string"},"owner_employee_id":{"type":"string"},"owner_center_id":{"type":"string"},"fact_summary":{"type":"string"},"source_fact_key":{"type":"string"},"source_type":{"type":"string"},"impact_level":{"type":"string"}},"required":["subject","reason","owner_employee_id","owner_center_id","fact_summary","source_fact_key","source_type","impact_level"]}'::jsonb,
      '{"sections":["纪律事实","被调查员工","来源与影响"]}'::jsonb,
      '{"serverAuthoritative":["business_no","workflow_instance_id","status","current_node_code","version_no","investigator_employee_id","decision_employee_id","appeal_reviewer_employee_id","appeal_result","closed_at","archived_at"]}'::jsonb,
      '{"employee":"SELF","center":"AUTHORIZED_SCOPE","tech":"METADATA_ONLY"}'::jsonb,
      '{"employee":[],"center":["subject","reason","owner_employee_id","owner_center_id","fact_summary","source_fact_key","source_type","impact_level","customer_id","customer_name"],"tech":[]}'::jsonb,
      true,now(),now(),false);
  END IF;
END $$;

RESET ROLE;
