<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { ApiClientError } from '../api'
import { SgjStatusChip } from '../design-system'
import PortalNavigation from '../router/PortalNavigation.vue'
import { projectActiveNavigation, projectNavigationGroups, resolveActiveItem, type NavigationRouteAccessRule } from '../router/navigation-projection'
import { PORTAL_IA_NAVIGATION } from '../router/navigation-source'
import { safeInternalRedirect } from '../router/redirect'
import { usePortalSessionStore } from '../session'
import UnifiedPortalShell from '../shared/layout/rebuild/UnifiedPortalShell.vue'
import type { PortalDefinition } from './portal-config'
import PortalSessionHeader from './PortalSessionHeader.vue'

const props = defineProps<{ portal: PortalDefinition }>()
const session = usePortalSessionStore()
const route = useRoute()
const router = useRouter()
const sessionNotice = ref('')
const sessionRequestId = ref<string | undefined>()

const routeRecords = computed(() => router.getRoutes())
const implementedRoutePaths = computed(() => new Set(routeRecords.value.map((record) => record.path)))
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
const navigationItems = computed(() => projectActiveNavigation(PORTAL_IA_NAVIGATION, {
  portalCode: props.portal.code,
  permissions: permissions.value,
  implementedRoutePaths: implementedRoutePaths.value,
  mobile: false,
}))
const navigationGroups = computed(() => projectNavigationGroups(PORTAL_IA_NAVIGATION, {
  portalCode: props.portal.code,
  permissions: permissions.value,
  implementedRoutePaths: implementedRoutePaths.value,
  routeAccessRules: routeAccessRules.value,
  mobile: false,
  identityLabel: session.session?.identityName ?? null,
}))

const pageTitle = computed(() => {
  if (typeof route.meta.pageTitle === 'string') return route.meta.pageTitle
  if ((route.path === '/developing' || route.path === '/forbidden') && typeof route.query.label === 'string') {
    return route.query.label
  }
  if (route.path === '/') return props.portal.homeTitle
  return resolveActiveItem(navigationGroups.value, route.path, route.query.module)?.label
    ?? navigationItems.value
      .filter((item) => route.path === item.routePath || route.path.startsWith(`${item.routePath}/`))
      .sort((left, right) => right.routePath.length - left.routePath.length)[0]?.label
    ?? props.portal.homeTitle
})

function showSessionFailure(cause: unknown): void {
  sessionNotice.value = '会话操作未完成，请检查网络或权限后重试。'
  sessionRequestId.value = cause instanceof ApiClientError ? cause.requestId : undefined
}

async function switchIdentity(identityId: string): Promise<void> {
  sessionNotice.value = ''
  try {
    await session.switchIdentity(identityId)
    const permission = typeof route.meta.permission === 'string' ? route.meta.permission : undefined
    if (permission && !session.can(permission)) await router.replace({ name: 'forbidden' })
  } catch (cause) {
    showSessionFailure(cause)
  }
}

async function logout(): Promise<void> {
  let confirmed = true
  try {
    await session.logout()
  } catch {
    confirmed = false
  }
  await router.replace({ name: 'login', query: confirmed ? {} : { notice: 'logout-unconfirmed' } })
}

watch(
  () => session.phase,
  (phase) => {
    if (phase !== 'expired' && phase !== 'signed_out') return
    void router.replace({
      name: 'login',
      query: { redirect: safeInternalRedirect(route.fullPath), notice: phase },
    })
  },
)
</script>

<template>
  <UnifiedPortalShell
    :portal="props.portal"
    :page-title="pageTitle"
    :search-items="navigationItems"
    :alert-visible="Boolean(sessionNotice)"
  >
    <template #header>
      <PortalSessionHeader
        v-if="session.session"
        :portal="props.portal"
        :session="session.session"
        :switching="session.phase === 'switching'"
        @switch-identity="switchIdentity"
        @logout="logout"
      />
      <SgjStatusChip v-else tone="warning">会话状态：{{ session.phase }}</SgjStatusChip>
    </template>
    <template #globalAlert>
      <div class="phase08-session-alert" role="alert">
        <strong>{{ sessionNotice }}</strong>
        <span v-if="sessionRequestId">Request ID: {{ sessionRequestId }}</span>
      </div>
    </template>
    <template #sidebar>
      <PortalNavigation
        :portal-code="props.portal.code"
        :identity-label="session.session?.identityName"
      />
    </template>
    <template #bottomNav>
      <PortalNavigation
        :portal-code="props.portal.code"
        :identity-label="session.session?.identityName"
        mobile
      />
    </template>
    <RouterView />
  </UnifiedPortalShell>
</template>
