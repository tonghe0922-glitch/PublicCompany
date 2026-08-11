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
  mobileAccess: string
  status: string
  sensitiveLevel: string | null
  dataScope: string | null
}

export const PORTAL_IA_NAVIGATION: readonly NavigationSourceEntry[] = rawSource.entries
