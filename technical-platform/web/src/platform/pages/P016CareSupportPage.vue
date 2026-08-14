<script setup lang="ts">
import P016CareSupportFeature from '../phase11/p016/P016CareSupportFeature.vue'
import type { PortalDefinition } from '../portal-config'

const props = defineProps<{
  portal: PortalDefinition
  mode: 'employee' | 'center' | 'tech'
  sharedSupervision?: boolean
}>()
</script>

<template>
  <P016CareSupportFeature v-bind="props" />
</template>
