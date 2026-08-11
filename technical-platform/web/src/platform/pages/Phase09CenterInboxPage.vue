<script setup lang="ts">
import { computed } from 'vue'
import { usePortalSessionStore } from '../../session'
import type { PortalDefinition } from '../portal-config'
import P001IdentityPage from './P001IdentityPage.vue'
import P002PermissionRequestPage from './P002PermissionRequestPage.vue'
import P003ProfileChangePage from './P003ProfileChangePage.vue'
import P004GenericRequestPage from './P004GenericRequestPage.vue'

const props = defineProps<{ portal: PortalDefinition }>()
const session = usePortalSessionStore()
const showP001 = computed(() => session.can('p001.session.monitor'))
const showP002 = computed(() => session.can('p002.request.read') || session.can('p002.request.review'))
const showP003 = computed(() => session.can('p003.change.read') || session.can('p003.change.review'))
const showP004 = computed(() => session.can('p004.request.read') || session.can('p004.request.act'))
</script>

<template>
  <main class="phase09-center-inbox" data-testid="phase09-center-inbox">
    <header>
      <p class="phase09-kicker">PHASE-09 · 共享审批/监督入口</p>
      <h1>中心管理端审批与监督</h1>
      <p>同一路由按当前服务端权限投影对应业务能力；隐藏区块不是授权边界，所有 API 仍由后端重新鉴权。</p>
    </header>
    <P001IdentityPage v-if="showP001" :portal="props.portal" />
    <P002PermissionRequestPage v-if="showP002" :portal="props.portal" mode="center" />
    <P003ProfileChangePage v-if="showP003" :portal="props.portal" mode="center" />
    <P004GenericRequestPage v-if="showP004" :portal="props.portal" mode="center" />
    <section v-if="!showP001 && !showP002 && !showP003 && !showP004" class="phase09-empty">
      当前身份没有此共享入口下已施工流程的读取或处理权限。
    </section>
  </main>
</template>

<style scoped>
.phase09-center-inbox{display:grid;gap:1rem}.phase09-center-inbox>header{max-width:76rem;width:100%;margin:0 auto;padding:1.5rem 1.5rem 0}.phase09-kicker{font-weight:700}.phase09-empty{max-width:76rem;width:calc(100% - 3rem);margin:0 auto 1.5rem;padding:1rem;border:1px solid var(--sgj-border,#d8dee9);border-radius:.8rem;background:var(--sgj-surface,#fff)}
</style>
