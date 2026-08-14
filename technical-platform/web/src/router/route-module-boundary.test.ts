import { existsSync, readFileSync } from 'node:fs'
import type { RouteMeta } from 'vue-router'
import { describe, expect, expectTypeOf, it } from 'vitest'
import * as routeContracts from '../contracts/route'
import {
  CORE_ROUTE_META,
  processCodeForRouteName,
  type RoutePermission,
  type RoutePermissionCode,
  type RouteProcessCode,
} from '../contracts/route'
import * as coreRoutes from './core-routes'
import * as phase09Routes from './phase09-routes'
import * as phase10Routes from './phase10-routes'

const moduleContracts = [
  {
    path: './core-routes',
    exports: [
      ['attachAuthoritativeRouteMeta', coreRoutes.attachAuthoritativeRouteMeta],
      ['createCoreRoutes', coreRoutes.createCoreRoutes],
    ],
  },
  {
    path: './phase09-routes',
    exports: [['createPhase09Routes', phase09Routes.createPhase09Routes]],
  },
  {
    path: './phase10-routes',
    exports: [['createPhase10Routes', phase10Routes.createPhase10Routes]],
  },
  {
    path: '../contracts/route',
    exports: [
      ['CORE_ROUTE_META', routeContracts.CORE_ROUTE_META],
      ['ROUTE_PERMISSIONS', routeContracts.ROUTE_PERMISSIONS],
      ['processCodeForRouteName', routeContracts.processCodeForRouteName],
    ],
  },
] as const

const routeProductionFiles = [
  new URL('./portal-router.ts', import.meta.url),
  new URL('./core-routes.ts', import.meta.url),
  new URL('./phase09-routes.ts', import.meta.url),
  new URL('./phase10-routes.ts', import.meta.url),
] as const

describe('portal route module boundary', () => {
  it.each(moduleContracts)('loads $path as an executable route contributor', ({ exports }) => {
    for (const [exportName, exportedValue] of exports) {
      expect(exportedValue, exportName).toBeDefined()
    }
  })

  it('declares explicit data scope on the shared RouteMeta contract', () => {
    const meta = { dataScope: null } satisfies RouteMeta
    expect(meta.dataScope).toBeNull()
  })

  it('publishes exact permission and process-code contracts', () => {
    type ExpectedProcessCode =
      | 'P001' | 'P002' | 'P003' | 'P004' | 'P005' | 'P006' | 'P007' | 'P008'
      | 'P009' | 'P010' | 'P011' | 'P012' | 'P013' | 'P014' | 'P015' | 'P016'
      | 'PHASE-09' | 'PHASE-10' | 'PORTAL'
      | 'SESSION' | 'HOME' | 'ACCESS' | 'NOT_FOUND'
    const coreProcessCodes = [
      CORE_ROUTE_META.login.processCode,
      CORE_ROUTE_META.home.processCode,
      CORE_ROUTE_META.forbidden.processCode,
      CORE_ROUTE_META.notFound.processCode,
    ] satisfies readonly RouteProcessCode[]

    expectTypeOf<RoutePermissionCode>().toEqualTypeOf<RoutePermission>()
    expectTypeOf<RouteProcessCode>().toEqualTypeOf<ExpectedProcessCode>()
    expectTypeOf(processCodeForRouteName('p001-mfa')).toEqualTypeOf<ExpectedProcessCode>()
    expectTypeOf(processCodeForRouteName('p001-mfa')).toEqualTypeOf<RouteProcessCode>()
    expect(coreProcessCodes).toEqual(['SESSION', 'HOME', 'ACCESS', 'NOT_FOUND'])
  })

  it('does not publish a duplicate process-code helper alias', () => {
    expect(routeContracts).not.toHaveProperty('processCodeForRoute')
  })

  it('moves task-owned permission literals out of route production modules', () => {
    const existingSources = routeProductionFiles
      .filter((path) => existsSync(path))
      .map((path) => readFileSync(path, 'utf8'))
    expect(existingSources).toHaveLength(4)
    for (const source of existingSources) {
      expect(source).not.toMatch(/['"]p\d{3}\.[a-z][a-z0-9.-]*['"]/i)
    }
  })
})
