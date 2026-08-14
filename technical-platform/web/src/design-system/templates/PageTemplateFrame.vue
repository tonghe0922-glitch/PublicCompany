<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description?: string
  eyebrow?: string
  headingLevel?: 1 | 2 | 3
}>(), {
  description: undefined,
  eyebrow: undefined,
  headingLevel: 2,
})
</script>

<template>
  <section class="sgj-page-template">
    <header class="sgj-page-template__header">
      <div>
        <p v-if="eyebrow" class="sgj-page-template__eyebrow">{{ eyebrow }}</p>
        <h1 v-if="headingLevel === 1" class="sgj-page-template__title">{{ title }}</h1>
        <h2 v-else-if="headingLevel === 2" class="sgj-page-template__title">{{ title }}</h2>
        <h3 v-else class="sgj-page-template__title">{{ title }}</h3>
        <p v-if="description" class="sgj-page-template__description">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="sgj-page-template__actions"><slot name="actions" /></div>
    </header>
    <slot />
  </section>
</template>
