import rawSource from './generated/portal-ia-navigation.json'

export interface NavigationSourceEntry {
  portalCode: string
  sourceKey: string
  sourceFile: string | null
  sourceSheet: string | null
  level1: string
  level2: string | null
  label: string
  routeName: string | null
  routePath: string | null
  permissionCodes: string[]
  permissionCodesAny?: string[]
  mobileAccess: string
  status: string
  sensitiveLevel: string | null
  dataScope: string | null
}

const PHASE09_IMPLEMENTED_NAVIGATION: readonly NavigationSourceEntry[] = [
  implemented('employee', 'p001-mfa', '账号安全 · MFA', '/employee/13/04/04', 'p001-mfa', []),
  implemented('employee', 'p001-sessions', '登录设备与会话', '/employee/13/04/06', 'p001-sessions', []),
  implemented('employee', 'p002-temporary', '临时权限申请', '/employee/03/07/04', 'p002-temporary-permission-request', ['p002.request.submit']),
  implemented('employee', 'p002-project', '项目权限申请', '/employee/03/07/05', 'p002-project-permission-request', ['p002.request.submit']),
  implemented('employee', 'p003-profile', '个人资料变更', '/employee/03/03/01', 'p003-profile-change', ['p003.change.submit']),
  implemented('employee', 'p004-request', '通用申请与审批', '/employee/03/07/01', 'p004-generic-request', ['p004.request.submit']),
  implemented('employee', 'p005-receipt', '制度通知与执行回执', '/employee/13/01/05', 'p005-notice-receipt', ['p005.notice.read']),

  implemented('center', 'phase09-inbox', 'P001–P004 审批与监督', '/center/02/01/01', 'phase09-center-inbox', ['p004.request.act']),
  implemented('center', 'p003-roster', '人员资料变更复核', '/center/03/02/01', 'p003-profile-roster', ['p003.change.review']),
  implemented('center', 'p005-publish', '制度通知发布与验收', '/center/13/01/05', 'p005-notice-publish', ['p005.notice.publish']),

  implemented('tech', 'p001-monitor', '会话安全监控', '/tech/03/01/01', 'p001-security-monitor', ['p001.session.monitor']),
  implemented('tech', 'p002-execution', '权限授权与回收', '/tech/03/01/04', 'p002-permission-execution', ['p002.request.execute']),
  implemented('tech', 'p003-apply', '资料权威更新', '/tech/04/01/01', 'p003-profile-sync-monitor', ['p003.change.apply']),
  implementedAny('tech', 'workflow-monitor', 'P004-P016 工作流监控', '/tech/05/03/01', 'p004-workflow-instance-monitor', [
    'p004.request.read', 'p005.notice.monitor', 'p006.meeting.monitor', 'p007.schedule.monitor',
    'p008.leave.monitor', 'p010.learning.monitor', 'p011.performance.monitor', 'p012.promotion.monitor',
    'p013.reward.monitor', 'p014.discipline.monitor', 'p016.welfare.monitor',
  ]),
]

const PHASE10_P006_IMPLEMENTED_NAVIGATION: readonly NavigationSourceEntry[] = [
  phase10P006('employee', '1-2员工全层级页面.xlsx:三级页面明细:R342:be2cc5d93d00', '会议详情与材料', '/employee/05/01/03', 'p006-meeting-detail', ['p006.meeting.read']),
  phase10P006('employee', '1-2员工全层级页面.xlsx:三级页面明细:R372:24468512bdea', '我的行动项', '/employee/05/07/02', 'p006-action-items', ['p006.meeting.action']),
  phase10P006('center', '2-2中心全层级页面.xlsx:三级页面明细:R379:23fac09d28f9', '会议议题、材料、签到、纪要与行动', '/center/06/09/03', 'p006-meeting-management', ['p006.meeting.manage']),
  phase10P006('center', '2-2中心全层级页面.xlsx:三级页面明细:R270:5be309bd5911', '会议行动台账', '/center/05/02/02', 'p006-action-ledger', ['p006.meeting.accept']),
]

