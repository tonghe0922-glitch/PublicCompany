<script setup lang="ts">
import P011PerformanceFeature from '../phase11/p011/P011PerformanceFeature.vue'
import type { PortalDefinition } from '../portal-config'

const props = defineProps<{
  portal: PortalDefinition
  mode: 'employee' | 'center' | 'tech'
}>()
</script>

<template>
  <P011PerformanceFeature v-bind="props" />
</template>
