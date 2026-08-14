<script setup lang="ts">
import { SgjStatusChip } from '@sgj/ui'

interface ProcessRecordProjection {
  businessNo: string
  statusLabel: string
  currentNodeLabel?: string
  versionNo: number
  updatedAt?: string
  freshnessLabel?: string
}

defineProps<{ record: ProcessRecordProjection }>()
</script>

<template>
  <dl class="sgj-process-record-meta">
    <div><dt>业务编号</dt><dd>{{ record.businessNo }}</dd></div>
    <div><dt>当前状态</dt><dd><SgjStatusChip>{{ record.statusLabel }}</SgjStatusChip></dd></div>
    <div v-if="record.currentNodeLabel"><dt>当前节点</dt><dd>{{ record.currentNodeLabel }}</dd></div>
    <div><dt>版本</dt><dd>版本 {{ record.versionNo }}</dd></div>
    <div v-if="record.updatedAt"><dt>更新时间</dt><dd>{{ record.updatedAt }}</dd></div>
    <div v-if="record.freshnessLabel"><dt>数据新鲜度</dt><dd>{{ record.freshnessLabel }}</dd></div>
  </dl>
</template>
