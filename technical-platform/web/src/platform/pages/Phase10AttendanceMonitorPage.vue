<script setup lang="ts">
import { AttendanceWorkflowMonitorFeature } from '@sgj/platform-ui'

import type { PortalDefinition } from '../portal-config'

defineProps<{ portal: PortalDefinition }>()
</script>

<template>
  <section data-testid="phase10-attendance-monitor">
    <AttendanceWorkflowMonitorFeature :portal="portal" />
  </section>
</template>
