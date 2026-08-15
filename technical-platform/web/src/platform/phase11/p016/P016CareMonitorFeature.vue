<script setup lang="ts">
import { SgjButton, SgjEmpty, SgjError, SgjLoading, SgjStatusChip } from '@sgj/ui'

import { useP016CareMonitor } from './use-p016-care-monitor'

const { records, loading, failed, load } = useP016CareMonitor()
</script>

<template>
  <section data-testid="p016-monitor-section" aria-label="P016 workflow metadata monitor">
    <header>
      <h2>P016 员工关怀流程监控</h2>
      <SgjButton variant="secondary" :loading="loading" @click="load">刷新</SgjButton>
    </header>
    <SgjLoading v-if="loading && records.length === 0" />
    <SgjError v-else-if="failed" title="P016 监控投影加载失败" />
    <SgjEmpty v-else-if="records.length === 0" title="暂无可见 P016 监控记录" />
    <article v-for="item in records" v-else :key="item.businessNo" class="p016-monitor-record">
      <strong>{{ item.businessNo }}</strong>
      <span>{{ item.currentNodeCode }}</span>
      <SgjStatusChip>{{ item.status }}</SgjStatusChip>
    </article>
  </section>
</template>

<style scoped>
header, .p016-monitor-record { display: flex; align-items: center; justify-content: space-between; gap: var(--sgj-space-4); }
.p016-monitor-record { padding-block: var(--sgj-space-3); border-block-end: 1px solid var(--sgj-border-color); }
</style>
