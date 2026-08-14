<script setup lang="ts">
import { computed } from 'vue'
import { SgjButton, SgjCard } from '@sgj/ui'

import type { MonitorProjectionResource } from '../../../../contracts'
import MonitorStatusTable from './MonitorStatusTable.vue'

const props = defineProps<{ resource: MonitorProjectionResource }>()
const state = computed(() => props.resource.state.value)
const refreshing = computed(() => state.value.phase === 'loading')

async function refresh(): Promise<void> {
  await props.resource.refresh()
}
</script>

<template>
  <SgjCard as="section" aria-label="技术流程监控">
    <header class="sgj-monitor-panel__header">
      <div>
        <h2>技术流程监控</h2>
        <p>仅展示 P004 与 P005 的服务端最小监控投影。</p>
      </div>
      <SgjButton
        data-monitor-refresh
        variant="secondary"
        :disabled="refreshing"
        @click="refresh"
      >
        刷新监控事实
      </SgjButton>
    </header>
    <MonitorStatusTable :state="state" />
  </SgjCard>
</template>
