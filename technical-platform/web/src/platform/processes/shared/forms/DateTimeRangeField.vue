<script setup lang="ts">
import { computed } from 'vue'
import { SgjDateTime } from '@sgj/ui'

const props = withDefaults(defineProps<{
  startValue: string
  endValue: string
  startLabel?: string
  endLabel?: string
  required?: boolean
  disabled?: boolean
}>(), { startLabel: '开始时间', endLabel: '结束时间', required: false, disabled: false })

defineEmits<{ 'update:startValue': [value: string]; 'update:endValue': [value: string] }>()
const orderError = computed(() => props.startValue && props.endValue && props.endValue < props.startValue ? '结束时间不得早于开始时间' : undefined)
</script>

<template>
  <div class="sgj-date-time-range" role="group" aria-label="时间范围">
    <SgjDateTime :label="startLabel" mode="datetime" :model-value="startValue" :required="required" :disabled="disabled" @update:model-value="$emit('update:startValue', $event)" />
    <SgjDateTime :label="endLabel" mode="datetime" :model-value="endValue" :required="required" :disabled="disabled" :error="orderError" @update:model-value="$emit('update:endValue', $event)" />
  </div>
</template>
