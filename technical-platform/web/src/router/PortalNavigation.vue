<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import type { PortalCode } from '../platform/portal-config'
import { usePortalSessionStore } from '../session'
import { PORTAL_IA_NAVIGATION } from './navigation-source'
import { projectActiveNavigation, projectPortalTaxonomy, splitMobileNavigation } from './navigation-projection'

const props = withDefaults(defineProps<{
  portalCode: PortalCode
  mobile?: boolean
}>(), {
  mobile: false,
})

const route = useRoute()
const router = useRouter()
const session = usePortalSessionStore()

const implementedPaths = computed(() => new Set(router.getRoutes().map((record) => record.path)))
const permissions = computed(() => new Set(session.session?.permissions ?? []))
const activeItems = computed(() => projectActiveNavigation(PORTAL_IA_NAVIGATION, {
  portalCode: props.portalCode,
  permissions: permissions.value,
  implementedRoutePaths: implementedPaths.value,
  mobile: props.mobile,
}))
const mobileGroups = computed(() => splitMobileNavigation(activeItems.value))
const visibleItems = computed(() => props.mobile ? mobileGroups.value.primary : activeItems.value)
const overflowItems = computed(() => props.mobile ? mobileGroups.value.overflow : [])
const overflowIsCurrent = computed(() => overflowItems.value.some((item) => item.routePath === route.path))
const taxonomy = computed(() => projectPortalTaxonomy(PORTAL_IA_NAVIGATION, props.portalCode))
</script>

<template>
  <nav class="portal-navigation" :class="{ 'portal-navigation--mobile': mobile }" aria-label="业务导航">
    <ul class="portal-navigation__links">
      <li>
        <RouterLink to="/" :aria-current="route.path === '/' ? 'page' : undefined">首页</RouterLink>
      </li>
      <li v-for="item in visibleItems" :key="item.sourceKey">
        <RouterLink :to="item.routePath" :aria-current="route.path === item.routePath ? 'page' : undefined">
          {{ item.label }}
          <span v-if="item.limited" class="portal-navigation__limited">移动端受限</span>
        </RouterLink>
      </li>
      <li v-if="mobile && overflowItems.length" class="portal-navigation__more">
        <details>
          <summary :aria-current="overflowIsCurrent ? 'page' : undefined">更多</summary>
          <ul class="portal-navigation__more-menu" aria-label="更多已实现页面">
            <li v-for="item in overflowItems" :key="item.sourceKey">
              <RouterLink :to="item.routePath" :aria-current="route.path === item.routePath ? 'page' : undefined">
                {{ item.label }}
                <span v-if="item.limited" class="portal-navigation__limited">移动端受限</span>
              </RouterLink>
            </li>
          </ul>
        </details>
      </li>
    </ul>

    <section v-if="!mobile" class="portal-navigation__taxonomy" aria-label="页面来源分类">
      <p class="portal-navigation__caption">来源分类 · 业务页按所属阶段逐步激活</p>
      <ul>
        <li v-for="group in taxonomy" :key="group.label">
          <span aria-disabled="true">{{ group.label }}</span>
        </li>
      </ul>
    </section>
  </nav>
</template>

<style scoped>
.portal-navigation { display: grid; gap: var(--sgj-space-5); }
.portal-navigation :where(ul) { margin: 0; padding: 0; list-style: none; }
.portal-navigation__links { display: grid; gap: var(--sgj-space-2); }
.portal-navigation__links a,
.portal-navigation__more summary { display: flex; min-height: var(--sgj-touch-min); align-items: center; justify-content: space-between; gap: var(--sgj-space-2); padding: var(--sgj-space-2) var(--sgj-space-3); border-radius: var(--sgj-radius-md); color: var(--sgj-text-secondary); text-decoration: none; }
.portal-navigation__links a:hover,
.portal-navigation__more summary:hover { color: var(--sgj-brand-700); background: var(--sgj-brand-50); }
.portal-navigation__links a[aria-current="page"],
.portal-navigation__more summary[aria-current="page"] { color: var(--sgj-brand-700); background: var(--sgj-brand-50); font-weight: 800; }
.portal-navigation__limited { font-size: var(--sgj-font-xs); color: var(--sgj-warning); }
.portal-navigation__caption { margin: 0 0 var(--sgj-space-2); color: var(--sgj-text-tertiary); font-size: var(--sgj-font-xs); }
.portal-navigation__taxonomy ul { display: grid; gap: var(--sgj-space-1); }
.portal-navigation__taxonomy li { padding: var(--sgj-space-1) var(--sgj-space-3); color: var(--sgj-text-tertiary); font-size: var(--sgj-font-sm); }
.portal-navigation__more { position: relative; }
.portal-navigation__more summary { cursor: pointer; list-style: none; }
.portal-navigation__more summary::-webkit-details-marker { display: none; }
.portal-navigation__more-menu { position: absolute; right: 0; bottom: calc(100% + var(--sgj-space-2)); z-index: 20; display: grid; min-width: min(280px, 84vw); gap: var(--sgj-space-1); padding: var(--sgj-space-2) !important; border: 1px solid var(--sgj-border); border-radius: var(--sgj-radius-lg); background: var(--sgj-surface); box-shadow: var(--sgj-shadow-overlay); }
.portal-navigation__more-menu a { justify-content: flex-start; }
.portal-navigation--mobile .portal-navigation__links { grid-auto-flow: column; grid-auto-columns: minmax(72px, 1fr); overflow: visible; }
.portal-navigation--mobile .portal-navigation__links > li > a,
.portal-navigation--mobile .portal-navigation__more > details > summary { justify-content: center; text-align: center; }
</style>
