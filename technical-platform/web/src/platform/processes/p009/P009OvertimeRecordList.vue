<script setup lang="ts">
import { computed } from 'vue'
import { SgjButton } from '@sgj/ui'
import { DataTable, type AsyncState } from '@sgj/platform-ui'
import type { P009OvertimeRecord } from './contracts'

const props = defineProps<{ records: readonly P009OvertimeRecord[]; state: AsyncState<readonly P009OvertimeRecord[]>; selectedId?: string }>()
const emit = defineEmits<{ select: [id: string] }>()
const columns = [
  { key: 'businessNo', label: '业务编号', filterable: true }, { key: 'subject', label: '加班主题' },
  { key: 'status', label: '状态' }, { key: 'currentNodeCode', label: '当前节点' }, { key: 'versionNo', label: '版本', sortable: true },
] as const
const effectiveRecords = computed(() => props.state.data ?? [])
const rows = computed(() => effectiveRecords.value.map(record => ({
  id: record.id, businessNo: record.businessNo, subject: record.subject, status: record.status,
  currentNodeCode: record.currentNodeCode ?? '—', versionNo: record.versionNo,
})))
const tableState = computed<AsyncState<readonly Record<string, unknown>[]>>(() => ({ ...props.state, data: rows.value }))
</script>

<template>
  <nav v-if="effectiveRecords.length > 1" class="p009-record-selector" aria-label="选择加班记录">
    <SgjButton v-for="record in effectiveRecords" :key="record.id" :data-select-record="record.id" :variant="record.id === selectedId ? 'primary' : 'secondary'" :aria-pressed="record.id === selectedId" @click="emit('select', record.id)">
      {{ record.businessNo }} · {{ record.subject }}
    </SgjButton>
  </nav>
  <DataTable :columns="[...columns]" :rows="rows" row-key="id" :page="1" caption="P009 加班记录" :state="tableState" />
</template>

<style scoped>.p009-record-selector{display:flex;flex-wrap:wrap;gap:var(--sgj-space-3);margin-block-end:var(--sgj-space-4)}</style>
