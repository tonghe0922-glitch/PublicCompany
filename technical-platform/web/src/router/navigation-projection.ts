import type { PortalCode } from '../platform/portal-config'
import type { NavigationSourceEntry } from './navigation-source'

export interface ActiveNavigationItem {
  sourceKey: string
  label: string
  routeName: string | null
  routePath: string
  limited: boolean
}

export interface TaxonomyItem {
  label: string
  sourceCount: number
}

export interface NavigationProjectionOptions {
  portalCode: PortalCode
  permissions: ReadonlySet<string>
  implementedRoutePaths: ReadonlySet<string>
  mobile: boolean
}

export interface MobileNavigationGroups {
  primary: readonly ActiveNavigationItem[]
  overflow: readonly ActiveNavigationItem[]
}

function permissionsSatisfied(required: readonly string[], granted: ReadonlySet<string>): boolean {
  return required.every((permission) => granted.has(permission))
}

function anyPermissionSatisfied(required: readonly string[] | undefined, granted: ReadonlySet<string>): boolean {
  return required === undefined || required.length === 0 || required.some((permission) => granted.has(permission))
}

function availableOnDevice(entry: NavigationSourceEntry, mobile: boolean): boolean {
  return !mobile || entry.mobileAccess !== 'no'
}

function isActiveEntry(
  entry: NavigationSourceEntry,
  options: NavigationProjectionOptions,
): entry is NavigationSourceEntry & { routePath: string } {
  return entry.portalCode === options.portalCode
    && entry.status === 'implemented'
    && typeof entry.routePath === 'string'
    && entry.routePath.startsWith('/')
    && options.implementedRoutePaths.has(entry.routePath)
    && availableOnDevice(entry, options.mobile)
    && permissionsSatisfied(entry.permissionCodes, options.permissions)
    && anyPermissionSatisfied(entry.permissionCodesAny, options.permissions)
}

export function projectActiveNavigation(
  entries: readonly NavigationSourceEntry[],
  options: NavigationProjectionOptions,
): ActiveNavigationItem[] {
  return entries
    .filter((entry) => isActiveEntry(entry, options))
    .map((entry) => ({
      sourceKey: entry.sourceKey,
      label: entry.label,
      routeName: entry.routeName,
      routePath: entry.routePath,
      limited: options.mobile && entry.mobileAccess === 'limited',
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'))
}

export function splitMobileNavigation(
  items: readonly ActiveNavigationItem[],
  primaryLimit = 3,
): MobileNavigationGroups {
  const limit = Math.max(0, Math.trunc(primaryLimit))
  return {
    primary: items.slice(0, limit),
    overflow: items.slice(limit),
  }
}

export function projectPortalTaxonomy(
  entries: readonly NavigationSourceEntry[],
  portalCode: PortalCode,
): TaxonomyItem[] {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    if (entry.portalCode !== portalCode) continue
    counts.set(entry.level1, (counts.get(entry.level1) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([label, sourceCount]) => ({ label, sourceCount }))
    .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'))
}
