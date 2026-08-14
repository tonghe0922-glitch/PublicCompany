<script setup lang="ts">
import { SgjButton, SgjError, SgjNoPermission } from '@sgj/ui'
import type { UiError } from './ui-error'

defineProps<{ error: UiError }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <SgjNoPermission
    v-if="error.kind === 'forbidden' || error.kind === 'unauthorized'"
    :title="error.title"
    :description="error.userMessage"
  >
    <template #actions>
      <SgjButton v-if="error.kind !== 'forbidden'" variant="secondary" @click="$emit('retry')">{{ error.nextAction }}</SgjButton>
      <small v-if="error.requestId">请求编号：{{ error.requestId }}</small>
    </template>
  </SgjNoPermission>
  <SgjError
    v-else
    :title="error.title"
    :description="error.userMessage"
    :error-code="error.code"
    :trace-id="error.requestId"
  >
    <template #actions>
      <SgjButton variant="secondary" @click="$emit('retry')">{{ error.nextAction }}</SgjButton>
    </template>
  </SgjError>
</template>
