<script setup lang="ts">
import { computed } from 'vue'
import { SgjButton, SgjEmpty, SgjError, SgjLoading, SgjStatusChip } from '@sgj/ui'

export interface ProcessMetadataMonitorRecord {
  businessNo: string
  currentNodeCode: string | null
  status: string
}

const props = defineProps<{
  processCode: 'P006' | 'P007' | 'P010'
  records: readonly ProcessMetadataMonitorRecord[]
  phase: string
  load: () => Promise<unknown>
}>()

const loading = computed(() => props.phase === 'loading')
const failed = computed(() => props.phase === 'error')
</script>

<template>
  <section :data-monitor-process="processCode" :aria-label="`${processCode} 流程元数据监控`">
    <header>
      <h2>{{ processCode }} 流程元数据监控</h2>
      <SgjButton variant="secondary" :loading="loading" @click="load">刷新</SgjButton>
    </header>
    <SgjLoading v-if="loading && records.length === 0" />
    <SgjError v-else-if="failed" :title="`${processCode} 监控投影加载失败`" />
    <SgjEmpty v-else-if="records.length === 0" :title="`暂无可见 ${processCode} 监控记录`" />
    <article v-for="item in records" v-else :key="item.businessNo" class="metadata-record">
      <strong>{{ item.businessNo }}</strong>
      <span>{{ item.currentNodeCode ?? 'END' }}</span>
      <SgjStatusChip>{{ item.status }}</SgjStatusChip>
    </article>
  </section>
</template>

<style scoped>
header, .metadata-record { display: flex; align-items: center; justify-content: space-between; gap: var(--sgj-space-4); }
.metadata-record { padding-block: var(--sgj-space-3); border-block-end: 1px solid var(--sgj-border-color); }
</style>
