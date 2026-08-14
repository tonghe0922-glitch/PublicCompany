import type { RouteRecordRaw } from 'vue-router'
import type { PortalDefinition } from '../platform/portal-config'
import P001IdentityPage from '../platform/pages/P001IdentityPage.vue'
import P002PermissionRequestPage from '../platform/pages/P002PermissionRequestPage.vue'
import P003ProfileChangePage from '../platform/pages/P003ProfileChangePage.vue'
import P004GenericRequestPage from '../platform/pages/P004GenericRequestPage.vue'
import P005NoticePage from '../platform/pages/P005NoticePage.vue'
import Phase09CenterInboxPage from '../platform/pages/Phase09CenterInboxPage.vue'
import Phase10TechMonitorPage from '../platform/pages/Phase10TechMonitorPage.vue'

function phase09P001Routes(portal: PortalDefinition): RouteRecordRaw[] {
  const shared = { component: P001IdentityPage, props: { portal } }
  if (portal.code === 'employee') return [
    { ...shared, path: '/employee/13/04/04', name: 'p001-mfa' },
    { ...shared, path: '/employee/13/04/06', name: 'p001-sessions' },
  ]
  if (portal.code === 'tech') return [{ ...shared, path: '/tech/03/01/01', name: 'p001-security-monitor' }]
  return []
}

function phase09P002Routes(portal: PortalDefinition): RouteRecordRaw[] {
  if (portal.code === 'employee') return [
    { path: '/employee/03/07/04', name: 'p002-temporary-permission-request', component: P002PermissionRequestPage,
      props: { portal, mode: 'employee', requestKind: 'TEMPORARY_PERMISSION' } },
    { path: '/employee/03/07/05', name: 'p002-project-permission-request', component: P002PermissionRequestPage,
      props: { portal, mode: 'employee', requestKind: 'PROJECT_PERMISSION' } },
  ]
  if (portal.code === 'tech') return [{ path: '/tech/03/01/04', name: 'p002-permission-execution', component: P002PermissionRequestPage,
    props: { portal, mode: 'tech' } }]
  return []
}

function phase09P003Routes(portal: PortalDefinition): RouteRecordRaw[] {
  if (portal.code === 'employee') return [{
    path: '/employee/03/03/01', name: 'p003-profile-change', component: P003ProfileChangePage,
    props: { portal, mode: 'employee' },
  }]
  if (portal.code === 'center') return [{
    path: '/center/03/02/01', name: 'p003-profile-roster', component: P003ProfileChangePage,
    props: { portal, mode: 'center' },
  }]
  if (portal.code === 'tech') return [{
    path: '/tech/04/01/01', name: 'p003-profile-sync-monitor', component: P003ProfileChangePage,
    props: { portal, mode: 'tech' },
  }]
  return []
}

function phase09P004Routes(portal: PortalDefinition): RouteRecordRaw[] {
  if (portal.code === 'employee') return [{
    path: '/employee/03/07/01', name: 'p004-generic-request', component: P004GenericRequestPage,
    props: { portal, mode: 'employee' },
  }]
  return []
}

function phase09P005Routes(portal: PortalDefinition): RouteRecordRaw[] {
  if (portal.code === 'employee') return [{
    path: '/employee/13/01/05', name: 'p005-notice-receipt', component: P005NoticePage,
    props: { portal, mode: 'employee' },
  }]
  if (portal.code === 'center') return [{
    path: '/center/13/01/05', name: 'p005-notice-publish', component: P005NoticePage,
    props: { portal, mode: 'center' },
  }]
  return []
}

function phase09SharedCenterRoutes(portal: PortalDefinition): RouteRecordRaw[] {
  if (portal.code !== 'center') return []
  return [{
    path: '/center/02/01/01', name: 'phase09-center-inbox', component: Phase09CenterInboxPage, props: { portal },
  }]
}

function phase09SharedTechWorkflowRoutes(portal: PortalDefinition): RouteRecordRaw[] {
  if (portal.code !== 'tech') return []
  return [{
    path: '/tech/05/03/01', name: 'p004-workflow-instance-monitor', component: Phase10TechMonitorPage, props: { portal },
  }]
}

export function createPhase09Routes(portal: PortalDefinition): RouteRecordRaw[] {
  return [
    ...phase09P001Routes(portal),
    ...phase09P002Routes(portal),
    ...phase09P003Routes(portal),
    ...phase09P004Routes(portal),
    ...phase09P005Routes(portal),
    ...phase09SharedCenterRoutes(portal),
    ...phase09SharedTechWorkflowRoutes(portal),
  ]
}
