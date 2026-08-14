<script setup lang="ts">
import { computed, ref } from 'vue'
import { SgjButton, SgjCard, SgjDateTime, SgjError, SgjTextarea } from '@sgj/ui'
import { ApiErrorNotice, type AsyncState, type UiError } from '@sgj/platform-ui'
import { classifyP008Error, type P008ActionCandidate, type P008ActionCode, type P008ActionCommand, type P008LeaveRecord } from './contracts'

const props = withDefaults(defineProps<{ leave: P008LeaveRecord; candidates: readonly P008ActionCandidate[]; busy: boolean; actionState?: AsyncState<P008LeaveRecord> }>(), { actionState: undefined })
const emit = defineEmits<{ action: [code: P008ActionCode, command: P008ActionCommand]; retry: [] }>()
const reason = ref('')
const resultSummary = ref('')
const actualAttendanceSummary = ref('')
const actualEndAt = ref('')
const handoverItems = ref('')
const evidence = ref('')
const REASON_ACTIONS = new Set<P008ActionCode>(['RETURN', 'REJECT'])
const EVIDENCE_ACTIONS = new Set<P008ActionCode>(['MARK_ATTENDANCE', 'START_LEAVE', 'EARLY_RETURN', 'CHANGE', 'CLOSE_DAY'])
const END_ACTIONS = new Set<P008ActionCode>(['EARLY_RETURN', 'CHANGE'])
const errorMode = computed(() => classifyP008Error(props.actionState?.error))
const projectedError = computed<UiError | undefined>(() => {
  const error = props.actionState?.error
  if (!error || errorMode.value !== 'opaque') return error
  return { kind: 'unknown', status: error.status, title: '无法确认错误类型', userMessage: '后端状态与错误类型矛盾，已停止普通动作。', nextAction: '刷新服务端事实' }
})
const blockedByState = computed(() => props.busy || props.actionState?.phase === 'loading' || props.actionState?.phase === 'error')
function missingText(required: boolean, value: string, message: string): string | undefined {
  if (!required || value.trim()) return undefined
  return message
}
function missingDate(required: boolean, value: string): string | undefined {
  if (!required || Number.isFinite(Date.parse(value))) return undefined
  return '请选择有效的实际结束时间。'
}
function validationMessage(code: P008ActionCode): string | undefined {
  return [
    missingText(REASON_ACTIONS.has(code), reason.value, '请填写退回或驳回原因。'),
    missingText(code === 'CONFIRM_HANDOVER', handoverItems.value, '请填写交接事项摘要。'),
    missingText(EVIDENCE_ACTIONS.has(code), evidence.value, '请填写不可变证据摘要。'),
    missingText(code === 'CLOSE_DAY', actualAttendanceSummary.value, '请填写实际考勤摘要。'),
    missingDate(END_ACTIONS.has(code), actualEndAt.value),
  ].find(message => message !== undefined)
}
function isBlocked(candidate: P008ActionCandidate): boolean { return blockedByState.value || validationMessage(candidate.code) !== undefined }
function perform(candidate: P008ActionCandidate): void {
  if (isBlocked(candidate)) return
  const needsEvidence = EVIDENCE_ACTIONS.has(candidate.code) || candidate.code === 'REJECT'
  emit('action', candidate.code, {
    expectedVersion: props.leave.versionNo, reason: reason.value.trim() || null, resultSummary: resultSummary.value.trim() || null,
    actualAttendanceSummary: actualAttendanceSummary.value.trim() || null,
    actualEndAt: END_ACTIONS.has(candidate.code) ? new Date(actualEndAt.value).toISOString() : null,
    handoverItems: candidate.code === 'CONFIRM_HANDOVER' ? handoverItems.value.split(/\r?\n/u).map(item => item.trim()).filter(Boolean) : null,
    evidence: needsEvidence ? { note: evidence.value.trim(), recordedAt: new Date().toISOString() } : null,
  })
}
</script>

<template>
  <SgjCard as="section" variant="muted">
    <template #header><strong>当前节点操作</strong></template>
    <div data-action-reason><SgjTextarea v-model="reason" label="处理、退回或驳回原因" /></div>
    <SgjTextarea v-model="resultSummary" label="结果摘要" />
    <SgjTextarea v-model="actualAttendanceSummary" label="实际考勤摘要" />
    <SgjDateTime v-model="actualEndAt" label="实际结束时间" mode="datetime" />
    <SgjTextarea v-model="handoverItems" label="交接事项（每行一项）" />
    <div data-action-evidence><SgjTextarea v-model="evidence" label="不可变证据摘要" /></div>
    <div v-if="actionState?.phase === 'error' && projectedError" data-action-error>
      <ApiErrorNotice v-if="errorMode === 'retryable'" :error="projectedError" @retry="emit('retry')" />
      <SgjError v-else :title="projectedError.title" :description="projectedError.userMessage" :error-code="projectedError.code" :trace-id="projectedError.requestId" />
    </div>
    <div class="p008-actions">
      <div v-for="candidate in candidates" :key="candidate.code">
        <SgjButton :data-action-code="candidate.code" :disabled="isBlocked(candidate)" :loading="actionState?.phase === 'loading'" @click="perform(candidate)">{{ candidate.label }}</SgjButton>
        <p v-if="validationMessage(candidate.code)" role="status">{{ validationMessage(candidate.code) }}</p>
      </div>
    </div>
  </SgjCard>
</template>

<style scoped>.p008-actions{display:flex;flex-wrap:wrap;gap:var(--sgj-space-3)}</style>
