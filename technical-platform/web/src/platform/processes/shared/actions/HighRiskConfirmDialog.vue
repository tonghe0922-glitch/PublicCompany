<script setup lang="ts">
import { computed } from 'vue'
import { SgjButton, SgjDialog, SgjTextarea } from '@sgj/ui'

const props = withDefaults(defineProps<{
  open: boolean
  actionName: string
  subject: string
  consequence: string
  reason: string
  stepUpSatisfied: boolean
  stepUpReference?: string
  loading?: boolean
}>(), { stepUpReference: undefined, loading: false })

const emit = defineEmits<{
  'update:reason': [value: string]
  confirm: [payload: { reason: string; stepUpReference?: string }]
  cancel: []
}>()
const canConfirm = computed(() => props.reason.trim().length > 0 && props.stepUpSatisfied && !props.loading)

function confirm(): void {
  if (!canConfirm.value) return
  emit('confirm', { reason: props.reason.trim(), stepUpReference: props.stepUpReference })
}
</script>

<template>
  <SgjDialog :open="open" :title="actionName" :description="consequence" :close-on-backdrop="!loading" @close="emit('cancel')">
    <p>业务对象：{{ subject }}</p>
    <SgjTextarea label="操作原因" :model-value="reason" required :disabled="loading" @update:model-value="emit('update:reason', $event)" />
    <p v-if="!stepUpSatisfied" role="status">需要先完成权威二次验证。此处不采集密码、验证码或令牌。</p>
    <p v-else role="status">权威二次验证已完成。</p>
    <template #footer>
      <SgjButton data-action="cancel" variant="secondary" :disabled="loading" @click="emit('cancel')">取消</SgjButton>
      <SgjButton data-action="confirm" variant="danger" :loading="loading" :disabled="!canConfirm" @click="confirm">确认高风险操作</SgjButton>
    </template>
  </SgjDialog>
</template>
