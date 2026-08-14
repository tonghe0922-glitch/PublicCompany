<script setup lang="ts">
import { computed } from 'vue'
import { SgjButton } from '@sgj/ui'
import { DataTable, type AsyncState } from '@sgj/platform-ui'
import type { P007ScheduleRecord } from './contracts'

const props = defineProps<{
  records: readonly P007ScheduleRecord[]
  state: AsyncState<readonly P007ScheduleRecord[]>
  selectedId?: string
}>()
const emit = defineEmits<{ select: [id: string] }>()
const columns = [
  { key: 'businessNo', label: '业务编号', filterable: true },
  { key: 'subject', label: '排班主题' },
  { key: 'status', label: '状态' },
  { key: 'currentNodeCode', label: '当前节点' },
  { key: 'versionNo', label: '版本', sortable: true },
] as const

function project(records: readonly P007ScheduleRecord[]): Record<string, unknown>[] {
  return records.map(schedule => ({
    id: schedule.id,
    businessNo: schedule.businessNo,
    subject: schedule.subject,
    status: schedule.status,
    currentNodeCode: schedule.currentNodeCode ?? '—',
    versionNo: schedule.versionNo,
  }))
}

const effectiveRecords = computed(() => props.state.data ?? [])
const rows = computed(() => project(effectiveRecords.value))
const tableState = computed<AsyncState<readonly Record<string, unknown>[]>>(() => ({
  ...props.state,
  data: project(effectiveRecords.value),
}))
</script>

<template>
  <nav v-if="effectiveRecords.length > 1" class="p007-record-selector" aria-label="选择排班记录">
    <SgjButton
      v-for="schedule in effectiveRecords"
      :key="schedule.id"
      :data-select-record="schedule.id"
      :variant="schedule.id === selectedId ? 'primary' : 'secondary'"
      :aria-pressed="schedule.id === selectedId"
      @click="emit('select', schedule.id)"
    >{{ schedule.businessNo }} · {{ schedule.subject }}</SgjButton>
  </nav>
  <DataTable :columns="[...columns]" :rows="rows" row-key="id" :page="1" caption="P007 排班记录" :state="tableState" />
</template>

<style scoped>
.p007-record-selector{display:flex;flex-wrap:wrap;gap:var(--sgj-space-3);margin-block-end:var(--sgj-space-4)}
</style>
