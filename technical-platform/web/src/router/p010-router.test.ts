import {describe,expect,it} from 'vitest'
import {createMemoryHistory} from 'vue-router'
import type {PortalCode} from '../platform/portal-config'
import {PORTALS} from '../platform/portal-config'
import {createPortalRouter} from './portal-router'
async function route(portal:PortalCode,path:string,permissions:string[]){const router=createPortalRouter(PORTALS[portal],{authenticated:true,restore:()=>Promise.resolve(true),can:p=>permissions.includes(p)},createMemoryHistory());await router.push(path);await router.isReady();return router.currentRoute.value}
describe('P010 exact source routes',()=>{
  it('binds four employee routes and fails closed',async()=>{expect((await route('employee','/employee/07/01/01',['p010.learning.complete'])).name).toBe('p010-my-learning');expect((await route('employee','/employee/07/04/02',['p010.learning.exam'])).name).toBe('p010-online-exam');expect((await route('employee','/employee/07/05/01',['p010.learning.read'])).name).toBe('p010-practical-task');expect((await route('employee','/employee/07/06/01',['p010.learning.read'])).name).toBe('p010-current-qualifications');expect((await route('employee','/employee/07/01/01',[])).name).toBe('forbidden')})
  it('binds management, practical certification and controlled linkage',async()=>{expect((await route('center','/center/06/03/07',['p010.learning.manage'])).name).toBe('p010-learning-management');expect((await route('center','/center/10/08/03',['p010.learning.certify'])).name).toBe('p010-practical-certification');expect((await route('center','/center/10/08/07',['p010.learning.link'])).name).toBe('p010-risk-permission-link');expect((await route('center','/center/10/08/07',[])).name).toBe('forbidden')})
  it('binds shared workflow monitor and role-action audit without certify authority',async()=>{expect((await route('tech','/tech/05/03/01',['p010.learning.monitor'])).name).toBe('p004-workflow-instance-monitor');expect((await route('tech','/tech/03/03/09',['p010.learning.monitor'])).name).toBe('p010-role-action-audit');expect((await route('tech','/tech/03/03/09',['p010.learning.certify'])).name).toBe('forbidden')})
})
