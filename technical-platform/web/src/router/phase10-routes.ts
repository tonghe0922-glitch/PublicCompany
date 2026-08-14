import type { RouteRecordRaw } from 'vue-router'
import type { PortalDefinition } from '../platform/portal-config'
import P006MeetingPage from '../platform/pages/P006MeetingPage.vue'
import P007SchedulePage from '../platform/pages/P007SchedulePage.vue'
import P008LeavePage from '../platform/pages/P008LeavePage.vue'
import P009OvertimePage from '../platform/pages/P009OvertimePage.vue'
import Phase10AttendanceMonitorPage from '../platform/pages/Phase10AttendanceMonitorPage.vue'
import P010LearningPage from '../platform/pages/P010LearningPage.vue'
import P011PerformancePage from '../platform/pages/P011PerformancePage.vue'
import P012PromotionPage from '../platform/pages/P012PromotionPage.vue'
import P013RewardPage from '../platform/pages/P013RewardPage.vue'
import P014DisciplinePage from '../platform/pages/P014DisciplinePage.vue'
import P015PointLedgerPage from '../platform/pages/P015PointLedgerPage.vue'
import P016CareSupportPage from '../platform/pages/P016CareSupportPage.vue'

function phase10P006Routes(portal: PortalDefinition): RouteRecordRaw[] {
  if (portal.code === 'employee') return [
    { path: '/employee/05/01/03', name: 'p006-meeting-detail', component: P006MeetingPage, props: { portal, mode: 'employee' } },
    { path: '/employee/05/07/02', name: 'p006-action-items', component: P006MeetingPage, props: { portal, mode: 'employee' } },
  ]
  if (portal.code === 'center') return [
    { path: '/center/06/09/03', name: 'p006-meeting-management', component: P006MeetingPage, props: { portal, mode: 'center' } },
    { path: '/center/05/02/02', name: 'p006-action-ledger', component: P006MeetingPage, props: { portal, mode: 'center' } },
  ]
  return []
}

function phase10P007Routes(portal: PortalDefinition): RouteRecordRaw[] {
  if (portal.code === 'employee') return [
    { path: '/employee/04/01/01', name: 'p007-my-schedule', component: P007SchedulePage, props: { portal, mode: 'employee' } },
    { path: '/employee/03/01/09', name: 'p007-shift-change', component: P007SchedulePage, props: { portal, mode: 'employee' } },
    { path: '/employee/03/01/10', name: 'p007-substitution', component: P007SchedulePage, props: { portal, mode: 'employee' } },
  ]
  if (portal.code === 'center') return [
    { path: '/center/04/01/01', name: 'p007-schedule-plan', component: P007SchedulePage, props: { portal, mode: 'center' } },
    { path: '/center/04/07/04', name: 'p007-shift-review', component: P007SchedulePage, props: { portal, mode: 'center' } },
    { path: '/center/04/07/05', name: 'p007-qualification-check', component: P007SchedulePage, props: { portal, mode: 'center' } },
  ]
  return []
}

function phase10P008Routes(portal: PortalDefinition): RouteRecordRaw[] {
  if (portal.code === 'employee') return [
    { path: '/employee/03/01/01', name: 'p008-leave-request', component: P008LeavePage, props: { portal, mode: 'employee' } },
    { path: '/employee/04/03/02', name: 'p008-leave-records', component: P008LeavePage, props: { portal, mode: 'employee' } },
    { path: '/employee/03/01/02', name: 'p008-leave-change', component: P008LeavePage, props: { portal, mode: 'employee' } },
  ]
  if (portal.code === 'center') return [
    { path: '/center/04/04/01', name: 'p008-leave-management', component: P008LeavePage, props: { portal, mode: 'center' } },
    { path: '/center/04/04/03', name: 'p008-leave-review', component: P008LeavePage, props: { portal, mode: 'center' } },
    { path: '/center/04/04/06', name: 'p008-attendance-close', component: P008LeavePage, props: { portal, mode: 'center' } },
  ]
  return []
}

