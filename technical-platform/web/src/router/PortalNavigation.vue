<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import type { PortalCode } from '../platform/portal-config'
import { usePortalSessionStore } from '../session'
import NavigationIcon from './NavigationIcon.vue'
import {
  projectedItemIsActive,
  projectNavigationGroups,
  resolveActiveGroup,
  splitProjectedMobileNavigation,
  type NavigationRouteAccessRule,
  type ProjectedNavigationGroup,
  type ProjectedNavigationItem,
} from './navigation-projection'
import { PORTAL_IA_NAVIGATION } from './navigation-source'

const props = withDefaults(defineProps<{
  portalCode: PortalCode
  mobile?: boolean
  identityLabel?: string | null
}>(), {
  mobile: false,
  identityLabel: null,
})

const route = useRoute()
const router = useRouter()
const session = usePortalSessionStore()
const expandedKeys = ref<Set<string>>(new Set())

const routeRecords = computed(() => router.getRoutes())
const implementedPaths = computed(() => new Set(routeRecords.value.map((record) => record.path)))
const routeAccessRules = computed<ReadonlyMap<string, NavigationRouteAccessRule>>(() => {
  const rules = new Map<string, NavigationRouteAccessRule>()
  for (const record of routeRecords.value) {
    const all = typeof record.meta.permission === 'string' ? [record.meta.permission] : []
    const any = Array.isArray(record.meta.permissionsAny)
      ? record.meta.permissionsAny.filter((value): value is string => typeof value === 'string')
      : []
    if (all.length || any.length) rules.set(record.path, { all, any })
  }
  return rules
})
const permissions = computed(() => new Set(session.session?.permissions ?? []))
const identityLabel = computed(() => props.identityLabel ?? session.session?.identityName ?? null)
const groups = computed(() => projectNavigationGroups(PORTAL_IA_NAVIGATION, {
  portalCode: props.portalCode,
  permissions: permissions.value,
  implementedRoutePaths: implementedPaths.value,
  routeAccessRules: routeAccessRules.value,
  mobile: props.mobile,
  identityLabel: identityLabel.value,
}))
const mobileGroups = computed(() => splitProjectedMobileNavigation(groups.value))
const currentModule = computed(() => route.query.module)
const activeGroup = computed(() => resolveActiveGroup(groups.value, route.path, currentModule.value))

function storageKey(): string {
  return `sgj:navigation:expanded:${props.portalCode}`
}

function restoreExpanded(): void {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(storageKey())
    const saved = raw ? JSON.parse(raw) : []
    if (Array.isArray(saved)) expandedKeys.value = new Set(saved.filter((value): value is string => typeof value === 'string'))
  } catch {
    expandedKeys.value = new Set()
  }
}

function persistExpanded(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify([...expandedKeys.value]))
  } catch {
    // Navigation remains usable when storage is unavailable or full.
  }
}

function ensureActiveExpanded(): void {
  if (!activeGroup.value || activeGroup.value.items.length < 2) return
  if (expandedKeys.value.has(activeGroup.value.key)) return
  expandedKeys.value = new Set([...expandedKeys.value, activeGroup.value.key])
  persistExpanded()
}

function isExpanded(group: ProjectedNavigationGroup): boolean {
  return expandedKeys.value.has(group.key)
}

function toggleGroup(group: ProjectedNavigationGroup): void {
  const next = new Set(expandedKeys.value)
  if (next.has(group.key)) next.delete(group.key)
  else next.add(group.key)
  expandedKeys.value = next
  persistExpanded()
}

async function activateGroup(group: ProjectedNavigationGroup): Promise<void> {
  const isActive = activeGroup.value?.key === group.key
  if (isActive) {
    toggleGroup(group)
    return
  }
  const firstImplemented = group.items.find((item) => item.state === 'implemented')
  const target = firstImplemented ?? group.items[0]
  if (!target) return
  if (!isExpanded(group)) toggleGroup(group)
  await router.push(target.routePath)
}

function isItemActive(item: ProjectedNavigationItem): boolean {
  return projectedItemIsActive(route.path, currentModule.value, item)
}

function isGroupActive(group: ProjectedNavigationGroup): boolean {
  return activeGroup.value?.key === group.key
}

