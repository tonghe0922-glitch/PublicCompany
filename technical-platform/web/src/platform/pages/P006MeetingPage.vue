<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { SgjButton, SgjListPageTemplate, SgjNoPermission } from '@sgj/ui'
import type { PortalDefinition } from '../portal-config'
import {
  P006MeetingActionPanel,
  P006MeetingCreateForm,
  P006MeetingEvidencePanel,
  P006MeetingRecordList,
  selectP006ActionCandidates,
  useP006Meeting,
  type P006ActionCode,
  type P006ActionCommand,
  type P006CreateMeetingInput,
} from '../processes/p006'

const props = defineProps<{ portal: PortalDefinition; mode: 'employee' | 'center' | 'tech' }>()
const process = useP006Meeting({ mode: props.mode })
const selectedId = ref<string>()
interface PendingCreate { input: P006CreateMeetingInput; key: string }
interface PendingAction { id: string; code: P006ActionCode; command: P006ActionCommand; key: string }
const pendingCreate = ref<PendingCreate>()
const pendingAction = ref<PendingAction>()

const canRead = computed(() => process.canRead())
const canCreate = computed(() => process.canCreate())
const records = computed(() => process.records.state.value.data ?? [])
const selected = computed(() => records.value.find(record => record.id === selectedId.value) ?? records.value[0])
const candidates = computed(() => selected.value == null || props.mode === 'tech'
  ? []
  : selectP006ActionCandidates(selected.value, process.can))
const busy = computed(() => process.creation.state.value.phase === 'loading' || process.action.state.value.phase === 'loading')

function actionKey(prefix: string): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`
}

function hasUncertainResult(state: typeof process.action.state.value): boolean {
  if (state.phase !== 'error' || !state.error) return false
  const { kind, status } = state.error
  if (status === undefined) return kind === 'transport' || kind === 'unknown'
  if (status >= 500) return kind === 'server'
  return (status === 408 && kind === 'timeout') || (status === 429 && kind === 'rate-limit')
}

async function createMeeting(input: P006CreateMeetingInput): Promise<void> {
  if (process.creation.state.value.phase === 'loading') return
  if (process.creation.state.value.phase === 'error' && !process.canCorrectCreation()) return
  pendingCreate.value = { input, key: actionKey('p006-create') }
  await executePendingCreate()
}

async function executePendingCreate(): Promise<void> {
  const current = pendingCreate.value
  if (current == null || process.creation.state.value.phase === 'loading') return
  await process.createMeeting(current.input, current.key)
  if (process.creation.state.value.phase === 'success' || !process.canRetryCreation()) pendingCreate.value = undefined
}

async function performAction(code: P006ActionCode, command: P006ActionCommand): Promise<void> {
  const meeting = selected.value
  if (meeting == null || process.action.state.value.phase === 'loading') return
  pendingAction.value = { id: meeting.id, code, command, key: actionKey(`p006-${code.toLowerCase()}`) }
  await executePendingAction()
}

async function executePendingAction(): Promise<void> {
  const current = pendingAction.value
  if (current == null || process.action.state.value.phase === 'loading') return
  await process.performAction(current.id, current.code, current.command, current.key)
  if (!hasUncertainResult(process.action.state.value)) pendingAction.value = undefined
}

function selectRecord(id: string): void {
  if (selectedId.value !== id) pendingAction.value = undefined
  selectedId.value = id
}

onMounted(() => {
  if (canRead.value) void process.refresh()
})
</script>

<template>
  <SgjListPageTemplate
    :title="mode === 'tech' ? 'P006 工作流运行监控' : '会议、纪要与行动项'"
    :description="`${portal.title}：节点与权限只用于体验候选，后端 403/409 始终为最终裁决。`"
    :heading-level="2"
  >
    <template #actions>
      <SgjButton variant="secondary" :disabled="!canRead" @click="process.refresh">刷新服务端记录</SgjButton>
    </template>
    <SgjNoPermission v-if="!canRead" title="无读取权限" description="当前身份无法读取 P006，不会发起服务请求。" />
    <template v-else>
      <P006MeetingCreateForm
        v-if="mode === 'employee'"
        :allowed="canCreate"
        :busy="process.creation.state.value.phase === 'loading'"
        :creation-state="process.creation.state.value"
        @submit="createMeeting"
        @retry="executePendingCreate"
      />
      <P006MeetingRecordList
        :records="records"
        :state="process.records.state.value"
        :selected-id="selected?.id"
        @select="selectRecord"
      />
      <P006MeetingEvidencePanel v-if="selected" :meeting="selected" />
      <P006MeetingActionPanel
        v-if="selected && mode !== 'tech'"
        :meeting="selected"
        :candidates="candidates"
        :busy="busy"
        :action-state="process.action.state.value"
        @action="performAction"
        @retry="executePendingAction"
      />
    </template>
  </SgjListPageTemplate>
</template>
