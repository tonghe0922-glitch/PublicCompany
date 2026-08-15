import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'

import { PORTALS } from '../platform/portal-config'
import { createPortalRouter, type PortalRouterSession } from './portal-router'

class Session implements PortalRouterSession {
  constructor(private readonly permissions = new Set(['p005.notice.monitor'])) {}
  authenticated = true
  restore = () => Promise.resolve(true)
  can = (permission: string) => this.permissions.has(permission)
}

describe('Phase10 shared technical monitor route', () => {
  it('keeps the authoritative path, name and meta while binding the Phase10 page', async () => {
    const router = createPortalRouter(PORTALS.tech, new Session(), createMemoryHistory())
    await router.push('/tech/05/03/01')
    await router.isReady()
    const route = router.currentRoute.value
    expect(route.name).toBe('p004-workflow-instance-monitor')
    expect(route.path).toBe('/tech/05/03/01')
    expect(route.meta).toMatchObject({
      processCode: 'P004',
      portalCode: 'tech',
      sourceKey: 'phase09-runtime:workflow-monitor',
    })
    const source = readFileSync(new URL('./phase09-routes.ts', import.meta.url), 'utf8')
    const orchestrator = readFileSync(new URL('./portal-router.ts', import.meta.url), 'utf8')
    expect(source).toContain("import Phase10TechMonitorPage from '../platform/pages/Phase10TechMonitorPage.vue'")
    expect(source).toMatch(/path:\s*['"]\/tech\/05\/03\/01['"][\s\S]*?component:\s*Phase10TechMonitorPage/)
    expect(source).not.toContain("from '../platform/pages/Phase09TechWorkflowMonitorPage.vue'")
    expect(orchestrator).toContain("import { attachAuthoritativeRouteMeta, createCoreRoutes } from './core-routes'")
    expect(orchestrator).not.toContain("'/tech/05/03/01'")
  })

  it('keeps the existing permission meta and exposes the shared route only in the tech portal', () => {
    const tech = createPortalRouter(PORTALS.tech, new Session(), createMemoryHistory())
    const route = tech.getRoutes().find(candidate => candidate.name === 'p004-workflow-instance-monitor')
    expect(route?.meta.permissionsAny).toEqual([
      'p004.request.read', 'p005.notice.monitor', 'p006.meeting.monitor', 'p007.schedule.monitor',
      'p008.leave.monitor', 'p010.learning.monitor', 'p011.performance.monitor', 'p012.promotion.monitor',
      'p013.reward.monitor', 'p014.discipline.monitor', 'p016.welfare.monitor',
    ])
    for (const portal of [PORTALS.employee, PORTALS.center]) {
      const router = createPortalRouter(portal, new Session(), createMemoryHistory())
      expect(router.getRoutes().some(candidate => candidate.name === 'p004-workflow-instance-monitor')).toBe(false)
    }
  })

  it('admits a P016-monitor-only session and binds a thin monitor hub shell', async () => {
    const router = createPortalRouter(
      PORTALS.tech,
      new Session(new Set(['p016.welfare.monitor'])),
      createMemoryHistory(),
    )
    await router.push('/tech/05/03/01')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('p004-workflow-instance-monitor')

    const pageSource = readFileSync(
      new URL('../platform/pages/Phase10TechMonitorPage.vue', import.meta.url),
      'utf8',
    )
    expect(pageSource).toContain('PhaseWorkflowMonitorFeature')
    expect(pageSource).not.toMatch(/import\s+\w+Page\s+from/u)
  })
})
