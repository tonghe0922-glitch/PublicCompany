import rawSource from './generated/portal-ia-navigation.json'

export interface NavigationSourceEntry {
  portalCode: string; sourceKey: string; sourceFile: string | null; sourceSheet: string | null; level1: string; level2: string | null; label: string; routeName: string | null; routePath: string | null; permissionCodes: string[]; mobileAccess: string; status: string; sensitiveLevel: string | null; dataScope: string | null
}
const AUTHZ_NAVIGATION: readonly NavigationSourceEntry[] = [
  {portalCode:'tech',sourceKey:'authz-module-catalog',sourceFile:'ADR-006',sourceSheet:'技术端配置界面',level1:'权限与模块配置',level2:'模块目录',label:'模块目录',routeName:'authz-module-catalog',routePath:'/tech/authz/modules',permissionCodes:['authz.module.read'],mobileAccess:'full',status:'implemented',sensitiveLevel:'DATA-L1',dataScope:'TENANT'},
  {portalCode:'tech',sourceKey:'authz-config-preview',sourceFile:'ADR-006',sourceSheet:'技术端配置界面',level1:'权限与模块配置',level2:'配置预览',label:'配置预览',routeName:'authz-config-preview',routePath:'/tech/authz/preview',permissionCodes:['authz.config.preview'],mobileAccess:'limited',status:'implemented',sensitiveLevel:'DATA-L1',dataScope:'TENANT'},
]
export const PORTAL_IA_NAVIGATION: readonly NavigationSourceEntry[] = [...rawSource.entries, ...AUTHZ_NAVIGATION]
