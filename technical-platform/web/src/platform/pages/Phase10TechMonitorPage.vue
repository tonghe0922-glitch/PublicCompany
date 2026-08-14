<script setup lang="ts">
import { computed, watch } from 'vue'
import { SgjDashboardPageTemplate } from '@sgj/ui'

import { usePortalSessionStore } from '../../session'
import { MonitorPanel, useMonitorProjection } from '../processes/shared/monitoring'
import type { PortalDefinition } from '../portal-config'
import P006MeetingPage from './P006MeetingPage.vue'
import P007SchedulePage from './P007SchedulePage.vue'
import P010LearningPage from './P010LearningPage.vue'
import P011PerformancePage from './P011PerformancePage.vue'
import P012PromotionPage from './P012PromotionPage.vue'
import P013RewardPage from './P013RewardPage.vue'
import P014DisciplinePage from './P014DisciplinePage.vue'

defineProps<{ portal: PortalDefinition }>()

const session = usePortalSessionStore()
const monitor = useMonitorProjection()
const canP004Monitor = computed(() => session.can('p004.request.read'))
const canP005Monitor = computed(() => session.can('p005.notice.monitor'))
const canMonitor = computed(() => canP004Monitor.value || canP005Monitor.value)
const showP006 = computed(() => session.can('p006.meeting.monitor'))
const showP007 = computed(() => session.can('p007.schedule.monitor'))
const showP010 = computed(() => session.can('p010.learning.monitor'))
const showP011 = computed(() => session.can('p011.performance.monitor'))
const showP012 = computed(() => session.can('p012.promotion.monitor'))
const showP013 = computed(() => session.can('p013.reward.monitor'))
const showP014 = computed(() => session.can('p014.discipline.monitor'))

watch([canP004Monitor, canP005Monitor], ([p004Allowed, p005Allowed]) => {
  if (p004Allowed || p005Allowed) void monitor.refresh()
}, { immediate: true })
</script>

<template>
  <section data-testid="phase09-tech-workflow-monitor">
    <SgjDashboardPageTemplate
      title="P004/P005 工作流监控"
      description="技术端只读监控投影；业务权限与逐记录数据范围仍由服务端裁决。"
    >
      <MonitorPanel v-if="canMonitor" :resource="monitor" />
      <P006MeetingPage v-if="showP006" :portal="portal" mode="tech" />
      <P007SchedulePage v-if="showP007" :portal="portal" mode="tech" />
      <P010LearningPage v-if="showP010" :portal="portal" mode="tech" />
      <P011PerformancePage v-if="showP011" :portal="portal" mode="tech" />
      <P012PromotionPage v-if="showP012" :portal="portal" mode="tech" />
      <P013RewardPage v-if="showP013" :portal="portal" mode="tech" />
      <P014DisciplinePage v-if="showP014" :portal="portal" mode="tech" />
    </SgjDashboardPageTemplate>
  </section>
</template>
