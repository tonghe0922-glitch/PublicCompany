<script setup lang="ts">
import { computed } from 'vue'
import { SgjButton, SgjEmpty, SgjError, SgjInput, SgjLoading, SgjPartialFailure, SgjTable } from '@sgj/ui'
import type { AsyncState } from '../async/async-state'

interface DataColumn {
  key: string
  label: string
  sortable?: boolean
  filterable?: boolean
}

type DataRow = Record<string, unknown>
type SortDirection = 'asc' | 'desc'

interface DataSort {
  key: string
  direction: SortDirection
}

const props = withDefaults(defineProps<{
  columns: DataColumn[]
  rows: DataRow[]
  rowKey: string
  page: number
  totalPages?: number
  caption?: string
  state?: AsyncState<readonly DataRow[]>
  sort?: DataSort
  filters?: Readonly<Record<string, string>>
}>(), {
  totalPages: undefined,
  caption: undefined,
  state: undefined,
  sort: undefined,
  filters: () => ({}),
})

const emit = defineEmits<{
  pageChange: [page: number]
  sortChange: [sort: DataSort]
  filterChange: [filter: { key: string; value: string }]
}>()

const phase = computed(() => props.state?.phase ?? (props.rows.length === 0 ? 'empty' : 'success'))
const effectiveRows = computed<readonly DataRow[]>(() => props.state ? (props.state.data ?? []) : props.rows)
const filterableColumns = computed(() => props.columns.filter(candidate => candidate.filterable))
const showRows = computed(() => (phase.value === 'success' || phase.value === 'partial' || phase.value === 'idle') && effectiveRows.value.length > 0)

function emitSort(key: string): void {
  const column = props.columns.find(candidate => candidate.key === key)
  if (!column?.sortable) return
  const direction: SortDirection = props.sort?.key === key && props.sort.direction === 'asc' ? 'desc' : 'asc'
  emit('sortChange', { key, direction })
}

function emitFilter(key: string, value: string): void {
  const column = props.columns.find(candidate => candidate.key === key)
  if (!column?.filterable) return
  emit('filterChange', { key, value })
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') return `${value}`
  return '—'
}

function rowIdentity(row: DataRow): string {
  return cellText(row[props.rowKey])
}
</script>

<template>
  <div class="sgj-data-table">
    <SgjLoading v-if="phase === 'loading'" title="正在加载数据" description="请稍候，服务端查询正在返回。" />
    <SgjEmpty v-else-if="phase === 'empty' || (phase === 'success' && effectiveRows.length === 0)" title="暂无数据" description="当前服务端查询没有返回记录。" />
    <SgjError v-else-if="phase === 'error'" :title="state?.error?.title" :description="state?.error?.userMessage" :error-code="state?.error?.code" :trace-id="state?.error?.requestId" />
    <SgjPartialFailure v-else-if="phase === 'partial'" title="部分数据暂不可用" :description="`缺失资源：${state?.missingResources?.join('、') || '未提供'}`" />

    <div v-if="filterableColumns.length > 0" class="sgj-data-table__filters" aria-label="服务端筛选条件">
      <SgjInput
        v-for="column in filterableColumns"
        :key="column.key"
        :data-filter-key="column.key"
        :label="`${column.label}筛选`"
        :model-value="filters[column.key] ?? ''"
        @update:model-value="emitFilter(column.key, $event)"
      />
    </div>

    <SgjTable v-if="showRows" :caption="caption" aria-label="数据列表" :empty="false" :column-count="columns.length">
      <template #head>
        <tr>
          <th v-for="column in columns" :key="column.key" scope="col">
            <SgjButton
              v-if="column.sortable"
              :data-sort-key="column.key"
              variant="secondary"
              @click="emitSort(column.key)"
            >
              {{ column.label }}{{ sort?.key === column.key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : '' }}
            </SgjButton>
            <template v-else>{{ column.label }}</template>
          </th>
        </tr>
      </template>
      <template #body>
        <tr v-for="row in effectiveRows" :key="rowIdentity(row)">
          <td v-for="column in columns" :key="column.key">{{ cellText(row[column.key]) }}</td>
        </tr>
      </template>
    </SgjTable>

    <div v-if="showRows" class="sgj-data-table__mobile" aria-label="移动端数据列表">
      <dl v-for="row in effectiveRows" :key="rowIdentity(row)" :data-mobile-row="rowIdentity(row)">
        <div v-for="column in columns" :key="column.key">
          <dt>{{ column.label }}</dt><dd>{{ cellText(row[column.key]) }}</dd>
        </div>
      </dl>
    </div>

    <nav v-if="showRows" class="sgj-data-table__pagination" aria-label="分页">
      <SgjButton data-page="previous" variant="secondary" :disabled="page <= 1" @click="emit('pageChange', page - 1)">上一页</SgjButton>
      <span>第 {{ page }} 页</span>
      <SgjButton data-page="next" variant="secondary" :disabled="totalPages !== undefined && page >= totalPages" @click="emit('pageChange', page + 1)">下一页</SgjButton>
    </nav>
  </div>
</template>
