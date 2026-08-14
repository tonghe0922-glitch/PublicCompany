import { describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import type { PortalCode } from '../platform/portal-config'
import { PORTALS } from '../platform/portal-config'
import { createPortalRouter } from './portal-router'

async function route(portal:PortalCode,path:string,permissions:string[]){const router=createPortalRouter(PORTALS[portal],{authenticated:true,restore:()=>Promise.resolve(true),can:permission=>permissions.includes(permission)},createMemoryHistory());await router.push(path);await router.isReady();return router.currentRoute.value}
describe('P009 exact source routes',()=>{
  it('binds employee routes and fails closed',async()=>{expect((await route('employee','/employee/03/01/06',['p009.overtime.submit'])).name).toBe('p009-overtime-request');expect((await route('employee','/employee/03/01/07',['p009.overtime.read'])).name).toBe('p009-time-off-request');expect((await route('employee','/employee/04/04/02',['p009.overtime.read'])).name).toBe('p009-overtime-records');expect((await route('employee','/employee/03/01/06',[])).name).toBe('forbidden')})
  it('binds management, HR review and payroll-basis routes',async()=>{expect((await route('center','/center/04/05/01',['p009.overtime.review'])).name).toBe('p009-overtime-management');expect((await route('center','/center/04/05/05',['p009.overtime.hr'])).name).toBe('p009-overtime-hr-review');expect((await route('center','/center/04/05/06',['p009.overtime.hr'])).name).toBe('p009-overtime-payroll-basis');expect((await route('center','/center/04/05/06',[])).name).toBe('forbidden')})
  it('binds dedicated and combined technical monitors',async()=>{expect((await route('tech','/tech/07/09/01',['p009.overtime.monitor'])).name).toBe('p009-overtime-monitor');expect((await route('tech','/tech/07/11/01',['p009.overtime.monitor'])).name).toBe('phase10-attendance-monitor');expect((await route('tech','/tech/07/11/01',[])).name).toBe('forbidden')})
})
