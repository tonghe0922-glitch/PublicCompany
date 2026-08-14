<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { SgjButton, SgjCard, SgjDateTime, SgjError, SgjInput, SgjTextarea } from '@sgj/ui'
import { ApiErrorNotice, type AsyncState, type UiError } from '@sgj/platform-ui'
import { classifyP008Error, type P008CreateLeaveInput, type P008LeaveRecord } from './contracts'

const props = withDefaults(defineProps<{ allowed: boolean; busy: boolean; creationState?: AsyncState<P008LeaveRecord> }>(), { creationState: undefined })
const emit = defineEmits<{ submit: [input: P008CreateLeaveInput]; retry: [] }>()
const businessDate = ref('')
const subject = ref('')
const reason = ref('')
const attendanceType = ref('')
const quotaAccountId = ref('')
const startAt = ref('')
const endAt = ref('')
const formRevision = ref(0)
const validationErrorRevision = ref<number>()
const errorMode = computed(() => classifyP008Error(props.creationState?.error))
const projectedError = computed<UiError | undefined>(() => {
  const error = props.creationState?.error
  if (!error || errorMode.value !== 'opaque') return error
  return { kind: 'unknown', status: error.status, title: '无法确认错误类型', userMessage: '后端状态与错误类型矛盾，已停止普通创建。', nextAction: '刷新服务端事实' }
})
const isValid = computed(() => {
  const start = Date.parse(startAt.value)
  const end = Date.parse(endAt.value)
  return businessDate.value.length > 0 && subject.value.trim().length >= 5 && reason.value.trim().length >= 10
    && attendanceType.value.trim().length > 0 && quotaAccountId.value.trim().length > 0
    && Number.isFinite(start) && Number.isFinite(end) && end > start
})
watch([businessDate, subject, reason, attendanceType, quotaAccountId, startAt, endAt], () => { formRevision.value += 1 })
watch(
  () => props.creationState,
  state => { validationErrorRevision.value = state?.phase === 'error' && classifyP008Error(state.error) === 'validation' ? formRevision.value : undefined },
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
    businessDate: businessDate.value, subject: subject.value.trim(), reason: reason.value.trim(),
    attendanceType: attendanceType.value.trim(), quotaAccountId: quotaAccountId.value.trim(), handoverAgentId: null,
    startAt: new Date(startAt.value).toISOString(), endAt: new Date(endAt.value).toISOString(),
  })
}
</script>

<template>
  <SgjCard as="section">
    <template #header><strong>请假申请</strong></template>
    <p v-if="!allowed" role="status">当前身份无创建候选权限；最终以后端裁决为准。</p>
    <div v-if="creationState?.phase === 'error' && projectedError" data-create-error>
      <ApiErrorNotice v-if="errorMode === 'retryable'" :error="projectedError" @retry="emit('retry')" />
      <SgjError v-else :title="projectedError.title" :description="projectedError.userMessage" :error-code="projectedError.code" :trace-id="projectedError.requestId" />
    </div>
    <div class="p008-form-grid">
      <div data-field="business-date"><SgjDateTime v-model="businessDate" label="业务日期" required /></div>
      <div data-field="subject"><SgjInput v-model="subject" label="请假主题" required /></div>
      <div data-field="attendance-type"><SgjInput v-model="attendanceType" label="假勤类型" required /></div>
      <div data-field="quota-account"><SgjInput v-model="quotaAccountId" label="额度账户" required /></div>
      <div data-field="start-at"><SgjDateTime v-model="startAt" label="开始时间" mode="datetime" required /></div>
      <div data-field="end-at"><SgjDateTime v-model="endAt" label="结束时间" mode="datetime" required /></div>
      <div data-field="reason"><SgjTextarea v-model="reason" label="请假原因" required /></div>
    </div>
    <p data-handover-directory-blocked role="status">BLOCKED_BY_CONTRACT：缺少代理人员目录搜索、分页、data-scope 与在岗最小投影；不接受 UUID、静态选项或缓存真值。</p>
    <template #footer>
      <SgjButton data-handover-blocked disabled>代理选择等待目录合同</SgjButton>
      <SgjButton data-submit-create :disabled="!canSubmit" :loading="busy" @click="submit">提交请假</SgjButton>
    </template>
  </SgjCard>
</template>

<style scoped>.p008-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--sgj-space-4)}@media(max-width:48rem){.p008-form-grid{grid-template-columns:1fr}}</style>
