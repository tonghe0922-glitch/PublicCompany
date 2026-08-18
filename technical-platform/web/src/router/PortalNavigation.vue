<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import type { PortalCode } from '../platform/portal-config'
import { usePortalSessionStore } from '../session'
import { projectActiveNavigation, projectPortalTaxonomy, splitMobileNavigation } from './navigation-projection'
import { PORTAL_IA_NAVIGATION } from './navigation-source'

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
const overflowIsCurrent = computed(() => overflowItems.value.some((item) => isCurrent(item.routePath)))
const taxonomy = computed(() => projectPortalTaxonomy(PORTAL_IA_NAVIGATION, props.portalCode))

function isCurrent(path: string): boolean {
  return route.path === path || (path !== '/' && route.path.startsWith(`${path}/`))
}
</script>

<template>
  <nav class="portal-navigation" :class="{ 'portal-navigation--mobile': mobile }" aria-label="业务导航">
    <ul class="portal-navigation__links">
      <li>
        <RouterLink to="/" :aria-current="isCurrent('/') ? 'page' : undefined">
          <span class="portal-navigation__link-main">
            <svg class="portal-navigation__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m3 10.5 9-7.5 9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5z" />
              <path d="M9 21v-7h6v7" />
            </svg>
            <span>首页</span>
          </span>
        </RouterLink>
      </li>
      <li v-for="item in visibleItems" :key="item.sourceKey">
        <RouterLink :to="item.routePath" :aria-current="isCurrent(item.routePath) ? 'page' : undefined">
          <span class="portal-navigation__link-main">
            <svg class="portal-navigation__icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="2" />
              <rect x="14" y="3" width="7" height="7" rx="2" />
              <rect x="3" y="14" width="7" height="7" rx="2" />
              <rect x="14" y="14" width="7" height="7" rx="2" />
            </svg>
            <span>{{ item.label }}</span>
          </span>
          <span v-if="item.limited" class="portal-navigation__limited">移动端受限</span>
        </RouterLink>
      </li>
      <li v-if="mobile && overflowItems.length" class="portal-navigation__more">
        <details>
          <summary :aria-current="overflowIsCurrent ? 'page' : undefined">
            <span class="portal-navigation__link-main">
              <svg class="portal-navigation__icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="5" cy="12" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="19" cy="12" r="1.5" />
              </svg>
              <span>更多</span>
            </span>
          </summary>
          <ul class="portal-navigation__more-menu" aria-label="更多已实现页面">
            <li v-for="item in overflowItems" :key="item.sourceKey">
              <RouterLink :to="item.routePath" :aria-current="isCurrent(item.routePath) ? 'page' : undefined">
                <span class="portal-navigation__link-main">
                  <svg class="portal-navigation__icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 5h14v14H5z" />
                    <path d="M9 9h6v6H9z" />
                  </svg>
                  <span>{{ item.label }}</span>
                </span>
                <span v-if="item.limited" class="portal-navigation__limited">移动端受限</span>
              </RouterLink>
            </li>
          </ul>
        </details>
      </li>
    </ul>

    <section v-if="!mobile" class="portal-navigation__taxonomy" aria-label="功能分类">
      <p class="portal-navigation__caption">功能分类</p>
      <ul>
        <li v-for="group in taxonomy" :key="group.label">
          <span aria-disabled="true">{{ group.label }}</span>
        </li>
      </ul>
    </section>
  </nav>
</template>

<style scoped>
.portal-navigation {
  display: grid;
  gap: var(--sgj-space-4);
}

.portal-navigation :where(ul) {
  margin: 0;
  padding: 0;
  list-style: none;
}

.portal-navigation__links {
  display: grid;
  gap: 3px;
}

.portal-navigation__links a,
.portal-navigation__more summary {
  min-height: var(--sgj-touch-min);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sgj-space-2);
  padding: 9px 12px;
  border: 1px solid transparent;
  border-radius: var(--sgj-radius-lg);
  color: var(--sgj-text-secondary);
  background: transparent;
  font-size: 15px;
  font-weight: 580;
  text-decoration: none;
  transition:
    color var(--sgj-motion-fast) var(--sgj-ease-standard),
    background-color var(--sgj-motion-fast) var(--sgj-ease-standard),
    border-color var(--sgj-motion-fast) var(--sgj-ease-standard),
    box-shadow var(--sgj-motion-fast) var(--sgj-ease-standard),
    transform var(--sgj-motion-fast) var(--sgj-ease-standard);
}

