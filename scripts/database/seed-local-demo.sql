\set ON_ERROR_STOP on

-- Local acceptance/demo facts for P001-P005. Never run in production.
BEGIN;

-- One tenant, one center, and a clear employee -> center -> tech responsibility chain.
INSERT INTO org.organization(id,tenant_id,org_code,org_name,org_type,path,status)
VALUES ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',
        'DEMO_CENTER','演示运营中心','CENTER','demo_center'::ltree,'ACTIVE')
ON CONFLICT (id) DO UPDATE SET org_name=excluded.org_name,status='ACTIVE',is_deleted=false,deleted_at=null;

INSERT INTO org.position(id,tenant_id,position_code,position_name,org_id,status) VALUES
('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','DEMO_EMPLOYEE','演示员工','10000000-0000-0000-0000-000000000001','ACTIVE'),
('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','DEMO_CENTER_REVIEWER','中心审核员','10000000-0000-0000-0000-000000000001','ACTIVE'),
('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','DEMO_TECH_OPERATOR','技术执行员','10000000-0000-0000-0000-000000000001','ACTIVE')
ON CONFLICT (id) DO UPDATE SET position_name=excluded.position_name,status='ACTIVE',is_deleted=false,deleted_at=null;

INSERT INTO org.employee(id,tenant_id,employee_no,person_name,employment_status,hire_date,primary_org_id,primary_position_id) VALUES
('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','DEMO-E001','演示员工','ACTIVE',current_date-30,'10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','DEMO-C001','中心审核员 A','ACTIVE',current_date-365,'10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002'),
('30000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','DEMO-C002','中心审核员 B','ACTIVE',current_date-365,'10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002'),
('30000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','DEMO-T001','技术执行员','ACTIVE',current_date-365,'10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003')
ON CONFLICT (id) DO UPDATE SET person_name=excluded.person_name,employment_status='ACTIVE',is_deleted=false,deleted_at=null;

INSERT INTO org.employee_position(id,tenant_id,employee_id,position_id,org_id,is_primary,effective_start_date,status) VALUES
('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',true,current_date-30,'ACTIVE'),
('40000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',true,current_date-365,'ACTIVE'),
('40000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',true,current_date-365,'ACTIVE'),
('40000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001',true,current_date-365,'ACTIVE')
ON CONFLICT (id) DO UPDATE SET status='ACTIVE',effective_end_date=null,is_deleted=false,deleted_at=null;

INSERT INTO iam.user_account(id,tenant_id,login_name,password_hash,status,mfa_level) VALUES
('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','employee_demo',crypt('Employee@2026',gen_salt('bf',12)),'ACTIVE',0),
('50000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','center_demo',crypt('Center@2026',gen_salt('bf',12)),'ACTIVE',0),
('50000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','tech_demo',crypt('Tech@2026',gen_salt('bf',12)),'ACTIVE',0)
ON CONFLICT (tenant_id,login_name) DO UPDATE SET password_hash=excluded.password_hash,status='ACTIVE',mfa_level=0,is_deleted=false,deleted_at=null;

INSERT INTO iam.user_identity(id,tenant_id,user_id,employee_id,identity_type,identity_name,org_id,position_id,is_primary,effective_start_at) VALUES
('60000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','EMPLOYEE','员工发起人','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',true,now()-interval '30 days'),
('60000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','CENTER_MANAGER','中心审核员 A','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002',true,now()-interval '365 days'),
('60000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000004','CENTER_MANAGER','中心审核员 B','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002',false,now()-interval '365 days'),
('60000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003','TECH_OPERATOR','技术执行员','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003',true,now()-interval '365 days')
ON CONFLICT (id) DO UPDATE SET employee_id=excluded.employee_id,identity_name=excluded.identity_name,org_id=excluded.org_id,
 position_id=excluded.position_id,effective_end_at=null,is_deleted=false,deleted_at=null;