function phase10P009Routes(portal: PortalDefinition): RouteRecordRaw[] {
  if (portal.code === 'employee') return [
    { path:'/employee/03/01/06', name:'p009-overtime-request', component:P009OvertimePage, props:{portal,mode:'employee'} },
    { path:'/employee/03/01/07', name:'p009-time-off-request', component:P009OvertimePage, props:{portal,mode:'employee'} },
    { path:'/employee/04/04/02', name:'p009-overtime-records', component:P009OvertimePage, props:{portal,mode:'employee'} },
  ]
  if (portal.code === 'center') return [
    { path:'/center/04/05/01', name:'p009-overtime-management', component:P009OvertimePage, props:{portal,mode:'center'} },
    { path:'/center/04/05/05', name:'p009-overtime-hr-review', component:P009OvertimePage, props:{portal,mode:'center'} },
    { path:'/center/04/05/06', name:'p009-overtime-payroll-basis', component:P009OvertimePage, props:{portal,mode:'center'} },
  ]
  if (portal.code === 'tech') return [
    { path:'/tech/07/09/01', name:'p009-overtime-monitor', component:P009OvertimePage, props:{portal,mode:'tech'} },
    { path:'/tech/07/11/01', name:'phase10-attendance-monitor', component:Phase10AttendanceMonitorPage, props:{portal} },
  ]
  return []
}

function phase10P010Routes(portal:PortalDefinition):RouteRecordRaw[]{
  if(portal.code==='employee')return[
    {path:'/employee/07/01/01',name:'p010-my-learning',component:P010LearningPage,props:{portal,mode:'employee'}},
    {path:'/employee/07/04/02',name:'p010-online-exam',component:P010LearningPage,props:{portal,mode:'employee'}},
    {path:'/employee/07/05/01',name:'p010-practical-task',component:P010LearningPage,props:{portal,mode:'employee'}},
    {path:'/employee/07/06/01',name:'p010-current-qualifications',component:P010LearningPage,props:{portal,mode:'employee'}},
  ]
  if(portal.code==='center')return[
    {path:'/center/06/03/07',name:'p010-learning-management',component:P010LearningPage,props:{portal,mode:'center'}},
    {path:'/center/10/08/03',name:'p010-practical-certification',component:P010LearningPage,props:{portal,mode:'center'}},
    {path:'/center/10/08/07',name:'p010-risk-permission-link',component:P010LearningPage,props:{portal,mode:'center'}},
  ]
  if(portal.code==='tech')return[{path:'/tech/03/03/09',name:'p010-role-action-audit',component:P010LearningPage,props:{portal,mode:'tech'}}]
  return[]
}

function phase11P011Routes(portal:PortalDefinition):RouteRecordRaw[]{
  if(portal.code==='employee')return[
    {path:'/employee/02/03/06',name:'p011-performance-cycle',component:P011PerformancePage,props:{portal,mode:'employee'}},
    {path:'/employee/08/03/06',name:'p011-performance-feedback',component:P011PerformancePage,props:{portal,mode:'employee'}},
  ]
  if(portal.code==='center')return[
    {path:'/center/10/02/01',name:'p011-self-evaluation',component:P011PerformancePage,props:{portal,mode:'center'}},
    {path:'/center/10/02/04',name:'p011-score-calculation',component:P011PerformancePage,props:{portal,mode:'center'}},
    {path:'/center/10/02/05',name:'p011-calibration',component:P011PerformancePage,props:{portal,mode:'center'}},
  ]
  if(portal.code==='tech')return[{path:'/tech/06/05/01',name:'p011-performance-rules',component:P011PerformancePage,props:{portal,mode:'tech'}}]
  return[]
}

