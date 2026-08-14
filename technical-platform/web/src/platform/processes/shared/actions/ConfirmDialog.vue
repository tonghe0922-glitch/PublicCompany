<script setup lang="ts">
import { SgjButton, SgjDialog } from '@sgj/ui'

withDefaults(defineProps<{
  open: boolean
  actionName: string
  subject: string
  consequence: string
  impact?: string
  loading?: boolean
}>(), { impact: undefined, loading: false })

defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <SgjDialog :open="open" :title="actionName" :description="consequence" :close-on-backdrop="!loading" @close="$emit('cancel')">
    <dl class="sgj-confirm-summary">
      <div><dt>业务对象</dt><dd>{{ subject }}</dd></div>
      <div v-if="impact"><dt>预计影响</dt><dd>{{ impact }}</dd></div>
    </dl>
    <template #footer>
      <SgjButton data-action="cancel" variant="secondary" @click="$emit('cancel')">取消</SgjButton>
      <SgjButton data-action="confirm" :loading="loading" :disabled="loading" @click="$emit('confirm')">确认{{ actionName }}</SgjButton>
    </template>
  </SgjDialog>
</template>
