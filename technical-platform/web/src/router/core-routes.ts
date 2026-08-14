import type { RouteMeta, RouteRecordRaw, Router } from 'vue-router'
import { CORE_ROUTE_META, guardMetaForRouteName, processCodeForRouteName } from '../contracts/route'
import AuthenticatedPortalLayout from '../platform/AuthenticatedPortalLayout.vue'
import type { PortalDefinition } from '../platform/portal-config'
import PlatformShell from '../platform/PlatformShell.vue'
import ForbiddenPage from '../platform/pages/ForbiddenPage.vue'
import LoginPage from '../platform/pages/LoginPage.vue'
import NotFoundPage from '../platform/pages/NotFoundPage.vue'
import { PORTAL_IA_NAVIGATION } from './navigation-source'
import { createPhase09Routes } from './phase09-routes'
import { createPhase10Routes } from './phase10-routes'

function authoritativeRouteMeta(portal: PortalDefinition, routeName: string, routePath: string): RouteMeta {
  if (routeName === 'portal-home') return {
    title: portal.homeTitle,
    processCode: CORE_ROUTE_META.home.processCode,
    sourceKey: `runtime:${portal.code}:home`,
    portalCode: portal.code,
    sensitiveLevel: 'P1-内部',
    dataScope: CORE_ROUTE_META.home.dataScope,
  }
  if (routeName === 'forbidden') return {
    title: '无权限',
    processCode: CORE_ROUTE_META.forbidden.processCode,
    sourceKey: `runtime:${portal.code}:forbidden`,
    portalCode: portal.code,
    sensitiveLevel: null,
    dataScope: CORE_ROUTE_META.forbidden.dataScope,
  }

  const pathCandidates = PORTAL_IA_NAVIGATION.filter((entry) =>
    entry.portalCode === portal.code && entry.routePath === routePath)
  const namedCandidates = pathCandidates.filter((entry) => entry.routeName === routeName)
  const explicitlyNamedCandidates = pathCandidates.filter((entry) => entry.routeName !== null)
  const candidates = namedCandidates.length > 0
    ? namedCandidates
    : explicitlyNamedCandidates.length === 0
      ? pathCandidates.filter((entry) => entry.routeName === null)
      : []
  if (candidates.length !== 1) {
    throw new Error(`ROUTE_SOURCE_${candidates.length === 0 ? 'MISSING' : 'AMBIGUOUS'}: ${portal.code}:${routeName}:${routePath}`)
  }
  const source = candidates[0]!
  return {
    title: source.label,
    processCode: processCodeForRouteName(routeName),
    sourceKey: source.sourceKey,
    portalCode: portal.code,
    sensitiveLevel: source.sensitiveLevel,
    dataScope: source.dataScope,
  }
}

export function attachAuthoritativeRouteMeta(router: Router, portal: PortalDefinition): void {
  for (const route of router.getRoutes()) {
    if (typeof route.name !== 'string' || route.name === 'login' || route.name === 'not-found') continue
    Object.assign(
      route.meta,
      guardMetaForRouteName(route.name),
      authoritativeRouteMeta(portal, route.name, route.path),
    )
  }
}

export function createCoreRoutes(portal: PortalDefinition): RouteRecordRaw[] {
  return [
    { path: '/login', name: 'login', component: LoginPage, props: { portal }, meta: {
      guestOnly: true, title: '\u767b\u5f55', processCode: CORE_ROUTE_META.login.processCode,
      sourceKey: `runtime:${portal.code}:login`, portalCode: portal.code,
      sensitiveLevel: null, dataScope: CORE_ROUTE_META.login.dataScope,
    } },
    { path: '/', component: AuthenticatedPortalLayout, props: { portal }, meta: {
      requiresAuth: true, portalCode: portal.code, dataScope: CORE_ROUTE_META.authenticatedLayout.dataScope,
    }, children: [
      { path: '', name: 'portal-home', component: PlatformShell, props: { portal } },
      ...createPhase09Routes(portal), ...createPhase10Routes(portal),
      { path: '/forbidden', name: 'forbidden', component: ForbiddenPage, props: { portal } },
    ] },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundPage, props: { portal }, meta: {
      title: '\u9875\u9762\u672a\u627e\u5230', processCode: CORE_ROUTE_META.notFound.processCode,
      sourceKey: `runtime:${portal.code}:not-found`, portalCode: portal.code,
      sensitiveLevel: null, dataScope: CORE_ROUTE_META.notFound.dataScope,
    } },
  ]
}
