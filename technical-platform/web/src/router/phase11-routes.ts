import type { RouteRecordRaw } from 'vue-router'
import type { PortalDefinition } from '../platform/portal-config'
import P011PerformancePage from '../platform/pages/P011PerformancePage.vue'
import P012PromotionPage from '../platform/pages/P012PromotionPage.vue'
import P013RewardPage from '../platform/pages/P013RewardPage.vue'
import P014DisciplinePage from '../platform/pages/P014DisciplinePage.vue'
import P015PointLedgerPage from '../platform/pages/P015PointLedgerPage.vue'
import P016CareSupportPage from '../platform/pages/P016CareSupportPage.vue'
import Phase11DisciplineCareSupervisionPage from '../platform/pages/Phase11DisciplineCareSupervisionPage.vue'

function phase11P011Routes(portal: PortalDefinition): RouteRecordRaw[] {
  if (portal.code === 'employee') return [
    { path: '/employee/02/03/06', name: 'p011-performance-cycle', component: P011PerformancePage, props: { portal, mode: 'employee' } },
    { path: '/employee/08/03/06', name: 'p011-performance-feedback', component: P011PerformancePage, props: { portal, mode: 'employee' } },
  ]
  if (portal.code === 'center') return [
    { path: '/center/10/02/01', name: 'p011-self-evaluation', component: P011PerformancePage, props: { portal, mode: 'center' } },
    { path: '/center/10/02/04', name: 'p011-score-calculation', component: P011PerformancePage, props: { portal, mode: 'center' } },
    { path: '/center/10/02/05', name: 'p011-calibration', component: P011PerformancePage, props: { portal, mode: 'center' } },
  ]
  if (portal.code === 'tech') return [{ path: '/tech/06/05/01', name: 'p011-performance-rules', component: P011PerformancePage, props: { portal, mode: 'tech' } }]
  return []
}

function phase11P012Routes(portal: PortalDefinition): RouteRecordRaw[] {
  if (portal.code === 'employee') return [
    { path: '/employee/03/03/05', name: 'p012-promotion-application', component: P012PromotionPage, props: { portal, mode: 'employee' } },
    { path: '/employee/08/09/03', name: 'p012-appointment-confirmation', component: P012PromotionPage, props: { portal, mode: 'employee' } },
  ]
  if (portal.code === 'center') return [
    { path: '/center/03/08/05', name: 'p012-promotion-review', component: P012PromotionPage, props: { portal, mode: 'center' } },
    { path: '/center/03/08/06', name: 'p012-promotion-appointment', component: P012PromotionPage, props: { portal, mode: 'center' } },
  ]
  return []
}

function phase11P013Routes(portal: PortalDefinition): RouteRecordRaw[] {
  if (portal.code === 'employee') return [{ path: '/employee/08/10/05', name: 'p013-my-rewards', component: P013RewardPage, props: { portal, mode: 'employee' } }]
  if (portal.code === 'center') return [
    { path: '/center/10/10/03', name: 'p013-reward-review', component: P013RewardPage, props: { portal, mode: 'center' } },
    { path: '/center/10/10/04', name: 'p013-reward-execution', component: P013RewardPage, props: { portal, mode: 'center' } },
  ]
  if (portal.code === 'tech') return [{ path: '/tech/06/06/01', name: 'p013-reward-monitor', component: P013RewardPage, props: { portal, mode: 'tech' } }]
  return []
}

function phase11P014Routes(portal: PortalDefinition): RouteRecordRaw[] {
  if (portal.code === 'employee') return [{ path: '/employee/02/03/09', name: 'p014-my-discipline-case', component: P014DisciplinePage, props: { portal, mode: 'employee' } }]
  if (portal.code === 'center') return [
    { path: '/center/02/04/04', name: 'p014-discipline-review', component: P014DisciplinePage, props: { portal, mode: 'center' } },
    { path: '/center/06/03/09', name: 'p014-discipline-supervision', component: Phase11DisciplineCareSupervisionPage, props: { portal } },
  ]
  return []
}

function phase11P015Routes(portal: PortalDefinition): RouteRecordRaw[] {
  if (portal.code === 'employee') return [
    { path: '/employee/08/06/04', name: 'p015-my-growth-points', component: P015PointLedgerPage, props: { portal, mode: 'employee' } },
    { path: '/employee/08/06/06', name: 'p015-my-honor-points', component: P015PointLedgerPage, props: { portal, mode: 'employee' } },
  ]
  if (portal.code === 'center') return [
    { path: '/center/10/09/01', name: 'p015-point-source-management', component: P015PointLedgerPage, props: { portal, mode: 'center' } },
    { path: '/center/10/09/06', name: 'p015-point-adjustment-review', component: P015PointLedgerPage, props: { portal, mode: 'center' } },
  ]
  if (portal.code === 'tech') return [{ path: '/tech/06/06/09', name: 'p015-point-rule-monitor', component: P015PointLedgerPage, props: { portal, mode: 'tech' } }]
  return []
}

function phase11P016Routes(portal: PortalDefinition): RouteRecordRaw[] {
  if (portal.code === 'employee') return [
    { path: '/employee/03/06/01', name: 'p016-marriage-birth-care', component: P016CareSupportPage, props: { portal, mode: 'employee' } },
    { path: '/employee/03/06/05', name: 'p016-hardship-care', component: P016CareSupportPage, props: { portal, mode: 'employee' } },
  ]
  if (portal.code === 'center') return [{ path: '/center/08/08/05', name: 'p016-external-execution-receipt', component: P016CareSupportPage, props: { portal, mode: 'center' } }]
  return []
}

export function createPhase11Routes(portal: PortalDefinition): RouteRecordRaw[] {
  return [
    ...phase11P011Routes(portal),
    ...phase11P012Routes(portal),
    ...phase11P013Routes(portal),
    ...phase11P014Routes(portal),
    ...phase11P015Routes(portal),
    ...phase11P016Routes(portal),
  ]
}
