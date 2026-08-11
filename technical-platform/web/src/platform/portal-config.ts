export type PortalCode = 'employee' | 'center' | 'tech'
export type RuntimePortalCode = 'employee' | 'center' | 'admin'

export const PORTAL_RUNTIME_ALIASES = {
  employee: 'employee',
  center: 'center',
  tech: 'admin',
} as const satisfies Readonly<Record<PortalCode, RuntimePortalCode>>

export interface PortalDefinition {
  code: PortalCode
  runtimeCode: RuntimePortalCode
  title: string
  description: string
  homeTitle: string
  homeFocus: readonly string[]
}

export const PORTALS: Readonly<Record<PortalCode, PortalDefinition>> = {
  employee: {
    code: 'employee',
    runtimeCode: PORTAL_RUNTIME_ALIASES.employee,
    title: '员工端',
    description: '员工发起、查看和确认本人授权范围内的共享流程；高风险动作仍由服务端审批、二次认证和审计控制。',
    homeTitle: '员工工作入口',
    homeFocus: [
      '本人发起、本人进度与本人授权范围内的业务入口按对应业务阶段逐步开放。',
      '待办、到期、逾期、排班与提醒只有在真实服务端 read model 可用时才展示。',
      '通知、会议、学习、成长与福利摘要按来源化页面和权限逐步接入。',
    ],
  },
  center: {
    code: 'center',
    runtimeCode: PORTAL_RUNTIME_ALIASES.center,
    title: '中心管理端',
    description: '中心管理人员按授权范围处理审批、复核、差异确认与归档，不获得跨中心默认权限。',
    homeTitle: '中心管理工作入口',
    homeFocus: [
      '受理、审核、分派与验收入口按对应业务阶段和中心授权逐步开放。',
      '超时、高风险、跨中心依赖与人员资源异常只展示服务端真实队列和事实。',
      '批量动作必须由具体业务页面提供预览、校验、权限与审计后才允许执行。',
    ],
  },
  tech: {
    code: 'tech',
    runtimeCode: PORTAL_RUNTIME_ALIASES.tech,
    title: '技术后台端',
    description: '技术配置、异步执行、故障与审计入口，不代表业务超级管理员；业务权限与数据范围仍由服务端判定。',
    homeTitle: '技术运行工作入口',
    homeFocus: [
      '服务健康、Worker、外部集成与故障处置入口按来源化技术页面逐步开放。',
      '配置、发布、重试、补偿与审计只暴露明确授权的技术动作。',
      '技术端不替代业务审批，不直接把业务状态修改为完成。',
    ],
  },
}