INSERT INTO iam.data_scope_rule(tenant_id,scope_code,scope_name,rule_expr,enabled) VALUES
('00000000-0000-0000-0000-000000000001','DEMO_SELF','演示本人范围',jsonb_build_object('scope','SELF'),true),
('00000000-0000-0000-0000-000000000001','DEMO_CENTER','演示中心范围',jsonb_build_object('scope','CENTER'),true)
ON CONFLICT (tenant_id,scope_code) DO UPDATE SET rule_expr=excluded.rule_expr,enabled=true,is_deleted=false,deleted_at=null;

INSERT INTO iam.role(id,tenant_id,role_code,role_name,role_type,data_scope_code,enabled) VALUES
('70000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','DEMO_EMPLOYEE','演示员工角色','BUSINESS','DEMO_SELF',true),
('70000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','DEMO_CENTER_REVIEWER','演示中心审核角色','BUSINESS','DEMO_CENTER',true),
('70000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','DEMO_TECH_OPERATOR','演示技术执行角色','PLATFORM','DEMO_CENTER',true),
('70000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','DEMO_REQUESTED_ROLE','P002 可申请演示角色','BUSINESS','DEMO_SELF',true)
ON CONFLICT (tenant_id,role_code) DO UPDATE SET role_name=excluded.role_name,data_scope_code=excluded.data_scope_code,enabled=true,is_deleted=false,deleted_at=null;

-- Upsert the exact P001-P005 server permission contract.
WITH permission_seed(permission_code,permission_name,resource_type,action_code,risk_level) AS (VALUES
('platform.session.read','读取当前会话','SESSION','READ','NORMAL'),
('platform.session.switch','切换中心身份','SESSION','SWITCH','HIGH'),
('platform.session.logout','退出登录','SESSION','LOGOUT','NORMAL'),
('platform.stepup.issue','签发二次验证票据','SECURITY','STEP_UP','HIGH'),
('p001.session.monitor','会话安全监控','SESSION','MONITOR','HIGH'),
('p002.request.submit','提交权限申请','P002_PERMISSION_REQUEST','SUBMIT','NORMAL'),
('p002.request.read','读取权限申请','P002_PERMISSION_REQUEST','READ','NORMAL'),
('p002.request.review','复核权限申请','P002_PERMISSION_REQUEST','REVIEW','HIGH'),
('p002.request.execute','执行权限授权','P002_PERMISSION_REQUEST','EXECUTE','HIGH'),
('p002.request.revoke','执行权限回收','P002_PERMISSION_REQUEST','REVOKE','HIGH'),
('p003.change.submit','提交资料变更','P003_PROFILE_CHANGE','SUBMIT','NORMAL'),
('p003.change.read','读取资料变更','P003_PROFILE_CHANGE','READ','NORMAL'),
('p003.change.review','复核资料变更','P003_PROFILE_CHANGE','REVIEW','HIGH'),
('p003.change.apply','执行权威资料更新','P003_PROFILE_CHANGE','APPLY','HIGH'),
('p004.request.submit','提交通用申请','P004_GENERIC_REQUEST','SUBMIT','NORMAL'),
('p004.request.read','读取通用申请','P004_GENERIC_REQUEST','READ','NORMAL'),
('p004.request.act','处理通用申请','P004_GENERIC_REQUEST','ACT','HIGH'),
('p005.notice.publish','发布制度通知','P005_NOTICE','PUBLISH','HIGH'),
('p005.notice.read','读取制度通知','P005_NOTICE','READ','NORMAL'),
('p005.notice.receipt','提交通知回执','P005_NOTICE','RECEIPT','NORMAL'),
('p005.notice.manage','管理制度通知','P005_NOTICE','MANAGE','HIGH'),
('p005.notice.monitor','监控制度通知','P005_NOTICE','MONITOR','HIGH'),
('demo.dashboard.read','访问演示业务能力','DEMO','READ','NORMAL')
)
INSERT INTO iam.permission(id,tenant_id,permission_code,permission_name,resource_type,action_code,risk_level)
SELECT gen_random_uuid(),'00000000-0000-0000-0000-000000000001',permission_code,permission_name,resource_type,action_code,risk_level
FROM permission_seed
ON CONFLICT (tenant_id,permission_code) DO UPDATE SET permission_name=excluded.permission_name,
 resource_type=excluded.resource_type,action_code=excluded.action_code,risk_level=excluded.risk_level,is_deleted=false,deleted_at=null;