function directItem(group: ProjectedNavigationGroup): ProjectedNavigationItem | undefined {
  return group.items.length === 1 && group.items[0]?.key === group.key ? group.items[0] : undefined
}

function directItemIsActive(group: ProjectedNavigationGroup): boolean {
  const item = directItem(group)
  return item ? isItemActive(item) : false
}

function directItemState(group: ProjectedNavigationGroup): ProjectedNavigationItem['state'] {
  return directItem(group)?.state ?? 'developing'
}

function targetFor(group: ProjectedNavigationGroup): string {
  return (group.items.find((item) => item.state === 'implemented') ?? group.items[0])?.routePath ?? '/'
}

function stateLabel(state: ProjectedNavigationItem['state']): string {
  if (state === 'developing') return '开发中'
  if (state === 'unauthorized') return '无权限'
  return ''
}

onMounted(() => {
  restoreExpanded()
  ensureActiveExpanded()
})
watch(() => route.fullPath, ensureActiveExpanded)
watch(groups, ensureActiveExpanded)
</script>

<template>
  <nav class="portal-navigation" :class="{ 'portal-navigation--mobile': props.mobile }" :aria-label="props.mobile ? '移动端快捷导航' : '三端公共业务导航'">
    <template v-if="!props.mobile">
      <ul class="portal-navigation__groups">
        <li v-for="group in groups" :key="group.key" class="portal-navigation__group" :class="{ 'is-active': isGroupActive(group) }">
          <RouterLink
            v-if="directItem(group)"
            class="portal-navigation__group-link"
            :class="`is-${directItemState(group)}`"
            :to="directItem(group)?.routePath ?? '/'"
            :aria-current="directItemIsActive(group) ? 'page' : undefined"
            :title="group.label"
          >
            <span class="portal-navigation__main">
              <NavigationIcon class="portal-navigation__icon" :icon="group.iconKey" />
              <span class="portal-navigation__label">{{ group.label }}</span>
            </span>
            <span v-if="directItemState(group) !== 'implemented'" class="portal-navigation__state" :class="`is-${directItemState(group)}`">
              {{ stateLabel(directItemState(group)) }}
            </span>
          </RouterLink>

          <template v-else>
            <button
              class="portal-navigation__group-button"
              type="button"
              :class="{ 'is-active': isGroupActive(group), 'is-open': isExpanded(group) }"
              :aria-expanded="isExpanded(group).toString()"
              :aria-controls="`portal-nav-${props.portalCode}-${group.key}`"
              :title="group.label"
              @click="activateGroup(group)"
            >
              <span class="portal-navigation__main">
                <NavigationIcon class="portal-navigation__icon" :icon="group.iconKey" />
                <span class="portal-navigation__label">
                  <span>{{ group.label }}</span>
                  <small v-if="group.centerScoped && group.contextLabel">{{ group.contextLabel }}</small>
                </span>
              </span>
              <span class="portal-navigation__group-tail">
                <span v-if="group.state === 'developing'" class="portal-navigation__dot" title="该分组尚无已接通页面" />
                <svg class="portal-navigation__chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
              </span>
            </button>

            <ul v-show="isExpanded(group)" :id="`portal-nav-${props.portalCode}-${group.key}`" class="portal-navigation__submenu">
              <li v-for="item in group.items" :key="item.key">
                <RouterLink
                  :to="item.routePath"
                  :class="[`is-${item.state}`, { 'is-active': isItemActive(item) }]"
                  :aria-current="isItemActive(item) ? 'page' : undefined"
                  :aria-label="`${item.label}${item.state === 'developing' ? '，正在开发中' : item.state === 'unauthorized' ? '，当前账号无权限' : ''}`"
                >
                  <span class="portal-navigation__sub-bullet" aria-hidden="true" />
                  <span class="portal-navigation__sub-label">{{ item.label }}</span>
                  <span v-if="item.state !== 'implemented'" class="portal-navigation__state" :class="`is-${item.state}`">{{ stateLabel(item.state) }}</span>
                </RouterLink>
              </li>
            </ul>
          </template>
        </li>
      </ul>
      <div class="portal-navigation__legend">
        <span><i class="is-ready" />已接通</span>
        <span><i class="is-developing" />开发中</span>
        <span><i class="is-locked" />权限受控</span>
      </div>
    </template>

    <template v-else>
      <ul class="portal-navigation__mobile-list">
        <li v-for="group in mobileGroups.primary" :key="group.key">
          <RouterLink :to="targetFor(group)" :aria-current="isGroupActive(group) ? 'page' : undefined">
            <NavigationIcon class="portal-navigation__icon" :icon="group.iconKey" />
            <span>{{ group.label.replace('我的', '') }}</span>
          </RouterLink>
        </li>
        <li v-if="mobileGroups.overflow.length" class="portal-navigation__more">
          <details>
            <summary :aria-current="mobileGroups.overflow.some(isGroupActive) ? 'page' : undefined">
              <svg class="portal-navigation__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
              <span>更多</span>
            </summary>
            <ul class="portal-navigation__more-menu">
              <li v-for="group in mobileGroups.overflow" :key="group.key">
                <RouterLink :to="targetFor(group)" :aria-current="isGroupActive(group) ? 'page' : undefined">
                  <NavigationIcon class="portal-navigation__icon" :icon="group.iconKey" />
                  <span>{{ group.label }}</span>
                  <small v-if="group.state === 'developing'">开发中</small>
                </RouterLink>
              </li>
            </ul>
          </details>
        </li>
      </ul>
    </template>
  </nav>
