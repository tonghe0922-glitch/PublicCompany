import { describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import type { PortalCode } from '../platform/portal-config'
import { PORTALS } from '../platform/portal-config'
import { createPortalRouter } from './portal-router'

async function route(portal:PortalCode,path:string,permissions:string[]){const router=createPortalRouter(PORTALS[portal],{authenticated:true,restore:()=>Promise.resolve(true),can:(p)=>permissions.includes(p)},createMemoryHistory());await router.push(path);await router.isReady();return router.currentRoute.value}
describe('P007 exact source routes',()=>{
  it('binds employee routes and fails closed',async()=>{expect((await route('employee','/employee/04/01/01',['p007.schedule.read'])).name).toBe('p007-my-schedule');expect((await route('employee','/employee/03/01/09',['p007.schedule.change'])).name).toBe('p007-shift-change');expect((await route('employee','/employee/03/01/10',['p007.schedule.change'])).name).toBe('p007-substitution');expect((await route('employee','/employee/04/01/01',[])).name).toBe('forbidden')})
  it('binds center and shared tech monitor routes',async()=>{expect((await route('center','/center/04/01/01',['p007.schedule.manage'])).name).toBe('p007-schedule-plan');expect((await route('center','/center/04/07/04',['p007.schedule.review'])).name).toBe('p007-shift-review');expect((await route('center','/center/04/07/05',['p007.schedule.manage'])).name).toBe('p007-qualification-check');expect((await route('tech','/tech/05/03/01',['p007.schedule.monitor'])).name).toBe('p004-workflow-instance-monitor')})
})
