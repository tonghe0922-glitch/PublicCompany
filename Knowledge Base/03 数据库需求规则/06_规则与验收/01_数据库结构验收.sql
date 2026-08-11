-- 1. 检查无主键表
SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind='r' AND n.nspname NOT IN ('pg_catalog','information_schema')
AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid=c.oid AND i.indisprimary);

-- 2. 检查业务表是否缺tenant_id
SELECT table_schema,table_name FROM information_schema.tables t
WHERE table_type='BASE TABLE' AND table_schema NOT IN ('pg_catalog','information_schema')
AND table_schema NOT IN ('analytics')
AND NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema=t.table_schema AND c.table_name=t.table_name AND c.column_name='tenant_id');

-- 3. 检查孤儿流程业务对象
SELECT i.id,i.process_code,i.business_object_type,i.business_object_id
FROM workflow.wf_instance i WHERE i.business_object_id IS NULL AND i.status NOT IN ('CANCELLED');

-- 4. 检查Outbox积压
SELECT publish_status,count(*),min(created_at) oldest FROM core.outbox_event GROUP BY publish_status;

-- 5. 检查超期任务
SELECT process_code,count(*) FROM workflow.v_my_pending_task WHERE due_at<now() GROUP BY process_code;
