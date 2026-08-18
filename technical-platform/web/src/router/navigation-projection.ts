import type { PortalCode } from '../platform/portal-config'
import { NAVIGATION_CATALOG, type NavigationCatalogChild, type NavigationCatalogSection, type NavigationIconKey } from './navigation-catalog'
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

export type ProjectedNavigationState = 'implemented' | 'developing' | 'unauthorized'

export interface NavigationRouteAccessRule {
  readonly all?: readonly string[]
  readonly any?: readonly string[]
}

export interface ProjectedNavigationItem {
  readonly key: string
  readonly label: string
  readonly groupKey: string
  readonly groupLabel: string
  readonly routePath: string
  readonly sourceRoutePath: string | null
  readonly sourceKey: string | null
  readonly routeName: string | null
  readonly state: ProjectedNavigationState
  readonly limited: boolean
  readonly permissionCodes: readonly string[]
  readonly dataScope: string | null
}

export interface ProjectedNavigationGroup {
  readonly key: string
  readonly label: string
  readonly iconKey: NavigationIconKey
  readonly items: readonly ProjectedNavigationItem[]
  readonly state: ProjectedNavigationState
  readonly mobileAccess: 'primary' | 'more'
  readonly centerScoped: boolean
  readonly contextLabel: string | null
}

export interface FullNavigationProjectionOptions extends NavigationProjectionOptions {
  readonly routeAccessRules?: ReadonlyMap<string, NavigationRouteAccessRule>
  readonly identityLabel?: string | null
  readonly catalog?: readonly NavigationCatalogSection[]
}

export interface ProjectedMobileNavigationGroups {
  readonly primary: readonly ProjectedNavigationGroup[]
  readonly overflow: readonly ProjectedNavigationGroup[]
}

function permissionsSatisfied(required: readonly string[], granted: ReadonlySet<string>): boolean {
  return required.every((permission) => granted.has(permission))
}

function routeAccessSatisfied(
  rule: NavigationRouteAccessRule | undefined,
  fallback: readonly string[],
  granted: ReadonlySet<string>,
): boolean {
  if (rule?.all?.length && !rule.all.every((permission) => granted.has(permission))) return false
  if (rule?.any?.length && !rule.any.some((permission) => granted.has(permission))) return false
  if (rule?.all?.length || rule?.any?.length) return true
  return permissionsSatisfied(fallback, granted)
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
  return { primary: items.slice(0, limit), overflow: items.slice(limit) }
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

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s·/\\_—–（）()【】\[\]：:，,。.\-]/g, '')
}

function terms(label: string, aliases: readonly string[] | undefined): readonly string[] {
  return [label, ...(aliases ?? [])].map(normalize).filter(Boolean)
}

function scoreTerm(value: string, candidates: readonly string[]): number {
  if (!value) return 0
  let score = 0
  for (const candidate of candidates) {
    if (value === candidate) score = Math.max(score, 100)
    else if (value.includes(candidate) || candidate.includes(value)) score = Math.max(score, 55)
  }
  return score
}

function scoreEntry(
  entry: NavigationSourceEntry,
  section: NavigationCatalogSection,
  child?: NavigationCatalogChild,
): number {
  const sectionTerms = terms(section.label, section.aliases)
  const childTerms = child ? terms(child.label, child.aliases) : sectionTerms
  const level1 = normalize(entry.level1)
  const level2 = normalize(entry.level2)
  const label = normalize(entry.label)
  const routeName = normalize(entry.routeName)
  const sourceKey = normalize(entry.sourceKey)
  const sectionScore = scoreTerm(level1, sectionTerms)
  const childScore = scoreTerm(level2, childTerms) * 2
    + scoreTerm(label, childTerms) * 3
    + scoreTerm(routeName, childTerms)
    + scoreTerm(sourceKey, childTerms)
  if (child && childScore === 0) return 0
  return sectionScore + childScore + (child && sectionScore > 0 ? 40 : 0)
}

