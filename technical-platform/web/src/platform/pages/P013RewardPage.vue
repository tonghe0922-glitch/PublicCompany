<script setup lang="ts">
import P013RewardFeature from '../phase11/p013/P013RewardFeature.vue'
import type { PortalDefinition } from '../portal-config'

const props = defineProps<{
  portal: PortalDefinition
  mode: 'employee' | 'center' | 'tech'
}>()
</script>

<template>
  <P013RewardFeature v-bind="props" />
</template>
