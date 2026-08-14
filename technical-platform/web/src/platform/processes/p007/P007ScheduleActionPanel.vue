<script setup lang="ts">
import { computed, ref } from 'vue'
import { SgjButton, SgjCard, SgjError, SgjTextarea } from '@sgj/ui'
import { ApiErrorNotice, type AsyncState, type UiError } from '@sgj/platform-ui'

import type { P007ActionCandidate, P007ActionCode, P007ActionCommand, P007ScheduleRecord } from './contracts'

const STATUS_KINDS = {
  401: 'unauthorized', 403: 'forbidden', 404: 'not-found', 408: 'timeout',
  409: 'conflict', 422: 'validation', 429: 'rate-limit',
} as const satisfies Readonly<Record<number, UiError['kind']>>

const props = withDefaults(defineProps<{
  schedule: P007ScheduleRecord
  candidates: readonly P007ActionCandidate[]
  busy: boolean
  actionState?: AsyncState<P007ScheduleRecord>
}>(), { actionState: undefined })
const emit = defineEmits<{ action: [code: P007ActionCode, command: P007ActionCommand]; retry: [] }>()
const reason = ref('')
const resultSummary = ref('')
const actualAttendanceSummary = ref('')
const evidence = ref('')

function isConsistent(error: UiError): boolean {
  if (error.status === undefined) return error.kind === 'transport' || error.kind === 'unknown'
  if (error.status >= 500) return error.kind === 'server'
  return STATUS_KINDS[error.status as keyof typeof STATUS_KINDS] === error.kind
}

const projectedError = computed<UiError | undefined>(() => {
  const error = props.actionState?.error
  if (!error) return undefined
  if (isConsistent(error)) return error
  return {
    kind: 'unknown', status: error.status,
    title: '无法确认错误类型',
    userMessage: '后端错误状态与类型矛盾，已停止普通动作，请刷新服务端事实后再处理。',
    nextAction: '刷新服务端事实',
  }
})
const retryable = computed(() => {
  const error = props.actionState?.error
  if (!error || !isConsistent(error)) return false
  if (error.status === undefined) return error.kind === 'transport' || error.kind === 'unknown'
  return (error.status === 408 && error.kind === 'timeout') || (error.status >= 500 && error.kind === 'server')
})
const blockedByState = computed(() => props.busy || props.actionState?.phase === 'loading' || props.actionState?.phase === 'error')

function validationMessage(candidate: P007ActionCandidate): string | undefined {
  if (candidate.code === 'REQUEST_CHANGE') return 'BLOCKED_BY_CONTRACT：缺少替班人员目录合同，不发射动作。'
  if (['RETURN', 'REJECT'].includes(candidate.code) && !reason.value.trim()) return '请填写退回或驳回原因。'
  if (['CONFIRM', 'REJECT', 'LINK', 'CLOSE_DAY'].includes(candidate.code) && !evidence.value.trim()) return '请填写不可变证据摘要。'
  if (candidate.code === 'CLOSE_DAY' && !actualAttendanceSummary.value.trim()) return '请填写实际考勤摘要。'
  return undefined
}

function isBlocked(candidate: P007ActionCandidate): boolean {
  return candidate.blocked || blockedByState.value || validationMessage(candidate) !== undefined
}

function perform(candidate: P007ActionCandidate): void {
  if (isBlocked(candidate)) return
  const needsEvidence = ['CONFIRM', 'REJECT', 'LINK', 'CLOSE_DAY'].includes(candidate.code)
  emit('action', candidate.code, {
    expectedVersion: props.schedule.versionNo,
    reason: reason.value.trim() || null,
    resultSummary: resultSummary.value.trim() || null,
    actualAttendanceSummary: actualAttendanceSummary.value.trim() || null,
    evidence: needsEvidence ? { note: evidence.value.trim(), recordedAt: new Date().toISOString() } : null,
  })
}
</script>

<template>
  <SgjCard as="section" variant="muted">
    <template #header><strong>当前节点操作</strong></template>
    <div data-action-reason><SgjTextarea v-model="reason" label="处理、退回或驳回原因" /></div>
    <SgjTextarea v-model="resultSummary" label="结果摘要" />
    <div data-action-attendance><SgjTextarea v-model="actualAttendanceSummary" label="实际考勤摘要" /></div>
    <div data-action-evidence><SgjTextarea v-model="evidence" label="不可变证据摘要" /></div>
    <div v-if="actionState?.phase === 'error' && projectedError" data-action-error>
      <ApiErrorNotice v-if="retryable" :error="projectedError" @retry="emit('retry')" />
      <SgjError
        v-else
        :title="projectedError.title"
        :description="projectedError.userMessage"
        :error-code="projectedError.code"
        :trace-id="projectedError.requestId"
      />
    </div>
    <div class="p007-actions">
      <div v-for="candidate in candidates" :key="candidate.code">
        <SgjButton
          :data-action-code="candidate.code"
          :disabled="isBlocked(candidate)"
          :loading="!candidate.blocked && actionState?.phase === 'loading'"
          @click="perform(candidate)"
        >{{ candidate.label }}</SgjButton>
        <p v-if="validationMessage(candidate)" role="status">{{ validationMessage(candidate) }}</p>
      </div>
    </div>
  </SgjCard>
</template>

<style scoped>
.p007-actions{display:flex;flex-wrap:wrap;gap:var(--sgj-space-3)}
</style>
