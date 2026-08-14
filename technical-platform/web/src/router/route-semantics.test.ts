import { createMemoryHistory } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import authenticatedLayoutSource from '../platform/AuthenticatedPortalLayout.vue?raw'
import { PORTALS } from '../platform/portal-config'
import { PORTAL_IA_NAVIGATION } from './navigation-source'
import { projectActiveNavigation } from './navigation-projection'
import { createPortalRouter, type PortalRouterSession } from './portal-router'

const session: PortalRouterSession = {
  authenticated: true,
  restore: () => Promise.resolve(true),
  can: () => true,
}

type NavigationEntries = typeof PORTAL_IA_NAVIGATION

async function createCenterRouterWithNavigation(
  transform: (entries: NavigationEntries) => NavigationEntries,
) {
  vi.resetModules()
  vi.doMock('./navigation-source', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./navigation-source')>()
    return {
      ...actual,
      PORTAL_IA_NAVIGATION: transform(actual.PORTAL_IA_NAVIGATION),
    }
  })

  try {
    const mockedRouter = await import('./portal-router')
    return mockedRouter.createPortalRouter(PORTALS.center, session, createMemoryHistory())
  } finally {
    vi.doUnmock('./navigation-source')
    vi.resetModules()
  }
}

function processCode(routeName: string): string {
  const match = routeName.match(/p(\d{3})/i)
  if (match) return `P${match[1]}`
  if (routeName.startsWith('phase09-')) return 'PHASE-09'
  if (routeName.startsWith('phase10-')) return 'PHASE-10'
  return 'PORTAL'
}

