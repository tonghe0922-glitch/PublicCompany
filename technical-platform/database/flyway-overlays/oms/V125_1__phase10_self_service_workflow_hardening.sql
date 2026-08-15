-- CXR-03: publish immutable successors for PHASE-10 employee self-service task nodes.
-- Published predecessors are never updated. P008/S03 and P008/S08 are copied byte-for-byte;
-- the only semantic actor-rule deltas are P007/S05,S06, P008/S07, and P009/S04.
SET ROLE sjg_owner;

DO $$
DECLARE
    process_code_value text;
    definition_id_value uuid;
    predecessor workflow.wf_version%ROWTYPE;
    successor_id uuid;
    successor_version integer;
    successor_checksum text;
    predecessor_node_count integer;
    predecessor_transition_count integer;
    successor_node_count integer;
    successor_transition_count integer;
    actor_rule_delta_count integer;
BEGIN
    FOREACH process_code_value IN ARRAY ARRAY['P007','P008','P009'] LOOP
        SELECT d.id
          INTO STRICT definition_id_value
          FROM workflow.wf_definition d
         WHERE d.tenant_id='${sjg_tenant_id}'::uuid
           AND d.process_code=process_code_value
           AND d.enabled
           AND NOT d.is_deleted;

        SELECT v.*
          INTO STRICT predecessor
          FROM workflow.wf_version v
         WHERE v.tenant_id='${sjg_tenant_id}'::uuid
           AND v.definition_id=definition_id_value
           AND v.status='PUBLISHED'
           AND NOT v.is_deleted
         ORDER BY v.version_no DESC,v.id
         LIMIT 1;

        IF EXISTS (
            SELECT 1 FROM workflow.wf_version v
             WHERE v.tenant_id='${sjg_tenant_id}'::uuid
               AND v.definition_id=definition_id_value
               AND v.definition_json->>'supersedesVersionId'=predecessor.id::text
               AND v.definition_json->>'hardeningId'='CXR-03'
               AND NOT v.is_deleted
        ) THEN
            RAISE EXCEPTION 'CXR-03 successor already exists for %',process_code_value USING ERRCODE='23505';
        END IF;

        SELECT coalesce(max(v.version_no),0)+1
          INTO successor_version
          FROM workflow.wf_version v
         WHERE v.tenant_id='${sjg_tenant_id}'::uuid
           AND v.definition_id=definition_id_value
           AND NOT v.is_deleted;

        successor_checksum:=encode(digest(
            convert_to(predecessor.checksum||'|CXR-03|'||process_code_value||'|self-service-v1','UTF8'),
            'sha256'),'hex');
        successor_id:=gen_random_uuid();

        INSERT INTO workflow.wf_version(
            id,tenant_id,created_by,created_at,updated_by,updated_at,is_deleted,deleted_at,
            definition_id,version_no,status,effective_at,definition_json,checksum)
        VALUES(
            successor_id,'${sjg_tenant_id}'::uuid,predecessor.created_by,now(),predecessor.updated_by,now(),false,NULL,
            definition_id_value,successor_version,'DRAFT',NULL,
            predecessor.definition_json||jsonb_build_object(
                'supersedesVersionId',predecessor.id::text,
                'hardeningId','CXR-03',
                'successorChecksum',successor_checksum,
                'checksumAlgorithm','sha256(predecessorChecksum|CXR-03|processCode|self-service-v1)'),
            successor_checksum);

        INSERT INTO workflow.wf_node(
            id,tenant_id,created_by,created_at,updated_by,updated_at,is_deleted,deleted_at,
            version_id,node_code,node_name,node_type,actor_rule,sla_policy_id,sort_no)
        SELECT gen_random_uuid(),n.tenant_id,n.created_by,now(),n.updated_by,now(),false,NULL,
               successor_id,n.node_code,n.node_name,n.node_type,
               CASE
                   WHEN process_code_value='P007' AND n.node_code IN ('S05','S06')
                       THEN '{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"targetEmployeeIds","allowInitiator":true}'::jsonb
                   WHEN process_code_value='P008' AND n.node_code='S07'
                       THEN '{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"targetEmployeeIds","allowInitiator":true}'::jsonb
                   WHEN process_code_value='P009' AND n.node_code='S04'
                       THEN '{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"targetEmployeeIds","allowInitiator":true}'::jsonb
                   ELSE n.actor_rule
               END,
               n.sla_policy_id,n.sort_no
          FROM workflow.wf_node n
         WHERE n.tenant_id='${sjg_tenant_id}'::uuid
           AND n.version_id=predecessor.id
           AND NOT n.is_deleted;

        INSERT INTO workflow.wf_transition(
            id,tenant_id,created_by,created_at,updated_by,updated_at,is_deleted,deleted_at,
            version_id,from_node_code,action_code,to_node_code,condition_expr,is_rollback)
        SELECT gen_random_uuid(),t.tenant_id,t.created_by,now(),t.updated_by,now(),false,NULL,
               successor_id,t.from_node_code,t.action_code,t.to_node_code,t.condition_expr,t.is_rollback
          FROM workflow.wf_transition t
         WHERE t.tenant_id='${sjg_tenant_id}'::uuid
           AND t.version_id=predecessor.id
           AND NOT t.is_deleted;

        SELECT count(*) INTO predecessor_node_count FROM workflow.wf_node
         WHERE tenant_id='${sjg_tenant_id}'::uuid AND version_id=predecessor.id AND NOT is_deleted;
        SELECT count(*) INTO successor_node_count FROM workflow.wf_node
         WHERE tenant_id='${sjg_tenant_id}'::uuid AND version_id=successor_id AND NOT is_deleted;
        SELECT count(*) INTO predecessor_transition_count FROM workflow.wf_transition
         WHERE tenant_id='${sjg_tenant_id}'::uuid AND version_id=predecessor.id AND NOT is_deleted;
        SELECT count(*) INTO successor_transition_count FROM workflow.wf_transition
         WHERE tenant_id='${sjg_tenant_id}'::uuid AND version_id=successor_id AND NOT is_deleted;
        IF successor_node_count<>predecessor_node_count OR successor_transition_count<>predecessor_transition_count THEN
            RAISE EXCEPTION 'CXR-03 graph copy mismatch for %',process_code_value USING ERRCODE='55000';
        END IF;

        SELECT count(*)
          INTO actor_rule_delta_count
          FROM workflow.wf_node old_node
          JOIN workflow.wf_node new_node
            ON new_node.tenant_id=old_node.tenant_id
           AND new_node.node_code=old_node.node_code
           AND new_node.version_id=successor_id
           AND NOT new_node.is_deleted
         WHERE old_node.tenant_id='${sjg_tenant_id}'::uuid
           AND old_node.version_id=predecessor.id
           AND NOT old_node.is_deleted
           AND new_node.actor_rule IS DISTINCT FROM old_node.actor_rule;
        IF actor_rule_delta_count<>(CASE process_code_value WHEN 'P007' THEN 2 WHEN 'P008' THEN 1 WHEN 'P009' THEN 1 END) THEN
            RAISE EXCEPTION 'CXR-03 actor rule delta scope mismatch for %: %',process_code_value,actor_rule_delta_count USING ERRCODE='55000';
        END IF;

        IF process_code_value='P008' AND EXISTS (
            SELECT 1
              FROM workflow.wf_node old_node
              JOIN workflow.wf_node new_node
                ON new_node.tenant_id=old_node.tenant_id
               AND new_node.node_code=old_node.node_code
               AND new_node.version_id=successor_id
             WHERE old_node.tenant_id='${sjg_tenant_id}'::uuid
               AND old_node.version_id=predecessor.id
               AND old_node.node_code IN ('S03','S08')
               AND new_node.actor_rule IS DISTINCT FROM old_node.actor_rule
        ) THEN
            RAISE EXCEPTION 'CXR-03 must inherit P008/S03,S08 actor rules exactly' USING ERRCODE='55000';
        END IF;

        UPDATE workflow.wf_version
           SET status='PUBLISHED',effective_at=now(),updated_at=now()
         WHERE tenant_id='${sjg_tenant_id}'::uuid
           AND id=successor_id
           AND status='DRAFT';
        IF NOT FOUND THEN
            RAISE EXCEPTION 'CXR-03 successor publish failed for %',process_code_value USING ERRCODE='55000';
        END IF;
    END LOOP;
END
$$;

RESET ROLE;
