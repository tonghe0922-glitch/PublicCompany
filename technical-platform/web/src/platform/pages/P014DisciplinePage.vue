<script setup lang="ts">
import P014DisciplineFeature from '../phase11/p014/P014DisciplineFeature.vue'
import type { PortalDefinition } from '../portal-config'

const props = defineProps<{
  portal: PortalDefinition
  mode: 'employee' | 'center' | 'tech'
}>()
</script>

<template>
  <P014DisciplineFeature v-bind="props" />
</template>
