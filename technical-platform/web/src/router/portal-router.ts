import {
  createRouter,
  createWebHashHistory,
  type RouteLocationNormalized,
  type Router,
  type RouterHistory,
} from 'vue-router'
import type { PortalDefinition } from '../platform/portal-config'
import { clearRuntimeError, recordRuntimeError } from '../platform/runtime-error-state'
import { attachAuthoritativeRouteMeta, createCoreRoutes } from './core-routes'
import { rotateNavigationAbortSignal } from './navigation-abort'
import { safeInternalRedirect } from './redirect'

export interface PortalRouterSession {
  readonly authenticated: boolean
  restore: () => Promise<boolean>
  can: (permission: string) => boolean
}

function loginTarget(to: RouteLocationNormalized) {
  return { name: 'login', query: { redirect: safeInternalRedirect(to.fullPath) } }
}

async function restoreOnce(session: PortalRouterSession, state: { attempted: boolean }): Promise<void> {
  if (state.attempted || session.authenticated) return
  state.attempted = true
  try { await session.restore() } catch (cause) { recordRuntimeError(cause) }
}

function requiredPermission(to: RouteLocationNormalized): string | undefined {
  return typeof to.meta.permission === 'string' ? to.meta.permission : undefined
}

function requiredPermissionsAny(to: RouteLocationNormalized): string[] {
  if (!Array.isArray(to.meta.permissionsAny)) return []
  return to.meta.permissionsAny.filter((value): value is string => typeof value === 'string' && value.length > 0)
}

function registerGuards(router: Router, session: PortalRouterSession): void {
  const restoreState = { attempted: false }
  router.beforeEach(async (to) => {
    rotateNavigationAbortSignal(); clearRuntimeError(); await restoreOnce(session, restoreState)
    if (to.meta.requiresAuth && !session.authenticated) return loginTarget(to)
    if (to.meta.guestOnly && session.authenticated) return safeInternalRedirect(to.query.redirect)
    const permission = requiredPermission(to)
    if (permission && !session.can(permission)) return { name: 'forbidden' }
    const permissionsAny = requiredPermissionsAny(to)
    if (permissionsAny.length > 0 && !permissionsAny.some((candidate) => session.can(candidate))) return { name: 'forbidden' }
    return true
  })
  router.onError(recordRuntimeError)
}

export function createPortalRouter(
  portal: PortalDefinition,
  session: PortalRouterSession,
  history: RouterHistory = createWebHashHistory(),
): Router {
  const router = createRouter({
    history,
    routes: [...createCoreRoutes(portal)],
  })
  attachAuthoritativeRouteMeta(router, portal)
  registerGuards(router, session)
  return router
}
