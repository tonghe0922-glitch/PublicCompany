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
import P001IdentityPage from '../platform/pages/P001IdentityPage.vue'
import P002PermissionRequestPage from '../platform/pages/P002PermissionRequestPage.vue'
import P003ProfileChangePage from '../platform/pages/P003ProfileChangePage.vue'
import P004GenericRequestPage from '../platform/pages/P004GenericRequestPage.vue'
import P005NoticePage from '../platform/pages/P005NoticePage.vue'
import P006MeetingPage from '../platform/pages/P006MeetingPage.vue'
import Phase09CenterInboxPage from '../platform/pages/Phase09CenterInboxPage.vue'
import Phase09TechWorkflowMonitorPage from '../platform/pages/Phase09TechWorkflowMonitorPage.vue'
import { clearRuntimeError, recordRuntimeError } from '../platform/runtime-error-state'
import { rotateNavigationAbortSignal } from './navigation-abort'
import { safeInternalRedirect } from './redirect'

export interface PortalRouterSession {
  readonly authenticated: boolean
  restore: () => Promise<boolean>
  can: (permission: string) => boolean
}

function loginTarget(to: RouteLocationNormalized) { return { name: 'login', query: { redirect: safeInternalRedirect(to.fullPath) } } }
async function restoreOnce(session: PortalRouterSession, state: { attempted: boolean }): Promise<void> {
  if (state.attempted || session.authenticated) return
  state.attempted = true
  try { await session.restore() } catch (cause) { recordRuntimeError(cause) }
}
function requiredPermission(to: RouteLocationNormalized): string | undefined { return typeof to.meta.permission === 'string' ? to.meta.permission : undefined }
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

function phase09P001Routes(portal: PortalDefinition): RouteRecordRaw[] {
  const shared = { component: P001IdentityPage, props: { portal } }
  if (portal.code === 'employee') return [
    { ...shared, path: '/employee/13/04/04', name: 'p001-mfa' },
    { ...shared, path: '/employee/13/04/06', name: 'p001-sessions' },
  ]
  if (portal.code === 'tech') return [{ ...shared, path: '/tech/03/01/01', name: 'p001-security-monitor', meta: { permission: 'p001.session.monitor' } }]
  return []
}
function phase09P002Routes(portal: PortalDefinition): RouteRecordRaw[] {
  if (portal.code === 'employee') return [
    { path: '/employee/03/07/04', name: 'p002-temporary-permission-request', component: P002PermissionRequestPage, props: { portal, mode: 'employee', requestKind: 'TEMPORARY_PERMISSION' }, meta: { permissionsAny: ['p002.request.submit', 'p002.request.read'] } },
    { path: '/employee/03/07/05', name: 'p002-project-permission-request', component: P002PermissionRequestPage, props: { portal, mode: 'employee', requestKind: 'PROJECT_PERMISSION' }, meta: { permissionsAny: ['p002.request.submit', 'p002.request.read'] } },
  ]
  if (portal.code === 'tech') return [{ path: '/tech/03/01/04', name: 'p002-permission-execution', component: P002PermissionRequestPage, props: { portal, mode: 'tech' }, meta: { permissionsAny: ['p002.request.read', 'p002.request.execute', 'p002.request.revoke'] } }]
  return []
}
function phase09P003Routes(portal: PortalDefinition): RouteRecordRaw[] {
  if (portal.code === 'employee') return [{ path: '/employee/03/03/01', name: 'p003-profile-change', component: P003ProfileChangePage, props: { portal, mode: 'employee' }, meta: { permissionsAny: ['p003.change.submit', 'p003.change.read'] } }]
  if (portal.code === 'center') return [{ path: '/center/03/02/01', name: 'p003-profile-roster', component: P003ProfileChangePage, props: { portal, mode: 'center' }, meta: { permissionsAny: ['p003.change.read', 'p003.change.review'] } }]
  if (portal.code === 'tech') return [{ path: '/tech/04/01/01', name: 'p003-profile-sync-monitor', component: P003ProfileChangePage, props: { portal, mode: 'tech' }, meta: { permissionsAny: ['p003.change.read', 'p003.change.apply'] } }]
  return []
}
function phase09P004Routes(portal: PortalDefinition): RouteRecordRaw[] {
  if (portal.code === 'employee') return [{ path: '/employee/03/07/01', name: 'p004-generic-request', component: P004GenericRequestPage, props: { portal, mode: 'employee' }, meta: { permissionsAny: ['p004.request.submit', 'p004.request.read'] } }]
  return []
}
function phase09P005Routes(portal: PortalDefinition): RouteRecordRaw[] {
  if (portal.code === 'employee') return [{ path: '/employee/13/01/05', name: 'p005-notice-receipt', component: P005NoticePage, props: { portal, mode: 'employee' }, meta: { permissionsAny: ['p005.notice.read', 'p005.notice.receipt'] } }]
  if (portal.code === 'center') return [{ path: '/center/13/01/05', name: 'p005-notice-publish', component: P005NoticePage, props: { portal, mode: 'center' }, meta: { permissionsAny: ['p005.notice.publish', 'p005.notice.manage'] } }]
  return []
}

