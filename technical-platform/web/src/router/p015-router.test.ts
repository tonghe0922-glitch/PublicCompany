import { createMemoryHistory } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { PORTALS, type PortalCode } from '../platform/portal-config'
import { createPortalRouter } from './portal-router'

async function route(portal:PortalCode,path:string,permissions:string[]){const router=createPortalRouter(PORTALS[portal],{authenticated:true,restore:()=>Promise.resolve(true),can:(permission)=>permissions.includes(permission)},createMemoryHistory());await router.push(path);await router.isReady();return router.currentRoute.value}
describe('P015 exact source routes',()=>{
  it('binds both employee point views and fails closed',async()=>{expect((await route('employee','/employee/08/06/04',['p015.points.read'])).name).toBe('p015-my-growth-points');expect((await route('employee','/employee/08/06/06',['p015.points.adjust'])).name).toBe('p015-my-honor-points');expect((await route('employee','/employee/08/06/04',[])).name).toBe('forbidden')})
  it('binds center source management and independent adjustment review',async()=>{expect((await route('center','/center/10/09/01',['p015.points.manage'])).name).toBe('p015-point-source-management');expect((await route('center','/center/10/09/06',['p015.points.adjust'])).name).toBe('p015-point-adjustment-review');expect((await route('center','/center/10/09/06',['p015.points.monitor'])).name).toBe('forbidden')})
  it('keeps technical rule monitoring separate from business review',async()=>{expect((await route('tech','/tech/06/06/09',['p015.points.monitor'])).name).toBe('p015-point-rule-monitor');expect((await route('tech','/tech/06/06/09',['p015.points.review'])).name).toBe('forbidden')})
})
