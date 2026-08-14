<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { SgjButton, SgjListPageTemplate, SgjNoPermission } from '@sgj/ui'
import type { PortalDefinition } from '../portal-config'
import {
  P007ScheduleActionPanel,
  P007ScheduleRecordList,
  P007ShiftCreateForm,
  P007ShiftDetails,
  selectP007ActionCandidates,
  useP007Schedule,
  type P007ActionCode,
  type P007ActionCommand,
} from '../processes/p007'

const props = defineProps<{ portal: PortalDefinition; mode: 'employee' | 'center' | 'tech' }>()
const process = useP007Schedule({ mode: props.mode })
const selectedId = ref<string>()
interface PendingAction { id: string; code: P007ActionCode; command: P007ActionCommand; key: string }
const pendingAction = ref<PendingAction>()
const actionRecordId = ref<string>()
const acknowledgedActionRequestId = ref<string>()

const canRead = computed(() => process.canRead())
const records = computed(() => process.records.state.value.data ?? [])
const selected = computed(() => records.value.find(schedule => schedule.id === selectedId.value) ?? records.value[0])
const candidates = computed(() => selected.value == null || props.mode === 'tech'
  ? []
  : selectP007ActionCandidates(selected.value, process.can))
const busy = computed(() => process.action.state.value.phase === 'loading')
const visibleActionState = computed(() => {
  const state = process.action.state.value
  if (state.phase === 'error' && acknowledgedActionRequestId.value === state.requestId) return { phase: 'idle' as const }
  if (state.phase === 'error' && actionRecordId.value !== selected.value?.id) return { phase: 'idle' as const }
  return state
})

function lifecycleKey(code: P007ActionCode): string {
  return `p007-${code.toLowerCase()}-${globalThis.crypto.randomUUID()}`
}

function hasUncertainResult(): boolean {
  const state = process.action.state.value
  if (state.phase !== 'error' || !state.error) return false
  const { kind, status } = state.error
  if (status === undefined) return kind === 'transport' || kind === 'unknown'
  if (status >= 500) return kind === 'server'
  return status === 408 && kind === 'timeout'
}

async function performAction(code: P007ActionCode, command: P007ActionCommand): Promise<void> {
  const schedule = selected.value
  if (schedule == null || process.action.state.value.phase === 'loading') return
  acknowledgedActionRequestId.value = undefined
  actionRecordId.value = schedule.id
  pendingAction.value = { id: schedule.id, code, command, key: lifecycleKey(code) }
  await executePendingAction()
}

async function executePendingAction(): Promise<void> {
  const current = pendingAction.value
  if (current == null || process.action.state.value.phase === 'loading') return
  await process.performAction(current.id, current.code, current.command, current.key)
  if (!hasUncertainResult()) pendingAction.value = undefined
}

function selectRecord(id: string): void {
  if (selectedId.value !== id) {
    pendingAction.value = undefined
  }
  selectedId.value = id
}

async function refreshFacts(): Promise<void> {
  await process.refresh()
  pendingAction.value = undefined
  const state = process.action.state.value
  if (state.phase === 'error') acknowledgedActionRequestId.value = state.requestId
}

onMounted(() => {
  if (canRead.value) void process.refresh()
})
</script>

<template>
  <SgjListPageTemplate
    :title="mode === 'tech' ? 'P007 排班流程监控' : '排班计划与班次调整'"
    :description="`${portal.title}：节点与调用方权限只形成体验候选，后端 403/409 始终为最终裁决。`"
    :heading-level="2"
  >
    <template #actions>
      <SgjButton data-refresh-facts variant="secondary" :disabled="!canRead" @click="refreshFacts">刷新服务端事实</SgjButton>
    </template>
    <SgjNoPermission v-if="!canRead" title="无读取权限" description="当前身份无法读取 P007，不会发起服务请求。" />
    <template v-else>
      <P007ShiftCreateForm v-if="mode === 'center'" />
      <P007ScheduleRecordList
        :records="records"
        :state="process.records.state.value"
        :selected-id="selected?.id"
        @select="selectRecord"
      />
      <P007ShiftDetails v-if="selected" :schedule="selected" />
      <P007ScheduleActionPanel
        v-if="selected && mode !== 'tech'"
        :schedule="selected"
        :candidates="candidates"
        :busy="busy"
        :action-state="visibleActionState"
        @action="performAction"
        @retry="executePendingAction"
      />
    </template>
  </SgjListPageTemplate>
</template>