function phase10P006Routes(portal: PortalDefinition): RouteRecordRaw[] {
  if (portal.code === 'employee') return [
    { path: '/employee/05/01/03', name: 'p006-meeting-detail', component: P006MeetingPage, props: { portal, mode: 'employee' }, meta: { permissionsAny: ['p006.meeting.read','p006.meeting.action'] } },
    { path: '/employee/05/07/02', name: 'p006-action-items', component: P006MeetingPage, props: { portal, mode: 'employee' }, meta: { permissionsAny: ['p006.meeting.read','p006.meeting.action'] } },
  ]
  if (portal.code === 'center') return [
    { path: '/center/06/09/03', name: 'p006-meeting-management', component: P006MeetingPage, props: { portal, mode: 'center' }, meta: { permissionsAny: ['p006.meeting.create','p006.meeting.manage','p006.meeting.accept'] } },
    { path: '/center/05/02/02', name: 'p006-action-ledger', component: P006MeetingPage, props: { portal, mode: 'center' }, meta: { permissionsAny: ['p006.meeting.read','p006.meeting.manage','p006.meeting.accept'] } },
  ]
  return []
}

function phase09SharedCenterRoutes(portal: PortalDefinition): RouteRecordRaw[] {
  if (portal.code !== 'center') return []
  return [{ path: '/center/02/01/01', name: 'phase09-center-inbox', component: Phase09CenterInboxPage, props: { portal }, meta: { permissionsAny: ['p001.session.monitor','p002.request.read','p002.request.review','p003.change.read','p003.change.review','p004.request.read','p004.request.act'] } }]
}
function phase09SharedTechWorkflowRoutes(portal: PortalDefinition): RouteRecordRaw[] {
  if (portal.code !== 'tech') return []
  return [{ path: '/tech/05/03/01', name: 'p004-workflow-instance-monitor', component: Phase09TechWorkflowMonitorPage, props: { portal }, meta: { permissionsAny: ['p004.request.read','p005.notice.monitor','p006.meeting.monitor'] } }]
}
function authenticatedRoutes(portal: PortalDefinition): RouteRecordRaw {
  return { path: '/', component: AuthenticatedPortalLayout, props: { portal }, meta: { requiresAuth: true }, children: [
    { path: '', name: 'portal-home', component: PlatformShell, props: { portal } },
    ...phase09P001Routes(portal), ...phase09P002Routes(portal), ...phase09P003Routes(portal), ...phase09P004Routes(portal),
    ...phase09P005Routes(portal), ...phase10P006Routes(portal), ...phase09SharedCenterRoutes(portal), ...phase09SharedTechWorkflowRoutes(portal),
    { path: '/forbidden', name: 'forbidden', component: ForbiddenPage, props: { portal } },
  ] }
}
export function createPortalRouter(portal: PortalDefinition, session: PortalRouterSession, history: RouterHistory = createWebHashHistory()): Router {
  const router = createRouter({ history, routes: [
    { path: '/login', name: 'login', component: LoginPage, props: { portal }, meta: { guestOnly: true } },
    authenticatedRoutes(portal),
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundPage, props: { portal } },
  ] })
  registerGuards(router, session)
  return router
}
