CREATE OR REPLACE VIEW workflow.v_my_pending_task AS
SELECT t.tenant_id,t.id,t.task_no,t.instance_id,t.node_code,t.assignee_id,t.status,t.received_at,t.due_at,i.title,i.process_code
FROM workflow.wf_task t JOIN workflow.wf_instance i ON i.id=t.instance_id
WHERE t.status IN ('PENDING','CLAIMED');

CREATE OR REPLACE VIEW workflow.v_process_sla AS
SELECT i.tenant_id,i.process_code,i.status,count(*) AS instance_count,
       count(*) FILTER (WHERE i.due_at IS NOT NULL AND i.due_at < now() AND i.status='RUNNING') AS overdue_count
FROM workflow.wf_instance i GROUP BY i.tenant_id,i.process_code,i.status;
