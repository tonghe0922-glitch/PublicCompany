#!/usr/bin/env python3
"""ADR-006 source contract gate for module-based authorization."""
from pathlib import Path
import re,sys
ROOT=Path(__file__).resolve().parents[2]
def text(path):
 p=ROOT/path
 if not p.is_file(): raise AssertionError(f'required file is missing: {path}')
 return p.read_text(encoding='utf-8')
def need(h,n,l):
 if n not in h: raise AssertionError(f'missing {l}: {n}')
def main():
 migration=text('technical-platform/database/flyway-overlays/oms/V9000__iam_module_authorization.sql');boot=text('technical-platform/database/flyway-overlays/oms/V9001__authz_permissions_and_catalog.sql')
 for table in ('iam.module','iam.module_permission','iam.org_module','iam.position_role'):
  need(migration,f'CREATE TABLE IF NOT EXISTS {table}',f'table {table}');need(migration,f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY',f'RLS {table}')
 for c in ('VIEW','OPERATE','APPROVE','ADMIN'): need(migration,c,f'capability {c}')
 need(migration,'trg_iam_module_process_codes','process-code trigger');need(migration,'trg_iam_module_admin_risk','ADMIN-risk trigger');need(migration,"risk_level IN ('HIGH','CRITICAL')",'ADMIN risk boundary')
 for p in ('authz.module.read','authz.module.manage','authz.org.module.manage','authz.position.role.manage','authz.config.preview','authz.config.manage'):need(boot,p,f'permission {p}')
 need(boot,'Deliberately do not auto-grant','no automatic grants')
 need(text('pom.xml'),'technical-platform/backend/modules/authz','authz Maven module');need(text('technical-platform/backend/apps/api/pom.xml'),'platform-authz','API authz dependency')
 controllers='\n'.join(text('technical-platform/backend/apps/api/src/main/java/cn/shangjingu/platform/api/authz/'+n) for n in ('ModuleCatalogController.java','ModulePermissionController.java','OrgModuleController.java','PositionRoleController.java','AuthzPreviewController.java','AuthzApiSupport.java'))
 for r in ('/api/v1/authz/modules','/api/v1/authz/orgs/{orgId}/modules','/api/v1/authz/positions/{positionId}/roles','/api/v1/authz/preview'):need(controllers,r,f'API {r}')
 need(controllers,'X-Step-Up-Ticket','Step-Up');need(controllers,'auditMutation','audit snapshots')
 calc=text('technical-platform/backend/modules/authz/src/main/java/cn/shangjingu/platform/authz/application/PermissionPreviewCalculator.java');need(calc,'moduleEnabled','subtractive module filter');need(calc,'false);','non-persistent preview')
 router=text('technical-platform/web/src/router/portal-router.ts');page=text('technical-platform/web/src/platform/pages/authz/AuthzConfigurationPage.vue')
 for r in ('/tech/authz/modules','/tech/authz/modules/:id','/tech/authz/orgs/:orgId','/tech/authz/positions/:positionId','/tech/authz/preview'):need(router,r,f'tech route {r}')
 need(page,'directRoles','multi-role simulation');need(page,'配置预览不会写入正式授权表','non-persistence notice')
 adapter=text('technical-platform/backend/modules/iam/src/main/java/cn/shangjingu/platform/iam/infrastructure/JdbcIdentityDirectoryAdapter.java')
 if 'iam.position_role' in adapter or 'iam.org_module' in adapter: raise AssertionError('runtime authorization SQL switched before M3 reconciliation')
 for protected in ('technical-platform/backend/modules/iam/src/main/java/cn/shangjingu/platform/iam/authorization/AuthorizationService.java','technical-platform/backend/modules/iam/src/main/java/cn/shangjingu/platform/iam/authorization/DataScopeEvaluator.java'):
  if re.search(r'authz|org_module|position_role',text(protected),re.I): raise AssertionError(f'protected authorization class contains ADR-006 coupling: {protected}')
 print('ADR-006 module authorization contract: PASS');return 0
if __name__=='__main__':
 try: raise SystemExit(main())
 except AssertionError as e: print(f'ADR-006 module authorization contract: FAIL: {e}',file=sys.stderr);raise SystemExit(1)
