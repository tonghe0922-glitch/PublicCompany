<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { SgjButton, SgjCard, SgjCheckbox, SgjDateTime, SgjError, SgjInput, SgjTextarea } from '@sgj/ui'
import { ApiErrorNotice, type AsyncState, type UiError } from '@sgj/platform-ui'
import { classifyP009Error, type P009CreateOvertimeInput, type P009OvertimeRecord } from './contracts'

const props = withDefaults(defineProps<{ allowed: boolean; busy: boolean; creationState?: AsyncState<P009OvertimeRecord> }>(), { creationState: undefined })
const emit = defineEmits<{ submit: [input: P009CreateOvertimeInput]; retry: [] }>()
const businessDate = ref('')
const subject = ref('')
const reason = ref('')
const attendanceType = ref('')
const emergency = ref(false)
const startAt = ref('')
const endAt = ref('')
const emergencyEvidence = ref('')
const formRevision = ref(0)
const validationErrorRevision = ref<number>()
const errorMode = computed(() => classifyP009Error(props.creationState?.error))
const projectedError = computed<UiError | undefined>(() => {
  const error = props.creationState?.error
  if (!error || errorMode.value !== 'opaque') return error
  return { kind: 'unknown', status: error.status, title: '无法确认错误类型', userMessage: '后端状态与错误类型矛盾，已停止普通创建。', nextAction: '刷新服务端事实' }
})
const validTimes = computed(() => {
  const start = Date.parse(startAt.value)
  const end = Date.parse(endAt.value)
  return Number.isFinite(start) && Number.isFinite(end) && end > start
})
const isValid = computed(() => businessDate.value.length > 0 && subject.value.trim().length >= 5
  && reason.value.trim().length >= 10 && attendanceType.value.trim().length > 0 && validTimes.value
  && (!emergency.value || emergencyEvidence.value.trim().length > 0))
watch([businessDate, subject, reason, attendanceType, emergency, startAt, endAt, emergencyEvidence], () => { formRevision.value += 1 })
watch(
  () => props.creationState,
  state => { validationErrorRevision.value = state?.phase === 'error' && classifyP009Error(state.error) === 'validation' ? formRevision.value : undefined },
  { immediate: true },
)
const canSubmit = computed(() => {
  if (!props.allowed || props.busy || !isValid.value) return false
  if (props.creationState?.phase !== 'error') return true
  return errorMode.value === 'validation' && validationErrorRevision.value !== undefined && formRevision.value > validationErrorRevision.value
})

function submit(): void {
  if (!canSubmit.value) return
  emit('submit', {
    businessDate: businessDate.value,
    subject: subject.value.trim(),
    reason: reason.value.trim(),
    attendanceType: attendanceType.value.trim(),
    emergency: emergency.value,
    startAt: new Date(startAt.value).toISOString(),
    endAt: new Date(endAt.value).toISOString(),
    emergencyEvidence: emergency.value ? { note: emergencyEvidence.value.trim(), recordedAt: new Date().toISOString() } : null,
  })
}
</script>

<template>
  <SgjCard as="section">
    <template #header><strong>加班申请</strong></template>
    <p v-if="!allowed" role="status">当前身份无创建候选权限；最终以后端裁决为准。</p>
    <div v-if="creationState?.phase === 'error' && projectedError" data-create-error>
      <ApiErrorNotice v-if="errorMode === 'retryable'" :error="projectedError" @retry="emit('retry')" />
      <SgjError v-else :title="projectedError.title" :description="projectedError.userMessage" :error-code="projectedError.code" :trace-id="projectedError.requestId" />
    </div>
    <div class="p009-form-grid">
      <div data-field="business-date"><SgjDateTime v-model="businessDate" label="业务日期" required /></div>
      <div data-field="subject"><SgjInput v-model="subject" label="加班主题" required /></div>
      <div data-field="attendance-type"><SgjInput v-model="attendanceType" label="考勤类型" required /></div>
      <div data-field="start-at"><SgjDateTime v-model="startAt" label="开始时间" mode="datetime" required /></div>
      <div data-field="end-at"><SgjDateTime v-model="endAt" label="结束时间" mode="datetime" required /></div>
      <div data-field="emergency"><SgjCheckbox v-model="emergency" label="紧急加班" /></div>
      <div data-field="reason"><SgjTextarea v-model="reason" label="加班原因" required /></div>
      <div v-if="emergency" data-field="emergency-evidence"><SgjTextarea v-model="emergencyEvidence" label="紧急事实证据摘要" required /></div>
    </div>
    <template #footer>
      <SgjButton data-submit-create :disabled="!canSubmit" :loading="busy" @click="submit">提交加班</SgjButton>
    </template>
  </SgjCard>
</template>

<style scoped>.p009-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--sgj-space-4)}@media(max-width:48rem){.p009-form-grid{grid-template-columns:1fr}}</style>