</template>

<style scoped>
.portal-navigation, .portal-navigation :where(ul) { margin: 0; padding: 0; }
.portal-navigation :where(ul) { list-style: none; }
.portal-navigation__groups { display: grid; gap: 4px; }
.portal-navigation__group { min-width: 0; }
.portal-navigation__group-link, .portal-navigation__group-button {
  width: 100%; min-height: 46px; display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 8px 11px; border: 1px solid transparent; border-radius: var(--sgj-radius-lg); color: var(--sgj-text-secondary);
  background: transparent; font: inherit; font-size: 15px; font-weight: 620; text-align: left; text-decoration: none; cursor: pointer;
  transition: color .16s ease, background-color .16s ease, border-color .16s ease, transform .16s ease;
}
.portal-navigation__group-link:hover, .portal-navigation__group-button:hover { color: var(--sgj-brand-700); border-color: var(--sgj-brand-100); background: var(--sgj-brand-50); }
.portal-navigation__group-link[aria-current="page"], .portal-navigation__group-button.is-active {
  color: #fff; border-color: var(--sgj-brand-600); background: linear-gradient(135deg, var(--sgj-brand-500), var(--sgj-brand-600)); box-shadow: var(--sgj-shadow-accent);
}
.portal-navigation__main { min-width: 0; display: inline-flex; align-items: center; gap: 11px; }
.portal-navigation__icon { width: 20px; height: 20px; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.portal-navigation__label { min-width: 0; display: grid; gap: 1px; }
.portal-navigation__label > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.portal-navigation__label small { overflow: hidden; color: currentColor; opacity: .7; font-size: 10px; font-weight: 520; text-overflow: ellipsis; white-space: nowrap; }
.portal-navigation__group-tail { display: inline-flex; align-items: center; gap: 6px; }
.portal-navigation__chevron { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; transition: transform .18s ease; }
.portal-navigation__group-button.is-open .portal-navigation__chevron { transform: rotate(90deg); }
.portal-navigation__dot { width: 7px; height: 7px; border-radius: 50%; background: var(--sgj-warning); box-shadow: 0 0 0 3px var(--sgj-warning-bg); }
.portal-navigation__submenu { display: grid; gap: 2px; padding: 4px 3px 6px 40px !important; }
.portal-navigation__submenu a { min-height: 38px; display: flex; align-items: center; gap: 8px; padding: 6px 9px; border-radius: var(--sgj-radius-md); color: var(--sgj-text-tertiary); font-size: 13px; text-decoration: none; }
.portal-navigation__submenu a:hover { color: var(--sgj-brand-700); background: var(--sgj-brand-50); }
.portal-navigation__submenu a.is-active { color: var(--sgj-brand-700); background: var(--sgj-brand-50); font-weight: 700; }
.portal-navigation__sub-bullet { width: 5px; height: 5px; flex: 0 0 auto; border-radius: 50%; background: currentColor; opacity: .45; }
.portal-navigation__sub-label { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.portal-navigation__state { flex: 0 0 auto; padding: 2px 6px; border-radius: var(--sgj-radius-pill); font-size: 9px; font-weight: 750; }
.portal-navigation__state.is-developing { color: var(--sgj-warning); background: var(--sgj-warning-bg); }
.portal-navigation__state.is-unauthorized { color: var(--sgj-text-tertiary); background: rgba(15,23,42,.06); }
.portal-navigation__group-link[aria-current="page"] .portal-navigation__state { color: #fff; background: rgba(255,255,255,.18); }
.portal-navigation__legend { display: flex; gap: 10px; flex-wrap: wrap; margin: 12px 5px 0; padding: 10px 8px 0; border-top: 1px solid var(--sgj-border); color: var(--sgj-text-tertiary); font-size: 10px; }
.portal-navigation__legend span { display: inline-flex; align-items: center; gap: 5px; }
.portal-navigation__legend i { width: 6px; height: 6px; border-radius: 50%; }
.portal-navigation__legend .is-ready { background: #10b981; }.portal-navigation__legend .is-developing { background: var(--sgj-warning); }.portal-navigation__legend .is-locked { background: #94a3b8; }
.portal-navigation--mobile { height: 100%; }
.portal-navigation__mobile-list { height: 100%; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(68px, 1fr); align-items: stretch; }
.portal-navigation__mobile-list > li > a, .portal-navigation__more summary { height: 100%; min-height: 58px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; padding: 5px; border-radius: var(--sgj-radius-md); color: var(--sgj-text-tertiary); font-size: 10px; text-decoration: none; cursor: pointer; list-style: none; }
.portal-navigation__mobile-list a[aria-current="page"], .portal-navigation__more summary[aria-current="page"] { color: var(--sgj-brand-600); background: var(--sgj-brand-50); font-weight: 700; }
.portal-navigation__more { position: relative; }.portal-navigation__more summary::-webkit-details-marker { display: none; }
.portal-navigation__more-menu { position: absolute; right: 0; bottom: calc(100% + 8px); z-index: 90; min-width: min(320px, 92vw); max-height: 62vh; overflow: auto; display: grid; gap: 3px; padding: 8px !important; border: 1px solid var(--sgj-border); border-radius: var(--sgj-radius-lg); background: #fff; box-shadow: var(--sgj-shadow-lg); }
.portal-navigation__more-menu a { min-height: 44px; display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--sgj-radius-md); color: var(--sgj-text-secondary); font-size: 13px; text-decoration: none; }
.portal-navigation__more-menu a:hover { background: var(--sgj-brand-50); color: var(--sgj-brand-700); }.portal-navigation__more-menu small { margin-left: auto; color: var(--sgj-warning); }
@media (min-width: 960px) {
  :global(.rebuild-shell--sidebar-collapsed) { grid-template-columns: 76px minmax(0,1fr) !important; }
  :global(.rebuild-shell--sidebar-collapsed .rebuild-shell__sidebar) { margin-left: 8px !important; padding: 8px !important; opacity: 1 !important; transform: none !important; pointer-events: auto !important; }
  :global(.rebuild-shell--sidebar-collapsed .rebuild-shell__sidebar-heading), :global(.rebuild-shell--sidebar-collapsed .rebuild-shell__sidebar-foot),
  :global(.rebuild-shell--sidebar-collapsed) .portal-navigation__label, :global(.rebuild-shell--sidebar-collapsed) .portal-navigation__state,
  :global(.rebuild-shell--sidebar-collapsed) .portal-navigation__group-tail, :global(.rebuild-shell--sidebar-collapsed) .portal-navigation__submenu,
  :global(.rebuild-shell--sidebar-collapsed) .portal-navigation__legend { display: none !important; }
  :global(.rebuild-shell--sidebar-collapsed) .portal-navigation__group-link, :global(.rebuild-shell--sidebar-collapsed) .portal-navigation__group-button { justify-content: center; padding-inline: 0; }
  :global(.rebuild-shell--sidebar-collapsed) .portal-navigation__main { gap: 0; }
}
@media (prefers-reduced-motion: reduce) { .portal-navigation *, .portal-navigation *::before, .portal-navigation *::after { transition-duration: .01ms !important; animation-duration: .01ms !important; } }
</style>
