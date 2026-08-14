<script setup lang="ts">
import P015PointLedgerFeature from '../phase11/p015/P015PointLedgerFeature.vue'
import type { PortalDefinition } from '../portal-config'

const props = defineProps<{
  portal: PortalDefinition
  mode: 'employee' | 'center' | 'tech'
}>()
</script>

<template>
  <P015PointLedgerFeature v-bind="props" />
</template>
