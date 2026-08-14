<script setup lang="ts">
import { computed } from 'vue'
import { usePortalSessionStore } from '../../session'
import type { PortalDefinition } from '../portal-config'
import P008LeavePage from './P008LeavePage.vue'
import P009OvertimePage from './P009OvertimePage.vue'

defineProps<{ portal:PortalDefinition }>()
const session=usePortalSessionStore()
const p008=computed(()=>session.can('p008.leave.monitor'))
const p009=computed(()=>session.can('p009.overtime.monitor'))
</script>

<template><section data-testid="phase10-attendance-monitor"><P008LeavePage v-if="p008" :portal="portal" mode="tech"/><P009OvertimePage v-if="p009" :portal="portal" mode="tech"/><p v-if="!p008&&!p009">当前身份没有 P008/P009 考勤流程监控权限。</p></section></template>
