<script setup lang="ts">
import PageTemplateFrame from './PageTemplateFrame.vue'
defineProps<{ title: string; description?: string; headingLevel?: 1 | 2 | 3 }>()
</script>
<template>
  <PageTemplateFrame :title="title" :description="description" :heading-level="headingLevel">
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    <div v-if="$slots.filters" class="sgj-page-template__filters"><slot name="filters" /></div>
    <div class="sgj-page-template__surface"><slot /></div>
    <footer v-if="$slots.pagination" class="sgj-page-template__footer"><slot name="pagination" /></footer>
  </PageTemplateFrame>
</template>
