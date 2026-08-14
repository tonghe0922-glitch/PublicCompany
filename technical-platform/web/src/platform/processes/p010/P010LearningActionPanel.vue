<script setup lang="ts">
import { computed, ref } from 'vue'
import { SgjButton, SgjCard, SgjDateTime, SgjError, SgjInput, SgjTextarea } from '@sgj/ui'
import { ApiErrorNotice, type AsyncState, type UiError } from '@sgj/platform-ui'
import {
  classifyP010Error,
  type P010ActionCandidate,
  type P010ActionCode,
  type P010ActionCommand,
  type P010LearningRecord,
} from './contracts'

const props = withDefaults(defineProps<{
  learning: P010LearningRecord
  candidates: readonly P010ActionCandidate[]
  busy: boolean
  actionState?: AsyncState<P010LearningRecord>
}>(), { actionState: undefined })
const emit = defineEmits<{ action: [code: P010ActionCode, command: P010ActionCommand]; retry: [] }>()
const score1000 = ref('')
const practicalResult = ref('')
const effectiveDate = ref('')
const expireDate = ref('')
const recertificationDate = ref('')
const resultSummary = ref('')
const evidence = ref('')
const errorMode = computed(() => classifyP010Error(props.actionState?.error))
const projectedError = computed<UiError | undefined>(() => {
  const error = props.actionState?.error
  if (!error || errorMode.value !== 'opaque') return error
  return {
    kind: 'unknown', status: error.status, title: '无法确认错误类型',
    userMessage: '后端状态与错误类型矛盾，已停止普通动作。', nextAction: '刷新服务端事实',
  }
})
const blockedByState = computed(() => props.busy || props.actionState?.phase === 'loading' || props.actionState?.phase === 'error')
function blank(value: string): boolean { return value.trim().length === 0 }
function validDate(value: string): boolean { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) }
function scoreMessage(code: P010ActionCode): string | undefined {
  if (code !== 'SUBMIT_EXAM') return undefined
  const score = Number(score1000.value)
  return Number.isInteger(score) && score >= 0 && score <= 1000 ? undefined : '请填写 0 至 1000 的整数成绩。'
}
function practicalMessage(code: P010ActionCode): string | undefined {
  return code === 'RECORD_PRACTICAL' && blank(practicalResult.value) ? '请填写线下实操结果。' : undefined
}
function activationMessage(code: P010ActionCode): string | undefined {
  if (code !== 'ACTIVATE') return undefined
  if (!validDate(effectiveDate.value) || !validDate(expireDate.value)) return '请填写有效的资格生效与到期日期。'
  return expireDate.value < effectiveDate.value ? '资格到期日不得早于生效日。' : undefined
}
function recertificationMessage(code: P010ActionCode): string | undefined {
  return code === 'SCHEDULE_RECERTIFICATION' && !validDate(recertificationDate.value) ? '请填写有效的复训日期。' : undefined
}
function validationMessage(code: P010ActionCode): string | undefined {
  return [scoreMessage(code), practicalMessage(code), activationMessage(code), recertificationMessage(code),
    blank(evidence.value) ? '请填写不可变证据摘要。' : undefined].find(message => message !== undefined)
}
function isBlocked(candidate: P010ActionCandidate): boolean {
  return blockedByState.value || validationMessage(candidate.code) !== undefined
}
function commandFor(code: P010ActionCode): P010ActionCommand {
  return {
    expectedVersion: props.learning.versionNo,
    score1000: code === 'SUBMIT_EXAM' ? Number(score1000.value) : null,
    practicalResult: code === 'RECORD_PRACTICAL' ? practicalResult.value.trim() : null,
    effectiveDate: code === 'ACTIVATE' ? effectiveDate.value : null,
    expireDate: code === 'ACTIVATE' ? expireDate.value : null,
    recertificationDate: code === 'SCHEDULE_RECERTIFICATION' ? recertificationDate.value : null,
    resultSummary: resultSummary.value.trim() || null,
    evidence: { note: evidence.value.trim(), recordedAt: new Date().toISOString() },
  }
}
function perform(candidate: P010ActionCandidate): void {
  if (isBlocked(candidate)) return
  emit('action', candidate.code, commandFor(candidate.code))
}
</script>

<template>
  <SgjCard as="section" variant="muted">
    <template #header><strong>当前节点操作</strong></template>
    <div data-score-1000><SgjInput v-model="score1000" label="考试成绩（0–1000）" /></div>
    <div data-practical-result><SgjTextarea v-model="practicalResult" label="线下实操结果" /></div>
    <div data-effective-date><SgjDateTime v-model="effectiveDate" label="资格生效日" /></div>
    <div data-expire-date><SgjDateTime v-model="expireDate" label="资格到期日" /></div>
    <div data-recertification-date><SgjDateTime v-model="recertificationDate" label="复训/复证日期" /></div>
    <SgjTextarea v-model="resultSummary" label="结果摘要" />
    <div data-action-evidence><SgjTextarea v-model="evidence" label="不可变证据摘要" /></div>
    <div v-if="actionState?.phase === 'error' && projectedError" data-action-error>
      <ApiErrorNotice v-if="errorMode === 'retryable'" :error="projectedError" @retry="emit('retry')" />
      <SgjError v-else :title="projectedError.title" :description="projectedError.userMessage" :error-code="projectedError.code" :trace-id="projectedError.requestId" />
    </div>
    <div class="p010-actions">
      <div v-for="candidate in candidates" :key="candidate.code">
        <SgjButton :data-action-code="candidate.code" :disabled="isBlocked(candidate)" :loading="actionState?.phase === 'loading'" @click="perform(candidate)">{{ candidate.label }}</SgjButton>
        <p v-if="validationMessage(candidate.code)" role="status">{{ validationMessage(candidate.code) }}</p>
      </div>
    </div>
  </SgjCard>
</template>

<style scoped>.p010-actions{display:flex;flex-wrap:wrap;gap:var(--sgj-space-3)}</style>
