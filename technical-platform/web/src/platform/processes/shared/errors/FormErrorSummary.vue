<script setup lang="ts">
import { SgjButton, SgjCard } from '@sgj/ui'

export interface FormSummaryError {
  field: string
  label: string
  message: string
  controlId?: string
}

defineProps<{ errors: readonly FormSummaryError[] }>()
defineEmits<{ focusField: [target: { field: string; controlId?: string }] }>()
</script>

<template>
  <SgjCard v-if="errors.length" variant="muted" as="section" role="alert" aria-label="表单错误摘要">
    <template #header><strong>请修正以下字段</strong></template>
    <ul class="sgj-form-error-summary">
      <li v-for="item in errors" :key="item.field">
        <SgjButton
          variant="ghost"
          size="sm"
          :data-field="item.field"
          @click="$emit('focusField', { field: item.field, controlId: item.controlId })"
        >
          {{ item.label }}：{{ item.message }}
        </SgjButton>
      </li>
    </ul>
  </SgjCard>
</template>