describe('authoritative route title metadata', () => {
  it('locks the current literal guard surface before router modules are split', () => {
    const expected = {
      employee: [
        { path: '/employee/13/04/04', name: 'p001-mfa', permission: null, permissionsAny: null },
        { path: '/employee/13/04/06', name: 'p001-sessions', permission: null, permissionsAny: null },
        { path: '/employee/03/07/04', name: 'p002-temporary-permission-request', permission: null, permissionsAny: ['p002.request.submit', 'p002.request.read'] },
        { path: '/employee/03/07/05', name: 'p002-project-permission-request', permission: null, permissionsAny: ['p002.request.submit', 'p002.request.read'] },
        { path: '/employee/03/03/01', name: 'p003-profile-change', permission: null, permissionsAny: ['p003.change.submit', 'p003.change.read'] },
        { path: '/employee/03/07/01', name: 'p004-generic-request', permission: null, permissionsAny: ['p004.request.submit', 'p004.request.read'] },
        { path: '/employee/13/01/05', name: 'p005-notice-receipt', permission: null, permissionsAny: ['p005.notice.read', 'p005.notice.receipt'] },
        { path: '/employee/05/01/03', name: 'p006-meeting-detail', permission: null, permissionsAny: ['p006.meeting.create', 'p006.meeting.read', 'p006.meeting.action'] },
        { path: '/employee/05/07/02', name: 'p006-action-items', permission: null, permissionsAny: ['p006.meeting.read', 'p006.meeting.action'] },
        { path: '/employee/04/01/01', name: 'p007-my-schedule', permission: null, permissionsAny: ['p007.schedule.read', 'p007.schedule.change'] },
        { path: '/employee/03/01/09', name: 'p007-shift-change', permission: null, permissionsAny: ['p007.schedule.read', 'p007.schedule.change'] },
        { path: '/employee/03/01/10', name: 'p007-substitution', permission: null, permissionsAny: ['p007.schedule.read', 'p007.schedule.change'] },
        { path: '/employee/03/01/01', name: 'p008-leave-request', permission: null, permissionsAny: ['p008.leave.submit', 'p008.leave.read'] },
        { path: '/employee/04/03/02', name: 'p008-leave-records', permission: null, permissionsAny: ['p008.leave.submit', 'p008.leave.read'] },
        { path: '/employee/03/01/02', name: 'p008-leave-change', permission: null, permissionsAny: ['p008.leave.submit', 'p008.leave.read'] },
        { path: '/employee/03/01/06', name: 'p009-overtime-request', permission: null, permissionsAny: ['p009.overtime.submit', 'p009.overtime.read'] },
        { path: '/employee/03/01/07', name: 'p009-time-off-request', permission: null, permissionsAny: ['p009.overtime.submit', 'p009.overtime.read'] },
        { path: '/employee/04/04/02', name: 'p009-overtime-records', permission: null, permissionsAny: ['p009.overtime.submit', 'p009.overtime.read'] },
        { path: '/employee/07/01/01', name: 'p010-my-learning', permission: null, permissionsAny: ['p010.learning.read', 'p010.learning.complete'] },
        { path: '/employee/07/04/02', name: 'p010-online-exam', permission: null, permissionsAny: ['p010.learning.read', 'p010.learning.exam'] },
        { path: '/employee/07/05/01', name: 'p010-practical-task', permission: null, permissionsAny: ['p010.learning.read', 'p010.learning.complete'] },
        { path: '/employee/07/06/01', name: 'p010-current-qualifications', permission: 'p010.learning.read', permissionsAny: null },
        { path: '/employee/02/03/06', name: 'p011-performance-cycle', permission: null, permissionsAny: ['p011.performance.read', 'p011.performance.evaluate', 'p011.performance.appeal'] },
        { path: '/employee/08/03/06', name: 'p011-performance-feedback', permission: 'p011.performance.read', permissionsAny: null },
        { path: '/employee/03/03/05', name: 'p012-promotion-application', permission: 'p012.promotion.read', permissionsAny: null },
        { path: '/employee/08/09/03', name: 'p012-appointment-confirmation', permission: 'p012.promotion.read', permissionsAny: null },
        { path: '/employee/08/10/05', name: 'p013-my-rewards', permission: 'p013.reward.read', permissionsAny: null },
        { path: '/employee/02/03/09', name: 'p014-my-discipline-case', permission: null, permissionsAny: ['p014.discipline.read', 'p014.discipline.appeal'] },
        { path: '/employee/08/06/04', name: 'p015-my-growth-points', permission: null, permissionsAny: ['p015.points.read', 'p015.points.adjust'] },
        { path: '/employee/08/06/06', name: 'p015-my-honor-points', permission: null, permissionsAny: ['p015.points.read', 'p015.points.adjust'] },
        { path: '/employee/03/06/01', name: 'p016-marriage-birth-care', permission: 'p016.welfare.read', permissionsAny: null },
        { path: '/employee/03/06/05', name: 'p016-hardship-care', permission: 'p016.welfare.read', permissionsAny: null },
        { path: '/login', name: 'login', permission: null, permissionsAny: null },
        { path: '/', name: 'portal-home', permission: null, permissionsAny: null },
        { path: '/forbidden', name: 'forbidden', permission: null, permissionsAny: null },
        { path: '/:pathMatch(.*)*', name: 'not-found', permission: null, permissionsAny: null },
      ],
      center: [
        { path: '/center/03/02/01', name: 'p003-profile-roster', permission: null, permissionsAny: ['p003.change.read', 'p003.change.review'] },
        { path: '/center/13/01/05', name: 'p005-notice-publish', permission: null, permissionsAny: ['p005.notice.publish', 'p005.notice.manage'] },
        { path: '/center/02/01/01', name: 'phase09-center-inbox', permission: null, permissionsAny: ['p001.session.monitor', 'p002.request.read', 'p002.request.review', 'p003.change.read', 'p003.change.review', 'p004.request.read', 'p004.request.act'] },
        { path: '/center/06/09/03', name: 'p006-meeting-management', permission: null, permissionsAny: ['p006.meeting.read', 'p006.meeting.manage', 'p006.meeting.accept'] },
        { path: '/center/05/02/02', name: 'p006-action-ledger', permission: null, permissionsAny: ['p006.meeting.read', 'p006.meeting.manage', 'p006.meeting.accept'] },
        { path: '/center/04/01/01', name: 'p007-schedule-plan', permission: null, permissionsAny: ['p007.schedule.read', 'p007.schedule.manage'] },
        { path: '/center/04/07/04', name: 'p007-shift-review', permission: null, permissionsAny: ['p007.schedule.read', 'p007.schedule.review'] },
        { path: '/center/04/07/05', name: 'p007-qualification-check', permission: null, permissionsAny: ['p007.schedule.read', 'p007.schedule.manage'] },
        { path: '/center/04/04/01', name: 'p008-leave-management', permission: null, permissionsAny: ['p008.leave.read', 'p008.leave.manage'] },
        { path: '/center/04/04/03', name: 'p008-leave-review', permission: null, permissionsAny: ['p008.leave.read', 'p008.leave.review'] },
        { path: '/center/04/04/06', name: 'p008-attendance-close', permission: null, permissionsAny: ['p008.leave.read', 'p008.leave.manage'] },
        { path: '/center/04/05/01', name: 'p009-overtime-management', permission: null, permissionsAny: ['p009.overtime.read', 'p009.overtime.manage', 'p009.overtime.review'] },
        { path: '/center/04/05/05', name: 'p009-overtime-hr-review', permission: null, permissionsAny: ['p009.overtime.read', 'p009.overtime.hr'] },
        { path: '/center/04/05/06', name: 'p009-overtime-payroll-basis', permission: null, permissionsAny: ['p009.overtime.read', 'p009.overtime.hr'] },
        { path: '/center/06/03/07', name: 'p010-learning-management', permission: null, permissionsAny: ['p010.learning.read', 'p010.learning.manage', 'p010.learning.certify'] },
        { path: '/center/10/08/03', name: 'p010-practical-certification', permission: null, permissionsAny: ['p010.learning.read', 'p010.learning.certify'] },
        { path: '/center/10/08/07', name: 'p010-risk-permission-link', permission: null, permissionsAny: ['p010.learning.read', 'p010.learning.link'] },
        { path: '/center/10/02/01', name: 'p011-self-evaluation', permission: null, permissionsAny: ['p011.performance.read', 'p011.performance.evaluate'] },
        { path: '/center/10/02/04', name: 'p011-score-calculation', permission: null, permissionsAny: ['p011.performance.manage', 'p011.performance.evaluate'] },
        { path: '/center/10/02/05', name: 'p011-calibration', permission: 'p011.performance.calibrate', permissionsAny: null },
        { path: '/center/03/08/05', name: 'p012-promotion-review', permission: null, permissionsAny: ['p012.promotion.manage', 'p012.promotion.review', 'p012.promotion.approve'] },
        { path: '/center/03/08/06', name: 'p012-promotion-appointment', permission: 'p012.promotion.appoint', permissionsAny: null },
        { path: '/center/10/10/03', name: 'p013-reward-review', permission: null, permissionsAny: ['p013.reward.read', 'p013.reward.manage', 'p013.reward.review', 'p013.reward.approve', 'p013.reward.execute'] },
        { path: '/center/10/10/04', name: 'p013-reward-execution', permission: null, permissionsAny: ['p013.reward.read', 'p013.reward.execute'] },
        { path: '/center/02/04/04', name: 'p014-discipline-review', permission: null, permissionsAny: ['p014.discipline.read', 'p014.discipline.manage', 'p014.discipline.investigate', 'p014.discipline.decide', 'p014.discipline.appeal'] },
        { path: '/center/06/03/09', name: 'p014-discipline-supervision', permission: null, permissionsAny: ['p014.discipline.read', 'p014.discipline.manage', 'p014.discipline.investigate', 'p014.discipline.decide', 'p014.discipline.appeal', 'p016.welfare.read', 'p016.welfare.manage', 'p016.welfare.approve', 'p016.welfare.execute', 'p016.welfare.reconcile'] },
        { path: '/center/10/09/01', name: 'p015-point-source-management', permission: null, permissionsAny: ['p015.points.read', 'p015.points.manage', 'p015.points.review', 'p015.points.adjust'] },
        { path: '/center/10/09/06', name: 'p015-point-adjustment-review', permission: null, permissionsAny: ['p015.points.read', 'p015.points.review', 'p015.points.adjust'] },
        { path: '/center/08/08/05', name: 'p016-external-execution-receipt', permission: null, permissionsAny: ['p016.welfare.read', 'p016.welfare.manage', 'p016.welfare.approve', 'p016.welfare.execute', 'p016.welfare.reconcile'] },
        { path: '/login', name: 'login', permission: null, permissionsAny: null },
        { path: '/', name: 'portal-home', permission: null, permissionsAny: null },
        { path: '/forbidden', name: 'forbidden', permission: null, permissionsAny: null },
        { path: '/:pathMatch(.*)*', name: 'not-found', permission: null, permissionsAny: null },
      ],
      tech: [
        { path: '/tech/03/01/01', name: 'p001-security-monitor', permission: 'p001.session.monitor', permissionsAny: null },
        { path: '/tech/03/01/04', name: 'p002-permission-execution', permission: null, permissionsAny: ['p002.request.read', 'p002.request.execute', 'p002.request.revoke'] },
        { path: '/tech/04/01/01', name: 'p003-profile-sync-monitor', permission: null, permissionsAny: ['p003.change.read', 'p003.change.apply'] },
        { path: '/tech/05/03/01', name: 'p004-workflow-instance-monitor', permission: null, permissionsAny: ['p004.request.read', 'p005.notice.monitor', 'p006.meeting.monitor', 'p007.schedule.monitor', 'p008.leave.monitor', 'p010.learning.monitor', 'p011.performance.monitor', 'p012.promotion.monitor', 'p013.reward.monitor', 'p014.discipline.monitor', 'p016.welfare.monitor'] },
        { path: '/tech/07/09/01', name: 'p009-overtime-monitor', permission: 'p009.overtime.monitor', permissionsAny: null },
        { path: '/tech/07/11/01', name: 'phase10-attendance-monitor', permission: null, permissionsAny: ['p008.leave.monitor', 'p009.overtime.monitor'] },
        { path: '/tech/03/03/09', name: 'p010-role-action-audit', permission: 'p010.learning.monitor', permissionsAny: null },
        { path: '/tech/06/05/01', name: 'p011-performance-rules', permission: 'p011.performance.monitor', permissionsAny: null },
        { path: '/tech/06/06/01', name: 'p013-reward-monitor', permission: 'p013.reward.monitor', permissionsAny: null },
        { path: '/tech/06/06/09', name: 'p015-point-rule-monitor', permission: null, permissionsAny: ['p015.points.manage', 'p015.points.monitor'] },
        { path: '/login', name: 'login', permission: null, permissionsAny: null },
        { path: '/', name: 'portal-home', permission: null, permissionsAny: null },
        { path: '/forbidden', name: 'forbidden', permission: null, permissionsAny: null },
        { path: '/:pathMatch(.*)*', name: 'not-found', permission: null, permissionsAny: null },
      ],
    } as const
    const actual = Object.fromEntries(Object.values(PORTALS).map((portal) => {
      const router = createPortalRouter(portal, session, createMemoryHistory())
      const routes = router.getRoutes().filter((route) => route.name).map((route) => ({
        path: route.path,
        name: String(route.name),
        permission: typeof route.meta.permission === 'string' ? route.meta.permission : null,
        permissionsAny: Array.isArray(route.meta.permissionsAny) ? [...route.meta.permissionsAny] : null,
      }))
      return [portal.code, routes]
    }))

    expect(actual).toEqual(expected)
    expect(actual.employee).toHaveLength(36)
    expect(actual.center).toHaveLength(33)
    expect(actual.tech).toHaveLength(14)
    for (const portal of Object.values(PORTALS)) {
      const router = createPortalRouter(portal, session, createMemoryHistory())
      for (const route of router.getRoutes()) {
        expect(route.meta).not.toHaveProperty('action')
        expect(route.meta).not.toHaveProperty('actionCode')
        expect(route.meta).not.toHaveProperty('allowedActions')
      }
    }
  })

  it.each(Object.values(PORTALS))('projects IA data scope onto every IA-backed $code route', (portal) => {
    const router = createPortalRouter(portal, session, createMemoryHistory())
    for (const route of router.getRoutes().filter((record) => typeof record.name === 'string')) {
      const routeName = String(route.name)
      if (['login', 'portal-home', 'forbidden', 'not-found'].includes(routeName)) continue
      const pathCandidates = PORTAL_IA_NAVIGATION.filter((entry) =>
        entry.portalCode === portal.code && entry.routePath === route.path)
      const namedCandidates = pathCandidates.filter((entry) => entry.routeName === routeName)
      const explicitlyNamedCandidates = pathCandidates.filter((entry) => entry.routeName !== null)
      const candidates = namedCandidates.length > 0
        ? namedCandidates
        : explicitlyNamedCandidates.length === 0
          ? pathCandidates.filter((entry) => entry.routeName === null)
          : []
      expect(candidates, `${portal.code}:${routeName}`).toHaveLength(1)
      expect((route.meta as Record<string, unknown>).dataScope, routeName).toBe(candidates[0]!.dataScope)
    }
  })

  it.each(Object.values(PORTALS))('locks exact $code runtime and core route metadata', (portal) => {
    const router = createPortalRouter(portal, session, createMemoryHistory())
    const routes = router.getRoutes()
    const expected = {
      login: {
        title: '登录', processCode: 'SESSION', sourceKey: `runtime:${portal.code}:login`,
        sensitiveLevel: null, dataScope: null,
      },
      'portal-home': {
        title: portal.homeTitle, processCode: 'HOME', sourceKey: `runtime:${portal.code}:home`,
        sensitiveLevel: 'P1-内部', dataScope: null,
      },
      forbidden: {
        title: '无权限', processCode: 'ACCESS', sourceKey: `runtime:${portal.code}:forbidden`,
        sensitiveLevel: null, dataScope: null,
      },
      'not-found': {
        title: '页面未找到', processCode: 'NOT_FOUND', sourceKey: `runtime:${portal.code}:not-found`,
        sensitiveLevel: null, dataScope: null,
      },
    } as const
    for (const [routeName, expectedMeta] of Object.entries(expected)) {
      const route = routes.find((record) => record.name === routeName)
      expect(route, `${portal.code}:${routeName}`).toBeDefined()
      expect.soft({
        title: route!.meta.title,
        processCode: route!.meta.processCode,
        sourceKey: route!.meta.sourceKey,
        sensitiveLevel: route!.meta.sensitiveLevel,
        dataScope: route!.meta.dataScope,
      }, `${portal.code}:${routeName}`).toEqual(expectedMeta)
    }
    const authenticatedLayout = routes.find((route) =>
      route.name === undefined && route.meta.requiresAuth === true)
    expect(authenticatedLayout, `${portal.code}:authenticated-layout`).toBeDefined()
    expect(authenticatedLayout!.meta).toMatchObject({ requiresAuth: true, dataScope: null })
  })

  it.each(Object.values(PORTALS))('projects navigation source metadata for $code routes', (portal) => {
    const router = createPortalRouter(portal, session, createMemoryHistory())
    const records = new Map(router.getRoutes().map((route) => [String(route.name), route]))
    const authoritative = PORTAL_IA_NAVIGATION.filter((entry) =>
      entry.portalCode === portal.code && entry.routePath && records.has(entry.routeName ?? ''))

    expect(authoritative.length).toBeGreaterThan(0)
    for (const entry of authoritative) {
      const route = records.get(entry.routeName!)!
      expect(route.path).toBe(entry.routePath)
      expect(route.meta.title).toBe(entry.label)
      expect(route.meta.sourceKey).toBe(entry.sourceKey)
      expect(route.meta.portalCode).toBe(portal.code)
      expect(route.meta.sensitiveLevel).toBe(entry.sensitiveLevel)
      expect(route.meta.processCode).toBe(processCode(entry.routeName!))
    }
  })

  it('uses the unique route path when the source entry has no runtime route name', () => {
    const router = createPortalRouter(PORTALS.center, session, createMemoryHistory())
    const route = router.getRoutes().find((record) => record.name === 'p008-leave-management')
    expect(route?.path).toBe('/center/04/04/01')
    expect(route?.meta.title).toBe('待审批请假')
    expect(route?.meta.sourceKey).toBe('2-2中心全层级页面.xlsx:完整页面树:R253:6634facff70c')
    expect(route?.meta.processCode).toBe('P008')
  })

  it('rejects a null-name fallback when the path has a different explicit route name', async () => {
    await expect(createCenterRouterWithNavigation((entries) => {
      const source = entries.find((entry) =>
        entry.portalCode === 'center' && entry.routePath === '/center/04/04/01')!
      return [...entries, {
        ...source,
        routeName: 'different-explicit-route',
        sourceKey: 'test:different-explicit-route',
      }]
    })).rejects.toThrow(/ROUTE_SOURCE_MISSING/)
  })

  it('rejects duplicate null-name fallback records', async () => {
    await expect(createCenterRouterWithNavigation((entries) => {
      const source = entries.find((entry) =>
        entry.portalCode === 'center' && entry.routePath === '/center/04/04/01')!
      return [...entries, { ...source, sourceKey: 'test:duplicate-null' }]
    })).rejects.toThrow(/ROUTE_SOURCE_AMBIGUOUS/)
  })

  it('rejects duplicate exact-name records', async () => {
    await expect(createCenterRouterWithNavigation((entries) => {
      const source = entries.find((entry) => entry.routeName === 'p006-meeting-management')!
      return [...entries, { ...source, sourceKey: 'test:duplicate-exact' }]
    })).rejects.toThrow(/ROUTE_SOURCE_AMBIGUOUS/)
  })

  it('rejects a missing navigation-source record', async () => {
    await expect(createCenterRouterWithNavigation((entries) => entries.filter((entry) =>
      !(entry.portalCode === 'center' && entry.routePath === '/center/04/04/01'))))
      .rejects.toThrow(/ROUTE_SOURCE_MISSING/)
  })

  it.each(Object.values(PORTALS))('gives every named $code route a non-empty title and portal code', (portal) => {
    const router = createPortalRouter(portal, session, createMemoryHistory())
    for (const route of router.getRoutes().filter((record) => record.name)) {
      expect(route.meta.title, String(route.name)).toEqual(expect.any(String))
      expect(String(route.meta.title).trim(), String(route.name)).not.toBe('')
      expect(route.meta.portalCode, String(route.name)).toBe(portal.code)
    }
  })

  it.each(Object.values(PORTALS).flatMap((portal) => [
    { portal, mobile: false },
    { portal, mobile: true },
  ]))('keeps $portal.code route titles aligned with source labels when mobile=$mobile', ({ portal, mobile }) => {
    const router = createPortalRouter(portal, session, createMemoryHistory())
    const routesByPath = new Map(router.getRoutes().map((route) => [route.path, route]))
    const portalEntries = PORTAL_IA_NAVIGATION.filter((entry) => entry.portalCode === portal.code)
    const permissions = new Set(portalEntries.flatMap((entry) => entry.permissionCodes))
    const projected = projectActiveNavigation(PORTAL_IA_NAVIGATION, {
      portalCode: portal.code,
      permissions,
      implementedRoutePaths: new Set(routesByPath.keys()),
      mobile,
    })

    expect(projected.length).toBeGreaterThan(0)
    for (const item of projected) {
      expect(routesByPath.get(item.routePath)?.meta.title).toBe(item.label)
    }
  })

  it('derives the shell title from route metadata instead of the portal home title', () => {
    expect(authenticatedLayoutSource).toMatch(/route\.meta\.title/)
    expect(authenticatedLayoutSource).toMatch(/:page-title="pageTitle"/)
    expect(authenticatedLayoutSource).not.toMatch(/:page-title="portal\.homeTitle"/)
  })
})
