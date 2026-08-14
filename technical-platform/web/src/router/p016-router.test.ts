import { createMemoryHistory } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { PORTALS, type PortalCode } from '../platform/portal-config'
import { createPortalRouter } from './portal-router'

async function route(portal:PortalCode,path:string,permissions:string[]){const router=createPortalRouter(PORTALS[portal],{authenticated:true,restore:()=>Promise.resolve(true),can:(permission)=>permissions.includes(permission)},createMemoryHistory());await router.push(path);await router.isReady();return router.currentRoute.value}
describe('P016 exact source routes',()=>{
  it('binds both employee care pages and fails closed',async()=>{expect((await route('employee','/employee/03/06/01',['p016.welfare.read'])).name).toBe('p016-marriage-birth-care');expect((await route('employee','/employee/03/06/05',['p016.welfare.read'])).name).toBe('p016-hardship-care');expect((await route('employee','/employee/03/06/05',[])).name).toBe('forbidden')})
  it('shares center supervision and binds external receipt by least privilege',async()=>{expect((await route('center','/center/06/03/09',['p016.welfare.manage'])).name).toBe('p014-discipline-supervision');expect((await route('center','/center/08/08/05',['p016.welfare.execute'])).name).toBe('p016-external-execution-receipt');expect((await route('center','/center/08/08/05',['p016.welfare.monitor'])).name).toBe('forbidden')})
  it('uses the shared technical workflow monitor without business authority',async()=>{expect((await route('tech','/tech/05/03/01',['p016.welfare.monitor'])).name).toBe('p004-workflow-instance-monitor');expect((await route('tech','/tech/05/03/01',['p016.welfare.execute'])).name).toBe('forbidden')})
})
