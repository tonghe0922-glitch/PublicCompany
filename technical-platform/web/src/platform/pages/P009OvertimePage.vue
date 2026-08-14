<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { SgjButton, SgjListPageTemplate, SgjNoPermission } from '@sgj/ui'
import type { PortalDefinition } from '../portal-config'
import {
  P009OvertimeActionPanel, P009OvertimeCompensationPanel, P009OvertimeCreateForm, P009OvertimeRecordList,
  classifyP009Error, selectP009ActionCandidates, useP009Overtime,
  type P009ActionCode, type P009ActionCommand, type P009CreateOvertimeInput,
} from '../processes/p009'

const props = defineProps<{ portal: PortalDefinition; mode: 'employee' | 'center' | 'tech' }>()
const process = useP009Overtime({ mode: props.mode })
const selectedId = ref<string>()
interface PendingAction { id: string; code: P009ActionCode; command: P009ActionCommand; key: string }
interface PendingCreate { input: P009CreateOvertimeInput; key: string }
const pendingAction = ref<PendingAction>()
const pendingCreate = ref<PendingCreate>()
const actionRecordId = ref<string>()
const acknowledgedActionRequestId = ref<string>()
const localCreateBusy = ref(false)
const localActionBusy = ref(false)
const records = computed(() => process.records.state.value.data ?? [])
const selected = computed(() => records.value.find(record => record.id === selectedId.value) ?? records.value[0])
const candidates = computed(() => selected.value == null || props.mode === 'tech' ? [] : selectP009ActionCandidates(selected.value, process.can))
const visibleActionState = computed(() => {
  const state = process.action.state.value
  if (state.phase === 'error' && (acknowledgedActionRequestId.value === state.requestId || actionRecordId.value !== selected.value?.id)) return { phase: 'idle' as const }
  return state
})
function lifecycleKey(scope: string): string { return `p009-${scope}-${globalThis.crypto.randomUUID()}` }
async function submitCreate(input: P009CreateOvertimeInput): Promise<void> {
  if (localCreateBusy.value || process.creation.state.value.phase === 'loading') return
  pendingCreate.value = { input, key: lifecycleKey('create') }
  await executePendingCreate()
}
async function executePendingCreate(): Promise<void> {
  const pending = pendingCreate.value
  if (!pending || localCreateBusy.value || process.creation.state.value.phase === 'loading') return
  localCreateBusy.value = true
  const result = await process.createOvertime(pending.input, pending.key)
  localCreateBusy.value = false
  if (result != null || classifyP009Error(process.creation.state.value.error) !== 'retryable') pendingCreate.value = undefined
}
async function performAction(code: P009ActionCode, command: P009ActionCommand): Promise<void> {
  const record = selected.value
  if (!record || localActionBusy.value || process.action.state.value.phase === 'loading') return
  acknowledgedActionRequestId.value = undefined
  actionRecordId.value = record.id
  pendingAction.value = { id: record.id, code, command, key: lifecycleKey(code.toLowerCase()) }
  await executePendingAction()
}
async function executePendingAction(): Promise<void> {
  const pending = pendingAction.value
  if (!pending || localActionBusy.value || process.action.state.value.phase === 'loading') return
  localActionBusy.value = true
  const result = await process.performAction(pending.id, pending.code, pending.command, pending.key)
  localActionBusy.value = false
  if (result != null || classifyP009Error(process.action.state.value.error) !== 'retryable') pendingAction.value = undefined
}
function selectRecord(id: string): void { if (selectedId.value !== id) pendingAction.value = undefined;selectedId.value = id }
async function refreshFacts(): Promise<void> {
  await process.refresh()
  pendingAction.value = undefined
  const state = process.action.state.value
  if (state.phase === 'error') acknowledgedActionRequestId.value = state.requestId
}
onMounted(() => { if (process.canRead()) void process.refresh() })
</script>

<template>
  <SgjListPageTemplate :title="mode === 'tech' ? 'P009 加班流程监控' : '加班与补偿管理'" :description="`${portal.title}：节点与调用方权限只形成体验候选，后端 403/409 始终为最终裁决。`" :heading-level="2">
    <template #actions><SgjButton data-refresh-facts variant="secondary" :disabled="!process.canRead()" @click="refreshFacts">刷新服务端事实</SgjButton></template>
    <SgjNoPermission v-if="!process.canRead()" title="无读取权限" description="当前身份无法读取 P009，不会发起服务请求。" />
    <template v-else>
      <P009OvertimeCreateForm v-if="mode === 'employee'" :allowed="process.canCreate()" :busy="localCreateBusy" :creation-state="process.creation.state.value" @submit="submitCreate" @retry="executePendingCreate" />
      <P009OvertimeRecordList :records="records" :state="process.records.state.value" :selected-id="selected?.id" @select="selectRecord" />
      <P009OvertimeCompensationPanel v-if="selected" :overtime="selected" />
      <P009OvertimeActionPanel v-if="selected && mode !== 'tech'" :overtime="selected" :candidates="candidates" :busy="localActionBusy" :action-state="visibleActionState" @action="performAction" @retry="executePendingAction" />
    </template>
  </SgjListPageTemplate>
</template>
