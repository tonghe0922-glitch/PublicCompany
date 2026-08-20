export type BusinessPortalCode = 'employee' | 'center' | 'tech'
/** @deprecated 业务分类标签兼容别名；运行时仅使用 work / tech。 */
export type PortalCode = BusinessPortalCode
export type RuntimePortalCode = 'work' | 'tech'

export const RUNTIME_OF = { employee: 'work', center: 'work', tech: 'tech' } as const satisfies Readonly<Record<BusinessPortalCode, RuntimePortalCode>>
export const BUILD_ALIAS = { work: 'work', tech: 'admin' } as const
export const PORTAL_RUNTIME_ALIASES = RUNTIME_OF

export interface PortalDefinition { code: RuntimePortalCode; buildAlias: 'work' | 'admin'; title: string; description: string; homeTitle: string; homeFocus: readonly string[] }

const WORK: PortalDefinition = {
  code: 'work', buildAlias: 'work', title: '工作端',
  description: '统一承载本人业务与中心管理业务；页面、动作与数据范围完全由当前身份、岗位、组织和服务端权限投影。',
  homeTitle: '我的工作台',
  homeFocus: ['本人发起、执行、确认与管理受理、审核、分派、复核、验收在同一工作端完成。','一人多岗通过站内身份切换重新获取权限和数据范围，不叠加旧身份授权。','未完成模块保留导航入口并明确显示正在开发中，不伪造业务数据。'],
}
const TECH: PortalDefinition = {
  code: 'tech', buildAlias: 'admin', title: '技术端',
  description: '技术配置、权限分配、流程参数、运行监控、重试补偿和审计入口；不代表业务超级管理员。',
  homeTitle: '技术运行工作入口',
  homeFocus: ['模块、权限、流程、表单、规则与参数配置由本端按授权维护。','服务健康、Worker、外部集成、审计与故障处置按技术权限开放。','技术端不替代业务审批，不直接把业务状态修改为完成。'],
}
export const PORTALS = { work: WORK, tech: TECH } as const satisfies Readonly<Record<RuntimePortalCode, PortalDefinition>>
