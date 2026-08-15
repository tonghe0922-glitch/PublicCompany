<script setup lang="ts">
import { computed, watch } from 'vue'
import { SgjEmpty, SgjError, SgjLoading, SgjNoPermission, SgjStatusChip } from '@sgj/ui'

import { usePortalSessionStore } from '../../../../session'
import type { PortalDefinition } from '../../../portal-config'
import { useP008Leave } from '../../p008/useP008Leave'
import type { P008LeaveRecord } from '../../p008/contracts'
import { useP009Overtime } from '../../p009/useP009Overtime'
import type { P009OvertimeRecord } from '../../p009/contracts'
import type { AsyncState } from '../async/async-state'
import PermissionGate from '../security/PermissionGate.vue'

defineProps<{ portal: PortalDefinition }>()

interface AttendanceMonitorRecord {
  businessNo: string
  currentNodeCode: string | null
  status: string
}

type AttendanceSourceRecord = P008LeaveRecord | P009OvertimeRecord

const session = usePortalSessionStore()
const p008 = useP008Leave({ mode: 'tech' })
const p009 = useP009Overtime({ mode: 'tech' })
const p008Allowed = computed(() => session.can('p008.leave.monitor'))
const p009Allowed = computed(() => session.can('p009.overtime.monitor'))

function projectRecords(records: readonly AttendanceSourceRecord[] | undefined): readonly AttendanceMonitorRecord[] {
  return (records ?? []).map(record => ({
    businessNo: record.businessNo,
    currentNodeCode: record.currentNodeCode,
    status: record.status,
  }))
}

function projectState(state: AsyncState<readonly AttendanceSourceRecord[]>): AsyncState<readonly AttendanceMonitorRecord[]> {
  const data = projectRecords(state.data)
  if (state.phase === 'error') {
    return { phase: 'error', error: state.error, requestId: state.requestId, updatedAt: state.updatedAt }
  }
  if (state.phase === 'partial') {
    return {
      phase: 'partial', data, error: state.error, requestId: state.requestId,
      updatedAt: state.updatedAt, missingResources: state.missingResources,
    }
  }
  return { phase: state.phase, data, requestId: state.requestId, updatedAt: state.updatedAt }
}

const p008State = computed(() => projectState(p008.records.state.value))
const p009State = computed(() => projectState(p009.records.state.value))

watch(p008Allowed, allowed => {
  if (allowed) void p008.refresh()
}, { immediate: true })
watch(p009Allowed, allowed => {
  if (allowed) void p009.refresh()
}, { immediate: true })
</script>

<template>
  <section data-testid="attendance-workflow-monitor">
    <PermissionGate :allowed="p008Allowed">
      <section data-attendance-process="P008" aria-label="P008 请假流程监控">
        <h2>P008 请假流程监控</h2>
        <SgjLoading v-if="p008State.phase === 'idle' || p008State.phase === 'loading'" />
        <SgjNoPermission
          v-else-if="p008State.phase === 'error' && p008State.error?.status === 403"
          :description="p008State.error.userMessage"
        />
        <SgjError
          v-else-if="p008State.phase === 'error'"
          :title="p008State.error?.title"
          :description="p008State.error?.userMessage"
        />
        <SgjEmpty v-else-if="p008State.phase === 'empty'" title="暂无 P008 考勤监控记录" />
        <article v-for="item in p008State.data ?? []" v-else :key="item.businessNo">
          <strong>{{ item.businessNo }}</strong>
          <span>{{ item.currentNodeCode ?? 'END' }}</span>
          <SgjStatusChip>{{ item.status }}</SgjStatusChip>
        </article>
      </section>
    </PermissionGate>

    <PermissionGate :allowed="p009Allowed">
      <section data-attendance-process="P009" aria-label="P009 加班流程监控">
        <h2>P009 加班流程监控</h2>
        <SgjLoading v-if="p009State.phase === 'idle' || p009State.phase === 'loading'" />
        <SgjNoPermission
          v-else-if="p009State.phase === 'error' && p009State.error?.status === 403"
          :description="p009State.error.userMessage"
        />
        <SgjError
          v-else-if="p009State.phase === 'error'"
          :title="p009State.error?.title"
          :description="p009State.error?.userMessage"
        />
        <SgjEmpty v-else-if="p009State.phase === 'empty'" title="暂无 P009 考勤监控记录" />
        <article v-for="item in p009State.data ?? []" v-else :key="item.businessNo">
          <strong>{{ item.businessNo }}</strong>
          <span>{{ item.currentNodeCode ?? 'END' }}</span>
          <SgjStatusChip>{{ item.status }}</SgjStatusChip>
        </article>
      </section>
    </PermissionGate>

    <SgjEmpty v-if="!p008Allowed && !p009Allowed" title="暂无可见考勤监控流程" />
  </section>
</template>

<style scoped>
[data-testid="attendance-workflow-monitor"] { display: grid; gap: var(--sgj-space-4); }
[data-attendance-process] { display: grid; gap: var(--sgj-space-3); }
article { display: flex; align-items: center; justify-content: space-between; gap: var(--sgj-space-3); }
</style>
