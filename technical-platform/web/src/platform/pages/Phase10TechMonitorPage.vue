<script setup lang="ts">
import { PhaseWorkflowMonitorFeature } from '@sgj/platform-ui'

import type { PortalDefinition } from '../portal-config'
import { useMonitorProjection } from '../processes/shared/monitoring'

defineProps<{ portal: PortalDefinition }>()
const monitor = useMonitorProjection()
</script>

<template>
  <PhaseWorkflowMonitorFeature :portal="portal" :monitor="monitor" />
</template>
