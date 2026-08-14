<script setup lang="ts">
import { computed } from 'vue'
import { DataTable, type AsyncState } from '@sgj/platform-ui'
import type { P008QuotaEntry } from './contracts'

const props = defineProps<{ state: AsyncState<readonly P008QuotaEntry[]> }>()
const columns = [
  { key: 'createdAt', label: '发生时间' }, { key: 'entryType', label: '类型' },
  { key: 'availableAfter', label: '可用余额' }, { key: 'reservedAfter', label: '预占余额' }, { key: 'consumedAfter', label: '已用余额' },
] as const
const rows = computed(() => (props.state.data ?? []).map(entry => ({
  id: entry.id, createdAt: entry.createdAt, entryType: entry.entryType,
  availableAfter: entry.availableAfter, reservedAfter: entry.reservedAfter, consumedAfter: entry.consumedAfter,
})))
const tableState = computed<AsyncState<readonly Record<string, unknown>[]>>(() => ({ ...props.state, data: rows.value }))
</script>

<template><DataTable :columns="[...columns]" :rows="rows" row-key="id" :page="1" caption="P008 假期额度账本" :state="tableState" /></template>
