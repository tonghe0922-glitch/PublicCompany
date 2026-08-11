<script setup lang="ts">
import { computed } from 'vue'
import { usePortalSessionStore } from '../../session'
import type { PortalDefinition } from '../portal-config'
import P004GenericRequestPage from './P004GenericRequestPage.vue'
import P005NoticePage from './P005NoticePage.vue'

const props = defineProps<{ portal: PortalDefinition }>()
const session = usePortalSessionStore()
const showP004 = computed(() => session.can('p004.request.read'))
const showP005 = computed(() => session.can('p005.notice.monitor'))
</script>

<template>
  <main class="phase09-tech-monitor" data-testid="phase09-tech-workflow-monitor">
    <P004GenericRequestPage v-if="showP004" :portal="props.portal" mode="tech" />
    <P005NoticePage v-if="showP005" :portal="props.portal" mode="tech" />
    <section v-if="!showP004 && !showP005" class="phase09-empty">
      当前身份没有此共享工作流监控入口下已施工流程的监控权限。
    </section>
  </main>
</template>

<style scoped>
.phase09-tech-monitor{display:grid;gap:1rem}.phase09-empty{max-width:76rem;width:calc(100% - 3rem);margin:1.5rem auto;padding:1rem;border:1px solid var(--sgj-border,#d8dee9);border-radius:.8rem;background:var(--sgj-surface,#fff)}
</style>
