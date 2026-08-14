<script setup lang="ts">
import P012PromotionFeature from '../phase11/p012/P012PromotionFeature.vue'
import type { PortalDefinition } from '../portal-config'

const props = defineProps<{
  portal: PortalDefinition
  mode: 'employee' | 'center' | 'tech'
}>()
</script>

<template>
  <P012PromotionFeature v-bind="props" />
</template>
