<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { SgjButton, SgjCard, SgjDateTime, SgjError, SgjInput, SgjSelect, SgjTextarea } from '@sgj/ui'
import { ApiErrorNotice, type AsyncState, type UiError } from '@sgj/platform-ui'

import { classifyP006CreationError, type P006CreateMeetingInput, type P006MeetingRecord } from './contracts'

const props = withDefaults(defineProps<{
  allowed: boolean
  busy: boolean
  creationState?: AsyncState<P006MeetingRecord>
}>(), { creationState: undefined })
const emit = defineEmits<{ submit: [input: P006CreateMeetingInput]; retry: [] }>()

const subject = ref('')
const reason = ref('')
const officialSubject = ref('')
const officialContent = ref('')
const businessDate = ref(new Date().toISOString().slice(0, 10))
const startAt = ref('')
const priority = ref('普通')
const visibilityLevel = ref('内部')
const venueChannel = ref('')
const formRevision = ref(0)
const validationErrorRevision = ref<number>()
const creationErrorMode = computed(() => classifyP006CreationError(props.creationState?.error))
const projectedError = computed<UiError | undefined>(() => {
  const error = props.creationState?.error
  if (!error) return undefined
  if (creationErrorMode.value !== 'opaque') return error
  return {
    kind: 'unknown',
    status: error.status,
    title: '无法确认错误类型',
    userMessage: '后端错误代码与类型矛盾，已停止普通创建，请刷新事实后再处理。',
    nextAction: '重试待定创建',
  }
})
watch(
  [subject, reason, officialSubject, officialContent, businessDate, startAt, priority, visibilityLevel, venueChannel],
  () => { formRevision.value += 1 },
)
watch(
  () => props.creationState,
  (state) => {
    validationErrorRevision.value = state?.phase === 'error' && classifyP006CreationError(state.error) === 'validation'
      ? formRevision.value
      : undefined
  },
  { immediate: true },
)
const isValid = computed(() => {
  const start = Date.parse(startAt.value)
  return subject.value.trim().length >= 5 && subject.value.trim().length <= 120
    && reason.value.trim().length >= 10
    && officialSubject.value.trim().length > 0 && officialSubject.value.trim().length <= 200
    && officialContent.value.trim().length > 0 && officialContent.value.trim().length <= 20000
    && businessDate.value.length > 0 && Number.isFinite(start) && start > Date.now()
})
const canSubmit = computed(() => {
  if (!props.allowed || props.busy || !isValid.value) return false
  if (props.creationState?.phase !== 'error') return true
  return creationErrorMode.value === 'validation'
    && validationErrorRevision.value !== undefined
    && formRevision.value > validationErrorRevision.value
})

function submit(): void {
  if (!canSubmit.value) return
  emit('submit', {
    businessDate: businessDate.value,
    subject: subject.value.trim(),
    reason: reason.value.trim(),
    priority: priority.value,
    startAt: new Date(startAt.value).toISOString(),
    officialSubject: officialSubject.value.trim(),
    officialContent: officialContent.value.trim(),
    venueChannel: venueChannel.value.trim() || null,
    visibilityLevel: visibilityLevel.value,
  })
}
</script>

<template>
  <SgjCard as="section">
    <template #header><strong>登记会议议题</strong></template>
    <p v-if="!allowed" role="status">当前身份无创建权限；最终以后端裁决为准。</p>
    <p v-else-if="!isValid" role="status">请完整填写会议必填字段，并选择有效的未来开始时间。</p>
    <div v-if="creationState?.phase === 'error' && projectedError" data-create-error>
      <ApiErrorNotice
        v-if="creationErrorMode === 'retryable'"
        :error="projectedError"
        @retry="emit('retry')"
      />
      <SgjError
        v-else
        :title="projectedError.title"
        :description="projectedError.userMessage"
        :error-code="projectedError.code"
        :trace-id="projectedError.requestId"
      />
    </div>
    <div class="p006-form-grid">
      <div data-field="subject"><SgjInput v-model="subject" label="会议主题" required /></div>
      <div data-field="official-subject"><SgjInput v-model="officialSubject" label="正式标题" required /></div>
      <div data-field="business-date"><SgjDateTime v-model="businessDate" label="业务日期" required /></div>
      <div data-field="start-at"><SgjDateTime v-model="startAt" label="开始时间" mode="datetime" required /></div>
      <SgjSelect v-model="priority" label="优先级" :options="[{ value: '普通', label: '普通' }, { value: '加急', label: '加急' }, { value: '紧急', label: '紧急' }]" />
      <SgjSelect v-model="visibilityLevel" label="可见范围" :options="[{ value: '公开', label: '公开' }, { value: '内部', label: '内部' }, { value: '秘密', label: '秘密' }, { value: '机密', label: '机密' }]" />
      <SgjInput v-model="venueChannel" label="地点/渠道" />
      <div data-field="reason"><SgjTextarea v-model="reason" label="登记原因" required /></div>
      <div data-field="official-content"><SgjTextarea v-model="officialContent" label="议题正文" required /></div>
    </div>
    <template #footer>
      <SgjButton data-submit-create :disabled="!canSubmit" :loading="busy" @click="submit">保存议题</SgjButton>
    </template>
  </SgjCard>
</template>

<style scoped>
.p006-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--sgj-space-4)}
@media(max-width:48rem){.p006-form-grid{grid-template-columns:1fr}}
</style>
