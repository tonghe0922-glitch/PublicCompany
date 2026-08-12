import { createMemoryHistory } from 'vue-router'
import { describe,expect,it } from 'vitest'
import { PORTALS,type PortalDefinition } from '../platform/portal-config'
import { createPortalRouter,type PortalRouterSession } from './portal-router'

class Session implements PortalRouterSession{
  authenticated=true
  permissions=new Set<string>()
  restore(){return Promise.resolve(true)}
  can(permission:string){return this.permissions.has(permission)}
}

type ExpectedRoute=readonly[path:string,name:string]
async function expectRoutes(portal:PortalDefinition,permission:string,routes:readonly ExpectedRoute[]){
  const session=new Session()
  session.permissions.add(permission)
  const router=createPortalRouter(portal,session,createMemoryHistory())
  for(const[path,name]of routes){
    await router.push(path)
    expect(router.currentRoute.value.name).toBe(name)
  }
}

describe('PHASE-10 P008-P010 source-bound routes',()=>{
  it('registers all 19 employee and center business pages',async()=>{
    await expectRoutes(PORTALS.employee,'p008.leave.read',[
      ['/employee/03/01/01','p008-leave-request'],
      ['/employee/04/03/02','p008-quota-ledger'],
      ['/employee/03/01/02','p008-leave-change'],
    ])
    await expectRoutes(PORTALS.center,'p008.leave.manage',[
      ['/center/04/04/01','p008-leave-review'],
      ['/center/04/04/03','p008-quota-management'],
      ['/center/04/04/06','p008-leave-change-center'],
    ])
    await expectRoutes(PORTALS.employee,'p009.overtime.read',[
      ['/employee/03/01/06','p009-overtime-request'],
      ['/employee/03/01/07','p009-time-off-request'],
      ['/employee/04/04/02','p009-result-acceptance'],
    ])
    await expectRoutes(PORTALS.center,'p009.overtime.manage',[
      ['/center/04/05/01','p009-overtime-management'],
      ['/center/04/05/05','p009-hr-review'],
      ['/center/04/05/06','p009-payroll-basis'],
    ])
    await expectRoutes(PORTALS.employee,'p010.learning.read',[
      ['/employee/07/01/01','p010-learning-tasks'],
      ['/employee/07/04/02','p010-online-exam'],
      ['/employee/07/05/01','p010-practical-task'],
      ['/employee/07/06/01','p010-qualifications'],
    ])
    await expectRoutes(PORTALS.center,'p010.learning.manage',[
      ['/center/06/03/07','p010-learning-management'],
      ['/center/10/08/03','p010-practical-certification'],
      ['/center/10/08/07','p010-permission-linkage'],
    ])
  })

  it('keeps technical routes monitor-only',async()=>{
    await expectRoutes(PORTALS.tech,'p010.learning.monitor',[
      ['/tech/05/03/01','p004-workflow-instance-monitor'],
      ['/tech/03/03/09','p010-role-permission-audit'],
    ])
    await expectRoutes(PORTALS.tech,'p008.leave.monitor',[
      ['/tech/07/11/01','p008-p009-attendance-integration-monitor'],
    ])
    await expectRoutes(PORTALS.tech,'p009.overtime.monitor',[
      ['/tech/07/09/01','p009-payroll-integration-monitor'],
    ])
  })
})
