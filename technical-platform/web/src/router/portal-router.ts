import {
  createRouter,
  createWebHashHistory,
  type RouteLocationNormalized,
  type RouteRecordRaw,
  type Router,
  type RouterHistory,
} from 'vue-router'
import AuthenticatedPortalLayout from '../platform/AuthenticatedPortalLayout.vue'
import type { PortalDefinition } from '../platform/portal-config'
import PlatformShell from '../platform/PlatformShell.vue'
import ForbiddenPage from '../platform/pages/ForbiddenPage.vue'
import LoginPage from '../platform/pages/LoginPage.vue'
import NotFoundPage from '../platform/pages/NotFoundPage.vue'
import { clearRuntimeError, recordRuntimeError } from '../platform/runtime-error-state'
import { rotateNavigationAbortSignal } from './navigation-abort'
import { PORTAL_ROUTE_SPECS, type PortalRouteSpec } from './portal-route-specs'
import { safeInternalRedirect } from './redirect'

export interface PortalRouterSession {
  readonly authenticated: boolean
  restore: () => Promise<boolean>
  can: (permission: string) => boolean
}

function loginTarget(to: RouteLocationNormalized) {
  return {
    name: 'login',
    query: { redirect: safeInternalRedirect(to.fullPath) },
  }
}

async function restoreOnce(
  session: PortalRouterSession,
  state: { attempted: boolean },
): Promise<void> {
  if (state.attempted || session.authenticated) return
  state.attempted = true
  try {
    await session.restore()
  } catch (cause) {
    recordRuntimeError(cause)
  }
}

function requiredPermission(to: RouteLocationNormalized): string | undefined {
  return typeof to.meta.permission === 'string' ? to.meta.permission : undefined
}

function requiredPermissionsAny(to: RouteLocationNormalized): string[] {
  if (!Array.isArray(to.meta.permissionsAny)) return []
  return to.meta.permissionsAny.filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  )
}

function authorizationRedirect(
  to: RouteLocationNormalized,
  session: PortalRouterSession,
) {
  const permission = requiredPermission(to)
  if (permission && !session.can(permission)) return { name: 'forbidden' }
  const permissionsAny = requiredPermissionsAny(to)
  if (permissionsAny.length && !permissionsAny.some((candidate) => session.can(candidate))) return { name: 'forbidden' }
  return undefined
}

function registerGuards(router: Router, session: PortalRouterSession): void {
  const state = { attempted: false }
  router.beforeEach(async (to) => {
    rotateNavigationAbortSignal()
    clearRuntimeError()
    await restoreOnce(session, state)
    if (to.meta.requiresAuth && !session.authenticated) return loginTarget(to)
    if (to.meta.guestOnly && session.authenticated) {
      return safeInternalRedirect(to.query.redirect)
    }
    return authorizationRedirect(to, session) ?? true
  })
  router.onError(recordRuntimeError)
}

function routeMeta(spec: PortalRouteSpec) {
  return {
    ...(spec.permission ? { permission: spec.permission } : {}),
    ...(spec.permissionsAny ? { permissionsAny: [...spec.permissionsAny] } : {}),
  }
}

function portalRoutes(portal: PortalDefinition): RouteRecordRaw[] {
  return PORTAL_ROUTE_SPECS
    .filter((spec) => spec.portal === portal.code)
    .map((spec) => ({
      path: spec.path,
      name: spec.name,
      component: spec.component,
      props: { portal, ...spec.props },
      meta: routeMeta(spec),
    }))
}

function authenticatedRoutes(portal: PortalDefinition): RouteRecordRaw {
  return {
    path: '/',
    component: AuthenticatedPortalLayout,
    props: { portal },
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'portal-home', component: PlatformShell, props: { portal } },
      ...portalRoutes(portal),
      { path: '/forbidden', name: 'forbidden', component: ForbiddenPage, props: { portal } },
    ],
  }
}

export function createPortalRouter(
  portal: PortalDefinition,
  session: PortalRouterSession,
  history: RouterHistory = createWebHashHistory(),
): Router {
  const router = createRouter({
    history,
    routes: [
      {
        path: '/login', name: 'login', component: LoginPage,
        props: { portal }, meta: { guestOnly: true },
      },
      authenticatedRoutes(portal),
      {
        path: '/:pathMatch(.*)*', name: 'not-found',
        component: NotFoundPage, props: { portal },
      },
    ],
  })
  registerGuards(router, session)
  return router
}
