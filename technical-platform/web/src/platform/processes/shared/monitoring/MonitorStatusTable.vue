<script setup lang="ts">
import { computed } from 'vue'

import type { MonitorProjection, MonitorProjectionData } from '../../../../contracts'
import AsyncStateBoundary from '../async/AsyncStateBoundary.vue'
import type { AsyncState } from '../async/async-state'
import DataTable from '../records/DataTable.vue'

const props = defineProps<{ state: AsyncState<MonitorProjectionData> }>()

function projectionRow(projection: MonitorProjection): Record<string, unknown> {
  return {
    recordId: projection.recordId,
    businessNo: projection.businessNo,
    processCode: projection.processCode,
    currentNodeCode: projection.currentNodeCode,
    status: projection.status,
    versionNo: projection.versionNo,
    updatedAt: projection.updatedAt,
  }
}

const commonColumns = [
  { key: 'businessNo', label: '业务编号' },
  { key: 'processCode', label: '流程' },
  { key: 'currentNodeCode', label: '当前节点' },
  { key: 'status', label: '状态' },
  { key: 'versionNo', label: '版本' },
  { key: 'updatedAt', label: '更新时间' },
]
const p005Columns = [...commonColumns, { key: 'approvedCount', label: '已批准数量' }]
const p004Rows = computed(() => (props.state.data?.p004 ?? []).map(projectionRow))
const p005Rows = computed(() => (props.state.data?.p005 ?? []).map(projection => ({
  ...projectionRow(projection),
  approvedCount: projection.approvedCount,
})))
const showData = computed(() => props.state.phase === 'success' || props.state.phase === 'partial')
</script>

<template>
  <section class="sgj-monitor-status-table" aria-label="P004 与 P005 技术监控投影">
    <AsyncStateBoundary :state="state" />
    <div v-if="showData" class="sgj-monitor-status-table__grids">
      <section data-monitor-process="P004" aria-label="P004 监控投影">
        <h3>P004 请求监控</h3>
        <DataTable
          :columns="commonColumns"
          :rows="p004Rows"
          row-key="recordId"
          :page="1"
          caption="P004 请求监控投影"
        />
      </section>
      <section data-monitor-process="P005" aria-label="P005 监控投影">
        <h3>P005 通知监控</h3>
        <DataTable
          :columns="p005Columns"
          :rows="p005Rows"
          row-key="recordId"
          :page="1"
          caption="P005 通知监控投影"
        />
      </section>
    </div>
  </section>
</template>
