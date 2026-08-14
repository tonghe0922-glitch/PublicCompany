<script setup lang="ts">
import { computed, ref } from 'vue'
import { SgjButton, SgjCard, SgjDateTime, SgjError, SgjInput, SgjSelect, SgjTextarea } from '@sgj/ui'
import { ApiErrorNotice, type AsyncState, type UiError } from '@sgj/platform-ui'
import { classifyP009Error, type P009ActionCandidate, type P009ActionCode, type P009ActionCommand, type P009OvertimeRecord } from './contracts'

const props = withDefaults(defineProps<{ overtime: P009OvertimeRecord; candidates: readonly P009ActionCandidate[]; busy: boolean; actionState?: AsyncState<P009OvertimeRecord> }>(), { actionState: undefined })
const emit = defineEmits<{ action: [code: P009ActionCode, command: P009ActionCommand]; retry: [] }>()
const reason = ref('')
const resultSummary = ref('')
const actualAttendanceSummary = ref('')
const actualStartAt = ref('')
const actualEndAt = ref('')
const schemeType = ref('')
const externalReference = ref('')
const externalAmount = ref('')
const evidence = ref('')
const REASON_ACTIONS = new Set<P009ActionCode>(['RETURN', 'REJECT', 'REWORK', 'HR_RETURN'])
const RESULT_ACTIONS = new Set<P009ActionCode>(['ACCEPT_RESULT', 'REWORK'])
const EVIDENCE_ACTIONS = new Set<P009ActionCode>(['RECORD_FACT', 'HR_CONFIRM', 'HR_RETURN', 'CONFIRM_SCHEME', 'RECORD_RECEIPT', 'ARCHIVE'])
const errorMode = computed(() => classifyP009Error(props.actionState?.error))
const projectedError = computed<UiError | undefined>(() => {
  const error = props.actionState?.error
  if (!error || errorMode.value !== 'opaque') return error
  return { kind: 'unknown', status: error.status, title: '无法确认错误类型', userMessage: '后端状态与错误类型矛盾，已停止普通动作。', nextAction: '刷新服务端事实' }
})
const blockedByState = computed(() => props.busy || props.actionState?.phase === 'loading' || props.actionState?.phase === 'error')
function blank(value: string): boolean { return value.trim().length === 0 }
function validDate(value: string): boolean { return Number.isFinite(Date.parse(value)) }
function validAmount(value: string): boolean { const amount = Number(value);return value.trim().length > 0 && Number.isFinite(amount) && amount >= 0 }
function reasonMessage(code: P009ActionCode): string | undefined {
  return REASON_ACTIONS.has(code) && blank(reason.value) ? '请填写处理原因。' : undefined
}
function resultMessage(code: P009ActionCode): string | undefined {
  return RESULT_ACTIONS.has(code) && blank(resultSummary.value) ? '请填写结果摘要。' : undefined
}
function recordFactMessage(code: P009ActionCode): string | undefined {
  if (code !== 'RECORD_FACT') return undefined
  return validDate(actualStartAt.value) && validDate(actualEndAt.value) && !blank(actualAttendanceSummary.value)
    ? undefined : '请填写有效的实际起止时间与考勤摘要。'
}
function schemeMessage(code: P009ActionCode): string | undefined {
  return code === 'HR_CONFIRM' && !['PAYROLL', 'TIME_OFF'].includes(schemeType.value) ? '请选择有效的补偿方案。' : undefined
}
function receiptMessage(code: P009ActionCode): string | undefined {
  if (code !== 'RECORD_RECEIPT') return undefined
  if (blank(externalReference.value)) return '请填写外部回执引用。'
  return props.overtime.schemeType === 'PAYROLL' && !validAmount(externalAmount.value) ? '请填写有效的外部确定金额。' : undefined
}
function evidenceMessage(code: P009ActionCode): string | undefined {
  return EVIDENCE_ACTIONS.has(code) && blank(evidence.value) ? '请填写不可变证据摘要。' : undefined
}
function validationMessage(code: P009ActionCode): string | undefined {
  return [reasonMessage(code), resultMessage(code), recordFactMessage(code), schemeMessage(code), receiptMessage(code), evidenceMessage(code)]
    .find(message => message !== undefined)
}
function isBlocked(candidate: P009ActionCandidate): boolean { return blockedByState.value || validationMessage(candidate.code) !== undefined }
function toIso(value: string): string | null { return validDate(value) ? new Date(value).toISOString() : null }
function externalAmountFor(code: P009ActionCode): number | null {
  return code === 'RECORD_RECEIPT' && externalAmount.value.trim() ? Number(externalAmount.value) : null
}
function commandFor(code: P009ActionCode): P009ActionCommand {
  return {
    expectedVersion: props.overtime.versionNo,
    reason: REASON_ACTIONS.has(code) ? reason.value.trim() : null,
    resultSummary: RESULT_ACTIONS.has(code) ? resultSummary.value.trim() : null,
    actualAttendanceSummary: code === 'RECORD_FACT' ? actualAttendanceSummary.value.trim() : null,
    actualStartAt: code === 'RECORD_FACT' ? toIso(actualStartAt.value) : null,
    actualEndAt: code === 'RECORD_FACT' ? toIso(actualEndAt.value) : null,
    schemeType: code === 'HR_CONFIRM' ? schemeType.value : null,
    externalReference: code === 'RECORD_RECEIPT' ? externalReference.value.trim() : null,
    externallyDeterminedAmount: externalAmountFor(code),
    evidence: EVIDENCE_ACTIONS.has(code) ? { note: evidence.value.trim(), recordedAt: new Date().toISOString() } : null,
  }
}
function perform(candidate: P009ActionCandidate): void {
  if (isBlocked(candidate)) return
  emit('action', candidate.code, commandFor(candidate.code))
}
</script>