function bestSourceEntry(
  entries: readonly NavigationSourceEntry[],
  section: NavigationCatalogSection,
  child?: NavigationCatalogChild,
): NavigationSourceEntry | undefined {
  return entries
    .map((entry) => ({ entry, score: scoreEntry(entry, section, child) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      const leftReady = left.entry.status === 'implemented' && left.entry.routePath ? 1 : 0
      const rightReady = right.entry.status === 'implemented' && right.entry.routePath ? 1 : 0
      return rightReady - leftReady || right.score - left.score
    })[0]?.entry
}

function genericTarget(
  state: Exclude<ProjectedNavigationState, 'implemented'>,
  key: string,
  label: string,
  groupLabel: string,
): string {
  const path = state === 'unauthorized' ? '/forbidden' : '/developing'
  const query = new URLSearchParams({ module: key, label, group: groupLabel })
  return `${path}?${query.toString()}`
}

function projectLeaf(
  section: NavigationCatalogSection,
  child: NavigationCatalogChild | undefined,
  sourceEntries: readonly NavigationSourceEntry[],
  options: FullNavigationProjectionOptions,
): ProjectedNavigationItem {
  const key = child?.key ?? section.key
  const label = child?.label ?? section.label
  if (section.key === 'home' && options.implementedRoutePaths.has('/')) {
    return {
      key, label, groupKey: section.key, groupLabel: section.label, routePath: '/', sourceRoutePath: '/',
      sourceKey: 'portal-home', routeName: 'portal-home', state: 'implemented', limited: false,
      permissionCodes: [], dataScope: null,
    }
  }

  const source = bestSourceEntry(sourceEntries, section, child)
  const hasRealRoute = source?.status === 'implemented'
    && typeof source.routePath === 'string'
    && options.implementedRoutePaths.has(source.routePath)
  if (!hasRealRoute || !source?.routePath) {
    return {
      key, label, groupKey: section.key, groupLabel: section.label,
      routePath: genericTarget('developing', key, label, section.label), sourceRoutePath: null,
      sourceKey: source?.sourceKey ?? null, routeName: source?.routeName ?? null, state: 'developing',
      limited: options.mobile && source?.mobileAccess === 'limited', permissionCodes: source?.permissionCodes ?? [],
      dataScope: source?.dataScope ?? null,
    }
  }

  const allowed = routeAccessSatisfied(
    options.routeAccessRules?.get(source.routePath),
    source.permissionCodes,
    options.permissions,
  )
  return {
    key, label, groupKey: section.key, groupLabel: section.label,
    routePath: allowed ? source.routePath : genericTarget('unauthorized', key, label, section.label),
    sourceRoutePath: source.routePath, sourceKey: source.sourceKey, routeName: source.routeName,
    state: allowed ? 'implemented' : 'unauthorized',
    limited: options.mobile && source.mobileAccess === 'limited',
    permissionCodes: source.permissionCodes, dataScope: source.dataScope,
  }
}

function groupState(items: readonly ProjectedNavigationItem[]): ProjectedNavigationState {
  if (items.some((item) => item.state === 'implemented')) return 'implemented'
  if (items.some((item) => item.state === 'unauthorized')) return 'unauthorized'
  return 'developing'
}

export function projectNavigationGroups(
  entries: readonly NavigationSourceEntry[],
  options: FullNavigationProjectionOptions,
): ProjectedNavigationGroup[] {
  const portalEntries = entries.filter((entry) => entry.portalCode === options.portalCode)
  return (options.catalog ?? NAVIGATION_CATALOG).map((section) => {
    const items = section.children?.length
      ? section.children.map((child) => projectLeaf(section, child, portalEntries, options))
      : [projectLeaf(section, undefined, portalEntries, options)]
    return {
      key: section.key,
      label: section.label,
      iconKey: section.iconKey,
      items,
      state: groupState(items),
      mobileAccess: section.mobileAccess,
      centerScoped: Boolean(section.centerScoped),
      contextLabel: section.centerScoped ? options.identityLabel?.trim() || null : null,
    }
  })
}

export function flattenProjectedNavigation(
  groups: readonly ProjectedNavigationGroup[],
): ProjectedNavigationItem[] {
  return groups.flatMap((group) => group.items)
}

export function pathMatchesNavigationItem(currentPath: string, routePath: string): boolean {
  if (routePath === '/') return currentPath === '/'
  return currentPath === routePath || currentPath.startsWith(`${routePath}/`)
}

export function projectedItemIsActive(
  currentPath: string,
  currentModule: unknown,
  item: ProjectedNavigationItem,
): boolean {
  if (item.state === 'implemented' && item.sourceRoutePath) {
    return pathMatchesNavigationItem(currentPath, item.sourceRoutePath)
  }
  return (currentPath === '/developing' || currentPath === '/forbidden') && currentModule === item.key
}

export function resolveActiveItem(
  groups: readonly ProjectedNavigationGroup[],
  currentPath: string,
  currentModule?: unknown,
): ProjectedNavigationItem | undefined {
  return flattenProjectedNavigation(groups)
    .filter((item) => projectedItemIsActive(currentPath, currentModule, item))
    .sort((left, right) => (right.sourceRoutePath?.length ?? 0) - (left.sourceRoutePath?.length ?? 0))[0]
}

export function resolveActiveGroup(
  groups: readonly ProjectedNavigationGroup[],
  currentPath: string,
  currentModule?: unknown,
): ProjectedNavigationGroup | undefined {
  const active = resolveActiveItem(groups, currentPath, currentModule)
  return active ? groups.find((group) => group.key === active.groupKey) : undefined
}

export function splitProjectedMobileNavigation(
  groups: readonly ProjectedNavigationGroup[],
  primaryLimit = 4,
): ProjectedMobileNavigationGroups {
  const preferred = groups.filter((group) => group.mobileAccess === 'primary')
  const primary = preferred.slice(0, Math.max(0, Math.trunc(primaryLimit)))
  const primaryKeys = new Set(primary.map((group) => group.key))
  return { primary, overflow: groups.filter((group) => !primaryKeys.has(group.key)) }
}
