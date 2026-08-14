<script setup lang="ts">
interface DescriptionItem {
  key: string
  label: string
  value?: string | number | null
  masked?: boolean
}

defineProps<{ items: DescriptionItem[] }>()

function visibleValue(item: DescriptionItem): string | number {
  if (item.masked) return '已脱敏'
  if (item.value === null || item.value === undefined) return '—'
  if (typeof item.value === 'string' && item.value.trim() === '') return '—'
  return item.value
}
</script>

<template>
  <dl class="sgj-description-list">
    <div v-for="item in items" :key="item.key">
      <dt>{{ item.label }}</dt>
      <dd>{{ visibleValue(item) }}</dd>
    </div>
  </dl>
</template>
