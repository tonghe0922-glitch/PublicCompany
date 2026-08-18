<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { ApiClientError } from '../api'
import { SgjStatusChip } from '../design-system'
import PortalNavigation from '../router/PortalNavigation.vue'
import { projectActiveNavigation } from '../router/navigation-projection'
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

const navigationItems = computed(() => projectActiveNavigation(PORTAL_IA_NAVIGATION, {
  portalCode: props.portal.code,
  permissions: new Set(session.session?.permissions ?? []),
  implementedRoutePaths: new Set(router.getRoutes().map((record) => record.path)),
  mobile: false,
}))

const pageTitle = computed(() => {
  if (route.path === '/') return props.portal.homeTitle
  const matches = navigationItems.value
    .filter((item) => route.path === item.routePath || route.path.startsWith(`${item.routePath}/`))
    .sort((left, right) => right.routePath.length - left.routePath.length)
  return matches[0]?.label ?? props.portal.homeTitle
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
    <template #sidebar><PortalNavigation :portal-code="props.portal.code" /></template>
    <template #bottomNav><PortalNavigation :portal-code="props.portal.code" mobile /></template>
    <RouterView />
  </UnifiedPortalShell>
</template>
