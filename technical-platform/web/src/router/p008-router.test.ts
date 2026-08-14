import { describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import type { PortalCode } from '../platform/portal-config'
import { PORTALS } from '../platform/portal-config'
import { createPortalRouter } from './portal-router'

async function route(portal:PortalCode, path:string, permissions:string[]) { const router = createPortalRouter(PORTALS[portal], { authenticated:true, restore:() => Promise.resolve(true), can:permission => permissions.includes(permission) }, createMemoryHistory()); await router.push(path); await router.isReady(); return router.currentRoute.value }

describe('P008 exact source routes', () => {
  it('binds employee routes and fails closed', async () => {
    expect((await route('employee', '/employee/03/01/01', ['p008.leave.submit'])).name).toBe('p008-leave-request')
    expect((await route('employee', '/employee/04/03/02', ['p008.leave.read'])).name).toBe('p008-leave-records')
    expect((await route('employee', '/employee/03/01/02', ['p008.leave.submit'])).name).toBe('p008-leave-change')
    expect((await route('employee', '/employee/03/01/01', [])).name).toBe('forbidden')
  })
  it('binds center routes with their exact permission boundaries', async () => {
    expect((await route('center', '/center/04/04/01', ['p008.leave.manage'])).name).toBe('p008-leave-management')
    expect((await route('center', '/center/04/04/03', ['p008.leave.review'])).name).toBe('p008-leave-review')
    expect((await route('center', '/center/04/04/06', ['p008.leave.manage'])).name).toBe('p008-attendance-close')
    expect((await route('center', '/center/04/04/03', [])).name).toBe('forbidden')
  })
  it('binds dedicated and shared technical monitor routes', async () => {
    expect((await route('tech', '/tech/07/11/01', ['p008.leave.monitor'])).name).toBe('phase10-attendance-monitor')
    expect((await route('tech', '/tech/05/03/01', ['p008.leave.monitor'])).name).toBe('p004-workflow-instance-monitor')
    expect((await route('tech', '/tech/07/11/01', [])).name).toBe('forbidden')
  })
})