function phase11P012Routes(portal:PortalDefinition):RouteRecordRaw[]{
  if(portal.code==='employee')return[
    {path:'/employee/03/03/05',name:'p012-promotion-application',component:P012PromotionPage,props:{portal,mode:'employee'}},
    {path:'/employee/08/09/03',name:'p012-appointment-confirmation',component:P012PromotionPage,props:{portal,mode:'employee'}},
  ]
  if(portal.code==='center')return[
    {path:'/center/03/08/05',name:'p012-promotion-review',component:P012PromotionPage,props:{portal,mode:'center'}},
    {path:'/center/03/08/06',name:'p012-promotion-appointment',component:P012PromotionPage,props:{portal,mode:'center'}},
  ]
  return[]
}

function phase11P013Routes(portal:PortalDefinition):RouteRecordRaw[]{
  if(portal.code==='employee')return[
    {path:'/employee/08/10/05',name:'p013-my-rewards',component:P013RewardPage,props:{portal,mode:'employee'}},
  ]
  if(portal.code==='center')return[
    {path:'/center/10/10/03',name:'p013-reward-review',component:P013RewardPage,props:{portal,mode:'center'}},
    {path:'/center/10/10/04',name:'p013-reward-execution',component:P013RewardPage,props:{portal,mode:'center'}},
  ]
  if(portal.code==='tech')return[
    {path:'/tech/06/06/01',name:'p013-reward-monitor',component:P013RewardPage,props:{portal,mode:'tech'}},
  ]
  return[]
}

function phase11P014Routes(portal:PortalDefinition):RouteRecordRaw[]{
  if(portal.code==='employee')return[{path:'/employee/02/03/09',name:'p014-my-discipline-case',component:P014DisciplinePage,props:{portal,mode:'employee'}}]
  if(portal.code==='center')return[
    {path:'/center/02/04/04',name:'p014-discipline-review',component:P014DisciplinePage,props:{portal,mode:'center'}},
    {path:'/center/06/03/09',name:'p014-discipline-supervision',component:P016CareSupportPage,props:{portal,mode:'center',sharedSupervision:true}},
  ]
  return[]
}

function phase11P015Routes(portal:PortalDefinition):RouteRecordRaw[]{
  if(portal.code==='employee')return[
    {path:'/employee/08/06/04',name:'p015-my-growth-points',component:P015PointLedgerPage,props:{portal,mode:'employee'}},
    {path:'/employee/08/06/06',name:'p015-my-honor-points',component:P015PointLedgerPage,props:{portal,mode:'employee'}},
  ]
  if(portal.code==='center')return[
    {path:'/center/10/09/01',name:'p015-point-source-management',component:P015PointLedgerPage,props:{portal,mode:'center'}},
    {path:'/center/10/09/06',name:'p015-point-adjustment-review',component:P015PointLedgerPage,props:{portal,mode:'center'}},
  ]
  if(portal.code==='tech')return[{path:'/tech/06/06/09',name:'p015-point-rule-monitor',component:P015PointLedgerPage,props:{portal,mode:'tech'}}]
  return[]
}

function phase11P016Routes(portal:PortalDefinition):RouteRecordRaw[]{
  if(portal.code==='employee')return[
    {path:'/employee/03/06/01',name:'p016-marriage-birth-care',component:P016CareSupportPage,props:{portal,mode:'employee'}},
    {path:'/employee/03/06/05',name:'p016-hardship-care',component:P016CareSupportPage,props:{portal,mode:'employee'}},
  ]
  if(portal.code==='center')return[
    {path:'/center/08/08/05',name:'p016-external-execution-receipt',component:P016CareSupportPage,props:{portal,mode:'center'}},
  ]
  return[]
}

export function createPhase10Routes(portal: PortalDefinition): RouteRecordRaw[] {
  return [
    ...phase10P006Routes(portal),
    ...phase10P007Routes(portal),
    ...phase10P008Routes(portal),
    ...phase10P009Routes(portal),
    ...phase10P010Routes(portal),
    ...phase11P011Routes(portal),
    ...phase11P012Routes(portal),
    ...phase11P013Routes(portal),
    ...phase11P014Routes(portal),
    ...phase11P015Routes(portal),
    ...phase11P016Routes(portal),
  ]
}