const PHASE10_P007_IMPLEMENTED_NAVIGATION: readonly NavigationSourceEntry[] = [
  phase10('P007 排班与班次调整','employee','1-2员工全层级页面.xlsx:三级页面明细:R307:39c32c70588b','我的今日排班','/employee/04/01/01','p007-my-schedule',['p007.schedule.read']),
  phase10('P007 排班与班次调整','employee','1-2员工全层级页面.xlsx:三级页面明细:R272:317cfbb97c59','换班申请','/employee/03/01/09','p007-shift-change',['p007.schedule.change']),
  phase10('P007 排班与班次调整','employee','1-2员工全层级页面.xlsx:三级页面明细:R273:c55d4075f322','替班申请','/employee/03/01/10','p007-substitution',['p007.schedule.change']),
  phase10('P007 排班与班次调整','center','2-2中心全层级页面.xlsx:三级页面明细:R197:349f812a9873','排班计划与班次模板','/center/04/01/01','p007-schedule-plan',['p007.schedule.manage']),
  phase10('P007 排班与班次调整','center','2-2中心全层级页面.xlsx:三级页面明细:R243:3a115384ae52','换班/替班审批','/center/04/07/04','p007-shift-review',['p007.schedule.review']),
  phase10('P007 排班与班次调整','center','2-2中心全层级页面.xlsx:三级页面明细:R244:c582feaa0ea1','排班资格校验','/center/04/07/05','p007-qualification-check',['p007.schedule.manage']),
]

function phase10P006(portalCode:string,sourceKey:string,label:string,routePath:string,routeName:string,permissionCodes:string[]):NavigationSourceEntry {
  return { portalCode,sourceKey,sourceFile:'docs/implementation/phases/PHASE-10/PHASE10_PAGE_BINDINGS.json',sourceSheet:'三级页面明细',
    level1:'P006 会议与行动项',level2:null,label,routeName,routePath,permissionCodes,mobileAccess:'full',status:'implemented',
    sensitiveLevel:'P1-内部',dataScope:portalCode==='employee'?'SELF':'CENTER' }
}
function phase10(level1:string,portalCode:string,sourceKey:string,label:string,routePath:string,routeName:string,permissionCodes:string[]):NavigationSourceEntry {
  return { portalCode,sourceKey,sourceFile:'docs/implementation/phases/PHASE-10/PHASE10_PAGE_BINDINGS.json',sourceSheet:'三级页面明细',level1,level2:null,label,routeName,routePath,permissionCodes,mobileAccess:'full',status:'implemented',sensitiveLevel:'P1-内部',dataScope:portalCode==='employee'?'SELF':'CENTER' }
}

function implemented(
  portalCode: string,
  key: string,
  label: string,
  routePath: string,
  routeName: string,
  permissionCodes: string[],
): NavigationSourceEntry {
  return {
    portalCode,
    sourceKey: `phase09-runtime:${key}`,
    sourceFile: 'docs/implementation/phases/PHASE-09/PHASE_REPORT.md',
    sourceSheet: null,
    level1: 'P001–P005 已实现闭环',
    level2: null,
    label,
    routeName,
    routePath,
    permissionCodes,
    mobileAccess: 'full',
    status: 'implemented',
    sensitiveLevel: 'P1-内部',
    dataScope: portalCode === 'employee' ? 'SELF' : 'CENTER',
  }
}

function implementedAny(
  portalCode: string,
  key: string,
  label: string,
  routePath: string,
  routeName: string,
  permissionCodesAny: string[],
): NavigationSourceEntry {
  return { ...implemented(portalCode, key, label, routePath, routeName, []), permissionCodesAny }
}

export const PORTAL_IA_NAVIGATION: readonly NavigationSourceEntry[] = [
  ...PHASE09_IMPLEMENTED_NAVIGATION,
  ...PHASE10_P006_IMPLEMENTED_NAVIGATION,
  ...PHASE10_P007_IMPLEMENTED_NAVIGATION,
  ...rawSource.entries,
]
