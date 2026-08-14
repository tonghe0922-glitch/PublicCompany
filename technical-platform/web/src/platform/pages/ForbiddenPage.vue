<script setup lang="ts">
import type { PortalDefinition } from '../portal-config'
import { SgjNoPermission } from '../../design-system'

defineProps<{ portal: PortalDefinition }>()
</script>

<template>
  <section class="forbidden-page" :aria-label="`${portal.title}无权限`">
    <SgjNoPermission description="当前身份没有访问此页面的权限。权限结果以服务端裁决为准。" />
  </section>
</template>
