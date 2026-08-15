<script setup lang="ts">
import Phase11DisciplineCareSupervisionFeature from '../phase11/shared/Phase11DisciplineCareSupervisionFeature.vue'
import type { PortalDefinition } from '../portal-config'

defineProps<{ portal: PortalDefinition }>()
</script>

<template>
  <Phase11DisciplineCareSupervisionFeature :portal="portal" />
</template>