.portal-navigation__links a:hover,
.portal-navigation__more summary:hover {
  color: var(--sgj-brand-700);
  background: var(--sgj-brand-50);
  border-color: var(--sgj-brand-100);
}

.portal-navigation__links a[aria-current="page"],
.portal-navigation__more summary[aria-current="page"] {
  color: #fff;
  background: linear-gradient(135deg, var(--sgj-brand-500), var(--sgj-brand-600));
  border-color: var(--sgj-brand-600);
  box-shadow: var(--sgj-shadow-accent);
  font-weight: 700;
}

.portal-navigation__link-main {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 11px;
}

.portal-navigation__link-main > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.portal-navigation__icon {
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.portal-navigation__limited {
  flex: 0 0 auto;
  padding: 2px 7px;
  border-radius: var(--sgj-radius-pill);
  color: var(--sgj-warning);
  background: var(--sgj-warning-bg);
  font-size: 10px;
  font-weight: 700;
}

.portal-navigation__links a[aria-current="page"] .portal-navigation__limited {
  color: #fff;
  background: rgba(255, 255, 255, .18);
}

.portal-navigation__taxonomy {
  padding-top: var(--sgj-space-3);
  border-top: 1px solid var(--sgj-border);
}

.portal-navigation__caption {
  margin: 0 0 var(--sgj-space-2);
  padding-inline: var(--sgj-space-3);
  color: var(--sgj-text-tertiary);
  font-size: var(--sgj-font-xs);
  font-weight: 800;
  letter-spacing: .08em;
}

.portal-navigation__taxonomy ul {
  display: grid;
  gap: var(--sgj-space-1);
}

.portal-navigation__taxonomy li {
  padding: 5px var(--sgj-space-3);
  color: var(--sgj-text-tertiary);
  font-size: var(--sgj-font-sm);
}

.portal-navigation__more { position: relative; }
.portal-navigation__more summary { cursor: pointer; list-style: none; }
.portal-navigation__more summary::-webkit-details-marker { display: none; }

.portal-navigation__more-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + var(--sgj-space-2));
  z-index: 20;
  min-width: min(300px, 88vw);
  display: grid;
  gap: var(--sgj-space-1);
  padding: var(--sgj-space-2) !important;
  border: 1px solid var(--sgj-border);
  border-radius: var(--sgj-radius-lg);
  background: var(--sgj-surface);
  box-shadow: var(--sgj-shadow-lg);
}

.portal-navigation__more-menu a { justify-content: flex-start; }

.portal-navigation--mobile {
  height: 100%;
  padding: 3px 4px;
}

.portal-navigation--mobile .portal-navigation__links {
  height: 100%;
  grid-auto-flow: column;
  grid-auto-columns: minmax(72px, 1fr);
  align-items: stretch;
  overflow: visible;
}

.portal-navigation--mobile .portal-navigation__links > li > a,
.portal-navigation--mobile .portal-navigation__more > details > summary {
  height: 100%;
  min-height: 58px;
  justify-content: center;
  padding: 6px 4px;
  border: 0;
  border-radius: var(--sgj-radius-md);
  color: var(--sgj-text-tertiary);
  background: transparent;
  box-shadow: none;
  font-size: var(--sgj-font-xs);
  text-align: center;
}

.portal-navigation--mobile .portal-navigation__link-main {
  flex-direction: column;
  justify-content: center;
  gap: 2px;
}

.portal-navigation--mobile .portal-navigation__icon {
  width: 21px;
  height: 21px;
}

.portal-navigation--mobile .portal-navigation__links a[aria-current="page"],
.portal-navigation--mobile .portal-navigation__more summary[aria-current="page"] {
  color: var(--sgj-brand-600);
  background: var(--sgj-brand-50);
}

.portal-navigation--mobile .portal-navigation__limited { display: none; }
</style>
