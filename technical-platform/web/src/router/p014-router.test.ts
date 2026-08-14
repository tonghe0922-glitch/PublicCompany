import { createMemoryHistory } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { PORTALS, type PortalCode } from '../platform/portal-config'
import { createPortalRouter } from './portal-router'

async function route(portal:PortalCode,path:string,permissions:string[]){const router=createPortalRouter(PORTALS[portal],{authenticated:true,restore:()=>Promise.resolve(true),can:(permission)=>permissions.includes(permission)},createMemoryHistory());await router.push(path);await router.isReady();return router.currentRoute.value}
describe('P014 exact source routes',()=>{
  it('binds employee discipline participation and fails closed',async()=>{expect((await route('employee','/employee/02/03/09',['p014.discipline.read'])).name).toBe('p014-my-discipline-case');expect((await route('employee','/employee/02/03/09',[])).name).toBe('forbidden')})
  it('binds both center responsibility and supervision routes by least privilege',async()=>{expect((await route('center','/center/02/04/04',['p014.discipline.investigate'])).name).toBe('p014-discipline-review');expect((await route('center','/center/06/03/09',['p014.discipline.manage'])).name).toBe('p014-discipline-supervision');expect((await route('center','/center/02/04/04',['p014.discipline.monitor'])).name).toBe('forbidden')})
  it('adds P014 monitor to the shared tech route without mutation authority',async()=>{expect((await route('tech','/tech/05/03/01',['p014.discipline.monitor'])).name).toBe('p004-workflow-instance-monitor');expect((await route('tech','/tech/05/03/01',['p014.discipline.manage'])).name).toBe('forbidden')})
})
