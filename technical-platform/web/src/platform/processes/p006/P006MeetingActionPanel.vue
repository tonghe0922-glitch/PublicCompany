<script setup lang="ts">
import { computed, ref } from 'vue'
import { SgjButton, SgjCard, SgjTextarea } from '@sgj/ui'
import { ApiErrorNotice, type AsyncState, type UiError } from '@sgj/platform-ui'

import type { P006ActionCandidate, P006ActionCode, P006ActionCommand, P006MeetingRecord } from './contracts'

const STATUS_KINDS = {
  401: 'unauthorized', 403: 'forbidden', 404: 'not-found', 408: 'timeout',
  409: 'conflict', 422: 'validation', 429: 'rate-limit',
} as const satisfies Readonly<Record<number, UiError['kind']>>

const props = withDefaults(defineProps<{
  meeting: P006MeetingRecord
  candidates: readonly P006ActionCandidate[]
  busy: boolean
  actionState?: AsyncState<P006MeetingRecord>
}>(), { actionState: undefined })
const emit = defineEmits<{ action: [code: P006ActionCode, command: P006ActionCommand]; retry: [] }>()
const reason = ref('')
const resultSummary = ref('')
const evidence = ref('')
const isBlockedByState = computed(() => props.busy || props.actionState?.phase === 'loading' || props.actionState?.phase === 'error')
const projectedError = computed<UiError | undefined>(() => {
  const error = props.actionState?.error
  if (!error) return undefined
  const expectedKind = error.status !== undefined && error.status >= 500
    ? 'server'
    : error.status === undefined ? undefined : STATUS_KINDS[error.status as keyof typeof STATUS_KINDS]
  const safeWithoutStatus = error.status === undefined && (error.kind === 'unknown' || error.kind === 'transport')
  if (safeWithoutStatus || expectedKind === error.kind) return error
  return {
    kind: 'unknown',
    status: error.status,
    title: '无法确认错误类型',
    userMessage: '后端错误代码与类型矛盾，已停止普通动作，请刷新后再处理。',
    nextAction: '刷新服务端状态',
  }
})

function validationMessage(candidate: P006ActionCandidate): string | undefined {
  if (['RETURN', 'REJECT', 'REWORK'].includes(candidate.code) && !reason.value.trim()) return '请补充当前动作必需材料：处理原因。'
  if (candidate.code === 'CONFIRM_MINUTES' && !resultSummary.value.trim()) return '请补充当前动作必需材料：纪要摘要。'
  if (['SUBMIT_EXECUTION', 'ACCEPT_RESULT', 'REWORK', 'ACKNOWLEDGE_OVERDUE', 'ARCHIVE'].includes(candidate.code) && !evidence.value.trim()) {
    return '请补充当前动作必需材料：不可变证据摘要。'
  }
  return undefined
}

function isCandidateBlocked(candidate: P006ActionCandidate): boolean {
  return candidate.blocked || isBlockedByState.value || validationMessage(candidate) !== undefined
}

function perform(candidate: P006ActionCandidate): void {
  if (isCandidateBlocked(candidate)) return
  const needsEvidence = ['SUBMIT_EXECUTION', 'ACCEPT_RESULT', 'REWORK', 'ACKNOWLEDGE_OVERDUE', 'ARCHIVE'].includes(candidate.code)
  emit('action', candidate.code, {
    expectedVersion: props.meeting.versionNo,
    reason: reason.value.trim() || null,
    resultSummary: resultSummary.value.trim() || null,
    evidence: needsEvidence ? { note: evidence.value.trim(), recordedAt: new Date().toISOString() } : null,
  })
}
</script>

<template>
  <SgjCard as="section" variant="muted">
    <template #header><strong>当前节点操作</strong></template>
    <div data-action-reason><SgjTextarea v-model="reason" label="处理/退回原因" /></div>
    <SgjTextarea v-model="resultSummary" label="纪要或结果摘要" />
    <div data-action-evidence><SgjTextarea v-model="evidence" label="不可变证据摘要" /></div>
    <div v-if="actionState?.phase === 'error' && projectedError" data-action-error>
      <ApiErrorNotice :error="projectedError" @retry="emit('retry')" />
    </div>
    <div class="p006-actions">
      <div v-for="candidate in candidates" :key="candidate.code">
        <SgjButton
          :data-action-code="candidate.code"
          :disabled="isCandidateBlocked(candidate)"
          :loading="!candidate.blocked && actionState?.phase === 'loading'"
          @click="perform(candidate)"
        >{{ candidate.label }}</SgjButton>
        <p v-if="candidate.blocked" role="status">
          BLOCKED_BY_CONTRACT：缺少人员目录搜索、分页、data-scope 与在岗最小投影，不发射动作。
        </p>
        <p v-else-if="validationMessage(candidate)" role="status">{{ validationMessage(candidate) }}</p>
      </div>
    </div>
  </SgjCard>
</template>

<style scoped>.p006-actions{display:flex;flex-wrap:wrap;gap:var(--sgj-space-3)}</style>
