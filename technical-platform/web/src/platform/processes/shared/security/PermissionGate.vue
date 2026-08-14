<script setup lang="ts">
withDefaults(defineProps<{
  allowed: boolean
  denialReason?: string
  mode?: 'hide' | 'disable' | 'explain'
}>(), {
  denialReason: '当前身份无此操作权限',
  mode: 'hide',
})
defineEmits<{ denied: [] }>()
</script>

<template>
  <slot v-if="allowed" />
  <div
    v-else-if="mode === 'disable'"
    data-permission-gate
    aria-disabled="true"
    :title="denialReason"
    @click.capture.prevent.stop="$emit('denied')"
  >
    <slot />
  </div>
  <p v-else-if="mode === 'explain'" data-permission-gate role="note">{{ denialReason }}</p>
</template>
