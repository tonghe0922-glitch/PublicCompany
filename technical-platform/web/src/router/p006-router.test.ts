import { describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { PORTALS } from '../platform/portal-config'
import { createPortalRouter, type PortalRouterSession } from './portal-router'

class Session implements PortalRouterSession {
  authenticated=true
  constructor(private readonly permissions:Set<string>){}
  restore=()=>Promise.resolve(true)
  can=(permission:string)=>this.permissions.has(permission)
}

async function route(portal:'employee'|'center'|'tech',path:string,permissions:string[]){
  const router=createPortalRouter(PORTALS[portal],new Session(new Set(permissions)),createMemoryHistory())
  await router.push(path);await router.isReady();return router.currentRoute.value
}

describe('PHASE-10 P006 frozen page bindings',()=>{
  it('binds both employee source coordinates and rejects missing permission',async()=>{
    expect((await route('employee','/employee/05/01/03',['p006.meeting.read'])).name).toBe('p006-meeting-detail')
    expect((await route('employee','/employee/05/07/02',['p006.meeting.action'])).name).toBe('p006-action-items')
    expect((await route('employee','/employee/05/01/03',[])).name).toBe('forbidden')
  })
  it('binds center ledger/meeting and tech monitor without granting business permissions',async()=>{
    expect((await route('center','/center/06/09/03',['p006.meeting.manage'])).name).toBe('p006-meeting-management')
    expect((await route('center','/center/05/02/02',['p006.meeting.accept'])).name).toBe('p006-action-ledger')
    expect((await route('tech','/tech/05/03/01',['p006.meeting.monitor'])).name).toBe('p004-workflow-instance-monitor')
    expect((await route('tech','/tech/05/03/01',[])).name).toBe('forbidden')
  })
})