<template>
  <SgjCard as="section" variant="muted">
    <template #header><strong>当前节点操作</strong></template>
    <div data-action-reason><SgjTextarea v-model="reason" label="处理、退回或驳回原因" /></div>
    <SgjTextarea v-model="resultSummary" label="结果摘要" />
    <div data-actual-start-at><SgjDateTime v-model="actualStartAt" label="实际开始时间" mode="datetime" /></div>
    <div data-actual-end-at><SgjDateTime v-model="actualEndAt" label="实际结束时间" mode="datetime" /></div>
    <div data-actual-attendance-summary><SgjTextarea v-model="actualAttendanceSummary" label="实际考勤摘要" /></div>
    <SgjSelect v-model="schemeType" label="补偿方案" :options="[{ label: '薪酬补偿', value: 'PAYROLL' }, { label: '调休补偿', value: 'TIME_OFF' }]" />
    <div data-external-reference><SgjInput v-model="externalReference" label="外部回执引用" /></div>
    <div data-external-amount><SgjInput v-model="externalAmount" label="外部确定金额" /></div>
    <div data-action-evidence><SgjTextarea v-model="evidence" label="不可变证据摘要" /></div>
    <div v-if="actionState?.phase === 'error' && projectedError" data-action-error>
      <ApiErrorNotice v-if="errorMode === 'retryable'" :error="projectedError" @retry="emit('retry')" />
      <SgjError v-else :title="projectedError.title" :description="projectedError.userMessage" :error-code="projectedError.code" :trace-id="projectedError.requestId" />
    </div>
    <div class="p009-actions">
      <div v-for="candidate in candidates" :key="candidate.code">
        <SgjButton :data-action-code="candidate.code" :disabled="isBlocked(candidate)" :loading="actionState?.phase === 'loading'" @click="perform(candidate)">{{ candidate.label }}</SgjButton>
        <p v-if="validationMessage(candidate.code)" role="status">{{ validationMessage(candidate.code) }}</p>
      </div>
    </div>
  </SgjCard>
</template>

<style scoped>.p009-actions{display:flex;flex-wrap:wrap;gap:var(--sgj-space-3)}</style>