DELETE FROM iam.role_permission WHERE tenant_id='00000000-0000-0000-0000-000000000001'
 AND role_id IN ('70000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000002',
                 '70000000-0000-0000-0000-000000000003','70000000-0000-0000-0000-000000000004');

INSERT INTO iam.role_permission(tenant_id,role_id,permission_id)
SELECT '00000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001',id FROM iam.permission
WHERE tenant_id='00000000-0000-0000-0000-000000000001' AND permission_code IN
('platform.session.read','platform.session.logout','platform.stepup.issue','p002.request.submit','p002.request.read',
 'p003.change.submit','p003.change.read','p004.request.submit','p004.request.read','p005.notice.read','p005.notice.receipt');

INSERT INTO iam.role_permission(tenant_id,role_id,permission_id)
SELECT '00000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000002',id FROM iam.permission
WHERE tenant_id='00000000-0000-0000-0000-000000000001' AND permission_code IN
('platform.session.read','platform.session.switch','platform.session.logout','platform.stepup.issue','p001.session.monitor',
 'p002.request.read','p002.request.review','p003.change.read','p003.change.review','p004.request.read','p004.request.act',
 'p005.notice.publish','p005.notice.read','p005.notice.manage');

INSERT INTO iam.role_permission(tenant_id,role_id,permission_id)
SELECT '00000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000003',id FROM iam.permission
WHERE tenant_id='00000000-0000-0000-0000-000000000001' AND permission_code IN
('platform.session.read','platform.session.logout','platform.stepup.issue','p001.session.monitor','p002.request.read',
 'p002.request.execute','p002.request.revoke','p003.change.read','p003.change.apply','p004.request.read','p005.notice.monitor');

INSERT INTO iam.role_permission(tenant_id,role_id,permission_id)
SELECT '00000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000004',id FROM iam.permission
WHERE tenant_id='00000000-0000-0000-0000-000000000001' AND permission_code='demo.dashboard.read';

DELETE FROM iam.user_role WHERE tenant_id='00000000-0000-0000-0000-000000000001'
 AND user_id IN ('50000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000003');
INSERT INTO iam.user_role(tenant_id,user_id,identity_id,role_id,effective_start_at,grant_source) VALUES
('00000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001',now()-interval '1 day','LOCAL_DEMO'),
('00000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000002',now()-interval '1 day','LOCAL_DEMO'),
('00000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000004','70000000-0000-0000-0000-000000000002',now()-interval '1 day','LOCAL_DEMO'),
('00000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000003','70000000-0000-0000-0000-000000000003',now()-interval '1 day','LOCAL_DEMO');

COMMIT;

SELECT a.login_name,i.identity_name,r.role_code,r.data_scope_code,count(p.id) AS permission_count
FROM iam.user_account a
JOIN iam.user_identity i ON i.tenant_id=a.tenant_id AND i.user_id=a.id AND NOT i.is_deleted
JOIN iam.user_role ur ON ur.tenant_id=a.tenant_id AND ur.user_id=a.id AND ur.identity_id=i.id AND NOT ur.is_deleted
JOIN iam.role r ON r.tenant_id=ur.tenant_id AND r.id=ur.role_id AND NOT r.is_deleted
JOIN iam.role_permission rp ON rp.tenant_id=r.tenant_id AND rp.role_id=r.id AND NOT rp.is_deleted
JOIN iam.permission p ON p.tenant_id=rp.tenant_id AND p.id=rp.permission_id AND NOT p.is_deleted
WHERE a.login_name IN ('employee_demo','center_demo','tech_demo')
GROUP BY a.login_name,i.identity_name,r.role_code,r.data_scope_code
ORDER BY a.login_name,i.identity_name;
