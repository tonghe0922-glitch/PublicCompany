import { createMemoryHistory } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { PORTALS, type PortalCode } from '../platform/portal-config'
import { createPortalRouter } from './portal-router'

async function route(portal:PortalCode,path:string,permissions:string[]){const router=createPortalRouter(PORTALS[portal],{authenticated:true,restore:()=>Promise.resolve(true),can:(permission)=>permissions.includes(permission)},createMemoryHistory());await router.push(path);await router.isReady();return router.currentRoute.value}
describe('P013 exact source routes',()=>{
  it('binds employee reward notice and fails closed',async()=>{expect((await route('employee','/employee/08/10/05',['p013.reward.read'])).name).toBe('p013-my-rewards');expect((await route('employee','/employee/08/10/05',[])).name).toBe('forbidden')})
  it('binds center review and execution by least privilege',async()=>{expect((await route('center','/center/10/10/03',['p013.reward.review'])).name).toBe('p013-reward-review');expect((await route('center','/center/10/10/04',['p013.reward.execute'])).name).toBe('p013-reward-execution');expect((await route('center','/center/10/10/04',['p013.reward.approve'])).name).toBe('forbidden')})
  it('binds dedicated and shared tech metadata monitors without mutation authority',async()=>{expect((await route('tech','/tech/06/06/01',['p013.reward.monitor'])).name).toBe('p013-reward-monitor');expect((await route('tech','/tech/05/03/01',['p013.reward.monitor'])).name).toBe('p004-workflow-instance-monitor');expect((await route('tech','/tech/06/06/01',['p013.reward.execute'])).name).toBe('forbidden')})
})
